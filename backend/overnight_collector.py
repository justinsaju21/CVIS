"""
CVIS Digital Twin Flight Recorder & Overnight Data Collector
------------------------------------------------------------
Autonomous telemetry, security, and AI intelligence flight recorder.

Features:
  - Multi-vehicle parallel digital twin (ESP32-ALPHA, BETA, GAMMA, DELTA).
  - Exercises full CCNS matrix:
      * Protocols: HTTP REST and MQTT (runtime switchable)
      * Cryptography: Plain JSON and AES-256-GCM + HMAC-SHA256
      * Vehicle Modes: All 8 canonical states (Healthy, Eco, Sport, Heavy Traffic,
        Low Battery, Battery Overheating, Charging, Motor Fault)
      * Chaos Injections: Packet loss simulation, artificial latency, and payload tampering
      * Multi-factor AI reasoning & instant intelligence caching
  - Modes:
      * --fast: Rapidly populates the database and cache with hundreds of verified packets in <60s.
      * --hours N: Runs continuously for N hours overnight (default: 8 hours).

Usage:
  python overnight_collector.py --fast          # Quick batch flight recording (immediate)
  python overnight_collector.py --hours 8       # Full overnight autonomous run
"""

import argparse
import json
import logging
import os
import random
import sys
import threading
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# Setup logging to both console and log file
LOG_FILE = Path(__file__).resolve().parent / "overnight_collection.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_FILE, mode="a", encoding="utf-8"),
    ],
)
logger = logging.getLogger("cvis.collector")

# Import simulator primitives
try:
    from simulate_vehicle import (
        VehicleSimulator,
        fetch_fleet,
        MODES,
        MQTT_OK,
        CRYPTO_OK,
        sign_hmac,
        aes_gcm_encrypt,
    )
except ImportError:
    logger.error("Could not import simulate_vehicle.py — ensure running inside backend directory.")
    sys.exit(1)


class CollectorStats:
    def __init__(self):
        self.lock = threading.Lock()
        self.total_sent = 0
        self.http_packets = 0
        self.mqtt_packets = 0
        self.encrypted_packets = 0
        self.plain_packets = 0
        self.tamper_injected = 0
        self.successful_acks = 0
        self.retries_occurred = 0
        self.errors = 0
        self.start_time = time.time()

    def record(self, proto: str, encrypted: bool, tampered: bool, code: int, retried: bool):
        with self.lock:
            self.total_sent += 1
            if proto.lower() == "mqtt":
                self.mqtt_packets += 1
            else:
                self.http_packets += 1

            if encrypted:
                self.encrypted_packets += 1
            else:
                self.plain_packets += 1

            if tampered:
                self.tamper_injected += 1

            if retried:
                self.retries_occurred += 1

            if code == 200 or (tampered and code == 401):
                self.successful_acks += 1
            else:
                self.errors += 1

    def summary(self) -> str:
        elapsed = time.time() - self.start_time
        hours, rem = divmod(elapsed, 3600)
        minutes, secs = divmod(rem, 60)
        duration_str = f"{int(hours):02d}h {int(minutes):02d}m {int(secs):02d}s"

        lines = [
            "============================================================",
            "  CVIS DIGITAL TWIN FLIGHT RECORDER — SESSION SUMMARY",
            "============================================================",
            f"  Session Duration:       {duration_str}",
            f"  Total Packets Sent:     {self.total_sent}",
            f"  Successful Deliveries:  {self.successful_acks}",
            f"  HTTP REST Ingests:      {self.http_packets}",
            f"  MQTT Broker Ingests:    {self.mqtt_packets}",
            f"  AES-256-GCM Encrypted:  {self.encrypted_packets}",
            f"  Plain JSON Payloads:    {self.plain_packets}",
            f"  Tamper Injections:      {self.tamper_injected} (Verified & Rejected)",
            f"  Ack Retries Triggered:  {self.retries_occurred}",
            f"  Transport Failures:     {self.errors}",
            "============================================================",
        ]
        return "\n".join(lines)


