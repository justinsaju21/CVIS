"""
CVIS Vehicle Simulator — Multi-Vehicle Edition
-----------------------------------------------
Simulates 4 ESP32 vehicle nodes streaming telemetry to the CVIS backend in
parallel threads. Each vehicle has a unique personality and mode-cycle offset.

Fleet:
  ESP32-ALPHA  Urban Commuter   (Heavy Traffic & Charging focus)
  ESP32-BETA   Performance Driver (Sport & Motor Fault risk)
  ESP32-GAMMA  Eco Ranger       (Eco mode, long range)
  ESP32-DELTA  Test Node        (cycles all 8 modes rapidly for debug)

Usage:
  python simulate_vehicle.py                # Run all 4 vehicles
  python simulate_vehicle.py --single ESP32-ALPHA  # Single vehicle
  python simulate_vehicle.py --interval 2.0
"""

import argparse
import hashlib
import hmac
import json
import os
import random
import sys
import threading
import time
import urllib.request
import urllib.error

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    CRYPTO_OK = True
except ImportError:
    CRYPTO_OK = False

# ─── Mode table ────────────────────────────────────────────────────────────
#   (name, speed, batt%, batt_temp, motor_temp, range_km, fault_code, charge_w)
MODES = [
    ("Healthy",             60.0,  80.0, 30.0, 45.0,  250.0, 0x00, 0.0),
    ("Eco",                 40.0,  75.0, 28.0, 38.0,  290.0, 0x00, 0.0),
    ("Sport",              110.0,  65.0, 35.0, 75.0,  180.0, 0x00, 0.0),
    ("Heavy Traffic",       15.0,  70.0, 31.0, 42.0,  220.0, 0x00, 0.0),
    ("Low Battery",         50.0,  12.0, 32.0, 48.0,   35.0, 0x00, 0.0),
    ("Battery Overheating", 30.0,  55.0, 58.0, 65.0,  140.0, 0x02, 0.0),
    ("Charging",             0.0,  75.0, 38.0, 32.0,  250.0, 0x00, 7400.0),
    ("Motor Fault",          0.0,  60.0, 33.0, 95.0,    0.0, 0x04, 0.0),
]


# ─── NOTE: Fleet is NOT defined here. ────────────────────────────────────────
# To add/remove vehicles, edit FLEET in backend/routers/control.py only.
# The simulator fetches the fleet from GET /api/v1/control/vehicles at startup.
# ─────────────────────────────────────────────────────────────────────────────


def vary(base: float, delta: float) -> float:
    return round(base + random.uniform(-delta, delta), 1)


def sign_hmac(secret_hex: str, payload_str: str) -> str:
    key = bytes.fromhex(secret_hex)
    return hmac.new(key, payload_str.encode(), hashlib.sha256).hexdigest()


def aes_gcm_encrypt(secret_hex: str, plaintext: str) -> dict:
    key = bytes.fromhex(secret_hex)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ct_tag = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return {"iv": nonce.hex(), "ct": ct_tag[:-16].hex(), "tag": ct_tag[-16:].hex()}


def fetch_fleet(base_url: str) -> list[dict]:
    """
    Fetch the vehicle fleet from the backend.
    Single source of truth: add vehicles to FLEET in backend/routers/control.py
    and the simulator picks them up automatically on next start.
    """
    try:
        with urllib.request.urlopen(
            f"{base_url}/api/v1/control/vehicles", timeout=5
        ) as resp:
            vehicles = json.loads(resp.read().decode())
            print(f"[FLEET] Loaded {len(vehicles)} vehicle(s) from backend")
            return vehicles
    except Exception as e:
        print(f"[FLEET] Could not fetch fleet from backend: {e}")
        sys.exit(1)



