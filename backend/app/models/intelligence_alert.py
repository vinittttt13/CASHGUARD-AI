import enum
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class AlertType(str, enum.Enum):
    hotspot_detected = "hotspot_detected"
    pattern_change = "pattern_change"
    high_risk_location = "high_risk_location"
    temporal_spike = "temporal_spike"


class AlertPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class IntelligenceAlert(Base):
    __tablename__ = "intelligence_alerts"
    __table_args__ = (
        Index("ix_intelligence_alerts_created_at", "created_at"),
        Index("ix_intelligence_alerts_is_active", "is_active"),
        Index("ix_intelligence_alerts_priority", "priority"),
        Index(
            "ix_intelligence_alerts_active_unack",
            text("created_at DESC"),
            postgresql_where=text("is_active = true AND is_acknowledged = false"),
        ),
        Index(
            "ix_intelligence_alerts_expires",
            "expires_at",
            postgresql_where=text("is_active = true AND expires_at IS NOT NULL"),
        ),
        Index(
            "ix_intelligence_alerts_affected_locations_gin",
            "affected_locations",
            postgresql_using="gin",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    alert_type = Column(Enum(AlertType), nullable=False)
    priority = Column(Enum(AlertPriority), default=AlertPriority.medium)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    radius_km = Column(Float, nullable=True)
    affected_locations = Column(JSONB, nullable=True)  # list of location IDs
    confidence_score = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    is_acknowledged = Column(Boolean, default=False)

    acknowledged_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)

    acknowledger = relationship(
        "User", back_populates="acknowledged_alerts", foreign_keys=[acknowledged_by]
    )
