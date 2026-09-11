# CASHGUARD-AI — Obstacles to Running the Project

> **Date:** 2026-09-11 (updated same day after fixes applied)
> **Scope:** Everything that currently blocks or degrades a local run (Docker Compose path and manual/native path), verified by direct inspection of this checkout on `E:\SIH\CASHGUARD-AI`.
> **Status:** ✅ All items below have been executed/fixed and re-verified — `docker compose up --build` now brings the full stack up healthy end-to-end (`postgres`, `redis`, `migrate`, `backend`, `frontend`), and `/health/ready` reports `database: ok`, `redis: ok`.
> **Note:** A broader quality/architecture audit already exists at [`docs/REPO_ANALYSIS_AND_IMPROVEMENTS.md`](REPO_ANALYSIS_AND_IMPROVEMENTS.md) (dated 2026-09-10, commit `98e2536`). Most of the items it flagged as blocking (missing `.dockerignore`, mock frontend login, no `output: 'standalone'`, bare `train.py` imports, no frontend CI job) have since been fixed in later commits (`7c48e08`, `79081b2`). This document re-verifies the *current* state and focuses narrowly on what stops the app from actually starting and running today.

---

## 1. Blocking — prevented `docker compose up` from working as-is (FIXED)

### 1.1 Port 5432 is already occupied by a native PostgreSQL install — ✅ Fixed
- **Evidence:** `netstat -ano` showed `0.0.0.0:5432 LISTENING` owned by PID 7736 (a native Windows Postgres service), independent of Docker.
- **Effect:** `docker-compose.yml` mapped the `postgres` container to host port `5432:5432`. With a native Postgres already bound to that port, the container's port publish would fail (`port is already allocated`).
- **Fix applied:** `docker-compose.yml` now publishes the `postgres` container on a configurable host port, `${POSTGRES_HOST_PORT:-5433}:5432` (services inside the Compose network still reach it at `postgres:5432`, unaffected). Added `POSTGRES_HOST_PORT=5433` to `.env.example` and the local `.env`, and documented it in the README env-var table. The native Postgres on 5432 was left untouched.
- **Verified:** `docker compose ps` shows `cpaf_postgres ... 0.0.0.0:5433->5432/tcp`, healthy, with no port conflict.

### 1.2 Docker Desktop engine was not running — ✅ Fixed
- **Evidence:** `docker ps` failed with `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine ...`. Docker CLI (`29.7.2`) and Compose (`v5.5.1`) were installed, but the daemon/engine itself was not up.
- **Fix applied:** launched `Docker Desktop.exe` and waited for the engine to come up.
- **Verified:** `docker ps` now succeeds; full stack built and started.

### 1.3 Frontend Docker build failed — newly discovered, ✅ Fixed
Not in the original write-up; surfaced only once the port/engine issues above were cleared and a real `docker compose up --build` was run:
- **`frontend/src/lib/auth.ts` redeclared every export twice** (`JwtUser`, `getUserFromToken`, `getUserRole`, `isAdmin` each defined once with single-quote style, once with double-quote style/JSDoc) — a bad merge artifact from the latest pulled commits. Next's build failed with `isAdmin` redefined. **Fix:** removed the duplicate second block, keeping one clean definition of each export.
- **`frontend/src/app/settings/page.tsx` contained 3 bytes of invalid UTF-8** (`0x97`, a Windows-1252 em dash) at three spots in comments, which made webpack refuse to read the file (`stream did not contain valid UTF-8`). **Fix:** replaced the 3 bytes with a proper UTF-8 em dash (`—`); file now parses cleanly.
- **Verified:** `docker compose up --build` completes; frontend image builds and the container serves `200` on `http://localhost:3000`.

---

## 2. Blocking — prevented the manual/local (non-Docker) backend from working correctly

### 2.1 `backend/venv` is Python 3.10, but the project targets/expects 3.11 — ⚠️ Not changed (needs a decision)
- **Evidence:** `backend/venv/Scripts/python.exe --version` → `Python 3.10.11`. Both Dockerfile stages (`FROM python:3.11-slim`) and all three CI jobs (`python-version: "3.11"`) pin `3.11`. `pyproject.toml` targets `py310`/`py311`, and README's *Manual Setup* section doesn't pin a version at all.
- **Why not fixed automatically:** no Python 3.11 interpreter is installed on this machine (`py -3.11` → "No suitable Python runtime found"). Recreating the venv on 3.11 requires installing a new Python version system-wide first — a larger, more disruptive change than fits an in-place fix, so it was left for an explicit decision rather than silently installing a new interpreter.
- **Current state:** basic tests pass under 3.10 today; this is a latent drift risk, not an active failure.
- **Suggested next step:** install Python 3.11 (e.g. via `winget install Python.Python.3.11` or python.org) and recreate `backend/venv`, or explicitly document 3.10 as the supported local version everywhere.

### 2.2 spaCy's `en_core_web_sm` model was not installed in the local venv — ✅ Fixed
- **Evidence:** `python -m spacy validate` inside `backend/venv` reported **"No pipeline packages found in your current environment."**
- **Fix applied:** `venv/Scripts/python.exe -m spacy download en_core_web_sm` — installed `en-core-web-sm-3.7.1`.
- **Verified:** package now installs and is importable via `spacy.load('en_core_web_sm')`.

