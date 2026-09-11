"""
AML Laundering Classifier powered by XGBoost for CASHGUARD-AI.
Production-grade implementation fixing data leakage, high variance, and lack of inference pipeline
identified in the exploratory Kaggle notebook (moonbridge24/code-for-aml-xgboost).

Conforms to CASHGUARD-AI ModelRegistry requirements:
- predict(X)
- predict_proba(X)
- predict_risk(X)
- get_feature_importance()
- save(path) / load(path)
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional, Tuple, Union

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.preprocessing import MinMaxScaler

logger = logging.getLogger(__name__)

# Currency to USD conversion rates (matching docs/IBM_AML_DATASET_INTEGRATION.md)
CURRENCY_TO_USD = {
    "US Dollar": 1.0,
    "Euro": 1.08,
    "UK Pound": 1.28,
    "Rupee": 0.012,
    "Yen": 0.0067,
    "Australian Dollar": 0.65,
    "Canadian Dollar": 0.74,
    "Mexican Peso": 0.055,
    "Bitcoin": 60000.0,
    "Yuan": 0.14,
    "Swiss Franc": 1.13,
    "Brazil Real": 0.18,
    "Saudi Riyal": 0.27,
    "Shekel": 0.27,
}
USD_TO_INR = 83.5

# Canonical mapping for payment format complexity
PAYMENT_FORMAT_MAP = {
    "Cash": 1,
    "Cheque": 2,
    "ACH": 3,
    "Credit Card": 4,
    "Wire": 5,
    "Bitcoin": 6,
    "Reinvestment": 7,
}

CASHOUT_FORMATS = {"Cash", "Cheque", "Wire"}


class AmlFeatureTransformer:
    """
    Leak-free feature transformer for AML transaction data.
    Fits all encoders, scalers, and frequency maps strictly on training data.
    Safely transforms test and production inference records without KeyError or dimension mismatches.
    """

    def __init__(self):
        self.is_fitted = False
        self.scaler = MinMaxScaler(feature_range=(-1, 1))
        self.currency_map: Dict[str, int] = {}
        self.bank_freq_map: Dict[str, float] = {}
        self.account_freq_map: Dict[str, float] = {}
        self.payment_format_map = PAYMENT_FORMAT_MAP.copy()
        self.feature_columns: List[str] = []
        self.base_timestamp: float = 0.0
        self.max_timestamp_delta: float = 1.0

    def _standardize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Map heterogeneous column names to standard internal names."""
        col_map = {
            "Timestamp": "timestamp",
            "From Bank": "from_bank",
            "Account": "from_account",
            "To Bank": "to_bank",
            "Account.1": "to_account",
            "Amount Received": "amount_received",
            "Receiving Currency": "receiving_currency",
            "Amount Paid": "amount_paid",
            "amount": "amount_paid",
            "Amount": "amount_paid",
            "Payment Currency": "payment_currency",
            "currency": "payment_currency",
            "Payment Format": "payment_format",
            "format": "payment_format",
            "Is Laundering": "is_laundering",
            "Is_Laundering": "is_laundering",
        }
        df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})
        return df

    def fit(self, df: pd.DataFrame) -> AmlFeatureTransformer:
        df = self._standardize_columns(df.copy())

        # Fit currency encoder
        currencies = set(
            df.get("payment_currency", pd.Series(dtype=str)).dropna().unique()
        ) | set(df.get("receiving_currency", pd.Series(dtype=str)).dropna().unique())
        self.currency_map = {c: idx + 1 for idx, c in enumerate(sorted(currencies))}

        # Fit bank frequency distributions (robust against unseen banks)
        all_banks = (
            pd.concat(
                [
                    df.get("from_bank", pd.Series(dtype=str)),
                    df.get("to_bank", pd.Series(dtype=str)),
                ]
            )
            .dropna()
            .astype(str)
        )
        bank_counts = all_banks.value_counts(normalize=True).to_dict()
        self.bank_freq_map = bank_counts

        # Fit account frequency distributions
        all_accounts = (
            pd.concat(
                [
                    df.get("from_account", pd.Series(dtype=str)),
                    df.get("to_account", pd.Series(dtype=str)),
                ]
            )
            .dropna()
            .astype(str)
        )
        acct_counts = all_accounts.value_counts(normalize=True).to_dict()
        self.account_freq_map = acct_counts

        # Base timestamp for normalization
        if "timestamp" in df.columns:
            ts_series = pd.to_datetime(df["timestamp"], errors="coerce")
            valid_ts = ts_series.dropna()
            if not valid_ts.empty:
                # Convert timestamps safely to seconds
                ts_sec = (valid_ts - pd.Timestamp("1970-01-01")) // pd.Timedelta("1s")
                self.base_timestamp = float(ts_sec.min())
                self.max_timestamp_delta = max(
                    1.0, float(ts_sec.max() - self.base_timestamp)
                )

        # Extract features and fit scaler
        X_df = self._extract_raw_features(df)
        self.feature_columns = list(X_df.columns)
        self.scaler.fit(X_df.values)
        self.is_fitted = True
        return self

    def _extract_raw_features(self, df: pd.DataFrame) -> pd.DataFrame:
        df = self._standardize_columns(df)
        n = len(df)
        features = pd.DataFrame(index=df.index)

        # 1. Temporal features (cyclical & behavioral - invariant to calendar year)
        if "timestamp" in df.columns:
            ts = pd.to_datetime(df["timestamp"], errors="coerce")
            features["hour"] = ts.dt.hour.fillna(12).astype(float)
            features["day_of_week"] = ts.dt.dayofweek.fillna(2).astype(float)
            features["is_weekend"] = features["day_of_week"].isin([5, 6]).astype(float)
            features["is_night"] = (
                (features["hour"] < 6) | (features["hour"] >= 22)
            ).astype(float)
            # Cyclical hour encoding (smooth wrap-around from 23:59 to 00:00)
            features["hour_sin"] = np.sin(2 * np.pi * features["hour"] / 24.0)
            features["hour_cos"] = np.cos(2 * np.pi * features["hour"] / 24.0)
        else:
            features["hour"] = 12.0
            features["day_of_week"] = 2.0
            features["is_weekend"] = 0.0
            features["is_night"] = 0.0
            features["hour_sin"] = 0.0
            features["hour_cos"] = 1.0

        # 2. Financial Amount features
        amount_paid = (
            pd.to_numeric(df.get("amount_paid", 0.0), errors="coerce")
            .fillna(0.0)
            .astype(float)
        )
        amount_received = (
            pd.to_numeric(df.get("amount_received", amount_paid), errors="coerce")
            .fillna(amount_paid)
            .astype(float)
        )

        features["amount_paid"] = amount_paid
        features["amount_received"] = amount_received
        features["amount_log"] = np.log1p(np.maximum(0.0, amount_paid))
        features["amount_diff"] = np.abs(amount_paid - amount_received)
        features["is_round_amount"] = (amount_paid % 1000.0 == 0.0).astype(float)

        # INR conversion
        pay_curr = df.get(
            "payment_currency", pd.Series(["US Dollar"] * n, index=df.index)
        ).fillna("US Dollar")
        usd_rate = pay_curr.map(CURRENCY_TO_USD).fillna(1.0).astype(float)
        features["amount_inr"] = amount_paid * usd_rate * USD_TO_INR
        features["amount_inr_log"] = np.log1p(np.maximum(0.0, features["amount_inr"]))

        # 3. Payment Format features
        pmt_fmt = df.get(
            "payment_format", pd.Series(["Cash"] * n, index=df.index)
        ).fillna("Cash")
        features["payment_format_code"] = (
            pmt_fmt.map(self.payment_format_map).fillna(1).astype(float)
        )
        features["is_cashout_format"] = pmt_fmt.isin(CASHOUT_FORMATS).astype(float)

        # 4. Currency features
        rcv_curr = df.get("receiving_currency", pay_curr).fillna(pay_curr)
        features["payment_curr_code"] = (
            pay_curr.map(self.currency_map).fillna(0).astype(float)
        )
        features["receiving_curr_code"] = (
            rcv_curr.map(self.currency_map).fillna(0).astype(float)
        )
        features["is_cross_currency"] = (pay_curr != rcv_curr).astype(float)

        # 5. Entity & Bank Network features
        from_bank = df.get("from_bank", pd.Series(["0"] * n, index=df.index)).astype(
            str
        )
        to_bank = df.get("to_bank", pd.Series(["0"] * n, index=df.index)).astype(str)
        from_acct = df.get("from_account", pd.Series(["0"] * n, index=df.index)).astype(
            str
        )
        to_acct = df.get("to_account", pd.Series(["0"] * n, index=df.index)).astype(str)

        features["is_same_bank"] = (from_bank == to_bank).astype(float)
        features["is_same_account"] = (from_acct == to_acct).astype(float)
        features["from_bank_freq"] = (
            from_bank.map(self.bank_freq_map).fillna(0.0).astype(float)
        )
        features["to_bank_freq"] = (
            to_bank.map(self.bank_freq_map).fillna(0.0).astype(float)
        )
        features["from_acct_freq"] = (
            from_acct.map(self.account_freq_map).fillna(0.0).astype(float)
        )
        features["to_acct_freq"] = (
            to_acct.map(self.account_freq_map).fillna(0.0).astype(float)
        )

        return features

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        if not self.is_fitted:
            raise ValueError(
                "AmlFeatureTransformer must be fitted before calling transform()"
            )
        df_standard = self._standardize_columns(df.copy())
        X_raw = self._extract_raw_features(df_standard)

        # Ensure exact column ordering as during fit
        for col in self.feature_columns:
            if col not in X_raw.columns:
                X_raw[col] = 0.0
        X_ordered = X_raw[self.feature_columns].values
        return self.scaler.transform(X_ordered)


