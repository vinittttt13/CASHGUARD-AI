"""Shared fixtures for mcp/server.py tests.

server.py has no external test dependency to mock away for import (it reads
DATABASE_URL/REDIS_URL from env at import time with safe defaults), but
every tool function opens a real psycopg2/redis connection when called — so
every test that isn't purely testing input-validation logic mocks
`get_pg_connection` / `get_redis_client` rather than touching a real DB.
"""

from unittest.mock import MagicMock

import pytest


def _as_context_manager(mock: MagicMock) -> MagicMock:
    """Configure a MagicMock so `with mock as x:` yields itself.

    Subclassing MagicMock and overriding __enter__/__exit__ as plain methods
    does NOT reliably work — MagicMock dynamically builds a per-instance
    subclass to back its configured magic methods, which can shadow a
    statically-defined __enter__/__exit__ depending on MRO/instantiation
    order. Configuring the auto-created __enter__/__exit__ mocks directly
    (the standard unittest.mock pattern) avoids that entirely.
    """
    mock.__enter__.return_value = mock
    mock.__exit__.return_value = False
    return mock


@pytest.fixture
def fake_cursor():
    return _as_context_manager(MagicMock())


@pytest.fixture
def fake_connection(fake_cursor):
    conn = _as_context_manager(MagicMock())
    conn.cursor.return_value = fake_cursor
    return conn
