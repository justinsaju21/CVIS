# Master Summary & Architecture Reference
**Project:** Connected Vehicle Intelligence System (CVIS)
**Context:** Computer Communication & Network Security (CCNS) Academic Project
**Architecture:** Tri-tier (Hardware Node ⇄ Secure Transport ⇄ Cloud AI)

---

## 1. Executive Summary
CVIS demonstrates a next-generation automotive architecture where edge devices (vehicles) act as thin, secure telemetry nodes, offloading heavy compute (AI reasoning) to a centralised cloud environment. The project heavily emphasizes **Network Security** (JWT, AES-GCM, HMAC-SHA256), **Reliability** (MQTT vs HTTP, Retry mechanisms), and **Pedagogical Chaos Simulation** (packet loss, tampering, and latency injection at the middleware layer).

## 2. System Architecture & Tech Stack

The architecture is divided into three distinct layers, seamlessly connected via standard network protocols:

### A. The Vehicle Node (Edge)
- **Firmware:** C++ (Arduino framework) running on an ESP32.
- **Role:** Gathers and generates telemetry, maintains internal state physics, authenticates with the backend, encrypts payloads, and publishes via HTTP or MQTT.
- **Simulator Fallback:** A multi-threaded Python simulator (`simulate_vehicle.py`) mimics 4 distinct ESP32 nodes for concurrent load testing when hardware is unavailable.

### B. The Communication Layer & Backend (Cloud)
- **Framework:** Python FastAPI
- **Database:** SQLite
- **Networking Adapters:** 
  - `http_router.py`: Handles synchronous HTTP POST requests.
  - `mqtt_adapter.py`: A background daemon running `paho-mqtt` that bridges asynchronous publish/subscribe topics into the FastAPI event loop.
- **Chaos Middleware:** Raw ASGI middleware intercepts requests before routing to apply artificial packet loss (503s), latency (sleeps), and tampering (payload mutation post-signature) for live demonstration.

### C. The Frontend (Client)
- **Framework:** Next.js (React) + Tailwind CSS + Framer Motion
- **Role:** A unified application presenting three role-gated views:
  1. `/driver`: The in-car dashboard.
  2. `/noc`: The Network Operations Centre for protocol and chaos control.
  3. `/admin`: The fleet management and logging console.
- **Data Transport:** Uses a single, shared WebSocket connection (`useWebSocket.ts`) to stream real-time telemetry and AI recommendations from the backend to all three views without polling.

## 3. The Stateful Physics Engine
Rather than passing static or randomly fluctuating numbers, both the physical ESP32 firmware and the Python simulator utilise a **Continuous Stateful Physics Engine**. This mathematically simulates a real vehicle:

- **Inertia Loop:** When a drive mode is changed (e.g., *Healthy* to *Sport*), the target speed shifts. The physics engine calculates delta time (`dt`) and applies an acceleration rate, smoothly spooling the speed dial up or down over several seconds.
- **Battery Depletion:** The vehicle calculates power draw based on aerodynamic drag (speed squared) and the mode's specific efficiency profile. The battery drops continuously over time based on actual usage.
- **Dynamic Range Math:** Range is not hardcoded. It is calculated live: `Remaining Range = Current Battery % × Mode Efficiency Factor`. Switching to an aggressive mode instantly slashes the range estimate.
- **Interconnection:** If the battery hits exactly `0.0%`, the engine forcibly cuts the target speed to `0 km/h`, stopping the vehicle regardless of user input.

## 4. Security Implementation Loop
The security architecture operates on a strict verification chain:
1. **Provisioning:** The ESP32 calls `/api/v1/devices/register` to receive a unique API Key and a cryptographically secure `device_secret`.
2. **Integrity (HMAC):** For every packet, the ESP32 hashes the payload using HMAC-SHA256 and attaches it as a header (`X-HMAC-Signature`).
3. **Confidentiality (AES-GCM):** If enabled by the NOC, the ESP32 encrypts the payload body before transmission, passing the Ciphertext, IV, and Auth Tag.
4. **Verification:** The backend recalculates the HMAC. If it fails (e.g., the Chaos Middleware tampered with the payload), the backend rejects the packet, demonstrating true payload integrity protection.
