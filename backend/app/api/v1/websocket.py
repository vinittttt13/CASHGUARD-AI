import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.security import verify_token
from app.services.websocket_manager import WebSocketManager

router = APIRouter(prefix="/ws", tags=["WebSocket"])
logger = logging.getLogger(__name__)

# Shared manager instance — PubSub is started in main.py lifespan
manager = WebSocketManager()


@router.websocket("/live-feed")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    # ---- Real token validation ----
    if not token:
        await websocket.close(code=1008)
        return

    try:
        token_data = verify_token(token)
        user_id = token_data.username
    except Exception:
        await websocket.close(code=1008)
        return

    if not user_id:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, user_id)

    heartbeat_task: asyncio.Task | None = None
    try:
        # Send initial state
        initial_state = {
            "type": "initial_state",
            "data": {
                "active_connections": len(manager.active_connections),
                "user": user_id,
            },
        }
        await websocket.send_json(initial_state)

        # Start heartbeat
        heartbeat_task = asyncio.create_task(_send_heartbeat(websocket))

        while True:
            data = await websocket.receive_text()
            # Handle incoming messages if needed
            logger.debug("WS received from %s: %s", user_id, data[:100])

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, user_id)
        if heartbeat_task is not None:
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass


async def _send_heartbeat(websocket: WebSocket) -> None:
    """Send periodic heartbeat pings to keep the connection alive."""
    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_json(
                {"type": "heartbeat", "timestamp": asyncio.get_event_loop().time()}
            )
    except asyncio.CancelledError:
        pass
    except Exception:
        pass
