---
name: audit-system-improvement-plan
---

# CASHGUARD-AI / CPAF — System Improvement & Hardening Plan (4-Phase)

## Phase 1: Critical Fixes & Bug Patches (Week 1-2)

| Issue | File(s) | Action | Metric |
|---|---|---|---|
| Mock prediction endpoint | `predict.py`, `prediction_service.py` | Wire `FeatureEngineer` + `ModelRegistry`; implement `BackgroundTasks` batch | Real predictions; batch executes |
| Hardcoded JWT secret (`supersecretkey`) | `core/config.py` | Load from `.env`; enforce `>=32` chars; `extra="forbid"` | Secret not in source |
| Refresh token revocation missing | `core/security.py`, `redis_client.py`, `auth.py` | Add Redis `revoked:{jti}` TTL 7d; check on refresh; revoke on logout | Stolen refresh rejected |
| Rate limiter memory-only | `utils/rate_limiter.py` | Configure `SlowAPI` with `redis://` storage URI | Survives K8s replicas |
| Empty test suite (`pass`) | `tests/test_api.py`, `test_ml.py` | Write `AsyncClient` integration tests; add `--cov` | Coverage >70% |
| Mock WebSocket / no PubSub | `services/websocket_manager.py`, `api/v1/websocket.py` | Redis PubSub `subscribe`/`publish`; relay broadcasts | Real-time cross-pod alerts |

---

## Phase 2: ML Pipeline & Feature Hardening (Week 3-4)

| Issue | File(s) | Action | Metric |
|---|---|---|---|
| Feature leakage (percentile) | `feature_engineering.py` (L86) | Compute percentiles on train split only; apply bins to val/test | Validation accuracy ±2% |
| Label encoding leaks | `feature_engineering.py` | `OneHotEncoder(handle_unknown='ignore')` | No `KeyError` |
| SHAP runtime overhead | `shap_explainer.py`, `predict.py` | Redis cache (`shap:{cid}` TTL 3600) | Inference <200ms |
| KDTree Euclidean approximation | `feature_engineering.py` | Document; consider UTM projection | Distance error <5% |
| Model validation missing | `ml/` (new) | `model_validation.py`: `cross_validate`, `classification_report` | Metrics in DB |
| Mock intelligence/hotspots | `intelligence_service.py`, `geospatial_service.py` | Real DB queries + `KDTree` from `WithdrawalLocation` | `report` reflects DB |

---

## Phase 3: Scale & Resiliency (Week 5-6)

| Issue | File(s) | Action | Metric |
|---|---|---|---|
| Distributed WebSocket | `websocket_manager.py`, `redis_client.py` | Redis PubSub `broadcast` + per-pod `subscribe` relay | All clients <1s delay |
| DB connection pool limits | `core/database.py` | `pool_pre_ping=True`, `pool_recycle=3600`, `pool_size=50`, `max_overflow=20` | 100 concurrent users |
| Async blocking inference | `predict.py`, `services/` | `asyncio.to_thread()` for SHAP/model calls | Event loop unblocked |
| Circuit breaker unused | `utils/circuit_breaker.py` | Wire in `predict.py`; log state changes | Downstream failures isolated |
| K8s security / probes | `kubernetes/*.yaml` | `securityContext`, `networkPolicy`, `startupProbe`, resource increases (`2Gi`) | Non-root pods; restricted network |
| CI depth | `.github/workflows/ci.yml` | `bandit`, `safety`, `pytest --cov`, `fail-under=70` | Security scans pass |

---

## Phase 4: Advanced Features & Polish (Week 7-8)

| Issue | File(s) | Action | Metric |
|---|---|---|---|
| Fraud ring graph analytics | `ml/graph_analytics.py` (new) | Network graph from bank names + locations | >3 shared nodes detected |
| Automated report export | `intelligence_service.py` | `weasyprint` PDF/CSV; cron scheduling | `/intelligence/report` export |
| Interactive UI polish | `frontend/` | Viewport filtering, `useWebSocket` reconnect, complete `types/index.ts` | Responsive at 1k+ points |
| Model hot-swap validation | `ml/model_registry.py` | Version tag + rollback on error | Zero-downtime swap |
| PII masking completeness | `utils/anonymizer.py` | `mask_text()` regex for names/phones/accounts in `complaint_text` | Zero unmasked PII |

---

*Files audited: 8 docs (`docs/*.md`); Implementation: `backend/app/` (all modules); `frontend/src/`; `kubernetes/`; `.github/workflows/`.*