class AmlLaunderingClassifier:
    """
    XGBoost Classifier for Anti-Money Laundering (AML) transaction classification.
    Self-contained, leak-free pipeline with full serialization and feature importance.
    """

    def __init__(
        self,
        n_estimators: int = 400,
        max_depth: int = 6,
        learning_rate: float = 0.05,
        subsample: float = 0.8,
        colsample_bytree: float = 0.8,
        scale_pos_weight: float = 1.0,
        decision_threshold: float = 0.5,
        early_stopping_rounds: int = 25,
        random_state: int = 42,
        device: str = "cpu",
        tree_method: str = "hist",
    ):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.subsample = subsample
        self.colsample_bytree = colsample_bytree
        self.scale_pos_weight = scale_pos_weight
        self.decision_threshold = decision_threshold
        self.early_stopping_rounds = early_stopping_rounds
        self.random_state = random_state
        self.device = device
        self.tree_method = tree_method

        self.transformer = AmlFeatureTransformer()
        self.model = xgb.XGBClassifier(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            learning_rate=self.learning_rate,
            subsample=self.subsample,
            colsample_bytree=self.colsample_bytree,
            scale_pos_weight=self.scale_pos_weight,
            objective="binary:logistic",
            eval_metric=["logloss", "aucpr"],
            random_state=self.random_state,
            early_stopping_rounds=self.early_stopping_rounds,
            tree_method=self.tree_method,
            device=self.device,
        )
        self.feature_names: List[str] = []
        self.classes_ = np.array([0, 1])
        self.metrics_: Dict[str, Any] = {}

    def fit(
        self,
        X_train: Union[pd.DataFrame, np.ndarray],
        y_train: Union[pd.Series, np.ndarray],
        X_val: Optional[Union[pd.DataFrame, np.ndarray]] = None,
        y_val: Optional[Union[pd.Series, np.ndarray]] = None,
    ) -> AmlLaunderingClassifier:
        """
        Fits transformer strictly on X_train, transforms validation data,
        and trains XGBoost with early stopping.
        """
        if isinstance(X_train, pd.DataFrame):
            self.transformer.fit(X_train)
            X_train_mat = self.transformer.transform(X_train)
        else:
            X_train_mat = np.asarray(X_train)

        self.feature_names = self.transformer.feature_columns
        y_train_arr = np.asarray(y_train).astype(int)

        eval_set = None
        fit_kwargs = {"verbose": False}
        if X_val is not None and y_val is not None:
            if isinstance(X_val, pd.DataFrame):
                X_val_mat = self.transformer.transform(X_val)
            else:
                X_val_mat = np.asarray(X_val)
            y_val_arr = np.asarray(y_val).astype(int)
            eval_set = [(X_train_mat, y_train_arr), (X_val_mat, y_val_arr)]
            fit_kwargs["eval_set"] = eval_set
            if self.early_stopping_rounds:
                self.model.set_params(early_stopping_rounds=self.early_stopping_rounds)
        else:
            self.model.set_params(early_stopping_rounds=None)

        # Automatically adjust scale_pos_weight if not explicitly set
        n_neg = int((y_train_arr == 0).sum())
        n_pos = int((y_train_arr == 1).sum())
        if self.scale_pos_weight == 1.0 and n_pos > 0 and n_neg > n_pos:
            calculated_ratio = min(50.0, float(n_neg) / float(n_pos))
            self.model.set_params(scale_pos_weight=calculated_ratio)
            logger.info(
                "Adjusted scale_pos_weight to %.2f based on class distribution (%d neg, %d pos)",
                calculated_ratio,
                n_neg,
                n_pos,
            )

        logger.info(
            "Training XGBoost AML Classifier on %d samples...", len(y_train_arr)
        )
        self.model.fit(X_train_mat, y_train_arr, **fit_kwargs)
        logger.info(
            "XGBoost AML Classifier training finished. Best iteration: %s",
            getattr(self.model, "best_iteration", "N/A"),
        )
        return self

    def _prepare_input(
        self, X: Union[pd.DataFrame, np.ndarray, Dict[str, Any], List[Dict[str, Any]]]
    ) -> np.ndarray:
        if isinstance(X, dict):
            X = pd.DataFrame([X])
        elif isinstance(X, list) and len(X) > 0 and isinstance(X[0], dict):
            X = pd.DataFrame(X)

        if isinstance(X, pd.DataFrame):
            return self.transformer.transform(X)
        return np.asarray(X)

    def predict_proba(
        self, X: Union[pd.DataFrame, np.ndarray, Dict[str, Any], List[Dict[str, Any]]]
    ) -> np.ndarray:
        """Returns 2D array of class probabilities: shape (n_samples, 2)."""
        X_mat = self._prepare_input(X)
        return self.model.predict_proba(X_mat)

    def predict(
        self, X: Union[pd.DataFrame, np.ndarray, Dict[str, Any], List[Dict[str, Any]]]
    ) -> np.ndarray:
        """Returns binary predictions based on decision_threshold."""
        probs = self.predict_proba(X)[:, 1]
        return (probs >= self.decision_threshold).astype(int)

    def predict_risk(
        self, X: Union[pd.DataFrame, np.ndarray, Dict[str, Any], List[Dict[str, Any]]]
    ) -> List[str]:
        """
        Buckets transaction risk into standard CASHGUARD-AI risk levels:
        - critical: p >= 0.80
        - high:     p >= 0.50
        - medium:   p >= 0.20
        - low:      p <  0.20
        """
        probs = self.predict_proba(X)[:, 1]
        risk_levels = []
        for p in probs:
            if p >= 0.80:
                risk_levels.append("critical")
            elif p >= 0.50:
                risk_levels.append("high")
            elif p >= 0.20:
                risk_levels.append("medium")
            else:
                risk_levels.append("low")
        return risk_levels

    def get_feature_importance(self) -> Dict[str, float]:
        """Returns normalized tree feature importances."""
        if hasattr(self.model, "feature_importances_") and self.feature_names:
            importances = self.model.feature_importances_
            total = sum(importances) or 1.0
            sorted_items = sorted(
                [
                    (name, float(imp / total))
                    for name, imp in zip(self.feature_names, importances)
                ],
                key=lambda x: x[1],
                reverse=True,
            )
            return dict(sorted_items)
        return {}

    def score_transaction(self, tx: Dict[str, Any]) -> Dict[str, Any]:
        """
        Inference helper for scoring an individual transaction with full explanation.
        """
        df_single = pd.DataFrame([tx])
        prob = float(self.predict_proba(df_single)[0, 1])
        is_laundering = int(prob >= self.decision_threshold)
        risk = self.predict_risk(df_single)[0]

        # Top 5 most influential global features
        top_importances = list(self.get_feature_importance().items())[:5]
        top_factors = [{"factor": k, "weight": round(v, 4)} for k, v in top_importances]

        return {
            "is_laundering": is_laundering,
            "laundering_probability": round(prob, 4),
            "risk_level": risk,
            "decision_threshold": self.decision_threshold,
            "top_factors": top_factors,
        }

    def save(self, path: str, version: str = "v1.0") -> None:
        """Persists the complete bundle (model + transformer + metadata) for ModelRegistry."""
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        bundle = {
            "model": self,
            "version": version,
            "raw_xgb_model": self.model,
            "transformer": self.transformer,
            "feature_names": self.feature_names,
            "decision_threshold": self.decision_threshold,
            "metrics_": self.metrics_,
            "classes_": self.classes_,
        }
        joblib.dump(bundle, path)
        logger.info("Saved AML XGBoost bundle to %s", path)

    @classmethod
    def load_from_artifact(cls, path: str) -> AmlLaunderingClassifier:
        bundle = joblib.load(path)
        if isinstance(bundle.get("model"), AmlLaunderingClassifier):
            return bundle["model"]
        instance = cls()
        instance.model = bundle.get("raw_xgb_model", bundle.get("model"))
        instance.transformer = bundle["transformer"]
        instance.feature_names = bundle.get(
            "feature_names", instance.transformer.feature_columns
        )
        instance.decision_threshold = bundle.get("decision_threshold", 0.5)
        instance.metrics_ = bundle.get("metrics_", {})
        instance.classes_ = bundle.get("classes_", np.array([0, 1]))
        return instance

    def load(self, path: str) -> AmlLaunderingClassifier:
        """Loads model bundle from disk."""
        loaded = self.load_from_artifact(path)
        self.__dict__.update(loaded.__dict__)
        logger.info("Loaded AML XGBoost bundle from %s", path)
        return self
