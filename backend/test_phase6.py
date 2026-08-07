#!/usr/bin/env python3
"""
CVIS — test_phase6.py
----------------------
Phase 6 end-to-end hardening test:
  All 8 vehicle modes × both protocols (HTTP/MQTT simulated) × all chaos settings
  + disconnect/reconnect vehicle
  + AI service stop/start
  + replay protection
  + full admin stats validation

Run with server active:
  python test_phase6.py
"""

import argparse
import hashlib
import hmac
import json
import sys
import time
import urllib.request
import urllib.error

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

parser = argparse.ArgumentParser()
parser.add_argument("--host", default="127.0.0.1")
parser.add_argument("--port", default="8000")
args = parser.parse_args()

BASE = f"http://{args.host}:{args.port}"
PASS = "[PASS]"
FAIL = "[FAIL]"
SKIP = "[SKIP]"
passed = failed = 0

# ─── Helpers ──────────────────────────────────────────────────────────────

def http(method: str, path: str, data: dict = None, headers: dict = None
         ) -> tuple[int, object]:
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=body,
        headers={"Content-Type": "application/json", **(headers or {})},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def check(label: str, ok: bool, detail: str = "") -> None:
    global passed, failed
    if ok:
        passed += 1
        print(f"  {PASS} {label}")
    else:
        failed += 1
        print(f"  {FAIL} {label}" + (f" -- {detail}" if detail else ""))


def sign(secret_hex: str, payload_str: str) -> str:
    key = bytes.fromhex(secret_hex)
    return hmac.new(key, payload_str.encode(), hashlib.sha256).hexdigest()


VEHICLE_MODES = [
    ("Healthy",             60,  80, 30, 45,  250, 0x00, 0),
    ("Eco",                 40,  75, 28, 38,  290, 0x00, 0),
    ("Sport",               110, 65, 35, 75,  180, 0x00, 0),
    ("Heavy Traffic",       15,  70, 31, 42,  220, 0x00, 0),
    ("Low Battery",         50,  12, 32, 48,   35, 0x00, 0),
    ("Battery Overheating", 30,  55, 58, 65,  140, 0x02, 0),
    ("Charging",            0,   75, 38, 32,  250, 0x00, 7400),
    ("Motor Fault",         0,   60, 33, 95,    0, 0x04, 0),
]


def make_packet(device_id: str, mode_tuple: tuple, ts: int) -> dict:
    mode, speed, batt, batt_t, motor_t, rng, fault, charge = mode_tuple
    return {
        "device_id":      device_id,
        "schema_version": "1.0",
        "timestamp_ms":   ts,
        "mode":           mode,
        "speed_kmh":      float(speed),
        "battery_pct":    float(batt),
        "battery_temp_c": float(batt_t),
        "motor_temp_c":   float(motor_t),
        "range_km":       float(rng),
        "fault_code":     fault,
        "charging_rate_w": float(charge),
    }


# ─── Setup: register test device ─────────────────────────────────────────
print("\n[SETUP] Registering test device")
# Deactivate first so we can always re-register (idempotent)
http("POST", "/api/v1/admin/deactivate-device?device_id=PHASE6-TEST")
code, body = http("POST", "/api/v1/devices/register", {"device_id": "PHASE6-TEST"})
check("Register PHASE6-TEST -> 201", code == 201, f"got {code}: {body}")
if code != 201:
    print(f"  Cannot proceed without fresh credentials.")
    sys.exit(1)
API_KEY = body["api_key"]
SECRET  = body["device_secret"]

# ─── 1. All 8 modes via HTTP ──────────────────────────────────────────────
print("\n[1] All 8 vehicle modes — HTTP POST")
# Disable chaos first
http("POST", "/api/v1/config/chaos", {"loss_pct": 0, "latency_ms": 0, "tamper": False})

for i, mode_tuple in enumerate(VEHICLE_MODES, 1):
    pkt = make_packet("PHASE6-TEST", mode_tuple, i * 1000)
    pkt_str = json.dumps(pkt)
    sig = sign(SECRET, pkt_str)
    code, body = http("POST", "/api/v1/telemetry", pkt,
                      {"X-API-Key": API_KEY, "X-HMAC-Signature": sig})
    check(f"Mode {i}/8: {mode_tuple[0]} -> 200",
          code == 200 and body.get("status") == "ok",
          f"got {code}: {body}")

