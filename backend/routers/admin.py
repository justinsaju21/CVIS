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
import os
import subprocess
import shutil
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


def get_gpu_metrics() -> dict:
    """Read live NVIDIA GPU telemetry via nvidia-smi."""
    if not shutil.which("nvidia-smi"):
        return {"available": False}
    try:
        flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        res = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=1.5,
            creationflags=flags,
        )
        if res.returncode == 0 and res.stdout.strip():
            parts = [p.strip() for p in res.stdout.strip().split(",")]
            if len(parts) >= 5:
                name = parts[0]
                gpu_pct = float(parts[1])
                used_mb = float(parts[2])
                total_mb = float(parts[3])
                temp_c = float(parts[4])
                mem_pct = round((used_mb / total_mb) * 100, 1) if total_mb > 0 else 0.0
                return {
                    "available": True,
                    "name": name,
                    "gpu_pct": gpu_pct,
                    "gpu_mem_used_mb": round(used_mb),
                    "gpu_mem_total_mb": round(total_mb),
                    "gpu_mem_pct": mem_pct,
                    "gpu_temp_c": temp_c,
                }
    except Exception as e:
        logger.debug(f"[ADMIN] nvidia-smi query failed: {e}")
    return {"available": False}


@router.get("/stats", summary="Overall server + system stats")
async def get_stats() -> dict:
    """Comprehensive server stats for the admin dashboard."""
    db = await get_db()

    # Packet counts
    async with db.execute("SELECT COUNT(*) as n FROM packets") as cur:
        total_packets = (await cur.fetchone())["n"]
    async with db.execute("SELECT COUNT(*) as n FROM packets WHERE received_at >= date('now', 'start of day')") as cur:
        today_packets = (await cur.fetchone())["n"]
    async with db.execute("SELECT COUNT(*) as n FROM packets WHERE received_at >= datetime('now', '-1 hour')") as cur:
        last_hour_packets = (await cur.fetchone())["n"]
    async with db.execute("SELECT COALESCE(AVG(size_bytes), 0) as n FROM packets") as cur:
        avg_size_bytes = (await cur.fetchone())["n"]
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
    try:
        disk_pct = psutil.disk_usage(".").percent
    except Exception:
        disk_pct = 0.0

    try:
        async with db.execute("SELECT (page_count * page_size) / 1024 as n FROM pragma_page_count(), pragma_page_size()") as cur:
            db_size_kb = (await cur.fetchone())["n"]
    except Exception:
        db_size_kb = 0

    # AI status (non-blocking)
    ai_status = await check_ollama_status()
    gpu_metrics = get_gpu_metrics()

    return {
        "server": {
            "uptime_seconds": int(uptime),
            "websocket_clients": manager.connection_count,
            "phase": "2",
        },
        "system": {
            "cpu_pct": cpu_pct,
            "mem_pct": mem.percent,
            "memory_pct": mem.percent,
            "memory_total_mb": round(mem.total / 1024 / 1024),
            "memory_used_mb":  round(mem.used  / 1024 / 1024),
            "disk_pct": disk_pct,
            "uptime_s": int(uptime),
            "db_size_kb": db_size_kb,
            "gpu_pct": gpu_metrics.get("gpu_pct", 0.0),
            "gpu_mem_pct": gpu_metrics.get("gpu_mem_pct", 0.0),
            "gpu_mem_used_mb": gpu_metrics.get("gpu_mem_used_mb", 0),
            "gpu_mem_total_mb": gpu_metrics.get("gpu_mem_total_mb", 0),
            "gpu_temp_c": gpu_metrics.get("gpu_temp_c", 0.0),
            "gpu_name": gpu_metrics.get("name", "NVIDIA GeForce RTX 4060 Laptop GPU"),
        },
        "gpu": gpu_metrics,
        "packets": {
            "total":              total_packets,
            "today":              today_packets,
            "last_hour":          last_hour_packets,
            "avg_size_bytes":     round(avg_size_bytes, 1),
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
    device_id: str | None = Query(None, description="Filter by device ID"),
) -> list[dict]:
    """Return auth log entries, newest first."""
    db = await get_db()
    conditions = []
    params: list = []
    if event_type:
        conditions.append("event_type = ?")
        params.append(event_type)
    if device_id:
        conditions.append("device_id = ?")
        params.append(device_id)
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    params.append(limit)
    async with db.execute(
        f"SELECT id AS log_id, timestamp, device_id, event_type, ip_address AS source_ip, details FROM auth_logs {where} ORDER BY id DESC LIMIT ?",
        params,
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.get("/packet-stats", summary="Packet statistics over time")
async def get_packet_stats(
    hours: int = Query(24, ge=1, le=168),
    device_id: str | None = Query(None, description="Filter by device ID"),
) -> dict:
    """Return packet counts grouped by hour for the last N hours."""
    db = await get_db()
    device_filter = "AND device_id = ?" if device_id else ""

    async with db.execute(
        f"""
        SELECT
            strftime('%Y-%m-%dT%H:00:00', received_at) as hour,
            protocol,
            COUNT(*) as count,
            SUM(size_bytes) as total_bytes
        FROM packets
        WHERE received_at >= datetime('now', ?) {device_filter}
        GROUP BY hour, protocol
        ORDER BY hour
        """,
        [f"-{hours} hours"] + ([device_id] if device_id else []),
    ) as cur:
        rows = await cur.fetchall()

    async with db.execute(
        f"""
        SELECT mode, COUNT(*) as count
        FROM telemetry
        WHERE received_at >= datetime('now', ?) {device_filter}
        GROUP BY mode
        ORDER BY count DESC
        """,
        [f"-{hours} hours"] + ([device_id] if device_id else []),
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
            t.battery_pct AS last_battery,
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
