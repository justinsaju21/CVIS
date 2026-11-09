import paho.mqtt.client as mqtt
import json, time, sqlite3
import hmac, hashlib

conn = sqlite3.connect('backend/cvis.db')
dev = conn.cursor().execute("SELECT api_key, device_secret FROM devices WHERE device_id = 'ESP32-ALPHA' AND active = 1 ORDER BY registered_at DESC LIMIT 1").fetchone()
if not dev:
    print("Device not found")
    exit(1)
api_key, secret = dev[0], dev[1]

def sign_hmac(secret_hex, payload_str):
    return hmac.new(bytes.fromhex(secret_hex), payload_str.encode(), hashlib.sha256).hexdigest()

packet = {
    'device_id': 'ESP32-ALPHA',
    'schema_version': '1.0',
    'timestamp_ms': int(time.time() * 1000),
    'mode': 'Sport',
    'speed_kmh': 115.0,
    'battery_pct': 72.0,
    'battery_temp_c': 35.0,
    'motor_temp_c': 65.0,
    'range_km': 190.0,
    'fault_code': 0,
    'charging_rate_w': 0.0,
    'ambient_temp_c': 25.0,
    'headwind_kmh': 10.0,
    'road_gradient_pct': 0.0,
    'tire_pressure_psi': 34.0,
    'cabin_climate_w': 500.0,
    'max_cell_voltage_delta': 0.01,
}

payload_str = json.dumps(packet)
sig = sign_hmac(secret, payload_str)
mqtt_payload = json.dumps({
    '_meta': {'api_key': api_key, 'hmac': sig},
    **packet
})

c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id='test-pub')
c.connect('localhost', 1883, keepalive=10)
c.loop_start()
info = c.publish('cvis/telemetry/ESP32-ALPHA', mqtt_payload, qos=1)
info.wait_for_publish(timeout=3)
time.sleep(1)
c.loop_stop()
c.disconnect()

conn = sqlite3.connect('backend/cvis.db')
row = conn.cursor().execute('SELECT id, protocol, device_id FROM packets ORDER BY id DESC LIMIT 1').fetchone()
print(f'Latest Packet in DB -> ID: {row[0]}, Protocol: {row[1]}, Device: {row[2]}')
