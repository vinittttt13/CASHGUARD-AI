"""
Integration tests for CASHGUARD-AI API endpoints.

These tests exercise the real FastAPI app with a SQLite in-memory database
and mocked Redis.  No external services required.
"""

from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient

# ==========================================================================
# Health
# ==========================================================================


@pytest.mark.asyncio
async def test_health_endpoint(async_client: AsyncClient):
    response = await async_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "timestamp" in data


# ==========================================================================
# Auth — Login
# ==========================================================================


@pytest.mark.asyncio
async def test_login_invalid_credentials(async_client: AsyncClient):
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_success(async_client: AsyncClient, test_user):
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "testuser@example.com", "password": "testpassword123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_rate_limited(async_client: AsyncClient):
    """The 6th /auth/login hit within a minute is rejected with 429."""
    payload = {"email": "nonexistent@example.com", "password": "wrongpassword"}

    statuses = []
    for _ in range(6):
        resp = await async_client.post("/api/v1/auth/login", json=payload)
        statuses.append(resp.status_code)

    # First five are allowed through (and fail auth with 401); the sixth is
    # throttled by slowapi before reaching the handler.
    assert statuses[:5] == [401] * 5, statuses
    assert statuses[5] == 429, statuses
    assert "rate limit" in resp.text.lower() or "too many" in resp.text.lower()


# ==========================================================================
# Auth — /me
# ==========================================================================


@pytest.mark.asyncio
async def test_get_me_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/v1/auth/me")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_get_me_authenticated(
    async_client: AsyncClient, auth_headers: dict
):
    response = await async_client.get(
        "/api/v1/auth/me", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "testuser@example.com"
    assert data["full_name"] == "Test User"


# ==========================================================================
# Auth — Logout
# ==========================================================================


@pytest.mark.asyncio
async def test_logout(async_client: AsyncClient, auth_headers: dict):
    response = await async_client.post(
        "/api/v1/auth/logout", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Successfully logged out"
    # "revoked" is now a count; Redis is mocked-unavailable so it is 0 here.
    assert isinstance(data["revoked"], int)


@pytest.fixture
def revocation_store():
    """Wire revoke_token / is_token_revoked to a shared in-memory set so
    rotation and logout revocation can be exercised without a real Redis."""
    store: set[str] = set()

    async def _revoke(jti: str, ttl_days: int = 7) -> bool:
        store.add(jti)
        return True

    async def _is_revoked(jti: str) -> bool:
        return jti in store

    with patch("app.api.v1.auth.revoke_token", new=_revoke), patch(
        "app.core.security.is_token_revoked", new=_is_revoked
    ):
        yield store


# ==========================================================================
# Auth — Refresh
# ==========================================================================


async def _login(async_client: AsyncClient) -> dict:
    resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "testuser@example.com", "password": "testpassword123"},
    )
    assert resp.status_code == 200
    return resp.json()


@pytest.mark.asyncio
async def test_refresh_token_valid(async_client: AsyncClient, test_user):
    refresh_token = (await _login(async_client))["refresh_token"]

    refresh_resp = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_resp.status_code == 200
    data = refresh_resp.json()
    assert "access_token" in data
    assert data["refresh_token"] and data["refresh_token"] != refresh_token


@pytest.mark.asyncio
async def test_refresh_token_in_query_is_rejected(async_client: AsyncClient, test_user):
    """The old query-string transport must no longer work (422 missing body)."""
    refresh_token = (await _login(async_client))["refresh_token"]
    resp = await async_client.post(
        "/api/v1/auth/refresh",
        params={"refresh_token": refresh_token},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_refresh_token_invalid(async_client: AsyncClient):
    response = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid-token"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_rotates_and_old_is_single_use(
    async_client: AsyncClient, test_user, revocation_store
):
    old_refresh = (await _login(async_client))["refresh_token"]

    first = await async_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": old_refresh}
    )
    assert first.status_code == 200
    new_refresh = first.json()["refresh_token"]
    assert new_refresh != old_refresh

    # Replaying the old refresh token now fails — it was revoked on rotation.
    replay = await async_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": old_refresh}
    )
    assert replay.status_code == 401
    assert "revoked" in replay.json()["detail"].lower()

    # The freshly issued one still works.
    third = await async_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": new_refresh}
    )
    assert third.status_code == 200


