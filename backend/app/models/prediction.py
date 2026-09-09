import uuid
from sqlalchemy import Column, String, Float, Enum, DateTime, func, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base

class RiskLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    complaint_id = Column(UUID(as_uuid=True), ForeignKey("complaints.id"), nullable=False)
    predicted_latitude = Column(Float, nullable=False)
    predicted_longitude = Column(Float, nullable=False)
    confidence_score = Column(Float, nullable=False) # 0 to 1
    predicted_locations = Column(JSONB, nullable=True) # list of top-5 {lat, lng, atm_name, confidence}
    hotspot_cluster_id = Column(Integer, nullable=True)
    model_version = Column(String, nullable=True)
    model_name = Column(String, nullable=True)
    feature_importance = Column(JSONB, nullable=True) # SHAP values
    risk_level = Column(Enum(RiskLevel), default=RiskLevel.medium)
    prediction_radius_km = Column(Float, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    complaint = relationship("Complaint", back_populates="predictions")
