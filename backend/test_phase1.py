#!/usr/bin/env python3
"""
CVIS — test_phase1.py
----------------------
Quick smoke test for Phase 1. Tests:
  1. Health endpoint
  2. Telemetry POST (valid payload, all 8 modes)
  3. Telemetry POST (invalid payload — bad mode, out-of-range values)
  4. Recent telemetry GET
  5. WebSocket receive (backfill + live broadcast)

Run from backend/ directory with the server running:
  python test_phase1.py

Or run against a custom host:
  python test_phase1.py --host 192.168.1.50 --port 8000
"""

import argparse
import asyncio
import json
import os
import sys
import time
import urllib.request
import urllib.error

# Force UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Optional: websockets library for WS test
try:
    import websockets
    WS_AVAILABLE = True
except ImportError:
    WS_AVAILABLE = False
    print("[WARN] 'websockets' not installed — WebSocket test will be skipped.")
    print("       Install with: pip install websockets")

# ─── Config ────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--host", default="127.0.0.1")
parser.add_argument("--port", default="8000")
args = parser.parse_args()

BASE = f"http://{args.host}:{args.port}"
WS   = f"ws://{args.host}:{args.port}/ws"

PASS = "[PASS]"
FAIL = "[FAIL]"
WARN = "[WARN]"

passed = 0
failed = 0


def http_post(path: str, data: dict) -> tuple[int, dict]:
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def http_get(path: str) -> tuple[int, object]:
    req = urllib.request.Request(f"{BASE}{path}")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def check(label: str, condition: bool, detail: str = "") -> None:
    global passed, failed
    if condition:
        passed += 1
        print(f"  {PASS} {label}")
    else:
        failed += 1
        print(f"  {FAIL} {label}" + (f" — {detail}" if detail else ""))


# ── 1. Health check ─────────────────────────────────────────────────────────
print("\n[1] Health check")
try:
    code, body = http_get("/health")
    check("GET /health returns 200", code == 200, f"got {code}")
    check("status == ok", body.get("status") == "ok", str(body))
    check("phase == 1", body.get("phase") == 1, str(body))
except Exception as e:
    print(f"  {FAIL} Cannot reach server at {BASE}: {e}")
    print("       Make sure the backend is running: uvicorn main:app --reload")
    sys.exit(1)


# ── 2. Valid telemetry POST — all 8 modes ───────────────────────────────────
print("\n[2] Telemetry POST — all 8 modes")
MODES = [
    "Healthy", "Eco", "Sport", "Heavy Traffic",
    "Low Battery", "Battery Overheating", "Charging", "Motor Fault",
]

for mode in MODES:
    payload = {
        "device_id": "TEST-001",
        "schema_version": "1.0",
        "timestamp_ms": int(time.time() * 1000),
        "mode": mode,
        "speed_kmh": 60.0,
        "battery_pct": 75.0,
        "battery_temp_c": 30.0,
        "motor_temp_c": 45.0,
        "range_km": 200.0,
        "fault_code": 0,
        "charging_rate_w": 0.0,
    }
    code, body = http_post("/api/v1/telemetry", payload)
    check(
        f"POST mode='{mode}' → 200 + packet_id",
        code == 200 and "packet_id" in body,
        f"code={code} body={body}",
    )


# ── 3. Invalid payload rejection ────────────────────────────────────────────
print("\n[3] Invalid payload rejection")

# Bad mode
code, body = http_post("/api/v1/telemetry", {
    "device_id": "TEST-001",
    "schema_version": "1.0",
    "timestamp_ms": 1000,
    "mode": "INVALID_MODE",
})
check("Bad mode → 422", code == 422, f"got {code}")

# Missing required field (device_id)
code, body = http_post("/api/v1/telemetry", {
    "schema_version": "1.0",
    "timestamp_ms": 1000,
    "mode": "Healthy",
})
check("Missing device_id → 422", code == 422, f"got {code}")

# Out-of-range battery
code, body = http_post("/api/v1/telemetry", {
    "device_id": "TEST-001",
    "schema_version": "1.0",
    "timestamp_ms": 1000,
    "mode": "Healthy",
    "battery_pct": 999.0,   # >100
})
check("battery_pct=999 → 422", code == 422, f"got {code}")


# ── 4. Recent telemetry GET ──────────────────────────────────────────────────
print("\n[4] GET /api/v1/telemetry/recent")
code, body = http_get("/api/v1/telemetry/recent?limit=5")
check("GET recent → 200", code == 200, f"got {code}")
check("Returns a list", isinstance(body, list), str(type(body)))
check("Has records (we just posted)", len(body) > 0, f"got {len(body)} records")


# ── 5. WebSocket backfill ────────────────────────────────────────────────────
print("\n[5] WebSocket — backfill on connect")

if WS_AVAILABLE:
    async def test_ws():
        async with websockets.connect(WS, open_timeout=5) as ws:
            raw = await asyncio.wait_for(ws.recv(), timeout=5)
            msg = json.loads(raw)
            check("WS receives 'backfill' event on connect", msg.get("event") == "backfill",
                  f"got event={msg.get('event')}")
            records = msg.get("records", [])
            check("Backfill contains records", len(records) > 0, f"got {len(records)}")

            # Post one more packet and see if WS delivers it
            http_post("/api/v1/telemetry", {
                "device_id": "TEST-WS",
                "schema_version": "1.0",
                "timestamp_ms": int(time.time() * 1000),
                "mode": "Sport",
                "speed_kmh": 110.0,
                "battery_pct": 65.0,
                "battery_temp_c": 35.0,
                "motor_temp_c": 75.0,
                "range_km": 180.0,
                "fault_code": 0,
                "charging_rate_w": 0.0,
            })
            raw2 = await asyncio.wait_for(ws.recv(), timeout=5)
            msg2 = json.loads(raw2)
            check("WS delivers live telemetry event", msg2.get("event") == "telemetry",
                  f"got event={msg2.get('event')}")

    asyncio.run(test_ws())
else:
    print(f"  {WARN} WebSocket test skipped (install websockets: pip install websockets)")


# ── Summary ──────────────────────────────────────────────────────────────────
total = passed + failed
print(f"\n{'─' * 50}")
print(f"Results: {passed}/{total} passed", end="")
if failed == 0:
    print(f"  {PASS} ALL PASSED")
else:
    print(f"  {FAIL} {failed} FAILED")
print()
sys.exit(0 if failed == 0 else 1)