### 2.3 No trained ML model artifacts existed anywhere in the repo — ✅ Mostly fixed
- **Evidence:** `backend/app/ml/model_artifacts/` contained only a `README.md`.
- **Fix applied:** ran `PYTHONPATH=. python -m app.ml.train --from-csv tests/fixtures/mini_train.csv` from `backend/`. Produced `xgboost_location.pkl`, `rf_risk.pkl`, and `kmeans_hotspot.pkl` (val accuracy 1.0 on the tiny fixture set — expected, it's a smoke-test-sized fixture, not a production-quality label set).
- **⚠️ New sub-finding:** the **Prophet temporal model failed to train** (`Prophet unavailable ... 'Prophet' object has no attribute 'stan_backend'`) because **CmdStan is not installed** (`cmdstanpy.cmdstan_path()` → `ValueError: No CmdStan installation found`). CmdStan requires a full C++ toolchain build/download and was not installed here — left as a follow-up rather than doing a multi-minute+ toolchain install unprompted. `prophet_temporal` remains missing; the other 3 artifacts are present and loadable.
- **Suggested next step:** `venv/Scripts/python.exe -c "import cmdstanpy; cmdstanpy.install_cmdstan()"` (needs a C++ compiler on PATH), then re-run the train command to also produce `prophet_temporal.pkl`. Also re-run training against real DB data (no `--from-csv`) before relying on this for anything beyond local smoke-testing.

---

## 3. Non-blocking but worth flagging before/while running

### 3.1 `.env` is missing `ANTHROPIC_API_KEY`
- `.env.example` lists `ANTHROPIC_API_KEY=` (empty) and the committed `.env` omits it entirely. This only affects the optional `claude` Compose service/profile (`docker compose --profile claude up`), not the core `postgres`/`redis`/`backend`/`frontend`/`migrate` stack. Safe to ignore unless that profile is used.

### 3.2 Backend `.env` values are dev/placeholder secrets
- `SECRET_KEY` in the committed `.env` is a real-looking generated string but is a local dev value; `POSTGRES_PASSWORD=cpaf_pass` and the `mcp` service's hardcoded `postgresql://cpaf_user:cpaf_pass@postgres:5432/cpaf_db` are fine for local running, but should never be reused verbatim for any shared/staging/production environment.

### 3.3 39 GB `dataset/` directory is present locally but gitignored
- The IBM AML CSVs under `dataset/` are large and not required for the app to boot or for `pytest` (the test suite uses fixtures). Only relevant if running the full ETL/training pipeline against real data (`dataset/clean_aml_data.py`, `docs/IBM_AML_DATASET_INTEGRATION.md`). Not an obstacle to running the app itself.

### 3.4 Adminer/MCP/Claude Compose services are profile-gated
- `mcp` and `claude` services only start with `--profile mcp|tools|claude` — normal `docker compose up` will *not* start them, which is expected, not a bug. Worth knowing so their absence isn't mistaken for a failure when just doing `docker compose up`.

---

## 4. What was checked and found to be already fine (no action needed)

These were flagged as blockers in the earlier `docs/REPO_ANALYSIS_AND_IMPROVEMENTS.md` (2026-09-10) and have since been fixed — re-verified directly against the current tree:

| Previously flagged | Current state |
|---|---|
| No `backend/.dockerignore` / `frontend/.dockerignore` | Both exist |
| `frontend/Dockerfile` build fails (`output: 'standalone'` unset, no `public/`) | `next.config.js` sets `output: 'standalone'`; `frontend/public/favicon.ico` exists |
| Login is a mock (`dummy-auth-token`) | `login/page.tsx` now calls the real `loginUser()` from `lib/api.ts` |
| `train.py` uses bare imports → `ModuleNotFoundError` | Entrypoint now documented/used as `python -m app.ml.train` (package-relative) |
| No frontend CI job | `.github/workflows/ci.yml` has a `frontend` job (`npm ci`, lint, type-check, build, test, `lint:dead`, `npm audit`) and an `e2e` job |
| No `frontend/package.json` `test` script | `"test": "vitest run"` is defined, plus `e2e` (Playwright) and `lint:dead` (knip) |
| `flake8`/`black` with no shared config | `pyproject.toml` defines `[tool.black]` and `[tool.ruff]` with a shared `line-length = 88` |
| `backend/venv` package versions | `fastapi`, `xgboost`, `prophet`, `spacy`, `shap` are all installed and importable in the local venv (only the spaCy *model* is missing — see §2.2) |
| Basic backend test collection/run | `pytest --collect-only` finds 79/80 tests cleanly; a sample non-slow test file passes |

---

## 5. Status as of this run

All Docker-path blockers (§1.1–§1.3) and the spaCy/model-artifact gaps (§2.2, §2.3) are fixed and verified:

```
$ docker compose ps
cpaf_backend    Up (healthy)   0.0.0.0:8000->8000/tcp
cpaf_frontend   Up (healthy)   0.0.0.0:3000->3000/tcp
cpaf_postgres   Up (healthy)   0.0.0.0:5433->5432/tcp
cpaf_redis      Up (healthy)   0.0.0.0:6379->6379/tcp

$ curl http://localhost:8000/health/ready
{"status":"ready","checks":{"database":"ok","redis":"ok"}}
```

Two items remain open, both deliberately left for a human decision rather than an unprompted heavy/system-level change:

- **§2.1** — local `backend/venv` is Python 3.10 vs. the 3.11 used by Docker/CI; no 3.11 interpreter is installed on this machine.
- **§2.3 (Prophet)** — `prophet_temporal.pkl` was not produced because CmdStan (a C++ toolchain component) isn't installed; the other 3 model artifacts were produced successfully.
