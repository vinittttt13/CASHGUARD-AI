from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from typing import List, Dict
import asyncio
import json

from app.services.websocket_manager import WebSocketManager

router = APIRouter(prefix="/ws", tags=["WebSocket"])
manager = WebSocketManager()

@router.websocket("/live-feed")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    # Simple token validation mock
    if not token:
        await websocket.close(code=1008)
        return
        
    user_id = "user_" + token[:5] # Mock user ID from token
    await manager.connect(websocket, user_id)
    
    try:
        # Send initial state
        initial_state = {
            "type": "initial_state",
            "data": {
                "active_alerts": 5,
                "recent_complaints": []
            }
        }
        await websocket.send_json(initial_state)
        
        # Start heartbeat
        heartbeat_task = asyncio.create_task(send_heartbeat(websocket))
        
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages if needed
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        if 'heartbeat_task' in locals():
            heartbeat_task.cancel()

async def send_heartbeat(websocket: WebSocket):
    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_json({"type": "heartbeat", "timestamp": asyncio.get_event_loop().time()})
    except asyncio.CancelledError:
        pass
