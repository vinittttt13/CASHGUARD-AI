import uuid
from sqlalchemy import Column, String, Float, Enum, DateTime, func, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.core.database import Base

class LocationType(str, enum.Enum):
    ATM = "ATM"
    bank_branch = "bank_branch"
    payment_kiosk = "payment_kiosk"

class WithdrawalLocation(Base):
    __tablename__ = "withdrawal_locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    location_type = Column(Enum(LocationType), default=LocationType.ATM)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    pincode = Column(String, nullable=True)
    bank_name = Column(String, nullable=True)
    atm_id = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    risk_score = Column(Float, default=0.0)
    last_incident_date = Column(DateTime(timezone=True), nullable=True)
    incident_count = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
