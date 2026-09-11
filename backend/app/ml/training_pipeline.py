"""
Unified Model Training Pipeline for CASHGUARD-AI.
Supports on-demand retraining from synthetic data or active PostgreSQL database records.
Persists trained artifacts to disk and immediately hot-swaps them into ModelRegistry.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier

from app.ml.aml_xgboost_model import AmlLaunderingClassifier
from app.ml.hardware import detect_hardware, print_hardware_summary
from app.ml.kmeans_hotspot import HotspotDetector
from app.ml.model_registry import ModelRegistry
from app.ml.random_forest_model import RiskLevelClassifier
from app.ml.xgboost_model import CashoutLocationPredictor

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).resolve().parent / "model_artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

INDIAN_CITIES = [
    ("Mumbai", 19.0760, 72.8777),
    ("Delhi", 28.6139, 77.2090),
    ("Bengaluru", 12.9716, 77.5946),
    ("Pune", 18.5204, 73.8567),
    ("Hyderabad", 17.3850, 78.4867),
    ("Kolkata", 22.5726, 88.3639),
    ("Chennai", 13.0827, 80.2707),
    ("Jaipur", 26.9124, 75.7873),
    ("Ahmedabad", 23.0225, 72.5714),
    ("Lucknow", 26.8467, 80.9462),
]

BANKS = [
    "State Bank of India",
    "HDFC Bank",
    "ICICI Bank",
    "Axis Bank",
    "Punjab National Bank",
    "Kotak Mahindra Bank",
    "Bank of Baroda",
]

PAYMENT_FORMATS = ["Cash", "Cheque", "ACH", "Credit Card", "Wire", "Bitcoin", "Reinvestment"]
CURRENCIES = ["Rupee", "US Dollar", "Euro", "UK Pound", "Bitcoin"]


def generate_synthetic_complaints(n: int = 5000) -> pd.DataFrame:
    """Generate realistic cybercrime complaints across Indian cities."""
    names = [
        "Ravi Shankar", "Priya Mehta", "Amit Patil", "Sunita Rao", "Vikram Joshi",
        "Ananya Sharma", "Rajesh Kumar", "Pooja Verma", "Suresh Nair", "Deepak Gupta"
    ]
    records = []
    for i in range(n):
        city = random.choice(INDIAN_CITIES)
        amt = round(random.uniform(2000, 750000), 2)
        risk = "critical" if amt > 300000 else ("high" if amt > 100000 else ("medium" if amt > 25000 else "low"))
        records.append({
            "id": i + 1,
            "victim_name": random.choice(names),
            "amount": amt,
            "bank_name": random.choice(BANKS),
            "city": city[0],
            "lat": city[1] + np.random.normal(0, 0.03),
            "lng": city[2] + np.random.normal(0, 0.03),
            "risk_level": risk,
            "cluster_id": random.randint(0, 7),
        })
    return pd.DataFrame(records)


def generate_synthetic_aml_transactions(n: int = 10000) -> pd.DataFrame:
    """Generate AML transaction records with laundering patterns."""
    data = []
    for i in range(n):
        amt_paid = round(random.uniform(5000, 1500000), 2)
        pmt_fmt = random.choice(PAYMENT_FORMATS)
        is_cashout = pmt_fmt in ("Cash", "Cheque", "Wire", "Bitcoin")
        
        # Determine laundering probability heuristics
        p_launder = 0.05
        if amt_paid > 200000:
            p_launder += 0.30
        if is_cashout:
            p_launder += 0.25
        if amt_paid % 10000 == 0:  # round structuring
            p_launder += 0.15
            
        is_laundering = int(random.random() < p_launder)
        amt_rcv = amt_paid * (random.uniform(0.92, 1.0) if is_laundering else random.uniform(0.98, 1.0))
        
        data.append({
            "Timestamp": datetime.utcnow().strftime("%Y/%m/%d %H:%M"),
            "From Bank": random.choice(BANKS),
            "Account": f"ACC{random.randint(10000, 99999)}",
            "To Bank": random.choice(BANKS),
            "Account.1": f"ACC{random.randint(10000, 99999)}",
            "Amount Received": round(amt_rcv, 2),
            "Receiving Currency": random.choice(CURRENCIES),
            "Amount Paid": amt_paid,
            "Payment Currency": random.choice(CURRENCIES),
            "Payment Format": pmt_fmt,
            "Is Laundering": is_laundering,
        })
    return pd.DataFrame(data)


async def load_db_complaints() -> pd.DataFrame:
    """Load real complaint rows from PostgreSQL."""
    try:
        from app.core.database import AsyncSessionLocal
        from sqlalchemy import select
        from app.models.complaint import Complaint

        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Complaint))
            complaints = result.scalars().all()
            if not complaints:
                logger.info("No complaints found in DB, generating fallback synthetic.")
                return generate_synthetic_complaints(2000)
            
            records = []
            for c in complaints:
                records.append({
                    "id": str(c.id),
                    "amount": float(c.amount_defrauded or 10000.0),
                    "bank_name": c.bank_name or "State Bank of India",
                    "lat": float(c.latitude or 28.6139),
                    "lng": float(c.longitude or 77.2090),
                    "city": c.district or "Delhi",
                    "risk_level": "medium",
                    "cluster_id": 0,
                })
            df = pd.DataFrame(records)
            if len(df) < 100:
                synth = generate_synthetic_complaints(2000 - len(df))
                df = pd.concat([df, synth], ignore_index=True)
            return df
    except Exception as exc:
        logger.warning("Could not load from DB: %s. Using synthetic data.", exc)
        return generate_synthetic_complaints(2000)


def run_training_pipeline(
    source: str = "synthetic",
    sample_size: int = 10000,
    models: Optional[List[str]] = None,
    version: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Synchronous training execution entrypoint.
    Trains requested models, updates disk artifacts, and hot-swaps them into ModelRegistry.
    """
    start_time = time.time()
    t_version = version or f"v{datetime.utcnow().strftime('%Y%m%d.%H%M')}"
    target_models = models or ["xgboost_aml", "xgboost_location", "rf_risk", "kmeans_hotspot"]
    trained_metrics = {}
    registry = ModelRegistry()

    hw_info = detect_hardware()
    xgb_dev = hw_info.get("xgboost_device", "cpu")
    xgb_tree = hw_info.get("xgboost_tree_method", "hist")
    logger.info(
        "Starting training pipeline [source=%s, samples=%d, version=%s, hw_device=%s]",
        source,
        sample_size,
        t_version,
        xgb_dev,
    )

    # 1. Load Data
    if source == "database":
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # In async context: run via thread or direct
                import nest_asyncio
                nest_asyncio.apply()
                df_complaints = loop.run_until_complete(load_db_complaints())
            else:
                df_complaints = asyncio.run(load_db_complaints())
        except Exception:
            df_complaints = generate_synthetic_complaints(min(sample_size, 5000))
    else:
        df_complaints = generate_synthetic_complaints(min(sample_size, 5000))

    df_aml = generate_synthetic_aml_transactions(sample_size)

    # --- Train 1: HotspotDetector (KMeans) ---
    if "kmeans_hotspot" in target_models:
        logger.info("Fitting HotspotDetector (kmeans)...")
        hd = HotspotDetector()
        coords = df_complaints[["lat", "lng"]].values
        n_clusters = min(8, max(2, len(coords) // 50))
        hd.kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10).fit(coords)
        hd.cluster_info = [
            {"label": i, "count": int((hd.kmeans.labels_ == i).sum())}
            for i in range(n_clusters)
        ]
        hd_path = ARTIFACTS_DIR / "kmeans_hotspot.pkl"
        joblib.dump({"model": hd, "version": t_version}, hd_path)
        registry.hot_swap("kmeans_hotspot", hd, t_version)
        trained_metrics["kmeans_hotspot"] = {
            "clusters": n_clusters,
            "samples": len(coords),
            "inertia": round(float(hd.kmeans.inertia_), 2),
            "status": "trained",
        }

    # --- Train 2: CashoutLocationPredictor (XGBoost Location) ---
    if "xgboost_location" in target_models:
        logger.info("Fitting CashoutLocationPredictor (xgboost_location) on %s...", xgb_dev)
        predictor = CashoutLocationPredictor(device=xgb_dev, tree_method=xgb_tree)
        X_loc = np.column_stack([
            df_complaints["amount"].values,
            df_complaints["lat"].values,
            df_complaints["lng"].values,
            np.random.rand(len(df_complaints)),
        ])
        y_loc = df_complaints["city"].values
        predictor.fit(X_loc, y_loc)
        loc_path = ARTIFACTS_DIR / "xgboost_location.pkl"
        joblib.dump({"model": predictor, "version": t_version}, loc_path)
        registry.hot_swap("xgboost_location", predictor, t_version)
        trained_metrics["xgboost_location"] = {
            "samples": len(df_complaints),
            "classes": len(np.unique(y_loc)),
            "device": xgb_dev,
            "status": "trained",
        }

    # --- Train 3: RiskLevelClassifier (Random Forest) ---
    if "rf_risk" in target_models:
        logger.info("Fitting RiskLevelClassifier (rf_risk)...")
        clf = RiskLevelClassifier()
        X_risk = np.column_stack([
            df_complaints["amount"].values,
            df_complaints["lat"].values,
            df_complaints["lng"].values,
        ])
        y_risk = df_complaints["risk_level"].map(
            {"critical": 0, "high": 0, "medium": 1, "low": 2}
        ).fillna(1).astype(int).values
        clf.fit(X_risk, y_risk)
        risk_path = ARTIFACTS_DIR / "rf_risk.pkl"
        joblib.dump({"model": clf, "version": t_version}, risk_path)
        registry.hot_swap("rf_risk", clf, t_version)
        trained_metrics["rf_risk"] = {
            "samples": len(df_complaints),
            "estimators": 50,
            "status": "trained",
        }

    # --- Train 4: AML Laundering Classifier (XGBoost AML) ---
    if "xgboost_aml" in target_models:
        logger.info("Fitting AmlLaunderingClassifier (xgboost_aml) on %s...", xgb_dev)
        aml_model = AmlLaunderingClassifier(
            n_estimators=60,
            max_depth=5,
            learning_rate=0.08,
            device=xgb_dev,
            tree_method=xgb_tree,
            random_state=42,
        )
        aml_model.fit(df_aml, df_aml["Is Laundering"])
        
        # Test evaluation on small synthetic holdout
        holdout = generate_synthetic_aml_transactions(1000)
        preds = aml_model.predict(holdout)
        probs = aml_model.predict_proba(holdout)[:, 1]
        y_true = holdout["Is Laundering"].values
        
        accuracy = float((preds == y_true).mean())
        laundering_detected = int((preds == 1).sum())
        
        aml_path = ARTIFACTS_DIR / "xgboost_aml.pkl"
        joblib.dump({"model": aml_model, "version": t_version}, aml_path)
        registry.hot_swap("xgboost_aml", aml_model, t_version)
        
        aml_metrics = {
            "version": t_version,
            "training_samples": len(df_aml),
            "test_accuracy": round(accuracy, 4),
            "laundering_cases_flagged": laundering_detected,
            "feature_importances": aml_model.get_feature_importance(),
            "device": xgb_dev,
            "status": "trained",
        }
        trained_metrics["xgboost_aml"] = aml_metrics

        # Persist metrics file
        with open(ARTIFACTS_DIR / "xgboost_aml_metrics.json", "w") as f:
            json.dump({
                "model": "xgboost_aml",
                "version": t_version,
                "trained_at": datetime.utcnow().isoformat(),
                "metrics": aml_metrics,
                "hardware": hw_info,
            }, f, indent=2)

    # Persist artifact manifest
    manifest_data = {
        "artifacts": [f"{m}.pkl" for m in target_models],
        "version": t_version,
        "last_trained": datetime.utcnow().isoformat(),
        "source": source,
        "sample_size": sample_size,
        "hardware": hw_info,
    }
    with open(ARTIFACTS_DIR / "artifact_manifest.json", "w") as f:
        json.dump(manifest_data, f, indent=2)

    duration = round(time.time() - start_time, 2)
    logger.info("Training pipeline finished in %.2fs. All models hot-swapped.", duration)

    return {
        "status": "success",
        "version": t_version,
        "duration_seconds": duration,
        "source": source,
        "sample_size": sample_size,
        "models_trained": list(trained_metrics.keys()),
        "metrics": trained_metrics,
        "hardware": hw_info,
        "timestamp": datetime.utcnow().isoformat(),
    }
