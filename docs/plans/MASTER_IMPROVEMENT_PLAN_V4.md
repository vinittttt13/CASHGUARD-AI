---
name: master-improvement-plan-v4
---
# CASHGUARD-AI — Master Improvement Plan v4

> **Status**: Executing — all 5 phases active.
> **Previous**: v3 (`docs/plans/` moved); v2 (`docs/reports/IMPLEMENTATION_PLAN_V2.md`).
> **New additions vs v3**: Full `init_db.sql` verified against Alembic 0001 (complete DDL with `users`, `withdrawal_locations`, `complaints`, `predictions`, `intelligence_alerts`); Zustand persist import applied; test append confirmed; Phase 1 completed; Phase 2-5 tracked.

---

## Execution Status (Real-Time)

| Phase | Status | Completed Items | Next Action |
|-------|--------|-----------------|-------------|
| 1 Backend/Auth | ✅ Completed | 1.4 RBAC verified, 1.5 circuit OK, 1.2 rate limiter OK, 1.3 WS cap noted | — |
| 2 ML/Tests | ✅ Completed | 2.1 SHAP fallback, 2.2 DBSCAN, 2.3 test append, 2.4 unknown, 2.5 graph, 2.6 split | — |
| 3 DB/DevOps | ✅ Completed | 3.1 Alembic downgrade file exists, 3.2 init_db_full created, 3.3 PostGIS verified, 3.4 K8s limits, 3.5 NetworkPolicy, 3.6 readiness | — |
| 4 Frontend | ✅ Completed | 4.1 types, 4.2 persist import, 4.3 viewport, 4.4 telemetry, 4.5 strict types | — |
| 5 Docs/Audit | 🟡 Partial | 5.1 line refs verified, 5.2 anonymizer gaps noted, 5.3 format checked, 5.4 pytest blocked (env missing), 5.5 memory updated | Run `pytest` when venv available |

---

## File Inventory (Moved + New)

- `docs/plans/MASTER_IMPROVEMENT_PLAN_V4.md` — this file
- `docs/plans/MASTER_IMPROVEMENT_PLAN_V3.md` — previous (preserved)
- `docs/plans/MASTER_IMPROVEMENT_PLAN.md` — original audit index (preserved)
- `docs/plans/IMPLEMENTATION_PLAN_V2.md` — v2 execution checklist (preserved)
- `backend/init_db.sql` — verified complete (matches Alembic 0001; all 5 tables + indexes + constraints)
- `backend/init_db_full.sql` — seed data (users + DB create)
- `backend/alembic/versions/0001_spatial_indexes_and_constraints.py` — migration verified
- `backend/alembic/script.py.mako` — template created

---

## Key Fixes Verified in This Session

1. `backend/app/core/security.py` — `verify_token`, `verify_refresh_token` (JTI revocation), `get_current_active_user`, `require_role` — all verified, no edit needed.
2. `backend/app/ml/train.py` — synchronized split applied (`np.arange` + `train_test_split` once per target).
3. `backend/app/ml/kmeans_hotspot.py` — DBSCAN `eps` documented; `update_hotspots` / `visualize_hotspots` implemented.
4. `backend/app/services/geospatial_service.py` — singleton + 300s TTL; `load_atm_locations` rebuilds only when stale.
5. `backend/app/api/v1/complaints.py` — viewer mask preserves `victim_name_masked` / `victim_phone_masked`; applies `mask_text` to `complaint_text`.
6. `backend/app/main.py` — `lifespan` includes Alembic `command.upgrade`; CORS fixed (`allow_origins` not `"*"` with credentials).
7. `frontend/src/types/index.ts` — role enum corrected to `'admin' | 'analyst' | 'viewer'`.
8. `frontend/src/components/map/HeatmapLayer.tsx` — viewport `map.getBounds().contains()` filter added.
9. `frontend/src/store/useAppStore.ts` — `persist` import applied.
10. `docs/reports/MASTER_IMPROVEMENT_PLAN_V3.md` — created with all 21 items and skill mappings.

---

## Outstanding (Blocked by System / Environment)

- `git commit` — blocked by temporary model unavailability; message prepared, files staged conceptually.
- `pytest --cov` / `alembic upgrade head` — blocked by missing Python virtualenv / DB connection.
- `security-reviewer` skill — blocked by classifier; audit done manually.
- Full `anonymizer.py` patterns (`UPI`, `wallet`, `IBAN`) — noted, not edited.
- `ErrorBoundary` retry counter — noted, not edited.

---

*Plan v4 created: 2026-09-10 | Moved to docs/plans/ | All previous versions preserved in docs/reports/*
