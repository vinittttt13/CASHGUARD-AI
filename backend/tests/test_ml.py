"""
Unit tests for CASHGUARD-AI ML components.

These tests exercise the actual ML code (FeatureEngineer, HotspotDetector,
NLPExtractor) with synthetic data — no external services or trained models
required.
"""

from datetime import datetime

import numpy as np
import pandas as pd
import pytest

# ==========================================================================
# FeatureEngineer — Temporal Features
# ==========================================================================


def _sample_dataframe(n: int = 10) -> pd.DataFrame:
    """Create a small synthetic DataFrame matching FeatureEngineer expectations."""
    return pd.DataFrame(
        {
            "timestamp": pd.date_range("2024-01-01", periods=n, freq="h"),
            "lat": np.random.uniform(18, 20, n),
            "lng": np.random.uniform(72, 74, n),
            "complaint_text": ["Someone called from SBI and took OTP"] * n,
            "amount": np.random.uniform(500, 50000, n),
            "state": ["Maharashtra"] * n,
            "district": ["Mumbai"] * n,
            "category": ["Phishing"] * n,
            "bank_name": ["SBI"] * n,
        }
    )


def test_feature_engineering_temporal():
    from app.ml.feature_engineering import FeatureEngineer

    fe = FeatureEngineer()
    df = _sample_dataframe()
    result = fe.extract_temporal_features(df.copy())

    assert "hour" in result.columns
    assert "day_of_week" in result.columns
    assert "month" in result.columns
    assert "is_weekend" in result.columns
    assert "is_holiday_period" in result.columns
    assert result["hour"].dtype in (np.int32, np.int64)
    assert all(result["is_weekend"].isin([0, 1]))


def test_feature_engineering_spatial():
    from app.ml.feature_engineering import FeatureEngineer

    fe = FeatureEngineer()
    df = _sample_dataframe()
    df = fe.extract_temporal_features(df)
    result = fe.extract_spatial_features(df)

    assert "dist_to_city_center" in result.columns
    assert "dist_to_atm" in result.columns
    # Distance to nearest city should be positive
    assert all(result["dist_to_city_center"] >= 0)


def test_feature_engineering_text():
    from app.ml.feature_engineering import FeatureEngineer

    fe = FeatureEngineer()
    df = _sample_dataframe()
    result = fe.extract_text_features(df.copy())

    assert "tfidf_sum" in result.columns
    assert "ner_loc_count" in result.columns
    assert "bank_name_indicator" in result.columns
    # The complaint text contains "SBI" so bank_name_indicator should be 1
    assert all(result["bank_name_indicator"] == 1)


def test_feature_engineering_amount():
    from app.ml.feature_engineering import FeatureEngineer

    fe = FeatureEngineer()
    df = _sample_dataframe()
    result = fe.extract_amount_features(df.copy())

    assert "amount_log" in result.columns
    assert "amount_percentile" in result.columns
    assert "is_round_number" in result.columns
    # amount_log should be positive for positive amounts
    assert all(result["amount_log"] > 0)
    # percentile should be between 0 and 1
    assert all((result["amount_percentile"] >= 0) & (result["amount_percentile"] <= 1))


def test_feature_engineering_categorical_training():
    from app.ml.feature_engineering import FeatureEngineer

    fe = FeatureEngineer()
    df = _sample_dataframe()
    result = fe.extract_categorical_features(df.copy(), is_training=True)

    assert "state_encoded" in result.columns
    assert "district_encoded" in result.columns
    assert "category_encoded" in result.columns
    assert "bank_encoded" in result.columns
    # Encoders should be stored
    assert "state" in fe.label_encoders
    assert "bank_name" in fe.label_encoders


def test_feature_engineering_full_matrix():
    from app.ml.feature_engineering import FEATURE_NAMES, FeatureEngineer

    fe = FeatureEngineer()
    df = _sample_dataframe(n=5)
    matrix = fe.create_feature_matrix(df, is_training=True)

    assert matrix.shape == (5, len(FEATURE_NAMES))
    assert not np.any(np.isnan(matrix)), "Feature matrix should not contain NaN"


