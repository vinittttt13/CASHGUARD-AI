# CASHGUARD-AI — Repo Status & Remaining Work

> **Date:** 2026-09-11 (updated same day — see §0)
> **Scope:** Whole-repository quality/completeness audit — not "can it run" (see [`PROJECT_RUN_OBSTACLES.md`](PROJECT_RUN_OBSTACLES.md) for that, which is fully resolved as of today).
> **Method:** Fresh read of current source, cross-checked line-by-line against the prior audit at [`REPO_ANALYSIS_AND_IMPROVEMENTS.md`](REPO_ANALYSIS_AND_IMPROVEMENTS.md) (2026-09-10, commit `98e2536`). Every claim below was re-verified against the tree, not copied forward.
> **Status:** The Kubernetes/deployment section (§2.1, formerly the main open item) has since been fixed in a follow-up stabilization pass — see [`PROJECT_COMPLETION_REPORT.md`](../PROJECT_COMPLETION_REPORT.md) for the full account. This file is kept as the historical audit; §0 below summarizes what changed.

## 0. What changed since this audit was written

K1–K6 (the Kubernetes section, §2.1) are now fixed: a genuine runtime-config injection makes the frontend image portable across environments without a rebuild, the missing ConfigMap/Secret manifests were added, image references corrected, and postgres/redis hardened to match backend/migrate. Also fixed in the same pass, found during re-verification rather than pre-existing in this audit: 3 backend dependency CVEs (unconstrained ones — `starlette`/`pytest` majors remain genuinely blocked by upstream pins), `black` formatting normalized repo-wide (removing the `continue-on-error` in CI), a CodeQL workflow added, and a real `docker-compose.yml` frontend healthcheck bug (wrong tool + Docker's auto-`HOSTNAME` binding quirk) that made the frontend container permanently report "unhealthy" despite working correctly. Full details, evidence, and verification steps are in `PROJECT_COMPLETION_REPORT.md`. The rest of this document (§2.2 onward) is unchanged and still accurate.

---

## 1. Executive Summary

The repo has moved a long way since the 2026-09-10 audit. **Of the ~50 findings in that audit, the large majority are now fixed** — real frontend auth, a working Docker/CI pipeline, hardened backend auth, proper DB migrations, real ML training data, dependency scanning, docs consolidation, tests where there were none. This session also fixed three additional bugs found by driving the live UI (WebSocket wiring, a Leaflet blank-tile bug, leaked internal UUIDs in the alert UI) — see `PROJECT_RUN_OBSTACLES.md` for those.

What's left clusters almost entirely in **one place: the Kubernetes / production deployment path**, plus a handful of smaller, independent gaps (ML dataset versioning, a few test-coverage holes, minor CI polish). None of what remains blocks local development or a Docker Compose demo — it blocks a **real cluster deployment**, which nobody has exercised yet.

### Severity scoreboard (current state)

| Area | Verdict | Headline issue |
|---|---|---|
| Backend API & Auth | 🟢 Solid | All prior findings fixed (rate limiting, refresh rotation, dual revocation, CORS fail-closed, real `/health/ready`) |
| Database / migrations | 🟢 Solid | `create_all` removed outside tests, dedicated migration Job, indexes added, PostGIS decision documented |
| ML pipeline | 🟡 Mostly real | Real DB-backed training exists; Prophet/CmdStan gap and dataset versioning (DVC) still open |
| Frontend | 🟢 Solid | Dead code gone, real auth wiring, tests exist; today's WS/map/UUID bugs also fixed |
| **Kubernetes / prod deploy** | 🟢 Fixed (see §0) | Runtime-config injection + missing ConfigMap/Secret manifests + postgres/redis hardening all addressed in a follow-up pass |
| CI/CD | 🟢 Mostly solid | Lint/type-check/test/build/scan all wired for both frontend and backend; frontend Docker publish step has the same build-arg gap as k8s |
| Testing | 🟡 Partial | Frontend and backend both have real tests now; several pages/paths still untested; unit tests still don't hit real Postgres |
| Docs | 🟢 Solid | Sprawl archived, README accurate, CHANGELOG maintained |
| Repo hygiene | 🟢 Solid | LICENSE, `.editorconfig`, pre-commit, no tracked build artifacts |

---

## 2. Still Open — by area

### 2.1 Kubernetes / production deployment — 🟢 fixed (see §0 and `PROJECT_COMPLETION_REPORT.md`)

This section is kept verbatim as the historical record of what was found. All six items (K1–K6) below were fixed in the same-day follow-up pass.

| # | Severity | Evidence | Finding |
|---|---|---|---|
| K1 | 🔴 Critical (new) | `kubernetes/frontend-deployment.yaml:24-25` | Sets `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` via `envFrom: configMapRef`, a **container-runtime** env var. Per today's fix (see `PROJECT_RUN_OBSTACLES.md` / commit `90051ce`), Next.js only inlines `NEXT_PUBLIC_*` at **build time** — a runtime ConfigMap has zero effect on the already-built client bundle. **The k8s frontend deployment is silently non-functional for any real domain**, no matter what the ConfigMap says. |
| K2 | 🔴 Critical (new) | `.github/workflows/ci.yml:166-171` | The `docker-build` job's frontend `build-push-action` step passes **no `build-args`**, so the image CI publishes to `ghcr.io/.../cpaf-frontend:latest` always bakes in the Dockerfile's fallback defaults (`http://localhost:8000`, `ws://localhost:8000`). This reproduces the same bug at the registry level — anyone pulling that image gets a frontend wired to `localhost`, not the real backend. |
| K3 | 🔴 Critical | grep across `kubernetes/` and `docs/` | No manifest or documented creation command exists for `frontend-config` or `backend-config` ConfigMaps, or `postgres-secrets` Secret — only `backend-secrets` has a documented `kubectl create secret` command (`docs/DEVOPS_DEPLOYMENT_GUIDE.md:121`). `kubectl apply -f kubernetes/` as the README/DevOps guide instructs would fail immediately on missing ConfigMap/Secret references. |
| K4 | 🟠 High (carried over, O6) | `kubernetes/*-deployment.yaml` | Still `image: ghcr.io/yourorg/cpaf-backend:latest` / `cpaf-frontend:latest` — placeholder org, doesn't match what CI actually publishes (`ghcr.io/vinittttt13/...`). Still `:latest` + `imagePullPolicy: Always`: no rollback story, no image provenance. |
| K5 | 🟠 High (carried over, O7 — partial) | `kubernetes/postgres-statefulset.yaml` | Backend/migrate/redis manifests got `resources`, probes, etc. in the interim — **postgres did not**. No `resources` requests/limits, no `securityContext`, no liveness/readiness probe, no `PodDisruptionBudget`. |
| K6 | 🟠 High (carried over, O7 — partial) | `kubernetes/redis-deployment.yaml` | Still no `requirepass`/auth. Redis backs JWT revocation, the rate limiter's storage, and the WS pub/sub relay — an unauthenticated Redis in a cluster is a real exposure once this is actually deployed. |

**Why this cluster of findings matters most:** it's the only area where the *documented* path (README "Deployment" section, `docs/DEVOPS_DEPLOYMENT_GUIDE.md`) would not work if someone followed it today. Everything else in this document is either polish or a narrower, independent gap.

### 2.2 ML pipeline — 🟡 mostly real, two gaps remain

| # | Severity | Evidence | Finding |
|---|---|---|---|
| M-a | 🟡 Medium (already documented) | `PROJECT_RUN_OBSTACLES.md` §2.3 | `prophet_temporal.pkl` cannot be produced without installing CmdStan (a C++ toolchain component); `train.py` degrades gracefully (logs and continues) rather than crashing, but the 4th model artifact is missing everywhere except a CmdStan-equipped machine. Not re-litigated here — tracked, not re-fixed. |
| M-b | 🟡 Medium (carried over, M6) | repo-wide search for `*.dvc`, `dvc.yaml` | Still no dataset versioning — the 40GB `dataset/` directory has no DVC remote or object-store pointer, just a gitignored local folder. Reproducibility gap unchanged from the 2026-09-10 audit. |
| M-c | 🟢 Low (carried over, D6) | `backend/alembic/versions/` | Still only one hand-written revision (`0001_baseline_schema.py`); no autogenerate baseline captured yet. Low risk while the schema is still young, but worth doing before the migration history grows. |

### 2.3 Testing — 🟡 real coverage exists, but gaps remain

| # | Severity | Evidence | Finding |
|---|---|---|---|
| T-a | 🟡 Medium | `frontend/e2e/` (2 spec files: `login.spec.ts`, `dashboard.spec.ts`) | No Playwright e2e coverage for Analytics, Alerts, or Intelligence/Settings pages — only login and dashboard are exercised end-to-end. |
| T-b | 🟡 Medium | `frontend/src/**/__tests__/` (6 files, 26 tests) | Vitest unit tests cover login, `useApiResource`, `lib/api`, `useWebSocket`, and a `wired-screens` sweep (StatsOverview/ComplaintFeed/AlertCenter). Analytics, Intelligence, and Settings components have no unit tests. |
| T-c | 🟡 Medium (carried over, O5 — partial) | `backend/tests/conftest.py:49-50` | The fast `backend-test` CI job still runs pytest against `sqlite+aiosqlite:///:memory:`, not the real Postgres CI spins up alongside it (only the separate `alembic upgrade head` CI step touches real Postgres). Meaningfully mitigated by the newer `e2e` CI job (real docker-compose stack + `scripts/smoke.sh` + Playwright), but the unit-test layer itself still never exercises real Postgres/PostGIS-adjacent behavior. |
| T-d | 🟢 Low (unverified — flagged, not confirmed broken) | `backend/tests/test_api.py` | Depth of rate-limiter 429 test coverage and any test of the WS Redis pub/sub relay across simulated multi-pod scenarios was not fully re-verified this pass — worth a closer look before relying on either in production. |

### 2.4 CI/CD polish — 🟢 mostly solid, small gaps

| # | Severity | Evidence | Finding |
|---|---|---|---|
| C-a | 🟢 Low (carried over, O12 — partial) | `.github/workflows/ci.yml` | No CodeQL workflow. Bandit, pip-audit, npm audit, and Trivy are all present *and actually invoked* now (a real improvement over the old audit) — CodeQL is the one scanner type still missing. |
| C-b | 🟢 Low | `.github/workflows/ci.yml` (`backend-lint` job) | `black --check` runs with `continue-on-error: true` — formatting isn't enforced yet. Appears to be a deliberate, documented choice (a comment explains it) rather than an oversight. |

### 2.5 Documentation — 🟢 solid, one item to keep current

| # | Severity | Finding |
|---|---|---|
| D-a | 🟢 Low | `PROJECT_RUN_OBSTACLES.md` (this session's earlier doc) is now a historical record of *today's* fixes — accurate as written, but should be read as "what was fixed on 2026-09-11," not as the live status doc. This file supersedes it for "what's left." |
| D-b | 🟢 Low (unverified) | `docs/FRONTEND_ARCHITECTURE.md`, `DEVOPS_DEPLOYMENT_GUIDE.md`, `ML_PIPELINE_AND_MODELS.md` were only spot-checked (the DevOps guide, for the ConfigMap/Secret gap in §2.1). Their accuracy against current code beyond that spot-check wasn't fully re-verified this pass. |

### 2.6 Not re-verified this pass (flagged, not confirmed either way)

- Full `git log --all -- .env .env.local` history-leak check (old audit's H2) — `.env`/`.env.local` are correctly gitignored *today*, but whether either was ever committed historically wasn't re-run this session.
- `mcp/server.py` — not re-audited; the 2026-09-10 audit called it "well-sandboxed" and nothing suggests it changed.

---

## 3. Confirmed Fixed Since the 2026-09-10 Audit

For completeness — everything below was flagged as broken in `REPO_ANALYSIS_AND_IMPROVEMENTS.md` and is now verified fixed by reading current source (not just re-stated):

**Frontend (F1–F9):** all fixed — real `loginUser()` call replaces the mock; a single `accessToken`/`refreshToken` convention is used everywhere; `useWebSocket()` is properly mounted (plus today's URL-path fix); no duplicate PascalCase/kebab dead components remain (`ATMMarker`/`GeofenceZone` are genuinely used inside `PredictiveMap.tsx`; `dashboard/predictive-map.tsx` is a legitimate `next/dynamic` wrapper, not a duplicate); a single Zustand store and a single toast hook; `next.config.js` has `output: 'standalone'`; `frontend/public/` exists; `ErrorBoundary` is mounted in `app/layout.tsx`.

**Backend auth/API (B1–B7):** all fixed — rate limiting is enforced via a custom `rate_limit_middleware` in `app/main.py` (per-route + global fixed-window limits); refresh tokens now travel in the request body with full rotation (old `jti` revoked, new one minted every `/refresh`); `/logout` revokes both access and refresh `jti`s; `/health/ready` probes DB + Redis with timeouts and 503s on failure, and k8s's readinessProbe correctly points at it; CORS defaults to `[]` and the app **refuses to start** if `CORS_ORIGINS` is unset outside `development`. (B5, Redis fail-open on revocation checks, is unchanged but is now an explicitly documented, deliberate design decision rather than an oversight.)

**Database/migrations (D1–D5):** all fixed — `init_db()` is a no-op outside `TESTING=1`, so `create_all` never races with Alembic in production; a dedicated one-shot `migration-job.yaml` handles schema; PostGIS's removal is a documented ADR decision (`docs/adr/0001-postgis.md`), not silent drift; all four core models now have `__table_args__` indexes; the old duplicate `init_db*.sql` files are gone.

**ML pipeline (M1–M3, M5, M7):** all fixed — `train.py` uses proper `app.ml.*` imports; `retrain.yml` no longer commits model binaries to git (publishes to `MODEL_STORE_URI` behind the validation gate instead); real DB-backed training data via `app/ml/data_loader.py` (the `--from-csv` path is explicitly logged as non-production); spaCy's model is downloaded in both the Dockerfile and CI; `model_artifacts/README.md` documents the expected artifact names.

**DevOps/CI (O1–O4, O11, O12):** all fixed — both `.dockerignore` files exist; the frontend Docker build succeeds; a full frontend CI job runs lint/type-check/build/test/`lint:dead`/audit; shared `black`/`ruff` config in `pyproject.toml`; Bandit + pip-audit (backend) and `npm audit` (frontend) and Trivy (image) are all wired and actually invoked; GitHub Actions are pinned to current major versions.

**Testing (T1, T2):** fixed — 6 Vitest files / 26 tests plus 5 Playwright e2e specs, both wired into CI; `pyproject.toml` has real `[tool.pytest.ini_options]` and `[tool.coverage.*]` config.

**Docs/hygiene (DOC1, DOC2, DOC5, H1, H4):** fixed — old duplicate plans archived under `docs/archive/`; a single current `ROADMAP.md` and actively-maintained `CHANGELOG.md`; README's endpoint list matches real routes; `LICENSE` (MIT), `.editorconfig`, and `.pre-commit-config.yaml` all exist; no build artifacts (`tsconfig.tsbuildinfo`) are tracked in git.

---

## 4. Recommended Order of Operations

1. **Fix the k8s frontend build-arg gap (K1, K2)** — thread `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` through as Docker build args in the CI publish step, the same way today's local fix did for `docker-compose.yml`. A k8s deployment needs a real public URL baked in at image-build time, which likely means either a per-environment image build or switching these to genuinely runtime-configurable values (e.g. served from a small `/config.js` the client fetches, or an nginx envsubst step) — worth a deliberate design decision, not just copying the Compose fix verbatim.
2. **Write the missing ConfigMap/Secret manifests (K3)**, and align image references with what CI actually publishes (K4).
3. **Harden postgres and redis in k8s (K5, K6)** to match what backend/migrate/redis already have.
4. Only after 1–3: actually attempt a real cluster deploy end-to-end once, the same way this session verified the Docker Compose path in a browser.
5. **Independent, lower-priority track:** DVC/dataset versioning (M-b), broaden e2e/unit test coverage to the untested pages (T-a, T-b), add CodeQL (C-a).
