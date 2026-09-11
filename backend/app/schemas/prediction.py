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


class AmlTransactionRequest(BaseModel):
    timestamp: Optional[str] = None
    from_bank: Optional[str] = None
    from_account: Optional[str] = None
    to_bank: Optional[str] = None
    to_account: Optional[str] = None
    amount_paid: float
    amount_received: Optional[float] = None
    payment_currency: Optional[str] = "US Dollar"
    receiving_currency: Optional[str] = "US Dollar"
    payment_format: Optional[str] = "Cash"


class AmlTransactionResponse(BaseModel):
    is_laundering: int
    laundering_probability: float
    risk_level: str
    decision_threshold: float
    top_factors: List[Dict[str, Any]]
    model_name: str = "xgboost_aml"
    model_version: str = "v1.0"


class TrainModelRequest(BaseModel):
    source: str = "synthetic"  # "synthetic" | "database"
    sample_size: int = 10000
    models: Optional[List[str]] = None
    version: Optional[str] = None


class TrainModelResponse(BaseModel):
    status: str
    version: str
    duration_seconds: float
    source: str
    sample_size: int
    models_trained: List[str]
    metrics: Dict[str, Any]
    timestamp: str


class ModelStatusResponse(BaseModel):
    loaded_models: Dict[str, str]
    total_loaded: int
    artifacts_dir: str
    manifest: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None