@pytest.mark.asyncio
async def test_logout_revokes_access_and_refresh(
    async_client: AsyncClient, test_user, revocation_store
):
    tokens = await _login(async_client)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    resp = await async_client.post(
        "/api/v1/auth/logout",
        headers=headers,
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert resp.status_code == 200
    assert resp.json()["revoked"] == 2

    # The refresh token is now unusable.
    after = await async_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert after.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_revoked(async_client: AsyncClient, test_user):
    refresh_token = (await _login(async_client))["refresh_token"]

    with patch(
        "app.core.security.is_token_revoked",
        new_callable=AsyncMock,
        return_value=True,
    ):
        refresh_resp = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert refresh_resp.status_code == 401
        assert "revoked" in refresh_resp.json()["detail"].lower()


# ==========================================================================
# Health — readiness
# ==========================================================================


@pytest.mark.asyncio
async def test_readiness_ok(async_client: AsyncClient):
    """DB override works; Redis is mocked-unavailable -> 503 with per-check detail."""
    resp = await async_client.get("/health/ready")
    assert resp.status_code == 503
    body = resp.json()
    assert body["checks"]["database"] == "ok"
    assert body["checks"]["redis"] == "unavailable"


@pytest.mark.asyncio
async def test_readiness_db_down(async_client: AsyncClient):
    from app.core.database import get_db
    from app.main import app
    from tests.conftest import _override_get_db

    class _BrokenSession:
        async def execute(self, *_a, **_kw):
            raise RuntimeError("db connection refused")

    async def _broken_db():
        yield _BrokenSession()

    app.dependency_overrides[get_db] = _broken_db
    try:
        resp = await async_client.get("/health/ready")
    finally:
        app.dependency_overrides[get_db] = _override_get_db

    assert resp.status_code == 503
    assert resp.json()["checks"]["database"].startswith("error")


# ==========================================================================
# Prediction — requires complaint
# ==========================================================================


@pytest.mark.asyncio
async def test_predict_complaint_not_found(
    async_client: AsyncClient, auth_headers: dict
):
    import uuid

    response = await async_client.post(
        "/api/v1/predict",
        json={"complaint_id": str(uuid.uuid4()), "force_refresh": False},
        headers=auth_headers,
    )
    assert response.status_code == 404
    assert "Complaint not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_predict_unauthenticated(async_client: AsyncClient):
    import uuid

    response = await async_client.post(
        "/api/v1/predict",
        json={"complaint_id": str(uuid.uuid4()), "force_refresh": False},
    )
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_predict_success(
    async_client: AsyncClient, auth_headers: dict, test_complaint
):
    response = await async_client.post(
        "/api/v1/predict",
        json={"complaint_id": str(test_complaint.id), "force_refresh": True},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["complaint_id"] == str(test_complaint.id)
    assert "risk_level" in data
    assert "confidence_score" in data
    assert "predicted_locations" in data
    assert len(data["predicted_locations"]) > 0

    # Test GET prediction by id
    pred_id = data["id"]
    get_resp = await async_client.get(
        f"/api/v1/predict/{pred_id}",
        headers=auth_headers,
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == pred_id


@pytest.mark.asyncio
async def test_batch_predict(
    async_client: AsyncClient, auth_headers: dict, test_complaint
):
    response = await async_client.post(
        "/api/v1/predict/batch",
        json={"complaint_ids": [str(test_complaint.id)]},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_received"] == 1


# ==========================================================================
# WebSocket — live-feed
# ==========================================================================


def test_websocket_invalid_token():
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    with pytest.raises(Exception):
        with client.websocket_connect("/api/v1/ws/live-feed?token=badtoken") as ws:
            pass


def test_websocket_authenticated(test_user):
    from fastapi.testclient import TestClient

    from app.core.security import create_access_token
    from app.main import app

    client = TestClient(app)
    token = create_access_token(data={"sub": test_user.email, "role": test_user.role.value})
    with client.websocket_connect(f"/api/v1/ws/live-feed?token={token}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "initial_state"
        assert msg["data"]["user"] == test_user.email


# ==========================================================================
# Phase 2: Intelligence Service & Endpoints
# ==========================================================================


@pytest.mark.asyncio
async def test_intelligence_report(
    async_client: AsyncClient, auth_headers: dict, test_complaint
):
    response = await async_client.get(
        "/api/v1/intelligence/report?days=7",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert data["total_complaints"] >= 1
    assert data["total_defrauded_inr"] >= 55000.0
    assert "state_wise_breakdown" in data
    assert "category_breakdown" in data
    assert "recommendations" in data
    assert len(data["recommendations"]) > 0


@pytest.mark.asyncio
async def test_intelligence_trends(
    async_client: AsyncClient, auth_headers: dict, test_complaint
):
    response = await async_client.get(
        "/api/v1/intelligence/trends?days=14",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["period_days"] == 14
    assert len(data["daily_counts"]) == 14
    assert len(data["forecast"]) == 7


# ==========================================================================
# Phase 2: Locations & Geospatial Endpoints
# ==========================================================================


@pytest.mark.asyncio
async def test_locations_hotspots(
    async_client: AsyncClient, auth_headers: dict, test_location
):
    response = await async_client.get(
        "/api/v1/locations/hotspots",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    item = data[0]
    assert "center" in item
    assert "risk_score" in item
    assert item["risk_score"] >= 0.5


@pytest.mark.asyncio
async def test_locations_nearby_geodesic(
    async_client: AsyncClient, auth_headers: dict, test_location
):
    # Query within 5 km of Bandra (19.0596, 72.8295)
    response = await async_client.get(
        "/api/v1/locations/nearby?lat=19.0600&lng=72.8300&radius_km=5.0",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["name"] == "SBI ATM Bandra West"
    assert "distance_km" in data[0]
    assert data[0]["distance_km"] < 1.0


@pytest.mark.asyncio
async def test_locations_nearby_outside_radius(
    async_client: AsyncClient, auth_headers: dict, test_location
):
    # Query from Delhi (28.7041, 77.1025) with radius 50 km (Mumbai ATM is ~1150 km away)
    response = await async_client.get(
        "/api/v1/locations/nearby?lat=28.7041&lng=77.1025&radius_km=50.0",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0


@pytest.mark.asyncio
async def test_locations_heatmap(
    async_client: AsyncClient, auth_headers: dict, test_location
):
    response = await async_client.get(
        "/api/v1/locations/heatmap",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert "lat" in data[0]
    assert "lng" in data[0]
    assert "weight" in data[0]


# ==========================================================================
# Phase 3: Circuit Breaker Resilience in API
# ==========================================================================


@pytest.mark.asyncio
async def test_predict_circuit_breaker_fallback(
    async_client: AsyncClient, auth_headers: dict, test_complaint
):
    from app.utils.circuit_breaker import CircuitBreakerOpenException

    with patch(
        "app.api.v1.predict.prediction_circuit_breaker.async_call",
        side_effect=CircuitBreakerOpenException("ml_prediction", 15.0),
    ):
        response = await async_client.post(
            "/api/v1/predict",
            json={"complaint_id": str(test_complaint.id), "force_refresh": True},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["complaint_id"] == str(test_complaint.id)
        assert data["confidence_score"] == 0.0
        assert data["model_name"] == "heuristic_fallback"


# ==========================================================================
# Phase 4: Export Reports & Fraud Rings Endpoints
# ==========================================================================


@pytest.mark.asyncio
async def test_intelligence_export_csv(
    async_client: AsyncClient, auth_headers: dict, test_complaint
):
    response = await async_client.get(
        "/api/v1/intelligence/report/export?days=7",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")
    assert "attachment; filename=" in response.headers.get("content-disposition", "")
    content = response.text
    assert "CASHGUARD-AI CYBERCRIME INTELLIGENCE REPORT" in content
    assert "STATE / REGION BREAKDOWN" in content
    assert "CATEGORY BREAKDOWN" in content
    assert "55000.00" in content



@pytest.mark.asyncio
async def test_intelligence_fraud_rings_api(
    async_client: AsyncClient, auth_headers: dict, db_session
):
    import uuid
    from datetime import datetime, timezone

    from app.models.complaint import Complaint, ComplaintCategory, ComplaintStatus

    # Insert 3 complaints with matching masked phone and bank to form an organized syndicate
    for i in range(3):
        c = Complaint(
            id=uuid.uuid4(),
            complaint_number=f"CMP-RING-00{i+1}",
            complaint_text=f"Victim duped by ring member {i+1}",
            complaint_category=ComplaintCategory.phishing,
            amount_defrauded=30000.0 * (i + 1),
            victim_phone_masked="******7777",
            bank_name="HDFC",
            district="Pune",
            state="Maharashtra",
            status=ComplaintStatus.pending,
            complaint_date=datetime.now(timezone.utc),
        )
        db_session.add(c)
    await db_session.commit()

    response = await async_client.get(
        "/api/v1/intelligence/fraud-rings?days=30",
        headers=auth_headers,
    )
    assert response.status_code == 200
    rings = response.json()
    assert len(rings) >= 1
    target_ring = next(
        (r for r in rings if any("7777" in s for s in r.get("suspect_identifiers", [])) or "HDFC" in r.get("shared_banks", [])),
        None,
    )
    assert target_ring is not None
    assert target_ring["member_count"] == 3
    assert target_ring["total_defrauded_inr"] == 180000.0
    assert target_ring["risk_score"] >= 0.75






