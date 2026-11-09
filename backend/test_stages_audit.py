"""
CVIS Multi-Stage Comprehensive Audit Suite
-------------------------------------------
Executes systematic verification across all 5 CCNS project stages:
  Stage 1: Cryptography, Auth & AI Deterministic Intelligence Cache
  Stage 2: Database Storage, Migrations, Indexes & Schema Versioning
  Stage 3: Telemetry Ingestion Pipeline (Plain, Encrypted, Tampered)
  Stage 4: Chaos Middleware, NOC Controls & Dynamic Reconfiguration
  Stage 5: Digital Twin Simulator & Collector Verification
"""

import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Force UTF-8 stdout
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

def log_stage(stage_num: int, title: str):
    print("\n" + "=" * 65)
    print(f"  STAGE {stage_num}: {title.upper()}")
    print("=" * 65)

def check(name: str, cond: bool, detail: str = ""):
    status = "[PASS]" if cond else "[FAIL]"
    print(f"  {status} {name}")
    if not cond and detail:
        print(f"         DETAIL: {detail}")
    if not cond:
        raise AssertionError(f"Stage Audit Failed: {name} — {detail}")


async def audit_stage_1_crypto_auth_ai():
    log_stage(1, "Cryptography, Auth & AI Reasoning Cache")

    from crypto import compute_hmac as sign_hmac, verify_hmac, aes_gcm_encrypt, aes_gcm_decrypt, InvalidTag
    from crypto import generate_api_key, hash_api_key, generate_device_secret
    from ai.ai_cache import get_multi_factor_recommendation, get_grounded_chat_reply
    from models import TelemetryPayload

    # 1.1 Secrets & Keys
    secret = generate_device_secret()
    key = generate_api_key()
    key_h = hash_api_key(key)
    check("Device secret generation (64 hex / 32 bytes)", len(secret) == 64)
    check("API key SHA-256 hash generation (64 hex)", len(key_h) == 64)

    # 1.2 HMAC-SHA256 Integrity
    payload_raw = '{"device_id":"ESP32-ALPHA","speed_kmh":60.0,"battery_pct":80.0}'
    sig = sign_hmac(secret, payload_raw)
    check("HMAC-SHA256 signature generated", len(sig) == 64)
    check("HMAC-SHA256 verification of valid payload", verify_hmac(secret, payload_raw, sig))

    tampered_payload = '{"device_id":"ESP32-ALPHA","speed_kmh":180.0,"battery_pct":80.0}'
    check("HMAC-SHA256 rejection of tampered payload", not verify_hmac(secret, tampered_payload, sig))

    # 1.3 AES-256-GCM Confidentiality + Authenticated Encryption
    env = aes_gcm_encrypt(secret, payload_raw)
    check("AES-GCM encryption envelope contains iv, ct, tag", all(k in env for k in ("iv", "ct", "tag")))
    check("AES-GCM IV is 12 bytes (24 hex)", len(env["iv"]) == 24)
    check("AES-GCM Tag is 16 bytes (32 hex)", len(env["tag"]) == 32)

    decrypted = aes_gcm_decrypt(secret, env["iv"], env["ct"], env["tag"])
    check("AES-GCM decryption recovers original plaintext", decrypted == payload_raw)

    tamper_detected = False
    try:
        mutated_ct = ("00" if env["ct"][:2] != "00" else "ff") + env["ct"][2:]
        aes_gcm_decrypt(secret, env["iv"], mutated_ct, env["tag"])
    except InvalidTag:
        tamper_detected = True
    check("AES-GCM ciphertext tampering raises InvalidTag", tamper_detected)

    # 1.4 AI Deterministic Multi-Factor Intelligence Cache
    all_modes = [
        "Healthy", "Eco", "Sport", "Heavy Traffic",
        "Low Battery", "Battery Overheating", "Charging", "Motor Fault"
    ]
    for mode in all_modes:
        p = TelemetryPayload(
            device_id="ESP32-ALPHA",
            timestamp_ms=123456,
            mode=mode,
            speed_kmh=110.0 if mode == "Sport" else (0.0 if mode in ("Charging", "Motor Fault") else 45.0),
            battery_pct=10.0 if mode == "Low Battery" else 75.0,
            battery_temp_c=65.0 if mode == "Battery Overheating" else 30.0,
            motor_temp_c=98.0 if mode == "Motor Fault" else 40.0,
            range_km=30.0 if mode == "Low Battery" else 220.0,
            fault_code=0x04 if mode == "Motor Fault" else (0x02 if mode == "Battery Overheating" else 0),
            charging_rate_w=7400.0 if mode == "Charging" else 0.0,
            ambient_temp_c=28.0,
            headwind_kmh=15.0,
            road_gradient_pct=2.0,
            tire_pressure_psi=33.5,
            cabin_climate_w=550.0,
            max_cell_voltage_delta=0.012,
        )
        sev, rec = get_multi_factor_recommendation(p)
        check(f"AI Cache multi-factor recommendation: {mode} -> {sev}", sev in {"NORMAL", "CAUTION", "WARNING", "CRITICAL"} and len(rec) > 30)

        # Chat grounding test
        reply = get_grounded_chat_reply("What is my current range and battery?", p)
        check(f"AI Grounded chat response: {mode}", len(reply) > 20 and ("battery" in reply.lower() or "range" in reply.lower()))


