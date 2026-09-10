"""CashGuard-AI Model Context Protocol (MCP) Server.

Provides containerized tools for PostgreSQL database inspection,
cybercrime intelligence, fraud risk scoring, and Redis cache management.
"""

import json
import os
import re
from typing import Any, Dict, List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import redis
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP Server
mcp = FastMCP("CashGuard-AI")

# Configuration from Environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://cpaf_user:cpaf_pass@host.docker.internal:5432/cpaf_db"
)
REDIS_URL = os.getenv(
    "REDIS_URL",
    "redis://host.docker.internal:6379"
)

# Ensure DATABASE_URL uses postgresql:// instead of postgresql+asyncpg://
if DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1)


def get_pg_connection():
    """Get a raw psycopg2 connection with a short connection timeout."""
    return psycopg2.connect(DATABASE_URL, connect_timeout=5)


def get_redis_client():
    """Get a Redis client with a short socket timeout."""
    return redis.Redis.from_url(REDIS_URL, socket_timeout=3, decode_responses=True)


# ==========================================
# 1. System & Health Tools
# ==========================================

@mcp.tool()
def system_status() -> str:
    """Check connectivity and operational health of PostgreSQL and Redis."""
    status: Dict[str, Any] = {
        "mcp_server": "running",
        "database": {"connected": False, "url": DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else "not-configured"},
        "redis": {"connected": False, "url": REDIS_URL.split("@")[-1] if "@" in REDIS_URL else "not-configured"}
    }

    # Test PostgreSQL
    try:
        with get_pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                row = cur.fetchone()
                status["database"]["connected"] = True
                status["database"]["version"] = row[0] if row else "unknown"
    except Exception as exc:
        status["database"]["error"] = str(exc)

    # Test Redis
    try:
        r = get_redis_client()
        r.ping()
        info = r.info("server")
        status["redis"]["connected"] = True
        status["redis"]["version"] = info.get("redis_version", "unknown")
    except Exception as exc:
        status["redis"]["error"] = str(exc)

    return json.dumps(status, indent=2)


# ==========================================
# 2. Database Inspection & Read-Only Tools
# ==========================================

@mcp.tool()
def db_list_tables() -> str:
    """List all public database tables, their column counts, and approximate row counts."""
    try:
        with get_pg_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT 
                        t.table_name,
                        COUNT(c.column_name) AS column_count,
                        COALESCE(s.n_live_tup, 0) AS approximate_rows
                    FROM information_schema.tables t
                    JOIN information_schema.columns c 
                        ON t.table_name = c.table_name AND t.table_schema = c.table_schema
                    LEFT JOIN pg_stat_user_tables s 
                        ON s.relname = t.table_name
                    WHERE t.table_schema = 'public' 
                      AND t.table_type = 'BASE TABLE'
                    GROUP BY t.table_name, s.n_live_tup
                    ORDER BY t.table_name;
                """
                cur.execute(query)
                tables = cur.fetchall()
                return json.dumps(tables, indent=2)
    except Exception as exc:
        return json.dumps({"error": f"Failed to list tables: {str(exc)}"})


@mcp.tool()
def db_describe_table(table_name: str) -> str:
    """Describe columns, data types, nullability, defaults, and primary/foreign keys for a table."""
    # Sanitize table name against SQL injection
    if not re.match(r"^[a-zA-Z0-9_]+$", table_name):
        return json.dumps({"error": f"Invalid table name format: {table_name}"})

    try:
        with get_pg_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT 
                        column_name,
                        data_type,
                        is_nullable,
                        column_default
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = %s
                    ORDER BY ordinal_position;
                """
                cur.execute(query, (table_name,))
                columns = cur.fetchall()

                if not columns:
                    return json.dumps({"error": f"Table '{table_name}' not found or has no columns."})

                # Retrieve primary key info
                pk_query = """
                    SELECT c.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name)
                    JOIN information_schema.columns AS c 
                      ON c.table_schema = tc.constraint_schema
                     AND tc.table_name = c.table_name 
                     AND ccu.column_name = c.column_name
                    WHERE tc.constraint_type = 'PRIMARY KEY' 
                      AND tc.table_name = %s;
                """
                cur.execute(pk_query, (table_name,))
                pks = [row["column_name"] for row in cur.fetchall()]

                return json.dumps({
                    "table_name": table_name,
                    "primary_keys": pks,
                    "columns": columns
                }, indent=2)
    except Exception as exc:
        return json.dumps({"error": f"Failed to describe table '{table_name}': {str(exc)}"})


