"""
GeospatialService — performs geodesic spatial queries, nearest ATM searches,
and radius filters using BallTree with Haversine metric on radian coordinates.
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sklearn.neighbors import BallTree
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.withdrawal_location import WithdrawalLocation

logger = logging.getLogger(__name__)


class GeospatialService:
    def __init__(self) -> None:
        self.ball_tree: Optional[BallTree] = None
        self.locations: List[Dict[str, Any]] = []

    async def load_atm_locations(self, db: AsyncSession) -> int:
        """Fetch active withdrawal locations from DB and build a geodesic BallTree index."""
        result = await db.execute(
            select(WithdrawalLocation).where(WithdrawalLocation.is_active == True)
        )
        records = result.scalars().all()

        self.locations = [
            {
                "id": str(r.id),
                "name": r.name,
                "address": r.address,
                "city": r.city,
                "state": r.state,
                "latitude": float(r.latitude),
                "longitude": float(r.longitude),
                "location_type": r.location_type.value if hasattr(r.location_type, "value") else str(r.location_type),
                "risk_score": float(r.risk_score or 0.0),
                "incident_count": int(r.incident_count or 0),
            }
            for r in records
            if r.latitude is not None and r.longitude is not None
        ]

        if self.locations:
            coords = np.array([[loc["latitude"], loc["longitude"]] for loc in self.locations])
            rad_coords = np.radians(coords)
            self.ball_tree = BallTree(rad_coords, metric="haversine")
            logger.info("Loaded %d withdrawal locations into BallTree index.", len(self.locations))
        else:
            self.ball_tree = None

        return len(self.locations)

    def haversine(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate great-circle distance between two points in kilometers."""
        R = 6371.0  # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def find_nearest_atms(self, lat: float, lng: float, k: int = 10) -> List[Dict[str, Any]]:
        """Find the k nearest withdrawal locations using the geodesic index."""
        if self.ball_tree is None or not self.locations:
            return []

        actual_k = min(k, len(self.locations))
        query_rad = np.radians([[lat, lng]])
        rad_dists, indices = self.ball_tree.query(query_rad, k=actual_k)

        results = []
        for dist_rad, idx in zip(rad_dists[0], indices[0]):
            loc = dict(self.locations[idx])
            loc["distance_km"] = round(float(dist_rad * 6371.0), 3)
            results.append(loc)

        return results

    def find_within_radius(
        self, lat: float, lng: float, radius_km: float
    ) -> List[Dict[str, Any]]:
        """Find all withdrawal locations within radius_km using the geodesic index."""
        if self.ball_tree is None or not self.locations:
            return []

        query_rad = np.radians([[lat, lng]])
        radius_rad = radius_km / 6371.0
        indices = self.ball_tree.query_radius(query_rad, r=radius_rad)[0]

        results = []
        for idx in indices:
            loc = dict(self.locations[idx])
            dist_km = self.haversine(lat, lng, loc["latitude"], loc["longitude"])
            loc["distance_km"] = round(dist_km, 3)
            results.append(loc)

        results.sort(key=lambda x: x["distance_km"])
        return results

    def generate_heatmap_points(self, locations: List[Any]) -> List[Dict[str, float]]:
        """Generate weighted heatmap points from location or prediction objects."""
        points = []
        for item in locations:
            lat = getattr(item, "latitude", None) or (item.get("latitude") if isinstance(item, dict) else None)
            lng = getattr(item, "longitude", None) or (item.get("longitude") if isinstance(item, dict) else None)
            weight = getattr(item, "risk_score", None) or (item.get("risk_score") if isinstance(item, dict) else None)
            if weight is None:
                weight = getattr(item, "confidence_score", None) or (item.get("confidence_score") if isinstance(item, dict) else None)

            if lat is not None and lng is not None:
                points.append({
                    "lat": float(lat),
                    "lng": float(lng),
                    "weight": round(float(weight or 0.5), 3),
                })
        return points

    def calculate_risk_score(self, location: Dict[str, Any], recent_incidents: int) -> float:
        """Compute an incident-calibrated risk score between 0.0 and 1.0."""
        base_score = float(location.get("risk_score") or 0.1)
        incident_boost = min(0.6, recent_incidents * 0.05)
        return round(min(1.0, base_score + incident_boost), 3)
