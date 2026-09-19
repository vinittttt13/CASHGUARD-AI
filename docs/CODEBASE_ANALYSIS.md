# CASHGUARD-AI — Codebase Analysis

> Generated 2026-09-19 from a direct read of the repository (source files, configs,
> manifests). This is a snapshot analysis of the current tree, complementary to the
> narrower reference docs in `docs/` (see `docs/README.md` for the full index) and to
> `docs/REPO_ANALYSIS_AND_IMPROVEMENTS.md`, which focuses on gaps/roadmap rather than
> a full structural walkthrough.

## 1. What this project is

**CashGuard-AI** (product name) / **CPAF — Cybercrime Predictive Analytics Framework**
(engineering name) is a full-stack platform for anticipating, detecting, and
triaging cyber-enabled financial fraud: vishing/phishing-driven cash withdrawals,
ATM-linked fraud, UPI fraud, and money-laundering-style transaction networks (built
on the IBM AML synthetic dataset). It combines:

- A citizen/analyst-facing complaint pipeline,
- An ML risk-scoring layer (XGBoost, Random Forest, Prophet, KMeans/DBSCAN, SHAP, NLP),
- A geospatial hotspot/heatmap intelligence view, and
- A real-time (WebSocket) alerting dashboard for law-enforcement/analyst users.

It was built for the Smart India Hackathon (SIH) context — `SIH_JUDGE_EVALUATION_AND_IMPROVEMENT_AREAS.txt`
and `PROJECT_COMPLETION_REPORT.md` at the repo root reflect that origin.

## 2. High-level architecture

```
Next.js 14 frontend  <---->  FastAPI backend (Python/ML)  <---->  PostgreSQL 15
     (React 18,                     |
   Zustand, Leaflet,                v
    Recharts, WS client)   Redis 7 (cache, pub/sub for
                             cross-pod WebSocket fan-out,
                             rate-limit storage)
```

- **Frontend** talks to the backend over REST (`NEXT_PUBLIC_API_URL`) and a
  WebSocket live-feed (`NEXT_PUBLIC_WS_URL`) for push alerts.
- **Backend** is a single FastAPI app (`backend/app/main.py`) exposing versioned
  REST routes under `/api/v1`, plus `/health` and `/health/ready`.
- **PostgreSQL** is the system of record; **schema ownership is Alembic-only** —
  `init_db()` only creates tables when `TESTING=1` (SQLite-backed unit tests).
- **Redis** backs the WebSocket pub/sub relay (for multi-pod broadcast) and the
  rate limiter's storage backend.
- **MCP server** (`mcp/`) exposes DB/Redis/ML inspection tools over the Model
  Context Protocol for AI-assisted operations (see `docs/MCP_SERVER_SETUP.md`).

## 3. Repository layout

```
backend/     FastAPI app, ML pipeline, Alembic migrations, pytest suite
frontend/    Next.js 14 App Router UI, Vitest unit tests, Playwright e2e
mcp/         Standalone MCP tool server (FastMCP) + its own tests
dataset/     IBM AML synthetic dataset (raw + cleaned parquet/csv) + ETL script
docs/        ~30 reference/planning docs (architecture, API, DB, frontend, DevOps…)
kubernetes/  Deployment/StatefulSet/HPA/NetworkPolicy manifests + example secrets
scripts/     Cross-platform training/demo/setup scripts (.sh/.ps1/.bat/.py)
.github/     CI, CodeQL, and weekly model-retrain workflows
docker-compose.yml, Dockerfile.claude   Local orchestration + a "claude" dev-tools service
```

## 4. Backend (`backend/`)

**Stack**: Python 3.11, FastAPI 0.111, SQLAlchemy 2.0 (async, via `asyncpg`),
Alembic, Pydantic v2, SlowAPI-flavored custom rate limiting, structlog, JWT
(`python-jose`) + `passlib`/`bcrypt` for auth.

### 4.1 App structure (`backend/app/`)

| Package | Responsibility |
|---|---|
| `api/v1/` | Route handlers: `auth.py`, `complaints.py`, `predict.py`, `intelligence.py`, `locations.py`, `websocket.py` |
| `core/` | `config.py` (Pydantic Settings), `database.py` (async engine/session), `redis_client.py`, `security.py` (JWT/password hashing) |
| `models/` | SQLAlchemy ORM models: `User`, `Complaint`, `Prediction`, `IntelligenceAlert`, `WithdrawalLocation` |
| `schemas/` | Pydantic request/response schemas mirroring the models |
| `services/` | Business logic: `alert_service`, `geospatial_service`, `intelligence_service`, `prediction_service`, `websocket_manager` |
| `ml/` | Full ML pipeline (see §4.3) |
| `utils/` | `anonymizer`, `circuit_breaker`, `logging_config`, `rate_limiter` |

