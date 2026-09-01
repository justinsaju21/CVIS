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

def sign(secret_hex: str, payload_str: str) -> str:
    key = bytes.fromhex(secret_hex)
    return hmac.new(key, payload_str.encode(), hashlib.sha256).hexdigest()

class VehicleState:
    def __init__(self, device_id: str):
        self.device_id = device_id
        
        # Base stats
        self.mode = "Healthy"
        self.fault_code = 0x00
        
        # Physics state
        self.speed_kmh = 60.0
        self.battery_pct = 95.0
        self.battery_temp_c = 30.0
        self.motor_temp_c = 45.0
        self.charging_rate_w = 0.0
        
        # Advanced physics (Environment)
        self.ambient_temp_c = 25.0
        self.headwind_kmh = 10.0
        self.road_gradient_pct = 0.0
        self.tire_pressure_psi = 34.0
        self.cabin_climate_w = 500.0
        self.max_cell_voltage_delta = 0.01

        # Internal targets
        self.target_speed = 60.0
        self.tick_counter = 0

    def calculate_range(self) -> float:
        # Simplistic range calculation: 3 km per 1% battery at ideal conditions
        base_range = self.battery_pct * 3.0
        # Penalties
        if self.tire_pressure_psi < 32:
            base_range *= 0.9
        if self.headwind_kmh > 20:
            base_range *= 0.85
        if self.cabin_climate_w > 1000:
            base_range *= 0.95
        return max(0.0, base_range)

    def tick(self, delta_t_sec: float = 2.0):
        self.tick_counter += 1
        
        # 1. Environment drift (slowly changing weather/road)
        if self.tick_counter % 5 == 0:
            self.road_gradient_pct += random.uniform(-1.0, 1.0)
            self.road_gradient_pct = max(-10.0, min(10.0, self.road_gradient_pct))
            
            self.headwind_kmh += random.uniform(-2.0, 2.0)
            self.headwind_kmh = max(0.0, min(50.0, self.headwind_kmh))
            
        # 2. Driver behavior (change target speed occasionally)
        if self.tick_counter % 10 == 0 and self.fault_code == 0:
            self.target_speed += random.uniform(-15.0, 15.0)
            self.target_speed = max(0.0, min(120.0, self.target_speed))
            
        # Smoothly accelerate/decelerate towards target speed
        if self.speed_kmh < self.target_speed:
            self.speed_kmh += 2.0 * (delta_t_sec / 1.0)
        elif self.speed_kmh > self.target_speed:
            self.speed_kmh -= 2.0 * (delta_t_sec / 1.0)
            
        self.speed_kmh = max(0.0, self.speed_kmh)

        # 3. Calculate physics Load Factor
        # Load increases with speed, uphill gradient, headwind, and low tire pressure
        aero_drag = (self.speed_kmh + self.headwind_kmh) ** 2 / 10000.0
        gravity_drag = self.road_gradient_pct * 0.5
        tire_drag = max(0, (36.0 - self.tire_pressure_psi) * 0.1)
        
        load_factor = (self.speed_kmh / 50.0) + aero_drag + gravity_drag + tire_drag
        load_factor = max(0.1, load_factor) # minimum idle load
        
        if self.speed_kmh == 0:
            load_factor = 0.1
            
        # 4. Apply physics to components
        
        # Battery drain (accelerated for demo purposes)
        drain_rate = load_factor * 0.1 * (delta_t_sec / 1.0)
        drain_rate += (self.cabin_climate_w / 5000.0) * (delta_t_sec / 1.0) # AC load
        
        self.battery_pct -= drain_rate
        self.battery_pct = max(0.0, self.battery_pct)
        
        # Motor temperature (heats up based on load, cools down towards ambient)
        heating = load_factor * 2.0 * (delta_t_sec / 1.0)
        cooling = (self.motor_temp_c - self.ambient_temp_c) * 0.05 * (delta_t_sec / 1.0)
        self.motor_temp_c += (heating - cooling)
        
        # Battery temperature (heats up based on discharge rate)
        batt_heating = drain_rate * 5.0
        batt_cooling = (self.battery_temp_c - self.ambient_temp_c) * 0.02 * (delta_t_sec / 1.0)
        self.battery_temp_c += (batt_heating - batt_cooling)

        # 5. Determine Mode & Faults based on state
        self.fault_code = 0x00
        self.mode = "Healthy"
        
        if self.speed_kmh > 80.0:
            self.mode = "Sport"
        elif self.speed_kmh > 0 and self.speed_kmh < 30.0:
            self.mode = "Heavy Traffic"
        elif self.speed_kmh == 0 and self.charging_rate_w > 0:
            self.mode = "Charging"
            
        # Check critical states (override normal modes)
        if self.battery_pct <= 15.0:
            self.mode = "Low Battery"
            
        if self.battery_pct <= 0:
            self.speed_kmh = 0
            self.target_speed = 0
            
        if self.motor_temp_c > 95.0:
            self.fault_code = 0x04
            self.mode = "Motor Fault"
            self.target_speed = 0 # Force stop
            
        if self.battery_temp_c > 60.0:
            self.fault_code = 0x02
            self.mode = "Battery Overheating"
            self.target_speed = min(self.target_speed, 40.0) # Limp mode

    def get_packet(self) -> dict:
        return {
            "device_id":      self.device_id,
            "schema_version": "1.0",
            "timestamp_ms":   int(time.time() * 1000),
            "mode":           self.mode,
            "speed_kmh":      round(self.speed_kmh, 2),
            "battery_pct":    round(self.battery_pct, 2),
            "battery_temp_c": round(self.battery_temp_c, 2),
            "motor_temp_c":   round(self.motor_temp_c, 2),
            "range_km":       round(self.calculate_range(), 2),
            "fault_code":     self.fault_code,
            "charging_rate_w": round(self.charging_rate_w, 2),
            "ambient_temp_c": round(self.ambient_temp_c, 1),
            "headwind_kmh": round(self.headwind_kmh, 1),
            "road_gradient_pct": round(self.road_gradient_pct, 1),
            "tire_pressure_psi": round(self.tire_pressure_psi, 1),
            "cabin_climate_w": round(self.cabin_climate_w, 1),
            "max_cell_voltage_delta": round(self.max_cell_voltage_delta, 3),
        }