class VehicleSimulator:
    def __init__(self, base_url: str, device_id: str, name: str,
                 interval: float, cycle_secs: float, start_mode: int):
        self.base_url     = base_url.rstrip("/")
        self.device_id    = device_id
        self.name         = name
        self.interval     = interval
        self.cycle_secs   = cycle_secs
        self.api_key      = ""
        self.device_secret = ""
        self.mode_index   = start_mode % len(MODES)
        self.last_cycle   = time.time()
        self.start_time   = time.time()

    def register(self) -> bool:
        # Deactivate first so we always get fresh credentials
        deact_url = f"{self.base_url}/api/v1/admin/deactivate-device?device_id={self.device_id}"
        try:
            req = urllib.request.Request(deact_url, method="POST")
            urllib.request.urlopen(req, timeout=3)
        except Exception:
            pass

        reg_url = f"{self.base_url}/api/v1/devices/register"
        data = json.dumps({"device_id": self.device_id}).encode()
        req = urllib.request.Request(
            reg_url, data=data,
            headers={"Content-Type": "application/json"}, method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                res = json.loads(resp.read().decode())
                self.api_key       = res["api_key"]
                self.device_secret = res["device_secret"]
                print(f"[{self.name}] Registered '{self.device_id}' | Key: {self.api_key[:10]}...")
                return True
        except Exception as e:
            print(f"[{self.name}] Registration FAILED: {e}")
            return False

    def get_backend_config(self) -> dict:
        try:
            with urllib.request.urlopen(
                f"{self.base_url}/api/v1/config/all", timeout=3
            ) as resp:
                return json.loads(resp.read().decode())
        except Exception:
            return {"active_protocol": "http", "encryption_enabled": False}

    def generate_packet(self) -> dict:
        mode_name, speed, batt, batt_t, motor_t, rng, fault, charge = MODES[self.mode_index]
        return {
            "device_id":      self.device_id,
            "schema_version": "1.0",
            "timestamp_ms":   int((time.time() - self.start_time) * 1000),
            "mode":           mode_name,
            "speed_kmh":      max(0.0, vary(speed, 3.0)),
            "battery_pct":    max(0.0, min(100.0, vary(batt, 1.0))),
            "battery_temp_c": max(0.0, vary(batt_t, 0.8)),
            "motor_temp_c":   max(0.0, vary(motor_t, 1.5)),
            "range_km":       max(0.0, vary(rng, 5.0)),
            "fault_code":     fault,
            "charging_rate_w": charge,
        }

    def send_http(self, packet: dict, encryption_enabled: bool) -> tuple[int, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key

        if encryption_enabled and CRYPTO_OK and self.device_secret:
            plaintext = json.dumps(packet)
            sig = sign_hmac(self.device_secret, plaintext)
            envelope = aes_gcm_encrypt(self.device_secret, plaintext)
            headers["X-HMAC-Signature"] = sig
            headers["X-Encrypted"] = "true"
            body = json.dumps(envelope).encode()
        else:
            payload_str = json.dumps(packet)
            if self.device_secret:
                headers["X-HMAC-Signature"] = sign_hmac(self.device_secret, payload_str)
            body = payload_str.encode()

        req = urllib.request.Request(
            f"{self.base_url}/api/v1/telemetry",
            data=body, headers=headers, method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status, resp.read().decode()
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode()
        except Exception as e:
            return 500, str(e)

    def run(self, stop_event: threading.Event, max_packets: int = 0):
        print(f"[{self.name}] Starting — mode={MODES[self.mode_index][0]}, "
              f"interval={self.interval}s, cycle={self.cycle_secs}s")
        count = 0
        while not stop_event.is_set():
            # Cycle mode
            if time.time() - self.last_cycle >= self.cycle_secs:
                self.mode_index   = (self.mode_index + 1) % len(MODES)
                self.last_cycle   = time.time()
                print(f"[{self.name}] Mode -> {MODES[self.mode_index][0]}")

            cfg        = self.get_backend_config()
            encryption = cfg.get("encryption_enabled", False)
            pkt        = self.generate_packet()
            code, _    = self.send_http(pkt, encryption)
            count += 1

            enc_str    = "[ENC]" if encryption else "[PLN]"
            status_str = "OK" if code == 200 else f"ERR{code}"
            print(f"[{self.name}] #{count:04d} {enc_str} {pkt['mode']:<22} "
                  f"Spd:{pkt['speed_kmh']:5.1f} Bat:{pkt['battery_pct']:4.1f}% -> {status_str}")

            if max_packets > 0 and count >= max_packets:
                break
            stop_event.wait(self.interval)


# ─── Entry point ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CVIS Multi-Vehicle Simulator")
    parser.add_argument("--url",      default="http://127.0.0.1:8000")
    parser.add_argument("--interval", type=float, default=2.0,  help="Seconds between packets per vehicle")
    parser.add_argument("--count",    type=int,   default=0,    help="Max packets per vehicle (0=infinite)")
    parser.add_argument("--single",   default=None,             help="Run only this device_id (e.g. ESP32-ALPHA)")
    args = parser.parse_args()

    # ── Single source of truth: fetch fleet from backend ──────────────────
    # To add a new vehicle, edit FLEET in backend/routers/control.py only.
    # The simulator automatically picks it up from the /api/v1/control/vehicles endpoint.
    all_vehicles = fetch_fleet(args.url)

    if args.single:
        fleet = [v for v in all_vehicles if v["device_id"] == args.single]
        if not fleet:
            ids = [v["device_id"] for v in all_vehicles]
            print(f"[ERROR] '{args.single}' not in fleet. Available: {ids}")
            sys.exit(1)
    else:
        fleet = all_vehicles

    stop_event = threading.Event()
    threads: list[threading.Thread] = []

    print(f"[FLEET] Registering {len(fleet)} vehicle(s)...")
    for v in fleet:
        sim = VehicleSimulator(
            base_url   = args.url,
            device_id  = v["device_id"],
            name       = v.get("name", v["device_id"]),
            interval   = args.interval,
            cycle_secs = v.get("cycle_secs", 12),
            start_mode = v.get("start_mode", 0),
        )
        if not sim.register():
            print(f"[FLEET] Skipping {v['device_id']} — registration failed")
            continue
        t = threading.Thread(
            target=sim.run,
            args=(stop_event, args.count),
            name=v.get("name", v["device_id"]),
            daemon=True,
        )
        threads.append(t)

    if not threads:
        print("[FLEET] No vehicles registered. Exiting.")
        sys.exit(1)

    print(f"[FLEET] Starting {len(threads)} thread(s)...")
    for t in threads:
        t.start()

    try:
        while any(t.is_alive() for t in threads):
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[FLEET] Stopping all vehicles...")
        stop_event.set()
        for t in threads:
            t.join(timeout=5)
        print("[FLEET] All vehicles stopped.")

