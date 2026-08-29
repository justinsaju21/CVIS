"""
CVIS Backend — routers/config.py
----------------------------------
Runtime configuration endpoints for the NOC control panel.

Design rationale: Every NOC control (protocol switch, encryption toggle, auth
toggle, chaos settings) is wired to a real backend state change here. The
endpoint persists state to server_config in SQLite so settings survive restarts,
and where relevant broadcasts the change to connected ESP32 nodes via MQTT.

CCNS mapping:
  - Protocol switch → Unit 2 (Protocol Interoperability)
  - Encryption toggle → Unit 4 (Cryptographic Protocols)
  - Auth toggle → Unit 4 (Access Control)
  - Chaos settings → Unit 3 (Reliability, QoS, Packet Loss, Latency)
"""

import logging

from fastapi import APIRouter, Body
from pydantic import BaseModel, Field

import auth as auth_module
from db import get_config, set_config
from middleware.chaos import chaos_config
from replay_protection import is_replay_protection_enabled, set_replay_protection_enabled

router = APIRouter(prefix="/api/v1/config", tags=["config"])
logger = logging.getLogger("cvis.config")


# ─── Protocol ─────────────────────────────────────────────────────────────

class ProtocolConfig(BaseModel):
    protocol: str = Field(..., pattern="^(http|mqtt)$")


@router.get("/protocol", summary="Get current active protocol")
async def get_protocol() -> dict:
    value = await get_config("active_protocol") or "http"
    return {"active_protocol": value}


@router.post("/protocol", summary="Switch active protocol (HTTP ↔ MQTT)")
async def set_protocol(body: ProtocolConfig) -> dict:
    """
    Switch the active protocol at runtime. The backend broadcasts the new
    protocol to all MQTT subscribers so ESP32 nodes self-switch without restart.
    """
    from comms.mqtt_adapter import mqtt_adapter
    await set_config("active_protocol", body.protocol)
    # Broadcast to ESP32 nodes subscribed to cvis/config/protocol
    mqtt_adapter.publish_config("protocol", body.protocol)
    logger.info(f"[CONFIG] Protocol switched to: {body.protocol}")
    return {"active_protocol": body.protocol, "status": "ok"}


# ─── Encryption ───────────────────────────────────────────────────────────

class EncryptionConfig(BaseModel):
    enabled: bool


@router.get("/encryption", summary="Get current encryption state")
async def get_encryption() -> dict:
    value = await get_config("encryption_enabled") or "false"
    return {"encryption_enabled": value == "true"}


@router.post("/encryption", summary="Toggle AES-GCM encryption")
async def set_encryption(body: EncryptionConfig) -> dict:
    """
    Enable or disable AES-256-GCM payload encryption.
    When enabled, ESP32 encrypts the JSON body before sending.
    Backend decrypts and verifies the GCM authentication tag.
    """
    from comms.mqtt_adapter import mqtt_adapter
    value = "true" if body.enabled else "false"
    await set_config("encryption_enabled", value)
    mqtt_adapter.publish_config("encryption", value)
    logger.info(f"[CONFIG] Encryption {'ENABLED' if body.enabled else 'DISABLED'}")
    return {"encryption_enabled": body.enabled, "status": "ok"}


# ─── Auth ─────────────────────────────────────────────────────────────────

class AuthConfig(BaseModel):
    enabled: bool


@router.get("/auth", summary="Get current auth enforcement state")
async def get_auth() -> dict:
    return {"auth_enabled": auth_module.is_auth_enabled()}


@router.post("/auth", summary="Toggle auth enforcement (demo: show open vs secured)")
async def set_auth(body: AuthConfig) -> dict:
    """
    Enable or disable authentication enforcement.
    When disabled, the backend accepts unauthenticated packets and logs them
    as 'no_auth' events — useful for demonstrating open vs. secured traffic.
    """
    await set_config("auth_enabled", "true" if body.enabled else "false")
    auth_module.set_auth_enabled(body.enabled)
    logger.info(f"[CONFIG] Auth enforcement {'ENABLED' if body.enabled else 'DISABLED'}")
    return {"auth_enabled": body.enabled, "status": "ok"}


# ─── Chaos ────────────────────────────────────────────────────────────────

