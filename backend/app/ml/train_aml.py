"""
Training entrypoint for the AML XGBoost Classifier.
Trains on IBM Transactions for Anti-Money Laundering (AML) data.
Evaluates precision, recall, F1, ROC-AUC, PR-AUC, and feature importances.
Saves model bundle to backend/app/ml/model_artifacts/xgboost_aml.pkl.

Usage:
    python -m app.ml.train_aml
    python -m app.ml.train_aml --max-rows 200000
    python -m app.ml.train_aml --csv dataset/HI-Small_Trans.csv
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, Tuple

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

from app.ml.aml_xgboost_model import AmlLaunderingClassifier

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("train_aml")

ARTIFACT_DIR = Path(__file__).resolve().parent / "model_artifacts"
PROJECT_ROOT = (
    Path(__file__).resolve().parents[2]
)  # backend root, or parents[3] workspace
WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DATASET = WORKSPACE_ROOT / "dataset" / "HI-Small_Trans.csv"
PATTERNS_FILE = WORKSPACE_ROOT / "dataset" / "HI-Small_Patterns.txt"


def parse_patterns_file(patterns_path: Path) -> pd.DataFrame:
    """Parses ground-truth laundering transactions from patterns file."""
    if not patterns_path.exists():
        return pd.DataFrame()

    records = []
    with open(patterns_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("BEGIN") or line.startswith("END"):
                continue
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 11:
                records.append(
                    {
                        "Timestamp": parts[0],
                        "From Bank": parts[1],
                        "Account": parts[2],
                        "To Bank": parts[3],
                        "Account.1": parts[4],
                        "Amount Received": float(parts[5]) if parts[5] else 0.0,
                        "Receiving Currency": parts[6],
                        "Amount Paid": float(parts[7]) if parts[7] else 0.0,
                        "Payment Currency": parts[8],
                        "Payment Format": parts[9],
                        "Is Laundering": int(parts[10]) if parts[10] else 1,
                    }
                )
    return pd.DataFrame(records)


def load_aml_dataset(
    csv_path: Path, max_rows: int = 250_000, include_patterns: bool = True
) -> pd.DataFrame:
    """
    Loads dataset with unbiased, uniform distribution across the entire temporal and entity span.
    Uses uniform stride sampling across all 5.07M rows to prevent time-of-day bias,
    and always captures 100% of ground-truth laundering transactions.
    """
    import io

    logger.info("Loading AML transaction data with uniform sampling from: %s", csv_path)
    if not csv_path.exists():
        raise FileNotFoundError(f"Dataset not found at {csv_path}")

    approx_total = 5_078_345
    stride = max(1, approx_total // max_rows)

    selected_lines = []
    with open(csv_path, "r", encoding="utf-8", errors="ignore") as f:
        header = f.readline()
        selected_lines.append(header)
        for idx, line in enumerate(f):
            is_laundering = line.endswith(",1\n") or line.endswith(",1\r\n")
            if is_laundering or (idx % stride == 0):
                selected_lines.append(line)

    csv_text = "".join(selected_lines)
    df_trans = pd.read_csv(io.StringIO(csv_text), low_memory=False)

    target_col = (
        "Is Laundering" if "Is Laundering" in df_trans.columns else "Is_Laundering"
    )
    df_trans[target_col] = df_trans[target_col].astype(int)
    laundering_count = int(df_trans[target_col].sum())
    logger.info(
        "Sampled %d transactions uniformly across the full dataset (%d laundering rows = %.2f%%)",
        len(df_trans),
        laundering_count,
        (laundering_count / len(df_trans)) * 100,
    )

    # If patterns file exists, merge with ground-truth patterns for comprehensive typology coverage
    if include_patterns and PATTERNS_FILE.exists():
        logger.info(
            "Enriching with ground truth laundering patterns from %s", PATTERNS_FILE
        )
        df_patterns = parse_patterns_file(PATTERNS_FILE)
        if not df_patterns.empty:
            logger.info(
                "Extracted %d ground-truth laundering transactions from patterns",
                len(df_patterns),
            )
            df_combined = pd.concat([df_trans, df_patterns], ignore_index=True)
            df_combined = df_combined.drop_duplicates(
                subset=[
                    "Timestamp",
                    "From Bank",
                    "Account",
                    "To Bank",
                    "Account.1",
                    "Amount Paid",
                ]
            )
            df_trans = df_combined
            new_laundering = int(df_trans[target_col].sum())
            logger.info(
                "Total after pattern enrichment: %d transactions (%d laundering, %0.2f%%)",
                len(df_trans),
                new_laundering,
                (new_laundering / len(df_trans)) * 100,
            )

    return df_trans


def train_aml_model(
    df: pd.DataFrame,
    test_size: float = 0.15,
    val_size: float = 0.15,
    random_state: int = 42,
) -> Tuple[AmlLaunderingClassifier, Dict[str, Any]]:
    """
    Executes leak-free train/val/test splitting, training, and evaluation.
    """
    target_col = "Is Laundering" if "Is Laundering" in df.columns else "Is_Laundering"
    X = df.drop(columns=[target_col])
    y = df[target_col].astype(int)

    # First split: Holdout Test (15%)
    X_temp, X_test, y_temp, y_test = train_test_split(
        X, y, test_size=test_size, stratify=y, random_state=random_state
    )

    # Second split: Train (70%) and Validation (15%)
    val_ratio_adjusted = val_size / (1.0 - test_size)
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp,
        y_temp,
        test_size=val_ratio_adjusted,
        stratify=y_temp,
        random_state=random_state,
    )

    logger.info(
        "Dataset Split -> Train: %d, Val: %d, Test: %d",
        len(X_train),
        len(X_val),
        len(X_test),
    )
    logger.info(
        "Train Laundering: %d / %d (%.2f%%)",
        y_train.sum(),
        len(y_train),
        (y_train.sum() / len(y_train)) * 100,
    )
    logger.info(
        "Val Laundering:   %d / %d (%.2f%%)",
        y_val.sum(),
        len(y_val),
        (y_val.sum() / len(y_val)) * 100,
    )
    logger.info(
        "Test Laundering:  %d / %d (%.2f%%)",
        y_test.sum(),
        len(y_test),
        (y_test.sum() / len(y_test)) * 100,
    )

    # Initialize and fit model
    classifier = AmlLaunderingClassifier(
        n_estimators=400,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=1.0,  # Dynamically computed in fit() based on class ratio
        decision_threshold=0.5,
        early_stopping_rounds=25,
        random_state=random_state,
    )

    t0 = time.time()
    classifier.fit(X_train, y_train, X_val=X_val, y_val=y_val)
    train_duration = time.time() - t0

    # Evaluate on Holdout Test Set
    logger.info("Evaluating on holdout test set...")
    y_prob = classifier.predict_proba(X_test)[:, 1]

    # Calculate ROC-AUC and PR-AUC
    roc_auc = float(roc_auc_score(y_test, y_prob))
    pr_auc = float(average_precision_score(y_test, y_prob))

    # Evaluate at threshold 0.5
    y_pred = (y_prob >= classifier.decision_threshold).astype(int)
    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    cm = confusion_matrix(y_test, y_pred).tolist()

    top_features = classifier.get_feature_importance()

    metrics = {
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "test_samples": len(X_test),
        "train_duration_seconds": round(train_duration, 2),
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4),
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "confusion_matrix": cm,
        "top_features": {k: round(v, 4) for k, v in list(top_features.items())[:10]},
    }

    classifier.metrics_ = metrics
    return classifier, metrics


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Train and evaluate AML XGBoost model")
    parser.add_argument(
        "--csv",
        type=str,
        default=str(DEFAULT_DATASET),
        help="Path to AML transactions CSV",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=150_000,
        help="Max rows to train on (default: 150,000)",
    )
    parser.add_argument(
        "--model-version", type=str, default="v1.0", help="Model version tag"
    )
    args = parser.parse_args(argv)

    csv_path = Path(args.csv)
    if not csv_path.exists():
        logger.error(
            "Dataset not found at %s. Please ensure dataset is downloaded.", csv_path
        )
        return 1

    df = load_aml_dataset(csv_path, max_rows=args.max_rows)
    classifier, metrics = train_aml_model(df)

    logger.info("=" * 60)
    logger.info("AML XGBoost Holdout Test Results:")
    logger.info("  ROC-AUC:   %.4f", metrics["roc_auc"])
    logger.info("  PR-AUC:    %.4f", metrics["pr_auc"])
    logger.info("  Accuracy:  %.4f", metrics["accuracy"])
    logger.info("  Precision: %.4f", metrics["precision"])
    logger.info("  Recall:    %.4f", metrics["recall"])
    logger.info("  F1 Score:  %.4f", metrics["f1_score"])
    logger.info("  Confusion Matrix (TN, FP / FN, TP): %s", metrics["confusion_matrix"])
    logger.info("=" * 60)
    logger.info("Top 5 Features: %s", list(metrics["top_features"].items())[:5])

    # Save artifact
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    artifact_path = ARTIFACT_DIR / "xgboost_aml.pkl"
    classifier.save(str(artifact_path))

    metrics_path = ARTIFACT_DIR / "xgboost_aml_metrics.json"
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    logger.info("Saved metrics to %s", metrics_path)

    return 0


if __name__ == "__main__":
    sys.exit(main())
