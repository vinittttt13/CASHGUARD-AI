"""Model training entrypoint.

Run from the ``backend/`` directory::

    python -m app.ml.train                       # load from the database
    python -m app.ml.train --from-csv fixture.csv
    python -m app.ml.train --production --model-version v1.3

Writes four artifacts to ``app/ml/model_artifacts/``:
``xgboost_location``, ``rf_risk``, ``prophet_temporal``, ``kmeans_hotspot``.
"""

import argparse
import asyncio
import logging
import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

from app.ml.data_loader import (
    MIN_TRAINING_ROWS,
    load_training_frame,
    load_withdrawal_coords,
)
from app.ml.feature_engineering import FEATURE_NAMES, FeatureEngineer
from app.ml.kmeans_hotspot import HotspotDetector
from app.ml.model_registry import ModelRegistry
from app.ml.model_validation import ModelValidator
from app.ml.prophet_model import TemporalForecaster
from app.ml.random_forest_model import RiskLevelClassifier
from app.ml.xgboost_model import CashoutLocationPredictor

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("app.ml.train")

ARTIFACT_NAMES = ("xgboost_location", "rf_risk", "prophet_temporal", "kmeans_hotspot")

# Columns a training CSV must provide (a --from-csv fixture is NON-PRODUCTION).
CSV_COLUMNS = [
    "timestamp", "lat", "lng", "complaint_text", "amount",
    "state", "district", "category", "bank_name", "cluster_id", "risk_level",
]


async def _load_from_db() -> tuple[pd.DataFrame, pd.DataFrame]:
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        df = await load_training_frame(session)
        atm = await load_withdrawal_coords(session)
    return df, atm


def _load_data(args) -> tuple[pd.DataFrame, pd.DataFrame]:
    if args.from_csv:
        logger.info("Loading training data from CSV: %s (non-production)", args.from_csv)
        df = pd.read_csv(args.from_csv, parse_dates=["timestamp"])
        missing = [c for c in CSV_COLUMNS if c not in df.columns]
        if missing:
            raise SystemExit(f"CSV missing required columns: {missing}")
        atm = df[["lat", "lng"]].drop_duplicates().reset_index(drop=True)
        return df, atm

    logger.info("Loading training data from the database...")
    df, atm = asyncio.run(_load_from_db())
    if atm is None or atm.empty:
        atm = df[["lat", "lng"]].drop_duplicates().reset_index(drop=True)
    return df, atm


