# 🛡️ CASHGUARD-AI — Cybercrime Predictive Analytics Framework (CPAF)

> **Predictive Intelligence & Decision Support Platform for Cyber Financial Crime Prevention**  
> *FastAPI · Next.js 14 · PostgreSQL · Redis · XGBoost · Prophet · NetworkX · FastMCP · Docker · Kubernetes*

---

## 📌 Executive Summary

**CASHGUARD-AI** (internally designated as the *Cybercrime Predictive Analytics Framework — CPAF*) is an end-to-end, AI-powered predictive intelligence platform engineered for law enforcement agencies (LEAs), cybercrime cells, and financial intelligence units.

### The Problem
Financial cybercrime—such as ATM skimming, UPI fraud, vishing, and phishing scams—operates at extreme velocity. Stolen funds are rapidly siphoned through layered networks of money mule accounts and cashed out at physical ATMs or POS terminals before victims even report the incident. Traditional policing methods are inherently **reactive**, analyzing complaints days or weeks after the financial trail has gone cold.

### The Solution
CASHGUARD-AI shifts law enforcement from **reactive case logging to proactive, predictive intervention**:
1. **Predicts** when and where fraudulent cashouts will occur before funds are withdrawn.
2. **Classifies** incoming complaints by risk level (Low, Medium, High) in real time.
3. **Uncovers** organized money mule rings and circular routing using graph analytics.
4. **Forecasts** crime volume trends across districts for proactive police patrolling and resource allocation.
5. **Streams** live actionable alerts directly to field analysts via real-time WebSockets.

---

## 🚀 Key Features & Capabilities

| Feature | Description | Core Technology |
| :--- | :--- | :--- |
| **🎯 Real-Time Risk Scoring** | Scores complaint severity (0.0–1.0) and assigns risk tiers based on transaction velocity, amount, and fraud patterns. | XGBoost, Random Forest, scikit-learn |
| **📍 Cashout Hotspot Clustering** | Identifies geographic clusters of ATM/POS cashouts and executes fast radius lookups. | K-Means Clustering, In-Memory BallTree (haversine) |
| **🕸️ Mule Network & Ring Detection** | Maps multi-hop transaction trails, detects circular routing, and isolates organized fraud syndicates. | NetworkX Graph Analytics, FraudRingGraph Visualizer |
| **📈 Crime Trend Forecasting** | Forecasts crime volume spikes and seasonal trends by jurisdiction and fraud category. | Facebook Prophet / Time-Series Decomposition |
| **🔍 Explainable AI (XAI)** | Provides transparent feature attribution for risk scores so investigators understand *why* an alert triggered. | SHAP (SHapley Additive exPlanations) |
| **📝 Automated NLP Extraction** | Extracts phone numbers, bank accounts, UPI IDs, transaction hashes, and victim details from raw complaint text. | spaCy (`en_core_web_sm`), Regex Tokenizers |
| **⚡ Real-Time Live Feed** | Streams live alerts and high-risk incidents instantly to connected analyst dashboards. | WebSockets, Redis Pub/Sub |
| **🤖 Model Context Protocol (MCP)** | Exposes database and analytics tools to AI assistants (Claude, Cursor, Antigravity) for conversational investigation. | FastMCP (Python) |

---

## 🏛️ System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CASHGUARD-AI SYSTEM                             │
└─────────────────────────────────────────────────────────────────────────────┘

       ┌────────────────────────┐              ┌────────────────────────┐
       │     Next.js 14 App     │              │    AI Assistant /      │
       │   (Analyst Dashboard)  │              │    MCP Clients         │
       │   Port: 3000           │              │    (Claude / Cursor)   │
       └───────────┬────────────┘              └───────────┬────────────┘
                   │ HTTP / WebSocket                      │ FastMCP Tools
                   ▼                                       ▼
       ┌────────────────────────────────────────────────────────────────┐
       │                     FastAPI Application                        │
       │                     (Python 3.11 Async)                        │
       │                     Port: 8000                                 │
       │                                                                │
       │  • /api/v1/auth          • /api/v1/complaints                  │
       │  • /api/v1/predict       • /api/v1/intelligence                │
       │  • /api/v1/locations     • /api/v1/ws/live-feed                │
       └──────────────┬─────────────────────────┬───────────────────────┘
                      │                         │
           SQLAlchemy │ (asyncpg)               │ Cache & PubSub
                      ▼                         ▼
         ┌─────────────────────────┐   ┌─────────────────────────┐
         │       PostgreSQL        │   │          Redis          │
         │   (Relational Data)     │   │   (PubSub & Cache)      │
         │   Port: 5432            │   │   Port: 6379            │
         └─────────────────────────┘   └─────────────────────────┘
                      │
                      ▼
         ┌───────────────────────────────────────────────────────┐
         │                  ML Engine & Analytics                │
         │  • XGBoost / Random Forest (Risk Scoring)             │
         │  • K-Means + BallTree (Geospatial Hotspots)           │
         │  • NetworkX (Mule Graph Analytics)                    │
         │  • Prophet (Time-Series Volume Forecasting)           │
         │  • SHAP (Explainability & Feature Importance)         │
         │  • spaCy (Complaint Entity & Keyword Extraction)      │
         └───────────────────────────────────────────────────────┘
