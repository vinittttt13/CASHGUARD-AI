# Changelog

All notable changes to CASHGUARD-AI. Newest first.

## [Unreleased] — AML transaction detection: complete the feature end-to-end

### Added
- Trained a real `xgboost_aml.pkl` model artifact from the actual dataset
  (`dataset/HI-Small_Trans.csv`) — the endpoint now serves genuine XGBoost
  predictions instead of only the heuristic fallback. Not committed to git
  (matches the existing convention for all other model artifacts; the
  metrics file is committed instead). See `docs/AML_FEATURE_REPORT.md` for
  the honest, freshly-measured metrics (ROC-AUC 0.9847, recall 89.98%,
  precision 45.68%) and full reproduction instructions.
- Frontend integration: `frontend/src/components/analytics/aml-transaction-panel.tsx`,
  wired into the Analytics page as a new "AML Transaction Risk Analysis"
  card (not a new route). Form → API → risk badge, with an explicit,
  never-mislabeled model-source indicator (real model vs. heuristic
  fallback) and an expandable section stating the precision/recall
  tradeoff in plain language.
- `backend/tests/test_train_aml.py` (11 tests) — `train_aml.py` coverage
  0% → 99%, using small synthetic fixtures rather than the real 475MB
  dataset.
- `backend/tests/test_aml_api.py` (9 tests) — HTTP-level coverage of
  `POST /api/v1/predict/aml-transaction` that the pre-existing
  `test_aml_xgboost.py` (model/service layer only) didn't have: auth,
  validation errors, boundary values, and an explicit proof the endpoint
  never reports `"xgboost_aml"` when a result actually came from the
  heuristic fallback.
- `frontend/src/components/analytics/__tests__/aml-transaction-panel.test.tsx`
  (7 tests) and one new Playwright e2e test in `frontend/e2e/dashboard.spec.ts`
  driving the full real workflow against a live `docker compose` stack.
- `docs/AML_FEATURE_REPORT.md` (new) and a new §5.3 in
  `docs/BACKEND_API_REFERENCE.md` documenting the endpoint contract.

### Fixed
- `backend/app/ml/train_aml.py` used `Any` in a type annotation without
  importing it — masked at runtime by `from __future__ import annotations`
  but a real `ruff` F821 failure. Added the import.
- `frontend/src/components/analytics/aml-transaction-panel.tsx` had two
  unescaped-entity ESLint errors (`react/no-unescaped-entities`) that
  `next build`'s lint pass catches but bare `next lint` didn't surface
  locally — would have broken the Docker frontend build. Fixed.
- Reformatted 11 files (mine and the original AML commit's) with
  `black`/`ruff --fix` to match the rest of the backend.

## [Unreleased] — test coverage: every previously-0%-covered module

### Added
- `backend/tests/test_alert_service.py`, `test_aml_preprocessor.py`,
  `test_redis_client.py`, `test_websocket_manager.py` — these four modules
  had **zero** test coverage (`app/services/alert_service.py`,
  `app/ml/aml_preprocessor.py`, `app/core/redis_client.py` were at 0/35%,
  `app/services/websocket_manager.py` at 25%). Backend line coverage moved
  from 69% → 79% (149 passing tests, up from 79).
- `backend/tests/test_prophet_model.py` — `app/ml/prophet_model.py` was
  also at 0%; tests are written and pass, but are skipped with a clear
  reason (`CmdStan not installed`) rather than faked, matching the
  already-documented Prophet/CmdStan gap (`docs/PROJECT_RUN_OBSTACLES.md`).
- `mcp/tests/` (new — the MCP tool server had no test infrastructure at
  all: no venv, no pytest, no tests). 63 tests, 95% coverage of
  `mcp/server.py`, run in an isolated `mcp/venv` (installing MCP's own
  `requirements.txt` into the shared backend venv pulled in an incompatible
  `starlette`/`pydantic` and had to be reverted — kept fully separate this
  time). `.github/workflows/ci.yml` gained an `mcp-test` job.
- Frontend unit tests for the three previously-untested top-level pages:
  `src/app/analytics/__tests__/analytics-page.test.tsx`,
  `src/app/intelligence/__tests__/intelligence-page.test.tsx`,
  `src/app/settings/__tests__/settings-page.test.tsx` (21 new tests).
  `src/test/setup.ts` gained a `ResizeObserver` polyfill — its absence in
  jsdom was silently crashing every recharts-based component and would
  have blocked any future chart test, not just these. Frontend: 47 passing
  tests, up from 26.

### Found, not fixed (out of scope for a test-suite pass — flagged for a
follow-up)
- `frontend/src/app/settings/page.tsx`'s "Generate New Key" button
  (Security tab, admin-only) has no `onClick` handler at all — clicking it
  does nothing. The API key shown is already an explicitly-labeled demo
  value (`cgai_sk_prod_f4k3k3y_d0n0tus31npr0d`), but the button silently
  doing nothing is a real UX gap for whoever eventually wires this up.

