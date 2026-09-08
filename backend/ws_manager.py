"""
CVIS Backend — ws_manager.py
-----------------------------
WebSocket connection manager — fan-out broadcast to all connected clients.

Design rationale: A centralised connection registry decouples the telemetry
ingest path from the frontend delivery path. Any code that calls
`manager.broadcast(data)` automatically reaches all three views
(/driver, /noc, /admin) without each router needing to know about the others.
This single-broadcast design is the foundation for Phase 4's NOC live feed.
"""

import asyncio
import json
import logging
from typing import Any
from fastapi import WebSocket

logger = logging.getLogger("cvis.ws")


class ConnectionManager:
    """
    Manages active WebSocket connections and provides broadcast + unicast APIs.

    Thread-safety note: FastAPI/Starlette runs in a single asyncio event loop,
    so the list mutations here are safe without locks.
    """

    def __init__(self) -> None:
        self._connections: list[WebSocket] = []

    # ─── Lifecycle ─────────────────────────────────────────────

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        self._connections.append(websocket)
        logger.info(f"[WS] Client connected — total: {len(self._connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a connection from the registry (called on close/error).
        Guard against ValueError — the connection may have already been removed
        by the dead-connection sweep inside broadcast().
        """
        if websocket in self._connections:
            self._connections.remove(websocket)
        logger.info(f"[WS] Client disconnected — total: {len(self._connections)}")

    # ─── Messaging ─────────────────────────────────────────────

    async def broadcast(self, data: dict[str, Any] | str) -> None:
        """
        Send a message to every connected client.
        Accepts either a dict (auto-serialised to JSON) or a pre-serialised string.
        Silently removes connections that have closed.
        """
        if isinstance(data, dict):
            message = json.dumps(data)
        else:
            message = data

        dead: list[WebSocket] = []
        for ws in self._connections:
            try:
                await ws.send_text(message)
            except Exception as exc:
                logger.warning(f"[WS] Failed to send to client, marking for removal: {exc}")
                dead.append(ws)

        for ws in dead:
            if ws in self._connections:
                self._connections.remove(ws)

    async def send_to(self, websocket: WebSocket, data: dict[str, Any] | str) -> None:
        """Send a message to a single specific client."""
        if isinstance(data, dict):
            message = json.dumps(data)
        else:
            message = data
        await websocket.send_text(message)

    # ─── Introspection ──────────────────────────────────────────

    @property
    def connection_count(self) -> int:
        return len(self._connections)


# Singleton instance — imported by routers
manager = ConnectionManager()