### 4.2 API surface (`/api/v1/*`)

- **Auth** — `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`, `POST /auth/register`
- **Complaints** — `GET/POST /complaints`, `GET /complaints/stats/aggregate`, `GET/PUT/DELETE /complaints/{id}`
- **Predict** — `POST /predict`, `POST /predict/batch`, `GET /predict/model-status`,
  `POST /predict/train`, `POST /predict/aml-transaction`, `GET /predict/{id}`
- **Intelligence** — `GET/POST /intelligence/alerts`, `PUT /intelligence/alerts/{id}/acknowledge`,
  `GET /intelligence/trends`, `/intelligence/report`, `/intelligence/report/export`, `/intelligence/fraud-rings`
- **Locations** — `GET/POST /locations`, `/locations/hotspots`, `/locations/heatmap`, `/locations/nearby`, `/locations/{id}`
- **WebSocket** — `WS /ws/live-feed?token=<jwt>` — authenticated live alert stream

Cross-cutting middleware in `main.py`:
- Per-IP fixed-window **rate limiting** implemented directly in HTTP middleware
  (not via SlowAPI decorators, noted as broken in the pinned 0.1.9), with a
  storage-failure-open policy (logs and allows through rather than 500ing).
- **CORS** requires an explicit origin allowlist in any non-`development`
  environment (refuses to start otherwise); a regex additionally allows
  `ngrok`/`loca.lt` tunnel hosts and any `localhost:*` for demo convenience.
- Global exception handlers for `HTTPException`, `RequestValidationError`, and a
  catch-all 500 handler.
- `/health` (liveness, no dependency checks) vs `/health/ready` (checks Postgres
  `SELECT 1` and Redis `PING` with a 2s timeout each; 503 if either fails).

### 4.3 ML pipeline (`backend/app/ml/`)

18 modules covering:
- **AML/transaction fraud**: `aml_preprocessor.py`, `aml_xgboost_model.py`,
  `train_aml.py` — XGBoost model trained on the IBM AML dataset.
- **General risk/location models**: `xgboost_model.py`, `random_forest_model.py`,
  `kmeans_hotspot.py` (hotspot clustering), `graph_analytics.py` (fraud-ring/graph
  motifs), `prophet_model.py` (time-series trend forecasting).
- **Explainability**: `shap_explainer.py`.
- **NLP**: `nlp_extractor.py` (spaCy/TextBlob-based complaint text extraction).
- **Infra**: `data_loader.py`, `feature_engineering.py`, `model_registry.py`,
  `model_validation.py`, `training_pipeline.py`, `train.py` (generic training
  entrypoint), `hardware.py` (auto-detects NVIDIA CUDA / AMD ROCm / CPU
  OpenMP and picks the XGBoost device/tree method accordingly).

Trained artifacts live in `backend/app/ml/model_artifacts/` (`xgboost_aml.pkl`,
`xgboost_location.pkl`, `rf_risk.pkl`, `kmeans_hotspot.pkl`), tracked alongside
`artifact_manifest.json` (version, training source, sample size, hardware used)
and `xgboost_aml_metrics.json`. `model_store_uri` in `Settings` optionally points
these at an S3-compatible store instead of local disk. Models are retrained
weekly via `.github/workflows/retrain.yml`, or manually via
`train_models.{bat,ps1,sh}` / `python -m app.ml.train`.

### 4.4 Data model (`backend/app/models/`)

| Model | Table | Notes |
|---|---|---|
| `User` | `users` | `UserRole` enum (RBAC) |
| `Complaint` | `complaints` | `ComplaintCategory`, `ComplaintStatus` enums |
| `Prediction` | `predictions` | `RiskLevel` enum — output of the ML scoring pipeline |
| `IntelligenceAlert` | `intelligence_alerts` | `AlertType`, `AlertPriority` enums |
| `WithdrawalLocation` | `withdrawal_locations` | `LocationType` enum — geospatial (lat/lon; PostGIS was deliberately dropped, see `docs/adr/0001-postgis.md`) |

Schema is Alembic-owned: 2 migration versions currently in
`backend/alembic/versions/`; the `migrate` one-shot Compose/K8s service runs
`alembic upgrade head` before the backend starts (no `create_all` in prod).

### 4.5 Backend tests

16 test modules under `backend/tests/` (pytest + pytest-asyncio), covering the
alert service, AML API/preprocessor/XGBoost model, anonymizer, circuit breaker,
data loader, frontend-contract parity, general ML, model store, Prophet model,
Redis client, AML training, training smoke tests, and the WebSocket manager.
Heavy ML tests are gated behind `pytest -m slow`.