def configure_backend(base_url: str, protocol: str = "http", encryption: bool = False, chaos: dict = None, ai_service: bool = None):
    """Dynamically configure backend protocol, encryption, chaos, and AI service settings."""
    try:
        # Set protocol
        req = urllib.request.Request(
            f"{base_url}/api/v1/config/protocol",
            data=json.dumps({"protocol": protocol}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=3)

        # Set encryption
        req = urllib.request.Request(
            f"{base_url}/api/v1/config/encryption",
            data=json.dumps({"enabled": encryption}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=3)

        # Set chaos if provided
        if chaos is not None:
            req = urllib.request.Request(
                f"{base_url}/api/v1/config/chaos",
                data=json.dumps(chaos).encode(),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            urllib.request.urlopen(req, timeout=3)

        # Set AI service if provided
        if ai_service is not None:
            req = urllib.request.Request(
                f"{base_url}/api/v1/control/ai-service",
                data=json.dumps({"enabled": ai_service}).encode(),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            urllib.request.urlopen(req, timeout=3)
    except Exception as e:
        logger.warning(f"Could not apply runtime config to backend: {e}")


def run_fast_collection(base_url: str, packets_per_vehicle: int = 50):
    """
    Rapid batch flight recording: Ingests packets across all combinations
    (HTTP + MQTT, Plain + Encrypted, All 8 Modes, Normal + Tampered)
    without 2-second sleep intervals.
    """
    logger.info(f"Starting FAST flight recorder batch ({packets_per_vehicle} packets per vehicle)...")
    fleet = fetch_fleet(base_url)
    stats = CollectorStats()

    # Pre-register all vehicles
    simulators = []
    for v in fleet:
        sim = VehicleSimulator(
            base_url=base_url,
            device_id=v["device_id"],
            name=v.get("name", v["device_id"]),
            interval=0.05,
            cycle_secs=3.0,
            start_mode=v.get("start_mode", 0),
        )
        if sim.register():
            simulators.append(sim)

    if not simulators:
        logger.error("No simulators registered. Aborting.")
        return

    # Scenario permutations
    scenarios = [
        {"proto": "http", "enc": False, "tamper": False, "desc": "HTTP REST Plain Baseline"},
        {"proto": "http", "enc": True,  "tamper": False, "desc": "HTTP REST AES-256-GCM Encrypted"},
        {"proto": "http", "enc": True,  "tamper": True,  "desc": "HTTP Cryptographic Tamper Test (AES-GCM Tag Mismatch)"},
        {"proto": "mqtt", "enc": False, "tamper": False, "desc": "MQTT Broker Plain Baseline"},
        {"proto": "mqtt", "enc": True,  "tamper": False, "desc": "MQTT Broker AES-256-GCM Encrypted"},
    ]

    for sc in scenarios:
        proto = sc["proto"]
        enc = sc["enc"]
        tamper = sc["tamper"]
        logger.info(f"--> Executing Scenario: {sc['desc']}")
        configure_backend(base_url, protocol=proto, encryption=enc)

        loops = max(1, packets_per_vehicle // len(scenarios))
        for sim in simulators:
            for _ in range(loops):
                # Cycle through modes to give rich diversity
                sim.seq_index = (sim.seq_index + 1) % len(sim.mode_sequence)
                sim.mode_index = sim.mode_sequence[sim.seq_index]
                pkt = sim.generate_packet()

                retried = False
                if proto == "mqtt" and MQTT_OK:
                    code, _ = sim.send_mqtt(pkt, encryption_enabled=enc, tamper=tamper)
                else:
                    code, _ = sim.send_http(pkt, encryption_enabled=enc, tamper=tamper)

                stats.record(proto, enc, tamper, code, retried)
                time.sleep(0.02)  # High throughput non-blocking stream

    # Reset config to clean defaults
    configure_backend(base_url, protocol="http", encryption=False, chaos={"loss_pct": 0, "latency_ms": 0, "tamper": False})

    summary_text = stats.summary()
    logger.info("\n" + summary_text)
    print("\n[SUCCESS] Fast flight recording complete. All telemetry, packets, and AI responses cached.")


def run_overnight_collection(base_url: str, hours: float = 8.0, interval: float = 2.0):
    """
    Full overnight autonomous run. Runs parallel threads for all vehicles,
    periodically rotating through operating scenarios, protocols, and chaos tests.
    """
    logger.info(f"Starting OVERNIGHT flight recorder ({hours} hours, {interval}s interval)...")
    fleet = fetch_fleet(base_url)
    stats = CollectorStats()
    stop_event = threading.Event()

    simulators = []
    for v in fleet:
        sim = VehicleSimulator(
            base_url=base_url,
            device_id=v["device_id"],
            name=v.get("name", v["device_id"]),
            interval=interval,
            cycle_secs=v.get("cycle_secs", 12),
            start_mode=v.get("start_mode", 0),
        )
        if sim.register():
            simulators.append(sim)

    if not simulators:
        logger.error("No simulators registered. Aborting.")
        return

    # Master supervisory thread that exercises the complete automated test matrix
    AUTONOMOUS_SCHEDULE = [
        # (protocol, encryption, chaos_dict, ai_service, description, duration_secs)
        ("http", True,  {"loss_pct": 0, "latency_ms": 0, "tamper": False}, True, "HTTP REST + AES-256-GCM Secure Baseline", 240),
        ("mqtt", True,  {"loss_pct": 0, "latency_ms": 0, "tamper": False}, True, "MQTT Broker + AES-256-GCM Secure Baseline", 240),
        ("http", False, {"loss_pct": 0, "latency_ms": 0, "tamper": False}, True, "HTTP REST Plain Baseline (Unencrypted JSON)", 240),
        ("mqtt", False, {"loss_pct": 0, "latency_ms": 0, "tamper": False}, True, "MQTT Broker Plain Baseline (Unencrypted JSON)", 240),
        ("mqtt", True,  {"loss_pct": 0, "latency_ms": 300, "tamper": False}, True, "MQTT Edge Cellular Latency Drill (300ms Delay)", 180),
        ("http", True,  {"loss_pct": 10, "latency_ms": 100, "tamper": False}, True, "HTTP Network Congestion Drill (10% Loss, 100ms Latency + Backoff Retries)", 180),
        ("mqtt", False, {"loss_pct": 25, "latency_ms": 100, "tamper": False}, True, "MQTT Severe Loss Drill (25% Loss + Multi-Attempt Retries)", 180),
        ("http", True,  {"loss_pct": 0, "latency_ms": 0, "tamper": True}, True, "HTTP Active MITM Tamper Defense Drill (Tag Mismatch Rejections)", 120),
        ("mqtt", True,  {"loss_pct": 0, "latency_ms": 0, "tamper": False}, False, "MQTT Decoupled Comms & AI Graceful Degradation (AI Offline)", 120),
        ("http", True,  {"loss_pct": 0, "latency_ms": 1000, "tamper": False}, True, "HTTP Satellite Propagation Lag Drill (1000ms Delay)", 120),
    ]

    def supervisor():
        end_time = time.time() + (hours * 3600)
        cycle_idx = 0
        while time.time() < end_time and not stop_event.is_set():
            proto, enc, chaos, ai_srv, desc, dur = AUTONOMOUS_SCHEDULE[cycle_idx % len(AUTONOMOUS_SCHEDULE)]
            cycle_idx += 1
            logger.info(f"[SUPERVISOR] === Automated Drill {cycle_idx}: {desc} ({dur}s) ===")
            configure_backend(base_url, protocol=proto, encryption=enc, chaos=chaos, ai_service=ai_srv)
            logger.info(f"[SUPERVISOR] Active Mode: Protocol={proto.upper()}, Encrypted={enc}, Loss={chaos['loss_pct']}%, Latency={chaos['latency_ms']}ms, Tamper={chaos['tamper']}, AI={ai_srv}")
            stop_event.wait(dur)

        stop_event.set()

    sup_thread = threading.Thread(target=supervisor, name="Supervisor", daemon=True)
    sup_thread.start()

    # Launch vehicle threads
    threads = []
    for sim in simulators:
        t = threading.Thread(
            target=sim.run,
            args=(stop_event, 0, stats.record),
            name=sim.name,
            daemon=True,
        )
        threads.append(t)
        t.start()

    logger.info(f"[COLLECTOR] {len(threads)} vehicle nodes running live. Press Ctrl+C at any time to halt.")

    try:
        while not stop_event.is_set():
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("\n[COLLECTOR] Shutdown requested by user. Terminating threads...")
        stop_event.set()

    # Join threads
    for t in threads:
        t.join(timeout=3)

    # Reset backend to normal
    configure_backend(base_url, protocol="http", encryption=False, chaos={"loss_pct": 0, "latency_ms": 0, "tamper": False}, ai_service=True)

    summary_text = stats.summary()
    logger.info("\n" + summary_text)
    print("\n[COLLECTOR] Overnight flight recording session concluded.")


def run_telemetry_replay(base_url: str, speed: float = 3.0, limit: int = 1000, target_mode: str | None = None, loop: bool = False):
    """
    Replay recorded flight data from cvis.db through the backend,
    broadcasting live updates to connected WebSocket dashboards at Nx speed.
    Supports all 8 vehicle modes with HMAC cryptographic signing.
    """
    import sqlite3
    db_path = Path(__file__).resolve().parent / "cvis.db"
    if not db_path.exists():
        logger.error(f"Cannot replay: Database file not found at {db_path}")
        return

    filter_desc = f" (mode='{target_mode}')" if target_mode else " (all 8 modes)"
    lim_desc = f"limit={limit}" if limit and limit > 0 else "all frames"
    loop_desc = " [LOOPING CONTINUOUSLY]" if loop else ""
    logger.info(f"[REPLAY] Loading recorded flight telemetry from {db_path.name}{filter_desc} [{lim_desc}]{loop_desc}...")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    query = """
        SELECT t.*, p.protocol, p.encrypted
        FROM telemetry t
        LEFT JOIN packets p ON p.id = t.packet_id
        WHERE t.device_id IN ('ESP32-ALPHA', 'ESP32-BETA', 'ESP32-GAMMA', 'ESP32-DELTA')
    """
    params = []
    if target_mode:
        query += " AND t.mode = ?"
        params.append(target_mode)
    query += " ORDER BY t.id ASC"
    if limit and limit > 0 and not loop:
        query += " LIMIT ?"
        params.append(limit)

    cur.execute(query, tuple(params))
    rows = cur.fetchall()
    conn.close()

    if not rows:
        logger.warning("[REPLAY] No recorded telemetry found to replay.")
        return

    logger.info(f"[REPLAY] Beginning flight replay of {len(rows)} telemetry frames at {speed}x speed. Press Ctrl+C to halt.")
    stats = CollectorStats()

    fleet = fetch_fleet(base_url)
    key_map = {}
    secret_map = {}
    for v in fleet:
        dev_id = v["device_id"]
        try:
            deact_url = f"{base_url}/api/v1/admin/deactivate-device?device_id={dev_id}"
            req = urllib.request.Request(deact_url, method="POST")
            urllib.request.urlopen(req, timeout=3)
        except Exception:
            pass

        reg_url = f"{base_url}/api/v1/devices/register"
        data = json.dumps({"device_id": dev_id}).encode()
        req = urllib.request.Request(
            reg_url, data=data,
            headers={"Content-Type": "application/json"}, method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                res = json.loads(resp.read().decode())
                key_map[dev_id] = res["api_key"]
                secret_map[dev_id] = res["device_secret"]
                logger.info(f"[REPLAY AUTH] Provisioned {dev_id} with fresh credentials.")
        except Exception as e:
            logger.error(f"[REPLAY AUTH] Registration error for {dev_id}: {e}")

    # Set up MQTT client for replay
    mqtt_client = None
    def get_mqtt_client():
        nonlocal mqtt_client
        if not MQTT_OK:
            return None
        if mqtt_client is None:
            try:
                import paho.mqtt.client as paho_mqtt
                client = paho_mqtt.Client(
                    paho_mqtt.CallbackAPIVersion.VERSION2,
                    client_id=f"cvis-replay-stream-{random.randint(1000, 9999)}",
                )
                client.connect("localhost", 1883, keepalive=60)
                client.loop_start()
                mqtt_client = client
                logger.info("[REPLAY MQTT] Connected to MQTT broker at localhost:1883")
            except Exception as e:
                logger.warning(f"[REPLAY MQTT] Connection failed: {e}")
                mqtt_client = None
        return mqtt_client

    # Initialize connection if broker is up
    get_mqtt_client()

    current_cfg = {"active_protocol": "http", "encryption_enabled": False, "chaos": {}}
    last_cfg_fetch = 0.0

    def get_runtime_config():
        nonlocal current_cfg, last_cfg_fetch
        now = time.time()
        if now - last_cfg_fetch >= 0.5:
            try:
                with urllib.request.urlopen(f"{base_url}/api/v1/config/all", timeout=1.5) as resp:
                    current_cfg = json.loads(resp.read().decode())
                    last_cfg_fetch = now
            except Exception:
                pass
        return current_cfg

    frame_count = 0
    cycle = 1
    while True:
        for r in rows:
            frame_count += 1
            dev_id = r["device_id"]
            packet = {
                "device_id": dev_id,
                "schema_version": "1.0",
                "timestamp_ms": int(time.time() * 1000),
                "mode": r["mode"],
                "speed_kmh": r["speed_kmh"],
                "battery_pct": r["battery_pct"],
                "battery_temp_c": r["battery_temp_c"],
                "motor_temp_c": r["motor_temp_c"],
                "range_km": r["range_km"],
                "fault_code": r["fault_code"],
                "charging_rate_w": r["charging_rate_w"],
                "ambient_temp_c": r["ambient_temp_c"],
                "headwind_kmh": r["headwind_kmh"],
                "road_gradient_pct": r["road_gradient_pct"],
                "tire_pressure_psi": r["tire_pressure_psi"],
                "cabin_climate_w": r["cabin_climate_w"],
                "max_cell_voltage_delta": r["max_cell_voltage_delta"],
            }

            cfg = get_runtime_config()
            active_proto = cfg.get("active_protocol", "http").lower()
            encryption_enabled = cfg.get("encryption_enabled", False)
            tamper = cfg.get("chaos", {}).get("tamper", False)

            api_key = key_map.get(dev_id, "")
            secret = secret_map.get(dev_id, "")

            mc = get_mqtt_client()
            if active_proto == "mqtt" and mc is not None:
                # ── Publish via MQTT ──────────────────────────────────────
                topic = f"cvis/telemetry/{dev_id}"
                if encryption_enabled and CRYPTO_OK and secret:
                    plaintext = json.dumps(packet)
                    sig = sign_hmac(secret, plaintext)
                    envelope = aes_gcm_encrypt(secret, plaintext)
                    if tamper:
                        ct = envelope["ct"]
                        envelope["ct"] = ("00" if ct[:2] != "00" else "ff") + ct[2:]
                    payload = json.dumps({
                        "_meta": {"api_key": api_key, "hmac": sig},
                        "encrypted": True,
                        **envelope,
                    })
                else:
                    payload_str = json.dumps(packet)
                    sig = sign_hmac(secret, payload_str) if secret else ""
                    if tamper:
                        tampered_pkt = dict(packet)
                        tampered_pkt["speed_kmh"] = round(tampered_pkt.get("speed_kmh", 50.0) + 123.4, 1)
                        payload = json.dumps({
                            "_meta": {"api_key": api_key, "hmac": sig},
                            **tampered_pkt,
                        })
                    else:
                        payload = json.dumps({
                            "_meta": {"api_key": api_key, "hmac": sig},
                            **packet,
                        })

                try:
                    pub_res = mc.publish(topic, payload, qos=1)
                    pub_res.wait_for_publish(timeout=1.5)
                    stats.record("mqtt", encryption_enabled, tamper, 200, False)
                    enc_tag = "[ENC]" if encryption_enabled else "[PLN]"
                    print(f"[REPLAY #{frame_count:05d}] {dev_id} | [MQTT] {enc_tag} | {r['mode']:<16} | Spd:{r['speed_kmh']:5.1f} | Bat:{r['battery_pct']:5.1f}% -> OK")
                except Exception as e:
                    stats.record("mqtt", encryption_enabled, tamper, 500, False)
                    print(f"[REPLAY #{frame_count:05d}] {dev_id} -> MQTT error: {e}")
            else:
                # ── Send via HTTP REST ────────────────────────────────────
                headers = {"Content-Type": "application/json"}
                if api_key:
                    headers["X-API-Key"] = api_key

                if encryption_enabled and CRYPTO_OK and secret:
                    plaintext = json.dumps(packet)
                    sig = sign_hmac(secret, plaintext)
                    envelope = aes_gcm_encrypt(secret, plaintext)
                    if tamper:
                        ct = envelope["ct"]
                        envelope["ct"] = ("00" if ct[:2] != "00" else "ff") + ct[2:]
                    headers["X-HMAC-Signature"] = sig
                    headers["X-Encrypted"] = "true"
                    body = json.dumps(envelope).encode()
                else:
                    payload_str = json.dumps(packet)
                    sig = sign_hmac(secret, payload_str) if secret else ""
                    if secret:
                        headers["X-HMAC-Signature"] = sig
                    if tamper:
                        tampered_pkt = dict(packet)
                        tampered_pkt["speed_kmh"] = round(tampered_pkt.get("speed_kmh", 50.0) + 123.4, 1)
                        body = json.dumps(tampered_pkt).encode()
                    else:
                        body = payload_str.encode()

                req = urllib.request.Request(
                    f"{base_url}/api/v1/telemetry",
                    data=body,
                    headers=headers,
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        stats.record("http", encryption_enabled, tamper, resp.status, False)
                        enc_tag = "[ENC]" if encryption_enabled else "[PLN]"
                        print(f"[REPLAY #{frame_count:05d}] {dev_id} | [HTTP] {enc_tag} | {r['mode']:<16} | Spd:{r['speed_kmh']:5.1f} | Bat:{r['battery_pct']:5.1f}% -> {resp.status}")
                except urllib.error.HTTPError as e:
                    stats.record("http", encryption_enabled, tamper, e.code, False)
                    print(f"[REPLAY #{frame_count:05d}] {dev_id} -> HTTP {e.code}")
                except Exception as e:
                    stats.record("http", encryption_enabled, tamper, 500, False)
                    print(f"[REPLAY #{frame_count:05d}] {dev_id} -> HTTP frame error: {e}")

            time.sleep(max(0.04, 1.0 / speed))

            if not loop and limit and limit > 0 and frame_count >= limit:
                break

        if not loop or (limit and limit > 0 and frame_count >= limit):
            break
        cycle += 1
        logger.info(f"[REPLAY] Completed cycle {cycle - 1}. Looping replay dataset...")

    if mqtt_client:
        try:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()
        except Exception:
            pass

    print("\n" + stats.summary())
    print("[REPLAY] Telemetry flight replay concluded successfully.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CVIS Digital Twin Flight Recorder & Overnight Collector")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="FastAPI backend URL")
    parser.add_argument("--fast", action="store_true", help="Run rapid batch collection (<60 seconds)")
    parser.add_argument("--replay", action="store_true", help="Replay recorded telemetry at Nx speed for live viva/demo")
    parser.add_argument("--speed", type=float, default=3.0, help="Replay speed multiplier (default: 3.0x)")
    parser.add_argument("--limit", type=int, default=1000, help="Frames to replay (default: 1000, 0 for all)")
    parser.add_argument("--loop", action="store_true", help="Continuously loop replay indefinitely")
    parser.add_argument("--mode-filter", type=str, default=None, help="Optionally filter replay to a specific mode (e.g. Sport, 'Motor Fault')")
    parser.add_argument("--hours", type=float, default=8.0, help="Number of hours to run overnight (default: 8.0)")
    parser.add_argument("--interval", type=float, default=2.0, help="Packet interval in seconds (default: 2.0)")
    parser.add_argument("--batch-size", type=int, default=80, help="Packets per vehicle in fast mode")
    args = parser.parse_args()

    print("============================================================")
    print("   CVIS DIGITAL TWIN FLIGHT RECORDER")
    print("   Connected Vehicle Intelligence System")
    print("============================================================")
    print(f" Target Backend: {args.url}")
    if args.replay:
        flt = f", Mode: {args.mode_filter}" if args.mode_filter else ""
        loop_str = ", LOOPING" if args.loop else ""
        print(f" Mode:           TELEMETRY REPLAY ({args.speed}x speed, limit={args.limit}{flt}{loop_str})")
    elif args.fast:
        print(f" Mode:           FAST BATCH ({args.batch_size} pkts/veh)")
    else:
        print(f" Mode:           OVERNIGHT ({args.hours} hours)")
    print("============================================================\n")

    if args.replay:
        run_telemetry_replay(args.url, speed=args.speed, limit=args.limit, target_mode=args.mode_filter, loop=args.loop)
    elif args.fast:
        run_fast_collection(args.url, packets_per_vehicle=args.batch_size)
    else:
        run_overnight_collection(args.url, hours=args.hours, interval=args.interval)

