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

_last_device_mode: dict[str, str] = {}
_last_ai_time: dict[str, float] = {}
_ai_in_flight: set[str] = set()


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

    async def _record_rejected(dev_id: Optional[str], auth_st: str, reason: str, enc_m: str = "PLAIN"):
        try:
            resolved_dev_id = dev_id
            if not resolved_dev_id:
                try:
                    import json
                    parsed_raw = json.loads(raw_json)
                    resolved_dev_id = parsed_raw.get("device_id") or parsed_raw.get("_meta", {}).get("device_id")
                except Exception:
                    pass
            resolved_dev_id = resolved_dev_id or "UNKNOWN"

            sz = len(raw_json.encode("utf-8"))
            c = await db.execute(
                """
                INSERT INTO packets
                    (received_at, device_id, protocol, direction, size_bytes, status, raw_json,
                     encrypted, encryption_method, auth_status)
                VALUES (?, ?, ?, 'inbound', ?, 'rejected', ?, ?, ?, ?)
                """,
                (received_at, resolved_dev_id, protocol, sz, raw_json,
                 1 if encrypted else 0, enc_m, auth_st),
            )
            pkt_id = c.lastrowid
            await db.commit()
            await manager.broadcast({
                "event": "telemetry",
                "packet_id": pkt_id,
                "received_at": received_at,
                "protocol": protocol,
                "device_id": resolved_dev_id,
                "status": "rejected",
                "auth_status": auth_st,
                "encrypted": 1 if encrypted else 0,
                "encryption_method": enc_m,
                "mode": "Fault",
                "speed_kmh": 0,
                "battery_pct": 0,
                "battery_temp_c": 0,
                "motor_temp_c": 0,
                "range_km": 0,
                "fault_code": 999,
                "charging_rate_w": 0,
                "raw_payload": raw_json,
                "size_bytes": sz,
            })
        except Exception as ex:
            logger.error(f"[INGEST] Failed to log rejected packet: {ex}")

    # ── 1. Auth: verify API key ──────────────────────────────────────────
    device_id: Optional[str] = None
    device_secret: Optional[str] = None

    if auth_enabled:
        if not api_key:
            await _log_auth(None, "auth_fail", source_ip, "Missing API key")
            await _record_rejected(None, "fail", "Missing API key")
            raise ValueError("AUTH_FAIL: Missing API key")

        key_hash = hash_api_key(api_key)
        async with db.execute(
            "SELECT device_id, device_secret FROM devices WHERE api_key_hash = ? AND active = 1",
            (key_hash,),
        ) as cur:
            row = await cur.fetchone()

        if not row:
            await _log_auth(None, "auth_fail", source_ip, "Invalid API key")
            await _record_rejected(None, "fail", "Invalid API key")
            raise ValueError("AUTH_FAIL: Invalid API key")

        device_id = row["device_id"]
        device_secret = row["device_secret"]
        await _log_auth(device_id, "auth_ok", source_ip, "API key accepted")

    # ── 2. Decrypt if AES-GCM enabled ────────────────────────────────────
    plaintext_json = raw_json
    if encrypted:
        if not (iv and ct and tag and device_secret):
            await _record_rejected(device_id, "fail", "Missing AES-GCM fields", "AES-GCM")
            raise ValueError("DECRYPT_FAIL: Missing AES-GCM fields or device secret")
        try:
            plaintext_json = aes_gcm_decrypt(device_secret, iv, ct, tag)
            logger.debug(f"[INGEST] AES-GCM decryption OK for device={device_id}")
        except InvalidTag:
            await _log_auth(device_id, "tamper_detected", source_ip,
                            "AES-GCM tag mismatch — payload tampered or wrong key")
            await _record_rejected(device_id, "tamper_detected", "AES-GCM tag mismatch", "AES-GCM")
            raise ValueError("TAMPER: AES-GCM authentication tag invalid")

    # ── 3. HMAC verification (on plaintext) ──────────────────────────────
    if auth_enabled and hmac_signature and device_secret:
        if not verify_hmac(device_secret, plaintext_json, hmac_signature):
            await _log_auth(device_id, "tamper_detected", source_ip,
                            "HMAC-SHA256 mismatch — payload may have been tampered")
            logger.warning(f"[INGEST] HMAC FAIL device={device_id} — TAMPER DETECTED")
            await _record_rejected(device_id, "tamper_detected", "HMAC verification failed", "HMAC-SHA256")
            raise ValueError("TAMPER: HMAC signature verification failed")
        logger.debug(f"[INGEST] HMAC OK for device={device_id}")
    elif auth_enabled and not hmac_signature:
        await _log_auth(device_id, "auth_fail", source_ip,
                        "Missing HMAC signature")
        await _record_rejected(device_id, "fail", "Missing HMAC signature")
        raise ValueError("AUTH_FAIL: Missing HMAC signature")

    # ── 4. Parse + validate payload ──────────────────────────────────────
    try:
        payload = TelemetryPayload.model_validate_json(plaintext_json)
    except Exception as e:
        await _record_rejected(device_id, "fail", f"Parse fail: {e}")
        raise ValueError(f"PARSE_FAIL: {e}")

    # ── 5. Replay protection ───────────────────────────────────────
    replay_err = check_replay(payload.device_id, payload.timestamp_ms)
    if replay_err:
        await _log_auth(payload.device_id, "tamper_detected", source_ip,
                        replay_err)
        await _record_rejected(payload.device_id, "tamper_detected", replay_err)
        raise ValueError(replay_err)  # already prefixed with "REPLAY: ..."

    size_bytes = len(raw_json.encode("utf-8"))

    # Determine the encryption method label for logging/display
    if encrypted:
        enc_method = "AES-GCM"
    elif hmac_signature and device_secret:
        enc_method = "HMAC-SHA256"
    else:
        enc_method = "PLAIN"

    # ── 6. Persist raw packet ───────────────────────────────────────────
    cursor = await db.execute(
        """
        INSERT INTO packets
            (received_at, device_id, protocol, direction, size_bytes, status, raw_json,
             encrypted, encryption_method, auth_status)
        VALUES (?, ?, ?, 'inbound', ?, 'ok', ?, ?, ?, 'ok')
        """,
        (received_at, payload.device_id, protocol, size_bytes, raw_json,
         1 if encrypted else 0, enc_method),
    )
    packet_id: int = cursor.lastrowid  # type: ignore

    # ── 6. Persist structured telemetry ──────────────────────────────────
    await db.execute(
        """
        INSERT INTO telemetry
            (packet_id, received_at, device_id, schema_version,
             mode, speed_kmh, battery_pct, battery_temp_c, motor_temp_c,
             range_km, fault_code, charging_rate_w,
             ambient_temp_c, headwind_kmh, road_gradient_pct, tire_pressure_psi,
             cabin_climate_w, max_cell_voltage_delta)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            packet_id, received_at, payload.device_id, payload.schema_version,
            payload.mode, payload.speed_kmh, payload.battery_pct,
            payload.battery_temp_c, payload.motor_temp_c,
            payload.range_km, payload.fault_code, payload.charging_rate_w,
            payload.ambient_temp_c, payload.headwind_kmh, payload.road_gradient_pct,
            payload.tire_pressure_psi, payload.cabin_climate_w, payload.max_cell_voltage_delta,
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
        "encrypted": 1 if encrypted else 0,
        "encryption_method": enc_method,
        "raw_payload": raw_json,
        "size_bytes": size_bytes,
        **payload.model_dump(),
    }
    await manager.broadcast(broadcast_payload)

    # ── 8. Fire-and-forget AI recommendation ─────────────────────────────
    try:
        import asyncio
        import time
        from routers.control import is_ai_enabled

        now_ts = time.time()
        prev_mode = _last_device_mode.get(payload.device_id)
        last_time = _last_ai_time.get(payload.device_id, 0.0)
        mode_changed = (prev_mode != payload.mode)
        time_elapsed = (now_ts - last_time) >= 20.0

        _last_device_mode[payload.device_id] = payload.mode

        if is_ai_enabled(payload.device_id) and (mode_changed or time_elapsed) and (payload.device_id not in _ai_in_flight):
            _ai_in_flight.add(payload.device_id)
            _last_ai_time[payload.device_id] = now_ts
            asyncio.create_task(
                _send_ai_recommendation(payload, packet_id, received_at, prev_mode)
            )
        else:
            logger.debug("[INGEST] AI recommendation skipped (throttled or disabled)")
    except ImportError:
        pass

    return {
        "status": "ok",
        "packet_id": packet_id,
        "received_at": received_at,
        "device_id": payload.device_id,
    }


async def _send_ai_recommendation(
    payload: TelemetryPayload,
    packet_id: int,
    received_at: str,
    prev_mode: str | None = None,
) -> None:
    """
    Background task: generate AI recommendation and broadcast via WebSocket.
    This runs AFTER the HTTP ack is sent, so it never blocks the ESP32.

    Updated (Quick Wins ①–④):
      - Fetches last 5 history rows for trend delta context (②)
      - Passes prev_mode for mode-transition detection (④)
      - Uses (system, user) prompt tuple with /api/chat (①)
      - Broadcasts severity alongside recommendation (③)
    """
    try:
        from ai.ollama_client import generate_recommendation
        from ai.prompt_builder import build_recommendation_prompt

        # ② Fetch recent history for trend context
        db = await get_db()
        async with db.execute(
            """
            SELECT mode, speed_kmh, battery_pct, battery_temp_c,
                   motor_temp_c, fault_code, received_at, ambient_temp_c,
                   headwind_kmh, road_gradient_pct, tire_pressure_psi,
                   cabin_climate_w, max_cell_voltage_delta
            FROM telemetry
            WHERE device_id = ?
            ORDER BY id DESC LIMIT 5
            """,
            (payload.device_id,),
        ) as cur:
            history_rows = await cur.fetchall()
        history = [dict(r) for r in history_rows]

        # ① build returns (system, user); ②③④ all applied inside builder
        system, user = build_recommendation_prompt(payload, history, prev_mode)
        result = await generate_recommendation(system, user)

        if result:
            severity, recommendation = result   # ③ unpack severity
            await manager.broadcast({
                "event":          "ai_recommendation",
                "packet_id":      packet_id,
                "received_at":    received_at,
                "device_id":      payload.device_id,
                "mode":           payload.mode,
                "severity":       severity,          # ③ NEW field
                "recommendation": recommendation,
            })
            logger.info(
                f"[AI] Recommendation sent for packet_id={packet_id} "
                f"severity={severity}"
            )
    except Exception as e:
        logger.debug(f"[AI] Recommendation skipped: {e}")
    finally:
        _ai_in_flight.discard(payload.device_id)
