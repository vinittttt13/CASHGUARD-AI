# CASHGUARD-AI / CPAF — Whole-Repository Analysis, Gaps & Improvement Plan

> **Date:** 2026-09-10
> **Scope:** Entire repository (`backend/`, `frontend/`, `mcp/`, `kubernetes/`, `dataset/`, `docs/`, CI, Docker)
> **Method:** Direct source read of every non-vendored file, cross-checked against the existing audit set in `docs/reports/` and `docs/plans/`.
> **Nature of this document:** A fresh, independent pass. It deliberately re-derives findings from source rather than trusting prior plans, and highlights **gaps the earlier v2–v5 plans did not capture** (fake frontend auth, disconnected API layer, dead components, un-enforced rate limiter, broken training entrypoint, missing `.dockerignore`, broken frontend Docker build, no frontend CI).

---

## 1. Executive Summary

CASHGUARD-AI is an ambitious cybercrime / AML predictive-analytics platform: FastAPI + async SQLAlchemy + PostGIS + Redis backend, a Next.js 14 App Router frontend, an ML suite (XGBoost / RandomForest / Prophet / KMeans / SHAP / graph motifs), a dockerized MCP tool server, and Kubernetes manifests. The **backend is in good shape** — real JWT auth with Redis revocation, circuit breaker, PII masking, geospatial BallTree search, and a genuine (if thin) test suite. The **frontend, DevOps pipeline, and ML training path are not production-wired** and contain several blocking defects.

### Severity scoreboard

| Area | Verdict | Headline issue |
|---|---|---|
| Backend API & Auth | 🟢 Solid | Refresh token sent as query param; rate limiter not enforced |
| Frontend | 🔴 Broken wiring | Login is a **mock** (`dummy-auth-token`); real API/auth layer is never called; ~25 dead component files; duplicate stores |
| ML pipeline | 🟠 Not runnable end-to-end | `train.py` uses bare imports → `ImportError` when invoked from repo root; retrain workflow commits the wrong path; no real data loader; no model artifacts → always heuristic fallback |
| Database / migrations | 🟠 Fragile | `create_all` + Alembic both run on every boot; races with 3 replicas; PostGIS advertised but no geometry column on models |
| DevOps / CI | 🔴 Multiple blockers | No `.dockerignore` (backend image bakes in `venv/`, tests, `.env`); frontend Docker build **cannot succeed** (`output: 'standalone'` unset, no `public/`); no frontend job in CI; flake8/black run with no shared config |
| Testing | 🟡 Partial | Good backend unit/integration tests; **zero frontend tests**; `npm run test` referenced in README but not defined |
| Docs | 🟡 Sprawl | 31 docs incl. 5 overlapping "MASTER_IMPROVEMENT_PLAN" versions; README endpoint list is stale; no CHANGELOG / single source of truth |
| Repo hygiene | 🟡 Minor | `frontend/tsconfig.tsbuildinfo` tracked; local `dataset/` is 39 GB; no `LICENSE` file though README says MIT |

---

## 2. Architecture Snapshot (as-built)

```
Next.js 14 (App Router, shadcn/ui, Zustand, SWR, Leaflet)
   │  axios + interceptors (lib/api.ts)  ── NOT wired to UI ──┐
   ▼                                                          │
FastAPI (app/main.py)                                         │
   ├─ /api/v1/auth      JWT (jose) + bcrypt + Redis jti revocation
   ├─ /api/v1/complaints CRUD + PII masking for viewer role
   ├─ /api/v1/predict    PredictionService → FeatureEngineer → ModelRegistry → SHAP
   │                     wrapped in CircuitBreaker, heuristic fallback
   ├─ /api/v1/intelligence  reports / trends / CSV export / fraud-rings
   ├─ /api/v1/locations     BallTree (haversine) nearest-ATM / radius / heatmap
   └─ /api/v1/ws/live-feed  token-authenticated WS + Redis pub/sub relay + heartbeat
   ▼
PostgreSQL (postgis/postgis:15-3.3)  +  Redis 7  (cache, revocation, rate-limit store, WS pub/sub)

Side: mcp/server.py  (FastMCP stdio tools: db inspection, fraud heuristics, redis inspect)
      dataset/       (IBM AML HI/LI CSVs, ~39 GB, gitignored) + dataset/clean_aml_data.py
```

