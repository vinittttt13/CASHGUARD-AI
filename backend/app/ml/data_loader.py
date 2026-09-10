"""Build the training DataFrame from the operational database.

The models want one row per historical complaint with these columns::

    timestamp, lat, lng, complaint_text, amount, state, district,
    category, bank_name, cluster_id, risk_level

`cluster_id` and `risk_level` are *derived* (there is no labelled ground truth
yet):

* **cluster_id** — the K-Means hotspot cluster of the complaint's coordinates,
  fitted on historical withdrawal-location coordinates.
* **risk_level** — a documented deterministic rule (NOT random):
  a score from the defrauded amount, the local incident density (incident_count
  of the nearest withdrawal location) and whether the complaint sits inside a
  known hotspot; bucketed into low / medium / high / critical.

Replace the `risk_level` rule with real labels once analysts start tagging
outcomes.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ml.kmeans_hotspot import HotspotDetector

logger = logging.getLogger(__name__)

# Minimum rows below which training is not meaningful.
MIN_TRAINING_ROWS = 20

_RISK_BUCKETS = [
    (0.75, "critical"),
    (0.50, "high"),
    (0.25, "medium"),
    (0.00, "low"),
]


def _haversine_km(lat1, lon1, lat2, lon2) -> np.ndarray:
    r = 6371.0
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return r * 2 * np.arcsin(np.sqrt(a))


def _derive_risk_level(
    amount: float, nearest_incident_count: int, in_hotspot: bool
) -> str:
    """Deterministic risk rule — see module docstring."""
    amount = float(amount or 0.0)
    # Amount component: Rs 0 -> 0.0, Rs 200k+ -> ~1.0 on a log scale.
    amount_score = np.clip(
        (np.log1p(max(amount, 0.0)) - np.log1p(1_000.0))
        / (np.log1p(200_000.0) - np.log1p(1_000.0)),
        0.0,
        1.0,
    )
    density_score = np.clip((nearest_incident_count or 0) / 25.0, 0.0, 1.0)
    score = 0.55 * amount_score + 0.30 * density_score + (0.15 if in_hotspot else 0.0)
    for threshold, label in _RISK_BUCKETS:
        if score >= threshold:
            return label
    return "low"


async def _fetch_complaints(session: AsyncSession) -> pd.DataFrame:
    from app.models.complaint import Complaint

    rows = (await session.execute(select(Complaint))).scalars().all()
    records = []
    for c in rows:
        ts = c.incident_date or c.complaint_date or c.created_at
        records.append(
            {
                "id": str(c.id),
                "timestamp": ts,
                "lat": c.latitude,
                "lng": c.longitude,
                "complaint_text": c.complaint_text or "",
                "amount": float(c.amount_defrauded or 0.0),
                "state": c.state,
                "district": c.district,
                "category": getattr(c.complaint_category, "value", c.complaint_category),
                "bank_name": c.bank_name,
            }
        )
    return pd.DataFrame.from_records(records)


async def _fetch_location_frame(session: AsyncSession) -> pd.DataFrame:
    from app.models.withdrawal_location import WithdrawalLocation

    rows = (
        (await session.execute(select(WithdrawalLocation))).scalars().all()
    )
    return pd.DataFrame.from_records(
        [
            {
                "lat": loc.latitude,
                "lng": loc.longitude,
                "incident_count": int(loc.incident_count or 0),
                "risk_score": float(loc.risk_score or 0.0),
            }
            for loc in rows
        ]
    )


async def load_training_frame(session: AsyncSession) -> pd.DataFrame:
    """Return the model-ready training DataFrame (see module docstring)."""
    complaints = await _fetch_complaints(session)
    locations = await _fetch_location_frame(session)

    if complaints.empty:
        return complaints

    # Drop rows without coordinates or timestamp — unusable for the geo/temporal
    # feature extractors.
    complaints = complaints.dropna(subset=["lat", "lng", "timestamp"]).reset_index(
        drop=True
    )
    if complaints.empty:
        return complaints

    complaints["timestamp"] = pd.to_datetime(complaints["timestamp"], utc=True)

    # ---- cluster_id from a hotspot model fitted on withdrawal-location coords ----
    detector = HotspotDetector()
    if not locations.empty and len(locations) >= 3:
        detector.fit(locations[["lat", "lng"]].values.tolist())
        complaints["cluster_id"] = [
            int(detector.predict_cluster(lat, lng))
            for lat, lng in zip(complaints["lat"], complaints["lng"])
        ]
    else:
        # Not enough locations to cluster — fall back to clustering the
        # complaints themselves.
        detector.fit(complaints[["lat", "lng"]].values.tolist())
        complaints["cluster_id"] = [
            int(detector.predict_cluster(lat, lng))
            for lat, lng in zip(complaints["lat"], complaints["lng"])
        ]
    # predict_cluster returns -1 when the model could not fit; map to 0.
    complaints["cluster_id"] = complaints["cluster_id"].clip(lower=0)

    # ---- risk_level from the documented deterministic rule ----
    if not locations.empty:
        loc_lat = locations["lat"].to_numpy()
        loc_lng = locations["lng"].to_numpy()
        loc_incidents = locations["incident_count"].to_numpy()

        def nearest_incident(lat, lng) -> int:
            d = _haversine_km(lat, lng, loc_lat, loc_lng)
            return int(loc_incidents[int(np.argmin(d))])

    else:
        def nearest_incident(lat, lng) -> int:  # noqa: ARG001
            return 0

    hotspot_ids = set(int(ci["cluster_id"]) for ci in detector.cluster_info)
    complaints["risk_level"] = [
        _derive_risk_level(
            amount=row.amount,
            nearest_incident_count=nearest_incident(row.lat, row.lng),
            in_hotspot=int(row.cluster_id) in hotspot_ids,
        )
        for row in complaints.itertuples(index=False)
    ]

    return complaints[
        [
            "timestamp",
            "lat",
            "lng",
            "complaint_text",
            "amount",
            "state",
            "district",
            "category",
            "bank_name",
            "cluster_id",
            "risk_level",
        ]
    ]


async def load_withdrawal_coords(session: AsyncSession) -> pd.DataFrame:
    """`lat`/`lng` of every withdrawal location, for fitting the ATM BallTree."""
    frame = await _fetch_location_frame(session)
    return frame[["lat", "lng"]] if not frame.empty else frame
