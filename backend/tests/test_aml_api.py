"""HTTP-level tests for POST /api/v1/predict/aml-transaction.

test_aml_xgboost.py already covers the model/service layer thoroughly
(feature transform, fit/predict, serialization, registry integration).
This file covers what that one doesn't: the actual endpoint's auth,
request validation, and response contract.
"""

import pytest
from httpx import AsyncClient

from app.ml.aml_xgboost_model import AmlLaunderingClassifier
from app.ml.model_registry import ModelRegistry

AML_URL = "/api/v1/predict/aml-transaction"

VALID_PAYLOAD = {
    "amount_paid": 75000.0,
    "amount_received": 75000.0,
    "payment_currency": "Euro",
    "receiving_currency": "Euro",
    "payment_format": "Wire",
    "from_bank": "012",
    "to_bank": "020",
}


@pytest.mark.asyncio
async def test_requires_authentication(async_client: AsyncClient):
    response = await async_client.post(AML_URL, json=VALID_PAYLOAD)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_valid_transaction_returns_full_prediction_contract(
    async_client: AsyncClient, auth_headers: dict
):
    response = await async_client.post(
        AML_URL, json=VALID_PAYLOAD, headers=auth_headers
    )

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {
        "is_laundering",
        "laundering_probability",
        "risk_level",
        "decision_threshold",
        "top_factors",
        "model_name",
        "model_version",
    }
    assert body["is_laundering"] in (0, 1)
    assert 0.0 <= body["laundering_probability"] <= 1.0
    assert body["risk_level"] in ("low", "medium", "high", "critical")
    assert isinstance(body["top_factors"], list)
    # Never silently present the heuristic as if it were the real model.
    assert body["model_name"] in ("xgboost_aml", "heuristic_aml_fallback")


@pytest.mark.asyncio
async def test_missing_required_amount_paid_is_rejected(
    async_client: AsyncClient, auth_headers: dict
):
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "amount_paid"}
    response = await async_client.post(AML_URL, json=payload, headers=auth_headers)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_non_numeric_amount_is_rejected(
    async_client: AsyncClient, auth_headers: dict
):
    payload = {**VALID_PAYLOAD, "amount_paid": "not-a-number"}
    response = await async_client.post(AML_URL, json=payload, headers=auth_headers)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_minimal_payload_with_only_required_field_succeeds(
    async_client: AsyncClient, auth_headers: dict
):
    """Every field except amount_paid is Optional with a default — verify
    the endpoint doesn't crash when a caller sends the bare minimum."""
    response = await async_client.post(
        AML_URL, json={"amount_paid": 100.0}, headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert "laundering_probability" in body


@pytest.mark.asyncio
async def test_zero_amount_boundary_value(
    async_client: AsyncClient, auth_headers: dict
):
    response = await async_client.post(
        AML_URL, json={**VALID_PAYLOAD, "amount_paid": 0.0}, headers=auth_headers
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_very_large_amount_boundary_value(
    async_client: AsyncClient, auth_headers: dict
):
    response = await async_client.post(
        AML_URL,
        json={**VALID_PAYLOAD, "amount_paid": 1_000_000_000.0},
        headers=auth_headers,
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_negative_amount_is_accepted_by_schema_but_handled_gracefully(
    async_client: AsyncClient, auth_headers: dict
):
    """The schema doesn't reject negative amounts (no domain constraint was
    added), so this documents actual current behavior rather than an
    assumed one: the request must not 500, whatever score it produces."""
    response = await async_client.post(
        AML_URL, json={**VALID_PAYLOAD, "amount_paid": -500.0}, headers=auth_headers
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_response_reports_the_real_model_when_one_is_registered(
    async_client: AsyncClient, auth_headers: dict
):
    """Explicitly proves the endpoint does NOT silently misrepresent which
    model produced a result: register a known-fitted xgboost_aml model and
    assert the response says so, not "heuristic_aml_fallback"."""
    registry = ModelRegistry()
    previous = registry.get("xgboost_aml")
    previous_version = registry.get_version("xgboost_aml")

    import numpy as np
    import pandas as pd

    from app.ml.aml_xgboost_model import PAYMENT_FORMAT_MAP

    n = 60
    df = pd.DataFrame(
        {
            "Timestamp": pd.date_range("2023-01-01", periods=n, freq="h").strftime(
                "%Y/%m/%d %H:%M"
            ),
            "From Bank": np.random.choice(["012", "020"], n),
            "Account": np.random.choice([f"A{i}" for i in range(10)], n),
            "To Bank": np.random.choice(["012", "020"], n),
            "Account.1": np.random.choice([f"A{i}" for i in range(10)], n),
            "Amount Paid": np.random.exponential(5000, n).round(2),
            "Amount Received": np.random.exponential(5000, n).round(2),
            "Payment Currency": "US Dollar",
            "Receiving Currency": "US Dollar",
            "Payment Format": np.random.choice(list(PAYMENT_FORMAT_MAP.keys()), n),
            "Is Laundering": np.random.binomial(1, 0.15, n),
        }
    )
    clf = AmlLaunderingClassifier(n_estimators=10, max_depth=3, random_state=42)
    clf.fit(df.drop(columns=["Is Laundering"]), df["Is Laundering"])
    registry.register("xgboost_aml", clf, version="v-test-api")

    try:
        response = await async_client.post(
            AML_URL, json=VALID_PAYLOAD, headers=auth_headers
        )
        assert response.status_code == 200
        body = response.json()
        assert body["model_name"] == "xgboost_aml"
        assert body["model_version"] == "v-test-api"
    finally:
        # Restore whatever was registered before this test (registry is a
        # process-wide singleton — leaking test state would affect others).
        if previous is not None:
            registry.register(
                "xgboost_aml", previous, version=previous_version or "v1.0"
            )