---

## 3. Findings by Domain

### 3.1 Frontend — 🔴 Critical wiring gaps

| # | Severity | File(s) | Finding |
|---|---|---|---|
| F1 | 🔴 Critical | `src/app/(auth)/login/page.tsx:42-55` | Login is entirely simulated: `await new Promise(setTimeout, 1000)` then `localStorage.setItem("token", "dummy-auth-token")`. It never calls `loginUser()` from `lib/api.ts`. **No real authentication exists in the running app.** |
| F2 | 🔴 Critical | `lib/api.ts`, `lib/auth.ts` vs `app/dashboard/layout.tsx:41`, `hooks/useWebSocket.ts:33` | Token key mismatch. `auth.ts`/`api.ts` read/write `accessToken` + `refreshToken`; the layout guard and the dummy login use `token`. The real axios client and refresh-interceptor are dead code in practice. |
| F3 | 🟠 High | `app/dashboard/layout.tsx:47` | Hand-rolled `new WebSocket("ws://localhost:8000/ws/alerts")` — hardcoded host **and wrong path** (backend serves `/api/v1/ws/live-feed`, requires `?token=`). Duplicates the purpose-built `hooks/useWebSocket.ts`, which is never mounted. |
| F4 | 🟠 High | `src/components/**` | ~25 **dead component files**: every PascalCase twin (`StatsOverview.tsx`, `ComplaintFeed.tsx`, `PredictionPanel.tsx`, `ConfidenceGauge.tsx`, `FeatureImportanceRadar.tsx`, `GeographicDistribution.tsx`, `TimeSeriesChart.tsx`, `AlertCard.tsx`, `PredictionForm.tsx`, `RiskScoreCard.tsx`) plus `shared/Header.tsx`, `shared/Sidebar.tsx`, `shared/ThemeToggle.tsx`, `shared/NotificationBell.tsx`, `shared/ErrorBoundary.tsx`, `shared/LoadingSkeleton.tsx`, `map/ATMMarker.tsx`, `map/GeofenceZone.tsx`. Pages import only the kebab-case variants. |
| F5 | 🟠 High | `src/lib/store.ts` vs `src/store/useAppStore.ts`; `src/hooks/use-toast.ts` vs `src/components/ui/use-toast.ts` | Duplicated state/util modules — two Zustand stores, two toast hooks. Pick one of each. |
| F6 | 🟠 High | `hooks/useWebSocket.ts`, `hooks/usePredictions.ts`, `hooks/useAlerts.ts`, `hooks/useMap.ts` | Custom data hooks are unreferenced by any live route (only the dead `NotificationBell` imports `useAlerts`). The app has no live data flow to the backend at all. |
| F7 | 🟠 High | `next.config.js` + `Dockerfile` | `Dockerfile` copies `/app/.next/standalone` and `/app/public`, but `next.config.js` never sets `output: 'standalone'` and there is **no `frontend/public/` directory**. The production image build fails at the `COPY` steps. |
| F8 | 🟡 Medium | `ErrorBoundary` telemetry (per Plan v5) | Implemented but not mounted in `app/layout.tsx`; unhandled render errors still crash the tree. |
| F9 | 🟡 Medium | `lib/auth.ts` | Access + refresh tokens in `localStorage` → exfiltrable via any XSS. Prefer httpOnly cookies (see B3). |
| F10 | 🟡 Medium | `next.config.js:10` | Empty `experimental: {}`; `images.domains` is deprecated in Next 14 (`images.remotePatterns`). |
| F11 | 🟢 Low | `package.json` | No `test` script though README says "Frontend: `npm run test`". `cypress` is a dependency but there is no `cypress/` directory or config. |

### 3.2 Backend & API — 🟢 Mostly solid

