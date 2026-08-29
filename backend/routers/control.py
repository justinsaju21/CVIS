"""
CVIS Backend — routers/control.py
-----------------------------------
Vehicle disconnect and AI service stop endpoints.

Design rationale: "Disconnect vehicle" does not close a TCP connection — there
is no persistent connection to close. Instead, it sets the device as inactive
in the DB so the next packet from that device is rejected with 401. This
simulates a revocation event and is the correct representation for an HTTP
REST system. For MQTT, the backend also publishes a 'disconnect' command to
the device's control topic so the firmware can acknowledge and stop sending.

"Stop AI service" sets a flag that bypasses the Ollama call in the ingest
pipeline. Existing telemetry still flows and is stored — only the AI
recommendation/broadcast is suppressed. This lets the NOC demo what happens
when the AI layer goes down while the secure communication layer stays up
(reinforcing the project's thesis: AI rides on top of the comms, not embedded).

CCNS mapping:
  - Device revocation → Unit 4 (Access Control, Session Management)
  - Service degradation without connection loss → Unit 3 (QoS, Graceful Degradation)
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db import get_db

router = APIRouter(prefix="/api/v1/control", tags=["control"])
logger = logging.getLogger("cvis.control")

# ─── Fleet definition (canonical 4 vehicles) ─────────────────────────────
FLEET = [
    {
        "device_id":   "ESP32-ALPHA",
        "name":        "Alpha",
        "description": "Urban Commuter",
        "color":       "#00d4ff",
        "personality": "City driving — heavy traffic & charging cycles",
        "start_mode":  0,
        "cycle_secs":  12,
    },
    {
        "device_id":   "ESP32-BETA",
        "name":        "Beta",
        "description": "Performance Driver",
        "color":       "#ff4757",
        "personality": "High-speed sport — motor fault risk",
        "start_mode":  2,
        "cycle_secs":  10,
    },
    {
        "device_id":   "ESP32-GAMMA",
        "name":        "Gamma",
        "description": "Eco Ranger",
        "color":       "#2ed573",
        "personality": "Eco-focused — long range, low stress",
        "start_mode":  1,
        "cycle_secs":  18,
    },
    {
        "device_id":   "ESP32-DELTA",
        "name":        "Delta",
        "description": "Test Node",
        "color":       "#ffb347",
        "personality": "Cycles all 8 modes — used for demo & debug",
        "start_mode":  4,
        "cycle_secs":  8,
    },
]


# ─── AI service kill-switch (global + per-vehicle override) ───────────────
_ai_service_enabled: bool = True
_vehicle_ai_override: dict[str, bool] = {}  # device_id -> enabled


def is_ai_enabled(device_id: str | None = None) -> bool:
    if device_id and device_id in _vehicle_ai_override:
        return _vehicle_ai_override[device_id]
    return _ai_service_enabled


def set_ai_enabled(value: bool) -> None:
    global _ai_service_enabled
    _ai_service_enabled = value
    logger.info(f"[CONTROL] AI service {'STARTED' if value else 'STOPPED'} (global)")


# ─── Disconnect vehicle ────────────────────────────────────────────────────

class DisconnectRequest(BaseModel):
    device_id: str  = Field(..., description="Device to disconnect")
    reason:    str  = Field("NOC disconnect", description="Reason for disconnect")


@router.post("/disconnect", summary="Disconnect (deactivate) a vehicle node")
async def disconnect_vehicle(body: DisconnectRequest) -> dict:
    """
    Deactivate a vehicle node so its next packet is rejected with 401.

    For HTTP: the device's active flag is set to 0 — auth will fail on
    next request. For MQTT: a 'disconnect' command is published to
    cvis/control/{device_id} so the firmware can acknowledge and halt.
    """
    db = await get_db()

    async with db.execute(
        "SELECT device_id, active FROM devices WHERE device_id = ?",
        (body.device_id,),
    ) as cur:
        row = await cur.fetchone()

    if not row:
        raise HTTPException(404, f"Device '{body.device_id}' not found")

    if not row["active"]:
        return {"device_id": body.device_id, "status": "already_inactive",
                "message": "Device was already inactive"}

    # Deactivate in DB
    await db.execute(
        "UPDATE devices SET active = 0 WHERE device_id = ?",
        (body.device_id,),
    )
    # Log as auth event
    await db.execute(
        """
        INSERT INTO auth_logs (timestamp, device_id, event_type, details)
        VALUES (datetime('now'), ?, 'disconnected', ?)
        """,
        (body.device_id, f"NOC disconnect: {body.reason}"),
    )
    await db.commit()

    # Publish MQTT disconnect command (non-fatal if MQTT not running)
    try:
        from comms.mqtt_adapter import mqtt_adapter
        mqtt_adapter.publish_config(f"control/{body.device_id}", "disconnect")
    except Exception:
        pass

    # Broadcast to WebSocket clients so NOC shows the disconnected state
    from ws_manager import manager
    await manager.broadcast({
        "event": "device_disconnected",
        "device_id": body.device_id,
        "reason": body.reason,
    })

    logger.info(f"[CONTROL] Disconnected device: {body.device_id} — {body.reason}")
    return {
        "device_id": body.device_id,
        "status": "disconnected",
        "message": (
            f"Device '{body.device_id}' deactivated. "
            "Next packet will be rejected with 401. "
            "Re-register to restore access."
        ),
    }


@router.post("/reconnect", summary="Re-activate a previously disconnected vehicle node")
async def reconnect_vehicle(body: DisconnectRequest) -> dict:
    """Re-activate a deactivated device (does not issue new credentials)."""
    db = await get_db()
    async with db.execute(
        "SELECT device_id FROM devices WHERE device_id = ?",
        (body.device_id,),
    ) as cur:
        row = await cur.fetchone()

    if not row:
        raise HTTPException(404, f"Device '{body.device_id}' not found")

    await db.execute(
        "UPDATE devices SET active = 1 WHERE device_id = ?",
        (body.device_id,),
    )
    await db.execute(
        """
        INSERT INTO auth_logs (timestamp, device_id, event_type, details)
        VALUES (datetime('now'), ?, 'reconnected', 'NOC reconnect')
        """,
        (body.device_id,),
    )
    await db.commit()

    from ws_manager import manager
    await manager.broadcast({
        "event": "device_reconnected",
        "device_id": body.device_id,
    })

    logger.info(f"[CONTROL] Reconnected device: {body.device_id}")
    return {"device_id": body.device_id, "status": "active"}


# ─── Stop / Start AI service ──────────────────────────────────────────────

class AiServiceRequest(BaseModel):
    enabled: bool = Field(..., description="True = AI running, False = stopped")


@router.post("/ai-service", summary="Stop or start the AI recommendation service")
async def set_ai_service(body: AiServiceRequest) -> dict:
    """
    Stop or start the AI recommendation layer.

    When stopped: telemetry still flows, is stored, and is broadcast via
    WebSocket — but the Ollama inference call is skipped. This simulates
    AI service failure while the secure communication layer stays healthy.
    """
    set_ai_enabled(body.enabled)
    from ws_manager import manager
    await manager.broadcast({
        "event": "ai_service_status",
        "enabled": body.enabled,
    })
    return {
        "ai_service_enabled": body.enabled,
        "status": "ok",
        "message": f"AI service {'started' if body.enabled else 'stopped'}. "
                   f"Telemetry ingest {'unaffected' if not body.enabled else 'running normally'}.",
    }


@router.get("/ai-service", summary="Get AI service status")
async def get_ai_service_status() -> dict:
    return {"ai_service_enabled": _ai_service_enabled, "vehicle_overrides": _vehicle_ai_override}


# ─── Fleet registry ────────────────────────────────────────────────────────

@router.get("/vehicles", summary="Get the canonical fleet of 4 vehicles")
async def get_vehicles() -> list[dict]:
    """Return the static fleet definition enriched with live device status from DB."""
    db = await get_db()
    result = []
    for v in FLEET:
        async with db.execute(
            """
            SELECT d.active, d.tier, d.mobile_access_enabled,
                   t.mode AS last_mode, t.battery_pct AS last_battery,
                   t.motor_temp_c AS last_temp, t.received_at AS last_seen
            FROM devices d
            LEFT JOIN (
                SELECT device_id, mode, battery_pct, motor_temp_c, received_at,
                       ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY id DESC) as rn
                FROM telemetry
            ) t ON t.device_id = d.device_id AND t.rn = 1
            WHERE d.device_id = ?
            """,
            (v["device_id"],),
        ) as cur:
            row = await cur.fetchone()
        entry = {**v}
        if row:
            entry["active"]                = bool(row["active"])
            entry["tier"]                  = row["tier"] or "free"
            entry["mobile_access_enabled"] = bool(row["mobile_access_enabled"])
            entry["last_mode"]             = row["last_mode"]
            entry["last_battery"]          = row["last_battery"]
            entry["last_temp"]             = row["last_temp"]
            entry["last_seen"]             = row["last_seen"]
            entry["ai_enabled"]            = is_ai_enabled(v["device_id"])
        else:
            entry["active"]                = False
            entry["tier"]                  = "free"
            entry["mobile_access_enabled"] = False
            entry["last_mode"]             = None
            entry["last_battery"]          = None
            entry["last_temp"]             = None
            entry["last_seen"]             = None
            entry["ai_enabled"]            = is_ai_enabled(v["device_id"])
        result.append(entry)
    return result


# ─── Per-vehicle AI service toggle ─────────────────────────────────────────

class VehicleAiRequest(BaseModel):
    device_id: str  = Field(..., description="Vehicle to toggle AI for")
    enabled:   bool = Field(..., description="True = AI on for this vehicle")


@router.post("/ai-service/vehicle", summary="Enable or disable AI for a specific vehicle")
async def set_vehicle_ai_service(body: VehicleAiRequest) -> dict:
    """Override AI service state for a specific vehicle without affecting others."""
    _vehicle_ai_override[body.device_id] = body.enabled
    logger.info(f"[CONTROL] AI for {body.device_id} set to {'ENABLED' if body.enabled else 'DISABLED'}")
    from ws_manager import manager
    await manager.broadcast({
        "event": "vehicle_ai_status",
        "device_id": body.device_id,
        "enabled": body.enabled,
    })
    return {"device_id": body.device_id, "ai_enabled": body.enabled, "status": "ok"}

