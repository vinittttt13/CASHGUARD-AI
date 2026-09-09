from fastapi import WebSocket
from typing import Dict

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def broadcast(self, message_dict: dict):
        for connection in self.active_connections.values():
            await connection.send_json(message_dict)

    async def send_to_user(self, user_id: str, message_dict: dict):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message_dict)