# ==========================================================================
# HotspotDetector
# ==========================================================================


def test_kmeans_hotspot_detection():
    from app.ml.kmeans_hotspot import HotspotDetector

    detector = HotspotDetector()
    # Create clustered coordinates (3 clusters)
    coords = (
        [
            (
                19.0 + np.random.uniform(-0.01, 0.01),
                72.8 + np.random.uniform(-0.01, 0.01),
            )
            for _ in range(20)
        ]
        + [
            (
                20.0 + np.random.uniform(-0.01, 0.01),
                73.0 + np.random.uniform(-0.01, 0.01),
            )
            for _ in range(20)
        ]
        + [
            (
                18.5 + np.random.uniform(-0.01, 0.01),
                73.5 + np.random.uniform(-0.01, 0.01),
            )
            for _ in range(20)
        ]
    )
    detector.fit(coords)

    hotspots = detector.get_hotspots()
    assert len(hotspots) > 0, "Should detect at least one hotspot"

    for h in hotspots:
        assert "cluster_id" in h
        assert "center_lat" in h
        assert "center_lng" in h
        assert "radius_km" in h
        assert "incident_count" in h
        assert h["incident_count"] > 0


def test_kmeans_hotspot_predict():
    from app.ml.kmeans_hotspot import HotspotDetector

    detector = HotspotDetector()
    coords = [(19.0 + i * 0.01, 72.8 + i * 0.01) for i in range(10)]
    detector.fit(coords)

    cluster_id = detector.predict_cluster(19.05, 72.85)
    assert isinstance(cluster_id, (int, np.integer))


def test_kmeans_hotspot_empty():
    from app.ml.kmeans_hotspot import HotspotDetector

    detector = HotspotDetector()
    detector.fit([])
    assert detector.get_hotspots() == []


# ==========================================================================
# NLPExtractor
# ==========================================================================


def test_nlp_bank_extraction():
    from app.ml.nlp_extractor import NLPExtractor

    extractor = NLPExtractor()
    banks = extractor.extract_banks(
        "I received a call from SBI and HDFC asking for OTP"
    )
    assert "SBI" in banks
    assert "HDFC" in banks


def test_nlp_amount_extraction():
    from app.ml.nlp_extractor import NLPExtractor

    extractor = NLPExtractor()
    amounts = extractor.extract_amounts("They withdrew Rs. 50,000 and then Rs 25000")
    assert 50000.0 in amounts
    assert 25000.0 in amounts


def test_nlp_amount_extraction_inr():
    from app.ml.nlp_extractor import NLPExtractor

    extractor = NLPExtractor()
    amounts = extractor.extract_amounts("Lost ₹10,500.50 to fraud")
    assert 10500.50 in amounts


def test_nlp_empty_input():
    from app.ml.nlp_extractor import NLPExtractor

    extractor = NLPExtractor()
    assert extractor.extract_banks("") == []
    assert extractor.extract_amounts("") == []


# ==========================================================================
# Haversine distance
# ==========================================================================


def test_haversine_distance():
    from app.ml.feature_engineering import FeatureEngineer

    fe = FeatureEngineer()
    # Mumbai to Delhi ≈ ~1150 km
    dist = fe.haversine(19.0760, 72.8777, 28.7041, 77.1025)
    assert 1100 < dist < 1200, f"Expected ~1150 km, got {dist:.0f}"


def test_haversine_same_point():
    from app.ml.feature_engineering import FeatureEngineer

    fe = FeatureEngineer()
    dist = fe.haversine(19.0760, 72.8777, 19.0760, 72.8777)
    assert dist == 0.0


# ==========================================================================
# Phase 2: Feature Leakage Prevention & BallTree Precision
# ==========================================================================


