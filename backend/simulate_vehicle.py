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
import math
import os
import random
import sys
import threading
import time
import urllib.request
import urllib.error

try:
    import paho.mqtt.client as mqtt_client
    MQTT_OK = True
except ImportError:
    MQTT_OK = False

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
                 interval: float, cycle_secs: float, start_mode: int,
                 force_tamper: bool = False):
        self.base_url      = base_url.rstrip("/")
        self.device_id     = device_id
        self.name          = name
        self.interval      = interval
        self.cycle_secs    = cycle_secs
        self.force_tamper  = force_tamper
        self.api_key       = ""
        self.device_secret = ""
        self.mode_index    = start_mode % len(MODES)
        self.last_cycle    = time.time()
        self.start_time    = time.time()
        self.last_update   = time.time()
        
        # Initial physics state based on starting mode
        m_name, m_spd, m_bat, m_bt, m_mt, m_rng, m_f, m_c = MODES[self.mode_index]
        self.state_speed      = 0.0 if m_name in ("Charging", "Motor Fault") else m_spd
        self.state_batt_pct   = float(m_bat)
        self.state_batt_temp  = float(m_bt)
        self.state_motor_temp = float(m_mt)
        self.tire_base_psi    = round(33.8 + random.uniform(-0.2, 0.2), 1)

        # Realistic story-arc personality sequences
        if "ALPHA" in device_id:
            self.mode_sequence = [0, 3, 0, 4, 6]  # Healthy -> Heavy Traffic -> Healthy -> Low Battery -> Charging
        elif "BETA" in device_id:
            self.mode_sequence = [0, 2, 2, 7, 0]  # Healthy -> Sport -> Sport -> Motor Fault -> Healthy
        elif "GAMMA" in device_id:
            self.mode_sequence = [0, 1, 1, 0, 1]  # Healthy -> Eco -> Eco -> Healthy -> Eco
        else:
            self.mode_sequence = list(range(len(MODES)))  # DELTA cycles all 8 modes
        self.seq_index = 0

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
        mode_name, target_speed, target_batt, target_batt_t, target_motor_t, _rng, fault, charge = MODES[self.mode_index]
        
        now = time.time()
        dt = now - self.last_update
        if dt > 10 or dt <= 0:
            dt = self.interval
        self.last_update = now

        # 1. High-Fidelity Speed Physics & Traffic Waves
        if mode_name in ("Charging", "Motor Fault"):
            dynamic_target = 0.0
            accel_rate = 22.0  # Safe braking to stop
        elif mode_name == "Heavy Traffic":
            # Real traffic wave cycle (36-second period): crawl -> slow -> stop -> re-accelerate
            t_wave = (now - self.start_time) % 36.0
            if t_wave < 12.0:
                dynamic_target = 13.0 + 3.0 * math.sin(t_wave * 0.5)
                accel_rate = 5.0
            elif t_wave < 20.0:
                # Coming to a smooth halt
                dynamic_target = max(0.0, 13.0 * (1.0 - (t_wave - 12.0) / 8.0))
                accel_rate = 6.0
            elif t_wave < 27.0:
                # Stopped in queue / red light
                dynamic_target = 0.0
                accel_rate = 10.0
            else:
                # Smooth acceleration away
                dynamic_target = 16.0 * ((t_wave - 27.0) / 9.0)
                accel_rate = 4.5
        elif mode_name == "Sport":
            # Dynamic spirited driving (102 - 114 km/h)
            surf = math.sin((now - self.start_time) / 14.0) * 4.5
            dynamic_target = 108.0 + surf
            accel_rate = 9.5 if dynamic_target > self.state_speed else 12.0
        elif mode_name == "Eco":
            # Steady efficient highway cruise (40 - 44 km/h)
            surf = math.sin((now - self.start_time) / 22.0) * 2.0
            dynamic_target = 42.0 + surf
            accel_rate = 4.5 if dynamic_target > self.state_speed else 6.0
        else:  # Healthy / Low Battery / Battery Overheating
            surf = math.sin((now - self.start_time) / 18.0) * 3.0
            dynamic_target = 58.0 + surf
            accel_rate = 6.5 if dynamic_target > self.state_speed else 8.5

        if self.state_batt_pct <= 0.0 and mode_name != "Charging":
            dynamic_target = 0.0
            accel_rate = 5.0

        # Smooth inertia-based acceleration
        speed_diff = dynamic_target - self.state_speed
        max_delta = accel_rate * dt
        if abs(speed_diff) <= max_delta:
            self.state_speed = dynamic_target
        else:
            self.state_speed += max_delta * (1.0 if speed_diff > 0 else -1.0)
        self.state_speed = max(0.0, min(140.0, self.state_speed))

        # Output speed with subtle road breath only when moving
        reported_speed = self.state_speed
        if reported_speed > 1.0:
            reported_speed += 0.35 * math.sin((now - self.start_time) * 1.8)
        reported_speed = max(0.0, round(reported_speed, 1))

        # 2. Continuous Physical Battery Modeling (Strictly Monotonic while Driving)
        if mode_name == "Charging":
            # Charging: vehicle stopped, battery smoothly climbs
            self.state_batt_pct = min(100.0, self.state_batt_pct + 0.08 * dt)
        else:
            # Physical drag & auxiliary consumption (never increases while driving)
            v_ratio = reported_speed / 100.0
            eff = 0.7 if mode_name == "Eco" else (2.0 if mode_name == "Sport" else 1.0)
            drain = (0.003 + (v_ratio ** 2) * 0.015 * eff) * dt
            self.state_batt_pct = max(0.0, self.state_batt_pct - drain)

            if mode_name == "Low Battery" and self.state_batt_pct > 14.5:
                # Believable smooth drift into the low-battery warning range
                self.state_batt_pct -= 0.12 * dt

        self.state_batt_pct = max(0.0, min(100.0, round(self.state_batt_pct, 2)))

        # 3. Progressive Thermal Modeling with Thermal Inertia
        motor_target = 35.0 + (reported_speed / 110.0) ** 1.4 * (48.0 if mode_name == "Sport" else 28.0)
        if mode_name == "Motor Fault":
            motor_target = 94.0
        self.state_motor_temp += (motor_target - self.state_motor_temp) * (0.08 * dt)

        batt_target = 29.0 + (reported_speed / 110.0) * 8.0
        if mode_name == "Battery Overheating":
            batt_target = 64.0
        elif mode_name == "Charging":
            batt_target = 36.0
        self.state_batt_temp += (batt_target - self.state_batt_temp) * (0.05 * dt)

        # 4. Realistic Physical Range & Multi-Factor Parameters
        km_per_pct = 3.8 if mode_name == "Eco" else (2.1 if mode_name == "Sport" else 3.1)
        headwind = max(0.0, round(12.0 + 4.0 * math.sin(now / 15.0), 1))
        gradient = round(1.2 * math.sin(now / 20.0), 1)
        estimated_range = max(0.0, round(self.state_batt_pct * km_per_pct * (1.0 - gradient * 0.03), 1))

        # 5. Tire Pressure (TPMS) — Fully Bounded, NEVER NULL
        tire_thermal = min(0.8, (reported_speed / 100.0) * 0.7)
        reported_tire_psi = round(self.tire_base_psi + tire_thermal + 0.1 * math.sin(now / 30.0), 1)

        # 6. Cabin Climate & Cell Voltage Balance
        climate_draw = round(480.0 + 40.0 * math.sin(now / 40.0), 1)
        cell_delta = round(0.010 + 0.004 * (reported_speed / 110.0), 3)

        return {
            "device_id":              self.device_id,
            "schema_version":         "1.0",
            "timestamp_ms":           int((time.time() - self.start_time) * 1000),
            "mode":                   mode_name,
            "speed_kmh":              reported_speed,
            "battery_pct":            self.state_batt_pct,
            "battery_temp_c":         round(self.state_batt_temp, 1),
            "motor_temp_c":           round(self.state_motor_temp, 1),
            "range_km":               estimated_range,
            "fault_code":             fault,
            "charging_rate_w":        charge,
            "ambient_temp_c":         25.0,
            "headwind_kmh":           headwind,
            "road_gradient_pct":      gradient,
            "tire_pressure_psi":      reported_tire_psi,
            "cabin_climate_w":        climate_draw,
            "max_cell_voltage_delta": cell_delta,
        }

    def send_http(self, packet: dict, encryption_enabled: bool, tamper: bool = False) -> tuple[int, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key

        if encryption_enabled and CRYPTO_OK and self.device_secret:
            plaintext = json.dumps(packet)
            sig = sign_hmac(self.device_secret, plaintext)
            envelope = aes_gcm_encrypt(self.device_secret, plaintext)
            if tamper:
                # Mutate ciphertext to cause AES-GCM tag mismatch
                ct = envelope["ct"]
                mutated_ct = ("00" if ct[:2] != "00" else "ff") + ct[2:]
                envelope["ct"] = mutated_ct
            headers["X-HMAC-Signature"] = sig
            headers["X-Encrypted"] = "true"
            body = json.dumps(envelope).encode()
        else:
            payload_str = json.dumps(packet)
            sig = sign_hmac(self.device_secret, payload_str) if self.device_secret else ""
            if self.device_secret:
                headers["X-HMAC-Signature"] = sig
            if tamper:
                # Mutate payload post-signature to trigger HMAC mismatch
                tampered_pkt = dict(packet)
                tampered_pkt["speed_kmh"] = round(tampered_pkt.get("speed_kmh", 50.0) + 123.4, 1)
                body = json.dumps(tampered_pkt).encode()
            else:
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

    def send_mqtt(self, packet: dict, encryption_enabled: bool, tamper: bool = False) -> tuple[int, str]:
        """Publish a telemetry packet via MQTT to the local broker."""
        if not MQTT_OK:
            return 500, "paho-mqtt not installed"

        BROKER_HOST = "localhost"
        BROKER_PORT = 1883
        topic = f"cvis/telemetry/{self.device_id}"

        if encryption_enabled and CRYPTO_OK and self.device_secret:
            plaintext = json.dumps(packet)
            sig = sign_hmac(self.device_secret, plaintext)
            envelope = aes_gcm_encrypt(self.device_secret, plaintext)
            if tamper:
                ct = envelope["ct"]
                envelope["ct"] = ("00" if ct[:2] != "00" else "ff") + ct[2:]
            payload = json.dumps({
                "_meta": {"api_key": self.api_key, "hmac": sig},
                "encrypted": True,
                **envelope,
            })
        else:
            payload_str = json.dumps(packet)
            sig = sign_hmac(self.device_secret, payload_str) if self.device_secret else ""
            if tamper:
                tampered_pkt = dict(packet)
                tampered_pkt["speed_kmh"] = round(tampered_pkt.get("speed_kmh", 50.0) + 123.4, 1)
                payload = json.dumps({
                    "_meta": {"api_key": self.api_key, "hmac": sig},
                    **tampered_pkt,
                })
            else:
                payload = json.dumps({
                    "_meta": {"api_key": self.api_key, "hmac": sig},
                    **packet,
                })

        if not hasattr(self, "_mqtt_client") or self._mqtt_client is None:
            try:
                c = mqtt_client.Client(
                    mqtt_client.CallbackAPIVersion.VERSION2,
                    client_id=f"{self.device_id}-{random.randint(1000, 9999)}",
                )
                c.connect(BROKER_HOST, BROKER_PORT, keepalive=30)
                c.loop_start()
                self._mqtt_client = c
            except Exception as e:
                return 500, str(e)

        try:
            result = self._mqtt_client.publish(topic, payload, qos=1)
            result.wait_for_publish(timeout=2)
            return 200, "mqtt ok"
        except Exception as e:
            try:
                self._mqtt_client.loop_stop()
                self._mqtt_client.disconnect()
            except Exception:
                pass
            self._mqtt_client = None
            return 500, str(e)

    def run(self, stop_event: threading.Event, max_packets: int = 0, callback = None):
        print(f"[{self.name}] Starting — mode={MODES[self.mode_index][0]}, "
              f"interval={self.interval}s, cycle={self.cycle_secs}s")
        count = 0
        while not stop_event.is_set():
            # Cycle mode along personality sequence
            if time.time() - self.last_cycle >= self.cycle_secs:
                self.seq_index = (self.seq_index + 1) % len(self.mode_sequence)
                self.mode_index = self.mode_sequence[self.seq_index]
                self.last_cycle = time.time()
                print(f"[{self.name}] Mode -> {MODES[self.mode_index][0]}")

            cfg        = self.get_backend_config()
            force_mode = cfg.get("force_mode")
            if force_mode:
                # Find index of force_mode
                for i, m in enumerate(MODES):
                    if m[0] == force_mode:
                        self.mode_index = i
                        break

            encryption = cfg.get("encryption_enabled", False)
            protocol   = cfg.get("active_protocol", "http")
            tamper     = self.force_tamper or cfg.get("chaos", {}).get("tamper", False)
            pkt        = self.generate_packet()

            # Transmission with CCNS Ack + Backoff Retry mechanism
            max_retries = 2
            attempts = 0
            code = 500
            retry_tag = ""
            while attempts <= max_retries and not stop_event.is_set():
                if protocol == "mqtt" and MQTT_OK:
                    code, _ = self.send_mqtt(pkt, encryption, tamper=tamper)
                else:
                    code, _ = self.send_http(pkt, encryption, tamper=tamper)

                if code in (200, 401):  # 200 = OK, 401 = rejected (auth/tamper intentional)
                    break

                # 503 (chaos packet loss) or transient socket drop -> backoff and retry
                attempts += 1
                if attempts <= max_retries:
                    retry_tag = f"[RETRY-{attempts}]"
                    backoff = 0.15 * (2 ** (attempts - 1))
                    time.sleep(backoff)

            count += 1
            if callback:
                try:
                    callback(protocol, encryption, tamper, code, attempts > 0)
                except Exception:
                    pass

            enc_str    = "[ENC]" if encryption else "[PLN]"
            tamper_str = "[TAMPER]" if tamper else "        "
            proto_str  = protocol.upper()
            status_str = "OK" if code == 200 else f"ERR{code}"
            print(f"[{self.name}] #{count:04d} {enc_str} {tamper_str} [{proto_str}] {retry_tag:<10} {pkt['mode']:<20} "
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
    parser.add_argument("--tamper",   action="store_true",      help="Force inject payload tampering for testing rejection")
    parser.add_argument("--charge",   action="store_true",      help="Force charging mode")
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
            base_url     = args.url,
            device_id    = v["device_id"],
            name         = v.get("name", v["device_id"]),
            interval     = args.interval,
            cycle_secs   = 999999 if args.charge else v.get("cycle_secs", 60),
            start_mode   = 6 if args.charge else v.get("start_mode", 0),
            force_tamper = args.tamper,
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

