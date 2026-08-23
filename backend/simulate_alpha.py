from simulate_vehicle import VehicleSimulator, fetch_fleet
import argparse
import sys
import threading

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Simulator for ESP32-ALPHA")
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--interval", type=float, default=2.0)
    args = parser.parse_args()
    
    fleet = fetch_fleet(args.url)
    v_info = next((v for v in fleet if v["device_id"] == "ESP32-ALPHA"), None)
    
    if not v_info:
        print("[ESP32-ALPHA] Not found in backend fleet configuration.")
        sys.exit(1)
        
    sim = VehicleSimulator(
        base_url=args.url,
        device_id=v_info["device_id"],
        name=v_info.get("name", "ESP32-ALPHA"),
        interval=args.interval,
        cycle_secs=v_info.get("cycle_secs", 12),
        start_mode=v_info.get("start_mode", 0),
    )
    
    if not sim.register():
        sys.exit(1)
        
    stop_event = threading.Event()
    try:
        sim.run(stop_event)
    except KeyboardInterrupt:
        print("\n[ESP32-ALPHA] Stopping simulator...")
        stop_event.set()
