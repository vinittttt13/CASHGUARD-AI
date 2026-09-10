from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.prediction import RiskLevel


class FeatureImportance(BaseModel):
    feature: str
    importance: float

class PredictedLocation(BaseModel):
    lat: float
    lng: float
    atm_name: Optional[str] = None
    confidence: float

class PredictionRequest(BaseModel):
    complaint_id: UUID
    force_refresh: bool = False

class PredictionResponse(BaseModel):
    id: UUID
    complaint_id: UUID
    predicted_latitude: float
    predicted_longitude: float
    confidence_score: float
    predicted_locations: Optional[List[Dict[str, Any]]] = None
    hotspot_cluster_id: Optional[int] = None
    model_version: Optional[str] = None
    model_name: Optional[str] = None
    feature_importance: Optional[List[Dict[str, Any]]] = None
    risk_level: RiskLevel
    prediction_radius_km: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class BatchPredictionRequest(BaseModel):
    complaint_ids: List[UUID]

class BatchPredictionResponse(BaseModel):
    predictions: List[PredictionResponse]
    failed_ids: List[UUID]

class HotspotResponse(BaseModel):
    cluster_id: int
    center_lat: float
    center_lng: float
    radius_km: float
    risk_level: RiskLevel
    complaint_count: int
    active_alerts: int
