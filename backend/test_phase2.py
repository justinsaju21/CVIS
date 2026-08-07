#!/usr/bin/env python3
"""
CVIS — test_phase2.py
----------------------
Phase 2 smoke test: Auth, HMAC, AES-GCM, device registration,
config endpoints (protocol/encryption/auth/chaos).

Run with server active:
  python test_phase2.py
"""

import argparse
import asyncio
import hashlib
import hmac
import json
import os
import sys
import urllib.request
import urllib.error

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Optional for AES-GCM
try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    CRYPTO_OK = True
except ImportError:
    CRYPTO_OK = False

parser = argparse.ArgumentParser()
parser.add_argument("--host", default="127.0.0.1")
parser.add_argument("--port", default="8000")
args = parser.parse_args()

BASE = f"http://{args.host}:{args.port}"
PASS = "[PASS]"
FAIL = "[FAIL]"
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
        with urllib.request.urlopen(req, timeout=8) as r:
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
        print(f"  {FAIL} {label}" + (f" — {detail}" if detail else ""))

def sign_hmac(secret_hex: str, payload: str) -> str:
    key = bytes.fromhex(secret_hex)
    return hmac.new(key, payload.encode(), hashlib.sha256).hexdigest()

def aes_gcm_encrypt(secret_hex: str, plaintext: str) -> dict:
    key = bytes.fromhex(secret_hex)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ct_tag = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return {"iv": nonce.hex(), "ct": ct_tag[:-16].hex(), "tag": ct_tag[-16:].hex()}

GOOD_PAYLOAD = {
    "device_id": "TEST-001",
    "schema_version": "1.0",
    "timestamp_ms": 12345,
    "mode": "Healthy",
    "speed_kmh": 60.0,
    "battery_pct": 80.0,
    "battery_temp_c": 30.0,
    "motor_temp_c": 45.0,
    "range_km": 250.0,
    "fault_code": 0,
    "charging_rate_w": 0.0,
}

# ─── Test 1: Device registration ──────────────────────────────────────────
print("\n[1] Device registration")
code, body = http("POST", "/api/v1/devices/register", {"device_id": "TEST-001"})
# 201 = new; 409 = already registered (OK for repeated test runs)
check("Register TEST-001 → 201 or 409", code in (201, 409), f"got {code}")

if code == 201:
    API_KEY       = body["api_key"]
    DEVICE_SECRET = body["device_secret"]
    check("api_key in response",       "api_key"       in body, str(body))
    check("device_secret in response", "device_secret" in body, str(body))
else:
    # Already registered — re-register by deactivating first (skip for test)
    # Just use placeholder values and test auth failures
    API_KEY       = "0" * 64
    DEVICE_SECRET = "0" * 64
    print(f"  [NOTE] Device already registered. Using dummy credentials for remaining tests.")

# ─── Test 2: Authenticated telemetry POST ────────────────────────────────
print("\n[2] Telemetry POST with valid auth + HMAC")
payload_str = json.dumps(GOOD_PAYLOAD)
hmac_sig    = sign_hmac(DEVICE_SECRET, payload_str)
code, body  = http("POST", "/api/v1/telemetry", GOOD_PAYLOAD,
                   {"X-API-Key": API_KEY, "X-HMAC-Signature": hmac_sig})
if code == 201 or (API_KEY != "0" * 64):
    check("Auth+HMAC telemetry → 200 + packet_id",
          code == 200 and "packet_id" in body,
          f"code={code} body={body}")
else:
    check("Auth+HMAC (dummy creds) → 401", code == 401, f"got {code}")

# ─── Test 3: Missing API key → 401 ──────────────────────────────────────
print("\n[3] Auth rejection")
code, body = http("POST", "/api/v1/telemetry", GOOD_PAYLOAD)
check("No X-API-Key → 401", code == 401, f"got {code}")

# Bad API key → 401
code, body = http("POST", "/api/v1/telemetry", GOOD_PAYLOAD,
                  {"X-API-Key": "deadbeef" * 8})
check("Bad X-API-Key → 401", code == 401, f"got {code}")

# ─── Test 4: Tampered HMAC → 401 ─────────────────────────────────────────
print("\n[4] HMAC tamper detection")
if API_KEY != "0" * 64:
    tampered_payload = {**GOOD_PAYLOAD, "battery_pct": 999.0}
    good_sig = sign_hmac(DEVICE_SECRET, json.dumps(tampered_payload))
    # Send different body than what was signed
    real_body_str = json.dumps(GOOD_PAYLOAD)
    code, body = http("POST", "/api/v1/telemetry", GOOD_PAYLOAD,
                      {"X-API-Key": API_KEY,
                       "X-HMAC-Signature": "badhmacsig" + "0" * 54})
    check("Forged HMAC → 401", code == 401, f"got {code}")

    # Correct HMAC but then chaos tampers the body → also gets 401 later
    print("  [NOTE] Chaos-middleware tamper test done in test_phase4 section below")
