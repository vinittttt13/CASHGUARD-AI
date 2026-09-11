"""Unit tests for app.services.websocket_manager.WebSocketManager —
previously 25% covered (only lightly exercised indirectly via test_api.py's
HTTP-level WS auth tests).
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.websocket_manager import CHANNEL_LIVE_ALERTS, WebSocketManager


def make_ws(fail: bool = False):
    ws = AsyncMock()
    if fail:
        ws.send_json.side_effect = ConnectionError("client gone")
    return ws


@pytest.fixture
def manager():
    return WebSocketManager()


class TestConnectionLifecycle:
    @pytest.mark.asyncio
    async def test_connect_accepts_and_tracks_connection(self, manager):
        ws = make_ws()

        await manager.connect(ws, "user-1")

        ws.accept.assert_awaited_once()
        assert manager.active_connections["user-1"] is ws

    def test_disconnect_removes_tracked_connection(self, manager):
        manager.active_connections["user-1"] = make_ws()

        manager.disconnect(manager.active_connections["user-1"], "user-1")

        assert "user-1" not in manager.active_connections

    def test_disconnect_unknown_user_is_a_noop(self, manager):
        manager.disconnect(make_ws(), "never-connected")  # must not raise


class TestLocalBroadcast:
    @pytest.mark.asyncio
    async def test_sends_to_every_connection(self, manager):
        ws1, ws2 = make_ws(), make_ws()
        manager.active_connections = {"u1": ws1, "u2": ws2}

        await manager._local_broadcast({"type": "new_alert"})

        ws1.send_json.assert_awaited_once_with({"type": "new_alert"})
        ws2.send_json.assert_awaited_once_with({"type": "new_alert"})

    @pytest.mark.asyncio
    async def test_drops_stale_connections_that_fail_to_send(self, manager):
        good, stale = make_ws(), make_ws(fail=True)
        manager.active_connections = {"good": good, "stale": stale}

        await manager._local_broadcast({"type": "ping"})

        assert "stale" not in manager.active_connections
        assert "good" in manager.active_connections


class TestBroadcast:
    @pytest.mark.asyncio
    async def test_publishes_to_redis_when_available_and_skips_local(self, manager):
        redis = AsyncMock()
        manager._local_broadcast = AsyncMock()  # spy

        with patch("app.core.redis_client.get_redis", return_value=redis):
            await manager.broadcast({"type": "new_alert", "id": "1"})

        redis.publish.assert_awaited_once()
        channel, payload = redis.publish.await_args.args
        assert channel == CHANNEL_LIVE_ALERTS
        assert json.loads(payload) == {"type": "new_alert", "id": "1"}
        # Relay happens via the pubsub listener, not a direct local call —
        # calling both would duplicate delivery.
        manager._local_broadcast.assert_not_called()

    @pytest.mark.asyncio
    async def test_falls_back_to_local_when_redis_unavailable(self, manager):
        manager._local_broadcast = AsyncMock()

        with patch("app.core.redis_client.get_redis", return_value=None):
            await manager.broadcast({"type": "ping"})

        manager._local_broadcast.assert_awaited_once_with({"type": "ping"})

    @pytest.mark.asyncio
    async def test_falls_back_to_local_when_redis_publish_raises(self, manager):
        redis = AsyncMock()
        redis.publish.side_effect = ConnectionError("boom")
        manager._local_broadcast = AsyncMock()

        with patch("app.core.redis_client.get_redis", return_value=redis):
            await manager.broadcast({"type": "ping"})

        manager._local_broadcast.assert_awaited_once_with({"type": "ping"})


class TestSendToUser:
    @pytest.mark.asyncio
    async def test_sends_to_connected_user(self, manager):
        ws = make_ws()
        manager.active_connections["u1"] = ws

        await manager.send_to_user("u1", {"type": "prediction_update"})

        ws.send_json.assert_awaited_once_with({"type": "prediction_update"})

    @pytest.mark.asyncio
    async def test_noop_for_unknown_user(self, manager):
        await manager.send_to_user("ghost", {"type": "x"})  # must not raise

    @pytest.mark.asyncio
    async def test_drops_connection_on_send_failure(self, manager):
        manager.active_connections["u1"] = make_ws(fail=True)

        await manager.send_to_user("u1", {"type": "x"})

        assert "u1" not in manager.active_connections


class TestPubSubLifecycle:
    @pytest.mark.asyncio
    async def test_start_pubsub_noop_when_redis_unavailable(self, manager):
        with patch("app.core.redis_client.get_redis", return_value=None):
            await manager.start_pubsub()

        assert manager._pubsub is None
        assert manager._pubsub_task is None

    @pytest.mark.asyncio
    async def test_start_pubsub_subscribes_and_starts_listener_task(self, manager):
        # redis-py's .pubsub() is a *synchronous* factory method (it builds a
        # PubSub object; only its methods like .subscribe() are coroutines),
        # so the client mock can't be a blanket AsyncMock here.
        redis = MagicMock()
        pubsub = AsyncMock()
        redis.pubsub = MagicMock(return_value=pubsub)

        with patch("app.core.redis_client.get_redis", return_value=redis):
            with patch.object(manager, "_listen_pubsub", new=AsyncMock()):
                await manager.start_pubsub()

        pubsub.subscribe.assert_awaited_once_with(CHANNEL_LIVE_ALERTS)
        assert manager._pubsub_task is not None
        manager._pubsub_task.cancel()

    @pytest.mark.asyncio
    async def test_start_pubsub_swallows_subscribe_errors(self, manager):
        redis = MagicMock()
        redis.pubsub = MagicMock(side_effect=ConnectionError("boom"))

        with patch("app.core.redis_client.get_redis", return_value=redis):
            await manager.start_pubsub()  # must not raise

    @pytest.mark.asyncio
    async def test_stop_pubsub_cancels_task_and_closes_pubsub(self, manager):
        async def never_ending():
            await asyncio.sleep(100)

        manager._pubsub_task = asyncio.create_task(never_ending())
        pubsub = AsyncMock()
        manager._pubsub = pubsub

        await manager.stop_pubsub()

        pubsub.unsubscribe.assert_awaited_once_with(CHANNEL_LIVE_ALERTS)
        pubsub.close.assert_awaited_once()
        assert manager._pubsub_task.cancelled() or manager._pubsub_task.done()

    @pytest.mark.asyncio
    async def test_stop_pubsub_is_noop_with_nothing_started(self, manager):
        await manager.stop_pubsub()  # must not raise

    @pytest.mark.asyncio
    async def test_stop_pubsub_swallows_unsubscribe_errors(self, manager):
        pubsub = AsyncMock()
        pubsub.unsubscribe.side_effect = ConnectionError("boom")
        manager._pubsub = pubsub

        await manager.stop_pubsub()  # must not raise


class TestListenPubsub:
    @pytest.mark.asyncio
    async def test_relays_received_message_to_local_broadcast_then_stops(self, manager):
        """Drive one iteration of the listen loop via a fake pubsub whose
        `.listen()` yields one real message then raises CancelledError,
        exactly how `stop_pubsub()` would end the loop in production."""

        async def fake_listen():
            yield {"type": "message", "data": json.dumps({"type": "new_alert"})}
            raise asyncio.CancelledError()

        pubsub = AsyncMock()
        pubsub.listen = fake_listen
        manager._pubsub = pubsub
        manager._local_broadcast = AsyncMock()

        redis = AsyncMock()
        with patch("app.core.redis_client.get_redis", return_value=redis):
            await manager._listen_pubsub()

        manager._local_broadcast.assert_awaited_once_with({"type": "new_alert"})

    @pytest.mark.asyncio
    async def test_ignores_malformed_json_payload(self, manager):
        async def fake_listen():
            yield {"type": "message", "data": "not-json"}
            raise asyncio.CancelledError()

        pubsub = AsyncMock()
        pubsub.listen = fake_listen
        manager._pubsub = pubsub
        manager._local_broadcast = AsyncMock()

        redis = AsyncMock()
        with patch("app.core.redis_client.get_redis", return_value=redis):
            await manager._listen_pubsub()  # must not raise

        manager._local_broadcast.assert_not_called()

    @pytest.mark.asyncio
    async def test_backs_off_and_returns_when_redis_stays_unavailable(self, manager):
        """redis is None -> the loop sleeps and retries; a CancelledError
        from that sleep (e.g. the real stop_pubsub() cancelling the task) is
        caught by the method's own try/except and ends the loop cleanly —
        it must NOT propagate out of _listen_pubsub itself."""
        with patch("app.core.redis_client.get_redis", return_value=None):
            with patch("asyncio.sleep", new=AsyncMock(side_effect=asyncio.CancelledError())):
                await asyncio.wait_for(manager._listen_pubsub(), timeout=1)
