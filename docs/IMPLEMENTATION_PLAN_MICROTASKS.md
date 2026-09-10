# CASHGUARD-AI — Remediation Plan: 10 Microtasks across 6 Phases

> **Date:** 2026-09-10
> **Source:** Derived from `docs/REPO_ANALYSIS_AND_IMPROVEMENTS.md` (commit `98e2536` / analysis commit `9744180`).
> **Goal:** Turn the identified gaps into 10 self-contained, independently reviewable microtasks, sequenced into 6 phases by dependency and risk.
> **Legend:** Effort — S ≈ ½ day, M ≈ 1–2 days, L ≈ 3–5 days. Each microtask = one PR.

---

## Phase & Microtask Map

| Phase | Theme | Microtasks | Gate to exit phase |
|---|---|---|---|
| **P1** | Unblock the build | MT-01, MT-02 | `docker compose build` succeeds for both services; images are lean |
| **P2** | Reconnect the frontend | MT-03, MT-04 | Real login → dashboard → live data works against local backend |
| **P3** | Harden the backend | MT-05, MT-06 | Rate limit + refresh-token flow covered by passing tests |
| **P4** | Fix schema management | MT-07 | Fresh DB provisioned only by Alembic; no `create_all` in prod path |
| **P5** | Make the ML real | MT-08, MT-09 | `python -m app.ml.train` produces validated artifacts loaded at boot |
| **P6** | Guardrails & docs | MT-10 | Frontend CI green; docs consolidated; quick-wins closed |

```
P1 ──▶ P2 ──▶ P3 ──▶ P6
 │            P4 ──▶ P6
 └──▶ P5 ─────────▶ P6
```
P3, P4 and P5 are independent of each other and may run in parallel once P1 (and P2 for anything UI-facing) lands. P6 closes last.

---

## PHASE 1 — Unblock the Build

Nothing else can be validated in a container until these land.

### MT-01 — Repository hygiene & Docker build context

| | |
|---|---|
| **Fixes** | O1, H1, H4, DOC5 (LICENSE), O9 (partial) |
| **Effort** | S |
| **Depends on** | — |
| **Branch** | `chore/repo-hygiene-dockerignore` |

**Objective:** Stop shipping junk into git and into images; add the baseline project files a reviewer expects.

**Files:**
- `backend/.dockerignore` (new)
- `frontend/.dockerignore` (new)
- `.dockerignore` (repo root, new — for any root-context builds)
- `LICENSE` (new — MIT, matches `README.md`)
- `.editorconfig` (new)
- `.gitignore` (append if needed)
- Untrack `frontend/tsconfig.tsbuildinfo`

**Steps:**
1. `git rm --cached frontend/tsconfig.tsbuildinfo` (already in `.gitignore` as `*.tsbuildinfo`).
2. `backend/.dockerignore`:
   ```
   venv/
   .venv/
   __pycache__/
   *.pyc
   .pytest_cache/
   .coverage
   htmlcov/
   tests/
   *.md
   .env
   .env.*
   .git/
   alembic/versions/__pycache__/
   ```
3. `frontend/.dockerignore`:
   ```
   node_modules/
   .next/
   .git/
   .env.local
   *.md
   cypress/
   coverage/
   ```
4. `LICENSE` — standard MIT text, `Copyright (c) 2026 CASHGUARD-AI contributors`.
5. `.editorconfig` — 2-space TS/JS/YAML, 4-space Python, LF, trim trailing whitespace, final newline.
6. Confirm nothing that *must* ship is excluded (e.g. `backend/alembic/versions/*.py` must remain — only ignore their `__pycache__`).

**Acceptance criteria:**
- `git ls-files | grep tsbuildinfo` returns nothing.
- `docker build backend/` context size (shown in build log `transferring context`) drops materially vs. before (target: < 5 MB, no `venv/`).
- Backend image `docker run --rm <img> ls /app` shows **no** `venv/`, `tests/`, `.env`.
- `LICENSE` present at repo root.

**Risks:** Over-broad `.dockerignore` could drop a needed file — verify the backend still boots (`docker compose up backend`) after the change.

---

### MT-02 — Make the frontend production image build

