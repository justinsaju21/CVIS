"""
CVIS Backend — services/telemetry_service.py
----------------------------------------------
Shared telemetry ingest logic called by both the HTTP router and the MQTT
adapter. Centralising here ensures both protocols go through identical
validation, persistence, and broadcast pipelines.

Design rationale: Extracting the ingest core into a service function decouples
the transport layer (HTTP headers vs. MQTT topic/payload) from the business
logic. Both adapters supply the same arguments; the service doesn't care which
wire the packet arrived on.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from cryptography.exceptions import InvalidTag

from crypto import verify_hmac, aes_gcm_decrypt, hash_api_key
from db import get_db
from models import TelemetryPayload
from replay_protection import check_replay
from ws_manager import manager

logger = logging.getLogger("cvis.telemetry_service")


async def _log_auth(device_id: Optional[str], event_type: str,
                    ip_address: str, details: str) -> None:
    """Write a row to the auth_logs table."""
    db = await get_db()
    await db.execute(
        """
        INSERT INTO auth_logs (timestamp, device_id, event_type, ip_address, details)
        VALUES (datetime('now'), ?, ?, ?, ?)
        """,
        (device_id, event_type, ip_address, details),
    )
    await db.commit()


async def ingest_telemetry_data(
    raw_json: str,
    *,
    protocol: str = "http",
    source_ip: str = "unknown",
    api_key: Optional[str] = None,
    hmac_signature: Optional[str] = None,
    encrypted: bool = False,
    iv: Optional[str] = None,
    ct: Optional[str] = None,
    tag: Optional[str] = None,
    auth_enabled: bool = True,
) -> dict:
    """
    Core telemetry ingest pipeline — validate, optionally decrypt + verify,
    persist to DB, broadcast via WebSocket.

    Returns:
        dict with status, packet_id, received_at, and device_id

    Raises:
        ValueError on auth/HMAC/decryption failure (caller logs and responds)
    """
    db = await get_db()
    received_at = datetime.now(timezone.utc).isoformat()

    # ── 1. Auth: verify API key ──────────────────────────────────────────
    device_id: Optional[str] = None
    device_secret: Optional[str] = None

    if auth_enabled:
        if not api_key:
            await _log_auth(None, "auth_fail", source_ip, "Missing API key")
            raise ValueError("AUTH_FAIL: Missing API key")

        key_hash = hash_api_key(api_key)
        async with db.execute(
            "SELECT device_id, device_secret FROM devices WHERE api_key_hash = ? AND active = 1",
            (key_hash,),
        ) as cur:
            row = await cur.fetchone()

        if not row:
            await _log_auth(None, "auth_fail", source_ip, "Invalid API key")
            raise ValueError("AUTH_FAIL: Invalid API key")

        device_id = row["device_id"]
        device_secret = row["device_secret"]
        await _log_auth(device_id, "auth_ok", source_ip, "API key accepted")

    # ── 2. Decrypt if AES-GCM enabled ────────────────────────────────────
    plaintext_json = raw_json
    if encrypted:
        if not (iv and ct and tag and device_secret):
            raise ValueError("DECRYPT_FAIL: Missing AES-GCM fields or device secret")
        try:
            plaintext_json = aes_gcm_decrypt(device_secret, iv, ct, tag)
            logger.debug(f"[INGEST] AES-GCM decryption OK for device={device_id}")
        except InvalidTag:
            await _log_auth(device_id, "tamper_detected", source_ip,
                            "AES-GCM tag mismatch — payload tampered or wrong key")
            raise ValueError("TAMPER: AES-GCM authentication tag invalid")

    # ── 3. HMAC verification (on plaintext) ──────────────────────────────
    if auth_enabled and hmac_signature and device_secret:
        if not verify_hmac(device_secret, plaintext_json, hmac_signature):
            await _log_auth(device_id, "tamper_detected", source_ip,
                            "HMAC-SHA256 mismatch — payload may have been tampered")
            logger.warning(f"[INGEST] HMAC FAIL device={device_id} — TAMPER DETECTED")
            raise ValueError("TAMPER: HMAC signature verification failed")
        logger.debug(f"[INGEST] HMAC OK for device={device_id}")
    elif auth_enabled and not hmac_signature:
        await _log_auth(device_id, "auth_fail", source_ip,
                        "Missing HMAC signature")
        raise ValueError("AUTH_FAIL: Missing HMAC signature")

    # ── 4. Parse + validate payload ──────────────────────────────────────
    try:
        payload = TelemetryPayload.model_validate_json(plaintext_json)
    except Exception as e:
        raise ValueError(f"PARSE_FAIL: {e}")

    # ── 5. Replay protection ───────────────────────────────────────
    replay_err = check_replay(payload.device_id, payload.timestamp_ms)
    if replay_err:
        await _log_auth(payload.device_id, "tamper_detected", source_ip,
                        replay_err)
        raise ValueError(replay_err)  # already prefixed with "REPLAY: ..."

    size_bytes = len(raw_json.encode("utf-8"))

    # ── 6. Persist raw packet ────────────────────────────────────────────
    cursor = await db.execute(
        """
        INSERT INTO packets
            (received_at, device_id, protocol, direction, size_bytes, status, raw_json)
        VALUES (?, ?, ?, 'inbound', ?, 'ok', ?)
        """,
        (received_at, payload.device_id, protocol, size_bytes, plaintext_json),
    )
    packet_id: int = cursor.lastrowid  # type: ignore

    # ── 6. Persist structured telemetry ──────────────────────────────────
    await db.execute(
        """
        INSERT INTO telemetry
            (packet_id, received_at, device_id, schema_version,
             mode, speed_kmh, battery_pct, battery_temp_c, motor_temp_c,
             range_km, fault_code, charging_rate_w)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            packet_id, received_at, payload.device_id, payload.schema_version,
            payload.mode, payload.speed_kmh, payload.battery_pct,
            payload.battery_temp_c, payload.motor_temp_c,
            payload.range_km, payload.fault_code, payload.charging_rate_w,
        ),
    )
    await db.commit()

    logger.info(
        f"[INGEST] [{protocol.upper()}] packet_id={packet_id} "
        f"device={payload.device_id} mode={payload.mode} "
        f"batt={payload.battery_pct:.1f}%"
    )

    # ── 7. WebSocket broadcast ────────────────────────────────────────────
    broadcast_payload = {
        "event": "telemetry",
        "packet_id": packet_id,
        "received_at": received_at,
        "protocol": protocol,
        **payload.model_dump(),
    }
    await manager.broadcast(broadcast_payload)

    # ── 8. Fire-and-forget AI recommendation ─────────────────────────────
    try:
        import asyncio
        from routers.control import is_ai_enabled
        if is_ai_enabled():
            asyncio.create_task(
                _send_ai_recommendation(payload, packet_id, received_at)
            )
        else:
            logger.debug("[INGEST] AI service stopped — recommendation skipped")
    except ImportError:
        pass  # AI module not yet loaded — skip silently

    return {
        "status": "ok",
        "packet_id": packet_id,
        "received_at": received_at,
        "device_id": payload.device_id,
    }


async def _send_ai_recommendation(payload: TelemetryPayload,
                                   packet_id: int, received_at: str) -> None:
    """
    Background task: generate AI recommendation and broadcast via WebSocket.
    This runs AFTER the HTTP ack is sent, so it never blocks the ESP32.
    """
    try:
        from ai.ollama_client import generate_recommendation
        from ai.prompt_builder import build_recommendation_prompt

        prompt = build_recommendation_prompt(payload)
        recommendation = await generate_recommendation(prompt)

        if recommendation:
            await manager.broadcast({
                "event": "ai_recommendation",
                "packet_id": packet_id,
                "received_at": received_at,
                "device_id": payload.device_id,
                "mode": payload.mode,
                "recommendation": recommendation,
            })
            logger.info(f"[AI] Recommendation sent for packet_id={packet_id}")
    except Exception as e:
        logger.debug(f"[AI] Recommendation skipped: {e}")
