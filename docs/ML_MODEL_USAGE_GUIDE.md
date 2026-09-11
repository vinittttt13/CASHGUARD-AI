# Where Machine Learning Models Are Used in CASHGUARD-AI

This guide details exactly where, how, and which machine learning models are executed across the CASHGUARD-AI interface, including step-by-step instructions for live interactive testing.

---

## Quick Reference: Model-to-UI Mapping

| Page / Component | URL Path | Models Utilized | What You See On-Screen |
| :--- | :--- | :--- | :--- |
| **Interactive AML Simulator** | `/analytics` | `xgboost_aml.pkl`, `SHAP` | Real-time laundering risk scoring, probability %, and explainability drivers. |
| **Incident Threat Triage** | `/dashboard` | `rf_risk.pkl`, `xgboost_location.pkl` | Automated incident severity rating and predicted Indian ATM cashout city hubs. |
| **Geospatial Hotspot Map** | `/dashboard` | `kmeans_hotspot.pkl` | Clustered hot zones, coordinate centroids, and police dispatch density radiuses. |
| **Investigation Dossier Modal** | `/intelligence` | All Models + `SHAP` | Court-admissible dossier with Section 4 Chain of Custody & Algorithmic Disclosure. |
| **AI Engine & Model Registry** | `/settings` | `ModelRegistry`, Hardware Audit | Live model health status, NVIDIA/AMD GPU diagnostics, and 1-click zero-downtime retraining. |

---

## 1. Interactive AML Transaction Classifier (`/analytics`)

**Model Used**: `xgboost_aml.pkl` (XGBoost v2.0 Binary Logistic Classifier + SHAP TreeExplainer)

This is the most direct, hands-on module for testing real-time ML inference:

### Step-by-Step Walkthrough:
1. Navigate to **Analytics** (`/analytics`) in the sidebar.
2. Scroll down to the **"Real-Time AML Transaction Simulator"** card.
3. Choose one of the pre-configured **Quick Test Scenarios**:
   - 🔴 **Scenario 1: ATM Smurfing / High-Risk Cash Out** (`₹4,85,000`, `Cash`, `State Bank of India`)
   - 🟠 **Scenario 2: Cross-Border Crypto Laundering** (`$12,50,000`, `Bitcoin`, `Offshore Bank Ltd`)
   - 🟢 **Scenario 3: Normal Corporate Payroll** (`₹45,000`, `ACH`, `HDFC Bank`)
4. Click **"Evaluate Transaction Risk"**.

### What the Model Returns:
- **Laundering Probability**: e.g., `94.2%` laundering confidence.
- **Severity Badge**: Dynamically labeled as `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`.
- **Decision Threshold**: Compared against the strict `0.50` decision boundary.
- **Explainable AI (SHAP) Drivers**: Interactive breakdown highlighting the primary risk indicators:
  - `amount_diff`: Discrepancy between amount sent and amount received.
  - `is_cashout_format`: High velocity payment format (Cash / Crypto / Wire).
  - `payment_format_code`: Transaction complexity tier.
  - `amount_paid`: Structured transaction volume.

---

## 2. Live Incident Risk Scoring & Location Prediction (`/dashboard`)

**Models Used**:
- `rf_risk.pkl` (Random Forest Classifier — 50 Trees)
- `xgboost_location.pkl` (XGBoost Multi-Class Softprob)

On the primary **Executive Command Center** (`/dashboard`):

### What Happens in the Background:
As new cybercrime reports arrive from 1930 / NCRP or the simulated feed, the backend triggers inference via `POST /api/v1/predict`:

1. **Severity Risk Classification**:
   - `rf_risk.pkl` analyzes the reported loss, incident velocity, and victim telemetry.
   - Assigns a prioritized badge (`Critical`, `High`, `Medium`, or `Low`).
2. **ATM Cashout Location Prediction**:
   - `xgboost_location.pkl` evaluates withdrawal patterns against 10 Indian financial corridors.
   - Calculates ranked probabilities for likely cashout cities (e.g., `Mumbai Hub - 87% confidence`, `Pune Hub - 74% confidence`).
3. **Analyst Review**:
   - Displayed in the right-hand **"Latest Incident Threat Triage"** panel with confidence scores and top predictive factors.

---

## 3. Geospatial Hotspot Clusters on the Operations Map (`/dashboard`)

**Model Used**: `kmeans_hotspot.pkl` (Unsupervised Spatial K-Means)

On the left-hand **Geospatial Threat & Hotspot Map** (`/dashboard`):

### How the Model Operates:
1. Coordinates of incoming incidents are fed into `kmeans_hotspot.pkl`.
2. The model fits centroid coordinates to discover geographic cluster centers across Indian states.
3. Density radiuses are computed to define physical perimeter boundaries for police patrol units and bank security alerts.
4. Clicking any cluster marker displays the district name, active threat count, and geographic coordinates.

---

## 4. Law Enforcement Investigation Dossier (`/intelligence`)

**Models Used**: All pipeline models (`xgboost_location`, `kmeans_hotspot`, `rf_risk`, `SHAP`)

1. Navigate to **Intelligence** (`/intelligence`) in the sidebar.
2. Click any incident row in the active feed to open the **Investigation Dossier Modal**.

### AI Sections Inside the Dossier:
- **Section 2 — Predicted Cashout Locations & ATMs**:
  - Displays top predicted cities, suspected ATM coordinates, and confidence percentages from `xgboost_location`.
- **Section 3 — Identified Geospatial Hotspot Clusters**:
  - Displays cluster IDs and containment radiuses from `kmeans_hotspot`.
- **Section 4 — Chain of Custody & Algorithmic Disclosure**:
  - Formatted specifically for court evidence admissibility under **Section 65B of the Indian Evidence Act**.
  - Discloses exact model versions (`XGBoost v2.0`, `SHAP v0.45`, `KMeans`), timestamp, and investigating officer credentials.
  - Includes a 1-click **"Print Dossier"** button for official law enforcement export.

---

## 5. Live Model Registry & Zero-Downtime Retraining (`/settings`)

**Models Used**: Complete Pipeline Registry + Hardware Diagnostic Engine

1. Navigate to **Settings** (`/settings`) in the sidebar.
2. Select the **"AI & Machine Learning Engine"** tab.

### Features Available:
1. **Active Model Registry**:
   - Real-time health cards for all models showing active version tags (e.g. `v20260911.1828`) and test accuracy (`88.0%`).
2. **Hardware Acceleration & GPU Diagnostic**:
   - Shows detected hardware (`NVIDIA GeForce GTX 1650` with `~896 CUDA Cores`, `AMD Radeon Graphics`, and `12 OpenMP CPU Cores`).
3. **On-Demand Model Retraining**:
   - Choose data source: `Synthetic Generator` or `PostgreSQL Database`.
   - Choose sample size: `3,000`, `5,000`, `10,000`, or `25,000` samples.
   - Click **"Train & Hot-Swap Models Now"**.
   - Models retrain live and are immediately hot-swapped in memory with **zero downtime**.