| # | Severity | File(s) | Finding |
|---|---|---|---|
| B1 | 🟠 High | `app/main.py:62-63`, `utils/rate_limiter.py` | The `Limiter` is created and its 429 handler registered, but **no `SlowAPIMiddleware` is added and no route carries `@limiter.limit(...)`**. `default_limits=["60/minute"]` is therefore never enforced. |
| B2 | 🟠 High | `api/v1/auth.py:52-56`, `frontend/lib/api.ts:53` | `/auth/refresh` takes `refresh_token` as a **query parameter** → it lands in access logs, proxies, browser history. Move to request body or httpOnly cookie. |
| B3 | 🟡 Medium | `api/v1/auth.py:70-77` | No refresh-token rotation: `/refresh` returns the *same* refresh token. On refresh, mint a new one and revoke the old `jti`. |
| B4 | 🟡 Medium | `api/v1/auth.py:80-98` | `/logout` revokes only the access-token `jti`. The refresh token stays valid until natural expiry (7 days). Revoke both. |
| B5 | 🟡 Medium | `core/redis_client.py:97-100` | `is_token_revoked` **fails open** when Redis is down (comment acknowledges it). For a law-enforcement system, document the risk and consider fail-closed for refresh flows. |
| B6 | 🟡 Medium | `app/main.py:106-112` | `/health` is static — returns `healthy` even if Postgres/Redis are unreachable. K8s `readinessProbe` hits it, so broken pods keep receiving traffic. Add a `/health/ready` that pings DB + Redis. |
| B7 | 🟡 Medium | `app/main.py:66` | CORS default in `core/config.py:14` is `["*"]`; `main.py` silently rewrites `["*"]` to localhost. Make the insecure default explicit/fatal in non-dev, and drive from `CORS_ORIGINS` only. |
| B8 | 🟡 Medium | `services/prediction_service.py`, `services/geospatial_service.py:24-31` | Process-global singletons (module-level `_prediction_service`, `GeospatialService.__new__`). Fine for a single worker; document that `uvicorn --workers >1` gives each worker its own cache/BallTree and there is no cross-worker invalidation. |
| B9 | 🟢 Low | `api/v1/predict.py:129-136` | `/predict/batch` uses `BackgroundTasks` (in-process). Acknowledged as future Celery work in docs; a crash loses the batch. Consider a real queue or at least persistence of "queued" state. |
| B10 | 🟢 Low | `api/v1/websocket.py:74` | Heartbeat timestamp uses `asyncio.get_event_loop().time()` (monotonic, not wall-clock) — confusing to clients; use `datetime.utcnow().isoformat()`. |
| B11 | 🟢 Low | `app/main.py:111` | `datetime.utcnow()` is deprecated in 3.12+; prefer `datetime.now(timezone.utc)` repo-wide (also `core/security.py`). |

### 3.3 Machine Learning — 🟠 Not runnable end-to-end

| # | Severity | File(s) | Finding |
|---|---|---|---|
| M1 | 🔴 Critical | `app/ml/train.py:8-13` | Bare imports (`from feature_engineering import ...`). Running `python backend/app/ml/train.py` from repo root (exactly what `retrain.yml:35` does) raises `ModuleNotFoundError`. Needs `from app.ml.feature_engineering import ...` or a package-relative entrypoint. |
| M2 | 🔴 Critical | `.github/workflows/retrain.yml:41` | Commits `backend/app/ml/models/` but `train.py:96-98` writes to `backend/app/ml/model_artifacts/`, and `.gitignore:58` ignores `backend/app/ml/models/*.pkl`. The retrain job can never persist a model. |
| M3 | 🟠 High | `app/ml/train.py:24-40` | With no `--from-csv`, training fabricates 100 rows with **random `cluster_id` and `risk_level` labels**. The "weekly retrain" therefore produces a model fit to noise. There is no loader that pulls real complaints/locations from the DB (the `env: DATABASE_URL` in the workflow is unused by the script). |
| M4 | 🟠 High | repo | No model artifacts are committed or built anywhere, so `PredictionService._try_load_models()` always finds zero `.pkl` files and every prediction is the `heuristic_fallback` (confidence `0.0`). The ML product is effectively inert at runtime. |
| M5 | 🟡 Medium | `requirements.txt:26` | `spacy==3.7.5` is installed but no model (`en_core_web_sm`) is downloaded in Dockerfile or CI. `NLPExtractor` NER paths silently degrade; `test_ml.py` NER assertions rely on regex fallbacks. |
| M6 | 🟡 Medium | `dataset/clean_aml_data.py` + `docs/IBM_AML_DATASET_INTEGRATION.md` | A 40 GB ETL is documented but there is no scheduled/orchestrated job, no output contract feeding `train.py`, and `dataset/` is gitignored with no DVC / object-store pointer. Reproducibility gap. |
| M7 | 🟢 Low | `app/ml/model_artifacts/.gitkeep` | Directory is version-controlled but empty; add a README describing the expected artifact names (`xgboost_location`, `rf_risk`, `prophet_temporal`, `kmeans_hotspot`) and versioning scheme. |

