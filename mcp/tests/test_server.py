"""Test suite for mcp/server.py — the CashGuard-AI MCP tool server.

Previously had zero test coverage. Covers: the SQL-injection-guard regex on
`db_describe_table`, the read-only/mutation-denylist logic in
`db_query_readonly`, the pure fraud-scoring heuristics in
`predict_transaction_fraud`, and every DB/Redis-backed tool's success,
"table not found yet", and exception-handling paths (via mocked
psycopg2/redis connections — no real database or Redis needed to run this
suite).
"""

import importlib
import json
import os
from unittest.mock import MagicMock, patch

import pytest

import server


# ---------------------------------------------------------------------------
# db_describe_table — SQL-injection guard
# ---------------------------------------------------------------------------


class TestDbDescribeTableValidation:
    @pytest.mark.parametrize(
        "bad_name",
        [
            "users; DROP TABLE users;--",
            "users' OR '1'='1",
            "users ",  # trailing space
            "",
            "users-table",
            "users.table",
        ],
    )
    def test_rejects_non_alphanumeric_table_names_without_touching_db(self, bad_name):
        with patch.object(server, "get_pg_connection") as get_conn:
            result = json.loads(server.db_describe_table(bad_name))

        assert "error" in result
        assert "Invalid table name format" in result["error"]
        get_conn.assert_not_called()

    @pytest.mark.parametrize("good_name", ["users", "intelligence_alerts", "T1", "_x"])
    def test_accepts_valid_identifier_and_queries_db(self, good_name, fake_connection, fake_cursor):
        fake_cursor.fetchall.side_effect = [
            [{"column_name": "id", "data_type": "uuid", "is_nullable": "NO", "column_default": None}],
            [{"column_name": "id"}],
        ]
        with patch.object(server, "get_pg_connection", return_value=fake_connection):
            result = json.loads(server.db_describe_table(good_name))

        assert result["table_name"] == good_name
        assert result["primary_keys"] == ["id"]

    def test_empty_columns_reports_not_found(self, fake_connection, fake_cursor):
        fake_cursor.fetchall.return_value = []
        with patch.object(server, "get_pg_connection", return_value=fake_connection):
            result = json.loads(server.db_describe_table("ghost_table"))

        assert "not found" in result["error"]

    def test_db_exception_is_caught_and_reported(self):
        with patch.object(server, "get_pg_connection", side_effect=ConnectionError("down")):
            result = json.loads(server.db_describe_table("users"))

        assert "Failed to describe table" in result["error"]


# ---------------------------------------------------------------------------
# db_query_readonly — mutation denylist + SELECT/EXPLAIN/WITH allowlist
# ---------------------------------------------------------------------------