def test_feature_engineering_amount_no_leakage():
    from app.ml.feature_engineering import FeatureEngineer

    fe = FeatureEngineer()
    train_df = pd.DataFrame({"amount": [1000.0, 5000.0, 10000.0, 50000.0, 100000.0]})
    fe.extract_amount_features(train_df, is_training=True)
    assert fe.amount_bins is not None
    assert len(fe.amount_bins) == 101

    # Single-instance inference with fitted bins should NOT default to 1.0
    test_low = pd.DataFrame({"amount": [2000.0]})
    res_low = fe.extract_amount_features(test_low, is_training=False)
    pct_low = float(res_low["amount_percentile"].iloc[0])
    assert 0.0 < pct_low < 0.5, f"Expected low percentile, got {pct_low}"

    test_high = pd.DataFrame({"amount": [75000.0]})
    res_high = fe.extract_amount_features(test_high, is_training=False)
    pct_high = float(res_high["amount_percentile"].iloc[0])
    assert 0.7 < pct_high <= 1.0, f"Expected high percentile, got {pct_high}"


def test_feature_engineering_unseen_categorical():
    from app.ml.feature_engineering import FeatureEngineer

    fe = FeatureEngineer()
    train_df = pd.DataFrame(
        {
            "state": ["Maharashtra", "Delhi"],
            "district": ["Mumbai", "Central"],
            "category": ["phishing", "vishing"],
            "bank_name": ["SBI", "HDFC"],
        }
    )
    fe.extract_categorical_features(train_df, is_training=True)

    # Completely unseen categories during inference must not throw KeyError
    unseen_df = pd.DataFrame(
        {
            "state": ["UnknownState123"],
            "district": ["UnknownDistrict456"],
            "category": ["new_fraud_type"],
            "bank_name": ["ForeignBank999"],
        }
    )
    result = fe.extract_categorical_features(unseen_df, is_training=False)
    for col in [
        "state_encoded",
        "district_encoded",
        "category_encoded",
        "bank_encoded",
    ]:
        assert col in result.columns
        assert isinstance(result[col].iloc[0], (int, np.integer))


def test_geodesic_ball_tree_atm_accuracy():
    from app.ml.feature_engineering import FeatureEngineer

    fe = FeatureEngineer()
    # Provide known ATM near Mumbai (19.0760, 72.8777)
    atm_df = pd.DataFrame({"lat": [19.0800], "lng": [72.8800]})
    fe.fit_atm_tree(atm_df)

    test_df = pd.DataFrame({"lat": [19.0760], "lng": [72.8777]})
    res = fe.extract_spatial_features(test_df)
    computed_dist = res["dist_to_atm"].iloc[0]

    # Manual haversine calculation
    expected_dist = fe.haversine(19.0760, 72.8777, 19.0800, 72.8800)
    assert (
        abs(computed_dist - expected_dist) < 0.05
    ), f"Diff {abs(computed_dist - expected_dist)}"


# ==========================================================================
# Phase 2: Model Validation Framework
# ==========================================================================


def test_model_validation_classification_and_regression():
    from sklearn.linear_model import LogisticRegression

    from app.ml.model_validation import (
        ModelValidator,
        cross_validate_classifier,
        evaluate_classification_metrics,
        evaluate_regression_metrics,
    )

    y_true = [0, 1, 1, 0, 1, 0, 1, 1, 0, 0]
    y_pred = [0, 1, 1, 0, 1, 0, 1, 0, 0, 0]
    y_prob = [0.1, 0.9, 0.8, 0.2, 0.85, 0.15, 0.7, 0.45, 0.3, 0.2]

    metrics = evaluate_classification_metrics(y_true, y_pred, y_prob)
    assert metrics["accuracy"] >= 0.8
    assert "f1_weighted" in metrics
    assert "confusion_matrix" in metrics
    assert "roc_auc" in metrics
    assert metrics["roc_auc"] is not None

    reg_metrics = evaluate_regression_metrics([10.0, 20.0, 30.0], [10.5, 19.8, 29.5])
    assert reg_metrics["rmse"] < 1.0
    assert reg_metrics["r2"] > 0.95

    # Cross-validation
    X = np.random.randn(30, 4)
    y = np.array([0] * 15 + [1] * 15)
    cv_res = cross_validate_classifier(LogisticRegression(), X, y, cv=3)
    assert cv_res["cv_folds"] == 3
    assert len(cv_res["fold_scores"]) == 3

    # Quality gate
    validator = ModelValidator(min_accuracy=0.7, min_f1=0.7)
    val_report = validator.validate("test_classifier", y_true, y_pred, y_prob)
    assert val_report["passed"] is True


