import enum
import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class ComplaintCategory(str, enum.Enum):
    vishing = "vishing"
    phishing = "phishing"
    otp_fraud = "otp_fraud"
    atm_fraud = "atm_fraud"
    other = "other"

class ComplaintStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    predicted = "predicted"
    resolved = "resolved"

class Complaint(Base):
    __tablename__ = "complaints"
    __table_args__ = (
        Index("ix_complaints_status", "status"),
        Index("ix_complaints_complaint_category", "complaint_category"),
        Index("ix_complaints_state", "state"),
        Index("ix_complaints_created_at", "created_at"),
        Index("ix_complaints_bank_name", "bank_name"),
        Index("ix_complaints_lat_lng", "latitude", "longitude"),
        CheckConstraint(
            "latitude IS NULL OR latitude BETWEEN -90 AND 90",
            name="chk_complaints_latitude",
        ),
        CheckConstraint(
            "longitude IS NULL OR longitude BETWEEN -180 AND 180",
            name="chk_complaints_longitude",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    complaint_number = Column(String, unique=True, index=True, nullable=False)
    victim_name_masked = Column(String, nullable=True)
    victim_phone_masked = Column(String, nullable=True)
    complaint_text = Column(String, nullable=False)
    complaint_category = Column(Enum(ComplaintCategory), default=ComplaintCategory.other)
    amount_defrauded = Column(Float, default=0.0)
    currency = Column(String, default="INR")
    state = Column(String, nullable=True)
    district = Column(String, nullable=True)
    city = Column(String, nullable=True)
    pincode = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    complaint_date = Column(DateTime(timezone=True), nullable=True)
    incident_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(Enum(ComplaintStatus), default=ComplaintStatus.pending)
    bank_name = Column(String, nullable=True)
    account_type = Column(String, nullable=True)
    
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    assigned_to_user = relationship("User", back_populates="complaints", foreign_keys=[assigned_to], lazy="selectin")
    predictions = relationship("Prediction", back_populates="complaint", cascade="all, delete-orphan", lazy="selectin")