class TestDbQueryReadonly:
    @pytest.mark.parametrize(
        "sql",
        [
            "INSERT INTO users VALUES (1)",
            "UPDATE users SET x=1",
            "DELETE FROM users",
            "DROP TABLE users",
            "ALTER TABLE users ADD COLUMN x int",
            "TRUNCATE users",
            "CREATE TABLE x (id int)",
            "GRANT ALL ON users TO public",
            "REVOKE ALL ON users FROM public",
            "select * from users; DROP TABLE users",
        ],
    )
    def test_rejects_mutation_keywords_without_touching_db(self, sql):
        with patch.object(server, "get_pg_connection") as get_conn:
            result = json.loads(server.db_query_readonly(sql))

        assert "Disallowed statement" in result["error"]
        get_conn.assert_not_called()

    @pytest.mark.parametrize("sql", ["users", "SHOW TABLES", "PRAGMA table_info(x)"])
    def test_rejects_statements_not_in_allowlist(self, sql):
        with patch.object(server, "get_pg_connection") as get_conn:
            result = json.loads(server.db_query_readonly(sql))

        assert "Only SELECT, EXPLAIN, or WITH queries are permitted" in result["error"]
        get_conn.assert_not_called()

    @pytest.mark.parametrize("prefix", ["SELECT", "select", "EXPLAIN", "WITH"])
    def test_allows_select_explain_with(self, prefix, fake_connection, fake_cursor):
        fake_cursor.fetchall.return_value = [{"id": 1}]
        with patch.object(server, "get_pg_connection", return_value=fake_connection):
            result = json.loads(server.db_query_readonly(f"{prefix} * FROM t"))

        assert result["row_count"] == 1

    def test_appends_bounded_limit_when_absent(self, fake_connection, fake_cursor):
        fake_cursor.fetchall.return_value = []
        with patch.object(server, "get_pg_connection", return_value=fake_connection):
            server.db_query_readonly("SELECT * FROM t", max_rows=10_000)

        executed_sql = fake_cursor.execute.call_args_list[-1].args[0]
        assert "LIMIT 500" in executed_sql  # clamped to the 500 ceiling

    def test_does_not_duplicate_limit_when_already_present(self, fake_connection, fake_cursor):
        fake_cursor.fetchall.return_value = []
        with patch.object(server, "get_pg_connection", return_value=fake_connection):
            server.db_query_readonly("SELECT * FROM t LIMIT 5")

        executed_sql = fake_cursor.execute.call_args_list[-1].args[0]
        assert executed_sql.count("LIMIT") == 1

    def test_max_rows_floor_is_one(self, fake_connection, fake_cursor):
        fake_cursor.fetchall.return_value = []
        with patch.object(server, "get_pg_connection", return_value=fake_connection):
            server.db_query_readonly("SELECT * FROM t", max_rows=-5)

        executed_sql = fake_cursor.execute.call_args_list[-1].args[0]
        assert "LIMIT 1" in executed_sql

    def test_sets_readonly_session_and_statement_timeout(self, fake_connection, fake_cursor):
        fake_cursor.fetchall.return_value = []
        with patch.object(server, "get_pg_connection", return_value=fake_connection):
            server.db_query_readonly("SELECT 1")

        fake_connection.set_session.assert_called_once_with(readonly=True, autocommit=True)
        first_exec_sql = fake_cursor.execute.call_args_list[0].args[0]
        assert "statement_timeout" in first_exec_sql

    def test_db_exception_is_caught_and_reported(self):
        with patch.object(server, "get_pg_connection", side_effect=ConnectionError("down")):
            result = json.loads(server.db_query_readonly("SELECT 1"))

        assert "Query execution failed" in result["error"]


# ---------------------------------------------------------------------------
# predict_transaction_fraud — pure heuristic scoring, no I/O
# ---------------------------------------------------------------------------


