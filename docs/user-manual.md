# CVIS — User Manual

**Version:** 1.0  
**System:** Connected Vehicle Intelligence System  
**Audience:** Academic evaluators, demo operators, developers

---

## 1. Overview

CVIS is a three-tier demonstration system showing how a connected vehicle securely transmits telemetry to a centralised AI reasoning layer. The system consists of:

| Tier | Component | Location |
|---|---|---|
| Vehicle Node | ESP32 firmware (simulated) | `firmware/` |
| Backend | FastAPI + SQLite + Ollama | `backend/` |
| Frontend | Unified Next.js app | `frontend/` |

---

## 2. Starting the System

### 2.1 Start the Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:asgi_app --host 0.0.0.0 --port 8000
```

The backend will:
- Initialise the SQLite database at `backend/cvis.db`
- Restore chaos/auth settings from the previous session
- Attempt to connect to a local Mosquitto MQTT broker (non-fatal if not running)
- Start accepting HTTP telemetry on `POST http://localhost:8000/api/v1/telemetry`

### 2.2 Start Ollama AI (optional but recommended)

```bash
ollama serve
ollama pull llama3.2:3b
```

If Ollama is not running, the system degrades gracefully — telemetry still flows, AI recommendations are skipped.

### 2.3 Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open your browser to `http://localhost:3000`.

### 2.4 Simulate Vehicle Telemetry

Run the simulator script to push live telemetry into the system:

```bash
cd backend
python test_phase6.py
```

Or, with a physical ESP32, flash `firmware/firmware.ino` (copy `firmware/secrets.h.example` to `firmware/secrets.h` first).

---

## 3. Driver Dashboard (`/driver`)

The Driver view shows a real-time health dashboard for the connected vehicle.

| Widget | Description |
|---|---|
| **Mode Badge** | Current vehicle mode (Healthy / Eco / Sport / etc.) |
| **Battery Arc** | Animated circular gauge showing battery %. Red < 20%, amber < 40%. |
| **Speed** | Current speed in km/h |
| **Range** | Estimated remaining range in km |
| **Motor Temp** | Motor temperature — amber > 70°C, red > 85°C |
| **Charging Rate** | Current charge rate in kW |
| **Battery History** | 60-point rolling area chart of battery % |
| **Speed + Motor Temp** | Dual-series history chart |
| **AI Recommendation** | Live AI-generated advice from Ollama, typewriter-animated |
| **Alert Feed** | Critical mode alerts with colour-coded severity |
| **Chat with CVIS** | Free-text chat grounded in current telemetry |

### AI Chat Tips
- "What is wrong with the vehicle right now?"
- "Should I stop driving immediately?"
- "How long will the battery last at current speed?"

---

## 4. NOC — Network Operations Centre (`/noc`)

The NOC is the primary demonstration surface for CCNS concepts.

### 4.1 Live Packet Visualisation

A left-to-right animated packet flow shows every telemetry packet as it travels from the vehicle node (left) to the CVIS server (right). Colour indicates protocol:
- **Cyan** — HTTP
- **Amber** — MQTT
- **Red** — Rejected / tampered

### 4.2 Packet Table

Every packet is logged with:

| Column | Description |
|---|---|
| `#` | Packet sequence number |
| `Device` | Source device ID |
| `Protocol` | HTTP or MQTT |
| `Time` | Server receipt timestamp |
| `Size` | Payload size in bytes |
| `Auth` | auth_ok / auth_fail / no_auth |
| `Encrypted` | Yes / No |
| `Status` | ok / rejected / dropped |

Click any row to open the **Packet Inspector** with full JSON payload, headers, and AI response.

### 4.3 Live Controls

All controls cause immediate, real backend behaviour changes:

| Control | Effect |
|---|---|
| **Protocol Switch** | Switch ESP32 ↔ backend between HTTP REST and MQTT (no restart) |
| **Encryption Toggle** | Tell ESP32 to start/stop AES-256-GCM encryption |
| **Auth Toggle** | Enable/disable API-key + HMAC verification. Packets still flow but logged as `no_auth` when disabled |
| **Packet Loss (0/5/10/25%)** | Backend probabilistically drops N% of packets before processing |
| **Latency (0/100/300/1000ms)** | Backend injects N ms delay before processing |
| **Tamper Injector** | Backend mutates 1 byte of the payload after the signature — HMAC check will fail on the next packet |
| **Disconnect Vehicle** | Deactivates the device — subsequent packets return 401 |
| **Stop AI** | Disables AI inference — telemetry still flows but no recommendations are generated |

---

## 5. Admin Console (`/admin`)

The Admin view provides operational oversight.

| Section | Data |
|---|---|
| **Server Stats** | Uptime, active WebSocket connections, phase |
| **System Resources** | Live CPU %, memory usage (via psutil) |
| **Packet Statistics** | Total / ok / rejected counts, protocol breakdown |
| **Packet Timeline** | Bar chart of packet volume per hour |
| **Mode Distribution** | Pie chart of vehicle mode frequencies |
| **Auth Security** | Auth failures, tamper events, auth enabled state |
| **AI Status** | Ollama running state, model loaded, service enabled |
| **Chaos State** | Current loss %, latency, tamper state |
| **Connected Devices** | All registered devices, last seen, last mode |
| **Auth Log** | Filterable event log: auth_ok, auth_fail, tamper_detected, registered |

---

## 6. Vehicle Modes Reference

| Mode | Telemetry Characteristics | Alert |
|---|---|---|
| Healthy | Speed 60–100 km/h, battery 60–95%, temp 35–55°C | None |
| Eco | Speed 30–60 km/h, battery 40–80%, regen active | None |
| Sport | Speed 80–140 km/h, battery drain fast, temp 60–80°C | None |
| Heavy Traffic | Speed 0–20 km/h, stop-start, temp moderate | None |
| Low Battery | Battery < 20%, reduced range | ⚠ Warning |
| Battery Overheating | Temp > 45°C, reduced range, fault code set | 🔴 Fault |
| Charging | Speed 0, charging rate 6–11 kW | None |
| Motor Fault | Fault code non-zero, reduced speed | 🔴 Fault |

---

## 7. Common Scenarios for Demo

### Demo A — Normal Operation
1. Start backend + frontend + simulator
2. Navigate to `/driver` — watch live telemetry, battery arc, AI recommendations

### Demo B — Tamper Detection
1. Open `/noc`
2. Click **Tamper Inject** — backend will mutate next payload
3. Observe: packet row turns red, status = `rejected`, auth log shows `tamper_detected`

### Demo C — Protocol Switch
1. Click **MQTT** in the NOC protocol control
2. Start a Mosquitto broker (`mosquitto`) in a separate terminal
3. Observe packet colour change from cyan → amber

### Demo D — Chaos Simulation
1. Set Packet Loss to **25%** in the NOC
2. Watch packet table — ~1 in 4 packets shows `dropped`
3. Observe AI adapter handles gaps gracefully

### Demo E — AI Shutdown
1. Click **Stop AI** in the NOC
2. Send telemetry — packets arrive, but `/driver` AI panel stops updating
3. Click **Start AI** — recommendations resume
