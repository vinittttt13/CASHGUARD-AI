# Verification & Test Execution Log

**Last Updated**: 2026-09-10 20:30 IST

## Automated Unit Tests
| Test Module | Status | Notes |
|---|---|---|
| `backend/tests/test_anonymizer.py` | ✅ PASSED (6/6) | UPI, IBAN, Crypto Wallet, PAN, Aadhaar, phone, and complaint data masking verified |
| `backend/tests/test_circuit_breaker.py` | ✅ PASSED (4/4) | CLOSED -> OPEN -> HALF_OPEN -> CLOSED state machine transitions & probe rollbacks verified |
| `backend/tests/test_ml.py` | ⏳ Ready | Requires ML dependencies (`joblib`, `scikit-learn`, `xgboost`, `networkx`) |
| `backend/tests/test_api.py` | ⏳ Ready | Requires FastAPI test client + SQLite in-memory runner |

## Local & CI Test Commands
When running in Docker or with virtualenv activated:
```bash
# Run complete test suite with coverage
cd backend
python -m pytest --cov=app --cov-report=term-missing --cov-fail-under=70

# Run Alembic migrations against PostgreSQL
alembic upgrade head
alembic downgrade -1
alembic upgrade head

# Seed verification (schema must already be migrated)
python backend/seed_db.py
```

## Database Schema & Migrations (MT-07)
- Alembic is the single source of schema truth. `backend/init_db.sql` /
  `backend/init_db_full.sql` were deleted.
- `backend/alembic/versions/0001_baseline_schema.py`: full baseline —
  all 5 tables, every index (plain + partial + JSONB GIN), coordinate CHECK
  constraints. `alembic check` is clean against the models.
- No PostGIS (`docs/adr/0001-postgis.md`); Postgres image is `postgres:15`.
- App startup no longer runs `create_all` or `alembic upgrade`. The
  docker-compose `migrate` service / `kubernetes/migration-job.yaml` runs
  `alembic upgrade head`.
- Verified: fresh DB provisioned only by `alembic upgrade head` boots the app
  with all endpoints 200; `alembic downgrade base && alembic upgrade head`
  idempotent across 3 cycles.
