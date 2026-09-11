"""Unit tests for app.ml.data_loader against the SQLite test DB."""

import uuid
from datetime import datetime, timedelta

import pandas as pd
import pytest

from app.ml.data_loader import MIN_TRAINING_ROWS, load_training_frame

VALID_RISK = {"low", "medium", "high", "critical"}
EXPECTED_COLUMNS = {
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
}


async def _seed(db, n_complaints=25, n_locations=6):
    from app.models.complaint import Complaint, ComplaintCategory, ComplaintStatus
    from app.models.withdrawal_location import LocationType, WithdrawalLocation

    for i in range(n_locations):
        db.add(
            WithdrawalLocation(
                id=uuid.uuid4(),
                name=f"ATM {i}",
                location_type=LocationType.ATM,
                latitude=19.0 + i * 0.02,
                longitude=72.8 + i * 0.02,
                is_active=True,
                risk_score=0.1 * i,
                incident_count=i * 4,
            )
        )
    for i in range(n_complaints):
        db.add(
            Complaint(
                id=uuid.uuid4(),
                complaint_number=f"CMP-DL-{i:04d}",
                complaint_text=f"Fraud reported at an ATM in zone {i % 4}.",
                complaint_category=list(ComplaintCategory)[i % len(ComplaintCategory)],
                amount_defrauded=2000.0 + i * 3500,
                state="Maharashtra",
                district="Mumbai",
                latitude=19.0 + (i % 5) * 0.02,
                longitude=72.8 + (i % 5) * 0.02,
                incident_date=datetime(2024, 1, 1) + timedelta(days=i * 2),
                status=ComplaintStatus.pending,
                bank_name=["SBI", "HDFC", "ICICI"][i % 3],
            )
        )
    await db.commit()


@pytest.mark.asyncio
async def test_load_training_frame_shape_and_derived_labels(db_session):
    await _seed(db_session, n_complaints=25)

    df = await load_training_frame(db_session)

    assert isinstance(df, pd.DataFrame)
    assert len(df) == 25
    assert EXPECTED_COLUMNS.issubset(df.columns)
    # Derived columns are fully populated (no np.random, no NaN).
    assert df["cluster_id"].notna().all()
    assert (df["cluster_id"] >= 0).all()
    assert df["risk_level"].notna().all()
    assert set(df["risk_level"]).issubset(VALID_RISK)
    # A big-amount complaint near a high-incident location must not be "low".
    assert (df["risk_level"] != "low").any()


@pytest.mark.asyncio
async def test_load_training_frame_empty(db_session):
    df = await load_training_frame(db_session)
    assert isinstance(df, pd.DataFrame)
    assert df.empty


@pytest.mark.asyncio
async def test_load_training_frame_drops_rows_without_coords(db_session):
    from app.models.complaint import Complaint, ComplaintStatus

    await _seed(db_session, n_complaints=22)
    db_session.add(
        Complaint(
            id=uuid.uuid4(),
            complaint_number="CMP-DL-NOCOORD",
            complaint_text="No location given.",
            amount_defrauded=1000.0,
            status=ComplaintStatus.pending,
            latitude=None,
            longitude=None,
            incident_date=datetime(2024, 3, 1),
        )
    )
    await db_session.commit()

    df = await load_training_frame(db_session)
    assert len(df) == 22  # the no-coordinate row is dropped
    assert len(df) >= MIN_TRAINING_ROWS