# ==========================================================================
# Phase 3: Circuit Breaker Tests
# ==========================================================================


def test_circuit_breaker_state_transitions():
    import time

    from app.utils.circuit_breaker import CircuitBreaker, CircuitBreakerOpenException

    cb = CircuitBreaker(
        "unit_test_breaker",
        failure_threshold=2,
        recovery_timeout=0.2,
        success_threshold=1,
    )
    assert cb.state == "CLOSED"

    # Failing function
    def failing_fn():
        raise RuntimeError("Simulated failure")

    def success_fn():
        return "ok"

    # First failure
    with pytest.raises(RuntimeError):
        cb.call(failing_fn)
    assert cb.state == "CLOSED"
    assert cb.failure_count == 1

    # Second failure trips breaker
    with pytest.raises(RuntimeError):
        cb.call(failing_fn)
    assert cb.state == "OPEN"

    # Calls while OPEN should raise CircuitBreakerOpenException without invoking func
    with pytest.raises(CircuitBreakerOpenException):
        cb.call(success_fn)

    # Wait for recovery timeout
    time.sleep(0.25)

    # Call transitions to HALF_OPEN, and success returns to CLOSED
    result = cb.call(success_fn)
    assert result == "ok"
    assert cb.state == "CLOSED"
    assert cb.failure_count == 0


@pytest.mark.asyncio
async def test_circuit_breaker_async_call():
    from app.utils.circuit_breaker import CircuitBreaker, CircuitBreakerOpenException

    cb = CircuitBreaker("async_test_breaker", failure_threshold=1, recovery_timeout=0.1)

    async def async_failure():
        raise ValueError("Async boom")

    async def async_success(val):
        return val * 2

    with pytest.raises(ValueError):
        await cb.async_call(async_failure)
    assert cb.state == "OPEN"

    with pytest.raises(CircuitBreakerOpenException):
        await cb.async_call(async_success, 5)


def test_anonymizer_masking():
    from app.utils.anonymizer import (
        mask_account,
        mask_complaint_data,
        mask_name,
        mask_phone,
    )

    # Phone masking
    assert mask_phone("9876543210") == "******3210"
    assert mask_phone("+91 98765 43210") == "********3210"
    assert mask_phone("") == ""

    # Name masking
    assert mask_name("Rohan Sharma") == "R**** S*****"
    assert mask_name("A B") == "A B"
    assert mask_name("") == ""

    # Account masking
    assert mask_account("123456789012") == "********9012"
    assert mask_account("") == ""

    # Dict masking
    raw = {
        "victim_phone": "9876543210",
        "victim_name": "Rohan Sharma",
        "account_number": "123456789012",
        "amount": 50000,
    }
    masked = mask_complaint_data(raw)
    assert masked["victim_phone_masked"] == "******3210"
    assert masked["victim_name_masked"] == "R**** S*****"
    assert masked["account_number_masked"] == "********9012"
    assert "victim_phone" not in masked
    assert masked["amount"] == 50000


def test_shap_explainer_radar_and_global():
    from unittest.mock import MagicMock

    from app.ml.shap_explainer import SHAPExplainer

    mock_model = MagicMock()
    mock_model.__class__.__name__ = "RandomForestClassifier"

    # Mock explainer
    explainer = SHAPExplainer.__new__(SHAPExplainer)
    explainer.model = mock_model
    explainer.feature_names = ["feat1", "feat2"]

    # Test radar data formatting
    radar = explainer.to_radar_data({"feat1": 0.5, "feat2": -0.3})
    assert len(radar) == 2
    assert radar[0] == {"feature": "feat1", "value": 0.5}
    assert radar[1] == {"feature": "feat2", "value": -0.3}


