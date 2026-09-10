"""
WebSocketManager with Redis PubSub for cross-pod broadcast.

When multiple Kubernetes pods are running, a client connected to Pod A will
receive alerts published by Pod B via the shared Redis channel.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Dict

from fastapi import WebSocket

logger = logging.getLogger(__name__)

CHANNEL_LIVE_ALERTS = "channel:live_alerts"


class WebSocketManager:
    def __init__(self) -> None:
        self.active_connections: Dict[str, WebSocket] = {}
        self._pubsub = None
        self._pubsub_task: asyncio.Task | None = None

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info("WS connected: %s (total: %d)", user_id, len(self.active_connections))

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        self.active_connections.pop(user_id, None)
        logger.info("WS disconnected: %s (total: %d)", user_id, len(self.active_connections))

    # ------------------------------------------------------------------
    # Local-only broadcast (to connections on this pod)
    # ------------------------------------------------------------------

    async def _local_broadcast(self, message_dict: dict) -> None:
        """Send a message to every WebSocket on *this* process."""
        stale: list[str] = []
        for uid, ws in self.active_connections.items():
            try:
                await ws.send_json(message_dict)
            except Exception:
                stale.append(uid)
        for uid in stale:
            self.active_connections.pop(uid, None)

    # ------------------------------------------------------------------
    # Cross-pod broadcast via Redis PubSub
    # ------------------------------------------------------------------

    async def broadcast(self, message_dict: dict) -> None:
        """Publish a message to Redis (for cross-pod relay) AND send to local
        connections.  If Redis is unavailable, falls back to local-only."""
        from app.core.redis_client import get_redis

        redis = get_redis()
        if redis is not None:
            try:
                await redis.publish(CHANNEL_LIVE_ALERTS, json.dumps(message_dict, default=str))
                # _listen_pubsub will relay the message back to local connections,
                # so we do NOT need to call _local_broadcast here — it would cause
                # duplicate deliveries.
                return
            except Exception as exc:
                logger.warning("Redis publish failed, falling back to local broadcast: %s", exc)

        # Fallback: local-only
        await self._local_broadcast(message_dict)

    async def send_to_user(self, user_id: str, message_dict: dict) -> None:
        ws = self.active_connections.get(user_id)
        if ws is not None:
            try:
                await ws.send_json(message_dict)
            except Exception:
                self.active_connections.pop(user_id, None)

    # ------------------------------------------------------------------
    # Redis PubSub listener (started on application startup)
    # ------------------------------------------------------------------

    async def start_pubsub(self) -> None:
        """Subscribe to the Redis live-alerts channel and begin relaying
        messages to local WebSocket connections."""
        from app.core.redis_client import get_redis

        redis = get_redis()
        if redis is None:
            logger.warning("Redis unavailable — PubSub relay disabled; broadcasts will be local-only.")
            return

        try:
            self._pubsub = redis.pubsub()
            await self._pubsub.subscribe(CHANNEL_LIVE_ALERTS)
            self._pubsub_task = asyncio.create_task(self._listen_pubsub())
            logger.info("Redis PubSub subscribed to %s", CHANNEL_LIVE_ALERTS)
        except Exception as exc:
            logger.warning("Failed to start Redis PubSub: %s", exc)

    async def _listen_pubsub(self) -> None:
        """Background coroutine: read from Redis PubSub and relay to local WS,
        with automatic reconnection and exponential backoff on transient drops."""
        backoff = 1.0
        max_backoff = 30.0

        while True:
            try:
                from app.core.redis_client import get_redis

                redis = get_redis()
                if redis is None:
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, max_backoff)
                    continue

                if self._pubsub is None:
                    self._pubsub = redis.pubsub()
                    await self._pubsub.subscribe(CHANNEL_LIVE_ALERTS)
                    logger.info("Redis PubSub connected/re-subscribed to %s", CHANNEL_LIVE_ALERTS)

                backoff = 1.0

                async for message in self._pubsub.listen():
                    if message["type"] == "message":
                        try:
                            data = json.loads(message["data"])
                            await self._local_broadcast(data)
                        except (json.JSONDecodeError, TypeError):
                            pass
            except asyncio.CancelledError:
                logger.info("PubSub listener cancelled.")
                break
            except Exception as exc:
                logger.warning(
                    "PubSub listener connection error (%s); reconnecting in %.1fs...",
                    exc,
                    backoff,
                )
                self._pubsub = None
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, max_backoff)


    async def stop_pubsub(self) -> None:
        """Cleanly unsubscribe and cancel the listener task."""
        if self._pubsub_task is not None:
            self._pubsub_task.cancel()
            try:
                await self._pubsub_task
            except asyncio.CancelledError:
                pass
        if self._pubsub is not None:
            try:
                await self._pubsub.unsubscribe(CHANNEL_LIVE_ALERTS)
                await self._pubsub.close()
            except Exception:
                pass
        logger.info("Redis PubSub stopped.")
