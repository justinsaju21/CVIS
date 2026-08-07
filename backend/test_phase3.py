#!/usr/bin/env python3
"""
CVIS — test_phase3.py
----------------------
Phase 3 smoke test: Ollama AI recommendation + chat endpoints.

Run with server active AND Ollama running:
  ollama serve   (in a separate terminal)
  ollama pull llama3.2:3b

Then:
  python test_phase3.py
"""

import argparse
import json
import sys
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


def http(method: str, path: str, data: dict = None) -> tuple[int, object]:
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
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


# ─── 1. AI Status ─────────────────────────────────────────────────────────
print("\n[1] AI Status")
code, body = http("GET", "/api/v1/ai/status")
check("GET /ai/status -> 200", code == 200, f"got {code}")

running = body.get("running", False)
if not running:
    print(f"  {SKIP} Ollama not running — skipping live AI tests")
    print("  To enable: ollama serve  (in a separate terminal)")
    print("             ollama pull llama3.2:3b")
    print(f"\n--- {passed}/{passed+failed} passed (AI tests skipped) ---")
    sys.exit(0)

model_available = body.get("model_available", False)
check("Required model available", model_available, f"available: {body.get('available_models', [])}")
if not model_available:
    print(f"  Run: ollama pull {body.get('model', 'llama3.2:3b')}")

# ─── 2. Ensure we have a device with telemetry ────────────────────────────
print("\n[2] Ensure test device has recent telemetry")
# Disable auth so we can post without credentials
http("POST", "/api/v1/config/auth", {"enabled": False})
test_modes = ["Healthy", "Battery Overheating", "Motor Fault"]
for mode in test_modes:
    http("POST", "/api/v1/telemetry", {
        "device_id": "AI-TEST-001",
        "schema_version": "1.0",
        "timestamp_ms": 0,
        "mode": mode,
        "speed_kmh": 60,
        "battery_pct": 55 if mode == "Battery Overheating" else 80,
        "battery_temp_c": 58 if mode == "Battery Overheating" else 30,
        "motor_temp_c": 95 if mode == "Motor Fault" else 65 if mode == "Battery Overheating" else 45,
        "range_km": 0 if mode == "Motor Fault" else 140,
        "fault_code": 0x02 if mode == "Battery Overheating" else (0x04 if mode == "Motor Fault" else 0),
        "charging_rate_w": 0,
    })
http("POST", "/api/v1/config/auth", {"enabled": True})
print(f"  Seeded {len(test_modes)} telemetry records for AI-TEST-001")

# ─── 3. On-demand recommendation ──────────────────────────────────────────
print("\n[3] AI Recommendation (on-demand)")
code, body = http("POST", "/api/v1/ai/recommendation", {"device_id": "AI-TEST-001"})
check("POST /ai/recommendation -> 200", code == 200, f"got {code}: {body}")
if code == 200:
    rec = body.get("recommendation", "")
    check("recommendation is non-empty string", len(rec) > 20, f"len={len(rec)}")
    check("recommendation is a string (not labels)", isinstance(rec, str), str(type(rec)))
    # Check it's not just a label (should have multiple sentences)
    check("recommendation appears multi-sentence", "." in rec, repr(rec[:100]))
    print(f"  Sample: {rec[:120]}...")

# ─── 4. Driver chat ───────────────────────────────────────────────────────
print("\n[4] Driver chat")
code, body = http("POST", "/api/v1/ai/chat", {
    "device_id": "AI-TEST-001",
    "message": "My battery temperature seems high — should I be worried?",
})
check("POST /ai/chat -> 200", code == 200, f"got {code}: {body}")
if code == 200:
    reply = body.get("reply", "")
    check("reply is non-empty", len(reply) > 20, f"len={len(reply)}")
    print(f"  Question: {body.get('message', '')}")
    print(f"  Reply: {reply[:150]}...")

# ─── 5. Chat with Motor Fault context ────────────────────────────────────
print("\n[5] Contextual chat — Motor Fault mode")
code, body = http("POST", "/api/v1/ai/chat", {
    "device_id": "AI-TEST-001",
    "message": "Can I still drive? What should I do right now?",
})
check("Motor fault chat -> 200", code == 200, f"got {code}")
if code == 200:
    reply = body.get("reply", "")
    check("Reply is contextual (non-empty)", len(reply) > 20, f"len={len(reply)}")
    print(f"  Reply: {reply[:150]}...")

# ─── 6. 404 on unknown device ─────────────────────────────────────────────
print("\n[6] Unknown device -> 404")
code, body = http("POST", "/api/v1/ai/recommendation", {"device_id": "NONEXISTENT"})
check("Unknown device -> 404", code == 404, f"got {code}")

print(f"\n--- {passed}/{passed+failed} passed ---")
sys.exit(0 if failed == 0 else 1)