## 5. Frontend (`frontend/`)

**Stack**: Next.js 14.2 (App Router), React 18.3, TypeScript 5.5, TailwindCSS +
`tailwindcss-animate`, Radix UI primitives, `react-leaflet`/`leaflet.heat` for
maps, Recharts for charts, Zustand for client state, `react-hook-form` + `zod`
for forms/validation, `axios` for HTTP, `jwt-decode` for token parsing.

### 5.1 App routes (`frontend/src/app/`)

Route groups: `(auth)/login`, `dashboard`, `alerts`, `analytics`, `intelligence`,
`settings` — each with its own `layout.tsx`/`page.tsx`, several with colocated
`__tests__/`. Recent history (`d96cd85`) redesigned the UI as a "dark financial
cyber intelligence platform" theme.

### 5.2 Components (`frontend/src/components/`)

Organized by domain: `alerts/` (AlertCard, AlertCenter, CaseQueueTable),
`analytics/` (AML transaction panel, confidence gauge, feature-importance radar,
geographic distribution, hotspot table, statutory-notice modal, time-series
chart), `intelligence/` (case dossier modal, fraud-ring graph, hotspot grid,
state breakdown, trend chart), `dashboard/` (complaint feed, prediction panel,
predictive map, stats overview), `map/` (ATM marker, geofence zone, heatmap
layer, predictive map — Leaflet-based), `layout/AppShell.tsx`, `shared/`
(ErrorBoundary, RoleGuard, NotificationBell, shared "states" primitives —
currently modified per git status), and a Radix-based `ui/` primitive set
(button, card, input, tabs, toast, etc.).

### 5.3 State, data, and real-time (`frontend/src/{lib,hooks,store}`)

- `lib/api.ts` — axios client wrapping the backend REST API; `lib/auth.ts` —
  JWT handling; `lib/runtime-env.ts` — reads runtime-injected env (see
  `public/env-config.js`, used so a single built image can point at different
  API URLs at container-start time); `lib/sound.ts` — alert chime.