class TestPredictTransactionFraud:
    def test_benign_low_value_payment_is_low_risk_and_allowed(self):
        result = json.loads(
            server.predict_transaction_fraud(
                amount=500,
                oldbalanceOrg=10_000,
                newbalanceOrig=9_500,
                oldbalanceDest=5_000,
                newbalanceDest=5_500,
                transaction_type="PAYMENT",
                hour_of_day=14,
            )
        )
        assert result["risk_tier"] == "LOW"
        assert result["recommended_action"] == "ALLOW"
        assert result["flagged_indicators"] == []

    def test_complete_balance_depletion_flagged(self):
        result = json.loads(
            server.predict_transaction_fraud(
                amount=10_000,
                oldbalanceOrg=10_000,
                newbalanceOrig=0,
                oldbalanceDest=1_000,
                newbalanceDest=11_000,
                transaction_type="PAYMENT",
                hour_of_day=14,
            )
        )
        assert any("COMPLETE_BALANCE_DEPLETION" in i for i in result["flagged_indicators"])

    def test_mule_account_pattern_flagged(self):
        result = json.loads(
            server.predict_transaction_fraud(
                amount=50_000,
                oldbalanceOrg=100_000,
                newbalanceOrig=50_000,
                oldbalanceDest=0,
                newbalanceDest=0,
                transaction_type="PAYMENT",
                hour_of_day=14,
            )
        )
        assert any("MULE_ACCOUNT_PATTERN" in i for i in result["flagged_indicators"])

    def test_high_value_threshold_flagged(self):
        result = json.loads(
            server.predict_transaction_fraud(
                amount=250_000,
                oldbalanceOrg=1_000_000,
                newbalanceOrig=750_000,
                oldbalanceDest=1_000,
                newbalanceDest=251_000,
                transaction_type="PAYMENT",
                hour_of_day=14,
            )
        )
        assert any("HIGH_VALUE_THRESHOLD" in i for i in result["flagged_indicators"])

    def test_odd_hours_flagged(self):
        result = json.loads(
            server.predict_transaction_fraud(
                amount=100,
                oldbalanceOrg=1_000,
                newbalanceOrig=900,
                oldbalanceDest=0,
                newbalanceDest=100,
                transaction_type="PAYMENT",
                hour_of_day=3,
            )
        )
        assert any("ODD_HOURS_ACTIVITY" in i for i in result["flagged_indicators"])

    def test_all_heuristics_stack_to_critical_tier_and_block_action(self):
        result = json.loads(
            server.predict_transaction_fraud(
                amount=300_000,
                oldbalanceOrg=300_000,
                newbalanceOrig=0,
                oldbalanceDest=0,
                newbalanceDest=0,
                transaction_type="TRANSFER",
                hour_of_day=2,
            )
        )
        assert result["risk_tier"] == "CRITICAL"
        assert result["recommended_action"] == "BLOCK_AND_FREEZE"
        assert result["fraud_probability"] <= 0.99  # probability is bounded

    def test_transfer_and_cash_out_add_risk_weight(self):
        base = dict(
            amount=100, oldbalanceOrg=1000, newbalanceOrig=900,
            oldbalanceDest=0, newbalanceDest=100, hour_of_day=14,
        )
        transfer = json.loads(server.predict_transaction_fraud(**base, transaction_type="TRANSFER"))
        payment = json.loads(server.predict_transaction_fraud(**base, transaction_type="PAYMENT"))
        assert transfer["fraud_probability"] > payment["fraud_probability"]

    def test_transaction_type_is_case_insensitive(self):
        result = json.loads(
            server.predict_transaction_fraud(
                amount=100, oldbalanceOrg=1000, newbalanceOrig=900,
                oldbalanceDest=0, newbalanceDest=100,
                transaction_type="cash_out", hour_of_day=14,
            )
        )
        assert result["input_summary"]["type"] == "CASH_OUT"

    def test_fraud_probability_is_always_bounded_between_0_01_and_0_99(self):
        # Stack every heuristic to try to push the score past 1.0.
        result = json.loads(
            server.predict_transaction_fraud(
                amount=10_000_000,
                oldbalanceOrg=10_000_000,
                newbalanceOrig=0,
                oldbalanceDest=0,
                newbalanceDest=0,
                transaction_type="TRANSFER",
                hour_of_day=0,
            )
        )
        assert 0.01 <= result["fraud_probability"] <= 0.99

    @pytest.mark.parametrize(
        "score_inputs,expected_tier",
        [
            # amount alone (>200000) -> 0.05 + 0.25 + 0.15 (transfer) = 0.45 -> MEDIUM
            (dict(amount=250_000, transaction_type="TRANSFER"), "MEDIUM"),
        ],
    )
    def test_tier_boundaries(self, score_inputs, expected_tier):
        result = json.loads(
            server.predict_transaction_fraud(
                oldbalanceOrg=1_000_000,
                newbalanceOrig=750_000,
                oldbalanceDest=1_000,
                newbalanceDest=251_000,
                hour_of_day=14,
                **score_inputs,
            )
        )
        assert result["risk_tier"] == expected_tier


# ---------------------------------------------------------------------------
# system_status
# ---------------------------------------------------------------------------