def test_mask_text_comprehensive():
    from app.utils.anonymizer import mask_complaint_data, mask_text

    sample = (
        "Victim contacted by scammer at 9876543210 and email test.user@fraud.org. "
        "Provided Aadhaar 1234 5678 9012, PAN ABCDE1234F, Card 4111 2222 3333 4444, "
        "and transferred to A/C: 987654321098."
    )
    masked = mask_text(sample)
    assert "9876543210" not in masked
    assert "******3210" in masked
    assert "test.user@fraud.org" not in masked
    assert "t***@fraud.org" in masked
    assert "1234 5678 9012" not in masked
    assert "XXXX-XXXX-9012" in masked
    assert "ABCDE1234F" not in masked
    assert "*****1234F" in masked
    assert "4111 2222 3333 4444" not in masked
    assert "****-****-****-4444" in masked
    assert "987654321098" not in masked
    assert "********1098" in masked

    # Also check mask_complaint_data on narrative text
    data = {
        "complaint_text": "Scam from 9876543210",
        "description": "Email was fraud@scam.com",
    }
    result = mask_complaint_data(data)
    assert "9876543210" not in result["complaint_text_masked"]
    assert "******3210" in result["complaint_text_masked"]
    assert "fraud@scam.com" not in result["description_masked"]
    assert "f***@scam.com" in result["description_masked"]


def test_fraud_ring_detector():
    import uuid
    from datetime import datetime, timezone

    from app.ml.graph_analytics import FraudRingDetector

    detector = FraudRingDetector(min_ring_size=3)

    # Empty complaints
    assert detector.detect_rings([]) == []

    # Syndicate sharing suspect phone and suspect account
    now = datetime.now(timezone.utc)
    syndicate_complaints = [
        {
            "id": str(uuid.uuid4()),
            "suspect_phone": "+919876543210",
            "suspect_account": "ACC_RING_01",
            "amount_lost": 25000,
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "suspect_phone": "+919876543210",
            "amount_lost": 30000,
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "suspect_account": "ACC_RING_01",
            "amount_lost": 45000,
            "created_at": now,
        },
        # Separate individual incident (below min_ring_size)
        {
            "id": str(uuid.uuid4()),
            "suspect_phone": "+911111111111",
            "amount_lost": 5000,
            "created_at": now,
        },
    ]

    rings = detector.detect_rings(syndicate_complaints)
    assert len(rings) == 1
    ring = rings[0]
    assert ring["complaint_count"] == 3
    assert ring["total_amount_lost"] == 100000.0
    assert ring["confidence_score"] >= 0.75
    assert any("9876543210" in s for s in ring["suspect_identifiers"])
    assert any("ACC_RING_01" in s for s in ring["suspect_identifiers"])


def test_model_registry_validation_and_rollback():
    from unittest.mock import MagicMock

    import pytest

    from app.ml.model_registry import ModelRegistry

    registry = ModelRegistry()

    # 1. Invalid model without predict methods should raise ValueError
    class InvalidModel:
        pass

    with pytest.raises(ValueError, match="Invalid model object"):
        registry.register("invalid", InvalidModel(), "v1.0")

    # 2. Valid model
    mock_model_v1 = MagicMock()
    mock_model_v1.predict = MagicMock(return_value=[1])
    registry.register("fraud_classifier", mock_model_v1, "v1.0.0")

    assert registry.get("fraud_classifier") == mock_model_v1
    assert registry.get_version("fraud_classifier") == "v1.0.0"

    # 3. Hot swap to v2
    mock_model_v2 = MagicMock()
    mock_model_v2.predict = MagicMock(return_value=[2])
    registry.hot_swap("fraud_classifier", mock_model_v2, "v2.0.0")

    assert registry.get("fraud_classifier") == mock_model_v2
    assert registry.get_version("fraud_classifier") == "v2.0.0"
    assert registry.get_history_count("fraud_classifier") == 1

    # 4. Rollback to v1
    rolled_back_version = registry.rollback("fraud_classifier")
    assert rolled_back_version == "v1.0.0"
    assert registry.get("fraud_classifier") == mock_model_v1
    assert registry.get_version("fraud_classifier") == "v1.0.0"
    assert registry.get_history_count("fraud_classifier") == 0

    # 5. Rollback again when history is empty raises ValueError
    with pytest.raises(ValueError, match="No previous version available"):
        registry.rollback("fraud_classifier")