- `hooks/useApiResource.ts` — generic data-fetching hook; `hooks/useWebSocket.ts`
  — live-feed WebSocket client (pairs with the backend's `/ws/live-feed`).
- `store/useAppStore.ts` — Zustand global store.

### 5.4 Frontend tests

Vitest unit tests (11 `*.test.ts(x)` files) across `app/*/__tests__`,
`components/*/__tests__`, `hooks/__tests__`, `lib/__tests__`. Playwright e2e
specs in `frontend/e2e/` (`auth.setup.ts`, `login.spec.ts`, `dashboard.spec.ts`)
run against a live `docker compose` stack. `knip` is used for dead-code
detection (`npm run lint:dead`).

## 6. MCP server (`mcp/`)

A standalone `FastMCP`-based server (`mcp/server.py`) exposing tools over the
Model Context Protocol for: system/DB/Redis health, and (per file layout) further
cybercrime-intelligence and fraud-risk-scoring tool categories. Runs
containerized (own `Dockerfile`), wired into `docker-compose.yml` under the
`mcp`/`tools` profiles, and into `.agents/mcp_config.json` / `.cursor/mcp.json` /
`.vscode/mcp.json` for editor/agent integration. Has its own `pytest.ini` and
`tests/` directory. See `docs/MCP_SERVER_SETUP.md` and `docs/MCP_DOCUMENTATION.md`.

## 7. Dataset (`dataset/`)

The IBM AML (Anti-Money-Laundering) synthetic transaction dataset in several
scale tiers (`HI-Small`/`HI-Medium`/`HI-Large`, `LI-Small`/`LI-Medium`/`LI-Large`
— "High/Low Illicit ratio"), each with `*_Trans.csv`, `*_accounts.csv`, and
`*_Patterns.txt` (labeled laundering typologies). `cleaned/` holds a
parquet-converted, deduplicated subset plus a 50k-row CSV sample for fast local
iteration. `clean_aml_data.py` and `verify.py` implement the ETL/validation
step; `manifest.json` records dataset provenance. See
`docs/IBM_AML_DATASET_INTEGRATION.md` for the full 40 GB out-of-core pipeline
design.

## 8. Infrastructure & deployment

### 8.1 Docker Compose (`docker-compose.yml`)

Services: `postgres` (15, configurable host port to avoid clobbering a native
install — see the `native-postgres-shadows-docker` note below), `redis` (7),
`migrate` (one-shot Alembic runner, the *only* schema writer), `backend`,
`frontend` (build-arg-injects `NEXT_PUBLIC_*` at image build time since Next.js
inlines them client-side), `adminer` (DB GUI), and two opt-in profiles: `mcp`
(the MCP tool server) and `claude`/`tools` (a containerized Claude Code dev
environment via `Dockerfile.claude`, mounting the whole repo).

### 8.2 Kubernetes (`kubernetes/`)

Manifests for backend/frontend Deployments, a Postgres StatefulSet, Redis
Deployment, HPA, Ingress, NetworkPolicy, and a migration Job. `*-secrets.example.yaml`
files are placeholders — **not** meant to be applied directly (README calls this
out explicitly: don't `kubectl apply -f kubernetes/` wholesale).

### 8.3 CI/CD (`.github/workflows/`)

- `ci.yml` — presumably lint/test on push/PR (backend + frontend).
- `codeql.yml` — static security analysis.
- `retrain.yml` — weekly scheduled ML model retraining.

## 9. Configuration & secrets

`backend/app/core/config.py` defines all backend settings via
`pydantic-settings` (env-file + env-var driven), including DB/Redis URLs, JWT
secret (validated ≥32 chars) and expiry, environment name, rate-limit budgets
(global 300/min, login 5/min, predict 60/min), DB pool sizing, model-store
location, geocoding timeout, and max prediction radius. `.env.example` at the
repo root documents the expected variables (`DATABASE_URL`, `REDIS_URL`,
`SECRET_KEY`, `NEXT_PUBLIC_API_URL`, `POSTGRES_HOST_PORT`, etc.).

## 10. Documentation set already in `docs/`

The repo already carries an extensive, actively maintained documentation
suite — this analysis is meant to sit alongside it, not replace it:

- Architecture/reference: `SYSTEM_ARCHITECTURE.md`, `BACKEND_API_REFERENCE.md`,
  `DATABASE_AND_DATA_MODELS.md`, `FRONTEND_ARCHITECTURE.md`,
  `ML_PIPELINE_AND_MODELS.md`, `ML_MODEL_USAGE_GUIDE.md`.
- Build/ops: `DEVOPS_DEPLOYMENT_GUIDE.md`, `DEVELOPER_AND_CONTRIBUTOR_GUIDE.md`,
  `MCP_SERVER_SETUP.md`, `TESTING.md`.
- Data: `IBM_AML_DATASET_INTEGRATION.md`.
- Planning/status: `PROJECT_STATUS_AND_GAPS.md`, `ROADMAP.md`,
  `REPO_ANALYSIS_AND_IMPROVEMENTS.md`, `IMPLEMENTATION_PLAN_MICROTASKS.md`,
  and an `archive/` of superseded master plans (v2–v5).
- Product framing: `USP_ANALYSIS.md`, `FEASIBILITY_ANALYSIS.md`,
  `FRONTEND_RESEARCH_AND_GAPS.md`.
- `adr/0001-postgis.md` — the one recorded architecture decision (drop PostGIS).

## 11. Notable engineering decisions worth knowing

- **Schema ownership is exclusively Alembic** — application code never calls
  `create_all()` outside the test suite; this avoids drift between environments.
- **PostGIS was deliberately dropped** in favor of plain lat/lon columns
  (ADR 0001) — geospatial queries use `geospatial_service.py` + `geopy`/`shapely`
  instead of PostGIS operators.
- **Rate limiting fails open**, not closed — a Redis outage logs a warning and
  lets requests through rather than 500ing, because `/health/ready` already
  signals the outage for orchestration to act on.
- **CORS has no wildcard fallback in non-dev environments** — the app refuses
  to boot without an explicit origin list, closing a common accidental-open-CORS
  footgun.
- **Hardware-aware ML training** (`ml/hardware.py`) auto-detects CUDA/ROCm/CPU
  and configures XGBoost's device/tree-method accordingly, recorded per-run in
  `artifact_manifest.json`'s `hardware` block for reproducibility.
- A native/local Postgres install on the dev machine is known to shadow the
  Dockerized one on the default port — see the `POSTGRES_HOST_PORT` compose
  variable and the project's own memory note on this (do DB work inside the
  compose network, not against `localhost:5432` directly).

## 12. Working-tree state at time of writing

Per `git status` at the start of this analysis, the following files have
uncommitted local modifications (not reflected in the last commit,
`d96cd85 feat(frontend): redesign UI as dark financial cyber intelligence platform`):

- `backend/app/core/config.py`
- `backend/app/main.py`
- `backend/app/ml/model_artifacts/artifact_manifest.json`
- `backend/app/ml/model_artifacts/xgboost_aml_metrics.json`
- `backend/app/utils/rate_limiter.py`
- `frontend/src/components/shared/states.tsx`

This analysis reflects the content of these files as currently on disk
(including the in-progress changes), not the last committed state.
