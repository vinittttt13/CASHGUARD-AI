# Contributing

## Setup

```bash
cp .env.example .env
docker compose up --build          # postgres, redis, migrate, backend, frontend
```

Local (no Docker):

```bash
# backend
cd backend && python -m venv venv && . venv/bin/activate
pip install -r requirements.txt && python -m spacy download en_core_web_sm
alembic upgrade head && python seed_db.py
PYTHONPATH=. uvicorn app.main:app --reload

# frontend
cd frontend && npm ci && npm run dev
```

## Checks (must pass before opening a PR)

| | command |
|---|---|
| Backend lint | `ruff check backend` |
| Backend format | `black --check backend` |
| Backend tests | `cd backend && PYTHONPATH=. pytest` (heavy: `pytest -m slow`) |
| Frontend lint / types | `cd frontend && npm run lint && npm run type-check` |
| Frontend build | `npm run build` |
| Frontend tests | `npm run test` |
| Dead code | `npm run lint:dead` |

## pre-commit

```bash
pip install pre-commit && pre-commit install
pre-commit run --all-files
```

Runs ruff, black, detect-secrets, YAML checks and eslint on staged files.

## Conventions

- Line endings: LF (`.editorconfig` / `.gitattributes`). 2-space TS/JS/YAML,
  4-space Python.
- Schema changes go through Alembic (`alembic revision --autogenerate`), never
  `create_all`. `alembic check` must be clean.
- Never commit model `.pkl` binaries or dataset files (both git-ignored).
- One commit per microtask when working the remediation plan
  (`docs/ROADMAP.md`).
