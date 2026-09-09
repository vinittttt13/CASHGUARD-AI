# 🛡️ Technical Audit: ML Pipeline & Feature Engineering

| Audit Scope | Severity | Affected Files | Status |
| :--- | :--- | :--- | :--- |
| **Prediction / Inference** | `🔴 CRITICAL` | `backend/app/api/v1/predict.py` (L45-65) | ⚠️ Action Required |
| **Feature Engineering** | `🟠 HIGH` | `backend/app/ml/feature_engineering.py` (L86) | ⚠️ Action Required |
| **Model Training** | `🟠 HIGH` | `backend/app/ml/train.py` (L56-57) | ⚠️ Action Required |
| **SHAP Explainability** | `🟠 HIGH` | `backend/app/ml/shap_explainer.py` | ⚠️ Action Required |
| **Spatial Clustering** | `🟡 MEDIUM` | `backend/app/ml/kmeans_hotspot.py` (L12) | ⚠️ Review Needed |

---

## 1. Executive Summary

The CASHGUARD-AI ML pipeline is documented extensively but not implemented: `predict.py` returns hard-coded mock predictions instead of invoking `FeatureEngineer` or `ModelRegistry`, and `feature_engineering.py` leaks target statistics via `rank(pct=True)` across the full dataset. Combined with missing SHAP caching and independent train/test splits, the pipeline produces unreliable, unvalidated outputs that cannot support law-enforcement decisions.

---

## 2. Identified Flaws & Vulnerabilities

### 2.1 Mock Prediction Endpoint — Critical Data Integrity Failure
- **Severity**: `CRITICAL`
- **Affected File(s)**: `backend/app/api/v1/predict.py` (Lines 45-65, 77-92); `backend/app/services/prediction_service.py` (Lines 15-34)
- **Root Cause Analysis**: The endpoint constructs a `Prediction` object with literal constants (`confidence_score=0.85`, `atm_name="Predicted ATM"`, `risk_level="high"`). The `batch_predict` handler never executes `BackgroundTasks`; `PredictionService.predict` returns an identical hard-coded dict.
- **Potential Impact**: All fraud predictions are fabricated. Law enforcement actions based on `predicted_latitude` / `predicted_longitude` would be misdirected. Batch processing never runs.

#### Proposed Code Fix / Implementation
```python
# backend/app/api/v1/predict.py — Before (L45-65)
new_prediction = Prediction(
    id=uuid.uuid4(),
    complaint_id=pred_request.complaint_id,
    predicted_latitude=complaint.latitude or 28.6139,  # MOCK
    predicted_longitude=complaint.longitude or 77.2090,  # MOCK
    confidence_score=0.85,  # MOCK
    ...
)

# After — Real inference with SHAP and registry
from app.ml.feature_engineering import FeatureEngineer
from app.ml.model_registry import ModelRegistry
from app.ml.shap_explainer import SHAPExplainer

# 1. Load features
fe = FeatureEngineer()
features = fe.extract_features(complaint)  # 17-dim vector

# 2. Model inference
registry = ModelRegistry()
model = registry.get('xgboost_location')
predictions = model.predict_top_k(features.reshape(1, -1), k=5)

# 3. SHAP (cached)
explainer = SHAPExplainer(model, fe.FEATURE_NAMES)
shap_vals = explainer.explain_prediction(features.reshape(1, -1))

# 4. Persist
new_prediction = Prediction(
    complaint_id=pred_request.complaint_id,
    predicted_latitude=predictions[0][0][1],
    confidence_score=float(predictions[0][0][1]),
    predicted_locations=[{"lat": p[0], "lng": p[1], "atm_name": p[2], "confidence": p[3]} for p in predictions[0]],
    feature_importance=[{"feature": k, "value": float(v)} for k, v in shap_vals.items()],
    ...
)
```

---

### 2.2 Feature-Engineering Data Leakage (Percentile Computation)
- **Severity**: `HIGH`
- **Affected File(s)**: `backend/app/ml/feature_engineering.py` (Line 86)
- **Root Cause Analysis**: `amount_percentile = df['amount'].rank(pct=True)` is computed on the full dataframe before `train_test_split`. This leaks the global amount distribution into both training and validation feature matrices.
- **Potential Impact**: Validation metrics are inflated; model performance degrades on real-world data that differs from the training distribution.

#### Proposed Code Fix / Implementation
```python
# Before — full-dataset percentile (L86)
df['amount_percentile'] = df['amount'].rank(pct=True)

# After — split-safe percentile using training statistics only
from sklearn.preprocessing import QuantileTransformer

# Train split
train_df = df.iloc[train_idx].copy()
transformer = QuantileTransformer(output_distribution='uniform', random_state=42)
train_df['amount_percentile'] = transformer.fit_transform(train_df[['amount']])

# Apply same bins to validation / test / inference
val_df = df.iloc[val_idx].copy()
val_df['amount_percentile'] = transformer.transform(val_df[['amount']])
```

---

### 2.3 Independent Train/Test Splits — Label Mismatch Risk
- **Severity**: `HIGH`
- **Affected File(s)**: `backend/app/ml/train.py` (Lines 56-57)
- **Root Cause Analysis**: `train_test_split(X, y_cluster, ...)` and `train_test_split(X, y_risk, ...)` use independent random seeds (default `random_state` not fixed identically), so the row indices can diverge between cluster-label and risk-label splits.
- **Potential Impact**: A single feature row may have a cluster label from split A but a risk label from split B, corrupting multi-output evaluation.

