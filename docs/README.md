# Cybercrime Predictive Analytics Framework (CPAF) / CASHGUARD-AI
## Comprehensive Documentation Suite

Welcome to the technical documentation for **CASHGUARD-AI (Cybercrime Predictive Analytics Framework - CPAF)**. This suite provides detailed specifications of the system architecture, machine learning models, database schema, REST/WebSocket APIs, frontend architecture, and DevOps deployment setups.

---

## 📚 Documentation Index

| Document | Description |
| :--- | :--- |
| **[1. System Architecture](./SYSTEM_ARCHITECTURE.md)** | End-to-end system design, high-level and low-level component flows, data ingestion pipelines, caching, and security boundaries. |
| **[2. Machine Learning Pipeline & Models](./ML_PIPELINE_AND_MODELS.md)** | Detailed mathematical & algorithmic breakdown of XGBoost, Random Forest, Facebook Prophet, K-Means & DBSCAN Hotspot Detection, NLP Extractor, and SHAP explainability. |
| **[3. Backend & API Reference](./BACKEND_API_REFERENCE.md)** | Complete REST and WebSocket API specification, JWT authentication, RBAC authorization, Pydantic schemas, rate limiting, and circuit breaker patterns. |
| **[4. Database Schema & Data Models](./DATABASE_AND_DATA_MODELS.md)** | PostgreSQL + PostGIS ER model, SQLAlchemy 2.0 Async models, relational mappings, enums, indexing strategy, and anonymization/masking rules. |
| **[5. Frontend Architecture & UI Guide](./FRONTEND_ARCHITECTURE.md)** | Next.js 14 (App Router), TailwindCSS, Radix UI components, Zustand state store, Leaflet & Heatmap visualizations, and real-time WebSocket feeds. |
| **[6. DevOps & Deployment Guide](./DEVOPS_DEPLOYMENT_GUIDE.md)** | Docker Compose setups, Kubernetes (Deployments, StatefulSets, Ingress), GitHub Actions CI/CD, automated retraining cron jobs, and production security hardening. |
| **[7. Developer & Contributor Guide](./DEVELOPER_AND_CONTRIBUTOR_GUIDE.md)** | Local development environment setup, mock data generation, database seeding, testing with Pytest, and debugging techniques. |
| **[8. IBM AML Dataset Integration & Preprocessing](./IBM_AML_DATASET_INTEGRATION.md)** | Architecture, graph motifs (Fan-In, Fan-Out, Scatter-Gather), out-of-core 40GB ETL streaming pipeline, and feature engineering for mule network tracking. |
| **[9. Technical Audit Reports & Improvement Roadmap](./reports/README.md)** | Comprehensive audit of database schema, security/RBAC, backend, ML pipeline, frontend, DevOps, and 4-phase master improvement plan. |
| **[10. Frontend System Creation Guide](./FRONTEND_SYSTEM_CREATION_GUIDE.md)** | Comprehensive step-by-step engineering runbook for building the Next.js 14, Tailwind CSS, Leaflet geospatial, and WebSocket frontend command center. |
| **[11. MCP Server Setup Guide](./MCP_SERVER_SETUP.md)** | Shared repository Model Context Protocol (MCP) server running local containerized tools for database, ML analytics, and Redis caching. |



---

## 🎯 Project Quick Summary

**CASHGUARD-AI (CPAF)** is an enterprise-grade cybercrime intelligence and predictive analytics platform engineered to help law enforcement agencies and financial institutions anticipate, detect, and mitigate cyber-enabled financial fraud (vishing, phishing, ATM skimming, UPI fraud, and fraudulent cash withdrawals).

### Tech Stack at a Glance:
- **Frontend**: Next.js 14, React 18, TypeScript, TailwindCSS, Radix UI, Leaflet / React-Leaflet, Recharts, Zustand, SWR.
- **Backend**: Python 3.11, FastAPI, SQLAlchemy 2.0 (AsyncIO), Alembic, Pydantic v2, SlowAPI, Structlog.
- **Machine Learning**: XGBoost, Scikit-learn (RandomForest, KMeans, DBSCAN), Prophet, SHAP, spaCy, TextBlob.
- **Data & Cache**: PostgreSQL 15 with PostGIS spatial extensions, Redis 7 (Async caching & session state).
- **DevOps & Infra**: Docker, Docker Compose, Kubernetes manifests (K8s Deployments, StatefulSet, Ingress), GitHub Actions CI/CD.