ALLOWED_LOSS_PCT    = {0, 5, 10, 25}
ALLOWED_LATENCY_MS  = {0, 100, 300, 1000}


class ChaosConfig(BaseModel):
    loss_pct:   int   = Field(0,     description="Packet loss % (0/5/10/25)")
    latency_ms: int   = Field(0,     description="Artificial latency ms (0/100/300/1000)")
    tamper:     bool  = Field(False, description="Enable packet tampering injector")


@router.get("/chaos", summary="Get current chaos settings")
async def get_chaos() -> dict:
    return {
        "loss_pct":   chaos_config.loss_pct,
        "latency_ms": chaos_config.latency_ms,
        "tamper":     chaos_config.tamper_enabled,
    }


@router.post("/chaos", summary="Update chaos/simulation settings")
async def set_chaos(body: ChaosConfig) -> dict:
    """
    Configure the chaos middleware:
    - **loss_pct**: probabilistically drops packets before processing
    - **latency_ms**: adds artificial delay before processing
    - **tamper**: mutates a payload field post-signature to trigger HMAC rejection
    """
    if body.loss_pct not in ALLOWED_LOSS_PCT:
        from fastapi import HTTPException
        raise HTTPException(400, f"loss_pct must be one of {sorted(ALLOWED_LOSS_PCT)}")
    if body.latency_ms not in ALLOWED_LATENCY_MS:
        from fastapi import HTTPException
        raise HTTPException(400, f"latency_ms must be one of {sorted(ALLOWED_LATENCY_MS)}")

    chaos_config.loss_pct      = body.loss_pct
    chaos_config.latency_ms    = body.latency_ms
    chaos_config.tamper_enabled = body.tamper

    # Persist to DB
    await set_config("chaos_loss_pct",   str(body.loss_pct))
    await set_config("chaos_latency_ms", str(body.latency_ms))
    await set_config("chaos_tamper",     "true" if body.tamper else "false")

    logger.info(
        f"[CONFIG] Chaos updated: loss={body.loss_pct}% "
        f"latency={body.latency_ms}ms tamper={body.tamper}"
    )
    return {
        "loss_pct": body.loss_pct,
        "latency_ms": body.latency_ms,
        "tamper": body.tamper,
        "status": "ok",
    }


# ─── Replay protection ───────────────────────────────────────────────

class ReplayConfig(BaseModel):
    enabled: bool


@router.get("/replay", summary="Get replay protection state")
async def get_replay() -> dict:
    return {"replay_protection_enabled": is_replay_protection_enabled()}


@router.post("/replay", summary="Enable/disable replay protection")
async def set_replay(body: ReplayConfig) -> dict:
    """
    Enable or disable timestamp-window replay protection.
    When enabled, the same (device_id, timestamp_ms) pair cannot be
    accepted twice within the configured window.
    """
    await set_config("replay_protection", "true" if body.enabled else "false")
    set_replay_protection_enabled(body.enabled)
    return {"replay_protection_enabled": body.enabled, "status": "ok"}


# ─── Full config snapshot ───────────────────────────────────────────────

@router.get("/all", summary="Get all runtime configuration in one call")
async def get_all_config() -> dict:
    """Snapshot of all current backend config — useful for NOC on connect."""
    from routers.control import is_ai_enabled
    protocol   = await get_config("active_protocol") or "http"
    encryption = (await get_config("encryption_enabled") or "false") == "true"
    return {
        "active_protocol":           protocol,
        "encryption_enabled":        encryption,
        "auth_enabled":              auth_module.is_auth_enabled(),
        "replay_protection_enabled": is_replay_protection_enabled(),
        "ai_service_enabled":        is_ai_enabled(),
        "chaos": {
            "loss_pct":   chaos_config.loss_pct,
            "latency_ms": chaos_config.latency_ms,
            "tamper":     chaos_config.tamper_enabled,
        },
        "force_mode": await get_config("force_mode"),
    }

class ModeConfig(BaseModel):
    mode: str | None = Field(None, description="Force a specific drive mode (or None to auto-cycle)")

@router.post("/mode", summary="Force a specific vehicle mode")
async def set_force_mode(body: ModeConfig) -> dict:
    value = body.mode if body.mode else ""
    await set_config("force_mode", value)
    return {"force_mode": body.mode, "status": "ok"}