## [Unreleased] — stabilization pass: local run, live UI bugs, k8s portability

### Fixed
- **Local run blockers**: `docker-compose.yml` postgres host port now
  configurable (`POSTGRES_HOST_PORT`, default `5433`) so a native Postgres
  on 5432 no longer blocks `docker compose up`. See
  `docs/PROJECT_RUN_OBSTACLES.md`.
- **Frontend build breaks**: duplicate exports in `lib/auth.ts` (bad merge)
  and 3 invalid UTF-8 bytes in `app/settings/page.tsx` that broke the
  Next.js Docker build.
- **Live WebSocket feed** ("Offline" badge, backend 403s on path `/`):
  `NEXT_PUBLIC_WS_URL` is build-time-only for Next.js — a
  `docker-compose.yml` `environment:` entry alone never reached the client
  bundle. `useWebSocket.ts` also dropped the required `/api/v1/ws/live-feed`
  path when the var *was* set. Both fixed; WS now shows "Connected" with a
  clean backend `[accepted]` handshake.
- **Kubernetes deployability**: the same `NEXT_PUBLIC_*` build-time gap
  applied to the k8s frontend Deployment — a ConfigMap there had zero
  effect on an already-built image. Added a genuine runtime-config layer
  (`frontend/docker-entrypoint.sh` regenerates `public/env-config.js` from
  real container env vars on every start; client reads it via
  `window.__ENV__`, see `frontend/src/lib/runtime-env.ts`) so one built
  image now works across environments without a rebuild. Added the
  previously-missing `kubernetes/{backend,frontend}-config.yaml` and
  `kubernetes/{backend,postgres,redis}-secrets.example.yaml` manifests,
  hardened `postgres-statefulset.yaml` and `redis-deployment.yaml`
  (resources, non-root `securityContext`, probes, Redis `--requirepass`)
  to match what `backend-deployment.yaml` already had, and corrected the
  `ghcr.io/yourorg/...` image placeholders to the real repository owner.
- **Leaflet map** rendered blank/grey tiles for any area revealed by
  scrolling the dashboard after mount (`PredictiveMap.tsx`) — added a
  `ResizeObserver`-based `map.invalidateSize()` handler.
