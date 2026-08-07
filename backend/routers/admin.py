"""
CVIS Backend — routers/admin.py
---------------------------------
Admin console backend endpoints — server stats, packet statistics,
auth logs, and system health.

Design rationale: The admin router exposes aggregated views of the SQLite
logs built up by the telemetry ingest pipeline. All data is real — there are
no mock counters. CPU and memory usage are read via psutil so the admin panel
shows live system load during demos.
"""

import logging
from datetime import datetime, timezone

import psutil
from fastapi import APIRouter, Query

from ai.ollama_client import check_ollama_status
from db import get_db
from middleware.chaos import get_chaos_stats
from ws_manager import manager
import auth as auth_module
from replay_protection import is_replay_protection_enabled
from routers.control import is_ai_enabled

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])
logger = logging.getLogger("cvis.admin")

_start_time = datetime.now(timezone.utc)


@router.get("/stats", summary="Overall server + system stats")
async def get_stats() -> dict:
    """Comprehensive server stats for the admin dashboard."""
    db = await get_db()

    # Packet counts
    async with db.execute("SELECT COUNT(*) as n FROM packets") as cur:
        total_packets = (await cur.fetchone())["n"]
    async with db.execute("SELECT COUNT(*) as n FROM packets WHERE status='ok'") as cur:
        ok_packets = (await cur.fetchone())["n"]
    async with db.execute("SELECT COUNT(*) as n FROM packets WHERE status='rejected'") as cur:
        rejected_packets = (await cur.fetchone())["n"]

    # Auth stats
    async with db.execute(
        "SELECT COUNT(*) as n FROM auth_logs WHERE event_type='auth_fail'"
    ) as cur:
        auth_failures = (await cur.fetchone())["n"]
    async with db.execute(
        "SELECT COUNT(*) as n FROM auth_logs WHERE event_type='tamper_detected'"
    ) as cur:
        tamper_events = (await cur.fetchone())["n"]

    # Device counts
    async with db.execute("SELECT COUNT(*) as n FROM devices WHERE active=1") as cur:
        active_devices = (await cur.fetchone())["n"]

    # Protocol breakdown
    async with db.execute(
        "SELECT protocol, COUNT(*) as n FROM packets GROUP BY protocol"
    ) as cur:
        proto_rows = await cur.fetchall()
    protocol_breakdown = {r["protocol"]: r["n"] for r in proto_rows}

    # System resources
    cpu_pct = psutil.cpu_percent(interval=0.1)
    mem     = psutil.virtual_memory()
    uptime  = (datetime.now(timezone.utc) - _start_time).total_seconds()

    # AI status (non-blocking)
    ai_status = await check_ollama_status()

    return {
        "server": {
            "uptime_seconds": int(uptime),
            "websocket_clients": manager.connection_count,
            "phase": "2",
        },
        "system": {
            "cpu_pct": cpu_pct,
            "memory_total_mb": round(mem.total / 1024 / 1024),
            "memory_used_mb":  round(mem.used  / 1024 / 1024),
            "memory_pct":      mem.percent,
        },
        "packets": {
            "total":              total_packets,
            "ok":                 ok_packets,
            "rejected":           rejected_packets,
            "protocol_breakdown": protocol_breakdown,
        },
        "auth": {
            "active_devices":            active_devices,
            "auth_failures":             auth_failures,
            "tamper_events":             tamper_events,
            "auth_enabled":              auth_module.is_auth_enabled(),
            "replay_protection_enabled": is_replay_protection_enabled(),
        },
        "ai": {**ai_status, "service_enabled": is_ai_enabled()},
        "chaos": get_chaos_stats(),
    }


@router.get("/auth-logs", summary="Auth and tamper event log")
async def get_auth_logs(
    limit: int = Query(50, ge=1, le=500),
    event_type: str | None = Query(None, description="Filter: auth_ok|auth_fail|tamper_detected|registered|no_auth"),
) -> list[dict]:
    """Return auth log entries, newest first."""
    db = await get_db()
    if event_type:
        async with db.execute(
            "SELECT id AS log_id, timestamp, device_id, event_type, ip_address AS source_ip, details FROM auth_logs WHERE event_type = ? ORDER BY id DESC LIMIT ?",
            (event_type, limit),
        ) as cur:
            rows = await cur.fetchall()
    else:
        async with db.execute(
            "SELECT id AS log_id, timestamp, device_id, event_type, ip_address AS source_ip, details FROM auth_logs ORDER BY id DESC LIMIT ?",
            (limit,),
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.get("/packet-stats", summary="Packet statistics over time")
async def get_packet_stats(hours: int = Query(24, ge=1, le=168)) -> dict:
    """Return packet counts grouped by hour for the last N hours."""
    db = await get_db()

    # Packets per hour
    async with db.execute(
        """
        SELECT
            strftime('%Y-%m-%dT%H:00:00', received_at) as hour,
            protocol,
            COUNT(*) as count,
            SUM(size_bytes) as total_bytes
        FROM packets
        WHERE received_at >= datetime('now', ?)
        GROUP BY hour, protocol
        ORDER BY hour
        """,
        (f"-{hours} hours",),
    ) as cur:
        rows = await cur.fetchall()

    # Mode distribution
    async with db.execute(
        """
        SELECT mode, COUNT(*) as count
        FROM telemetry
        WHERE received_at >= datetime('now', ?)
        GROUP BY mode
        ORDER BY count DESC
        """,
        (f"-{hours} hours",),
    ) as cur:
        mode_rows = await cur.fetchall()

    return {
        "period_hours": hours,
        "packets_per_hour": [dict(r) for r in rows],
        "mode_distribution": {r["mode"]: r["count"] for r in mode_rows},
    }


@router.get("/devices", summary="Connected device status")
async def get_devices() -> list[dict]:
    """Return all registered devices with their last-seen telemetry."""
    db = await get_db()
    async with db.execute(
        """
        SELECT
            d.device_id,
            d.registered_at,
            d.active,
            t.mode AS last_mode,
            t.battery_pct AS last_battery_pct,
            t.received_at AS last_seen,
            t.fault_code  AS last_fault_code
        FROM devices d
        LEFT JOIN (
            SELECT device_id, mode, battery_pct, received_at, fault_code,
                   ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY id DESC) as rn
            FROM telemetry
        ) t ON t.device_id = d.device_id AND t.rn = 1
        ORDER BY d.registered_at DESC
        """,
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.post("/deactivate-device", summary="Deactivate a device (admin only — for re-registration)")
async def admin_deactivate_device(device_id: str) -> dict:
    """
    Deactivate a device so it can be re-registered.
    Used by test scripts to reset state without dropping the DB.
    """
    db = await get_db()
    await db.execute("UPDATE devices SET active = 0 WHERE device_id = ?", (device_id,))
    await db.commit()
    return {"device_id": device_id, "status": "deactivated"}


@router.get("/error-log", summary="Failed packets and error events")
async def get_error_log(limit: int = Query(50, ge=1, le=500)) -> list[dict]:
    """Return packets with non-ok status."""
    db = await get_db()
    async with db.execute(
        """
        SELECT id, received_at, device_id, protocol, status, size_bytes, raw_json
        FROM packets
        WHERE status != 'ok'
        ORDER BY id DESC LIMIT ?
        """,
        (limit,),
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]