| | |
|---|---|
| **Fixes** | F7, O2, F10 |
| **Effort** | S |
| **Depends on** | MT-01 (`.dockerignore` in place) |
| **Branch** | `fix/frontend-docker-standalone` |

**Objective:** `frontend/Dockerfile` currently copies `.next/standalone` and `public/`, neither of which is produced. Fix the config so the multi-stage build works.

**Files:**
- `frontend/next.config.js`
- `frontend/public/` (new dir + `favicon.ico` + `.gitkeep`)
- `frontend/Dockerfile` (verify only)

**Steps:**
1. In `next.config.js` add `output: 'standalone'`; remove empty `experimental: {}`; migrate `images.domains` → `images.remotePatterns`.
2. Create `frontend/public/` with a `favicon.ico` (placeholder acceptable) and `.gitkeep`.
3. Verify `Dockerfile` runner stage: `COPY --from=builder /app/public ./public` and `.next/standalone` + `.next/static` copies now resolve.
4. Local check: `cd frontend && npm run build` → confirm `.next/standalone/server.js` exists.
5. `docker build -t cpaf-frontend:test frontend/` then `docker run -p 3000:3000 cpaf-frontend:test` → `curl -f localhost:3000`.

**Acceptance criteria:**
- `npm run build` emits `.next/standalone/server.js`.
- `docker build frontend/` completes; container healthcheck (`wget --spider localhost:3000`) passes.
- No Next build warnings about deprecated `images.domains`.

**Risks:** `standalone` output needs `NEXT_PUBLIC_*` vars at build time for anything inlined — keep runtime env for API URL (`next.config.js` `env` block already passes `NEXT_PUBLIC_API_URL`).

---

## PHASE 2 — Reconnect the Frontend

The UI currently runs on a fake token and never talks to the backend.

### MT-03 — Real authentication + unified token handling + live WebSocket

| | |
|---|---|
| **Fixes** | F1, F2, F3, F6, F8, F9 (partial), B10 client side |
| **Effort** | M |
| **Depends on** | MT-02 |
| **Branch** | `feat/frontend-real-auth` |

**Objective:** Replace the simulated login with a real one, standardise on one token storage scheme, and mount the purpose-built `useWebSocket` hook against the correct endpoint.

**Files:**
- `frontend/src/app/(auth)/login/page.tsx`
- `frontend/src/lib/auth.ts`
- `frontend/src/lib/api.ts` (verify interceptor)
- `frontend/src/app/dashboard/layout.tsx`
- `frontend/src/hooks/useWebSocket.ts`
- `frontend/src/app/layout.tsx` (mount `ErrorBoundary`)
- `frontend/src/components/shared/ErrorBoundary.tsx` (keep this one; see MT-04)

**Steps:**
1. **Login:** in `onSubmit`, call `loginUser({ email, password })`; on success `setToken(data.access_token)` + `setRefreshToken(data.refresh_token)`; toast + `router.push('/dashboard')`; on `401` show the destructive toast. Remove the `setTimeout` and `"dummy-auth-token"`.
2. **Token keys:** pick `accessToken` / `refreshToken` (already used by `auth.ts` + `api.ts`). Update `dashboard/layout.tsx` guard to `getToken()` from `lib/auth`. Update `useWebSocket.ts` to read `getToken()` only (drop the `'token'` / `'anonymous'` fallbacks).
3. **WebSocket:** delete the hand-rolled `new WebSocket("ws://localhost:8000/ws/alerts")` block in `dashboard/layout.tsx`. Mount `useWebSocket()` in the dashboard layout (or a client provider). Confirm it targets `NEXT_PUBLIC_WS_URL` + `/api/v1/ws/live-feed?token=`.
4. **Route guard:** on missing/expired token (`isAuthenticated()` from `auth.ts`) redirect to `/login`.
5. **ErrorBoundary:** wrap `{children}` in `app/layout.tsx` with `src/components/shared/ErrorBoundary.tsx`.
6. **401 handling:** verify `api.ts` response interceptor refresh path works with the new keys and that a failed refresh calls `clearAuth()` + redirect.