def main():
    print(f"Registering simulator device {DEVICE_ID}...")
    req = urllib.request.Request(f"{BASE}/api/v1/admin/deactivate-device?device_id={DEVICE_ID}", method="POST")
    try: urllib.request.urlopen(req)
    except: pass
    
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

    print("Starting stateful physics simulation (Ctrl+C to stop)...")
    
    vehicle = VehicleState(DEVICE_ID)
    
    # Introduce an initial problem to make it interesting for the AI
    vehicle.tire_pressure_psi = 28.0  # Under-inflated
    vehicle.road_gradient_pct = 4.0   # Driving uphill
    vehicle.target_speed = 90.0       # Driving fast
    
    while True:
        try:
            # Advance physics engine by 2 real-world seconds
            vehicle.tick(delta_t_sec=2.0)
            
            pkt = vehicle.get_packet()
            pkt_str = json.dumps(pkt)
            sig = sign(secret, pkt_str)
            
            req = urllib.request.Request(
                f"{BASE}/api/v1/telemetry",
                data=pkt_str.encode(),
                headers={"Content-Type": "application/json", "X-API-Key": api_key, "X-HMAC-Signature": sig},
                method="POST"
            )
            resp = urllib.request.urlopen(req)
            print(f"Sent {pkt['mode']} telemetry (Batt: {pkt['battery_pct']}%, Motor: {pkt['motor_temp_c']}°C, Speed: {pkt['speed_kmh']} km/h)")
            
            time.sleep(2)
        except Exception as e:
            print(f"Error sending telemetry: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
