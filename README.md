# Cybercrime Predictive Analytics Framework (CPAF)

## Project Overview

CPAF is a robust system designed to ingest, process, and analyze cybercrime data to provide actionable intelligence and predictive insights.

### 📚 Detailed Documentation Suite
- 🏛️ **[System Architecture](docs/SYSTEM_ARCHITECTURE.md)**
- 🤖 **[Machine Learning Pipeline & Models](docs/ML_PIPELINE_AND_MODELS.md)**
- 🔌 **[Backend & REST/WebSocket API Reference](docs/BACKEND_API_REFERENCE.md)**
- 🗄️ **[Database Schema & Data Models](docs/DATABASE_AND_DATA_MODELS.md)**
- 🖥️ **[Frontend Architecture & UI Guide](docs/FRONTEND_ARCHITECTURE.md)**
- 🚀 **[DevOps, Docker & Kubernetes Deployment](docs/DEVOPS_DEPLOYMENT_GUIDE.md)**
- 🛠️ **[Developer & Contributor Setup Guide](docs/DEVELOPER_AND_CONTRIBUTOR_GUIDE.md)**
- 💳 **[IBM AML Dataset Integration & 40GB ETL Pipeline](docs/IBM_AML_DATASET_INTEGRATION.md)**
- 📋 **[Technical Audit Reports & Master Roadmap](docs/reports/README.md)**
- 🎨 **[Frontend System Creation & Engineering Guide](docs/FRONTEND_SYSTEM_CREATION_GUIDE.md)**
- 🤖 **[MCP Server Setup Guide (Approach 1)](docs/MCP_SERVER_SETUP.md)**



```text
+----------------+       +-------------------+       +-----------------+
|                |       |                   |       |                 |
|  Next.js       |<----->|  FastAPI Backend  |<----->| PostgreSQL      |
|  Frontend      |       |  (Python/ML)      |       |                 |
|                |       |                   |       |                 |
+----------------+       +-------------------+       +-----------------+
                                  ^
                                  |
                                  v
                         +-------------------+
                         |                   |
                         |  Redis (Caching/  |
                         |  Celery broker)   |
                         |                   |
                         +-------------------+
```

## Prerequisites

- Docker and Docker Compose
- Node.js (>= 18) for local frontend development
- Python (>= 3.11) for local backend development

## Quick Start

1. Copy `.env.example` to `.env` and adjust variables if needed.
   ```bash
   cp .env.example .env
   ```
2. Build and run containers using Docker Compose:
   ```bash
   docker compose up --build
   ```
   The one-shot `migrate` service runs `alembic upgrade head` (the only thing
   that touches the schema) and the `backend` waits for it before starting.
3. (Optional) Seed demo data:
   ```bash
   docker compose exec backend python seed_db.py
   ```
4. Access the applications:
   - Frontend: http://localhost:3000
   - Backend API Docs: http://localhost:8000/docs
   - Database GUI (Adminer): http://localhost:8080

## Manual Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## API Documentation Summary

The system provides a REST API via FastAPI. View the full Swagger UI at `/docs`.
Key endpoints (all under `/api/v1` except health):

- `GET /health` — liveness; `GET /health/ready` — readiness (DB + Redis)
- `POST /api/v1/auth/login` · `/auth/refresh` · `/auth/logout` · `GET /auth/me`
- `GET|POST /api/v1/complaints`, `GET /api/v1/complaints/stats/aggregate`
- `POST /api/v1/predict`, `GET /api/v1/predict/{id}`
- `GET /api/v1/intelligence/alerts` · `/intelligence/report` · `/intelligence/trends`
- `GET /api/v1/locations` · `/locations/hotspots` · `/locations/heatmap` · `/locations/nearby`
- `WS /api/v1/ws/live-feed?token=<jwt>` — real-time alert feed

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `SECRET_KEY` | JWT secret | `your-secret` |
| `NEXT_PUBLIC_API_URL` | Frontend API URL | `http://localhost:8000` |
| `POSTGRES_HOST_PORT` | Host-side port for the `postgres` container (Docker Compose only). Change this if 5432 is already taken by a native/local Postgres install — services inside Compose always reach Postgres at `postgres:5432` regardless. | `5433` |

## Model Training

Models are retrained weekly via GitHub Actions (`.github/workflows/retrain.yml`).
To train manually (from `backend/`):
```bash
cd backend
PYTHONPATH=. python -m app.ml.train                       # from the database
PYTHONPATH=. python -m app.ml.train --from-csv tests/fixtures/mini_train.csv
```

## Testing

See [`docs/TESTING.md`](docs/TESTING.md) for the full strategy.

- Backend (from `backend/`): `PYTHONPATH=. pytest` · heavy ML: `pytest -m slow`
- Frontend (from `frontend/`): `npm run test` · dead code: `npm run lint:dead`
- End-to-end: `scripts/smoke.sh` (curl) and `cd frontend && npm run e2e`
  (Playwright) against a running `docker compose` stack

## Deployment

Kubernetes manifests are provided in the `kubernetes/` directory. **Do not**
`kubectl apply -f kubernetes/` directly — that directory also holds
`*-secrets.example.yaml` templates (placeholder credentials, never meant to
be applied as-is). See [`docs/DEVOPS_DEPLOYMENT_GUIDE.md`](docs/DEVOPS_DEPLOYMENT_GUIDE.md#3-production-kubernetes-manifests-kubernetes)
for the real Secrets-first deployment order.

## Security Notes

- Always change `SECRET_KEY` and database credentials in production.
- Ensure CORS origins are strictly defined.
- Run containers as non-root users (already configured in Dockerfiles).

## License

MIT