### 3.4 Database & Migrations — 🟠 Fragile

| # | Severity | File(s) | Finding |
|---|---|---|---|
| D1 | 🟠 High | `core/database.py:30-35` + `app/main.py:19-42` | Every process startup runs `Base.metadata.create_all` **and then** `alembic upgrade head`. With `replicas: 3` (k8s) these race; `create_all` also lets schema drift from migrations silently. Move schema management to a one-shot Job / initContainer and drop `create_all` outside tests. |
| D2 | 🟠 High | `alembic/versions/0001...py` re-run behaviour | On a fresh DB, `create_all` builds tables, then `0001` re-adds `CHECK`/`GIST` objects. On the next restart Alembic is already at head so it's fine, but a partial first run leaves half-applied constraints and the lifespan just logs a warning. First boot is non-deterministic. |
| D3 | 🟠 High | `models/*.py` vs README "w/ PostGIS" | No model declares a `Geometry`/`geography` column. `withdrawal_locations.latitude/longitude` are plain `Float`. The GIST index in `0001` is a functional index on `ST_MakePoint(...)`, and all runtime spatial work is done in Python (`sklearn.BallTree`). PostGIS is essentially unused — either adopt it (indexed `ST_DWithin` queries) or drop the PostGIS image and claim. |
| D4 | 🟡 Medium | `models/withdrawal_location.py`, others | No `__table_args__` indexes on common filters (`is_active`, `state`, `complaint_category`, `status`, `created_at`). Only the manual migration adds a few. Add model-level `index=True` / composite indexes and let Alembic autogenerate. |
| D5 | 🟡 Medium | `backend/init_db.sql` + `backend/init_db_full.sql` | Two hand-maintained DDL files parallel to the ORM and to Alembic — three sources of truth. Generate them from Alembic or delete them. |
| D6 | 🟢 Low | `alembic/` | Only one revision, hand-written. No autogenerate baseline for the core tables, so schema history is incomplete. |

### 3.5 DevOps / CI / Containers — 🔴 Multiple blockers

| # | Severity | File(s) | Finding |
|---|---|---|---|
| O1 | 🔴 Critical | missing `backend/.dockerignore`, `frontend/.dockerignore` | Both Dockerfiles do `COPY . .` with no ignore file. The backend image bakes in `venv/` (present locally), `tests/`, `.pytest_cache/`, `.coverage`, and — critically — any local `.env`. Huge images + potential secret leak into a pushed `ghcr.io` layer. |
| O2 | 🔴 Critical | `frontend/Dockerfile` + `next.config.js` | See F7 — the frontend production image build fails (`.next/standalone` never produced, `public/` absent). CI's `docker-build` job would break on the first `main` push. |
| O3 | 🔴 Critical | `.github/workflows/ci.yml` | **No frontend job.** No `npm ci`, `npm run build`, `npm run lint`, or `tsc --noEmit`. TypeScript/Next errors reach `main` unseen. |
| O4 | 🟠 High | `.github/workflows/ci.yml:22-25` | `flake8 backend` and `black --check backend` run with **no shared config** (`setup.cfg` / `pyproject.toml` / `.flake8` absent). flake8's default 79-col vs black's 88-col guarantees conflicting failures; flake8 will also try to lint anything not excluded. |
| O5 | 🟠 High | `ci.yml:42-89` | The `test` job spins up a Postgres service, but `tests/conftest.py` uses SQLite in-memory and mocks Redis — the services are unused dead cost, and nothing exercises the real Postgres/PostGIS path or Alembic migrations in CI. |
| O6 | 🟠 High | `kubernetes/*.yaml` | `image: ghcr.io/yourorg/cpaf-backend:latest` placeholder ≠ CI's `ghcr.io/${{ github.repository_owner }}/cpaf-backend:latest`. `:latest` + `imagePullPolicy: Always` gives no rollback story. No image digests, no `Deployment` for a versioned tag. |
| O7 | 🟠 High | `kubernetes/postgres-statefulset.yaml` | No `resources` requests/limits, no `securityContext`, no liveness/readiness probes, no `PodDisruptionBudget`. `redis-deployment.yaml` — verify auth/`requirepass`; `docker-compose.yml` Redis has no password and the rate-limiter/pubsub/revocation all trust it. |
| O8 | 🟠 High | k8s | No migration Job/initContainer (ties to D1), no `HorizontalPodAutoscaler`, no `ServiceMonitor`/metrics, `ingress.yaml` — verify TLS + rate limiting at edge. |
| O9 | 🟡 Medium | `docker-compose.yml:40` | `SECRET_KEY` default `your-secret-key-change-in-production` is committed; `mcp` service has hard-coded `cpaf_user:cpaf_pass` inline. Use a single `.env` and `env_file:`. |
| O10 | 🟡 Medium | `retrain.yml:37-42` | Commits model binaries back to git (`git push` from CI on `main`). Model artifacts belong in a registry / object store / release asset, not the repo. |
| O11 | 🟡 Medium | CI | No dependency scanning of `frontend` (`npm audit`), no `pip-audit`/Dependabot/Renovate, no CodeQL, no container image scan (Trivy/Grype), no SBOM. `safety` is installed in `security-scan` but never invoked. |
| O12 | 🟢 Low | `ci.yml:13` etc. | Actions pinned to `@v3`/`@v4` major tags (supply-chain drift). Consider SHA pinning. `actions/checkout@v3` is EOL-ish; move to `@v4`. |

