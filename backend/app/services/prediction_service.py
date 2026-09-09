from app.schemas.prediction import PredictionResponse
from app.core.redis_client import cache_get, cache_set


class PredictionService:
    async def predict(self, complaint_data: dict) -> dict:
        complaint_id = complaint_data.get("id")

        # 1. Check Redis cache
        if complaint_id:
            cached = await cache_get(f"predict:{complaint_id}")
            if cached:
                return cached

        # Mock prediction response
        mock_response = {
            "prediction_id": str(complaint_id) if complaint_id else "mock-id",
            "complaint_id": str(complaint_id) if complaint_id else "mock-id",
            "predicted_latitude": 28.6139,
            "predicted_longitude": 77.2090,
            "confidence_score": 0.85,
            "predicted_locations": [
                {"lat": 28.6, "lng": 77.2, "atm_name": "Bank XYZ", "confidence": 0.85}
            ],
            "risk_level": "high",
            "model_version": "1.0.0",
            "model_name": "xgboost_v1",
        }

        # Cache result
        if complaint_id:
            await cache_set(f"predict:{complaint_id}", mock_response, ttl=3600)

        return mock_response

    async def batch_predict(self, complaint_ids: list) -> list:
        results = []
        for cid in complaint_ids:
            res = await self.predict({"id": str(cid)})
            results.append(res)
        return results

    async def get_confidence_stats(self) -> dict:
        return {
            "average_confidence": 0.82,
            "high_confidence_predictions": 150,
            "total_predictions_30d": 500,
        }
