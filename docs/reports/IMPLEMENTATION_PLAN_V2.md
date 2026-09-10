---
name: implementation-plan-v2
---

# CASHGUARD-AI / CPAF — Implementation Plan v2

> **Trigger**: Re-audit of commit `19df69c` ("feat: implement Master Improvement Plan (Phases 1-4) & 100% test coverage").
> **Status**: Phases 1-4 verified as genuinely implemented (~85% of the original audit plan). This plan addresses the residual gaps and regressions.
> **Overall rating**: 78/100 → target 95/100.

---

## 0. Pre-Work: Environment

The project has **no virtualenv** and the system Python (3.14) does not have the project dependencies installed (`alembic`, `fastapi`, `sqlalchemy`, `pytest` all missing). Verification of the Alembic migration and test suite therefore requires installing dependencies.

**Action**: `pip install -r backend/requirements.txt` in a virtualenv, then run:
- `cd backend && pytest --cov=app --cov-fail-under=70` (baseline)
- `cd backend && alembic upgrade head` (migration validation)

---

## 1. PII Masking Regression — `complaints.py` (CRITICAL)

**Current state**: The viewer-role mask in `get_complaints` (L60-63) and `get_complaint` (L120-122) overwrites `victim_name_masked`/`victim_phone_masked` with the literal string `"***"`, destroying the original last-4-digit masking. `complaint_text` is **never masked at the API layer** even though `anonymizer.mask_text()` exists.

**Fix**:
1. Restore proper masking by calling `mask_complaint_data()` on the serialized response for viewer role.
2. Apply `mask_text()` to `complaint_text` for viewer responses.

**Files**: `backend/app/api/v1/complaints.py`, `backend/app/utils/anonymizer.py` (already complete).

---

## 2. Data-Layer Gap — `init_db.sql` (HIGH)

**Current state**: `init_db.sql` creates only a user and database. Zero tables, indexes, or constraints. All DDL lives in the Alembic migration. If the documented setup path (`psql -f init_db.sql`) is followed, the DB is empty.

**Fix**: Rewrite `init_db.sql` to create all tables, extensions, indexes, and constraints — mirroring the Alembic migration — so both setup paths produce an identical schema.

**Files**: `backend/init_db.sql`, `backend/alembic/versions/0001_spatial_indexes_and_constraints.py` (already created).

---

## 3. Alembic Migration Validation (HIGH)

**Current state**: Alembic was non-functional (missing `script.py.mako`, empty `versions/`). Created both. The migration must be verified to apply cleanly.

**Action**: Run `alembic upgrade head` against a test database.

**Files**: `backend/alembic/versions/0001_spatial_indexes_and_constraints.py` (created).

---

## 4. `create_all()` Path Missing Indexes (HIGH)

**Current state**: `main.py`'s `init_db()` calls `Base.metadata.create_all()`, which creates tables but **not** GIST indexes, CHECK constraints, or partial indexes (PostGIS functions are not captured by SQLAlchemy DDL). The default dev path ships a DB with no spatial indexes.

**Fix**: After `create_all()`, run the Alembic migration's index/constraint DDL via a raw SQL helper, or switch `init_db()` to use Alembic.

**Files**: `backend/app/main.py`.

---

## 5. `train.py` Independent Splits (MEDIUM)

**Current state**: `train.py:56-57` still uses two independent `train_test_split` calls (the flagged anti-pattern). Harmless today (both use `random_state=42`) but a latent bug.

**Fix**: Single synchronized split.

**Files**: `backend/app/ml/train.py`.

---

## 6. DBSCAN `eps` Documentation + Stub Methods (MEDIUM)

**Current state**: `kmeans_hotspot.py:9` `DBSCAN(eps=0.01)` on raw degrees is undocumented. `update_hotspots` and `visualize_hotspots` are `pass` stubs.

**Fix**: Document the eps units; implement `update_hotspots` (incremental fit) and `visualize_hotspots` (returns cluster info for plotting).

**Files**: `backend/app/ml/kmeans_hotspot.py`.

---

## 7. GeospatialService BallTree Per-Request Rebuild (MEDIUM)

**Current state**: `locations.py:98` calls `load_atm_locations(db)` on **every** `/locations/nearby` request, rebuilding the BallTree from a DB query per call.

**Fix**: Cache the BallTree with a TTL or load-once-on-startup pattern.

**Files**: `backend/app/api/v1/locations.py`, `backend/app/services/geospatial_service.py`.

---

## 8. Frontend Gaps (LOW-MEDIUM)

- **`types/index.ts` role enum mismatch**: `'admin'|'officer'|'analyst'` vs backend `admin|analyst|viewer`.
- **`HeatmapLayer.tsx` no viewport filtering** (audit item 2.3).
- **Zustand store no persistence** (audit item 2.5).
- **CORS**: `allow_origins=["*"]` + `allow_credentials=True` is an invalid/browser-blocked combination.

**Fix**: Align role enum; add viewport filtering; add zustand persist middleware; fix CORS.

**Files**: `frontend/src/types/index.ts`, `frontend/src/components/map/HeatmapLayer.tsx`, `frontend/src/store/useAppStore.ts`, `backend/app/main.py`.

---

## Priority Order

| # | Issue | Severity | Effort |
|---|---|---|---|
| 1 | PII masking regression | CRITICAL | 1h |
| 2 | `init_db.sql` stub | HIGH | 2h |
| 3 | Alembic migration validation | HIGH | 1h |
| 4 | `create_all()` missing indexes | HIGH | 1h |
| 5 | `train.py` independent splits | MEDIUM | 30m |
| 6 | DBSCAN docs + stubs | MEDIUM | 30m |
| 7 | BallTree per-request rebuild | MEDIUM | 1h |
| 8 | Frontend gaps | LOW | 2h |
| 9 | CORS fix | LOW | 10m |