**Acceptance criteria:**
- Manual e2e: start `docker compose up`, seed a user (`backend/seed_db.py`), log in with real creds → land on `/dashboard`; wrong creds → error toast, stay on `/login`.
- `localStorage` after login contains `accessToken` + `refreshToken`, **not** `token`.
- DevTools → Network → WS shows one connection to `/api/v1/ws/live-feed?token=…` that receives `initial_state` then `heartbeat`.
- Throwing in a child component shows the ErrorBoundary fallback, not a white screen.
- `grep -rn "dummy-auth-token\|/ws/alerts" frontend/src` → no matches.

**Risks:** Backend `/auth/login` expects JSON `{email, password}` (confirmed in `api/v1/auth.py`) — `loginUser` already sends that. WS token must be a valid JWT or the socket closes with 1008; the reconnect cap (5) will then stop it — acceptable.

---

### MT-04 — Remove dead frontend code & consolidate duplicates

| | |
|---|---|
| **Fixes** | F4, F5, F11 (partial), DOC1 (frontend side) |
| **Effort** | M |
| **Depends on** | MT-03 (so we know which components are truly live) |
| **Branch** | `refactor/frontend-dead-code` |

**Objective:** One component per concern, one store, one toast hook; add automated dead-code detection so it does not regrow.

**Files (delete unless an import survives MT-03):**
- PascalCase twins: `components/dashboard/{StatsOverview,ComplaintFeed,PredictionPanel,PredictionForm,RiskScoreCard}.tsx`, `components/analytics/{ConfidenceGauge,FeatureImportanceRadar,GeographicDistribution,TimeSeriesChart}.tsx`, `components/alerts/AlertCard.tsx`
- `components/shared/{Header,Sidebar,ThemeToggle,NotificationBell,LoadingSkeleton}.tsx` (keep any actually referenced — re-check with grep)
- `components/map/{ATMMarker,GeofenceZone}.tsx` if unreferenced
- Duplicate modules: `src/lib/store.ts` **or** `src/store/useAppStore.ts` (keep `store/useAppStore.ts` — it has `persist`); `src/hooks/use-toast.ts` **or** `src/components/ui/use-toast.ts` (keep the shadcn `components/ui/use-toast.ts`)
- Unused hooks: `hooks/{usePredictions,useAlerts,useMap}.ts` — keep only if a live page imports them

**Steps:**
1. `npx knip` (or `npx ts-prune`) to list unused exports/files. Cross-check with `grep -rn "<name>" frontend/src`.
2. Delete confirmed-dead files. Update any lingering imports to the surviving module.
3. Collapse the two stores: ensure all consumers import `@/store/useAppStore`; delete `lib/store.ts` (or migrate its `AuthState` slice into `useAppStore` if used).
4. Collapse the two toast hooks: standardise on `@/components/ui/use-toast`.
5. Add `knip` to `devDependencies` and a `lint:dead` script; wire into CI in MT-10.
6. `npm run build` + `npm run type-check` must pass after deletions.

**Acceptance criteria:**
- `npx knip` reports zero unused files (or an explicit, reviewed allowlist).
- `npm run build` and `tsc --noEmit` pass.
- Exactly one Zustand store and one `use-toast` in the tree.
- Bundle: no size regression (spot-check `.next` analyze if configured).

**Risks:** A "dead" component might be intended for an unbuilt page — confirm with the dashboard/analytics/intelligence route files before deleting; anything ambiguous goes to a `components/_wip/` folder with a tracking note rather than deletion.

---

## PHASE 3 — Harden the Backend

### MT-05 — Enforce rate limiting

| | |
|---|---|
| **Fixes** | B1 |
| **Effort** | S |
| **Depends on** | — (independent; can start after P1) |
| **Branch** | `fix/enforce-rate-limiter` |

**Objective:** The `slowapi` `Limiter` is configured but never applied. Turn it on.

**Files:**
- `backend/app/main.py`
- `backend/app/api/v1/auth.py`, `backend/app/api/v1/predict.py` (targeted limits)
- `backend/tests/test_api.py` (new test)
- `backend/app/utils/rate_limiter.py` (verify Redis storage fallback)

