#!/usr/bin/env python3
"""
scripts/train_synthetic_models.py
Generates all real .pkl artifacts locally (~5-10 sec) using synthetic data.
Detects NVIDIA and AMD GPUs, CUDA cores, VRAM, and configures hardware acceleration.
Requires: scikit-learn, numpy, joblib, xgboost, pandas, psutil.
No external dataset files needed.
"""

import json
import os
import random
import sys
import time
from datetime import datetime
import numpy as np

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath("backend"))
sys.path.insert(0, os.path.abspath("."))

from pathlib import Path
from app.ml.hardware import detect_hardware, print_hardware_summary

# Resolve artifacts directory properly whether running on host or inside container
if (Path.cwd() / "app" / "ml").exists():
    ARTIFACT_DIR = Path.cwd() / "app" / "ml" / "model_artifacts"
elif (Path.cwd() / "backend" / "app" / "ml").exists():
    ARTIFACT_DIR = Path.cwd() / "backend" / "app" / "ml" / "model_artifacts"
else:
    ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "backend" / "app" / "ml" / "model_artifacts"

ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

def log(msg: str):
    print(f"  {msg}")

# --- Hardware Acceleration Audit ---
hw = detect_hardware()
print_hardware_summary(hw)

xgb_dev = hw.get("xgboost_device", "cpu")
xgb_tree = hw.get("xgboost_tree_method", "hist")
log(f"Using XGBoost device: {xgb_dev} (tree_method={xgb_tree})")
log(f"Artifacts output directory: {ARTIFACT_DIR}")

# --- 1. Synthetic complaints ---
log("Synthesizing 5,000 cyber fraud complaints ...")
n = 5000
names = ["Ravi Shankar", "Priya Mehta", "Amit Patil", "Sunita Rao", "Vikram Joshi"] * 1000
cities = [
    ("Mumbai", 19.0760, 72.8777),
    ("Delhi", 28.6139, 77.2090),
    ("Bengaluru", 12.9716, 77.5946),
    ("Pune", 18.5204, 73.8567),
]
banks = ["SBI", "HDFC", "ICICI", "Axis"]
complaints = []
for i in range(n):
    c = random.choice(cities)
    complaints.append({
        "id": i + 1,
        "name": random.choice(names),
        "amount": round(random.uniform(5000, 500000), 2),
        "bank": random.choice(banks),
        "city": c[0],
        "lat": c[1] + np.random.normal(0, 0.02),
        "lng": c[2] + np.random.normal(0, 0.02),
        # Must match app.models.prediction.RiskLevel exactly — the RF model's
        # predicted class is persisted verbatim into a Postgres enum column,
        # so an unrecognized label (e.g. the old "high_risk") fails at
        # prediction time with "invalid input value for enum risklevel".
        "label": random.choice(["low", "medium", "high", "critical"]),
    })
log(f"Created {len(complaints)} synthetic complaints.")

# --- 2. HotspotDetector (kmeans) ---
log("Fitting HotspotDetector (kmeans) ...")
from sklearn.cluster import KMeans
from app.ml.kmeans_hotspot import HotspotDetector
import joblib

hd = HotspotDetector()
coords = np.array([[c["lat"], c["lng"]] for c in complaints])
hd.kmeans = KMeans(n_clusters=8, random_state=42, n_init=10).fit(coords)
hd.cluster_info = [{"label": i, "count": int((hd.kmeans.labels_ == i).sum())} for i in range(8)]
joblib.dump(hd, os.path.join(ARTIFACT_DIR, "kmeans_hotspot.pkl"))
log("Exported kmeans_hotspot.pkl")

# --- 3 & 4. CashoutLocationPredictor (xgboost) + RiskLevelClassifier (rf) ---
# Both are built from the SAME FeatureEngineer.create_feature_matrix() pipeline
# that PredictionService uses at inference time (app/services/prediction_service.py).
# Building ad-hoc feature arrays here (as this script used to) silently
# produces artifacts with a different column count/order than what real
# inference sends the model, which fails hard at request time (e.g. "Feature
# shape mismatch, expected: 4, got 17") or — worse — succeeds with mismatched
# columns and returns wrong predictions with no error at all. Do not
# reintroduce a hand-rolled feature array for these two models.
log("Building the 17-column feature matrix via FeatureEngineer (matches inference) ...")
import pandas as pd
from datetime import timedelta
from sklearn.model_selection import train_test_split

from app.ml.feature_engineering import FEATURE_NAMES, FeatureEngineer
from app.ml.random_forest_model import RiskLevelClassifier
from app.ml.xgboost_model import CashoutLocationPredictor

