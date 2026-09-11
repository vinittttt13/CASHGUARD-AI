# 🛡️ CASHGUARD-AI — Cybercrime Predictive Analytics Framework (CPAF)
> **Version:** 1.0.0 | **Stack:** FastAPI · Next.js 14 · PostgreSQL/PostGIS · Redis · XGBoost · Prophet · scikit-learn · Docker · Kubernetes

---

## 📌 Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Repository Structure](#3-repository-structure)
4. [Backend — FastAPI](#4-backend--fastapi)
5. [Machine Learning Pipeline](#5-machine-learning-pipeline)
6. [Frontend — Next.js 14](#6-frontend--nextjs-14)
7. [Database & Data Models](#7-database--data-models)
8. [MCP Server](#8-mcp-server)
9. [DevOps & Deployment](#9-devops--deployment)
10. [Environment Variables](#10-environment-variables)
11. [What Has Been Built & Refined](#11-what-has-been-built--refined)
12. [What Remains To Be Done](#12-what-remains-to-be-done)
13. [Tech Stack Summary](#13-tech-stack-summary)

---

## 1. Project Overview

**CASHGUARD-AI** (internally named *Cybercrime Predictive Analytics Framework — CPAF*) is a full-stack AI-powered platform built to help law-enforcement agencies and financial-crime units:

- **Predict** where and when cybercrime cashouts (ATM fraud, UPI scams, phishing) will occur next
- **Classify** new complaints by risk level (Low / Medium / High) in real-time
- **Detect** organized fraud rings and mule networks through graph analysis
- **Forecast** crime volume trends using time-series models
- **Visualize** geospatial hotspots on an interactive map
- **Alert** analysts via real-time WebSocket notifications

The system ingests complaint data, extracts features (temporal, geospatial, NLP, financial), passes them through a multi-model ML ensemble, and serves results via REST + WebSocket APIs to a modern React dashboard.

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CASHGUARD-AI Platform                         │
│                                                                      │
│  ┌──────────────┐      ┌─────────────────────┐    ┌──────────────┐  │
│  │  Next.js 14  │◄────►│  FastAPI Backend     │◄──►│ PostgreSQL   │  │
│  │  (Frontend)  │      │  (Python 3.11+)      │    │ + PostGIS    │  │
│  │  Port: 3000  │      │  Port: 8000          │    │ Port: 5432   │  │
│  └──────┬───────┘      └─────────┬───────────┘    └──────────────┘  │
│         │  WebSocket (ws://)     │                                   │
│         └───────────────────────►│        ┌──────────────────────┐  │
│                                  │◄──────►│  Redis               │  │
│                                  │        │  (Cache + PubSub)    │  │
│                                  │        │  Port: 6379          │  │
│                                  │        └──────────────────────┘  │
│                                  │                                   │
│                         ┌────────▼────────┐                         │
│                         │  ML Engine      │                         │
│                         │  XGBoost        │                         │
│                         │  RandomForest   │                         │
│                         │  Prophet        │                         │
│                         │  KMeans         │                         │
│                         │  SHAP           │                         │
│                         └─────────────────┘                         │
│                                                                      │
│  ┌─────────────────┐                                                 │
│  │  MCP Server     │  ← AI Agent Tool Interface (Claude/LLM)        │
│  │  (FastMCP)      │                                                 │
│  └─────────────────┘                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### Architecture Principles
- **Async-first**: FastAPI with `asyncpg` + SQLAlchemy async for all DB operations
- **Stateless API**: JWT-based authentication; no server-side sessions
- **Redis PubSub**: Cross-pod WebSocket broadcast for horizontal scaling
- **Model Registry**: Versioned `.pkl` artifacts loaded at startup; heuristic fallback when absent
- **Rate Limiting**: SlowAPI middleware protecting all prediction endpoints
- **CORS Security**: Strict origins defined; never `*` with credentials

---

## 3. Repository Structure

```
CASHGUARD-AI/
│
├── backend/                    # FastAPI Python backend
│   ├── app/
│   │   ├── api/v1/             # Route handlers (auth, complaints, predict, intelligence, locations, websocket)
│   │   ├── core/               # Config, DB, Redis, Security
│   │   ├── ml/                 # ML models, feature engineering, SHAP
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic layer
│   │   ├── utils/              # Logging, rate limiter
│   │   └── main.py             # Application entry point
│   ├── alembic/                # DB migrations
│   ├── tests/                  # pytest test suite
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                   # Next.js 14 App Router frontend
│   └── src/
│       ├── app/                # Pages (dashboard, alerts, analytics, intelligence, settings, auth)
│       ├── components/         # Shared & feature-specific React components
│       ├── hooks/              # Custom React hooks
│       ├── store/              # Zustand global state
│       └── types/              # TypeScript interfaces
│
├── mcp/                        # Model Context Protocol server (AI agent tools)
│   └── server.py
│
├── dataset/
│   └── clean_aml_data.py       # IBM AML dataset preprocessor (40GB ETL)
│
├── docs/                       # Full documentation suite (13 MD files)
├── kubernetes/                 # K8s manifests (6 YAML files)
├── scripts/                    # Utility scripts
├── docker-compose.yml          # Local dev orchestration
├── .env.example                # Environment variable template
└── README.md
```

---

## 4. Backend — FastAPI

### Entry Point — `backend/app/main.py`
- **Lifespan manager**: DB init → Alembic migrations → WebSocket PubSub startup
- **Middleware**: CORS (strict origins), SlowAPI rate limiter
- **Exception handlers**: HTTP, validation (422), and generic 500 errors
- **Health endpoint**: `GET /health` returns status, model version, and timestamp

### API Routes (`/api/v1/`)

| Router File | Prefix | Key Endpoints |
|---|---|---|
| `auth.py` | `/auth` | `POST /login`, `POST /register`, `POST /refresh` |
| `complaints.py` | `/complaints` | `GET /`, `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` |
| `predict.py` | `/predict` | `POST /`, `GET /hotspots`, `GET /forecast`, `GET /risk/{id}` |
| `intelligence.py` | `/intelligence` | `GET /alerts`, `POST /alerts`, `GET /fraud-rings` |
| `locations.py` | `/locations` | `GET /`, `GET /heatmap`, `GET /clusters` |
| `websocket.py` | `/ws` | WebSocket connection for real-time alerts |

### Core Modules (`backend/app/core/`)

| File | Purpose |
|---|---|
| `config.py` | Pydantic Settings — reads `.env`, exposes typed `settings` singleton |
| `database.py` | SQLAlchemy async engine + session factory; `init_db()` creates tables |
| `redis_client.py` | Async Redis helpers: `cache_get`, `cache_set`, PubSub relay |
| `security.py` | JWT creation/verification, `passlib` bcrypt password hashing |

### Services Layer (`backend/app/services/`)

| Service | Responsibilities |
|---|---|
| `prediction_service.py` | Orchestrates FeatureEngineer → ModelRegistry → SHAP; heuristic fallback |
| `intelligence_service.py` | Fraud ring detection, alert scoring, AML signal correlation |
| `geospatial_service.py` | PostGIS queries, geocoding, cluster aggregation, heatmap data |
| `alert_service.py` | Alert CRUD, severity triage, WebSocket broadcast trigger |
| `websocket_manager.py` | Connection registry, Redis PubSub relay for cross-pod broadcast |

---

## 5. Machine Learning Pipeline

### Overview

```
Raw Complaint Data
        │
        ▼
┌─────────────────────┐
│  AML Preprocessor   │  ← IBM AML 40GB dataset ETL
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Feature Engineer   │  ← 17-dimensional feature vector
└────────┬────────────┘
         │
    ┌────┴──────────────────────────┐
    │            │          │       │
    ▼            ▼          ▼       ▼
XGBoost    Random Forest  Prophet  KMeans
(Location  (Risk Level   (Temporal (Hotspot
 Predict)   Classify)    Forecast)  Detect)
    │
    ▼
SHAP Explainer → Model Registry (.pkl artifacts)
```

### Feature Vector (17 dimensions)

| Feature | Type | Description |
|---|---|---|
| `hour` | Temporal | Hour of complaint (0–23) |
| `day_of_week` | Temporal | Day of week (0=Mon) |
| `month` | Temporal | Month (1–12) |
| `is_weekend` | Temporal | Binary weekend flag |
| `is_holiday_period` | Temporal | Binary holiday-season flag (Oct–Nov) |
| `dist_to_city_center` | Geospatial | Haversine distance to nearest major city (km) |
| `dist_to_atm` | Geospatial | Haversine distance to nearest ATM via BallTree |
| `tfidf_sum` | NLP | TF-IDF score of complaint text |
| `ner_loc_count` | NLP | Count of location entities extracted (spaCy) |
| `bank_name_indicator` | NLP | Binary flag if bank name detected |
| `amount_log` | Financial | Log-transformed transaction amount |
| `amount_percentile` | Financial | Quantile percentile bin of amount |
| `is_round_number` | Financial | Binary flag for suspiciously round amounts |
| `state_encoded` | Categorical | Label-encoded Indian state |
| `district_encoded` | Categorical | Label-encoded district |
| `category_encoded` | Categorical | Label-encoded crime category |
| `bank_encoded` | Categorical | Label-encoded bank name |

### Models

#### 1. XGBoost — `CashoutLocationPredictor`
- **Task**: Multi-class classification → predict cashout cluster ID
- **Config**: 500 estimators, max_depth=6, lr=0.05, subsample=0.8, early_stopping=20
- **Output**: Top-K cluster predictions with probability scores + SHAP values

#### 2. Random Forest — `RiskLevelClassifier`
- **Task**: Multi-class classification → Low / Medium / High risk
- **Library**: scikit-learn `RandomForestClassifier`
- **Output**: Risk label + class probabilities

#### 3. Prophet — `TemporalForecaster`
- **Task**: Time-series forecasting of complaint volume (daily)
- **Output**: Next N-day forecast with uncertainty intervals
- **Use case**: Capacity planning, alert scheduling

#### 4. KMeans — `HotspotDetector`
- **Task**: Unsupervised geospatial clustering of past complaints
- **Output**: Cluster centroids = predicted hotspot locations

#### 5. SHAP Explainer — `shap_explainer.py`
- **Task**: Post-hoc explainability for XGBoost predictions
- **Output**: Per-feature contribution values for analyst transparency

#### 6. Fraud Ring Detector — `graph_analytics.py`
- **Task**: Graph-based detection of coordinated syndicate activity
- **Method**: Entity co-occurrence graph (bank, district, phone, account) → connected component analysis
- **Output**: Fraud ring clusters with member complaints, ring size, suspicion score

#### 7. NLP Extractor — `nlp_extractor.py`
- **Task**: Named Entity Recognition on free-text complaint narratives
- **Library**: spaCy (en_core_web model)
- **Output**: Location entities, bank mentions, person names

#### 8. AML Preprocessor — `aml_preprocessor.py`
- **Task**: Cleans and normalizes IBM AML dataset (40GB) for model training
- **Operations**: Column mapping, amount normalization, label encoding, train/val/test split

### Model Registry — `model_registry.py`
- Stores model versions with metadata (accuracy, training date, feature names)
- Persists to disk as `.pkl` files in `backend/app/ml/model_artifacts/`
- Loads at application startup; `PredictionService` falls back to heuristics if absent

### Training Pipeline — `train.py`
```bash
# Train from CSV data
python backend/app/ml/train.py --from-csv data.csv --model-version v1.1 --production

# Train from mock data (development)
python backend/app/ml/train.py --model-version v1.0
```

---

## 6. Frontend — Next.js 14

### Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **UI Library**: shadcn/ui + Radix UI primitives
- **Styling**: Tailwind CSS + tailwind-animate
- **Charts**: Recharts
- **Maps**: React-Leaflet + Leaflet.heat (heatmap overlay)
- **State**: Zustand (`useAppStore`)
- **Data Fetching**: SWR + Axios
- **Forms**: React Hook Form + Zod validation
- **Real-time**: Socket.IO Client (WebSocket)
- **Auth**: JWT decoded client-side via `jwt-decode`

### Pages (`frontend/src/app/`)

| Route | Page | Description |
|---|---|---|
| `/` | Root | Redirects to dashboard or login |
| `/(auth)/login` | Login | JWT login form with validation |
| `/dashboard` | Dashboard | Stats overview, prediction panel, complaint feed, risk cards |
| `/alerts` | Alerts | Real-time intelligence alerts list |
| `/analytics` | Analytics | Recharts time-series and category breakdown |
| `/intelligence` | Intelligence | Fraud ring detection, AML signals |
| `/settings` | Settings | User preferences |

### Key Components (`frontend/src/components/`)

| Component | Purpose |
|---|---|
| `StatsOverview.tsx` | KPI cards (total complaints, high-risk count, active hotspots) |
| `PredictionForm.tsx` | Submit complaint → receive ML prediction with SHAP explanation |
| `PredictionPanel.tsx` | Display prediction results with confidence scores |
| `RiskScoreCard.tsx` | Visual risk score gauge component |
| `ComplaintFeed.tsx` | Live-updating feed of recent complaints |
| `map/` | Interactive Leaflet map with heatmap and cluster markers |
| `analytics/` | Recharts wrappers for time-series and bar charts |
| `intelligence/` | Fraud ring visualization components |

### State Management
- Zustand store (`useAppStore.ts`) managing: auth token, user profile, alert count, active filters

### Theming
- `theme-provider.tsx` wraps `next-themes` for dark/light mode toggle
- CSS custom properties defined in `globals.css`

---

## 7. Database & Data Models

### Database: PostgreSQL 15 + PostGIS extension

### SQLAlchemy ORM Models (`backend/app/models/`)

#### `user.py` — Users table
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | String | Unique, indexed |
| `hashed_password` | String | bcrypt hashed |
| `role` | Enum | `analyst` / `admin` |
| `is_active` | Boolean | Soft deactivation |
| `created_at` | DateTime | Auto-timestamp |

#### `complaint.py` — Complaints table
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `timestamp` | DateTime | When crime occurred |
| `lat` / `lng` | Float | Geospatial location |
| `complaint_text` | Text | Free-text NLP input |
| `amount` | Float | Transaction amount |
| `state` / `district` | String | Indian administrative divisions |
| `category` | String | Crime type (Phishing, UPI Fraud, etc.) |
| `bank_name` | String | Bank involved |
| `risk_level` | Enum | `low` / `medium` / `high` |
| `cluster_id` | Integer | KMeans cluster assignment |

#### `prediction.py` — Predictions table
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `complaint_id` | UUID | FK → complaints |
| `predicted_cluster` | Integer | XGBoost output |
| `risk_label` | String | RF output |
| `confidence` | Float | Model confidence score |
| `shap_values` | JSONB | Feature contributions |
| `model_version` | String | Registry version tag |

#### `intelligence_alert.py` — Alerts table
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `alert_type` | String | `fraud_ring` / `hotspot` / `anomaly` / `aml` |
| `severity` | Enum | `low` / `medium` / `high` / `critical` |
| `description` | Text | Human-readable alert summary |
| `metadata` | JSONB | Additional structured data |
| `is_resolved` | Boolean | Analyst resolution flag |

#### `withdrawal_location.py` — ATM/Withdrawal Locations
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `lat` / `lng` | Float | Location coordinates |
| `location_name` | String | ATM / branch name |
| `bank_name` | String | Owning bank |
| `is_flagged` | Boolean | Manually flagged suspicious |

### Migrations
- Alembic manages schema evolution, auto-applied at startup via `alembic upgrade head`

### Seed Data
- `seed_db.py` — generates 500+ realistic fake complaints using Faker
- `init_db.sql` / `init_db_full.sql` — raw SQL bootstrap scripts

---

## 8. MCP Server

**File**: `mcp/server.py` | **Framework**: FastMCP

The MCP (Model Context Protocol) server exposes CASHGUARD-AI as a set of **AI-callable tools**, enabling LLM agents (Claude, etc.) to query the system directly.

### Available MCP Tools

| Tool | Description |
|---|---|
| `system_status()` | Check PostgreSQL + Redis connectivity and health |
| `query_complaints(filters)` | Query complaints with date/state/category/risk filters |
| `get_prediction(complaint_id)` | Retrieve stored prediction for a complaint |
| `get_intelligence_alerts(severity)` | List active intelligence alerts |
| `get_fraud_rings()` | Retrieve detected fraud ring data |
| `get_hotspots(limit)` | Get top crime hotspot clusters |
| `get_forecast(days)` | Prophet time-series forecast |
| `cache_stats()` | Redis cache hit/miss statistics |
| `flush_cache(pattern)` | Clear Redis cache by key pattern |

### Connectivity
- Connects to PostgreSQL via `psycopg2` (sync, separate from async backend)
- Connects to Redis via `redis-py`
- Deployed as a Docker container (`mcp/Dockerfile`)
- Uses `host.docker.internal` to reach backend database from container

---

## 9. DevOps & Deployment

### Docker Compose (Local Development)

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Database GUI (Adminer) | http://localhost:8080 |

### Kubernetes (Production)

Manifests in `kubernetes/`:

| File | Resource |
|---|---|
| `backend-deployment.yaml` | FastAPI Deployment + Service |
| `frontend-deployment.yaml` | Next.js Deployment + Service |
| `postgres-statefulset.yaml` | PostgreSQL StatefulSet + PVC |
| `redis-deployment.yaml` | Redis Deployment + Service |
| `ingress.yaml` | NGINX Ingress with path routing |
| `network-policy.yaml` | Pod-to-pod network security policies |

```bash
kubectl apply -f kubernetes/
```

### CI/CD (GitHub Actions)
- `.github/` contains workflow definitions
- Weekly model retraining trigger
- PR validation: `pytest` + TypeScript check

---

## 10. Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL async connection string | `postgresql+asyncpg://cpaf_user:cpaf_pass@localhost:5432/cpaf_db` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `SECRET_KEY` | JWT signing secret | `change-me-in-production` |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token TTL | `30` |
| `POSTGRES_DB` | DB name | `cpaf_db` |
| `POSTGRES_USER` | DB user | `cpaf_user` |
| `POSTGRES_PASSWORD` | DB password | `cpaf_pass` |
| `NEXT_PUBLIC_API_URL` | Frontend → Backend URL | `http://localhost:8000` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `ws://localhost:8000` |
| `GEOCODING_TIMEOUT` | Geocoding request timeout (s) | `5` |
| `MODEL_VERSION` | Active model version tag | `1.0.0` |
| `LOG_LEVEL` | Logging verbosity | `INFO` |
| `CORS_ORIGINS` | Allowed CORS origins (JSON array) | `["http://localhost:3000"]` |
| `ANTHROPIC_API_KEY` | Claude API key (for MCP agent use) | `sk-ant-...` |

---

## 11. What Has Been Built & Refined

### ✅ Backend
- [x] FastAPI application with async lifespan management
- [x] JWT authentication (login, register, refresh token)
- [x] Rate limiting via SlowAPI on all endpoints
- [x] Full CRUD for complaints with filtering/pagination
- [x] Prediction endpoint with ML + heuristic fallback
- [x] Intelligence endpoint (alerts, fraud rings)
- [x] Geospatial locations endpoint (clusters, heatmap)
- [x] WebSocket endpoint with Redis PubSub cross-pod relay
- [x] Alembic migration integration at startup
- [x] Structured logging with `structlog`
- [x] Global exception handlers (HTTP, validation, generic 500)
- [x] CORS security (no wildcard with credentials)
- [x] Redis caching layer (`cache_get`/`cache_set`)
- [x] Database seeder (`seed_db.py`) with 500+ fake records

### ✅ Machine Learning (Refined)
- [x] **17-feature engineering pipeline** (temporal, geospatial, NLP, financial)
- [x] **Haversine BallTree** for fast nearest-ATM distance lookup
- [x] **XGBoost CashoutLocationPredictor** — multi-class cluster prediction with top-K output
- [x] **Random Forest RiskLevelClassifier** — Low / Medium / High with probabilities
- [x] **Prophet TemporalForecaster** — daily crime volume forecasting
- [x] **KMeans HotspotDetector** — geospatial clustering with centroid output
- [x] **SHAP TreeExplainer** — per-prediction feature contribution values
- [x] **Fraud Ring Detector** (graph analytics) — entity co-occurrence graph, connected components
- [x] **NLP Extractor** (spaCy NER) — location, bank, person entity extraction
- [x] **AML Preprocessor** — IBM AML 40GB dataset ETL pipeline
- [x] **Model Registry** — versioned `.pkl` artifact management with metadata
- [x] **Training pipeline** (`train.py`) — synchronized train/val splits, argparse CLI
- [x] **PredictionService** — singleton orchestrator with graceful heuristic fallback

### ✅ Frontend
- [x] Next.js 14 App Router setup with TypeScript
- [x] Dark/light theme with `next-themes`
- [x] JWT login page with React Hook Form + Zod validation
- [x] Dashboard layout with stats overview, prediction form, complaint feed
- [x] `PredictionForm` — full ML prediction UI with SHAP result display
- [x] `PredictionPanel` — result display with confidence visualization
- [x] `RiskScoreCard` — visual risk gauge component
- [x] `StatsOverview` — KPI metrics cards
- [x] `ComplaintFeed` — live complaint list
- [x] Leaflet map integration with heat layer
- [x] Recharts analytics charts
- [x] Zustand global state store
- [x] Socket.IO WebSocket client for real-time alerts

### ✅ Infrastructure
- [x] Docker Compose with 6 services
- [x] Kubernetes manifests for all services + Ingress + Network Policies
- [x] MCP server with 9 AI-callable tools
- [x] Alembic database migrations with auto-apply at startup
- [x] GitHub Actions workflow scaffold
- [x] 13-document comprehensive docs suite
- [x] `.env.example` with all required variables

---

## 12. What Remains To Be Done

### 🔴 High Priority

#### ML Model Training
- [ ] **Train models on real data** — no `.pkl` artifacts exist yet in `model_artifacts/`; all predictions currently use heuristic fallback. Run `train.py --from-csv` with actual complaint data
- [ ] **IBM AML dataset ETL** — complete the 40GB pipeline via `dataset/clean_aml_data.py` and feed into training
- [ ] **Model validation integration** — `model_validation.py` exists but needs wiring into the CI training pipeline

#### Backend
- [ ] **Celery task queue** — Redis is configured as broker but no Celery tasks/workers exist for async model retraining
- [ ] **Background weekly retraining job** — GitHub Actions trigger scaffold exists; actual task definition incomplete
- [ ] **Input validation hardening** — add schema-level validation for lat/lng ranges, amount bounds, date formats
- [ ] **Consistent pagination** — ensure cursor-based or offset pagination is uniform across all list endpoints

#### Frontend
- [ ] **Alerts page** — `frontend/src/app/alerts/` folder exists but full page implementation needs verification
- [ ] **Analytics page** — complete chart implementations with real API data binding (currently may use mock data)
- [ ] **Intelligence page** — fraud ring graph visualization needs a network-graph library (D3.js or Sigma.js)
- [ ] **Map component** — `predictive-map.tsx` is a near-empty stub (389 bytes); full Leaflet heatmap integration needed
- [ ] **WebSocket reconnection logic** — add exponential backoff on Socket.IO disconnect
- [ ] **React error boundaries** — add graceful UI failure handling around async sections
- [ ] **Loading skeletons** — skeleton components for all async data sections
- [ ] **Settings page** — user preferences (theme, notifications) not yet implemented

### 🟡 Medium Priority

#### Security
- [ ] **Refresh token rotation** — sliding-window refresh tokens with Redis revocation list
- [ ] **RBAC enforcement** — enforce `admin` vs `analyst` role gates on `DELETE` and intelligence write endpoints
- [ ] **MCP server authentication** — currently open; needs API key validation
- [ ] **Audit logging** — log all prediction requests, alert modifications, and admin actions

#### Testing
- [ ] **Backend unit tests** — `backend/tests/` directory exists; coverage needs expansion for all services and ML modules
- [ ] **API integration tests** — `pytest-asyncio` tests for all `/api/v1/` endpoints with test database
- [ ] **ML model unit tests** — tests for `FeatureEngineer`, `CashoutLocationPredictor`, `FraudRingDetector`
- [ ] **Frontend E2E tests** — Cypress is installed but test scripts not yet written
- [ ] **CI test pipeline** — wire `pytest` and `cypress run` into GitHub Actions on PR

#### DevOps
- [ ] **Secrets management** — move credentials to Kubernetes Secrets or HashiCorp Vault
- [ ] **K8s resource limits** — add CPU/memory requests and limits to all Deployments
- [ ] **Horizontal Pod Autoscaler (HPA)** — auto-scaling for backend pods
- [ ] **Prometheus + Grafana** — metrics for ML inference latency, API response times
- [ ] **Log aggregation** — ship structured logs to ELK/Loki

### 🟢 Low Priority / Nice-to-Have

- [ ] **Fraud ring graph visualization** — interactive network graph (D3.js/Sigma.js) for Intelligence page
- [ ] **PDF report export** — one-click analyst report generation
- [ ] **Multi-language NLP** — Hindi/regional language complaint text processing
- [ ] **SMS/Email alert notifications** — Twilio/SendGrid integration
- [ ] **Admin dashboard** — user management, model monitoring, system health
- [ ] **Mobile PWA** — Progressive Web App for field officers
- [ ] **AI Copilot chat** — Claude via MCP for natural language crime data queries
- [ ] **Data retention policies** — automated archival of complaints older than 2 years

---

## 13. Tech Stack Summary

| Layer | Technology | Version |
|---|---|---|
| **Frontend Framework** | Next.js | 14.2.4 |
| **Frontend Language** | TypeScript | 5.5 |
| **UI Components** | Radix UI + shadcn/ui | latest |
| **Styling** | Tailwind CSS | 3.4 |
| **Charts** | Recharts | 2.12 |
| **Maps** | React-Leaflet + Leaflet.heat | 4.2 |
| **State Management** | Zustand | 4.5 |
| **HTTP Client** | Axios + SWR | 1.7 |
| **Forms** | React Hook Form + Zod | 7.5 |
| **WebSocket Client** | Socket.IO Client | 4.7 |
| **Backend Framework** | FastAPI | 0.111 |
| **Backend Language** | Python | 3.11+ |
| **ASGI Server** | Uvicorn | 0.30 |
| **ORM** | SQLAlchemy (async) | 2.0 |
| **Migrations** | Alembic | 1.13 |
| **DB Driver** | asyncpg | 0.29 |
| **Auth** | python-jose + passlib | 3.3 |
| **Rate Limiting** | SlowAPI | 0.1.9 |
| **Caching** | Redis (hiredis) | 7 |
| **ML — Boosting** | XGBoost | 2.0 |
| **ML — Ensemble** | scikit-learn | 1.5 |
| **ML — Forecasting** | Prophet | 1.1 |
| **ML — Explainability** | SHAP | 0.45 |
| **NLP** | spaCy | 3.7 |
| **Geospatial** | Shapely + PyProj | 2.0 |
| **Logging** | structlog | 24.2 |
| **Database** | PostgreSQL 15 + PostGIS | 15 |
| **Cache/Broker** | Redis | 7 |
| **Containerization** | Docker + Docker Compose | latest |
| **Orchestration** | Kubernetes | 1.28+ |
| **AI Agent Interface** | MCP (FastMCP) | latest |
| **Testing (Backend)** | pytest + pytest-asyncio | 8.2 |
| **Testing (Frontend)** | Cypress | 13.12 |

---

*Last updated: September 2026 | Project: CASHGUARD-AI / CPAF v1.0.0*
