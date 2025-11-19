import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from typing import List
import logging


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self.lock:
            self.active_connections.append(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self.lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
        # No need to force-close here, FastAPI/Starlette will handle it.

    async def broadcast(self, message: dict):
        async with self.lock:
            connections_to_send = list(self.active_connections)

        for connection in connections_to_send:
            # schedule in background so one slow client doesn't block others
            asyncio.create_task(self._safe_send(connection, message))

    async def _safe_send(self, websocket: WebSocket, message: dict):
        try:
            await websocket.send_json(message)
        except WebSocketDisconnect:
            logging.info("Client disconnected.")
            await self.disconnect(websocket)
        except Exception as e:
            logging.error(f"Error sending message: {e}")
            await self.disconnect(websocket)


ws_manager = ConnectionManager()
