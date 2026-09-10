# CashGuard-AI: Model Context Protocol (MCP) Setup Guide

## Overview

This project implements **Approach 1: Shared Repository Config (Local Execution)** for the Model Context Protocol (MCP). 

### What is Approach 1?
- **Shared Repository Configuration:** MCP server declarations are tracked in Git within `.agents/plugins/cashguard-mcp/mcp_config.json`, `.agents/mcp_config.json`, and `.vscode/mcp.json`. Any team member cloning the repository automatically inherits the configuration.
- **Local Containerized Execution:** The MCP server executes locally on the developer's machine inside a dedicated Docker container (`cashguard-mcp:latest`) using `stdio` transport. This avoids credential leaks, keeps tool execution isolated, and guarantees identical behavior across environments.

---

## Architecture

```
+-------------------------------------------------------------+
|           AI Agent (Antigravity IDE / VS Code / Cursor)     |
|   Reads config from: .agents/plugins/cashguard-mcp/         |
+-------------------------------------------------------------+
                              |
                 stdio JSON-RPC (docker run -i)
                              v
+-------------------------------------------------------------+
|            Docker Container: cashguard-mcp:latest           |
|                                                             |
|  [FastMCP Server: mcp/server.py]                            |
|   ├── Database Tools:                                       |
|   │     • db_list_tables                                    |
|   │     • db_describe_table                                 |
|   │     • db_query_readonly                                 |
|   ├── Cybercrime & ML Intelligence:                         |
|   │     • predict_transaction_fraud                         |
|   │     • get_complaints_summary                            |
|   │     • get_intelligence_alerts                           |
|   │     • get_hotspot_clusters                              |
|   └── System & Redis Tools:                                 |
|         • system_status                                     |
|         • redis_inspect                                     |
+-------------------------------------------------------------+
          |                                       |
     Port 5432                               Port 6379
          v                                       v
[cpaf_postgres (PostGIS)]                [cpaf_redis (Redis 7)]
```

---

## Quick Setup

### 1. Build the Docker MCP Image

Run the provided setup script:

**Windows (PowerShell):**
```powershell
.\scripts\setup_mcp.ps1
```

**Linux / macOS / WSL:**
```bash
chmod +x scripts/setup_mcp.sh
./scripts/setup_mcp.sh
```

**Or directly via Docker CLI:**
```bash
docker build -t cashguard-mcp:latest -f mcp/Dockerfile mcp
```

### 2. Start the Project Services (PostgreSQL & Redis)

Start the core database and caching services using Docker Compose:
```bash
docker-compose up -d postgres redis
```

---

## Available MCP Tools

| Category | Tool Name | Description |
| :--- | :--- | :--- |
| **System** | `system_status` | Verifies real-time connectivity to PostgreSQL and Redis. |
| **Database** | `db_list_tables` | Lists all public schema tables and live row counts. |
| **Database** | `db_describe_table` | Inspects columns, data types, nullability, defaults, and primary/foreign keys. |
| **Database** | `db_query_readonly` | Runs safe, sanitized `SELECT` or `EXPLAIN` queries with automatic statement timeout. |
| **Intelligence** | `get_complaints_summary` | Aggregates reported cybercrime incidents by category and status. |
| **Intelligence** | `get_intelligence_alerts` | Retrieves active high-risk AML and mule account alerts. |
| **ML Models** | `predict_transaction_fraud` | Scores financial transactions for fraud risk using CashGuard heuristics. |
| **Geospatial** | `get_hotspot_clusters` | Queries ATM withdrawal hotspots and high-risk cybercrime locations. |
| **Cache** | `redis_inspect` | Inspects active Redis keys and Celery broker queues. |

---

## Configuration Reference

### Antigravity IDE (`.agents/plugins/cashguard-mcp/mcp_config.json`)
```json
{
  "mcpServers": {
    "cashguard-mcp": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--add-host=host.docker.internal:host-gateway",
        "-e", "DATABASE_URL=postgresql://cpaf_user:cpaf_pass@host.docker.internal:5432/cpaf_db",
        "-e", "REDIS_URL=redis://host.docker.internal:6379",
        "cashguard-mcp:latest"
      ]
    }
  }
}
```

### VS Code & Cursor (`.vscode/mcp.json` / `.cursor/mcp.json`)
The identical configuration is mirrored into `.vscode/mcp.json` and `.cursor/mcp.json` to ensure team members using VS Code or Cursor can also utilize the containerized MCP tools immediately without manual adjustments.

---

## Testing & Verification

To verify that the MCP container responds properly over stdio:
```bash
docker run -i --rm \
  --add-host=host.docker.internal:host-gateway \
  cashguard-mcp:latest python -c "import mcp; print('MCP runtime loaded.')"
```