complaint_rows = []
for c in complaints:
    complaint_rows.append({
        "timestamp": datetime.utcnow() - timedelta(
            days=random.randint(0, 90), hours=random.randint(0, 23)
        ),
        "lat": c["lat"],
        "lng": c["lng"],
        "complaint_text": f"Fraud complaint involving {c['bank']} reported near {c['city']}.",
        "amount": c["amount"],
        "state": c["city"],
        "district": c["city"],
        "category": "other",
        "bank_name": c["bank"],
        "cluster_id": c["city"],
        "risk_level": c["label"],
    })
complaints_df = pd.DataFrame(complaint_rows)

fe = FeatureEngineer()
fe.fit_atm_tree(complaints_df[["lat", "lng"]].drop_duplicates().reset_index(drop=True))
X = fe.create_feature_matrix(complaints_df, is_training=True)
y_cluster = complaints_df["cluster_id"].values
y_risk = complaints_df["risk_level"].values

idx = np.arange(X.shape[0])
train_idx, val_idx = train_test_split(idx, test_size=0.2, random_state=42)

log(f"Fitting CashoutLocationPredictor (xgboost_location) on {xgb_dev} ...")
predictor = CashoutLocationPredictor(device=xgb_dev, tree_method=xgb_tree)
predictor.train(
    X[train_idx], y_cluster[train_idx], X[val_idx], y_cluster[val_idx],
    feature_names=FEATURE_NAMES,
)
joblib.dump(predictor, os.path.join(ARTIFACT_DIR, "xgboost_location.pkl"))
log("Exported xgboost_location.pkl")

log("Fitting RiskLevelClassifier (rf_risk) ...")
clf = RiskLevelClassifier()
clf.train(X[train_idx], y_risk[train_idx])
joblib.dump(clf, os.path.join(ARTIFACT_DIR, "rf_risk.pkl"))
log("Exported rf_risk.pkl")

# --- 5. AML transactions + xgboost_aml ---
log("Synthesizing 10,000 AML transactions ...")
import pandas as pd

aml_data = []
currencies = ["Rupee", "US Dollar", "Euro", "UK Pound", "Bitcoin"]
formats = ["Cash", "Cheque", "ACH", "Credit Card", "Wire", "Bitcoin", "Reinvestment"]

for i in range(10000):
    amt = round(random.uniform(10000, 1000000), 2)
    amt_in = round(random.uniform(5000, amt), 2)
    is_laundering = random.random() < 0.15
    aml_data.append({
        "Timestamp": datetime.utcnow().strftime("%Y/%m/%d %H:%M"),
        "From Bank": random.choice(banks),
        "Account": f"ACC{random.randint(10000,99999)}",
        "To Bank": random.choice(banks),
        "Account.1": f"ACC{random.randint(10000,99999)}",
        "Amount Received": amt_in,
        "Receiving Currency": random.choice(currencies),
        "Amount Paid": amt,
        "Payment Currency": random.choice(currencies),
        "Payment Format": random.choice(formats),
        "Is Laundering": int(is_laundering),
    })
df = pd.DataFrame(aml_data)

log(f"Fitting AmlLaunderingClassifier on {xgb_dev} ...")
from app.ml.aml_xgboost_model import AmlLaunderingClassifier

aml_model = AmlLaunderingClassifier(
    n_estimators=50,
    max_depth=5,
    learning_rate=0.08,
    device=xgb_dev,
    tree_method=xgb_tree,
    random_state=42,
)
aml_model.fit(df, df["Is Laundering"])
joblib.dump(aml_model, os.path.join(ARTIFACT_DIR, "xgboost_aml.pkl"))
log("Exported xgboost_aml.pkl")

# --- Metrics + manifest ---
metrics = {
    "generated_at": datetime.utcnow().isoformat(),
    "synthetic_synthesis": True,
    "samples_complaints": n,
    "samples_aml": len(df),
    "models": ["kmeans_hotspot", "xgboost_location", "rf_risk", "xgboost_aml"],
    "hardware": {
        "os": hw.get("os"),
        "cpu_count": hw.get("cpu_count"),
        "gpus": hw.get("gpus", []),
        "xgboost_device": xgb_dev,
        "xgboost_tree_method": xgb_tree,
    },
}
with open(os.path.join(ARTIFACT_DIR, "xgboost_aml_metrics.json"), "w", encoding="utf-8") as f:
    json.dump(metrics, f, indent=2)

with open(os.path.join(ARTIFACT_DIR, "artifact_manifest.json"), "w", encoding="utf-8") as f:
    json.dump({
        "artifacts": [
            "kmeans_hotspot.pkl",
            "xgboost_location.pkl",
            "rf_risk.pkl",
            "xgboost_aml.pkl",
        ],
        "generated": datetime.utcnow().isoformat(),
        "synthetic_only": True,
        "hardware": metrics["hardware"],
    }, f, indent=2)

log("Wrote xgboost_aml_metrics.json + artifact_manifest.json with hardware details")
log(f"Training complete! All artifacts saved to {ARTIFACT_DIR}")