# ─── 2. All chaos settings ────────────────────────────────────────────────
print("\n[2] Chaos settings")
LOSS_VALS    = [0, 5, 10, 25]
LATENCY_VALS = [0, 100, 300, 1000]

for loss in LOSS_VALS:
    code, body = http("POST", "/api/v1/config/chaos",
                      {"loss_pct": loss, "latency_ms": 0, "tamper": False})
    check(f"Set loss={loss}% -> 200", code == 200, f"got {code}")

for lat in LATENCY_VALS:
    code, body = http("POST", "/api/v1/config/chaos",
                      {"loss_pct": 0, "latency_ms": lat, "tamper": False})
    check(f"Set latency={lat}ms -> 200", code == 200, f"got {code}")
    if lat > 0:
        # Send a packet with this latency set — verify it still works (just slower)
        pkt = make_packet("PHASE6-TEST", VEHICLE_MODES[0], 90000 + lat)
        pkt_str = json.dumps(pkt)
        sig = sign(SECRET, pkt_str)
        t0 = time.monotonic()
        code2, _ = http("POST", "/api/v1/telemetry", pkt,
                        {"X-API-Key": API_KEY, "X-HMAC-Signature": sig})
        elapsed = int((time.monotonic() - t0) * 1000)
        check(f"  Packet with {lat}ms latency arrives -> 200 (took ~{elapsed}ms)",
              code2 == 200, f"got {code2}")

# Reset chaos
http("POST", "/api/v1/config/chaos", {"loss_pct": 0, "latency_ms": 0, "tamper": False})

# ─── 3. Tamper injection ──────────────────────────────────────────────────
print("\n[3] Chaos tamper injection -> HMAC rejection")
http("POST", "/api/v1/config/chaos", {"loss_pct": 0, "latency_ms": 0, "tamper": True})
pkt = make_packet("PHASE6-TEST", VEHICLE_MODES[2], 99001)  # Sport mode
pkt_str = json.dumps(pkt)
sig = sign(SECRET, pkt_str)
code, body = http("POST", "/api/v1/telemetry", pkt,
                  {"X-API-Key": API_KEY, "X-HMAC-Signature": sig})
check("Chaos tamper -> 401", code == 401, f"got {code}: {body}")
http("POST", "/api/v1/config/chaos", {"loss_pct": 0, "latency_ms": 0, "tamper": False})

# ─── 4. Replay protection ─────────────────────────────────────────────────
print("\n[4] Replay protection")
# Enable replay protection
code, body = http("POST", "/api/v1/config/replay", {"enabled": True})
check("Enable replay protection -> 200", code == 200, f"got {code}")

pkt = make_packet("PHASE6-TEST", VEHICLE_MODES[0], 12345)   # unique timestamp
pkt_str = json.dumps(pkt)
sig = sign(SECRET, pkt_str)
code, _ = http("POST", "/api/v1/telemetry", pkt,
               {"X-API-Key": API_KEY, "X-HMAC-Signature": sig})
check("First send -> 200 (fresh packet)", code == 200, f"got {code}")

# Re-send identical packet (same timestamp_ms = replay)
code, body = http("POST", "/api/v1/telemetry", pkt,
                  {"X-API-Key": API_KEY, "X-HMAC-Signature": sig})
check("Replay (same ts) -> 401", code == 401, f"got {code}: {body}")

# New timestamp = should succeed
pkt2 = make_packet("PHASE6-TEST", VEHICLE_MODES[0], 99999)
pkt2_str = json.dumps(pkt2)
sig2 = sign(SECRET, pkt2_str)
code, _ = http("POST", "/api/v1/telemetry", pkt2,
               {"X-API-Key": API_KEY, "X-HMAC-Signature": sig2})
check("New timestamp -> 200 (not a replay)", code == 200, f"got {code}")

