# CASHGUARD-AI — Roadmap & Status

Status of the 10-microtask remediation plan
(`docs/IMPLEMENTATION_PLAN_MICROTASKS.md`). Update this table as work merges.

| MT | Theme | Status | Notes |
|----|-------|--------|-------|
| MT-01 | Repo hygiene & Docker build context | ✅ done | `.dockerignore`s, LICENSE, `.editorconfig`, `.gitattributes`; backend image builds (GDAL apt packages removed) |
| MT-02 | Frontend production image builds | ✅ done | `output: 'standalone'`, `public/`, `CYPRESS_INSTALL_BINARY=0`; container serves 200 |
| MT-03 | Real auth + unified tokens + live WS | ✅ done | real `loginUser`, `accessToken`/`refreshToken`, `useWebSocket()` mounted, ErrorBoundary |
| MT-04 | Remove dead frontend code, consolidate | ✅ done | knip added & green; kebab/Pascal twins collapsed; one store; one `use-toast`; 21 unused deps pruned. Found & fixed: `.gitignore` `lib/` was hiding `frontend/src/lib/` |
| MT-05 | Enforce rate limiting | ✅ done | custom resilient `@app.middleware` (slowapi 0.1.9 `swallow_errors` is broken); 5/min login, 10/min predict, 60/min global |
| MT-06 | Auth lifecycle + readiness probe | ✅ done | refresh in body + rotation + single-use; logout dual-revoke; `/health/ready`; CORS fail-fast in non-dev |
| MT-07 | Alembic-only schema, drop PostGIS | ✅ done | single baseline migration, `alembic check` clean, `migrate` compose service + k8s Job; ADR `adr/0001-postgis.md`; `init_db*.sql` deleted |
| MT-08 | Training entrypoint + DB data loader | ✅ done | `python -m app.ml.train`, `data_loader.load_training_frame`, no `np.random`; `cmdstanpy` pinned |
| MT-09 | Model store, spaCy model, dataset repro | ✅ done | `MODEL_STORE_URI` (s3/file), store-first load, validation gate on `--publish`; spaCy baked into image; `dataset/manifest.json` + `verify.py` |
| MT-10 | Frontend CI, lint config, docs | 🟡 in progress | `pyproject.toml` (ruff+black+pytest+coverage), Vitest stack + 10 tests, CI `frontend` job, `dependabot.yml`, `.pre-commit-config.yaml`, docs consolidated. **Follow-up:** one-time `black .` normalization (47 files) — CI `black --check` is non-blocking until then |

## Tracked follow-ups (not in the 10)

From `docs/REPO_ANALYSIS_AND_IMPROVEMENTS.md`: B8, B9, B10, B11, T3, T5, H2, H5.

- One-time `black .` sweep across `backend/` + flip CI `black --check` to blocking.
- Widen the ruff ruleset (`E`, `W`, `UP`, `B`) after the black sweep.
- Raise backend coverage gate 60 → 70 as tests are added.
- Playwright `e2e/login.spec.ts` against `docker compose` in CI.
- Object-store model registry: add GCS/MLflow backends beside S3.
- PostGIS adoption (Option A) — see `adr/0001-postgis.md` — if data volume grows.
- git history rewrite to purge previously-committed `.pkl` binaries.
