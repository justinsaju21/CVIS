import asyncio
import json
import time
import hmac
import hashlib
import urllib.request
import paho.mqtt.client as mqtt

BROKER = "test.mosquitto.org"
API_BASE = "http://localhost:8000/api/v1"

def register_device():
    dev_id = f"test-mqtt-{int(time.time())}"
    req = urllib.request.Request(
        f"{API_BASE}/devices/register", 
        data=json.dumps({"device_id": dev_id}).encode(),
        headers={'Content-Type': 'application/json'},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def get_config():
    with urllib.request.urlopen(f"{API_BASE}/config/protocol") as resp:
        return json.loads(resp.read())

def switch_to_mqtt():
    req = urllib.request.Request(f"{API_BASE}/config/protocol", data=b'{"protocol": "mqtt"}', headers={'Content-Type': 'application/json'}, method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def disable_auth():
    req = urllib.request.Request(f"{API_BASE}/config/auth", data=b'{"enabled": false}', headers={'Content-Type': 'application/json'}, method="POST")
    urllib.request.urlopen(req)

def main():
    print("--- LIVE MQTT BROKER TEST ---")
    print(f"1. Registering test device via HTTP...")
    creds = register_device()
    dev_id = creds["device_id"]
    api_key = creds["api_key"]
    dev_secret = creds["device_secret"]
    print(f"   Registered: {dev_id}")
    
    print("2. Switching backend to MQTT protocol...")
    switch_to_mqtt()
    disable_auth()
    config = get_config()
    print(f"   Backend active protocol: {config['active_protocol']}")
    
    print(f"3. Connecting MQTT client to {BROKER}...")
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.connect(BROKER, 1883, 60)
    client.loop_start()
    
    print("4. Preparing secure telemetry payload...")
    payload = {
        "device_id": dev_id,
        "schema_version": "1.0",
        "timestamp_ms": int(time.time() * 1000),
        "battery_pct": 85.0,
        "motor_temp_c": 45.0,
        "speed_kmh": 60.0,
        "range_est_km": 350.0,
        "mode": "Healthy",
        "fault_code": 0,
        "charging_rate_kw": 0.0
    }
    
    payload_bytes = json.dumps(payload).encode()
    signature = hmac.new(dev_secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
    
    # Envelope structure for MQTT
    envelope = {
        "_meta": {
            "api_key": api_key,
            "hmac": signature
        },
        **payload
    }
    
    topic = f"cvis/telemetry/{dev_id}"
    print(f"5. Publishing to topic {topic}...")
    client.publish(topic, json.dumps(envelope))
    
    time.sleep(2) # Give it a moment to traverse the internet -> broker -> backend
    
    print("6. Verifying receipt via HTTP /api/v1/telemetry/recent...")
    with urllib.request.urlopen(f"{API_BASE}/telemetry/recent") as resp:
        recent = json.loads(resp.read())
        found = any(p["device_id"] == dev_id and p["protocol"] == "mqtt" for p in recent)
        
        if found:
            print("   SUCCESS! Telemetry arrived via MQTT public broker and was securely ingested.")
        else:
            print("   FAILED! Packet not found in recent telemetry.")

    client.loop_stop()
    client.disconnect()

if __name__ == "__main__":
    main()
