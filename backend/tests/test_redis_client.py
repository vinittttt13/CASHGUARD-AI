"""Unit tests for app.core.redis_client — previously 35% covered.

conftest.py's autouse `mock_redis` fixture forces `_redis_available = False`
for every test in the suite (so nothing accidentally hits a real Redis).
That means the "Redis IS available" branches of every function here were
never exercised. These tests locally re-patch `redis_client` to an
AsyncMock and `_redis_available` to True to cover those branches too,
alongside the already-covered "Redis unavailable" fast paths.
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.core import redis_client as rc


@pytest.fixture
def mock_client():
    """A fake, available Redis client — overrides the suite-wide autouse mock."""
    client = AsyncMock()
    with (
        patch.object(rc, "redis_client", client),
        patch.object(rc, "_redis_available", True),
    ):
        yield client


class TestUnavailable:
    """Redis unavailable: every function must degrade safely, never raise."""

    @pytest.mark.asyncio
    async def test_cache_set_returns_false(self):
        assert await rc.cache_set("k", {"a": 1}) is False

    @pytest.mark.asyncio
    async def test_cache_get_returns_none(self):
        assert await rc.cache_get("k") is None

    @pytest.mark.asyncio
    async def test_cache_delete_returns_false(self):
        assert await rc.cache_delete("k") is False

    @pytest.mark.asyncio
    async def test_cache_delete_pattern_returns_zero(self):
        assert await rc.cache_delete_pattern("k:*") == 0

    @pytest.mark.asyncio
    async def test_revoke_token_returns_false(self):
        assert await rc.revoke_token("jti-1") is False

    @pytest.mark.asyncio
    async def test_is_token_revoked_fails_open_to_false(self):
        assert await rc.is_token_revoked("jti-1") is False

    def test_get_redis_returns_none(self):
        assert rc.get_redis() is None


class TestAvailable:
    """Redis available: exercise the real success + exception-swallowing paths."""

    @pytest.mark.asyncio
    async def test_cache_set_serializes_and_sets_with_ttl(self, mock_client):
        ok = await rc.cache_set("mykey", {"a": 1}, ttl=60)

        assert ok is True
        mock_client.set.assert_awaited_once()
        args, kwargs = mock_client.set.await_args
        assert args[0] == "mykey"
        assert '"a": 1' in args[1]
        assert kwargs["ex"] == 60

    @pytest.mark.asyncio
    async def test_cache_set_swallows_errors_and_returns_false(self, mock_client):
        mock_client.set.side_effect = ConnectionError("boom")

        assert await rc.cache_set("k", "v") is False

    @pytest.mark.asyncio
    async def test_cache_get_deserializes_json(self, mock_client):
        mock_client.get.return_value = '{"b": 2}'

        result = await rc.cache_get("mykey")

        assert result == {"b": 2}
        mock_client.get.assert_awaited_once_with("mykey")

    @pytest.mark.asyncio
    async def test_cache_get_returns_none_for_missing_key(self, mock_client):
        mock_client.get.return_value = None

        assert await rc.cache_get("missing") is None

    @pytest.mark.asyncio
    async def test_cache_get_swallows_errors_and_returns_none(self, mock_client):
        mock_client.get.side_effect = ConnectionError("boom")

        assert await rc.cache_get("k") is None

    @pytest.mark.asyncio
    async def test_cache_delete_calls_redis_delete(self, mock_client):
        ok = await rc.cache_delete("mykey")

        assert ok is True
        mock_client.delete.assert_awaited_once_with("mykey")

    @pytest.mark.asyncio
    async def test_cache_delete_swallows_errors(self, mock_client):
        mock_client.delete.side_effect = ConnectionError("boom")

        assert await rc.cache_delete("k") is False

    @pytest.mark.asyncio
    async def test_cache_delete_pattern_deletes_matched_keys(self, mock_client):
        mock_client.keys.return_value = ["a:1", "a:2"]

        count = await rc.cache_delete_pattern("a:*")

        assert count == 2
        mock_client.delete.assert_awaited_once_with("a:1", "a:2")

    @pytest.mark.asyncio
    async def test_cache_delete_pattern_no_matches_skips_delete(self, mock_client):
        mock_client.keys.return_value = []

        count = await rc.cache_delete_pattern("a:*")

        assert count == 0
        mock_client.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_revoke_token_sets_with_days_ttl(self, mock_client):
        ok = await rc.revoke_token("jti-1", ttl_days=3)

        assert ok is True
        mock_client.set.assert_awaited_once_with("revoked:jti-1", "1", ex=3 * 86400)

    @pytest.mark.asyncio
    async def test_revoke_token_swallows_errors(self, mock_client):
        mock_client.set.side_effect = ConnectionError("boom")

        assert await rc.revoke_token("jti-1") is False

    @pytest.mark.asyncio
    async def test_is_token_revoked_true_when_key_exists(self, mock_client):
        mock_client.exists.return_value = 1

        assert await rc.is_token_revoked("jti-1") is True
        mock_client.exists.assert_awaited_once_with("revoked:jti-1")

    @pytest.mark.asyncio
    async def test_is_token_revoked_false_when_key_absent(self, mock_client):
        mock_client.exists.return_value = 0

        assert await rc.is_token_revoked("jti-1") is False

    @pytest.mark.asyncio
    async def test_is_token_revoked_fails_open_on_error(self, mock_client):
        mock_client.exists.side_effect = ConnectionError("boom")

        assert await rc.is_token_revoked("jti-1") is False

    def test_get_redis_returns_the_client(self, mock_client):
        assert rc.get_redis() is mock_client