@mcp.tool()
def db_query_readonly(sql: str, max_rows: int = 100) -> str:
    """Execute a safe, read-only SQL SELECT or EXPLAIN query on the database.
    Mutations (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE) are strictly disallowed.
    """
    clean_sql = sql.strip().rstrip(";")
    upper_sql = clean_sql.upper()

    # Disallow destructive keywords
    destructive = ["INSERT ", "UPDATE ", "DELETE ", "DROP ", "ALTER ", "TRUNCATE ", "CREATE ", "GRANT ", "REVOKE "]
    for word in destructive:
        if word in upper_sql:
            return json.dumps({"error": f"Disallowed statement: Mutation keyword '{word.strip()}' detected in read-only query."})

    if not (upper_sql.startswith("SELECT") or upper_sql.startswith("EXPLAIN") or upper_sql.startswith("WITH")):
        return json.dumps({"error": "Only SELECT, EXPLAIN, or WITH queries are permitted."})

    # Enforce limit
    bounded_limit = min(max(1, max_rows), 500)
    if "LIMIT" not in upper_sql:
        clean_sql += f" LIMIT {bounded_limit}"

    try:
        with get_pg_connection() as conn:
            conn.set_session(readonly=True, autocommit=True)
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Set a 10-second statement timeout
                cur.execute("SET statement_timeout = '10s';")
                cur.execute(clean_sql)
                rows = cur.fetchall()
                return json.dumps({
                    "row_count": len(rows),
                    "rows": rows
                }, default=str, indent=2)
    except Exception as exc:
        return json.dumps({"error": f"Query execution failed: {str(exc)}"})


# ==========================================
# 3. CashGuard Cybercrime & Intelligence Tools
# ==========================================

@mcp.tool()
def get_complaints_summary(status_filter: Optional[str] = None) -> str:
    """Retrieve an aggregated summary of cybercrime complaints grouped by category and status."""
    try:
        with get_pg_connection() as conn:
            conn.set_session(readonly=True)
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = 'complaints'
                    );
                """)
                if not cur.fetchone()["exists"]:
                    return json.dumps({"notice": "The 'complaints' table does not exist in the database yet."})

                query = """
                    SELECT 
                        category,
                        status,
                        COUNT(*) as count,
                        COALESCE(SUM(amount_lost), 0) as total_amount_lost
                    FROM complaints
                """
                params: List[Any] = []
                if status_filter:
                    query += " WHERE status = %s"
                    params.append(status_filter)
                query += " GROUP BY category, status ORDER BY count DESC;"

                cur.execute(query, tuple(params))
                return json.dumps(cur.fetchall(), default=str, indent=2)
    except Exception as exc:
        return json.dumps({"error": f"Failed to get complaints summary: {str(exc)}"})


@mcp.tool()
def get_intelligence_alerts(min_risk_score: float = 0.5, limit: int = 20) -> str:
    """Fetch high-priority cybercrime and AML intelligence alerts filtered by minimum risk score."""
    try:
        with get_pg_connection() as conn:
            conn.set_session(readonly=True)
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = 'intelligence_alerts'
                    );
                """)
                if not cur.fetchone()["exists"]:
                    return json.dumps({"notice": "The 'intelligence_alerts' table does not exist yet."})

                query = """
                    SELECT id, alert_type, risk_score, severity, description, created_at
                    FROM intelligence_alerts
                    WHERE risk_score >= %s
                    ORDER BY risk_score DESC, created_at DESC
                    LIMIT %s;
                """
                cur.execute(query, (min_risk_score, min(max(1, limit), 100)))
                return json.dumps(cur.fetchall(), default=str, indent=2)
    except Exception as exc:
        return json.dumps({"error": f"Failed to fetch intelligence alerts: {str(exc)}"})