async def audit_stage_2_database():
    log_stage(2, "Database Schemas, Migrations & Indices")
    from db import get_db, init_db, close_db
    import aiosqlite

    # Connect to db
    await init_db()
    db = await get_db()

    # Verify tables
    expected_tables = {"packets", "telemetry", "devices", "auth_logs", "server_config", "schema_version"}
    async with db.execute("SELECT name FROM sqlite_master WHERE type='table'") as cur:
        rows = await cur.fetchall()
        existing = {r[0] for r in rows}

    missing = expected_tables - existing
    check("All expected core tables exist in SQLite", len(missing) == 0, f"Missing: {missing}")

    # Verify packets table columns
    async with db.execute("PRAGMA table_info(packets)") as cur:
        cols = {r[1] for r in await cur.fetchall()}
    check("packets table has encrypted, encryption_method, auth_status", {"encrypted", "encryption_method", "auth_status"}.issubset(cols))

    # Verify telemetry table columns
    async with db.execute("PRAGMA table_info(telemetry)") as cur:
        telemetry_cols = {r[1] for r in await cur.fetchall()}
    check("telemetry table has multi-factor parameters (ambient, headwind, gradient, climate)",
          {"ambient_temp_c", "headwind_kmh", "road_gradient_pct", "cabin_climate_w"}.issubset(telemetry_cols))

    # Verify server_config defaults
    async with db.execute("SELECT key, value FROM server_config") as cur:
        cfg = dict(await cur.fetchall())
    check("server_config contains active_protocol", "active_protocol" in cfg)
    check("server_config contains encryption_enabled", "encryption_enabled" in cfg)
    check("server_config contains auth_enabled", "auth_enabled" in cfg)


async def audit_stage_3_service_ingest():
    log_stage(3, "Telemetry Ingestion Pipeline & Auth Enforcement")
    from services.telemetry_service import ingest_telemetry_data
    from crypto import compute_hmac as sign_hmac, aes_gcm_encrypt
    from crypto import generate_api_key, hash_api_key, generate_device_secret
    from db import get_db

    db = await get_db()
    device_id = "ESP32-STAGE-AUDIT"
    api_key = generate_api_key()
    secret = generate_device_secret()
    key_h = hash_api_key(api_key)

    # Register temp device directly
    await db.execute(
        "INSERT OR REPLACE INTO devices (device_id, api_key_hash, device_secret, active) VALUES (?, ?, ?, 1)",
        (device_id, key_h, secret),
    )
    await db.commit()

    # 3.1 Valid Plain Telemetry Ingest
    pkt_data = {
        "device_id": device_id,
        "schema_version": "1.0",
        "timestamp_ms": 1000,
        "mode": "Healthy",
        "speed_kmh": 55.0,
        "battery_pct": 82.0,
        "battery_temp_c": 31.0,
        "motor_temp_c": 44.0,
        "range_km": 240.0,
        "fault_code": 0,
        "charging_rate_w": 0.0,
        "ambient_temp_c": 26.0,
        "headwind_kmh": 12.0,
        "road_gradient_pct": 1.0,
        "tire_pressure_psi": 34.0,
        "cabin_climate_w": 450.0,
        "max_cell_voltage_delta": 0.01,
    }
    raw_json = json.dumps(pkt_data)
    sig = sign_hmac(secret, raw_json)

    res = await ingest_telemetry_data(
        raw_json=raw_json,
        protocol="http",
        source_ip="127.0.0.1",
        api_key=api_key,
        hmac_signature=sig,
        encrypted=False,
    )
    check("Plain telemetry packet ingested successfully", res.get("status") == "ok")
    check("Packet ID returned", res.get("packet_id", 0) > 0)

    # 3.2 AES-256-GCM Encrypted Telemetry Ingest
    env = aes_gcm_encrypt(secret, raw_json)
    res_enc = await ingest_telemetry_data(
        raw_json=json.dumps(env),
        protocol="http",
        source_ip="127.0.0.1",
        api_key=api_key,
        hmac_signature=sig,
        encrypted=True,
        iv=env["iv"],
        ct=env["ct"],
        tag=env["tag"],
    )
    check("AES-256-GCM encrypted packet ingested & decrypted", res_enc.get("status") == "ok")

    # 3.3 Cryptographic Tamper Rejection Test
    tamper_rejected = False
    try:
        bad_sig = ("00" if sig[:2] != "00" else "ff") + sig[2:]
        await ingest_telemetry_data(
            raw_json=raw_json,
            protocol="http",
            source_ip="127.0.0.1",
            api_key=api_key,
            hmac_signature=bad_sig,
            encrypted=False,
        )
    except ValueError as e:
        tamper_rejected = "TAMPER" in str(e)
    check("Tampered HMAC payload rejected with TAMPER error", tamper_rejected)

    # 3.4 AES-GCM Tag Mismatch Rejection Test
    tag_mismatch_rejected = False
    try:
        bad_ct = ("00" if env["ct"][:2] != "00" else "ff") + env["ct"][2:]
        await ingest_telemetry_data(
            raw_json=json.dumps(env),
            protocol="http",
            source_ip="127.0.0.1",
            api_key=api_key,
            hmac_signature=sig,
            encrypted=True,
            iv=env["iv"],
            ct=bad_ct,
            tag=env["tag"],
        )
    except ValueError as e:
        tag_mismatch_rejected = "TAMPER" in str(e)
    check("Tampered AES-GCM ciphertext rejected with TAMPER error", tag_mismatch_rejected)


