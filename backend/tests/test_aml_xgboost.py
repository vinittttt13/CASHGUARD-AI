"""
Unit and integration tests for AML XGBoost classifier (AmlLaunderingClassifier).
Validates feature engineering, model training, prediction, serialization, and ModelRegistry integration.
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import numpy as np
import pandas as pd

from app.ml.aml_xgboost_model import (
    AmlFeatureTransformer,
    AmlLaunderingClassifier,
    PAYMENT_FORMAT_MAP,
)
from app.ml.model_registry import ModelRegistry
from app.services.prediction_service import PredictionService


def _create_sample_aml_df(n: int = 100) -> pd.DataFrame:
    np.random.seed(42)
    timestamps = pd.date_range("2023-01-01", periods=n, freq="h").strftime("%Y/%m/%d %H:%M").tolist()
    banks = ["012", "020", "110", "3208", "9999"]
    accounts = [f"ACC_{i}" for i in range(20)]
    formats = list(PAYMENT_FORMAT_MAP.keys())
    currencies = ["US Dollar", "Euro", "Rupee", "UK Pound"]

    data = {
        "Timestamp": timestamps,
        "From Bank": np.random.choice(banks, n),
        "Account": np.random.choice(accounts, n),
        "To Bank": np.random.choice(banks, n),
        "Account.1": np.random.choice(accounts, n),
        "Amount Received": np.random.exponential(5000, n).round(2),
        "Receiving Currency": np.random.choice(currencies, n),
        "Amount Paid": np.random.exponential(5000, n).round(2),
        "Payment Currency": np.random.choice(currencies, n),
        "Payment Format": np.random.choice(formats, n),
        "Is Laundering": np.random.binomial(1, 0.15, n)
    }
    return pd.DataFrame(data)


class TestAmlXGBoost(unittest.TestCase):

    def setUp(self):
        self.df = _create_sample_aml_df(120)

    def test_transformer_fit_and_transform(self):
        transformer = AmlFeatureTransformer()
        transformer.fit(self.df)
        self.assertTrue(transformer.is_fitted)
        self.assertGreater(len(transformer.feature_columns), 10)

        # Transform training data
        X = transformer.transform(self.df)
        self.assertEqual(X.shape[0], len(self.df))
        self.assertEqual(X.shape[1], len(transformer.feature_columns))

        # Values should be within reasonable bounds (-1 to 1 for MinMaxScaler)
        self.assertTrue(np.all(X >= -1.01))
        self.assertTrue(np.all(X <= 1.01))

    def test_transformer_unseen_categories(self):
        transformer = AmlFeatureTransformer()
        transformer.fit(self.df)

        # Create new unseen transaction with unknown bank, unknown currency, etc.
        unseen_tx = pd.DataFrame([{
            "Timestamp": "2025-05-10 14:30",
            "From Bank": "UNKNOWN_BANK_999",
            "Account": "UNKNOWN_ACCT_888",
            "To Bank": "NEW_BANK_777",
            "Account.1": "NEW_ACCT_666",
            "Amount Received": 99999.0,
            "Receiving Currency": "Martian Dollar",
            "Amount Paid": 99999.0,
            "Payment Currency": "Martian Dollar",
            "Payment Format": "UnknownFormat"
        }])

        X_unseen = transformer.transform(unseen_tx)
        self.assertEqual(X_unseen.shape, (1, len(transformer.feature_columns)))
        self.assertFalse(np.isnan(X_unseen).any())

    def test_classifier_fit_predict(self):
        X = self.df.drop(columns=["Is Laundering"])
        y = self.df["Is Laundering"]

        clf = AmlLaunderingClassifier(n_estimators=30, max_depth=3, random_state=42)
        clf.fit(X, y)

        # Test predict_proba
        probs = clf.predict_proba(X)
        self.assertEqual(probs.shape, (len(X), 2))
        np.testing.assert_allclose(probs.sum(axis=1), 1.0, atol=1e-5)
        self.assertTrue(np.all((probs >= 0.0) & (probs <= 1.0)))

        # Test predict
        preds = clf.predict(X)
        self.assertEqual(len(preds), len(X))
        self.assertTrue(set(preds).issubset({0, 1}))

        # Test predict_risk
        risks = clf.predict_risk(X)
        self.assertEqual(len(risks), len(X))
        self.assertTrue(all(r in ("low", "medium", "high", "critical") for r in risks))

        # Test feature importance
        importances = clf.get_feature_importance()
        self.assertIsInstance(importances, dict)
        self.assertGreater(len(importances), 0)
        self.assertAlmostEqual(sum(importances.values()), 1.0, places=2)

    def test_serialization_and_deserialization(self):
        X = self.df.drop(columns=["Is Laundering"])
        y = self.df["Is Laundering"]

        clf = AmlLaunderingClassifier(n_estimators=20, max_depth=3, random_state=42)
        clf.fit(X, y)

        orig_preds = clf.predict(X)
        orig_probs = clf.predict_proba(X)

        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "xgboost_aml.pkl")
            clf.save(path)
            self.assertTrue(os.path.exists(path))

            # Load into a new instance
            loaded_clf = AmlLaunderingClassifier.load_from_artifact(path)
            loaded_preds = loaded_clf.predict(X)
            loaded_probs = loaded_clf.predict_proba(X)

            np.testing.assert_array_equal(orig_preds, loaded_preds)
            np.testing.assert_allclose(orig_probs, loaded_probs, atol=1e-5)

    def test_score_single_transaction(self):
        X = self.df.drop(columns=["Is Laundering"])
        y = self.df["Is Laundering"]
        clf = AmlLaunderingClassifier(n_estimators=20, max_depth=3, random_state=42)
        clf.fit(X, y)

        tx = {
            "Timestamp": "2023-01-01 10:00",
            "From Bank": "012",
            "Account": "ACC_1",
            "To Bank": "020",
            "Account.1": "ACC_2",
            "Amount Paid": 75000.0,
            "Amount Received": 75000.0,
            "Payment Currency": "Euro",
            "Receiving Currency": "Euro",
            "Payment Format": "Wire"
        }

        res = clf.score_transaction(tx)
        self.assertIn("is_laundering", res)
        self.assertIn("laundering_probability", res)
        self.assertIn("risk_level", res)
        self.assertIn("top_factors", res)
        self.assertTrue(0.0 <= res["laundering_probability"] <= 1.0)
        self.assertIn(res["risk_level"], ("low", "medium", "high", "critical"))

    def test_model_registry_and_service_integration(self):
        # Register in ModelRegistry
        registry = ModelRegistry()
        clf = AmlLaunderingClassifier(n_estimators=10, max_depth=3, random_state=42)
        X = self.df.drop(columns=["Is Laundering"])
        y = self.df["Is Laundering"]
        clf.fit(X, y)

        registry.register("xgboost_aml", clf, version="v1.0-test")
        self.assertIsNotNone(registry.get("xgboost_aml"))

        svc = PredictionService()
        sample_tx = {
            "amount_paid": 50000.0,
            "payment_format": "Cash",
            "payment_currency": "US Dollar"
        }
        scored = svc.score_aml_transaction(sample_tx)
        self.assertEqual(scored["model_name"], "xgboost_aml")
        self.assertIn("is_laundering", scored)
        self.assertIn("laundering_probability", scored)


if __name__ == "__main__":
    unittest.main()
