from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from app.models.intelligence_alert import AlertType, AlertPriority

class AlertBase(BaseModel):
    title: str
    description: Optional[str] = None
    alert_type: AlertType
    priority: AlertPriority = AlertPriority.medium
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = None
    affected_locations: Optional[List[str]] = None
    confidence_score: Optional[float] = None
    is_active: bool = True
    is_acknowledged: bool = False

class AlertCreate(AlertBase):
    expires_at: Optional[datetime] = None

class AlertResponse(AlertBase):
    id: UUID
    acknowledged_by: Optional[UUID] = None
    created_at: datetime
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class AlertListResponse(BaseModel):
    items: List[AlertResponse]
    total: int

class IntelligenceReport(BaseModel):
    report_id: UUID
    generated_at: datetime
    summary: str
    active_alerts: int
    hotspots: List[Dict[str, Any]]