- **UI leaking internal ids**: alert cards showed the raw alert UUID as a
  badge and "Ack'd by `<raw-user-uuid>`" after acknowledging (backend only
  returns the acknowledger's id, not a name). Removed both from
  `AlertCard.tsx`.
- **Backend dependency CVEs**: bumped `python-jose` 3.3.0→3.4.0,
  `python-multipart` 0.0.9→0.0.32, `python-dotenv` 1.0.1→1.2.2 (all
  unconstrained by FastAPI's pin range). `starlette` and `pytest` majors
  are still open — `fastapi==0.111.0` strictly pins
  `starlette<0.38.0,>=0.37.2`, and `python-jose` pins `pyasn1<0.5.0`; both
  need a coordinated, separately-tested major-version upgrade, not a
  same-day point bump. `ecdsa`/`nltk` have no fix version published
  upstream yet.
- Backend formatting: `black`/`ruff` now clean across the whole `backend/`
  tree (was previously a `continue-on-error: true` tracked-but-not-blocking
  gap in CI); the `continue-on-error` was removed from `ci.yml` now that
  it's actually enforced.
- `docs/DEVOPS_DEPLOYMENT_GUIDE.md` rewritten — the embedded docker-compose
  snippet had drifted (PostGIS, no `migrate` service, no port config) from
  the real file, and the Kubernetes section didn't mention the
  previously-missing ConfigMap/Secret manifests or the old, wrong
  `flake8`/job-name references to the CI pipeline.

## [Unreleased] — item 4: live data + whole-project test suite

### Added
- `docs/FRONTEND_BACKEND_INTEGRATION.md` (per-screen data map) and
  `docs/TESTING.md` (five-layer test strategy).
- `src/types/api.ts` — types that mirror the FastAPI responses exactly;
  `src/hooks/useApiResource.ts` fetch hook; `src/components/shared/states.tsx`
  (`<Loading>`, `<ErrorState>`, `<EmptyState>`).
- Backend `tests/test_frontend_contract.py` — locks the JSON shapes the screens
  depend on.
- Frontend Vitest: `useApiResource`, `lib/api` path/payload, wired-screen
  render/error/empty (StatsOverview, ComplaintFeed, AlertCenter).
- `scripts/smoke.sh` (curl end-to-end) and Playwright `frontend/e2e/`
  (`auth.setup.ts` + `login.spec.ts` + `dashboard.spec.ts`); CI `e2e` job runs
  both against `docker compose`.

### Changed
- **Every dashboard screen now renders live backend data** instead of mocks:
  Dashboard (stats, complaint feed, predictive map, latest-prediction panel),
  Alerts (list + summary + acknowledge + WS live feed), Analytics (trends,
  geo distribution, confidence gauge, SHAP radar, hotspot table), Intelligence
  (report summary, hotspot grid, state breakdown, trend chart, CSV export).
- `GET /api/v1/complaints/stats/aggregate` returns clean enum keys
  (`{"phishing": 9}` not `{"ComplaintCategory.phishing": 9}`).
- `lib/api.ts` functions are fully typed to `types/api.ts`.

### Removed
- Hard-coded mock arrays from the screen components; unused `ui/calendar.tsx`
  + `ui/popover.tsx` and their deps (`@radix-ui/react-popover`,
  `react-day-picker`).

## [Unreleased] — remediation plan (MT-01 … MT-10)

### Added
- `LICENSE` (MIT), `.editorconfig`, `.gitattributes`, service `.dockerignore`s.
- `GET /health/ready` readiness probe (DB `SELECT 1` + Redis `PING`, 503 on failure).
- Refresh-token rotation (single-use) with the token carried in the request body.
- `dataset/manifest.json` + `dataset/verify.py` for reproducible dataset fetches.
- Object-store model registry (`MODEL_STORE_URI`, s3:// or file://) with a
  training validation gate; `PredictionService` loads store-first.
- `backend/pyproject.toml` (ruff, black, pytest, coverage config).
- Frontend test stack: Vitest + Testing Library + jsdom (`npm run test`), `knip`
  (`npm run lint:dead`).
- CI: dedicated `frontend` job, slow-test leg, `pip-audit` / `npm audit` /
  Trivy, `.github/dependabot.yml`, `.pre-commit-config.yaml`.
- `docs/ROADMAP.md`, `docs/CHANGELOG.md`, `docs/adr/0001-postgis.md`,
  `docs/archive/` for superseded plans and audits.

### Changed
- Frontend login is real (`loginUser` → `accessToken`/`refreshToken`), the
  purpose-built `useWebSocket()` hook is mounted against
  `/api/v1/ws/live-feed`, and `<ErrorBoundary>` wraps the app.
- Schema is Alembic-only: one autogenerated baseline migration, a `migrate`
  compose service / k8s Job, no `create_all` at app startup.
- Rate limiting is enforced (custom resilient middleware); a Redis outage
  degrades to "allow" instead of 500.
- CORS: no wildcard; a non-development `ENVIRONMENT` without `CORS_ORIGINS`
  refuses to start.
- `backend/Dockerfile`: dropped unavailable GDAL apt packages; bakes in
  `en_core_web_sm`; `MPLCONFIGDIR` set.
- `python -m app.ml.train` is runnable; training data comes from the DB via
  `app.ml.data_loader` (no random labels).

### Removed
- PostGIS (image `postgres:15`; no `CREATE EXTENSION postgis`). See ADR 0001.
- `backend/init_db.sql`, `backend/init_db_full.sql` (Alembic is the single
  source of schema truth).
- Dead frontend components/hooks, the duplicate Zustand store and toast hook,
  21 unused npm dependencies.
- Runtime `spacy.cli.download` (model is baked into the image; regex fallback
  otherwise).
