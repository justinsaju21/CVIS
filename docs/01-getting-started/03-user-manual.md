# CVIS — User Manual

**System:** Connected Vehicle Intelligence System (CVIS)  
**Live URL:** `https://cvis.justinsaju.me`  
**Audience:** Academic evaluators, demo operators, developers

---

## 1. What is CVIS?

CVIS demonstrates a **centralised vehicle intelligence architecture**. The thesis: AI should live in the cloud (data centre), not embedded per-vehicle. The vehicle is a thin, securely-networked client.

The system has three physical layers:

| Layer | Component | What it Does |
|---|---|---|
| **Vehicle Node** | ESP8266 firmware | Simulates vehicle telemetry, signs every packet with HMAC-SHA256, sends every 2 seconds |
| **Backend** | FastAPI + SQLite + Ollama | Receives packets, verifies auth/integrity, persists to DB, broadcasts in real-time, runs AI |
| **Frontend** | Unified Next.js app | Three role-gated views: Driver, NOC, Admin |

Everything is live on the internet via Cloudflare Tunnel — no port forwarding, no VPN.

---

## 2. Accessing the System

| URL | View | Purpose |
|---|---|---|
| `https://cvis.justinsaju.me/driver/alpha` | Driver Dashboard | Vehicle health, AI recommendations, chat |
| `https://cvis.justinsaju.me/noc` | Network Operations Centre | Packet visualisation, security controls |
| `https://cvis.justinsaju.me/admin` | Admin Console | System stats, auth logs, device management |

---

## 3. Driver Dashboard (`/driver/alpha`)

The Driver Dashboard is a real-time vehicle health console. All data is live — from the ESP8266 via the backend WebSocket.

### 3.1 On Page Load

When you open the dashboard, the WebSocket connects and the server immediately sends the **last 10 telemetry rows** as a backfill — so the charts are populated even before the next packet arrives.

### 3.2 Main Widgets

| Widget | What it shows |
|---|---|
| **Mode Badge** | Current vehicle operating mode (Healthy / Eco / Sport / etc.) |
| **Speed Dial** | Current speed in km/h — the ring animates smoothly (physics inertia) |
| **Battery Arc** | State of charge %. Drains continuously based on speed + mode efficiency |
| **Estimated Range** | Range in km. Calculated from live battery % × mode efficiency factor |
| **Motor Temp** | Motor controller temperature in °C |
| **Ambient Temp** | Outside temperature — read from `ambient_temp_c` field if sent by firmware, otherwise estimated from battery temp |
| **Tire Pressure** | 4-wheel pressure monitoring — highlights over/under inflation per mode |
| **Drive Score** | 0–10 score based on current speed, temp, and battery habits (live calculation) |
| **History Charts** | Battery %, speed, and motor temp over the last 60 readings |

### 3.3 Alerts

The dashboard raises alerts automatically:
- **Low Battery** (mode = `Low Battery`) — amber warning
- **Battery Overheating** (mode = `Battery Overheating`) — red fault
- **Motor Fault** (mode = `Motor Fault`) — red fault with fault code in hex

Alerts clear automatically when the mode returns to normal.

### 3.4 AI Recommendation Panel

- Updates automatically every time the vehicle mode changes, or every 20 seconds
- Reasons across **all** telemetry fields simultaneously — not simple threshold rules
- Shows `severity`: `ok`, `warn`, or `critical`
- The text types in with a typewriter animation
- Click **Refresh** to request an immediate new recommendation

### 3.5 Chat with CVIS

Click **Chat** to open the AI chat panel. The AI has access to the current telemetry snapshot and the last 10 readings as context.

Example questions:
- *"Should I continue driving at this speed?"*
- *"How long will the battery last?"*
- *"What does fault code 0x04 mean?"*

### 3.6 Key Suggestions

Mode-specific driving tips appear below the score card, updated whenever the mode changes.

---

## 4. Network Operations Centre (`/noc`)

The NOC is the **primary demo surface** for CCNS networking and security concepts. Every control here causes a real, verifiable backend behaviour change — nothing is cosmetic.

### 4.1 Live Packet Flow

An animated visualisation shows every telemetry packet travelling from the vehicle (left) to the server (right). Colour indicates:
- **Cyan** — HTTP packet
- **Amber** — MQTT packet
- **Red** — Rejected / tampered packet

### 4.2 Packet Table

Every packet is logged with:

| Column | Description |
|---|---|
| `#` | Packet sequence number |
| `Device` | Source device ID |
| `Protocol` | HTTP or MQTT |
| `Time` | Server receipt timestamp |
| `Size` | Payload size in bytes |
| `Auth` | `auth_ok` / `auth_fail` / `no_auth` / `tamper_detected` |
| `Encrypted` | Yes / No + method (HMAC-SHA256 / AES-GCM / PLAIN) |
| `Status` | `ok` / `rejected` / `dropped` |

Click any row to expand the **Packet Inspector** — shows full JSON payload, headers, AI response, and all metadata.

### 4.3 Live Controls

