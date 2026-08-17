#!/usr/bin/env python3
import json
import time
import urllib.request
import urllib.error
import random
import hmac
import hashlib

BASE = "http://127.0.0.1:8000"
DEVICE_ID = "SIM-001"

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

def sign(secret_hex: str, payload_str: str) -> str:
    key = bytes.fromhex(secret_hex)
    return hmac.new(key, payload_str.encode(), hashlib.sha256).hexdigest()

def make_packet(device_id: str, mode_tuple: tuple, ts: int) -> dict:
    mode, speed, batt, batt_t, motor_t, rng, fault, charge = mode_tuple
    # Add some randomness to values to make them look alive
    speed = speed + random.uniform(-2, 2) if speed > 0 else 0
    batt_t = batt_t + random.uniform(-1, 1)
    motor_t = motor_t + random.uniform(-1.5, 1.5)
    return {
        "device_id":      device_id,
        "schema_version": "1.0",
        "timestamp_ms":   ts,
        "mode":           mode,
        "speed_kmh":      round(float(speed), 2),
        "battery_pct":    float(batt),
        "battery_temp_c": round(float(batt_t), 2),
        "motor_temp_c":   round(float(motor_t), 2),
        "range_km":       float(rng),
        "fault_code":     fault,
        "charging_rate_w": float(charge),
    }

def main():
    print(f"Registering simulator device {DEVICE_ID}...")
    # Deactivate just in case it exists to reset
    req = urllib.request.Request(f"{BASE}/api/v1/admin/deactivate-device?device_id={DEVICE_ID}", method="POST")
    try: urllib.request.urlopen(req)
    except: pass
    
    # Register device
    req = urllib.request.Request(f"{BASE}/api/v1/devices/register", 
                                 data=json.dumps({"device_id": DEVICE_ID}).encode(),
                                 headers={"Content-Type": "application/json"},
                                 method="POST")
    try:
        resp = urllib.request.urlopen(req)
        creds = json.loads(resp.read())
        api_key = creds["api_key"]
        secret = creds["device_secret"]
        print(f"Successfully registered. API Key: {api_key[:8]}...")
    except Exception as e:
        print(f"Failed to register device: {e}")
        return

    print("Starting continuous simulation (Ctrl+C to stop)...")
    
    current_mode_idx = 0
    mode_ticks = 0
    
    while True:
        try:
            # Change mode every ~10 ticks
            if mode_ticks >= 10:
                current_mode_idx = (current_mode_idx + 1) % len(VEHICLE_MODES)
                mode_ticks = 0
                print(f"\n--- Switched to mode: {VEHICLE_MODES[current_mode_idx][0]} ---")
            
            mode_tuple = VEHICLE_MODES[current_mode_idx]
            pkt = make_packet(DEVICE_ID, mode_tuple, int(time.time() * 1000))
            pkt_str = json.dumps(pkt)
            sig = sign(secret, pkt_str)
            
            req = urllib.request.Request(
                f"{BASE}/api/v1/telemetry",
                data=pkt_str.encode(),
                headers={"Content-Type": "application/json", "X-API-Key": api_key, "X-HMAC-Signature": sig},
                method="POST"
            )
            resp = urllib.request.urlopen(req)
            print(f"Sent {pkt['mode']} telemetry - Status {resp.status}")
            
            mode_ticks += 1
            time.sleep(2)
        except Exception as e:
            print(f"Error sending telemetry: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
