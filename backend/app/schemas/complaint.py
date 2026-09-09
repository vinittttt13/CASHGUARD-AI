from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.complaint import ComplaintCategory, ComplaintStatus
from app.schemas.prediction import PredictionResponse

class ComplaintBase(BaseModel):
    complaint_number: str
    victim_name_masked: Optional[str] = None
    victim_phone_masked: Optional[str] = None
    complaint_text: str
    complaint_category: ComplaintCategory = ComplaintCategory.other
    amount_defrauded: float = 0.0
    currency: str = "INR"
    state: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    complaint_date: Optional[datetime] = None
    incident_date: Optional[datetime] = None
    status: ComplaintStatus = ComplaintStatus.pending
    bank_name: Optional[str] = None
    account_type: Optional[str] = None

class ComplaintCreate(ComplaintBase):
    pass

class ComplaintUpdate(BaseModel):
    status: Optional[ComplaintStatus] = None
    assigned_to: Optional[UUID] = None

class ComplaintResponse(ComplaintBase):
    id: UUID
    assigned_to: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    predictions: List[PredictionResponse] = []

    model_config = ConfigDict(from_attributes=True)

class ComplaintListResponse(BaseModel):
    items: List[ComplaintResponse]
    total: int