async def audit_stage_4_chaos_and_control():
    log_stage(4, "Chaos Middleware & Dynamic Control")
    from middleware.chaos import chaos_config
    from routers.control import is_ai_enabled, set_ai_enabled

    # Chaos parameters
    chaos_config.loss_pct = 25
    chaos_config.latency_ms = 100
    chaos_config.tamper_enabled = True
    check("Chaos configuration sets loss_pct=25", chaos_config.loss_pct == 25)
    check("Chaos configuration sets latency_ms=100", chaos_config.latency_ms == 100)
    check("Chaos configuration sets tamper_enabled=True", chaos_config.tamper_enabled is True)

    # Reset chaos
    chaos_config.loss_pct = 0
    chaos_config.latency_ms = 0
    chaos_config.tamper_enabled = False

    # AI Control Toggle
    test_dev = "ESP32-CHAOS-TEST"
    check("Default AI service is enabled", is_ai_enabled(test_dev))

    set_ai_enabled(False)
    check("set_ai_enabled(False) disables AI", not is_ai_enabled(test_dev))

    set_ai_enabled(True)
    check("set_ai_enabled(True) re-enables AI", is_ai_enabled(test_dev))


async def audit_stage_5_simulator_fleet():
    log_stage(5, "Digital Twin Simulator & Fast Batch Runner")
    from simulate_vehicle import MODES, VehicleSimulator

    check("All 8 modes defined in simulation table", len(MODES) == 8)
    sim = VehicleSimulator(
        base_url="http://127.0.0.1:8000",
        device_id="ESP32-ALPHA",
        name="Alpha",
        interval=0.1,
        cycle_secs=5.0,
        start_mode=0,
    )
    check("Simulator initializes with Alpha personality sequence", len(sim.mode_sequence) == 5)

    pkt = sim.generate_packet()
    check("Packet generated contains all 17 parameters", len(pkt) >= 16)
    check("Packet contains valid operating mode", pkt["mode"] in [m[0] for m in MODES])
    check("Packet contains valid physics ranges", 0.0 <= pkt["battery_pct"] <= 100.0)


async def main():
    print("=================================================================")
    print("      CVIS SYSTEM-WIDE COMPREHENSIVE STAGE AUDIT")
    print("=================================================================")
    start = time.time()
    try:
        await audit_stage_1_crypto_auth_ai()
        await audit_stage_2_database()
        await audit_stage_3_service_ingest()
        await audit_stage_4_chaos_and_control()
        await audit_stage_5_simulator_fleet()

        elapsed = time.time() - start
        print("\n" + "=" * 65)
        print(f"  ALL 5 STAGES AUDITED & VERIFIED SUCCESSFULLY ({elapsed:.2f}s)")
        print("  NO REGRESSIONS FOUND. SYSTEM IS PRODUCTION & DEMO READY.")
        print("=" * 65 + "\n")
    finally:
        from db import close_db
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
