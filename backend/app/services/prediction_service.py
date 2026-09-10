"""
PredictionService — orchestrates real ML inference (FeatureEngineer ➜ ModelRegistry ➜ SHAP).

This service is intentionally designed to work both with and without trained model
artifacts.  When artifacts are missing it produces an honest heuristic fallback
instead of fabricating results.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from app.core.config import get_settings
from app.core.redis_client import cache_get, cache_set
from app.ml.feature_engineering import FEATURE_NAMES, FeatureEngineer
from app.ml.model_registry import ModelRegistry

logger = logging.getLogger(__name__)
settings = get_settings()


class PredictionService:
    """Singleton-style service — instantiate once and reuse."""

    def __init__(self) -> None:
        self.feature_engineer = FeatureEngineer()
        self.registry = ModelRegistry()
        self._models_loaded = False
        self._try_load_models()

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def _try_load_models(self) -> None:
        """Load pre-trained model artefacts.

        Order: MODEL_STORE_URI (object store) first, then the local
        ``model_artifacts/`` directory. Anything left unloaded falls back to the
        heuristic path at inference time.
        """
        store_uri = getattr(settings, "model_store_uri", "") or ""
        if store_uri:
            try:
                self.registry.load_from_store(store_uri)
                if self.registry.get_all_versions():
                    self._models_loaded = True
                    logger.info(
                        "Loaded models from MODEL_STORE_URI=%s (versions: %s)",
                        store_uri,
                        self.registry.get_all_versions(),
                    )
                    return
                logger.warning("MODEL_STORE_URI=%s held no artifacts.", store_uri)
            except Exception as exc:
                logger.warning(
                    "Could not load models from MODEL_STORE_URI=%s: %s", store_uri, exc
                )

        artifacts_dir = self.registry.artifacts_dir
        try:
            pkl_files = [f for f in os.listdir(artifacts_dir) if f.endswith(".pkl")]
            if pkl_files:
                self.registry.load_from_disk(artifacts_dir)
                self._models_loaded = True
                logger.info(
                    "Loaded %d model artefacts from local %s (versions: %s)",
                    len(pkl_files),
                    artifacts_dir,
                    self.registry.get_all_versions(),
                )
            else:
                logger.warning(
                    "No .pkl model artefacts found in %s — predictions will use heuristic fallback.",
                    artifacts_dir,
                )
        except Exception as exc:
            logger.warning("Could not load model artefacts: %s", exc)

    # ------------------------------------------------------------------
    # Build a single-row DataFrame from a Complaint ORM object
    # ------------------------------------------------------------------

    @staticmethod
    def _complaint_to_dataframe(complaint: Any) -> pd.DataFrame:
        """Convert a Complaint ORM row into the DataFrame format expected by
        FeatureEngineer.  Unknown / nullable fields get safe defaults.
        """
        now = datetime.utcnow()
        return pd.DataFrame(
            [
                {
                    "timestamp": complaint.complaint_date or complaint.created_at or now,
                    "lat": complaint.latitude or 28.6139,
                    "lng": complaint.longitude or 77.2090,
                    "complaint_text": complaint.complaint_text or "",
                    "amount": complaint.amount_defrauded or 0.0,
                    "state": complaint.state or "Unknown",
                    "district": complaint.district or "Unknown",
                    "category": (
                        complaint.complaint_category.value
                        if complaint.complaint_category
                        else "other"
                    ),
                    "bank_name": complaint.bank_name or "Unknown",
                }
            ]
        )

    # ------------------------------------------------------------------
    # Real inference
    # ------------------------------------------------------------------

    def run_inference(
        self, complaint: Any, cached_shap: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Run the full ML pipeline synchronously (called via asyncio.to_thread).

        1. Feature extraction via FeatureEngineer
        2. Location prediction via XGBoost model (if available)
        3. Risk classification via Random Forest model (if available)
        4. SHAP explanation (if XGBoost available)

        Returns a dict ready to be persisted as a Prediction row.
        """
        if not self._models_loaded:
            return self.heuristic_fallback(complaint)

        df = self._complaint_to_dataframe(complaint)

        # 1. Extract features
        try:
            feature_matrix = self.feature_engineer.create_feature_matrix(df, is_training=False)
        except Exception as exc:
            logger.warning("Feature extraction failed: %s", exc)
            return self.heuristic_fallback(complaint)

        # 2. Location prediction (XGBoost)
        xgb_model = self.registry.get("xgboost_location")
        predicted_locations: List[Dict[str, Any]] = []
        top_confidence: float = 0.0
        pred_lat: float = complaint.latitude or 28.6139
        pred_lng: float = complaint.longitude or 77.2090

        if xgb_model is not None:
            try:
                top_k = xgb_model.predict_top_k(feature_matrix, k=5)
                for cluster_id, prob in top_k[0]:
                    predicted_locations.append(
                        {
                            "lat": float(df.iloc[0]["lat"]),
                            "lng": float(df.iloc[0]["lng"]),
                            "atm_name": f"Cluster {cluster_id}",
                            "confidence": float(prob),
                        }
                    )
                if top_k[0]:
                    top_confidence = float(top_k[0][0][1])
            except Exception as exc:
                logger.warning("XGBoost prediction failed: %s", exc)

        if not predicted_locations:
            predicted_locations = [
                {
                    "lat": pred_lat,
                    "lng": pred_lng,
                    "atm_name": "Origin location",
                    "confidence": 0.5,
                }
            ]
            top_confidence = 0.5

        # 3. Risk classification (Random Forest)
        risk_level = "medium"
        rf_model = self.registry.get("rf_risk")
        if rf_model is not None:
            try:
                risk_preds = rf_model.predict_risk(feature_matrix)
                risk_level = str(risk_preds[0][0])
            except Exception as exc:
                logger.warning("Risk classification failed: %s", exc)

        # 4. SHAP explanation
        feature_importance: Optional[List[Dict[str, Any]]] = cached_shap
        if feature_importance is None and xgb_model is not None:
            try:
                from app.ml.shap_explainer import SHAPExplainer

                explainer = SHAPExplainer(xgb_model.model, FEATURE_NAMES)
                shap_dict = explainer.explain_prediction(feature_matrix)
                feature_importance = [
                    {"feature": k, "importance": round(float(v), 6)}
                    for k, v in sorted(
                        shap_dict.items(),
                        key=lambda item: abs(float(item[1])),
                        reverse=True,
                    )
                ]
            except Exception as exc:
                logger.warning("SHAP explanation failed: %s", exc)


        return {
            "predicted_latitude": pred_lat,
            "predicted_longitude": pred_lng,
            "confidence_score": round(top_confidence, 4),
            "predicted_locations": predicted_locations,
            "model_version": settings.model_version,
            "model_name": "xgboost_location",
            "feature_importance": feature_importance,
            "risk_level": risk_level,
            "prediction_radius_km": settings.max_prediction_radius_km,
        }

    # ------------------------------------------------------------------
    # Heuristic fallback (no trained models available)
    # ------------------------------------------------------------------

    @staticmethod
    def heuristic_fallback(complaint: Any) -> Dict[str, Any]:
        """Produce an honest, low-confidence prediction when ML models are not
        available.  Uses the complaint's own coordinates (if any) and marks
        confidence clearly as 0.0 so downstream consumers know this is not
        a real model output.
        """
        lat = complaint.latitude or 28.6139
        lng = complaint.longitude or 77.2090
        amount = complaint.amount_defrauded or 0.0

        # Simple rule-based risk
        if amount > 100_000:
            risk = "critical"
        elif amount > 50_000:
            risk = "high"
        elif amount > 10_000:
            risk = "medium"
        else:
            risk = "low"

        return {
            "predicted_latitude": lat,
            "predicted_longitude": lng,
            "confidence_score": 0.0,
            "predicted_locations": [
                {
                    "lat": lat,
                    "lng": lng,
                    "atm_name": "Heuristic — no model loaded",
                    "confidence": 0.0,
                }
            ],
            "model_version": settings.model_version,
            "model_name": "heuristic_fallback",
            "feature_importance": None,
            "risk_level": risk,
            "prediction_radius_km": settings.max_prediction_radius_km,
        }

    # ------------------------------------------------------------------
    # Batch background task
    # ------------------------------------------------------------------

    async def batch_predict_background(
        self, complaint_ids: List[str]
    ) -> None:
        """Run predictions for a list of complaint IDs in the background.

        Each complaint is fetched from the DB, run through inference, and the
        resulting Prediction row is persisted.
        """
        import asyncio
        import uuid as _uuid

        from app.core.database import AsyncSessionLocal
        from app.models.complaint import Complaint
        from app.models.prediction import Prediction

        async with AsyncSessionLocal() as db:
            for cid_str in complaint_ids:
                try:
                    from uuid import UUID

                    cid = UUID(cid_str)
                    result = await db.execute(
                        __import__("sqlalchemy").select(Complaint).where(
                            Complaint.id == cid
                        )
                    )
                    complaint = result.scalar_one_or_none()
                    if complaint is None:
                        logger.warning("Batch: complaint %s not found", cid_str)
                        continue

                    pred_data = await asyncio.to_thread(self.run_inference, complaint)
                    new_pred = Prediction(
                        id=_uuid.uuid4(),
                        complaint_id=cid,
                        predicted_latitude=pred_data["predicted_latitude"],
                        predicted_longitude=pred_data["predicted_longitude"],
                        confidence_score=pred_data["confidence_score"],
                        predicted_locations=pred_data["predicted_locations"],
                        model_version=pred_data.get("model_version"),
                        model_name=pred_data.get("model_name"),
                        feature_importance=pred_data.get("feature_importance"),
                        risk_level=pred_data["risk_level"],
                        prediction_radius_km=pred_data.get("prediction_radius_km"),
                    )
                    db.add(new_pred)
                    await db.commit()
                    logger.info("Batch: predicted complaint %s", cid_str)
                except Exception as exc:
                    logger.error(
                        "Batch: failed to predict complaint %s: %s", cid_str, exc
                    )
                    await db.rollback()

    # ------------------------------------------------------------------
    # Stats (real DB query)
    # ------------------------------------------------------------------

    async def get_confidence_stats(self) -> Dict[str, Any]:
        """Return aggregated confidence stats from the predictions table."""
        from datetime import timedelta

        from sqlalchemy import func, select

        from app.core.database import AsyncSessionLocal
        from app.models.prediction import Prediction

        async with AsyncSessionLocal() as db:
            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            result = await db.execute(
                select(
                    func.avg(Prediction.confidence_score),
                    func.count(Prediction.id),
                    func.count(Prediction.id).filter(
                        Prediction.confidence_score > 0.7
                    ),
                ).where(Prediction.created_at >= thirty_days_ago)
            )
            row = result.one()
            return {
                "average_confidence": round(float(row[0] or 0), 4),
                "total_predictions_30d": int(row[1]),
                "high_confidence_predictions": int(row[2]),
            }
