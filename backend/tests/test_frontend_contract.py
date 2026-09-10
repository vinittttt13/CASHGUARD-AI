"""Contract tests — lock the exact JSON shapes the frontend screens depend on.

If any of these change, `docs/FRONTEND_BACKEND_INTEGRATION.md` and the wired
components must change with them.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_complaints_list_envelope(
    async_client: AsyncClient, auth_headers, test_complaint
):
    r = await async_client.get("/api/v1/complaints?limit=5", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert set(body) >= {"items", "total"}
    assert isinstance(body["items"], list) and body["total"] >= 1
    item = body["items"][0]
    for key in (
        "id",
        "complaint_number",
        "complaint_text",
        "complaint_category",
        "amount_defrauded",
        "currency",
        "status",
        "created_at",
    ):
        assert key in item, key


@pytest.mark.asyncio
async def test_complaint_stats_keys_are_clean_enum_values(
    async_client: AsyncClient, auth_headers, test_complaint
):
    r = await async_client.get(
        "/api/v1/complaints/stats/aggregate", headers=auth_headers
    )
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"by_category", "by_state", "by_status"}
    # No "ComplaintCategory.phishing" style keys — plain enum values only.
    for group in ("by_category", "by_status"):
        for key in body[group]:
            assert "." not in key, f"{group} key not cleaned: {key!r}"
            assert key == key.lower()


@pytest.mark.asyncio
async def test_alerts_list_envelope(async_client: AsyncClient, auth_headers):
    r = await async_client.get("/api/v1/intelligence/alerts", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert set(body) >= {"items", "total"}
    assert isinstance(body["items"], list)


@pytest.mark.asyncio
async def test_trends_shape(async_client: AsyncClient, auth_headers):
    r = await async_client.get(
        "/api/v1/intelligence/trends?days=14", headers=auth_headers
    )
    assert r.status_code == 200
    body = r.json()
    assert set(body) >= {"period_days", "total_incidents", "daily_counts", "forecast"}
    assert body["period_days"] == 14
    assert isinstance(body["daily_counts"], list) and len(body["daily_counts"]) == 14
    assert set(body["daily_counts"][0]) == {"date", "count"}
    assert set(body["forecast"][0]) == {"date", "predicted_count"}


@pytest.mark.asyncio
async def test_report_shape(async_client: AsyncClient, auth_headers):
    r = await async_client.get(
        "/api/v1/intelligence/report?days=7", headers=auth_headers
    )
    assert r.status_code == 200
    body = r.json()
    for key in (
        "summary",
        "total_complaints",
        "total_defrauded_inr",
        "active_hotspots",
        "high_priority_alerts",
        "state_wise_breakdown",
        "recommendations",
    ):
        assert key in body, key
    assert isinstance(body["active_hotspots"], list)
    assert isinstance(body["recommendations"], list)


@pytest.mark.asyncio
async def test_hotspots_item_shape(
    async_client: AsyncClient, auth_headers, test_location
):
    # bump the seeded location above the 0.5 risk threshold
    test_location.risk_score = 0.9
    r = await async_client.get("/api/v1/locations/hotspots", headers=auth_headers)
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    if rows:
        row = rows[0]
        assert set(row) >= {
            "cluster_id",
            "center",
            "radius_km",
            "incident_count",
            "risk_score",
            "name",
        }
        assert isinstance(row["center"], list) and len(row["center"]) == 2


@pytest.mark.asyncio
async def test_heatmap_item_shape(
    async_client: AsyncClient, auth_headers, test_location
):
    r = await async_client.get("/api/v1/locations/heatmap", headers=auth_headers)
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    if rows:
        assert set(rows[0]) == {"lat", "lng", "weight"}
