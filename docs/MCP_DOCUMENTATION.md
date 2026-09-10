# CashGuard-AI — Model Context Protocol (MCP) Documentation

> **Version:** 1.0 | **Last Updated:** September 2026 | **Transport:** stdio (Docker)

---

## Table of Contents

1. [What is MCP?](#1-what-is-mcp)
2. [How CashGuard-AI Uses MCP](#2-how-cashguard-ai-uses-mcp)
3. [Architecture Overview](#3-architecture-overview)
4. [MCP Server Components](#4-mcp-server-components)
5. [Tool Reference](#5-tool-reference)
   - [System & Health Tools](#51-system--health-tools)
   - [Database Inspection Tools](#52-database-inspection-tools)
   - [Cybercrime & Intelligence Tools](#53-cybercrime--intelligence-tools)
   - [Redis Cache Tools](#54-redis-cache-tools)
6. [Configuration Reference](#6-configuration-reference)
7. [Setup & Deployment](#7-setup--deployment)
8. [Security Model](#8-security-model)
9. [Extending the MCP Server](#9-extending-the-mcp-server)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. What is MCP?

**Model Context Protocol (MCP)** is an open standard that enables AI language models and coding assistants to securely interact with external tools, databases, and services in a structured and auditable way.

Instead of embedding raw credentials or ad-hoc code inside an AI prompt, MCP defines a **server-client contract**:

- The **MCP Server** exposes a set of named **tools** (functions) that the AI can invoke.
- The **AI Client** (e.g., Antigravity IDE, VS Code Copilot, Cursor) discovers these tools and calls them when needed.
- All communication happens over a well-defined **transport** (stdio, HTTP, WebSocket), with structured JSON-RPC messages.

### Key Benefits

| Benefit | Description |
|---|---|
| **Isolation** | Tools execute inside a Docker container — no direct access to the host |
| **Auditability** | Every tool call is logged and traceable |
| **Reusability** | One MCP server config is shared across the entire team via Git |
| **Safety** | Read-only database access prevents accidental mutations |
| **Composability** | AI can chain multiple tool calls to answer complex queries |

---

## 2. How CashGuard-AI Uses MCP

CashGuard-AI implements **Approach 1: Shared Repository Configuration with Local Containerized Execution**.

```
Git Repository  ──►  .agents/plugins/cashguard-mcp/mcp_config.json
                      .vscode/mcp.json
                      .cursor/mcp.json
                      ↓
              AI IDE reads config at startup
                      ↓
              Spawns Docker container (cashguard-mcp:latest)
                      ↓
              stdio JSON-RPC ↔ FastMCP server (mcp/server.py)
                      ↓
              Queries PostgreSQL / Redis on localhost
```

This approach means:
- **Any team member cloning the repository immediately gets the MCP tools** — no manual setup beyond building the Docker image.
- The MCP server runs **locally on the developer's machine**, guaranteeing identical behavior across all environments.
- Database credentials are passed as **environment variables** at container launch — never hardcoded in source code.

---

## 3. Architecture Overview

```
+------------------------------------------------------------------+
|        AI Agent (Antigravity IDE / VS Code / Cursor)             |
|   Reads config from: .agents/plugins/cashguard-mcp/              |
+------------------------------------------------------------------+
                      |  stdio JSON-RPC  (docker run -i --rm)
                      v
+------------------------------------------------------------------+
|            Docker Container: cashguard-mcp:latest                |
|                                                                  |
|  FastMCP Server  -  mcp/server.py                                |
|                                                                  |
|   +-- System & Health ------------------------------------------+|
|   |   system_status                                             ||
|   +-------------------------------------------------------------+|
|   +-- Database (Read-Only) -------------------------------------+|
|   |   db_list_tables  |  db_describe_table                      ||
|   |   db_query_readonly                                         ||
|   +-------------------------------------------------------------+|
|   +-- Cybercrime & Intelligence --------------------------------+|
|   |   predict_transaction_fraud  |  get_complaints_summary      ||
|   |   get_intelligence_alerts    |  get_hotspot_clusters        ||
|   +-------------------------------------------------------------+|
|   +-- Redis Cache ----------------------------------------------+|
|   |   redis_inspect                                             ||
|   +-------------------------------------------------------------+|
+---------------------------+-----------------------------+--------+
                       Port 5432                    Port 6379
                            v                           v
               +------------------+        +-------------------+
               | cpaf_postgres    |        |  cpaf_redis        |
               | (PostGIS DB)     |        |  (Redis 7)         |
               +------------------+        +-------------------+
```

---

## 4. MCP Server Components

### 4.1 File Structure

```
mcp/
├── server.py          # Main FastMCP server — all tool definitions live here
├── requirements.txt   # Python dependencies (mcp, psycopg2, redis, pydantic...)
└── Dockerfile         # Builds the cashguard-mcp:latest container image
```

### 4.2 Technology Stack

| Component | Library / Version | Purpose |
|---|---|---|
| MCP Framework | `mcp >= 1.3.0` | FastMCP server, tool decorator, stdio transport |
| PostgreSQL Driver | `psycopg2-binary >= 2.9.9` | Synchronous DB access with `RealDictCursor` |
| Async PG Driver | `asyncpg >= 0.29.0` | Available for async extensions |
| Redis Client | `redis >= 5.0.0` | Cache inspection and queue browsing |
| Data Validation | `pydantic >= 2.0.0` | Input validation and type safety |
| Env Config | `python-dotenv >= 1.0.0` | Loading `.env` files for local development |

### 4.3 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://cpaf_user:cpaf_pass@host.docker.internal:5432/cpaf_db` | PostgreSQL connection string |
| `REDIS_URL` | `redis://host.docker.internal:6379` | Redis connection string |

> **Note:** Both `postgresql://` and `postgresql+asyncpg://` URL schemes are automatically normalized. The server strips the `+asyncpg` prefix if present.

---

## 5. Tool Reference

All tools return **JSON strings** and follow a consistent error envelope:

```json
{ "error": "Human-readable error message" }
```

---

### 5.1 System & Health Tools

#### `system_status()`

Checks real-time connectivity to PostgreSQL and Redis.

**Parameters:** None

**Returns:**
```json
{
  "mcp_server": "running",
  "database": {
    "connected": true,
    "url": "host.docker.internal:5432/cpaf_db",
    "version": "PostgreSQL 15.x ..."
  },
  "redis": {
    "connected": true,
    "url": "host.docker.internal:6379",
    "version": "7.x.x"
  }
}
```

**Use cases:** Quick health check before running diagnostics; CI pre-flight validation.

---

### 5.2 Database Inspection Tools

All database tools run in **read-only mode**. No writes, schema changes, or DDL statements are ever executed.

#### `db_list_tables()`

Lists all tables in the `public` PostgreSQL schema with column counts and approximate live row counts.

**Parameters:** None

**Returns:**
```json
[
  {
    "table_name": "complaints",
    "column_count": 12,
    "approximate_rows": 54821
  }
]
```

**Use cases:** Exploring the database schema; understanding dataset sizes.

---

#### `db_describe_table(table_name: str)`

Returns the full column schema of a table including data types, nullability, defaults, and primary keys.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `table_name` | `str` | Yes | Name of the table to describe. Must match `[a-zA-Z0-9_]+`. |

**Returns:**
```json
{
  "table_name": "transactions",
  "primary_keys": ["id"],
  "columns": [
    {
      "column_name": "id",
      "data_type": "integer",
      "is_nullable": "NO",
      "column_default": "nextval('transactions_id_seq'::regclass)"
    }
  ]
}
```

**Safety:** Table name is validated against a strict alphanumeric regex before being passed to the query. SQL injection is not possible.

---

#### `db_query_readonly(sql: str, max_rows: int = 100)`

Executes a safe, read-only SQL query. Only `SELECT`, `EXPLAIN`, or `WITH` statements are allowed.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `sql` | `str` | Yes | — | A `SELECT`, `EXPLAIN`, or `WITH` SQL query |
| `max_rows` | `int` | No | `100` | Maximum rows to return (capped at 500) |

**Safety Guardrails:**
- Destructive keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `GRANT`, `REVOKE`) are **blocked**.
- A `LIMIT` clause is automatically appended if not present.
- A **10-second statement timeout** is applied via `SET statement_timeout`.
- The connection is set to `readonly=True` at the session level.

**Returns:**
```json
{
  "row_count": 5,
  "rows": [
    { "id": 1, "amount": 50000.00, "type": "TRANSFER" }
  ]
}
```

---

### 5.3 Cybercrime & Intelligence Tools

#### `get_complaints_summary(status_filter: str = None)`

Aggregates cybercrime complaints from the `complaints` table, grouped by category and status.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `status_filter` | `str` | No | Filter by complaint status (e.g., `"PENDING"`, `"RESOLVED"`) |

**Returns:**
```json
[
  {
    "category": "UPI_FRAUD",
    "status": "PENDING",
    "count": 1423,
    "total_amount_lost": 8502350.00
  }
]
```

**Use cases:** Dashboards showing open cases by fraud category; trend analysis for investigators.

---

#### `get_intelligence_alerts(min_risk_score: float = 0.5, limit: int = 20)`

Fetches active high-priority AML and cybercrime alerts filtered by minimum risk score.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `min_risk_score` | `float` | No | `0.5` | Minimum risk score threshold (0.0 to 1.0) |
| `limit` | `int` | No | `20` | Maximum alerts to return (capped at 100) |

**Returns:**
```json
[
  {
    "id": 42,
    "alert_type": "MULE_ACCOUNT_NETWORK",
    "risk_score": 0.93,
    "severity": "CRITICAL",
    "description": "Network of 7 coordinated mule accounts detected...",
    "created_at": "2026-09-10T08:22:15"
  }
]
```

---

#### `predict_transaction_fraud(amount, oldbalanceOrg, newbalanceOrig, oldbalanceDest, newbalanceDest, transaction_type, hour_of_day)`

Evaluates a financial transaction using CashGuard's **AML heuristic engine** and returns a fraud probability score with actionable recommendations.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `amount` | `float` | Yes | — | Transaction amount in currency units |
| `oldbalanceOrg` | `float` | Yes | — | Sender's balance before transaction |
| `newbalanceOrig` | `float` | Yes | — | Sender's balance after transaction |
| `oldbalanceDest` | `float` | Yes | — | Receiver's balance before transaction |
| `newbalanceDest` | `float` | Yes | — | Receiver's balance after transaction |
| `transaction_type` | `str` | No | `"TRANSFER"` | Type: `TRANSFER`, `CASH_OUT`, `PAYMENT`, `DEBIT` |
| `hour_of_day` | `int` | No | `14` | Hour of transaction initiation (0-23) |

**Heuristics Applied:**

| Heuristic | Trigger Condition | Score Boost |
|---|---|---|
| `COMPLETE_BALANCE_DEPLETION` | Sender's balance fully drained (>=95% of original) | +0.45 |
| `MULE_ACCOUNT_PATTERN` | Destination shows 0 to 0 balance delta for amount > 10,000 | +0.35 |
| `HIGH_VALUE_THRESHOLD` | Amount exceeds $200,000 | +0.25 |
| `ODD_HOURS_ACTIVITY` | Transaction between 00:00 and 04:59 | +0.10 |
| Transaction type boost | `TRANSFER` or `CASH_OUT` type | +0.15 |
| Transaction type reduction | `PAYMENT` or `DEBIT` type | -0.10 |

**Risk Tiers:**

| Fraud Probability | Risk Tier | Recommended Action |
|---|---|---|
| >= 0.80 | `CRITICAL` | `BLOCK_AND_FREEZE` |
| 0.60 - 0.79 | `HIGH` | `FLAG_FOR_URGENT_HUMAN_REVIEW` |
| 0.35 - 0.59 | `MEDIUM` | `STEP_UP_AUTHENTICATION` |
| < 0.35 | `LOW` | `ALLOW` |

**Returns:**
```json
{
  "fraud_probability": 0.85,
  "risk_tier": "CRITICAL",
  "recommended_action": "BLOCK_AND_FREEZE",
  "flagged_indicators": [
    "COMPLETE_BALANCE_DEPLETION: Sender balance drained to zero",
    "HIGH_VALUE_THRESHOLD: Transaction amount $250,000.00 exceeds high-risk threshold"
  ],
  "input_summary": {
    "amount": 250000.0,
    "type": "TRANSFER",
    "orig_balance_change": "250,000.00 -> 0.00",
    "dest_balance_change": "0.00 -> 0.00"
  }
}
```

---

#### `get_hotspot_clusters(limit: int = 15)`

Retrieves known cybercrime ATM withdrawal hotspots and geospatial risk clusters from the database.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `limit` | `int` | No | `15` | Maximum hotspots to return (capped at 100) |

**Returns:**
```json
[
  {
    "id": 7,
    "location_name": "MG Road ATM Cluster",
    "latitude": 12.9716,
    "longitude": 77.5946,
    "risk_level": "HIGH",
    "complaint_count": 342
  }
]
```

**Use cases:** Geospatial intelligence dashboards; law enforcement coordination; ATM placement risk assessment.

---

### 5.4 Redis Cache Tools

#### `redis_inspect(pattern: str = "*", limit: int = 50)`

Browses active Redis keys and Celery broker queues matching a glob pattern.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `pattern` | `str` | No | `"*"` | Redis glob pattern (e.g., `"celery:*"`, `"cache:user:*"`) |
| `limit` | `int` | No | `50` | Maximum keys to return |

**Returns:**
```json
{
  "matched_keys_count": 3,
  "keys": [
    { "key": "celery:task:abc123", "type": "string", "ttl_seconds": 300 },
    { "key": "cache:fraud_score:txn_9912", "type": "string", "ttl_seconds": 60 },
    { "key": "session:user:42", "type": "hash", "ttl_seconds": -1 }
  ]
}
```

**Use cases:** Debugging Celery task queues; cache hit/miss investigation; session management auditing.

---

## 6. Configuration Reference

The MCP server is configured identically across three IDE config files, all tracked in Git:

### Antigravity IDE

**File:** `.agents/plugins/cashguard-mcp/mcp_config.json`

```json
{
  "mcpServers": {
    "cashguard-mcp": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--add-host=host.docker.internal:host-gateway",
        "-e", "DATABASE_URL=postgresql://cpaf_user:cpaf_pass@host.docker.internal:5432/cpaf_db",
        "-e", "REDIS_URL=redis://host.docker.internal:6379",
        "cashguard-mcp:latest"
      ]
    }
  }
}
```

### VS Code

**File:** `.vscode/mcp.json` — mirrors the config above, loaded automatically by VS Code Copilot.

### Cursor

**File:** `.cursor/mcp.json` — mirrors the config above, loaded automatically by Cursor.

### Config Fields Explained

| Field | Description |
|---|---|
| `command` | The base executable — `docker` |
| `args: run -i` | Run interactively (required for stdio transport) |
| `--rm` | Auto-remove container on exit |
| `--add-host` | Allows the container to reach the host's PostgreSQL/Redis via `host.docker.internal` |
| `-e DATABASE_URL` | Injects the PostgreSQL connection string |
| `-e REDIS_URL` | Injects the Redis connection string |
| `cashguard-mcp:latest` | The Docker image to run |

---

## 7. Setup & Deployment

### Prerequisites

- Docker Desktop (Windows/macOS) or Docker Engine (Linux)
- The project's core services running: `docker-compose up -d postgres redis`

### Step 1 — Build the MCP Docker Image

**Windows (PowerShell):**
```powershell
.\scripts\setup_mcp.ps1
```

**Linux / macOS / WSL:**
```bash
chmod +x scripts/setup_mcp.sh
./scripts/setup_mcp.sh
```

**Manual build:**
```bash
docker build -t cashguard-mcp:latest -f mcp/Dockerfile mcp/
```

### Step 2 — Start Backend Services

```bash
docker-compose up -d postgres redis
```

### Step 3 — Verify the MCP Server

Test that the Python MCP runtime loads correctly inside the container:

```bash
docker run -i --rm \
  --add-host=host.docker.internal:host-gateway \
  cashguard-mcp:latest \
  python -c "import mcp; print('MCP runtime loaded successfully.')"
```

### Step 4 — Reload Your IDE

Restart or reload your IDE (Antigravity IDE / VS Code / Cursor). The MCP server will be auto-discovered from the config files and made available as tools in the AI assistant.

---

## 8. Security Model

### What the MCP Server Can Do

| Capability | Allowed? |
|---|---|
| Read PostgreSQL data (`SELECT`) | Yes |
| Run `EXPLAIN` / `WITH` queries | Yes |
| Write, update, or delete data | No |
| Modify schema (`ALTER`, `DROP`) | No |
| Read Redis keys and their TTLs | Yes |
| Write to Redis | No |
| Access the host filesystem | No (Docker isolated) |
| Access the internet | No (no network egress configured) |

### Defence-in-Depth Layers

1. **Docker isolation** — the server runs in a container with no volume mounts and no privileged access.
2. **Read-only PostgreSQL session** — `conn.set_session(readonly=True)` at the driver level.
3. **Keyword blocklist** — `db_query_readonly` scans the SQL string for destructive keywords before execution.
4. **Input sanitization** — `db_describe_table` validates table names with a strict regex.
5. **Statement timeout** — all DB queries are limited to 10 seconds.
6. **Row limits** — all queries are capped (max 500 rows for ad-hoc queries).
7. **Credential isolation** — credentials are injected as environment variables at runtime, not stored in the image.

---

## 9. Extending the MCP Server

To add a new tool, open `mcp/server.py` and add a decorated function:

```python
@mcp.tool()
def my_new_tool(param1: str, param2: int = 10) -> str:
    """Brief one-line description of what this tool does.
    
    Longer description goes here. This is shown to the AI in its tool manifest.
    """
    # Your implementation here
    result = {"param1": param1, "param2": param2}
    return json.dumps(result, indent=2)
```

**Guidelines:**
- Always return a **JSON string** (use `json.dumps`).
- Always include a **docstring** — the AI uses it to decide when to invoke the tool.
- Use the `Optional[str]` type hint for optional parameters.
- Wrap everything in `try/except` and return `json.dumps({"error": str(exc)})` on failure.
- Rebuild the Docker image after any changes:

```bash
docker build -t cashguard-mcp:latest -f mcp/Dockerfile mcp/
```

---

## 10. Troubleshooting

### MCP Tools Not Showing in IDE

1. Confirm the Docker image exists: `docker images | grep cashguard-mcp`
2. Build it if missing: `docker build -t cashguard-mcp:latest -f mcp/Dockerfile mcp/`
3. Reload/restart the IDE window.

### `database.connected: false` in `system_status`

1. Ensure PostgreSQL is running: `docker-compose ps postgres`
2. Start it if needed: `docker-compose up -d postgres`
3. Verify the `DATABASE_URL` environment variable in the MCP config.

### `redis.connected: false` in `system_status`

1. Ensure Redis is running: `docker-compose ps redis`
2. Start it if needed: `docker-compose up -d redis`

### `host.docker.internal` Not Resolving (Linux)

On Linux, `host.docker.internal` may not be automatically available. Verify that `--add-host=host.docker.internal:host-gateway` is present in the `args` array of your MCP config. This flag is included by default in all CashGuard-AI config files.

### Query Timeout Errors

Ad-hoc `db_query_readonly` queries have a hard 10-second timeout. Optimize your query (add indexes, use `EXPLAIN` first) or contact the database administrator.

---

*For setup and configuration details, see [MCP_SERVER_SETUP.md](MCP_SERVER_SETUP.md).*  
*For the full backend API reference, see [BACKEND_API_REFERENCE.md](BACKEND_API_REFERENCE.md).*