**Steps:**
1. `from slowapi.middleware import SlowAPIMiddleware` and `app.add_middleware(SlowAPIMiddleware)` in `main.py` (after `app.state.limiter = limiter`).
2. Add explicit limits where abuse matters: `@limiter.limit("5/minute")` on `/auth/login`, `@limiter.limit("10/minute")` on `/predict`. These handlers need `request: Request` in the signature (`/predict` already has it; add to `login`).
3. Keep the global `60/minute` default for everything else.
4. Confirm `rate_limiter.py` degrades to in-memory when `REDIS_URL` is unreachable (wrap `storage_uri` selection in try/except or use `slowapi`'s memory fallback) so tests without Redis still pass.
5. Test: hammer `/auth/login` 6× in a test → assert the 6th returns `429` with the slowapi detail shape.

**Acceptance criteria:**
- New test `test_login_rate_limited` passes.
- `GET /` beyond 60/min in a manual loop returns `429`.
- Existing test suite still green (Redis mocked → in-memory limiter).

**Risks:** In-memory limiter state leaks across tests → add an autouse fixture that resets `limiter._storage` between tests, or scope limits so normal tests stay under threshold.

---

### MT-06 — Harden the auth lifecycle + real readiness probe

| | |
|---|---|
| **Fixes** | B2, B3, B4, B5 (document), B6, B7, F9 (server side) |
| **Effort** | M |
| **Depends on** | MT-03 (frontend must move with the refresh-token transport change) |
| **Branch** | `feat/auth-hardening` |

**Objective:** Move the refresh token off the URL, rotate it on use, revoke both tokens on logout, and give Kubernetes a truthful readiness signal.

**Files:**
- `backend/app/api/v1/auth.py`
- `backend/app/core/security.py`
- `backend/app/core/redis_client.py`
- `backend/app/main.py` (`/health/ready`)
- `backend/app/core/config.py` (CORS default)
- `frontend/src/lib/api.ts` (refresh call: body not query)
- `backend/tests/test_api.py`
- `kubernetes/backend-deployment.yaml` (point `readinessProbe` at `/health/ready`)

**Steps:**
1. **Refresh transport:** change `/auth/refresh` to accept a Pydantic body `{ refresh_token: str }` (or an httpOnly cookie). Update `frontend/lib/api.ts` to `POST` the token in the body.
2. **Rotation:** on `/refresh`, mint a new refresh token **and** `revoke_token(old_jti, ttl_days=refresh_token_expire_days)`; return the new one. Update the frontend to store it.
3. **Logout:** revoke both the access `jti` and (if presented) the refresh `jti`. Accept the refresh token in the logout body.
4. **Readiness:** add `GET /health/ready` that does `SELECT 1` via a short-lived session and `redis_client.ping()` with a 2 s timeout; return `503` on failure. Keep `/health` as the static liveness check.
5. **CORS:** in `config.py`, default `cors_origins` to `[]` (not `["*"]`); make `main.py` raise on empty in non-dev, or require `CORS_ORIGINS` env. Remove the silent `["*"]→localhost` rewrite.
6. **Docs:** add a comment/section noting `is_token_revoked` fail-open behaviour and when to switch to fail-closed.
7. Tests: refresh returns a *different* refresh token; old refresh token is rejected after one use; logout then refresh → `401`; `/health/ready` returns `503` when DB dependency override raises.

**Acceptance criteria:**
- `grep -rn "params.*refresh_token" frontend/src` → none; refresh travels in the body.
- Test suite covers: rotation, single-use old token, dual revoke on logout, `/health/ready` failure path.
- `kubernetes/backend-deployment.yaml` `readinessProbe.httpGet.path: /health/ready`.
- Boot with no `CORS_ORIGINS` set in a "prod" env fails fast with a clear message.

**Risks:** Rotation + the frontend's axios retry interceptor can race on parallel 401s (multiple requests each trying to refresh). Add a single-flight refresh promise in `api.ts` as part of this task.

---

## PHASE 4 — Fix Schema Management

### MT-07 — Split schema management from app startup + Alembic baseline + PostGIS decision

| | |
|---|---|
| **Fixes** | D1, D2, D3, D4, D5, D6, O8 (migration job) |
| **Effort** | L |
| **Depends on** | — (independent; needs a running Postgres for verification) |
| **Branch** | `refactor/schema-alembic-only` |

**Objective:** One source of schema truth (Alembic). Remove `create_all` from the production path, generate a proper baseline, add missing indexes, and make an explicit call on PostGIS.

**Files:**
- `backend/app/core/database.py` (`init_db`)
- `backend/app/main.py` (lifespan)
- `backend/alembic/versions/` (new baseline migration + index migration)
- `backend/app/models/*.py` (`__table_args__` indexes; optionally `Geometry` column)
- `backend/init_db.sql`, `backend/init_db_full.sql` (delete or regenerate)
- `kubernetes/` (new `migration-job.yaml` / initContainer)
- `docker-compose.yml` (migration step)
- `backend/tests/` (Alembic up/down test — optional, Postgres-gated)

**Steps:**
1. **Decide PostGIS** (record as an ADR):
   - **Option A (adopt):** add `geoalchemy2`, give `withdrawal_locations` and `complaints` a `geography(Point, 4326)` column kept in sync with lat/lng (trigger or app-level), replace the Python radius filter in `geospatial_service.py` hot paths with `ST_DWithin`, keep the real GIST index.
   - **Option B (drop):** remove `postgis/postgis` → `postgres:15`, delete the `CREATE EXTENSION postgis` + `ST_MakePoint` index from migration `0001`, keep `BallTree`, update README to stop claiming PostGIS.
   - Default recommendation: **Option B now**, Option A as a later epic — less risk for the hackathon timeline.
2. **Baseline migration:** on an empty DB, `alembic revision --autogenerate -m "baseline schema"` so every table is represented in version history (currently only `0001` constraints exist). Re-order so `0001` (constraints/indexes) depends on the baseline.
3. **Indexes:** add `index=True` / composite `Index()` in `__table_args__` for `complaints.status`, `complaints.complaint_category`, `complaints.state`, `complaints.created_at`, `withdrawal_locations.is_active`, `predictions.complaint_id`, `predictions.created_at`. Autogenerate the migration.
4. **Startup:** `init_db()` keeps `create_all` **only** under a `TESTING` flag (used by `conftest.py`); production lifespan no longer creates tables or runs `alembic upgrade`. Remove the in-lifespan `command.upgrade(...)` block.
5. **Migration runner:** add `kubernetes/migration-job.yaml` (a `Job` running `alembic upgrade head`) and/or an initContainer on the backend Deployment; add a `migrate` service or `command` override in `docker-compose.yml` that runs before `backend`.
6. **SQL files:** delete `init_db.sql` / `init_db_full.sql`, or replace with a generated dump + a `seed_db.py`-driven seed. Update `docs/reports/VERIFICATION_LOG.md`.
7. Verify: drop DB → run migration job → `alembic current` == head → app boots read-only against the schema → `alembic downgrade base` → `upgrade head` clean.

**Acceptance criteria:**
- Fresh Postgres provisioned **only** by `alembic upgrade head` (no `create_all`) boots the app with all endpoints working.
- `alembic downgrade base && alembic upgrade head` runs clean twice in a row (idempotent).
- `grep -rn "create_all" backend/app` appears only in a test-guarded branch.
- ADR file committed under `docs/adr/0001-postgis.md`.
- `init_db*.sql` removed or regenerated + documented.
- 3-replica rollout no longer races (only the Job touches schema).

**Risks:** Autogenerate against SQLite-shaped models can miss server defaults / enums — run autogenerate against real Postgres. `JSONB` columns compile to `JSON` on SQLite via the existing `conftest.py` shim; keep that shim.

---

## PHASE 5 — Make the ML Real

### MT-08 — Fix the training entrypoint, retrain workflow & DB-backed data loader

| | |
|---|---|
| **Fixes** | M1, M2, M3 |
| **Effort** | L |
| **Depends on** | MT-07 (stable schema to query) |
| **Branch** | `fix/ml-training-entrypoint` |

**Objective:** Make `train.py` runnable from the repo root as the CI invokes it, and feed it real data instead of random labels.

**Files:**
- `backend/app/ml/train.py`
- `backend/app/ml/__init__.py`
- `backend/app/ml/data_loader.py` (new)
- `.github/workflows/retrain.yml`
- `.gitignore` (artifact path alignment)
- `backend/app/ml/model_artifacts/README.md` (new)

**Steps:**
1. **Imports:** change `from feature_engineering import ...` → `from app.ml.feature_engineering import ...` for every sibling import. Add `def main()` guarded entrypoint that works as `python -m app.ml.train` from `backend/`.
2. **retrain.yml:** run `cd backend && python -m app.ml.train --production` (with `PYTHONPATH=.`); change the commit/publish step to the real artifact path (`backend/app/ml/model_artifacts/`) — but prefer publishing to storage (MT-09) rather than `git push`.
3. **Path alignment:** `.gitignore` currently ignores `backend/app/ml/models/*.pkl` while `train.py` writes `model_artifacts/`. Standardise on `model_artifacts/`, ignore `model_artifacts/*.pkl` locally, keep `model_artifacts/README.md` tracked.
4. **`data_loader.py`:** `load_training_frame(db_url) -> pd.DataFrame` that pulls `complaints` (joined to any confirmed `withdrawal_locations`) into the columns `FeatureEngineer` expects (`timestamp, lat, lng, complaint_text, amount, state, district, category, bank_name`). Derive `cluster_id` from `HotspotDetector.fit(...).predict_cluster(...)` on historical withdrawal coords; derive `risk_level` from a **documented rule** (amount thresholds + incident density) until labelled data exists — no `np.random`.
5. Keep a `--from-csv` path and a tiny synthetic fixture for smoke tests, clearly labelled as non-production.
6. Add `backend/tests/test_train_smoke.py` (marked `slow`): run `main(["--from-csv", fixture])` end-to-end, assert 4 artifacts written and each loads.

**Acceptance criteria:**
- `cd backend && python -m app.ml.train --from-csv tests/fixtures/mini_train.csv` completes and writes `xgboost_location`, `rf_risk`, `prophet_temporal`, `kmeans_hotspot` artifacts.
- `retrain.yml` dry-run (workflow_dispatch on a branch) reaches the training step without `ModuleNotFoundError`.
- `grep -rn "np.random" backend/app/ml/train.py` → none in the production branch.
- `data_loader` unit test passes against the SQLite test DB.

**Risks:** Real complaint volume may be tiny in dev → training must not crash on `n < test_size`; guard splits and Prophet's `len > 2` check (already present). Document the minimum row count.

---

### MT-09 — Model artifact storage, spaCy model & dataset reproducibility

| | |
|---|---|
| **Fixes** | M4, M5, M6, M7, O10, H3 |
| **Effort** | M |
| **Depends on** | MT-08 |
| **Branch** | `feat/ml-artifact-registry` |

**Objective:** Stop committing binaries to git; load validated models at boot from a real store; make NER deterministic; make the 39 GB dataset reproducible.

**Files:**
- `backend/app/ml/model_registry.py` (load/save to object storage)
- `backend/app/services/prediction_service.py` (`_try_load_models` from store)
- `backend/Dockerfile`, `.github/workflows/ci.yml`, `retrain.yml` (spaCy model)
- `.github/workflows/retrain.yml` (publish to store + validation gate)
- `dataset/README.md` (new) + `dataset/clean_aml_data.py` (output contract)
- `.dvc/` or `dataset/.gitignore` + a `dataset/manifest.json` with source URLs + SHA256

**Steps:**
1. **Storage:** extend `ModelRegistry` with `save_to_store(uri)` / `load_from_store(uri)` for S3/GCS (boto3/gcsfs) or MLflow. Env: `MODEL_STORE_URI`. Keep local-disk as the dev fallback.
2. **Boot load:** `PredictionService._try_load_models()` tries `MODEL_STORE_URI` first, then local `model_artifacts/`. Log which path won and the loaded versions.
3. **Validation gate:** in `retrain.yml`, after training, run `model_validation.ModelValidator` (min accuracy/F1) — only publish to the store if it passes; tag with `--model-version` + git SHA.
4. **spaCy:** add `python -m spacy download en_core_web_sm` to `backend/Dockerfile` and the CI/retrain dependency step; OR set `NLPExtractor` to the regex path explicitly and remove `spacy` from `requirements.txt`. Pick one and note it.
5. **Dataset:** write `dataset/README.md` — where the IBM AML CSVs come from, exact files, sizes, SHA256 (`dataset/manifest.json`), and the command to fetch them. Optionally init DVC with a remote. Ensure `dataset/clean_aml_data.py` writes a stable, documented output schema that `data_loader.py` (MT-08) can consume.
6. Remove any model `.pkl` from git history plan (note in PR; actual history rewrite is out of scope / separate task).

**Acceptance criteria:**
- With `MODEL_STORE_URI` set and artifacts present, `/predict` returns `model_name != "heuristic_fallback"` and a non-zero `confidence_score` for a seeded complaint.
- With the store empty, `/predict` still works (honest heuristic fallback) — no crash.
- CI/retrain image can run `NLPExtractor` NER without a missing-model warning (or the regex path is the documented design).
- `retrain.yml` publishes to the store only when validation passes; nothing is `git push`ed.
- `dataset/README.md` + `manifest.json` let a new contributor fetch and verify the data without holding 39 GB in the repo.

**Risks:** Object-store creds in CI — use OIDC / repo secrets, never inline. Keep the local-disk fallback so contributors without cloud creds can still run the app.

---

## PHASE 6 — Guardrails & Documentation

### MT-10 — Frontend CI, lint config, frontend test stack & docs consolidation

| | |
|---|---|
| **Fixes** | O3, O4, O5, O11, O12, T1, T2, T4, DOC1, DOC2, DOC3, DOC4, F11 |
| **Effort** | L |
| **Depends on** | MT-02 (buildable frontend), MT-04 (dead code gone), ideally MT-03 (for e2e) |
| **Branch** | `ci/frontend-and-quality-gates` |

**Objective:** No frontend code reaches `main` unchecked; Python lint is consistent; there is a real frontend test stack; the docs have one entry point.

**Files:**
- `.github/workflows/ci.yml` (new `frontend` job; fix `test` job; add scanners)
- `pyproject.toml` (new — `[tool.black]`, `[tool.ruff]`, `[tool.pytest.ini_options]`, `[tool.coverage]`)
- `frontend/package.json` (`test` script; `vitest`, `@testing-library/react`, `jsdom`, `knip` devDeps)
- `frontend/vitest.config.ts`, `frontend/src/test/setup.ts` (new)
- `frontend/src/**/__tests__/` (initial tests: `auth.ts`, `useWebSocket`, login form)
- `frontend/e2e/login.spec.ts` (Playwright — optional if time)
- `.github/dependabot.yml` (new)
- `docs/ROADMAP.md` (new), `docs/CHANGELOG.md` (new), `docs/archive/` (move v2–v5 plans + audits), `docs/README.md` (index rewrite)
- `README.md` (endpoint list, Python version, `npm run test`)
- `docs/reports/README.md` (stale `I:/vinit SIH/...` path)
- `.pre-commit-config.yaml` (new — black/ruff/eslint/prettier/detect-secrets)

**Steps:**
1. **`pyproject.toml`:** `black` line-length 88; `ruff` (replace flake8) with `extend-ignore = ["E203"]`, `line-length = 88`; `[tool.pytest.ini_options]` with `asyncio_mode`, `testpaths=["tests"]`, `--cov-fail-under=70`; `[tool.coverage.run] omit` venv/tests. Update `ci.yml` lint job to `ruff check backend && black --check backend` with the shared config.
2. **`test` job:** drop the unused Postgres/Redis services **or** add a real integration job that runs Alembic + a Postgres-backed subset (ties to MT-07). Mark heavy ML tests `@pytest.mark.slow` and run them in a separate matrix leg.
3. **`frontend` job:** `npm ci` → `npm run lint` → `npm run type-check` → `npm run build` → `npm run test` → `npx knip`. Runs on PR + push.
4. **Frontend tests:** add Vitest + RTL + jsdom. First tests: `lib/auth.ts` (token get/set/expiry), `hooks/useWebSocket` (reconnect cap at 5, dead-letter), login form (calls `loginUser`, shows error on 401 via mocked api). Add `"test": "vitest run"` to `package.json`.
5. **e2e (optional):** Playwright `login.spec.ts` — real login against `docker compose` in CI, or defer to a follow-up.
6. **Scanners:** `.github/dependabot.yml` for `pip`, `npm`, `github-actions`; add `pip-audit` + `npm audit --audit-level=high` + Trivy image scan steps; actually invoke `safety` in `security-scan`; bump `actions/checkout@v3` → `@v4`.
7. **Docs:** create `docs/archive/`, move `MASTER_IMPROVEMENT_PLAN*.md` + `IMPLEMENTATION_PLAN_V2.md` + `AUDIT_*.md` there; write `docs/ROADMAP.md` (links to this file + status) and `docs/CHANGELOG.md`; rewrite `docs/README.md` as a clean index. Fix `README.md` endpoint list (`/api/v1/predict`, `/api/v1/complaints`, `/api/v1/intelligence/*`, `/api/v1/locations/*`, `/api/v1/ws/live-feed`), Python version (pin 3.11), and the `npm run test` reference. Fix the stale path in `docs/reports/README.md`.
8. **pre-commit:** add config; document `pre-commit install` in `CONTRIBUTING.md` (new, small).

**Acceptance criteria:**
- A PR that breaks TS types, fails `eslint`, breaks `next build`, or leaves dead code (`knip`) is **red**.
- `ruff check backend && black --check backend` pass locally and in CI with the committed config.
- `npm run test` runs ≥ 5 frontend tests, all green, in CI.
- `docs/` root shows one index + `ROADMAP.md` + `CHANGELOG.md`; historical plans live under `docs/archive/`.
- `README.md` endpoints match `app/main.py` routers; no `npm run test` / version drift.
- `dependabot.yml` active; image scan + `pip-audit` + `npm audit` steps present.

**Risks:** Turning on `ruff`/`eslint --max-warnings 0` on a codebase that never had it will surface a backlog — allow a one-time `# noqa`/`eslint-disable` sweep with a tracking issue rather than blocking the PR indefinitely.

---

## Consolidated Schedule

| Phase | Microtasks | Effort | Parallelism |
|---|---|---|---|
| P1 | MT-01, MT-02 | S + S | MT-01 then MT-02 |
| P2 | MT-03, MT-04 | M + M | MT-03 then MT-04 |
| P3 | MT-05, MT-06 | S + M | MT-05 anytime after P1; MT-06 after MT-03 |
| P4 | MT-07 | L | Parallel with P2/P3/P5 (needs Postgres) |
| P5 | MT-08, MT-09 | L + M | Starts after MT-07; MT-09 after MT-08 |
| P6 | MT-10 | L | Last; needs P1–P5 substantially done |

**Critical path:** MT-01 → MT-02 → MT-03 → MT-06 → (MT-07) → MT-08 → MT-09 → MT-10.
**Rough total:** ~4–6 focused engineering weeks for one developer; ~2–3 weeks with two developers splitting P3/P4/P5.

---

## Traceability — Microtask ↔ Analysis Findings

| Finding IDs (from `REPO_ANALYSIS_AND_IMPROVEMENTS.md`) | Microtask |
|---|---|
| O1, H1, H4, DOC5(LICENSE) | MT-01 |
| F7, O2, F10 | MT-02 |
| F1, F2, F3, F6, F8, F9(client) | MT-03 |
| F4, F5, F11(partial), DOC1(frontend) | MT-04 |
| B1 | MT-05 |
| B2, B3, B4, B5, B6, B7, F9(server) | MT-06 |
| D1, D2, D3, D4, D5, D6 | MT-07 |
| M1, M2, M3 | MT-08 |
| M4, M5, M6, M7, O10, H3 | MT-09 |
| O3, O4, O5, O11, O12, T1, T2, T4, DOC1–DOC4, F11 | MT-10 |
| B8, B9, B10, B11, T3, T5, H2, H5 | Backlog (tracked in `docs/ROADMAP.md`, not in the 10) |

---

*Plan authored 2026-09-10 from `docs/REPO_ANALYSIS_AND_IMPROVEMENTS.md`. Update the status column in `docs/ROADMAP.md` as microtasks merge.*
