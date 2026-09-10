# Testing — whole-project strategy

Five layers, each runnable on its own. CI runs 1–4 on every PR; layer 5 (e2e)
runs on a `docker compose` stack.

| # | Layer | Where | Runner | Command |
|---|---|---|---|---|
| 1 | Backend unit + integration | `backend/tests/` | pytest | `cd backend && PYTHONPATH=. pytest` |
| 2 | Backend heavy ML | `backend/tests/test_train_smoke.py` | pytest (`-m slow`) | `cd backend && PYTHONPATH=. pytest -m slow --no-cov` |
| 3 | Frontend unit + component | `frontend/src/**/*.test.tsx` | Vitest + Testing Library | `cd frontend && npm run test` |
| 4 | Static analysis | both | ruff / black / eslint / tsc / knip | see below |
| 5 | End-to-end | `frontend/e2e/` + `scripts/smoke.sh` | Playwright / curl | `npm run e2e` · `scripts/smoke.sh` |

## 1 — Backend unit + integration (pytest)

- SQLite in-memory DB, mocked Redis (`conftest.py`); no external services.
- Coverage gate: `fail_under = 60` (`pyproject.toml`). Ratchet toward 70.
- Covers: auth lifecycle (login, refresh rotation + single-use, logout dual
  revoke), rate limiting (429 on the 6th login), `/health/ready` ok + db-down,
  every v1 router's happy path + 401/403/404, the **exact JSON shapes the
  frontend depends on** (`test_frontend_contract.py` — stats keys, trends keys,
  hotspot item keys, alert list envelope), circuit breaker, anonymizer,
  `data_loader`, model store round-trip + validation gate.

## 2 — Backend heavy ML (slow)

`test_train_smoke.py` fits real XGBoost / RF / KMeans (Prophet where the Stan
backend is available) from `tests/fixtures/mini_train.csv` and asserts the
artifacts load. Deselected from the default run by `addopts = -m 'not slow'`.

## 3 — Frontend unit + component (Vitest)

- `src/lib/__tests__/auth.test.ts` — token storage keys + JWT expiry.
- `src/hooks/__tests__/useWebSocket.test.tsx` — no-token no-op, endpoint+token,
  reconnect cap.
- `src/hooks/__tests__/useApiResource.test.tsx` — resolves, surfaces errors,
  refetch, `enabled:false`, no setState after unmount.
- `src/lib/__tests__/api.test.ts` — each data function hits the right path and
  returns the mapped shape (axios mocked).
- `src/components/**/__tests__/*` — StatsOverview, ComplaintFeed, AlertCenter,
  and the analytics / intelligence containers: **render with mocked api →
  shows data; api rejects → shows `<ErrorState>`; empty payload → `<EmptyState>`**.
- `src/app/(auth)/login/__tests__/login.test.tsx` — success + 401.

## 4 — Static analysis

```bash
# backend
cd backend && ruff check . && black --check .        # black is advisory until the sweep
# frontend
cd frontend && npm run lint && npm run type-check && npm run lint:dead
```

## 5 — End-to-end

### `scripts/smoke.sh` (no extra deps)
Brings nothing up itself — point it at a running stack. Logs in, then asserts
`200` from every endpoint the UI uses and that the frontend serves. Fast
(~5 s). Used as the CI `e2e` job's gate and for local sanity.

```bash
docker compose up -d && docker compose exec -T backend python seed_db.py
scripts/smoke.sh            # BASE_URL / FRONTEND_URL overridable
```

### Playwright — `frontend/e2e/`
`npm run e2e` (installs Chromium on first run). Against `docker compose`:
- `login.spec.ts` — bad creds show an error and stay on `/login`; good creds
  land on `/dashboard`.
- `dashboard.spec.ts` — after login the dashboard renders a real complaint
  number (`/CYB\/\d{4}\/\d+/`) and a non-zero "Active Alerts" figure — proving
  the screens are wired to the backend, not mocks.

## CI wiring (`.github/workflows/ci.yml`)

- `backend-lint`, `backend-security`, `backend-test` (fast + slow legs),
  `frontend` (lint → type-check → build → test → knip → audit).
- `e2e` job: `docker compose up -d --build`, seed, `scripts/smoke.sh`, then
  `npx playwright test`. Uploads the Playwright HTML report on failure.

## Quick "is the whole thing healthy?" checklist

```bash
cd backend && PYTHONPATH=. pytest -q            # layer 1
cd ../frontend && npm run test && npm run build # layer 3 + 4
cd .. && docker compose up -d --build \
  && docker compose exec -T backend python seed_db.py \
  && scripts/smoke.sh                            # layer 5 (smoke)
```
