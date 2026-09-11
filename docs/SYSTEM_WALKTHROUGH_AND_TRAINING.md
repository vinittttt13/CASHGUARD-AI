# CASHGUARD-AI / CPAF — End-to-End System Walkthrough & ML Training Guide

## 📌 Executive Overview

**CASHGUARD-AI (Cybercrime Predictive Analytics Framework - CPAF)** is an enterprise-grade cyber fraud intelligence and anti-money laundering (AML) predictive analytics platform. It unifies high-performance gradient boosting, deep spatial clustering, transaction graph analysis, and instant police dossier synthesis to disrupt cyber extortion, digital arrest scams, mule account networks, and ATM cashout nodes across India.

This guide provides a comprehensive start-to-finish walkthrough of:
1. **System Architecture & Hardware Acceleration** (NVIDIA CUDA, AMD Radeon, OpenMP CPU multi-threading).
2. **1-Click ML Model Training** (Windows `.bat`, PowerShell `.ps1`, Linux/macOS `.sh`, and Python).
3. **On-Demand Retraining & Live Zero-Downtime Hot-Swapping** via the Settings Web UI.
4. **End-to-End Module Navigation** (Executive Dashboard, Analytics, Alerts, Intelligence, Dossiers).
5. **Remote GPU Workstation Setup** for full 40GB IBM AML Dataset training.

---

## ⚡ Hardware Acceleration & GPU Diagnostic Engine

