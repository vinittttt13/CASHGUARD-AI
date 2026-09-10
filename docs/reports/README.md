# Technical Audit Reports — CASHGUARD-AI / CPAF

> **Audit date**: 2026-09-10
> **Status**: The audit findings were rolled into
> [`../REPO_ANALYSIS_AND_IMPROVEMENTS.md`](../REPO_ANALYSIS_AND_IMPROVEMENTS.md)
> and the 10-microtask plan ([`../IMPLEMENTATION_PLAN_MICROTASKS.md`](../IMPLEMENTATION_PLAN_MICROTASKS.md)).
> Track execution in [`../ROADMAP.md`](../ROADMAP.md).

The per-domain audit reports have been moved to [`../archive/`](../archive/):

| Report | Domain |
| :--- | :--- |
| [`AUDIT_DB_SCHEMA.md`](../archive/AUDIT_DB_SCHEMA.md) | schema / constraints / indexes |
| [`AUDIT_SECURITY_RBAC.md`](../archive/AUDIT_SECURITY_RBAC.md) | JWT / refresh revocation / rate limiter / PII |
| [`AUDIT_BACKEND_ARCH.md`](../archive/AUDIT_BACKEND_ARCH.md) | WebSocket PubSub / circuit breaker / geospatial / pool |
| [`AUDIT_ML_PIPELINE.md`](../archive/AUDIT_ML_PIPELINE.md) | mock predictions / feature leakage / SHAP / split |
| [`AUDIT_FRONTEND.md`](../archive/AUDIT_FRONTEND.md) | reconnect / types / Leaflet / ErrorBoundary / Zustand |
| [`AUDIT_DEVOPS.md`](../archive/AUDIT_DEVOPS.md) | CI tests / k8s security / Redis auth / health probes |
| [`MASTER_IMPROVEMENT_PLAN*.md`](../archive/) | v1 & v3–v5 improvement plans (superseded) |

`VERIFICATION_LOG.md` in this directory records the current verification state.