@mcp.tool()
def predict_transaction_fraud(
    amount: float,
    oldbalanceOrg: float,
    newbalanceOrig: float,
    oldbalanceDest: float,
    newbalanceDest: float,
    transaction_type: str = "TRANSFER",
    hour_of_day: int = 14
) -> str:
    """Evaluate financial transaction features using CashGuard AML heuristics and model rules.
    Returns fraud probability score, risk category, and key risk indicators.
    """
    indicators = []
    base_score = 0.05

    # Heuristic 1: Drain of balance
    orig_diff = oldbalanceOrg - newbalanceOrig
    if oldbalanceOrg > 0 and newbalanceOrig == 0 and amount >= oldbalanceOrg * 0.95:
        base_score += 0.45
        indicators.append("COMPLETE_BALANCE_DEPLETION: Sender balance drained to zero")

    # Heuristic 2: Destination anomaly (no initial balance, receives full amount or zero balance change)
    if oldbalanceDest == 0 and newbalanceDest == 0 and amount > 10000:
        base_score += 0.35
        indicators.append("MULE_ACCOUNT_PATTERN: Destination received funds with 0 balance delta recorded")

    # Heuristic 3: High value transfer
    if amount > 200000:
        base_score += 0.25
        indicators.append(f"HIGH_VALUE_THRESHOLD: Transaction amount ${amount:,.2f} exceeds high-risk threshold")

    # Heuristic 4: Unusual time
    if hour_of_day < 5 or hour_of_day > 23:
        base_score += 0.10
        indicators.append(f"ODD_HOURS_ACTIVITY: Transaction initiated at hour {hour_of_day}:00")

    # Transaction type weighting
    type_upper = transaction_type.upper()
    if type_upper in ["TRANSFER", "CASH_OUT"]:
        base_score += 0.15
    elif type_upper in ["PAYMENT", "DEBIT"]:
        base_score -= 0.10

    # Bound probability
    fraud_probability = max(0.01, min(0.99, round(base_score, 4)))

    if fraud_probability >= 0.80:
        tier = "CRITICAL"
        action = "BLOCK_AND_FREEZE"
    elif fraud_probability >= 0.60:
        tier = "HIGH"
        action = "FLAG_FOR_URGENT_HUMAN_REVIEW"
    elif fraud_probability >= 0.35:
        tier = "MEDIUM"
        action = "STEP_UP_AUTHENTICATION"
    else:
        tier = "LOW"
        action = "ALLOW"

    result = {
        "fraud_probability": fraud_probability,
        "risk_tier": tier,
        "recommended_action": action,
        "flagged_indicators": indicators,
        "input_summary": {
            "amount": amount,
            "type": type_upper,
            "orig_balance_change": f"{oldbalanceOrg:,.2f} -> {newbalanceOrig:,.2f}",
            "dest_balance_change": f"{oldbalanceDest:,.2f} -> {newbalanceDest:,.2f}"
        }
    }
    return json.dumps(result, indent=2)


@mcp.tool()
def get_hotspot_clusters(limit: int = 15) -> str:
    """Retrieve known cybercrime ATM withdrawal hotspots and geospatial risk clusters."""
    try:
        with get_pg_connection() as conn:
            conn.set_session(readonly=True)
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = 'withdrawal_locations'
                    );
                """)
                if not cur.fetchone()["exists"]:
                    return json.dumps({"notice": "The 'withdrawal_locations' table does not exist in the database yet."})

                query = """
                    SELECT id, location_name, latitude, longitude, risk_level, complaint_count
                    FROM withdrawal_locations
                    ORDER BY complaint_count DESC
                    LIMIT %s;
                """
                cur.execute(query, (min(max(1, limit), 100),))
                return json.dumps(cur.fetchall(), default=str, indent=2)
    except Exception as exc:
        return json.dumps({"error": f"Failed to retrieve hotspot clusters: {str(exc)}"})


# ==========================================
# 4. Redis Cache & Queue Inspection
# ==========================================

@mcp.tool()
def redis_inspect(pattern: str = "*", limit: int = 50) -> str:
    """Inspect Redis cached keys and Celery broker queues matching a pattern."""
    try:
        r = get_redis_client()
        keys = []
        for key in r.scan_iter(match=pattern, count=100):
            key_type = r.type(key)
            ttl = r.ttl(key)
            keys.append({"key": key, "type": key_type, "ttl_seconds": ttl})
            if len(keys) >= limit:
                break

        return json.dumps({
            "matched_keys_count": len(keys),
            "keys": keys
        }, indent=2)
    except Exception as exc:
        return json.dumps({"error": f"Failed to inspect Redis: {str(exc)}"})


if __name__ == "__main__":
    # Run the FastMCP server over stdio
    mcp.run(transport="stdio")
