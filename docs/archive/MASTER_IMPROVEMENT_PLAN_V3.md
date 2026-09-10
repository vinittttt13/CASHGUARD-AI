---
name: master-improvement-plan-v3
---
# CASHGUARD-AI — Master Improvement Plan v3 (Comprehensive)

> **Status**: Plan mode — all 5 phases defined, no execution yet.
> **Scope**: Backend / Auth / Security | ML / Pipeline / Tests | DB / Alembic / DevOps | Frontend / Types / Store | Docs / Audit / Hardening
> **Severity scale**: CRITICAL (data/security breach) → HIGH (functional/regression) → MEDIUM (tech debt / performance) → LOW (polish / docs)

---

## Phase 1 — Backend / Auth / Security

| # | Issue | Severity | File(s) | Action | Est. |
|---|-------|----------|---------|--------|------|
| 1.1 | Zustand persist missing | MEDIUM | `frontend/src/store/useAppStore.ts` | Add `persist` middleware (`zustand/middleware`) with `localStorage` key `cgai-store`; include `alerts`, `socketConnected`, `lastPrediction` | 20m |
| 1.2 | Rate limiter Redis URI unvalidated | MEDIUM | `backend/app/utils/rate_limiter.py` | Validate `REDIS_URL` at startup; add `Retry-After` header in `RateLimitExceeded` handler (`main.py`) | 30m |
| 1.3 | WebSocket reconnect unbounded | MEDIUM | `frontend/src/hooks/useWebSocket.ts`, `backend/app/services/websocket_manager.py` | Cap reconnect attempts (max 5) with exponential backoff + dead-letter after cap; log dead events | 45m |
| 1.4 | RBAC audit gap | HIGH | `backend/app/core/security.py`, `auth.py`, `complaints.py` | Formal audit: verify `require_role` covers all protected routes; check `viewer` mask preserves masked fields; confirm `admin` requires `is_active`; add `security-reviewer` skill scan report | 1h |
| 1.5 | Circuit breaker rollback untested | MEDIUM | `backend/app/utils/circuit_breaker.py` | Add `HALF_OPEN` → `CLOSED` rollback on 3 consecutive failures; log state transitions with `logger.info` | 30m |
| 1.6 | `main.py` exception handler leaks stack | LOW | `backend/app/main.py` | Ensure `generic_exception_handler` never returns `exc` to response; only return `{"detail":"Internal server error"}` with `status_code=500` | 10m |

---

## Phase 2 — ML / Pipeline / Tests

| # | Issue | Severity | File(s) | Action | Est. |
|---|-------|----------|---------|--------|------|
| 2.1 | SHAP `KernelExplainer` fallback missing | MEDIUM | `backend/app/ml/shap_explainer.py` | If `TreeExplainer` fails (non-tree model), fall back to `KernelExplainer`; log fallback usage; add TTL (300s) to SHAP cache (`prediction_service.py`) | 45m |
| 2.2 | DBSCAN `eps` calibration unverified | MEDIUM | `backend/app/ml/kmeans_hotspot.py` | Document `eps=0.01` in code comments (done); add unit test verifying DBSCAN noise ratio < 30% on synthetic clustered data; document that `eps` is in degrees (approx 1.1 km at equator) | 30m |
| 2.3 | `test-master`: registry rollback + SHAP cache untested | HIGH | `backend/tests/test_ml.py` | Add test: `ModelRegistry.hot_swap` triggers rollback on validation failure; test SHAP cache hits/misses (`shap_explainer.py`); test DBSCAN `update_hotspots` incremental fit | 1h |
| 2.4 | `feature_engineering`: unknown category untested | MEDIUM | `backend/app/ml/feature_engineering.py`, `tests/` | Add test: feed unseen category into `OneHot`; verify `"Unknown"` column created; verify quantile bins handle single-value feature without division-by-zero | 30m |
| 2.5 | `graph_analytics.py` motif integration partial | LOW | `backend/app/ml/graph_analytics.py` | Verify `FraudRingDetector` handles disconnected components; add test for ring with 1 node (self-loop) | 20m |
| 2.6 | `train.py`: train/test leakage guard missing | MEDIUM | `backend/app/ml/train.py` | Add assert: `X_train.index.is_unique`; add check that `feature_importance` keys match `FEATURE_NAMES`; verify `random_state=42` used consistently across models | 20m |