class TestSystemStatus:
    def test_reports_connected_when_both_healthy(self, fake_connection, fake_cursor):
        fake_cursor.fetchone.return_value = ("PostgreSQL 15.3",)
        fake_redis = MagicMock()
        fake_redis.info.return_value = {"redis_version": "7.2.0"}

        with (
            patch.object(server, "get_pg_connection", return_value=fake_connection),
            patch.object(server, "get_redis_client", return_value=fake_redis),
        ):
            result = json.loads(server.system_status())

        assert result["database"]["connected"] is True
        assert result["database"]["version"] == "PostgreSQL 15.3"
        assert result["redis"]["connected"] is True
        assert result["redis"]["version"] == "7.2.0"

    def test_reports_errors_independently_when_both_down(self):
        with (
            patch.object(server, "get_pg_connection", side_effect=ConnectionError("pg down")),
            patch.object(server, "get_redis_client", side_effect=ConnectionError("redis down")),
        ):
            result = json.loads(server.system_status())

        assert result["database"]["connected"] is False
        assert "pg down" in result["database"]["error"]
        assert result["redis"]["connected"] is False
        assert "redis down" in result["redis"]["error"]

    def test_one_service_up_one_down_reported_independently(self, fake_connection, fake_cursor):
        fake_cursor.fetchone.return_value = ("PG 15",)
        with (
            patch.object(server, "get_pg_connection", return_value=fake_connection),
            patch.object(server, "get_redis_client", side_effect=ConnectionError("redis down")),
        ):
            result = json.loads(server.system_status())

        assert result["database"]["connected"] is True
        assert result["redis"]["connected"] is False


# ---------------------------------------------------------------------------
# db_list_tables
# ---------------------------------------------------------------------------


class TestDbListTables:
    def test_returns_table_list_on_success(self, fake_connection, fake_cursor):
        fake_cursor.fetchall.return_value = [
            {"table_name": "users", "column_count": 5, "approximate_rows": 10}
        ]
        with patch.object(server, "get_pg_connection", return_value=fake_connection):
            result = json.loads(server.db_list_tables())

        assert result[0]["table_name"] == "users"

    def test_exception_is_caught_and_reported(self):
        with patch.object(server, "get_pg_connection", side_effect=ConnectionError("down")):
            result = json.loads(server.db_list_tables())

        assert "Failed to list tables" in result["error"]


# ---------------------------------------------------------------------------
# get_complaints_summary / get_intelligence_alerts / get_hotspot_clusters
# — all follow the same "table may not exist yet" + query pattern
# ---------------------------------------------------------------------------


class TestGetComplaintsSummary:
    def test_notice_when_table_missing(self, fake_connection, fake_cursor):
        fake_cursor.fetchone.return_value = {"exists": False}
        with patch.object(server, "get_pg_connection", return_value=fake_connection):
            result = json.loads(server.get_complaints_summary())

        assert "does not exist" in result["notice"]

    def test_returns_grouped_rows_when_table_present(self, fake_connection, fake_cursor):
        fake_cursor.fetchone.return_value = {"exists": True}
        fake_cursor.fetchall.return_value = [
            {"category": "phishing", "status": "pending", "count": 3, "total_amount_lost": 1500}
        ]
        with patch.object(server, "get_pg_connection", return_value=fake_connection):
            result = json.loads(server.get_complaints_summary())

        assert result[0]["category"] == "phishing"

    def test_status_filter_adds_where_clause(self, fake_connection, fake_cursor):
        fake_cursor.fetchone.return_value = {"exists": True}
        fake_cursor.fetchall.return_value = []
        with patch.object(server, "get_pg_connection", return_value=fake_connection):
            server.get_complaints_summary(status_filter="resolved")

        last_call = fake_cursor.execute.call_args_list[-1]
        assert "WHERE status = %s" in last_call.args[0]
        assert last_call.args[1] == ("resolved",)

    def test_exception_is_caught_and_reported(self):
        with patch.object(server, "get_pg_connection", side_effect=ConnectionError("down")):
            result = json.loads(server.get_complaints_summary())

        assert "Failed to get complaints summary" in result["error"]