def train_models(df: pd.DataFrame, atm_df: pd.DataFrame, model_version: str) -> dict:
    if len(df) < MIN_TRAINING_ROWS:
        raise SystemExit(
            f"Only {len(df)} training rows (< {MIN_TRAINING_ROWS}). "
            "Collect more complaints before training."
        )

    logger.info("1. Feature engineering on %d rows", len(df))
    fe = FeatureEngineer()
    fe.fit_atm_tree(atm_df)
    X = fe.create_feature_matrix(df, is_training=True)  # -> np.ndarray
    y_cluster = np.asarray(df["cluster_id"].values)
    y_risk = np.asarray(df["risk_level"].values)

    # One synchronized split for every target.
    idx = np.arange(X.shape[0])
    test_size = 0.2 if len(idx) * 0.2 >= 1 else 1 / len(idx)
    train_idx, val_idx = train_test_split(idx, test_size=test_size, random_state=42)
    X_train, X_val = X[train_idx], X[val_idx]

    logger.info("2. XGBoost cash-out location predictor")
    xgb_model = CashoutLocationPredictor()
    xgb_model.train(
        X_train, y_cluster[train_idx], X_val, y_cluster[val_idx],
        feature_names=FEATURE_NAMES,
    )
    xgb_preds = [p[0][0] for p in xgb_model.predict(X_val)]
    logger.info("   XGBoost val accuracy: %.3f", accuracy_score(y_cluster[val_idx], xgb_preds))

    logger.info("3. Random-forest risk classifier")
    rf_model = RiskLevelClassifier()
    rf_model.train(X_train, y_risk[train_idx])
    rf_preds = [p[0] for p in rf_model.predict_risk(X_val)]
    logger.info("   RF val accuracy: %.3f", accuracy_score(y_risk[val_idx], rf_preds))
    validation = ModelValidator().validate(
        "rf_risk", list(y_risk[val_idx]), list(rf_preds)
    )

    logger.info("4. Prophet temporal forecaster")
    counts = (
        df[["timestamp"]]
        .assign(ds=pd.to_datetime(df["timestamp"]).dt.date)
        .groupby("ds")
        .size()
        .reset_index(name="y")
    )
    prophet_model = None
    try:
        prophet_model = TemporalForecaster()
        if len(counts) > 2:
            prophet_model.train(counts)
        else:
            logger.warning("   Only %d distinct days — Prophet left unfitted", len(counts))
    except Exception as exc:  # noqa: BLE001 — Prophet/Stan envs are fragile
        logger.error("   Prophet unavailable, skipping temporal model: %s", exc)
        prophet_model = None

    logger.info("5. K-Means hotspot detector")
    km_model = HotspotDetector()
    km_model.fit(df[["lat", "lng"]].values.tolist())

    models = {
        "xgboost_location": xgb_model,
        "rf_risk": rf_model,
        "kmeans_hotspot": km_model,
    }
    if prophet_model is not None:
        models["prophet_temporal"] = prophet_model
    return models, validation


def save_models(models: dict, model_version: str) -> str:
    """Serialize exactly the freshly trained models (not the process-wide
    ModelRegistry singleton, which other code/tests may have populated)."""
    artifacts_dir = os.path.join(os.path.dirname(__file__), "model_artifacts")
    os.makedirs(artifacts_dir, exist_ok=True)
    for name, model in models.items():
        ModelRegistry()._validate_model(model)
        joblib.dump(
            {"model": model, "version": model_version},
            os.path.join(artifacts_dir, f"{name}.pkl"),
        )
    logger.info("Saved %d artifacts to %s", len(models), artifacts_dir)
    return artifacts_dir


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Train CASHGUARD-AI models")
    parser.add_argument("--from-csv", type=str, help="Path to a (non-production) training CSV")
    parser.add_argument("--production", action="store_true", help="Production run (DB source)")
    parser.add_argument("--model-version", type=str, default="v1.0")
    parser.add_argument(
        "--publish",
        action="store_true",
        help="After the validation gate passes, upload artifacts to MODEL_STORE_URI",
    )
    args = parser.parse_args(argv)

    if args.production and args.from_csv:
        parser.error("--production and --from-csv are mutually exclusive")

    logger.info("Training pipeline start — version %s", args.model_version)
    df, atm_df = _load_data(args)
    if df is None or df.empty:
        raise SystemExit("No training data available.")

    models, validation = train_models(df, atm_df, args.model_version)
    save_models(models, args.model_version)

    logger.info(
        "Validation gate (rf_risk): passed=%s accuracy=%.3f f1=%.3f",
        validation["passed"],
        validation["metrics"]["accuracy"],
        validation["metrics"]["f1_weighted"],
    )

    if args.publish:
        from app.core.config import get_settings

        store_uri = get_settings().model_store_uri
        if not validation["passed"]:
            raise SystemExit(
                "Validation gate FAILED — not publishing. "
                f"thresholds={validation['thresholds']} metrics={validation['metrics']}"
            )
        if not store_uri:
            raise SystemExit("--publish set but MODEL_STORE_URI is empty")
        registry = ModelRegistry()
        for name, model in models.items():
            registry.register(name, model, args.model_version)
        registry.save_to_store(store_uri)
        logger.info("Published version %s to %s", args.model_version, store_uri)

    logger.info("Training complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