---

## Phase 3 — Database / Alembic / DevOps / K8s

| # | Issue | Severity | File(s) | Action | Est. |
|---|-------|----------|---------|--------|------|
| 3.1 | Alembic `downgrade` untested | MEDIUM | `backend/alembic/versions/0001_spatial_indexes_and_constraints.py` | Run `alembic downgrade -1` against test DB; verify all indexes/constraints drop cleanly; add CI step (`pytest --cov` then `alembic upgrade head`) | 45m |
| 3.2 | `init_db_full.sql` missing | MEDIUM | `backend/init_db_full.sql` (new) | Create full init SQL (same as rewritten `init_db.sql` plus seed user: `admin/admin`, `analyst/analyst`, `viewer/viewer`) with `INSERT` for test users | 20m |
| 3.3 | PostgreSQL `PostGIS` extension idempotent check missing | LOW | `backend/init_db.sql`, Alembic `env.py` | Verify `CREATE EXTENSION IF NOT EXISTS postgis;` present; add `op.execute("SELECT PostGIS_Version()")` in Alembic for version logging | 10m |
| 3.4 | K8s resource limits too loose | MEDIUM | `kubernetes/backend-deployment.yaml` | Set `requests`/`limits`: `cpu: 500m/2000m`, `memory: 512Mi/1Gi`; add `securityContext.capabilities.drop: ["ALL"]`; add `readOnlyRootFilesystem: true` | 30m |
| 3.5 | NetworkPolicy egress not restricted | HIGH | `kubernetes/network-policy.yaml` | Add `egress` deny-all except to `postgres:5432`, `redis:6379`, `dns:53`; add labels for `namespace` isolation | 30m |
| 3.6 | Health probe misses DB readiness | MEDIUM | `backend/app/main.py`, `k8s/backend-deployment.yaml` | Add `/ready` endpoint that checks DB connection + BallTree load; wire `readinessProbe` to `/ready` with 5s initial delay | 30m |

---

## Phase 4 — Frontend / Types / Store / Components

| # | Issue | Severity | File(s) | Action | Est. |
|---|-------|----------|---------|--------|------|
| 4.1 | Type sync: `UserRole` enum missing | LOW | `frontend/src/types/index.ts`, `backend/app/models/user.py` | Export `UserRole` from backend; import and reuse in frontend; eliminate `'officer'` (already fixed — verify no leftover references) | 15m |
| 4.2 | Zustand persist middleware | MEDIUM | `frontend/src/store/useAppStore.ts` | Add `persist` import; wrap `create` with persist; set `version: 1`; add `rehydrate` handler; test persistence across reload | 30m |
| 4.3 | Heatmap viewport filter incomplete | LOW | `frontend/src/components/map/HeatmapLayer.tsx` | Verify `map.getBounds().contains()` filters points; add `useEffect` dependency `data` + `map`; add `maxZoom` cap at 18 to prevent over-zoom artifacts | 20m |
| 4.4 | `ErrorBoundary` telemetry missing | LOW | `frontend/src/components/shared/ErrorBoundary.tsx` | Add retry counter (`retryCount: number`) and telemetry payload (`{ component, timestamp, stack }`) on `componentDidCatch` | 20m |
| 4.5 | `useAppStore` TypeScript strict errors | LOW | `frontend/src/store/useAppStore.ts` | Ensure `alerts: AlertData[]` typed; `updatePredictionStatus` accepts `PredictionResponse`; fix implicit `any` types | 15m |

---

## Phase 5 — Documentation / Audit / Hardening / Verification

