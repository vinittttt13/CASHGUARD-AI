from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intelligence_alert import AlertPriority, AlertType, IntelligenceAlert


class AlertService:
    async def evaluate_and_create_alerts(self, prediction_data: dict, db: AsyncSession):
        confidence = prediction_data.get("confidence_score", 0)
        risk_level = prediction_data.get("risk_level", "low")

        if confidence > 0.8 and risk_level == "critical":
            alert = IntelligenceAlert(
                title="High Confidence Critical Prediction",
                description=f"Critical risk predicted with {confidence*100:.0f}% confidence.",
                alert_type=AlertType.hotspot_detected,
                priority=AlertPriority.critical,
            )
            db.add(alert)
            await db.commit()

    async def get_active_alerts(self, db: AsyncSession, limit: int = 50) -> list:
        query = (
            select(IntelligenceAlert)
            .where(IntelligenceAlert.is_active == True)
            .order_by(IntelligenceAlert.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(query)
        return result.scalars().all()

    async def acknowledge_alert(self, alert_id, user_id, db: AsyncSession):
        result = await db.execute(
            select(IntelligenceAlert).where(IntelligenceAlert.id == alert_id)
        )
        alert = result.scalar_one_or_none()
        if alert:
            alert.is_acknowledged = True
            alert.acknowledged_by = user_id
            await db.commit()
            await db.refresh(alert)
        return alert

    async def expire_old_alerts(self, db: AsyncSession):
        cutoff = datetime.utcnow() - timedelta(days=1)
        query = select(IntelligenceAlert).where(
            IntelligenceAlert.created_at < cutoff, IntelligenceAlert.is_active == True
        )
        result = await db.execute(query)
        alerts = result.scalars().all()
        for alert in alerts:
            alert.is_active = False
        await db.commit()

    def priority_score(self, alert: IntelligenceAlert) -> int:
        scores = {
            AlertPriority.critical: 100,
            AlertPriority.high: 80,
            AlertPriority.medium: 50,
            AlertPriority.low: 20,
        }
        return scores.get(alert.priority, 0)