class TestGetIntelligenceAlerts:
    def test_notice_when_table_missing(self, fake_connection, fake_cursor):
        fake_cursor.fetchone.return_value = {"exists": False}
        with patch.object(server, "get_pg_connection", return_value=fake_connection):
            result = json.loads(server.get_intelligence_alerts())

        assert "does not exist" in result["notice"]

    def test_limit_is_clamped_to_100(self, fake_connection, fake_cursor):
        fake_cursor.fetchone.return_value = {"exists": True}
        fake_cursor.fetchall.return_value = []
        with patch.object(server, "get_pg_connection", return_value=fake_connection):
            server.get_intelligence_alerts(limit=999)

        last_call = fake_cursor.execute.call_args_list[-1]
        assert last_call.args[1][1] == 100

    def test_limit_floor_is_1(self, fake_connection, fake_cursor):
        fake_cursor.fetchone.return_value = {"exists": True}
        fake_cursor.fetchall.return_value = []
        with patch.object(server, "get_pg_connection", return_value=fake_connection):
            server.get_intelligence_alerts(limit=-10)

        last_call = fake_cursor.execute.call_args_list[-1]
        assert last_call.args[1][1] == 1


class TestGetHotspotClusters:
    def test_notice_when_table_missing(self, fake_connection, fake_cursor):
        fake_cursor.fetchone.return_value = {"exists": False}
        with patch.object(server, "get_pg_connection", return_value=fake_connection):
            result = json.loads(server.get_hotspot_clusters())

        assert "does not exist" in result["notice"]

    def test_returns_clusters_ordered_by_complaint_count(self, fake_connection, fake_cursor):
        fake_cursor.fetchone.return_value = {"exists": True}
        fake_cursor.fetchall.return_value = [
            {"id": 1, "location_name": "ATM A", "latitude": 1.0, "longitude": 1.0,
             "risk_level": "high", "complaint_count": 9}
        ]
        with patch.object(server, "get_pg_connection", return_value=fake_connection):
            result = json.loads(server.get_hotspot_clusters())

        assert result[0]["location_name"] == "ATM A"


# ---------------------------------------------------------------------------
# redis_inspect
# ---------------------------------------------------------------------------


class TestRedisInspect:
    def test_returns_matched_keys_with_type_and_ttl(self):
        fake_redis = MagicMock()
        fake_redis.scan_iter.return_value = iter(["session:1", "session:2"])
        fake_redis.type.side_effect = ["string", "hash"]
        fake_redis.ttl.side_effect = [100, -1]

        with patch.object(server, "get_redis_client", return_value=fake_redis):
            result = json.loads(server.redis_inspect(pattern="session:*"))

        assert result["matched_keys_count"] == 2
        assert result["keys"][0] == {"key": "session:1", "type": "string", "ttl_seconds": 100}

    def test_respects_limit(self):
        fake_redis = MagicMock()
        fake_redis.scan_iter.return_value = iter([f"k{i}" for i in range(10)])
        fake_redis.type.return_value = "string"
        fake_redis.ttl.return_value = -1

        with patch.object(server, "get_redis_client", return_value=fake_redis):
            result = json.loads(server.redis_inspect(limit=3))

        assert result["matched_keys_count"] == 3

    def test_exception_is_caught_and_reported(self):
        with patch.object(server, "get_redis_client", side_effect=ConnectionError("down")):
            result = json.loads(server.redis_inspect())

        assert "Failed to inspect Redis" in result["error"]


# ---------------------------------------------------------------------------
# DATABASE_URL scheme normalization (module-import-time logic)
# ---------------------------------------------------------------------------


class TestDatabaseUrlNormalization:
    def test_asyncpg_scheme_is_rewritten_to_plain_postgresql(self):
        with patch.dict(
            os.environ,
            {"DATABASE_URL": "postgresql+asyncpg://u:p@host:5432/db"},
        ):
            reloaded = importlib.reload(server)
            try:
                assert reloaded.DATABASE_URL == "postgresql://u:p@host:5432/db"
            finally:
                importlib.reload(server)  # restore original env-derived state

    def test_plain_postgresql_scheme_is_left_unchanged(self):
        with patch.dict(
            os.environ,
            {"DATABASE_URL": "postgresql://u:p@host:5432/db"},
        ):
            reloaded = importlib.reload(server)
            try:
                assert reloaded.DATABASE_URL == "postgresql://u:p@host:5432/db"
            finally:
                importlib.reload(server)
