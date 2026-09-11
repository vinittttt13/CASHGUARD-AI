# CASHGUARD-AI — Obstacles to Running the Project

> **Date:** 2026-09-11
> **Scope:** Everything that currently blocks or degrades a local run (Docker Compose path and manual/native path), verified by direct inspection of this checkout on `E:\SIH\CASHGUARD-AI`.
> **Status:** Analysis only — nothing below has been fixed or executed yet.
> **Note:** A broader quality/architecture audit already exists at [`docs/REPO_ANALYSIS_AND_IMPROVEMENTS.md`](REPO_ANALYSIS_AND_IMPROVEMENTS.md) (dated 2026-09-10, commit `98e2536`). Most of the items it flagged as blocking (missing `.dockerignore`, mock frontend login, no `output: 'standalone'`, bare `train.py` imports, no frontend CI job) have since been fixed in later commits (`7c48e08`, `79081b2`). This document re-verifies the *current* state and focuses narrowly on what stops the app from actually starting and running today.

---

## 1. Blocking — will prevent `docker compose up` from working as-is

### 1.1 Port 5432 is already occupied by a native PostgreSQL install
- **Evidence:** `netstat -ano` shows `0.0.0.0:5432 LISTENING` owned by PID 7736 (a native Windows Postgres service), independent of Docker.
- **Effect:** `docker-compose.yml` maps the `postgres` container to host port `5432:5432`. With a native Postgres already bound to that port, the container's port publish will fail (`port is already allocated`), so `docker compose up` cannot start the `postgres` service, which cascades to `migrate`, `backend`, and everything that depends on them.
- **Also relevant:** the local `.env` / `.env.example` set `DATABASE_URL=...@localhost:5432/...` for **manual** (non-Docker) backend runs — if the backend is run manually with this `.env`, it will silently connect to the *native* Postgres instance instead of the Dockerized one, not the intended `cpaf_db`/`cpaf_user` database (unless that native instance happens to have been provisioned identically).
- **Fix direction (not applied):** stop/reconfigure the native Postgres service before running Compose, or remap the compose port (e.g. `5433:5432`) and adjust `DATABASE_URL` accordingly, or do all DB work inside the Compose network only.

### 1.2 Docker Desktop engine is not currently running
- **Evidence:** `docker ps` failed with `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine ... The system cannot find the file specified.` Docker CLI (`29.7.2`) and Compose (`v5.5.1`) are installed, but the daemon/engine itself is not up.
- **Effect:** Any `docker compose ...` command will fail immediately with a daemon-connection error, before even reaching the port-conflict issue above.
- **Fix direction (not applied):** start Docker Desktop and wait for the engine to report healthy before running Compose.

---

## 2. Blocking — will prevent the manual/local (non-Docker) backend from working correctly

### 2.1 `backend/venv` is Python 3.10, but the project targets/expects 3.11
- **Evidence:** `backend/venv/Scripts/python.exe --version` → `Python 3.10.11`. Both Dockerfile stages (`FROM python:3.11-slim`) and all three CI jobs (`python-version: "3.11"`) pin `3.11`. `pyproject.toml` targets `py310`/`py311` (dev-machine compromise), and README's *Manual Setup* section doesn't pin a version at all.
- **Effect:** Basic tests pass under 3.10 today, but this is a latent version-drift risk — any 3.11-only syntax/behavior added to the app (or a dependency that only ships 3.11 wheels) will work in Docker/CI and silently fail locally, or vice versa.
- **Fix direction (not applied):** recreate `backend/venv` with a 3.11 interpreter, or explicitly document 3.10 as the supported local version everywhere (README, pyproject).

### 2.2 spaCy's `en_core_web_sm` model is not installed in the local venv
- **Evidence:** `python -m spacy validate` inside `backend/venv` reports **"No pipeline packages found in your current environment."** The Docker image bakes it in explicitly (`backend/Dockerfile:35`, `RUN python -m spacy download en_core_web_sm`), but nothing installs it into the local `venv/`.
- **Effect:** Running the backend manually (`uvicorn app.main:app --reload`) or `PYTHONPATH=. pytest` outside Docker will have `NLPExtractor` silently degrade to its regex fallback for named-entity extraction — not a hard crash, but a real functional gap versus the Dockerized/CI behavior, and it can mask NER test failures/successes that don't reflect the model actually being exercised.
- **Fix direction (not applied):** `venv/Scripts/python.exe -m spacy download en_core_web_sm` as a documented manual-setup step (README doesn't mention it today).

### 2.3 No trained ML model artifacts exist anywhere in the repo
- **Evidence:** `backend/app/ml/model_artifacts/` contains only a `README.md` — no `.pkl`/model files for `xgboost_location`, `rf_risk`, `prophet_temporal`, or `kmeans_hotspot`.
- **Effect:** The app still starts and runs (the backend has a heuristic fallback), but `/api/v1/predict` never returns a real model-based prediction — every response comes from `heuristic_fallback` with `confidence: 0.0`. This is a functional gap, not a startup blocker, but directly affects whether "the project" — as an ML product — actually does what it claims once running.
- **Fix direction (not applied):** run `PYTHONPATH=. python -m app.ml.train` (from real DB data or `--from-csv tests/fixtures/mini_train.csv`) to produce artifacts before demoing prediction features.

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

## 5. Suggested order of operations (once fixes are applied — not yet executed)

1. Resolve the port 5432 conflict (§1.1) — either stop the native Postgres service or remap the Compose port.
2. Start Docker Desktop and confirm `docker ps` succeeds (§1.2).
3. `cp .env.example .env` (already done — file exists) and adjust if the port was remapped.
4. `docker compose up --build` for the core stack; confirm `migrate` completes before `backend` reports healthy.
5. Optionally, for local (non-Docker) backend dev: recreate `backend/venv` on Python 3.11, `pip install -r requirements.txt`, then `python -m spacy download en_core_web_sm` (§2.1, §2.2).
6. Optionally, train real model artifacts before relying on `/api/v1/predict` for anything beyond the heuristic fallback (§2.3).