| Control | What it does |
|---|---|
| **Protocol Switch** | Switch ESP8266 ↔ backend between HTTP REST and MQTT — no restart required. The firmware polls `/api/v1/config/protocol` every 30s. |
| **Encryption Toggle** | Instructs ESP8266 to wrap payload in AES-256-GCM envelope. Note: ESP8266 falls back to HMAC-only due to hardware limitations — use the Python simulator to demo AES-GCM. |
| **Auth Toggle** | Enable/disable API-key + HMAC verification. When off, packets still arrive but are logged as `no_auth` — demonstrates open/insecure traffic. |
| **Packet Loss (0/5/10/25%)** | Backend middleware probabilistically drops N% of packets before processing — returns 503, ESP8266 retries. |
| **Latency (0/100/300/1000ms)** | Backend middleware sleeps N ms before processing — demonstrates queuing delay. |
| **Tamper Injector** | Backend mutates the payload (`battery_pct = 999.9`) *after* the signature is computed. HMAC check fails → `tamper_detected` logged → packet rejected with 401. |
| **Disconnect Vehicle** | Deactivates device in DB — next packet returns 401. Reconnect button re-activates. |
| **Stop AI** | Disables AI inference. Telemetry still flows and is displayed; recommendations stop. |

---

## 5. Admin Console (`/admin`)

Provides operational visibility over the entire system.

| Section | Data |
|---|---|
| **Server Status** | Uptime, active WebSocket connections, backend version |
| **System Resources** | Live CPU %, RAM usage (via psutil on the homeserver) |
| **Packet Stats** | Total / ok / rejected counts, protocol breakdown |
| **Packet Timeline** | Hourly bar chart of packet volume |
| **Mode Distribution** | Vehicle mode frequency pie chart |
| **Auth Security** | Auth failures, tamper events, enforcement state |
| **AI Status** | Ollama running state, model loaded, service enabled |
| **Chaos State** | Current loss %, latency, tamper state |
| **Connected Devices** | All registered devices, last-seen timestamp, last mode |
| **Auth Log** | Filterable event log: `auth_ok`, `auth_fail`, `tamper_detected`, `registered` |

---

## 6. Vehicle Modes Reference

The ESP8266 cycles through 8 modes via a push button. Each mode produces physically coherent telemetry — values don't jump randomly.

| Mode | Speed | Battery % | Battery Temp | Motor Temp | Fault | Alert |
|---|---|---|---|---|---|---|
| **Healthy** | 60–100 km/h | 60–95% | 30–45°C | 35–55°C | 0x00 | None |
| **Eco** | 30–60 km/h | 40–90% | 25–38°C | 28–42°C | 0x00 | None |
| **Sport** | 80–140 km/h | drains fast | 38–55°C | 60–80°C | 0x00 | None |
| **Heavy Traffic** | 0–20 km/h | slow drain | 28–40°C | 32–50°C | 0x00 | None |
| **Low Battery** | ↓ speed | < 20% | 30–42°C | 35–50°C | 0x00 | ⚠ Warn |
| **Battery Overheating** | ↓ speed | reduced | > 55°C | 50–75°C | 0x02 | 🔴 Fault |
| **Charging** | 0 km/h | rising | 30–40°C | 25°C | 0x00 | None |
| **Motor Fault** | ↓ ↓ speed | reduced | 30–45°C | > 100°C | 0x04 | 🔴 Fault |

**Physics rules:**
- Sport mode → higher motor temp + faster battery drain + reduced range estimate
- Battery Overheating → fault code 0x02 + reduced range
- Motor Fault → fault code 0x04 + speed capped at 20 km/h

---

## 7. Demo Scenarios

### Scenario A — Normal Operation (shows Unit 1, 2)
1. Open `https://cvis.justinsaju.me/driver/alpha`
2. Charts pre-populate from backfill immediately
3. Live telemetry updates every 2 seconds
4. AI recommendation types in automatically

### Scenario B — Tamper Detection (shows Unit 4 — Integrity)
1. Open `/noc`
2. Click **Tamper Inject**
3. Watch next packet row turn red — `tamper_detected` in auth column
4. Open packet inspector — shows the mutated payload vs original signature

### Scenario C — Auth Disabled → Open Traffic (shows Unit 4 — Authentication)
1. Click **Auth: OFF**
2. Packets arrive with `no_auth` — no credentials checked
3. Click **Auth: ON** — security restored

### Scenario D — Packet Loss (shows Unit 3 — Reliability)
1. Set **Packet Loss = 25%**
2. ~1 in 4 packets shows `dropped` / 503
3. ESP8266 retry logic kicks in (exponential backoff, 3 retries)
4. Set back to **0%**

### Scenario E — Protocol Switch HTTP → MQTT (shows Unit 2)
1. Click **MQTT** in protocol control
2. Packet colour changes from cyan → amber
3. Both adapters use identical auth + ingest pipeline

### Scenario F — AI Shutdown (shows Unit 5 — Centralized AI)
1. Click **Stop AI** in the NOC
2. Telemetry still flows — dashboard still updates
3. AI panel stops updating — AI is decoupled from transport
4. Click **Start AI** — recommendations resume

---

## 8. What is Real vs. Simulated

| Feature | Status |
|---|---|
| Telemetry physics engine | ✅ Real — stateful dt-based simulation (speed inertia, battery drain, heat exchange) |
| HMAC-SHA256 signing | ✅ Real — BearSSL on ESP8266, verified backend with `hmac.compare_digest` |
| API key auth | ✅ Real — SHA-256 hashed in DB, not stored plaintext |
| AES-256-GCM | ✅ Real backend-side — stub on ESP8266 (no hardware support) |
| Replay protection | ✅ Real — (device_id, timestamp_ms) deduplication window |
| Packet loss | Simulated — middleware-level 503, not real network drop |
| Latency | Simulated — `asyncio.sleep()`, not real network delay |
| Tamper injection | Simulated — body mutation in middleware, detected by real HMAC verification |
| Ollama AI | ✅ Real — llama3.2:3b reasoning over actual telemetry values |
| WebSocket fan-out | ✅ Real — all three views receive the same event simultaneously |