CASHGUARD-AI includes an automated cross-platform hardware audit engine ([`backend/app/ml/hardware.py`](file:///i:/vinit%20SIH/CASHGUARD-AI/backend/app/ml/hardware.py)) that inspects compute topology on startup and dynamically tunes model hyper-parameters.

### Supported Compute Hardware

| Hardware Vendor | Detection Methods | Supported Accelerations | Automatic Core Calculation |
| :--- | :--- | :--- | :--- |
| **NVIDIA GeForce / RTX / Tesla** | `nvidia-smi`, PyTorch CUDA, Windows WMI | CUDA 11.x/12.x, `tree_method="hist"`, `device="cuda"` | Yes (~896 CUDA cores for GTX 1650, lookup table for Turing, Ampere, Ada, Hopper) |
| **AMD Radeon Graphics** | Windows WMI, ROCm `rocm-smi`, Linux `/dev/kfd` | OpenCL, ROCm HIP, Shared VRAM reporting | Yes (VRAM & Driver identification) |
| **Multi-Core CPUs** | Python `os.cpu_count()`, OpenMP | Multi-threaded vectorized BLAS, `n_jobs=cpu_count` | Yes (12 logical cores on test benchmark) |

### Sample Diagnostic Output
When running any training script or querying the API, the system automatically prints:

```text
========================================================================
 [*] CASHGUARD-AI HARDWARE ACCELERATION DIAGNOSTIC
========================================================================
 OS: Windows 10 / 11 (AMD64)
 CPU: 12 Logical Cores (OpenMP multi-threading enabled)
 GPUs Detected: 2
  [0] NVIDIA GeForce GTX 1650 (Driver 616.64)
      Vendor: NVIDIA | VRAM: 4,096 MB | ~896 CUDA Cores
  [1] AMD Radeon(TM) Graphics (Driver 31.0.21924.61)
      Vendor: AMD | VRAM: 1,024 MB
 ML Acceleration: NVIDIA CUDA (tree_method='hist', device='cuda')
========================================================================
```

---

## 🎯 1-Click ML Model Training

No manual setup or complex command memorization is required. CASHGUARD-AI includes dedicated 1-click training scripts in the root and `scripts/` directory.

### Option 1: Double-Click on Windows (Batch)
In the project root directory, double-click:
```text
train_models.bat
```
or run from PowerShell / Command Prompt:
```cmd
scripts\train_models.bat
```
**What this script does automatically:**
1. Verifies Python 3.10+ in PATH.
2. Checks for or initializes `.venv` virtual environment.
3. Automatically installs required dependencies from `requirements.txt`.
4. Runs hardware detection to locate NVIDIA GPUs and calculate CUDA cores.
5. Trains all four ML models in parallel (~5 to 10 seconds).
6. Exports serialized model artifacts (`.pkl`) and metadata manifests to `backend/app/ml/model_artifacts/`.

### Option 2: PowerShell 1-Click Script
```powershell
.\scripts\train_models.ps1
```

### Option 3: Linux / macOS Shell Script
```bash
chmod +x scripts/train_models.sh
./scripts/train_models.sh
```

### Option 4: Inside Running Docker Container
If the Docker stack is already running:
```bash
docker exec cpaf_backend python scripts/train_synthetic_models.py
```

### Option 5: Direct Python Command
```bash
python scripts/train_synthetic_models.py
```

---

## 🤖 Trained Machine Learning Models

The training pipeline generates and validates four production machine learning models:

| Model ID | Architecture | Artifact File | Purpose |
| :--- | :--- | :--- | :--- |
| **`xgboost_aml`** | XGBoost 2.0 Binary Logistic | `xgboost_aml.pkl` | Analyzes transaction graph patterns, rapid cash-out velocities, and currency structurings to detect money laundering. |
| **`xgboost_location`** | XGBoost Multi-class Softprob | `xgboost_location.pkl` | Predicts probable physical ATM withdrawal hubs and cities across 10 Indian metropolitan centers. |
| **`rf_risk`** | Random Forest Balanced Ensemble | `rf_risk.pkl` | Categorizes incoming cyber fraud incidents into Critical, High, Medium, or Low severity priority tiers. |
| **`kmeans_hotspot`** | Geospatial K-Means Clustering | `kmeans_hotspot.pkl` | Calculates centroid coordinates and density radiuses for police dispatch and hot-zone containment. |

---

## 🌐 Live Retraining via Web UI (Zero Downtime)

CASHGUARD-AI features hot-swappable in-memory model retraining directly from the web browser:

1. Open your browser and navigate to:
   - Local: `http://localhost:3000/settings`
   - Public Ngrok: `https://<your-ngrok-subdomain>.ngrok-free.app/settings`
2. Click the **"AI & Machine Learning Engine"** tab.
3. **Inspect Hardware Status:**
   - Review the **Hardware Acceleration & GPU Diagnostic** card.
   - Confirm detected NVIDIA CUDA cores, AMD GPU, and OpenMP CPU workers.
4. **Trigger Retraining:**
   - Choose **Training Data Source**: `Synthetic Generator` or `PostgreSQL Database`.
   - Choose **Sample Size**: `3,000`, `5,000`, `10,000`, or `25,000` samples.
   - Click **"Train & Hot-Swap Models Now"**.
5. **Zero-Downtime Hot Swap:**
   - A progress spinner indicates active model training.
   - Upon completion, the `ModelRegistry` atomically swaps the running models in memory.
   - A green confirmation banner displays the new version tag (e.g., `v20260911.1828`), training duration, and test accuracy.

---

## 🚀 Running the Full Stack (Local & Cloud)

### 1. Prerequisites
- **Docker Desktop** (with Compose enabled)
- **Node.js 18+** & **Python 3.10+** (if developing outside Docker)
- **Ngrok** (optional, for sharing over public HTTPS)

### 2. Environment Setup
```bash
# Copy sample configuration
cp .env.example .env
```

### 3. Launch Docker Services
```bash
docker compose up -d
```
This boots:
- **`cpaf_postgres`** on port `5433` (PostgreSQL 16 with TimescaleDB)
- **`cpaf_redis`** on port `6379` (Redis caching and task broker)
- **`cpaf_migrate`** (runs `alembic upgrade head` and exits)
- **`cpaf_backend`** on port `8000` (FastAPI with hot-reload)
- **`cpaf_frontend`** on port `3000` (Next.js 14 App Router)

### 4. Demo Login Credentials
Open `http://localhost:3000/login`:
- **One-Click Demo Button**: Click **"Auto-Fill Demo Admin (admin@cpaf.gov.in)"**
- **Email**: `admin@cpaf.gov.in`
- **Password**: `admin123`
- **Role**: `admin` (super-admin access to all system tabs)

### 5. Expose over Public Ngrok Tunnel
To allow external team members or hackathon evaluators to access the system:
```bash
ngrok http 3000
```
Because Next.js has reverse proxy rewrites configured in [`frontend/next.config.js`](file:///i:/vinit%20SIH/CASHGUARD-AI/frontend/next.config.js), all API calls to `/api/v1/:path*` route seamlessly through the ngrok HTTPS tunnel without CORS or Mixed Content errors.

---

## 🧭 System Modules Walkthrough

### 1. Executive Dashboard (`/`)
- **Key Metrics**: Real-time fraud volume, financial loss prevented, active alert counters, and system health status.
- **Geospatial Incident Map**: Interactive Leaflet map plotting cybercrime reports across Indian districts with color-coded risk markers.
- **Top Financial Cashout Targets**: Tabular overview of high-risk banks and withdrawal cities.

### 2. Predictive Analytics (`/analytics`)
- **Temporal Forecast Engine**: Prophet and ARIMA projection graphs predicting complaint spikes 7 to 30 days ahead.
- **Risk Distribution Charts**: Severity breakdown by fraud category (digital arrest, phishing, lottery fraud, UPI impersonation).

### 3. Live Intelligence Feed (`/intelligence`)
- **Real-Time WebSocket Stream**: Live alerts stream into the interface as cybercrime reports are ingested.
- **Automated Police Dossier Generator**: Click any incident row to open the verified **Law Enforcement Investigation Dossier Modal** with 1-click **Export Official PDF Dossier**.

### 4. Active Threat Alerts (`/alerts`)
- **Priority Incident Queue**: Filter by status (`Active`, `Acknowledged`, `Resolved`) and assign alerts to duty officers.
- **Batch Processing**: Schedule batch background ML inference for high-volume complaint batches.

### 5. System Settings & AI Registry (`/settings`)
- **AI & Machine Learning Engine**: Live model registry status, hardware acceleration diagnostics, and 1-click zero-downtime retraining.
- **Security & RBAC**: Role-based access controls and API key management.
- **Audit Logs**: Immutable audit log of all system actions and model retraining events.

---

## 🏢 Remote Workstation Training (40GB IBM AML Dataset)

When deploying to a dedicated GPU server with the full 40GB IBM AML Dataset:

1. Clone repository to remote GPU machine.
2. Install GPU dependencies:
   ```bash
   pip install -r requirements.txt
   pip install torch --index-url https://download.pytorch.org/whl/cu121
   ```
3. Run chunked streaming training:
   ```bash
   python scripts/train_remote_cluster.py --dataset /path/to/HI-Large_Trans.csv --device cuda --chunksize 250000
   ```
4. Copy resulting `.pkl` files to `backend/app/ml/model_artifacts/`. The application will immediately hot-load them without requiring a server reboot.

---

## 🛡️ Verification & Test Suite

Run the automated backend test suite:
```bash
# In container:
docker exec cpaf_backend pytest -v

# On local host:
pytest backend/tests/ -v
```

All commits in this repository are authored cleanly by **Soham Patil** (`sohampatil1296@gmail.com`).
