# CASHGUARD-AI — Documentation

Cybercrime Predictive Analytics Framework (CPAF): a platform for anticipating,
detecting and mitigating cyber-enabled financial fraud (vishing, phishing, ATM
skimming, UPI fraud, fraudulent cash withdrawals).

## Quick Start

### 🚀 1-Minute Live Demo Setup

Run the automated demo quickstart:

```bash
python scripts/demo_quickstart.py --simulate-incident
# or on Windows
scripts/demo_quickstart.bat --simulate-incident
```

This validates the environment, verifies/pre-trains ML artifacts (`xgboost_aml.pkl`), seeds the database (`seed_db.py`), and injects a live simulated fraud alert via Redis so the frontend dashboards chime immediately. See `README.md` for the full walkthrough.

## Start here

| | |
|---|---|
| **Status & plan** | [`PROJECT_STATUS_AND_GAPS.md`](./PROJECT_STATUS_AND_GAPS.md) (verified, current) · [`ROADMAP.md`](./ROADMAP.md) · [`IMPLEMENTATION_PLAN_MICROTASKS.md`](./IMPLEMENTATION_PLAN_MICROTASKS.md) · [`CHANGELOG.md`](./CHANGELOG.md) |
| **What's in the repo & why** | [`REPO_ANALYSIS_AND_IMPROVEMENTS.md`](./REPO_ANALYSIS_AND_IMPROVEMENTS.md) |
| **Competitive research & pitch** | [`FRONTEND_RESEARCH_AND_GAPS.md`](./FRONTEND_RESEARCH_AND_GAPS.md) · [`USP_ANALYSIS.md`](./USP_ANALYSIS.md) · [`FEASIBILITY_ANALYSIS.md`](./FEASIBILITY_ANALYSIS.md) |
| **Decisions** | [`adr/`](./adr/) (ADR 0001 — drop PostGIS) |

## Reference

| Document | Scope |
|---|---|
| [System Architecture](./SYSTEM_ARCHITECTURE.md) | end-to-end design, data flow, caching, security boundaries |
| [ML Pipeline & Models](./ML_PIPELINE_AND_MODELS.md) | XGBoost, RF, Prophet, KMeans/DBSCAN, NLP, SHAP |
| [Backend & API Reference](./BACKEND_API_REFERENCE.md) | REST + WebSocket spec, JWT/RBAC, schemas, rate limiting |
| [Database & Data Models](./DATABASE_AND_DATA_MODELS.md) | SQLAlchemy 2.0 async models, enums, indexes, Alembic |
| [Frontend Architecture](./FRONTEND_ARCHITECTURE.md) | Next.js 14 App Router, Zustand, Leaflet, WebSocket feed |
| [Frontend System Creation Guide](./FRONTEND_SYSTEM_CREATION_GUIDE.md) | step-by-step build runbook |
| [DevOps & Deployment](./DEVOPS_DEPLOYMENT_GUIDE.md) | Docker Compose, Kubernetes, CI/CD, retraining |
| [Developer & Contributor Guide](./DEVELOPER_AND_CONTRIBUTOR_GUIDE.md) | local setup, seeding, testing, debugging |
| [IBM AML Dataset Integration](./IBM_AML_DATASET_INTEGRATION.md) | 40 GB out-of-core ETL, graph motifs, feature engineering |
| [MCP Server Setup](./MCP_SERVER_SETUP.md) | containerized MCP tools for DB / ML / Redis |
| [Audit reports](./reports/README.md) | per-domain audits (the source of the improvement plan) |

## Archive

Superseded planning docs (v2–v5 master plans, the original audit set) live in
[`archive/`](./archive/). They are kept for history; `ROADMAP.md` is current.

## Stack

- **Frontend** — Next.js 14, React 18, TypeScript, TailwindCSS, Radix UI,
  React-Leaflet, Recharts, Zustand.
- **Backend** — Python 3.11, FastAPI, SQLAlchemy 2.0 async, Alembic, Pydantic v2,
  SlowAPI, structlog.
- **ML** — XGBoost, scikit-learn (RandomForest, KMeans, DBSCAN), Prophet, SHAP,
  spaCy, TextBlob.
- **Data & cache** — PostgreSQL 15, Redis 7.
- **Infra** — Docker, Docker Compose, Kubernetes, GitHub Actions.