### 3.6 Testing — 🟡 Backend good, frontend absent

| # | Severity | Finding |
|---|---|---|
| T1 | 🟠 High | **Zero frontend tests** and no runner (Jest/Vitest/RTL/Playwright). No component, hook, or e2e coverage. `cypress` dep is unused. |
| T2 | 🟡 Medium | No `pytest.ini`/`pyproject.toml` for pytest — `asyncio_mode`, `testpaths`, coverage `omit`, warning filters all implicit. `--cov-fail-under=70` lives only in the CI command, not in config, so local runs differ. |
| T3 | 🟡 Medium | No test hits the real Postgres/PostGIS behaviour, the Alembic up/down cycle, the WS Redis pub/sub relay across "pods", or the rate limiter. `test_ml.py` needs the full heavy stack (prophet, xgboost, shap, spacy) — slow and brittle; consider marking `@pytest.mark.slow`. |
| T4 | 🟢 Low | `backend/.coverage` present in the working tree (gitignored) — fine, but confirm it never gets committed; add a `make test` target. |
| T5 | 🟢 Low | No load/perf test despite `db_pool_size=50` and "high concurrency" claims; no contract test between `frontend/src/types` and backend Pydantic schemas. |

### 3.7 Documentation — 🟡 Comprehensive but sprawling

| # | Severity | Finding |
|---|---|---|
| DOC1 | 🟡 Medium | `docs/` holds 31 files including **five** near-duplicate roadmaps (`MASTER_IMPROVEMENT_PLAN.md`, `_V3`, `_V4`, `_V5`, plus `IMPLEMENTATION_PLAN_V2`) and six `AUDIT_*.md`. No single "current state / next up" index. Fold historical plans into an `archive/` folder and keep one living `ROADMAP.md` + `CHANGELOG.md`. |
| DOC2 | 🟡 Medium | `README.md:83-88` lists endpoints that don't exist (`GET /api/v1/predictions`, `POST /api/v1/incidents`) and omits the real ones (`/api/v1/predict`, `/api/v1/complaints`, `/api/v1/intelligence/*`, `/api/v1/locations/*`, `/api/v1/ws/live-feed`). |
| DOC3 | 🟡 Medium | `README.md:107` says `npm run test`; no such script. Manual-setup section says Python ≥3.11 but `.pyc` files are `cpython-310` and CI uses 3.11 — pin one. |
| DOC4 | 🟢 Low | `docs/reports/README.md:3` still references an old path `I:/vinit SIH/CASHGUARD-AI`. |
| DOC5 | 🟢 Low | No `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE` file (README claims MIT), `ARCHITECTURE.md` at root, or ADR log. `.env.example` is missing several keys the code reads (`REFRESH_TOKEN_EXPIRE_DAYS`, `DB_POOL_SIZE`, `MAX_PREDICTION_RADIUS_KM`, `NEXT_PUBLIC_WS_URL` is present; `CORS_ORIGINS` format hint would help). |