| # | Issue | Severity | File(s) | Action | Est. |
|---|-------|----------|---------|--------|------|
| 5.1 | Audit line-reference verification | MEDIUM | `docs/reports/*.md` | Verify every audit reference (`L###`) points to actual line in source; add `Before/After` code blocks for every CRITICAL/HIGH finding; remove stale references to removed files | 1h |
| 5.2 | `anonymizer.py` missing patterns | MEDIUM | `backend/app/utils/anonymizer.py` | Add UPI (`upi_.*` regex), wallet (`wallet_.*`), IBAN (`[A-Z]{2}\d{2}`) masking patterns; add tests for each; verify `mask_text` does not over-mask non-PII text | 30m |
| 5.3 | `docs/reports` standard format audit | LOW | `docs/reports/` (all 8 files) | Confirm all reports have: severity badge, `Before/After` diff, file:line reference, `Status: Fixed/Partial/Unfixed`, link to commit that fixed it (e.g., `19df69c`) | 45m |
| 5.4 | Final verification: `pytest` + Alembic | HIGH | `backend/` (full) | Run `pytest --cov=app --cov-fail-under=70` in virtualenv; run `alembic upgrade head`; document results in `docs/reports/VERIFICATION_LOG.md` | 1h |
| 5.5 | Memory persistence audit | LOW | `.claude/memory/` | Confirm `MEMORY.md` exists and links all saved memory files; verify no duplicate facts; add `project: master-plan-v3` memory referencing this document | 15m |

---

## Priority Order (Topologically Sorted)

| Priority | Phase | # | Issue | Severity | Est. | Blockers |
|----------|-------|---|-------|----------|------|----------|
| 1 | 1 | 1.4 | RBAC audit | HIGH | 1h | — |
| 2 | 1 | 1.5 | Circuit breaker rollback | MEDIUM | 30m | — |
| 3 | 2 | 2.3 | ML test gaps (`test-master`) | HIGH | 1h | — |
| 4 | 2 | 2.2 | DBSCAN docs + tests | MEDIUM | 30m | — |
| 5 | 3 | 3.1 | Alembic downgrade test | MEDIUM | 45m | — |
| 6 | 3 | 3.4 | K8s resource limits | MEDIUM | 30m | — |
| 7 | 3 | 3.5 | NetworkPolicy egress | HIGH | 30m | 3.4 |
| 8 | 4 | 4.2 | Zustand persist | MEDIUM | 30m | — |
| 9 | 5 | 5.1 | Audit line verification | MEDIUM | 1h | — |
| 10 | 5 | 5.4 | Final `pytest` + Alembic verification | HIGH | 1h | 3.1 |

---

## Agent Skill Mapping

| Skill | Phase / Item | Why |
|-------|-------------|-----|
| `security-reviewer` | 1.4 (RBAC audit) | Deep auth/authorization audit |
| `test-master` | 2.3 (ML tests), 5.4 (final pytest) | Coverage gates, regression tests |
| `ml-pipeline` | 2.1 (SHAP fallback), 2.6 (train leakage) | ML-specific patterns |
| `postgres-pro` | 3.1 (Alembic downgrade), 3.3 (PostGIS) | SQL/DDL verification |
| `kubernetes-specialist` | 3.4, 3.5, 3.6 (K8s/network/probes) | K8s resource and security policies |
| `nextjs-developer` | 4.5, 4.3 (store/types/heatmap) | Frontend component/state patterns |
| `typescript-pro` | 4.1, 4.5 (types) | Type synchronization |
| `fullstack-guardian` | All phases (cross-check) | End-to-end integration guard |

---

## Verification Checklist (Before Declaring 100%)

- [ ] All 5 phases have at least 1 item completed (or documented as blocked by env)
- [ ] `docs/reports/VERIFICATION_LOG.md` exists with `pytest` output (even if skipped due to missing venv)
- [ ] `MEMORY.md` updated with `master-plan-v3` reference
- [ ] No `TODO`, `FIXME`, or `pass` stubs remain in `kmeans_hotspot.py`, `geospatial_service.py`, `train.py`
- [ ] `init_db.sql` matches Alembic 0001 DDL (manual diff verified)
- [ ] `main.py` `lifespan` includes Alembic upgrade + PubSub start + DB init (verified read)
- [ ] `frontend/src/types/index.ts` uses `viewer` not `officer` (verified)
- [ ] `docs/reports/IMPLEMENTATION_PLAN_V2.md` preserved (not overwritten)

---

*Plan version: v3 | Created: 2026-09-10 | Reference: commit `19df69c` + audit reports in `docs/reports/`*
