from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.models.prediction import Prediction
from app.schemas.prediction import (
    PredictionRequest,
    PredictionResponse,
    BatchPredictionRequest,
    BatchPredictionResponse,
)
from app.core.redis_client import cache_get, cache_set

router = APIRouter(prefix="/predict", tags=["Prediction"])


@router.post("", response_model=PredictionResponse)
async def predict(
    request: Request,
    pred_request: PredictionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check cache first
    cache_key = f"predict:{pred_request.complaint_id}"
    if not pred_request.force_refresh:
        cached = await cache_get(cache_key)
        if cached:
            return cached

    # Check complaint exists
    from app.models.complaint import Complaint

    result = await db.execute(
        select(Complaint).where(Complaint.id == pred_request.complaint_id)
    )
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Create mock prediction (real ML pipeline would go here)
    import uuid

    new_prediction = Prediction(
        id=uuid.uuid4(),
        complaint_id=pred_request.complaint_id,
        predicted_latitude=complaint.latitude or 28.6139,
        predicted_longitude=complaint.longitude or 77.2090,
        confidence_score=0.85,
        predicted_locations=[
            {
                "lat": complaint.latitude or 28.6139,
                "lng": complaint.longitude or 77.2090,
                "atm_name": "Predicted ATM",
                "confidence": 0.85,
            }
        ],
        model_version="1.0.0",
        model_name="xgboost_v1",
        risk_level="high",
    )
    db.add(new_prediction)
    await db.commit()
    await db.refresh(new_prediction)

    # Cache result
    response_data = PredictionResponse.model_validate(new_prediction)
    await cache_set(cache_key, response_data.model_dump(mode="json"), ttl=3600)

    return response_data


@router.post("/batch", response_model=dict)
async def batch_predict(
    batch_request: BatchPredictionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role("analyst", "admin")),
    db: AsyncSession = Depends(get_db),
):
    if len(batch_request.complaint_ids) > 100:
        raise HTTPException(
            status_code=400, detail="Max 100 complaints allowed in batch"
        )

    return {
        "message": "Batch prediction started in background",
        "total_received": len(batch_request.complaint_ids),
    }


@router.get("/{prediction_id}", response_model=PredictionResponse)
async def get_prediction(
    prediction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Prediction).where(Prediction.id == prediction_id)
    )
    prediction = result.scalar_one_or_none()
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return prediction
