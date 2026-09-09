# Developer & Contributor Guide

This guide assists engineers in setting up, developing, testing, and debugging the **CASHGUARD-AI (CPAF)** codebase locally.

---

## 1. Prerequisites

- **Python**: Version `3.11+`
- **Node.js**: Version `18.x` or `20.x` with `npm`
- **Docker & Docker Compose**: For local PostgreSQL + PostGIS and Redis
- **System Geospatial Libraries** (Optional if running native without Docker): `libgdal-dev`, `libpq-dev`

---

## 2. Local Environment Setup

### 2.1 Clone and Setup Environment Variables
```bash
git clone https://github.com/vinittttt13/CASHGUARD-AI.git
cd CASHGUARD-AI
cp .env.example .env
```

### 2.2 Start Database & Cache Infrastructure
```bash
docker-compose up -d postgres redis adminer
```

### 2.3 Backend Setup
```bash
cd backend

# Create and activate Python virtual environment
python -m venv venv
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download spaCy English model (required for NLP features)
python -m spacy download en_core_web_sm

# Seed the database with initial users, ATMs, complaints & alerts
python seed_db.py

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```
API Documentation will be live at `http://localhost:8000/docs`.

### 2.4 Frontend Setup
```bash
cd ../frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```
Web application dashboard will be live at `http://localhost:3000`.

---

## 3. Seed Accounts & Mock Data

When you execute `python backend/seed_db.py`, the following test accounts are provisioned:

| Role | Email | Password | Jurisdiction | Permissions |
|---|---|---|---|---|
| **Admin** | `admin@cpaf.gov.in` | `admin123` | National | Full CRUD, User Management, Model Hot-Swapping |
| **Analyst** | `analyst1@cpaf.gov.in` | `analyst123` | Maharashtra | Create Complaints, Run Predictions, Ack Alerts |
| **Analyst** | `analyst2@cpaf.gov.in` | `analyst123` | Delhi | Create Complaints, Run Predictions, Ack Alerts |
| **Viewer** | `viewer@cpaf.gov.in` | `viewer123` | Karnataka | Read-only with Automatic PII Masking |

### Generating Synthetic Datasets
To generate large-scale synthetic cybercrime datasets for stress testing or offline model training:
```bash
python backend/generate_sample_data.py
```

---

## 4. Running Tests

### Backend Unit & Integration Tests
```bash
cd backend
pytest -v
```

### Frontend Type Check & Linting
```bash
cd frontend
npm run type-check
npm run lint
```

---

## 5. Project Directory Cheatsheet

```text
CASHGUARD-AI/
├── .github/workflows/         # CI/CD and Weekly Retrain Actions
├── backend/                   # FastAPI Server, Models, ML Pipeline, Seeds
│   ├── alembic/               # Database migration scripts
│   ├── app/
│   │   ├── api/v1/            # API Route definitions
│   │   ├── core/              # Config, Async DB Engine, Redis, Security
│   │   ├── ml/                # XGBoost, RF, Prophet, SHAP, K-Means
│   │   ├── models/            # SQLAlchemy Database Models
│   │   ├── schemas/           # Pydantic validation schemas
│   │   ├── services/          # Business logic services
│   │   └── utils/             # Anonymizer, Circuit Breaker, Logger, Rate Limiter
│   ├── tests/                 # Pytest test cases
│   ├── seed_db.py             # Database seed script
│   └── requirements.txt       # Python dependencies
├── docs/                      # Comprehensive System Documentation
├── frontend/                  # Next.js 14 Web Application
│   ├── src/app/               # App Router pages
│   ├── src/components/        # React & Leaflet UI components
│   ├── src/store/             # Zustand global stores
│   └── package.json           # Node.js dependencies
├── kubernetes/                # Production K8s YAML manifests
├── docker-compose.yml         # Container orchestrator
└── README.md                  # Project root README
```