### 3.8 Repo Hygiene & Security-in-repo — 🟡 Minor

| # | Severity | Finding |
|---|---|---|
| H1 | 🟡 Medium | `frontend/tsconfig.tsbuildinfo` is git-tracked despite `.gitignore:38` (`*.tsbuildinfo`). `git rm --cached` it. |
| H2 | 🟡 Medium | Local `.env` exists with a real 63-char `SECRET_KEY`. It is correctly gitignored — **verify it was never committed in history** (`git log --all -- .env`) and rotate if it was. |
| H3 | 🟡 Medium | Local `dataset/` is **39 GB**. Gitignored, but document acquisition (script + source URL + checksum) and move to DVC or object storage so contributors aren't expected to hold 39 GB. |
| H4 | 🟢 Low | No `LICENSE` file. No `.editorconfig`. No pre-commit hooks (`black`, `ruff`, `isort`, `eslint`, `prettier`, `detect-secrets`). |
| H5 | 🟢 Low | `.claude/`, `.cursor/`, `.agents/`, `.vscode/mcp.json` committed — intentional for the MCP workflow, but note the mixed IDE-config footprint. |

---

## 4. Prioritized Improvement Roadmap

### Phase A — Unblock the build & the demo (days)

1. **Wire real frontend auth.** Replace the mock in `login/page.tsx` with `loginUser()`; standardise on `accessToken` / `refreshToken` everywhere (`auth.ts`, `api.ts`, `dashboard/layout.tsx`, `useWebSocket.ts`). Delete the hand-rolled WS in `layout.tsx` and mount `useWebSocket`. (F1, F2, F3)
2. **Fix the frontend Docker build.** Add `output: 'standalone'` to `next.config.js`, create `frontend/public/` (even with a `.gitkeep` + favicon), add `frontend/.dockerignore`. (F7, O2)
3. **Add `backend/.dockerignore`** (`venv/`, `tests/`, `.pytest_cache/`, `.coverage`, `*.md`, `.env*`, `__pycache__/`). Rebuild and confirm image size drop. (O1)
4. **Fix the training entrypoint.** Convert `app/ml/train.py` imports to `app.ml.*`, invoke as `python -m app.ml.train` from `backend/`, and align `retrain.yml` + `.gitignore` on one artifact path (`model_artifacts/`). (M1, M2)
5. **Add a frontend CI job**: `npm ci && npm run lint && npm run type-check && npm run build`. (O3)
6. **Add flake8/black config** (`pyproject.toml` with `[tool.black]` line-length 88 + `[tool.ruff]` or `.flake8` `max-line-length = 88, extend-ignore = E203`). Consider replacing flake8 with `ruff`. (O4)

### Phase B — Make it correct & safe (1–2 weeks)

7. **Enforce rate limiting**: `app.add_middleware(SlowAPIMiddleware)` and/or `@limiter.limit` on auth + predict routes; test the 429. (B1)
8. **Harden auth**: refresh token in body/cookie, rotate on refresh, revoke both tokens on logout, move frontend tokens to httpOnly cookies. (B2, B3, B4, F9)
9. **Split schema management from app startup**: drop `create_all` in prod, run `alembic upgrade head` from a k8s Job / `initContainer`, generate an autogenerate baseline migration, delete `init_db*.sql` or generate them. (D1, D2, D5, D6)
10. **Real `/health/ready`** that checks DB + Redis; point k8s `readinessProbe` at it; keep `/health` for liveness. (B6)
11. **Decide on PostGIS**: either add a `geography(Point,4326)` column + `ST_DWithin` queries + real GIST index, or remove the PostGIS image/claims and keep the BallTree path. (D3)
12. **Delete dead frontend code** (F4, F5, F6) — one component per concern, one store, one toast hook. Add `knip` or `ts-prune` to CI to prevent regrowth.
13. **k8s hardening**: resource limits + probes + securityContext on Postgres/Redis, real image tags from CI, `PodDisruptionBudget`, `HorizontalPodAutoscaler`, Redis `requirepass` wired to a Secret. (O6, O7, O8)