else:
    print(f"  [SKIP] Need valid credentials — re-register to run this test")

# ─── Test 5: Auth disable/enable toggle ──────────────────────────────────
print("\n[5] Auth toggle (NOC control)")
code, body = http("POST", "/api/v1/config/auth", {"enabled": False})
check("POST /config/auth enabled=false → 200", code == 200, f"got {code}")

# Now telemetry should work WITHOUT auth headers
code, body = http("POST", "/api/v1/telemetry", GOOD_PAYLOAD)
check("Unauthenticated POST while auth=off → 200", code == 200, f"got {code}")

# Re-enable auth
code, body = http("POST", "/api/v1/config/auth", {"enabled": True})
check("Re-enable auth → 200", code == 200, f"got {code}")

# Confirm auth is enforced again
code, body = http("POST", "/api/v1/telemetry", GOOD_PAYLOAD)
check("Unauthenticated POST while auth=on → 401", code == 401, f"got {code}")

# ─── Test 6: Config endpoints ────────────────────────────────────────────
print("\n[6] Config endpoints")
code, body = http("GET", "/api/v1/config/all")
check("GET /config/all → 200", code == 200, f"got {code}")
check("Has active_protocol", "active_protocol" in body, str(body))
check("Has encryption_enabled", "encryption_enabled" in body, str(body))
check("Has chaos sub-object", "chaos" in body, str(body))

# ─── Test 7: Chaos settings ───────────────────────────────────────────────
print("\n[7] Chaos settings")
code, body = http("POST", "/api/v1/config/chaos",
                  {"loss_pct": 10, "latency_ms": 100, "tamper": False})
check("Set chaos (loss=10, latency=100) → 200", code == 200, f"got {code}")

code, body = http("GET", "/api/v1/config/chaos")
check("GET /config/chaos reflects settings",
      body.get("loss_pct") == 10 and body.get("latency_ms") == 100,
      str(body))

# Reset chaos
http("POST", "/api/v1/config/chaos", {"loss_pct": 0, "latency_ms": 0, "tamper": False})

# ─── Test 8: AES-GCM encryption (if cryptography available) ──────────────
print("\n[8] AES-GCM encrypted payload")
if CRYPTO_OK and API_KEY != "0" * 64:
    plaintext = json.dumps(GOOD_PAYLOAD)
    envelope  = aes_gcm_encrypt(DEVICE_SECRET, plaintext)
    hmac_sig  = sign_hmac(DEVICE_SECRET, plaintext)
    code, body = http("POST", "/api/v1/telemetry", envelope,
                      {"X-API-Key": API_KEY,
                       "X-HMAC-Signature": hmac_sig,
                       "X-Encrypted": "true"})
    check("AES-GCM encrypted POST → 200", code == 200, f"code={code} body={body}")
else:
    print(f"  [SKIP] AES-GCM test skipped (need valid creds + cryptography installed)")

# ─── Test 9: Admin stats ──────────────────────────────────────────────────
print("\n[9] Admin endpoints")
code, body = http("GET", "/api/v1/admin/stats")
check("GET /admin/stats → 200", code == 200, f"got {code}")
check("Has packets sub-object",   "packets" in body, str(body))
check("Has system sub-object",    "system" in body, str(body))
check("Has auth sub-object",      "auth" in body, str(body))
check("cpu_pct in system",        "cpu_pct" in body.get("system", {}), str(body))

code, body = http("GET", "/api/v1/admin/auth-logs?limit=10")
check("GET /admin/auth-logs → 200", code == 200, f"got {code}")
check("Returns a list", isinstance(body, list), str(type(body)))

code, body = http("GET", "/api/v1/admin/devices")
check("GET /admin/devices → 200", code == 200, f"got {code}")

# ─── Test 10: Device list ────────────────────────────────────────────────
print("\n[10] Device list")
code, body = http("GET", "/api/v1/devices")
check("GET /api/v1/devices → 200", code == 200, f"got {code}")
check("TEST-001 in list", any(d.get("device_id") == "TEST-001" for d in (body or [])),
      str(body))

# ─── Summary ──────────────────────────────────────────────────────────────
total = passed + failed
print(f"\n{'─' * 50}")
print(f"Results: {passed}/{total} passed", end="")
print(f"  {PASS if failed == 0 else FAIL} {'ALL PASSED' if failed == 0 else str(failed) + ' FAILED'}")
sys.exit(0 if failed == 0 else 1)
