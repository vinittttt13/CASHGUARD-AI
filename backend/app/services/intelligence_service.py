from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from datetime import datetime


class IntelligenceService:
    async def generate_report(self, db: AsyncSession, days: int = 7) -> dict:
        return {
            "summary": "Summary of cybercrime activities.",
            "active_hotspots": [],
            "high_priority_alerts": [],
            "temporal_trends": {"forecast": []},
            "top_predicted_locations": [],
            "state_wise_breakdown": {},
            "recommendations": self.format_recommendations([], []),
            "generated_at": datetime.utcnow().isoformat(),
        }

    async def get_trends(self, db: AsyncSession, days: int = 30) -> dict:
        return {
            "daily_counts": [10, 15, 8, 20],
            "forecast": [12, 14, 16, 18, 20, 22, 24],
        }

    def format_recommendations(self, hotspots: list, alerts: list) -> List[str]:
        recommendations = [
            "Increase monitoring at top 5 active hotspots.",
            "Deploy local task force to recent critical alert zones.",
        ]
        return recommendations
