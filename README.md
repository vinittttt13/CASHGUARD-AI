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



```text
+----------------+       +-------------------+       +-----------------+
|                |       |                   |       |                 |
|  Next.js       |<----->|  FastAPI Backend  |<----->| PostgreSQL      |
|  Frontend      |       |  (Python/ML)      |       | (w/ PostGIS)    |
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
- GDAL/PostGIS system libraries

## Quick Start

1. Copy `.env.example` to `.env` and adjust variables if needed.
   ```bash
   cp .env.example .env
   ```
2. Build and run containers using Docker Compose:
   ```bash
   docker-compose up --build
   ```
3. Access the applications:
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
Key endpoints:
- `GET /health` - Health check
- `POST /api/v1/auth/login` - Authenticate users
- `GET /api/v1/predictions` - Get crime predictions
- `POST /api/v1/incidents` - Report a new incident

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `SECRET_KEY` | JWT secret | `your-secret` |
| `NEXT_PUBLIC_API_URL` | Frontend API URL | `http://localhost:8000` |

## Model Training

Models are retrained weekly via GitHub Actions. To train manually:
```bash
python backend/app/ml/train.py
```

## Testing

Backend: `pytest backend/`
Frontend: `npm run test`

## Deployment

Kubernetes manifests are provided in the `kubernetes/` directory.
```bash
kubectl apply -f kubernetes/
```

## Security Notes

- Always change `SECRET_KEY` and database credentials in production.
- Ensure CORS origins are strictly defined.
- Run containers as non-root users (already configured in Dockerfiles).

## License

MIT
