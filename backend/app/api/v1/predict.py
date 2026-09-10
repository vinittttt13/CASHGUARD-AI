import asyncio
import logging
import uuid
from uuid import UUID

import numpy as np
import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis_client import cache_get, cache_set
from app.core.security import get_current_user, require_role
from app.models.prediction import Prediction
from app.models.user import User
from app.schemas.prediction import (
    BatchPredictionRequest,
    BatchPredictionResponse,
    PredictionRequest,
    PredictionResponse,
)
from app.services.prediction_service import PredictionService
from app.utils.circuit_breaker import CircuitBreaker, CircuitBreakerOpenException

router = APIRouter(prefix="/predict", tags=["Prediction"])
logger = logging.getLogger(__name__)

# Singleton service and circuit breaker for ML prediction
_prediction_service: PredictionService | None = None
prediction_circuit_breaker = CircuitBreaker(
    "ml_prediction", failure_threshold=3, recovery_timeout=30.0
)


def _get_prediction_service() -> PredictionService:
    """Lazily create / return the shared PredictionService."""
    global _prediction_service
    if _prediction_service is None:
        _prediction_service = PredictionService()
    return _prediction_service


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

    # ---------- Real ML inference with Circuit Breaker & SHAP caching ----------
    svc = _get_prediction_service()
    shap_cache_key = f"shap:{pred_request.complaint_id}"
    cached_shap = None
    if not pred_request.force_refresh:
        cached_shap = await cache_get(shap_cache_key)

    try:
        prediction_data = await prediction_circuit_breaker.async_call(
            svc.run_inference, complaint, cached_shap
        )
    except CircuitBreakerOpenException as cbe:
        logger.warning("Prediction circuit breaker is OPEN: %s. Using heuristic fallback.", cbe)
        prediction_data = svc.heuristic_fallback(complaint)
    except Exception as exc:
        logger.warning("ML inference failed, falling back to heuristic: %s", exc)
        prediction_data = svc.heuristic_fallback(complaint)

    if prediction_data.get("feature_importance") and not cached_shap:
        await cache_set(shap_cache_key, prediction_data["feature_importance"], ttl=3600)


    new_prediction = Prediction(
        id=uuid.uuid4(),
        complaint_id=pred_request.complaint_id,
        predicted_latitude=prediction_data["predicted_latitude"],
        predicted_longitude=prediction_data["predicted_longitude"],
        confidence_score=prediction_data["confidence_score"],
        predicted_locations=prediction_data["predicted_locations"],
        model_version=prediction_data.get("model_version"),
        model_name=prediction_data.get("model_name"),
        feature_importance=prediction_data.get("feature_importance"),
        risk_level=prediction_data["risk_level"],
        prediction_radius_km=prediction_data.get("prediction_radius_km"),
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

    svc = _get_prediction_service()

    # Actually schedule background work
    background_tasks.add_task(
        svc.batch_predict_background,
        complaint_ids=[str(cid) for cid in batch_request.complaint_ids],
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