### Phase C — Make the ML real (2–4 weeks)

14. **DB-backed training loader**: pull complaints + confirmed withdrawal locations, derive `cluster_id` from `HotspotDetector`, derive `risk_level` from a documented rule or labelled data — no random labels. (M3)
15. **Model registry to object storage** (S3/GCS/MLflow), loaded at boot; CI/retrain publishes there, not to git. Version + validation gate via existing `model_validation.py`. (M4, O10)
16. **spaCy model** in Dockerfile/CI (`python -m spacy download en_core_web_sm`) or pin to the regex path explicitly. (M5)
17. **Dataset reproducibility**: DVC remote or documented download + checksum; wire `dataset/clean_aml_data.py` output into the training contract. (M6, H3)

### Phase D — Quality bars & polish (ongoing)

18. **Frontend test stack**: Vitest + React Testing Library for components/hooks, Playwright for the login→dashboard→prediction e2e; add `test` script; wire into CI. (T1)
19. **`pyproject.toml` for pytest/coverage**; mark heavy ML tests `slow`; add a Postgres+Alembic integration job. (T2, T3)
20. **Supply-chain**: Dependabot/Renovate, `pip-audit`, `npm audit`, Trivy image scan, actually run `safety`, CodeQL, SBOM. (O11)
21. **Docs consolidation**: `docs/archive/` for v2–v5 plans, one `ROADMAP.md`, one `CHANGELOG.md`, fix README endpoint list & versions, add `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `.editorconfig`, pre-commit. (DOC1–DOC5, H1, H4)

---

## 5. Quick-Wins Checklist (each < 30 min)

- [ ] `git rm --cached frontend/tsconfig.tsbuildinfo`
- [ ] Add `LICENSE` (MIT, per README)
- [ ] Add `backend/.dockerignore` and `frontend/.dockerignore`
- [ ] `output: 'standalone'` in `next.config.js`; add `frontend/public/.gitkeep`
- [ ] Add `"test"` script to `frontend/package.json` (even if it just runs Vitest once configured)
- [ ] Fix `README.md` endpoint list and Python version; fix stale path in `docs/reports/README.md`
- [ ] `pyproject.toml` with `[tool.black]`/`[tool.ruff]` line-length 88
- [ ] Rename/settle token key: global search-replace `localStorage 'token'` → `'accessToken'`
- [ ] `.env.example`: add `REFRESH_TOKEN_EXPIRE_DAYS`, `DB_POOL_SIZE`, `MAX_PREDICTION_RADIUS_KM`; generate `SECRET_KEY` note
- [ ] `retrain.yml`: change `git add backend/app/ml/models/` → `model_artifacts/` (or better, stop committing models)
- [ ] Verify `.env` never entered git history; rotate `SECRET_KEY` if it did
- [ ] Add `SlowAPIMiddleware` (one line) to actually enable the configured limiter

---

## 6. What's Already Good (keep it)

- Real JWT auth with bcrypt, `jti` claims, and Redis-backed refresh revocation (`core/security.py`, `core/redis_client.py`).
- Circuit breaker with CLOSED→OPEN→HALF_OPEN state machine and honest heuristic fallback instead of fabricated predictions (`utils/circuit_breaker.py`, `services/prediction_service.py`).
- Thorough PII masking (phone/name/account/UPI/IBAN/wallet/PAN/Aadhaar/card/email) with unit tests (`utils/anonymizer.py`, `tests/test_anonymizer.py`).
- Multi-stage, non-root backend Dockerfile with wheel caching.
- WebSocket auth + Redis pub/sub relay for multi-pod broadcast + heartbeat (`api/v1/websocket.py`, `services/websocket_manager.py`).
- Genuine backend test suite: async httpx integration tests, circuit-breaker, feature-engineering leakage tests, model-registry rollback, fraud-ring detection.
- Well-sandboxed MCP server (readonly session, keyword denylist, statement timeout, identifier regex) — `mcp/server.py`.
- Existing audit trail in `docs/reports/` and `docs/plans/` shows disciplined iteration.

---

*Generated from a full source read on 2026-09-10. Line references are to the repository state at commit `98e2536`.*
