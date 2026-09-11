"""
IntelligenceService — aggregates real database records to produce cybercrime
intelligence reports, temporal trends, hotspot analytics, and operational advisories.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.complaint import Complaint
from app.models.intelligence_alert import AlertPriority, IntelligenceAlert
from app.models.prediction import Prediction, RiskLevel
from app.models.withdrawal_location import WithdrawalLocation

logger = logging.getLogger(__name__)


class IntelligenceService:
    async def generate_report(self, db: AsyncSession, days: int = 7) -> Dict[str, Any]:
        """Aggregate actual DB records over the past `days` to produce an intelligence report."""
        start_date = datetime.utcnow() - timedelta(days=days)

        # 1. Total complaints in period
        complaints_res = await db.execute(
            select(func.count(Complaint.id)).where(Complaint.created_at >= start_date)
        )
        total_complaints = int(complaints_res.scalar_one() or 0)

        # 2. Total defrauded amount
        amount_res = await db.execute(
            select(func.sum(Complaint.amount_defrauded)).where(
                Complaint.created_at >= start_date
            )
        )
        total_defrauded = float(amount_res.scalar_one() or 0.0)

        # 3. Active intelligence alerts
        alerts_res = await db.execute(
            select(IntelligenceAlert)
            .where(
                and_(
                    IntelligenceAlert.is_active == True,
                    IntelligenceAlert.created_at >= start_date,
                )
            )
            .order_by(IntelligenceAlert.created_at.desc())
            .limit(10)
        )
        active_alerts = alerts_res.scalars().all()
        alerts_data = [
            {
                "id": str(a.id),
                "title": a.title,
                "priority": (
                    a.priority.value
                    if hasattr(a.priority, "value")
                    else str(a.priority)
                ),
                "alert_type": (
                    a.alert_type.value
                    if hasattr(a.alert_type, "value")
                    else str(a.alert_type)
                ),
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in active_alerts
        ]

        # 4. State-wise breakdown
        states_res = await db.execute(
            select(Complaint.state, func.count(Complaint.id))
            .where(Complaint.created_at >= start_date)
            .group_by(Complaint.state)
        )
        state_breakdown = {
            (row[0] or "Unknown"): int(row[1]) for row in states_res.all()
        }

        # 5. Category breakdown
        cat_res = await db.execute(
            select(Complaint.complaint_category, func.count(Complaint.id))
            .where(Complaint.created_at >= start_date)
            .group_by(Complaint.complaint_category)
        )
        category_breakdown = {
            (row[0].value if hasattr(row[0], "value") else str(row[0])): int(row[1])
            for row in cat_res.all()
        }

        # 6. Top targeted banks
        banks_res = await db.execute(
            select(Complaint.bank_name, func.count(Complaint.id))
            .where(
                and_(
                    Complaint.created_at >= start_date,
                    Complaint.bank_name.isnot(None),
                )
            )
            .group_by(Complaint.bank_name)
            .order_by(func.count(Complaint.id).desc())
            .limit(5)
        )
        top_banks = [
            {"bank_name": row[0], "complaint_count": int(row[1])}
            for row in banks_res.all()
            if row[0]
        ]

        # 7. Active hotspots from withdrawal locations
        hotspots_res = await db.execute(
            select(WithdrawalLocation)
            .where(
                and_(
                    WithdrawalLocation.is_active == True,
                    WithdrawalLocation.risk_score >= 0.5,
                )
            )
            .order_by(WithdrawalLocation.risk_score.desc())
            .limit(10)
        )
        hotspot_locs = hotspots_res.scalars().all()
        active_hotspots = [
            {
                "id": str(h.id),
                "name": h.name,
                "lat": h.latitude,
                "lng": h.longitude,
                "risk_score": h.risk_score,
                "incident_count": h.incident_count,
            }
            for h in hotspot_locs
        ]

        # 8. High-risk predictions
        pred_res = await db.execute(
            select(Prediction)
            .where(
                and_(
                    Prediction.created_at >= start_date,
                    Prediction.risk_level.in_([RiskLevel.high, RiskLevel.critical]),
                )
            )
            .order_by(Prediction.confidence_score.desc())
            .limit(5)
        )
        high_risk_preds = pred_res.scalars().all()

        # 9. Format recommendations
        recommendations = self.format_recommendations(
            active_hotspots=active_hotspots,
            alerts=alerts_data,
            top_banks=top_banks,
            high_risk_count=len(high_risk_preds),
        )

        summary = (
            f"Cybercrime analysis over the past {days} days: {total_complaints} incidents reported "
            f"totaling INR {total_defrauded:,.2f} across {len(state_breakdown)} jurisdictions. "
            f"{len(alerts_data)} active intelligence alerts and {len(active_hotspots)} high-risk hotspots identified."
        )

        return {
            "summary": summary,
            "period_days": days,
            "total_complaints": total_complaints,
            "total_defrauded_inr": total_defrauded,
            "active_hotspots": active_hotspots,
            "high_priority_alerts": alerts_data,
            "state_wise_breakdown": state_breakdown,
            "category_breakdown": category_breakdown,
            "top_targeted_banks": top_banks,
            "recommendations": recommendations,
            "generated_at": datetime.utcnow().isoformat(),
        }

    async def get_trends(self, db: AsyncSession, days: int = 30) -> Dict[str, Any]:
        """Aggregate daily incident counts from DB and compute short-term moving average forecast."""
        start_date = datetime.utcnow() - timedelta(days=days)

        query = (
            select(
                func.date(Complaint.created_at).label("day"),
                func.count(Complaint.id).label("count"),
            )
            .where(Complaint.created_at >= start_date)
            .group_by("day")
            .order_by("day")
        )
        res = await db.execute(query)
        rows = res.all()

        daily_map = {str(row[0]): int(row[1]) for row in rows}

        # Build full date timeline for past `days`
        daily_counts = []
        for i in range(days):
            d = (start_date + timedelta(days=i + 1)).strftime("%Y-%m-%d")
            daily_counts.append({"date": d, "count": daily_map.get(d, 0)})

        counts_only = [item["count"] for item in daily_counts]

        # Forecast next 7 days using 7-day rolling mean / trend
        window = counts_only[-7:] if len(counts_only) >= 7 else counts_only
        mean_val = float(sum(window) / max(len(window), 1))

        forecast = []
        last_date = datetime.utcnow()
        for i in range(1, 8):
            f_date = (last_date + timedelta(days=i)).strftime("%Y-%m-%d")
            forecast.append(
                {
                    "date": f_date,
                    "predicted_count": round(max(0.0, mean_val), 1),
                }
            )

        return {
            "period_days": days,
            "daily_counts": daily_counts,
            "total_incidents": sum(counts_only),
            "forecast": forecast,
        }

    def format_recommendations(
        self,
        active_hotspots: list,
        alerts: list,
        top_banks: list,
        high_risk_count: int,
    ) -> List[str]:
        recs = []
        if alerts:
            recs.append(
                f"Immediate dispatch: {len(alerts)} active intelligence alerts require law enforcement review."
            )
        if active_hotspots:
            recs.append(
                f"Surveillance priority: Deploy field patrols to top {min(len(active_hotspots), 5)} high-risk cashout clusters."
            )
        if top_banks:
            bank_names = ", ".join(b["bank_name"] for b in top_banks[:3])
            recs.append(
                f"Banking alert: Notify anti-fraud desks at {bank_names} regarding elevated incident volumes."
            )
        if high_risk_count > 0:
            recs.append(
                f"Intervention: {high_risk_count} recent predictions flagged as critical risk; prioritize account freezing."
            )
        if not recs:
            recs = [
                "Maintain baseline spatial monitoring across designated banking districts.",
                "Review daily fraud trends and verify model calibration.",
            ]
        return recs

    async def export_report_csv(self, db: AsyncSession, days: int = 7) -> str:
        """Generate an RFC-4180 compliant CSV string of the intelligence report."""
        import csv
        import io

        report = await self.generate_report(db, days=days)
        output = io.StringIO()
        writer = csv.writer(output)

        # 1. Summary Header
        writer.writerow(["CASHGUARD-AI CYBERCRIME INTELLIGENCE REPORT"])
        writer.writerow(["Generated At", report["generated_at"]])
        writer.writerow(["Period (Days)", report["period_days"]])
        writer.writerow(["Total Complaints", report["total_complaints"]])
        writer.writerow(
            ["Total Defrauded (INR)", f"{report['total_defrauded_inr']:.2f}"]
        )
        writer.writerow([])

        # 2. State-wise breakdown
        writer.writerow(["STATE / REGION BREAKDOWN"])
        writer.writerow(["State", "Incident Count"])
        for state, count in report["state_wise_breakdown"].items():
            writer.writerow([state, count])
        writer.writerow([])

        # 3. Category breakdown
        writer.writerow(["CATEGORY BREAKDOWN"])
        writer.writerow(["Category", "Incident Count"])
        for cat, count in report["category_breakdown"].items():
            writer.writerow([cat, count])
        writer.writerow([])

        # 4. Top Targeted Banks
        writer.writerow(["TOP TARGETED BANKS"])
        writer.writerow(["Bank Name", "Incidents"])
        for b in report["top_targeted_banks"]:
            writer.writerow([b["bank_name"], b["complaint_count"]])
        writer.writerow([])

        # 5. Recommendations
        writer.writerow(["ACTIONABLE ADVISORIES & RECOMMENDATIONS"])
        for idx, rec in enumerate(report["recommendations"], 1):
            writer.writerow([idx, rec])

        return output.getvalue()

    async def get_fraud_rings(
        self, db: AsyncSession, days: int = 30
    ) -> List[Dict[str, Any]]:
        """Fetch recent complaints and run graph analytics to identify fraud rings."""
        from app.ml.graph_analytics import FraudRingDetector

        start_date = datetime.utcnow() - timedelta(days=days)
        result = await db.execute(
            select(Complaint).where(Complaint.created_at >= start_date).limit(500)
        )
        complaints = result.scalars().all()

        complaint_dicts = [
            {
                "id": str(c.id),
                "bank_name": c.bank_name,
                "district": c.district,
                "city": c.city,
                "state": c.state,
                "victim_phone_masked": c.victim_phone_masked,
                "amount_defrauded": c.amount_defrauded,
                "latitude": c.latitude,
                "longitude": c.longitude,
            }
            for c in complaints
        ]

        detector = FraudRingDetector(min_ring_size=3)
        return detector.detect_rings(complaint_dicts)
