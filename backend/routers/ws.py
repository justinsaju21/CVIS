"""
CVIS Backend — routers/ws.py
------------------------------
WebSocket endpoint — persistent connection for real-time telemetry fan-out.

Design rationale: A single shared WebSocket endpoint delivers telemetry events
to all three frontend views simultaneously. On connect, the client receives a
backfill of the last 10 telemetry records so it isn't blank while waiting for
the next packet. The keep-alive ping loop detects stale connections that the
OS hasn't yet closed, preventing silent memory leaks in the connection list.
"""

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from routers.telemetry import get_recent_telemetry
from ws_manager import manager

router = APIRouter(tags=["websocket"])
logger = logging.getLogger("cvis.ws_router")

PING_INTERVAL_S = 20  # seconds between server-side keep-alive pings


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for real-time telemetry delivery.

    Protocol (Phase 1):
      - On connect: server sends {"event": "backfill", "records": [...last 10...]}
      - On new telemetry POST: server sends {"event": "telemetry", ...fields...}
      - Server pings every PING_INTERVAL_S seconds; client may ignore or pong.
      - Client can send {"action": "ping"} and receives {"event": "pong"}.
    """
    await manager.connect(websocket)
    logger.info("[WS] New client connected.")

    try:
        # ── Backfill: send the last 10 records immediately on connect ────────
        recent = await get_recent_telemetry(limit=10)
        await manager.send_to(
            websocket,
            {"event": "backfill", "records": recent},
        )

        # ── Main receive loop with concurrent keep-alive pings ───────────────
        while True:
            # Use wait_for with a timeout to interleave ping heartbeats
            try:
                raw = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=PING_INTERVAL_S,
                )
                # Handle simple client messages
                try:
                    msg = json.loads(raw)
                    if msg.get("action") == "ping":
                        await manager.send_to(websocket, {"event": "pong"})
                except (json.JSONDecodeError, AttributeError):
                    pass  # ignore non-JSON messages

            except asyncio.TimeoutError:
                # Send a server-side ping to detect dead connections
                try:
                    await manager.send_to(websocket, {"event": "ping"})
                except Exception:
                    logger.info("[WS] Client appears dead on ping — disconnecting.")
                    break

    except WebSocketDisconnect:
        logger.info("[WS] Client disconnected gracefully.")
    except Exception as exc:
        logger.warning(f"[WS] Unexpected error: {exc}")
    finally:
        manager.disconnect(websocket)