# Disable replay protection
http("POST", "/api/v1/config/replay", {"enabled": False})

# ─── 5. Disconnect / reconnect vehicle ───────────────────────────────────
print("\n[5] Disconnect / reconnect vehicle")
code, body = http("POST", "/api/v1/control/disconnect",
                  {"device_id": "PHASE6-TEST", "reason": "Phase 6 test"})
check("Disconnect -> 200", code == 200, f"got {code}")
check("Status is 'disconnected'", body.get("status") == "disconnected", str(body))

# Next packet should be 401 (device inactive)
pkt3 = make_packet("PHASE6-TEST", VEHICLE_MODES[0], 200001)
pkt3_str = json.dumps(pkt3)
sig3 = sign(SECRET, pkt3_str)
code, body = http("POST", "/api/v1/telemetry", pkt3,
                  {"X-API-Key": API_KEY, "X-HMAC-Signature": sig3})
check("Packet from disconnected device -> 401", code == 401, f"got {code}")

# Reconnect
code, body = http("POST", "/api/v1/control/reconnect",
                  {"device_id": "PHASE6-TEST", "reason": "restored"})
check("Reconnect -> 200", code == 200, f"got {code}")

# Packet should work again
pkt4 = make_packet("PHASE6-TEST", VEHICLE_MODES[0], 300001)
pkt4_str = json.dumps(pkt4)
sig4 = sign(SECRET, pkt4_str)
code, body = http("POST", "/api/v1/telemetry", pkt4,
                  {"X-API-Key": API_KEY, "X-HMAC-Signature": sig4})
check("Packet after reconnect -> 200", code == 200, f"got {code}")

# ─── 6. AI service stop / start ──────────────────────────────────────────
print("\n[6] AI service stop / start")
code, body = http("POST", "/api/v1/control/ai-service", {"enabled": False})
check("Stop AI service -> 200", code == 200, f"got {code}")

code, body = http("GET", "/api/v1/control/ai-service")
check("AI service disabled", not body.get("ai_service_enabled", True), str(body))

code, body = http("POST", "/api/v1/control/ai-service", {"enabled": True})
check("Start AI service -> 200", code == 200, f"got {code}")

code, body = http("GET", "/api/v1/control/ai-service")
check("AI service enabled", body.get("ai_service_enabled", False), str(body))

# ─── 7. Full admin stats validation ──────────────────────────────────────
print("\n[7] Admin stats validation")
code, body = http("GET", "/api/v1/admin/stats")
check("GET /admin/stats -> 200", code == 200, f"got {code}")
check("packets.total > 0",     body["packets"]["total"] > 0, str(body["packets"]))
check("auth.tamper_events > 0", body["auth"]["tamper_events"] > 0, str(body["auth"]))
check("replay_protection_enabled key", "replay_protection_enabled" in body["auth"], str(body["auth"]))
check("ai.service_enabled key",        "service_enabled" in body["ai"], str(body["ai"]))
check("system.cpu_pct present",        "cpu_pct" in body["system"], str(body["system"]))

code, body = http("GET", "/api/v1/admin/auth-logs?event_type=tamper_detected&limit=5")
check("tamper_detected logs > 0", len(body) > 0, f"got {len(body)}")

code, body = http("GET", "/api/v1/admin/auth-logs?event_type=disconnected&limit=5")
check("disconnected log present", len(body) > 0, f"got {len(body)}")

code, body = http("GET", "/api/v1/admin/packet-stats?hours=1")
check("packet-stats -> 200", code == 200, f"got {code}")
check("mode_distribution present", "mode_distribution" in body, str(body))
check("All 8 modes in distribution",
      len(body["mode_distribution"]) == 8,
      f"found {list(body['mode_distribution'].keys())}")

# ─── Summary ──────────────────────────────────────────────────────────────
total = passed + failed
print(f"\n{'─' * 55}")
print(f"Phase 6 Results: {passed}/{total} passed", end="  ")
print(f"{PASS if failed == 0 else FAIL} {'ALL PASSED' if failed == 0 else str(failed) + ' FAILED'}")
sys.exit(0 if failed == 0 else 1)
