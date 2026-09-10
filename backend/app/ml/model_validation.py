"""
Model validation framework for CASHGUARD-AI ML pipeline.

Provides comprehensive evaluation metrics (Precision, Recall, F1, ROC-AUC,
Confusion Matrix), cross-validation, and production quality gating.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Union

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report,
    mean_squared_error,
    mean_absolute_error,
    r2_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score

logger = logging.getLogger(__name__)


def evaluate_classification_metrics(
    y_true: Union[List, np.ndarray],
    y_pred: Union[List, np.ndarray],
    y_prob: Optional[Union[List, np.ndarray]] = None,
) -> Dict[str, Any]:
    """Calculate comprehensive classification metrics."""
    y_true_arr = np.asarray(y_true)
    y_pred_arr = np.asarray(y_pred)

    unique_classes = np.unique(y_true_arr)
    is_binary = len(unique_classes) <= 2

    acc = float(accuracy_score(y_true_arr, y_pred_arr))
    prec_weighted = float(
        precision_score(y_true_arr, y_pred_arr, average="weighted", zero_division=0)
    )
    rec_weighted = float(
        recall_score(y_true_arr, y_pred_arr, average="weighted", zero_division=0)
    )
    f1_weighted = float(
        f1_score(y_true_arr, y_pred_arr, average="weighted", zero_division=0)
    )
    f1_macro = float(
        f1_score(y_true_arr, y_pred_arr, average="macro", zero_division=0)
    )

    roc_auc: Optional[float] = None
    if y_prob is not None:
        try:
            prob_arr = np.asarray(y_prob)
            if is_binary and prob_arr.ndim == 2 and prob_arr.shape[1] == 2:
                prob_arr = prob_arr[:, 1]
            if is_binary:
                roc_auc = float(roc_auc_score(y_true_arr, prob_arr))
            else:
                roc_auc = float(
                    roc_auc_score(
                        y_true_arr, prob_arr, multi_class="ovr", average="weighted"
                    )
                )
        except Exception as exc:
            logger.debug("ROC-AUC calculation skipped: %s", exc)

    cm = confusion_matrix(y_true_arr, y_pred_arr).tolist()
    report = classification_report(
        y_true_arr, y_pred_arr, output_dict=True, zero_division=0
    )

    return {
        "accuracy": round(acc, 4),
        "precision_weighted": round(prec_weighted, 4),
        "recall_weighted": round(rec_weighted, 4),
        "f1_weighted": round(f1_weighted, 4),
        "f1_macro": round(f1_macro, 4),
        "roc_auc": round(roc_auc, 4) if roc_auc is not None else None,
        "confusion_matrix": cm,
        "classification_report": report,
        "sample_count": len(y_true_arr),
    }


def evaluate_regression_metrics(
    y_true: Union[List, np.ndarray],
    y_pred: Union[List, np.ndarray],
) -> Dict[str, Any]:
    """Calculate standard regression metrics (MSE, RMSE, MAE, R²)."""
    y_true_arr = np.asarray(y_true, dtype=float)
    y_pred_arr = np.asarray(y_pred, dtype=float)

    mse = float(mean_squared_error(y_true_arr, y_pred_arr))
    rmse = float(np.sqrt(mse))
    mae = float(mean_absolute_error(y_true_arr, y_pred_arr))
    r2 = float(r2_score(y_true_arr, y_pred_arr))

    return {
        "mse": round(mse, 4),
        "rmse": round(rmse, 4),
        "mae": round(mae, 4),
        "r2": round(r2, 4),
        "sample_count": len(y_true_arr),
    }


def cross_validate_classifier(
    model: Any,
    X: np.ndarray,
    y: np.ndarray,
    cv: int = 5,
    scoring: str = "f1_weighted",
) -> Dict[str, Any]:
    """Perform stratified cross-validation on a classifier."""
    X_arr = np.asarray(X)
    y_arr = np.asarray(y)

    # Adjust folds if dataset has fewer samples than cv
    min_class_samples = np.min(np.bincount(y_arr)) if np.issubdtype(y_arr.dtype, np.integer) else len(y_arr)
    actual_cv = max(2, min(cv, min_class_samples))

    skf = StratifiedKFold(n_splits=actual_cv, shuffle=True, random_state=42)
    scores = cross_val_score(model, X_arr, y_arr, cv=skf, scoring=scoring)

    return {
        "scoring": scoring,
        "cv_folds": actual_cv,
        "fold_scores": [round(float(s), 4) for s in scores],
        "mean_score": round(float(np.mean(scores)), 4),
        "std_score": round(float(np.std(scores)), 4),
    }


class ModelValidator:
    """Validator that checks model metrics against production quality thresholds."""

    def __init__(
        self,
        min_accuracy: float = 0.70,
        min_f1: float = 0.65,
    ) -> None:
        self.min_accuracy = min_accuracy
        self.min_f1 = min_f1

    def validate(
        self,
        model_name: str,
        y_true: Union[List, np.ndarray],
        y_pred: Union[List, np.ndarray],
        y_prob: Optional[Union[List, np.ndarray]] = None,
    ) -> Dict[str, Any]:
        metrics = evaluate_classification_metrics(y_true, y_pred, y_prob)

        passed = (
            metrics["accuracy"] >= self.min_accuracy
            and metrics["f1_weighted"] >= self.min_f1
        )

        return {
            "model_name": model_name,
            "passed": passed,
            "thresholds": {
                "min_accuracy": self.min_accuracy,
                "min_f1": self.min_f1,
            },
            "metrics": metrics,
        }