#### Proposed Code Fix / Implementation
```python
# Before — independent splits (L56-57)
X_train, X_val, y_cluster_train, y_cluster_val = train_test_split(X, y_cluster, test_size=0.2, random_state=42)
_, _, y_risk_train, y_risk_val = train_test_split(X, y_risk, test_size=0.2, random_state=42)

# After — synchronized single split
from sklearn.model_selection import train_test_split
X_train, X_val, y_cluster_train, y_cluster_val, y_risk_train, y_risk_val = train_test_split(
    X, y_cluster, y_risk, test_size=0.2, random_state=42, stratify=y_risk
)
```

---

### 2.4 Label Encoder Leakage & Unseen Category Failure
- **Severity**: `HIGH`
- **Affected File(s)**: `backend/app/ml/feature_engineering.py` (Lines 88-105)
- **Root Cause Analysis**: `LabelEncoder.fit_transform()` on full data embeds unseen-state mappings into the encoder; inference applies `le.transform([x])` which throws `KeyError` for new states/districts, defaulting to 0 instead of a safe unknown-handling strategy.
- **Potential Impact**: Production predictions crash or return incorrect encoded values for new jurisdictions.

#### Proposed Code Fix / Implementation
```python
# Before — LabelEncoder with no unknown handling (L96-104)
le = LabelEncoder()
df[f'{c}_encoded'] = le.fit_transform(df[c])  # leaks full distribution

# After — OneHotEncoder with unknown handling
from sklearn.preprocessing import OneHotEncoder
enc = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
enc.fit(train_df[[c]])
df[f'{c}_encoded'] = enc.transform(df[[c]]).tolist()
```

---

### 2.5 SHAP Runtime Overhead — No Caching, No Approximation
- **Severity**: `HIGH`
- **Affected File(s)**: `backend/app/ml/shap_explainer.py` (Lines 15, 25, 37)
- **Root Cause Analysis**: `TreeExplainer` computes exact Shapley values for every instance; no `approximate=True`, no Redis caching layer in `predict.py`.
- **Potential Impact**: Single prediction blocked by 100-500ms SHAP computation; real-time feed degraded.

#### Proposed Code Fix / Implementation
```python
# After — Cached SHAP in predict.py
from app.core.redis_client import cache_get, cache_set

shap_key = f"shap:{pred_request.complaint_id}"
cached_shap = await cache_get(shap_key) if not pred_request.force_refresh else None

if cached_shap:
    feature_importance = cached_shap
else:
    explainer = SHAPExplainer(model, FEATURE_NAMES)
    feature_importance = explainer.explain_prediction(feature_matrix)
    await cache_set(shap_key, feature_importance, ttl=3600)
```

---

### 2.6 KDTree Euclidean Approximation on Lat/Lng Degrees
- **Severity**: `MEDIUM`
- **Affected File(s)**: `backend/app/ml/feature_engineering.py` (L42-43, L65-70); `backend/app/services/geospatial_service.py` (L11)
- **Root Cause Analysis**: `KDTree` uses Euclidean metric on raw latitude/longitude (degrees). At ~20°N, 1° lat ≈ 111km, 1° lng ≈ 104km — distances are distorted. `find_nearest_atms` returns mock data (`[{"location":"ATM 1","distance_km":1.2}]`).
- **Potential Impact**: Nearest-ATM distance estimates are inaccurate; heatmap clustering based on Euclidean degrees misplaces hotspots.

#### Proposed Code Fix / Implementation
```python
# Before — Euclidean KDTree on degrees (L42-43)
self.atm_tree = KDTree(self.atm_coords, metric='euclidean')

# After — Projected or haversine-aware (documented approximation)
from sklearn.neighbors import KDTree
# Option A: Use scipy.spatial.cKDTree with custom haversine metric (complex)
# Option B: Document approximation; use projected UTM for production accuracy
coords_utm = project_to_utm(self.atm_coords)  # custom projection
self.atm_tree = KDTree(coords_utm, metric='euclidean')
dist_utm = self.atm_tree.query(coords_utm, k=1)
# Convert back to km using UTM scale factor
```

---

### 2.7 DBSCAN Distance Units Undocumented
- **Severity**: `MEDIUM`
- **Affected File(s)**: `backend/app/ml/kmeans_hotspot.py` (Line 9)
- **Root Cause Analysis**: `DBSCAN(eps=0.01)` operates on lat/lng degrees; `0.01° ≈ 1.1km` at Indian latitudes but is never documented or adjusted for latitude.
- **Potential Impact**: Cluster density thresholds are geography-dependent and not reproducible across regions.

---

## 3. Severity Matrix & Priority Queue

| Priority | Issue | Effort | Dependency |
|---|---|---|---|
| P0 | Mock prediction endpoint | 4h | `predict.py`, `ModelRegistry` |
| P0 | Feature leakage (percentile) | 2h | `feature_engineering.py` |
| P1 | SHAP caching / approximation | 3h | `shap_explainer.py`, Redis |
| P1 | Independent split fix | 1h | `train.py` |
| P2 | LabelEncoder → OneHotEncoder | 3h | `feature_engineering.py` |
| P2 | KDTree projection / docs | 2h | `feature_engineering.py` |
| P3 | DBSCAN eps documentation | 30m | `kmeans_hotspot.py` |

---

*Audit completed: 2026-09-10 | Auditor: Principal Software Architect / Staff ML Engineer*