```

---

## 💻 Tech Stack Summary

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons, Recharts, React-Leaflet, Zustand, custom hook data fetching (`useApiResource` & SWR).
- **Backend**: FastAPI, Uvicorn, Python 3.11+, Pydantic v2, SQLAlchemy 2.0 (async), Alembic, SlowAPI (rate limiting), structlog.
- **Machine Learning & NLP**: XGBoost, scikit-learn, Prophet, SHAP, NetworkX, spaCy (`en_core_web_sm`).
- **Data & Caching**: PostgreSQL 15, Redis 7 (caching, session state, real-time message brokering).
- **AI Tooling**: Model Context Protocol (FastMCP) server in `mcp/server.py`.
- **DevOps & Infrastructure**: Docker, Docker Compose, Kubernetes manifests (`kubernetes/`), GitHub Actions CI/CD workflows.

---

## 📂 Repository Structure

```text
CASHGUARD-AI/
├── backend/                  # FastAPI Application & ML Engine
│   ├── alembic/              # Database migration scripts
│   ├── app/
│   │   ├── api/v1/           # REST & WebSocket route handlers
│   │   ├── core/             # Configuration, database, and security
│   │   ├── ml/               # ML models, feature engineering, graph analytics
│   │   ├── models/           # SQLAlchemy 2.0 ORM models
│   │   ├── schemas/          # Pydantic data schemas
│   │   └── services/         # Business logic & geospatial services
│   ├── Dockerfile            # Multi-stage production backend image
│   └── seed_db.py            # Database seeding script for development
│
├── frontend/                 # Next.js 14 Web Application
│   ├── src/
│   │   ├── app/              # Next.js App Router (Dashboard, Analytics, Alerts, etc.)
│   │   ├── components/       # UI components, Leaflet maps, FraudRingGraph visualizer
│   │   ├── hooks/            # Custom hooks (WebSocket, auth, queries)
│   │   ├── lib/              # API clients and utility functions
│   │   └── store/            # Zustand global state stores
│   └── Dockerfile            # Production standalone Next.js image
│
├── mcp/                      # Model Context Protocol (MCP) Server
│   ├── server.py             # FastMCP server exposing DB & ML tools to LLMs
│   └── Dockerfile            # Containerized MCP server
│
├── dataset/                  # AML Dataset cleaning scripts & manifests
├── kubernetes/               # Production Kubernetes manifests (Deployments, Ingress, HPA)
├── scripts/                  # MCP configuration, smoke testing, and setup scripts
├── docs/                     # Comprehensive technical documentation suite
└── docker-compose.yml        # Orchestration for the complete multi-container stack
```

---

## ⚡ Quick Start

### Option 1: Run with Docker Compose (Recommended)

1. **Clone the repository and enter the directory**:
   ```bash
   git clone https://github.com/vinittttt13/CASHGUARD-AI.git
   cd CASHGUARD-AI
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

3. **Start the complete stack**:
   ```bash
   docker compose up --build
   ```
   *The `migrate` container automatically runs database migrations (`alembic upgrade head`) before the backend boots.*

4. **(Optional) Seed sample data**:
   ```bash
   docker compose exec backend python seed_db.py
   ```

5. **Access services**:
   - **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
   - **Interactive API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Database GUI (Adminer)**: [http://localhost:8080](http://localhost:8080)

---

### Option 2: Manual Local Development

#### Backend Setup
```bash
cd backend
python -m venv venv
# On Windows: venv\Scripts\activate | On Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
alembic upgrade head
python seed_db.py
uvicorn app.main:app --reload --port 8000
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:3000
```

---

## 🔌 Key API Endpoints

- `GET /health` — Liveness health check.
- `GET /health/ready` — Readiness check verifying PostgreSQL and Redis connections.
- `POST /api/v1/auth/login` — User authentication and JWT token issuance.
- `GET /api/v1/complaints` — Filter, search, and paginate reported cybercrime incidents.
- `POST /api/v1/predict` — Submit complaint parameters for real-time risk scoring and cashout prediction.
- `GET /api/v1/intelligence/alerts` — Retrieve prioritized intelligence alerts and syndicate activity.
- `GET /api/v1/locations/hotspots` — Fetch high-risk geospatial cashout clusters.
- `WS /api/v1/ws/live-feed?token=<jwt>` — Real-time WebSocket connection for live threat streaming.

---

## 📚 Further Documentation

For deep technical specifications, consult the documents in the [`docs/`](docs/) directory:
- 🏛️ **[System Architecture](docs/SYSTEM_ARCHITECTURE.md)** — Architectural design and data flows.
- 🤖 **[ML Pipeline & Models](docs/ML_PIPELINE_AND_MODELS.md)** — Model training, feature engineering, and evaluation.
- 🔌 **[Backend API Reference](docs/BACKEND_API_REFERENCE.md)** — Full REST and WebSocket API specifications.
- 🗄️ **[Database & Data Models](docs/DATABASE_AND_DATA_MODELS.md)** — PostgreSQL schema, indexes, and migrations.
- 🖥️ **[Frontend Architecture](docs/FRONTEND_ARCHITECTURE.md)** — React / Next.js design patterns and state management.
- 🚀 **[DevOps & Deployment](docs/DEVOPS_DEPLOYMENT_GUIDE.md)** — Docker, Kubernetes, and CI/CD pipelines.
- 🤖 **[MCP Server Setup](docs/MCP_SERVER_SETUP.md)** — Model Context Protocol setup and tool catalog.
- 💳 **[IBM AML Dataset Integration](docs/IBM_AML_DATASET_INTEGRATION.md)** — 40GB transaction dataset ETL pipeline.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
