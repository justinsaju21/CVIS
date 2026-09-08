# CVIS — End-to-End Workflow Documentation
*Updated: 2026-09-08 — reflects live deployment with Cloudflare Tunnel*

---

## 1. System Architecture Overview

```
ESP8266 Vehicle Node (your laptop → flashed over USB)
         │
         │  HTTP POST /api/v1/telemetry  (every 2 seconds)
         │  Headers: X-API-Key, X-HMAC-Signature
         │
         ▼
Cloudflare Edge  (api-cvis.justinsaju.me → port 80)
         │
         │  Cloudflare Zero Trust Tunnel (cloudflared)
         │  ← no open ports, no port forwarding, works through CGNAT
         ▼
Debian Homeserver (192.168.1.8)
  ├─ FastAPI backend  (PM2 → port 8005)
  │   ├─ ChaosMiddleware  (intercepts /api/v1/telemetry before route handler)
  │   ├─ Auth: X-API-Key verified against SHA-256 hash in SQLite
  │   ├─ Integrity: HMAC-SHA256 verified using device_secret
  │   ├─ Parsed + stored → SQLite (packets + telemetry tables)
  │   ├─ WebSocket broadcast → all connected frontend clients
  │   └─ AI fire-and-forget task → Ollama → ai_recommendation broadcast
  │
  └─ Next.js frontend  (PM2 → port 3001)
         │
         ▼
Cloudflare Edge  (cvis.justinsaju.me → port 3001)
         │
         ▼
Browser  (your phone / laptop / anywhere in the world)
  ├─ /driver/alpha  — Luxury Drive Console
  ├─ /noc           — Network Operations Center
  └─ /admin         — Administrator Console
```

---

## 2. Full Data Flow: One Telemetry Packet

### Step 1 — Firmware (ESP8266)
Every 2 seconds, `loop()` calls `buildTelemetry()`, which:
- Runs `tickPhysics(dt)` — updates speed, battery, motor temp, and faults using real physics (drag, load, heat exchange)
- Returns a `TelemetryPacket` struct with all fields

`serializeTelemetry()` turns this into a canonical JSON string.

`hmacSha256(DEVICE_SECRET, json)` computes a 64-char hex HMAC using BearSSL on the ESP8266.

`postViaHttp()` sends:
```
POST http://api-cvis.justinsaju.me:80/api/v1/telemetry
X-API-Key: <64-char hex key>
X-HMAC-Signature: <64-char hex HMAC>
Content-Type: application/json

{"device_id":"ESP32-ALPHA","mode":"Healthy","speed_kmh":62.3,...}
```

### Step 2 — Cloudflare Edge
- Receives the HTTP request on `api-cvis.justinsaju.me`
- Proxies it through the Zero Trust Tunnel (`cloudflared` process running on the homeserver)
- No port is open on the router — the tunnel is an outbound connection from the homeserver to Cloudflare

### Step 3 — ChaosMiddleware (Backend)
Before FastAPI's route handler sees the request, the raw ASGI middleware:
1. Reads the body bytes
2. Applies artificial latency (`asyncio.sleep`) if configured
3. Probabilistically drops the packet (returns 503) if packet loss > 0%
4. Optionally tampers the body bytes (flips `battery_pct` to 999.9) if tamper is enabled
5. Passes the (possibly modified) body to the real handler via a patched `receive()` callable

### Step 4 — Auth + Integrity (Backend)
`ingest_telemetry_data()` in `telemetry_service.py`:
1. **API Key Check** — SHA-256 hashes the `X-API-Key`, looks it up in the `devices` table
2. **Looks up `device_secret`** — the 32-byte hex secret used for HMAC
3. **HMAC Verification** — recomputes HMAC-SHA256 of the plaintext JSON using the device secret, uses `hmac.compare_digest` (constant-time) to compare
4. **Pydantic Validation** — checks all fields are in range (speed 0–250, battery 0–100, etc.)
5. **Replay Protection** (if enabled) — rejects exact duplicate `(device_id, timestamp_ms)` pairs

On any failure, logs to `auth_logs` table, broadcasts a rejected packet event, raises `ValueError`.

### Step 5 — Persistence (SQLite)
Two rows written per packet:
- `packets` table — raw log (protocol, size, status, auth_status, encrypted flag, raw JSON)
- `telemetry` table — parsed structured fields for dashboard queries

### Step 6 — WebSocket Broadcast
`manager.broadcast(payload)` sends the telemetry JSON to **every connected WebSocket client** simultaneously. This is how `/driver`, `/noc`, and `/admin` all update in real-time from a single backend event.

### Step 7 — AI Recommendation (Fire-and-forget)
If AI is enabled for this device and:
- The vehicle mode changed, OR
- 20 seconds have passed since the last recommendation

Then `asyncio.create_task(_send_ai_recommendation(...))` runs in the background **after** the HTTP 200 response is already sent to the ESP8266. This means the ESP8266 is never blocked waiting for the AI.

Ollama generates a recommendation based on:
- Current telemetry snapshot
- Last 5 historical rows (for trend context)
- Previous mode (to detect mode transitions like Healthy → Battery Overheating)

The result is broadcast as `{event: 'ai_recommendation', ...}`.

### Step 8 — Frontend Rendering
The browser's `useWebSocket` hook receives the JSON message. `handleWs` in `DriverDashboard.tsx` dispatches it:
- `event: 'backfill'` → pre-populates history charts with last 10 rows on page load
- `event: 'telemetry'` → updates `latest` state, appends to history, triggers alerts
- `event: 'ai_recommendation'` → runs typewriter animation on the AI text

React re-renders the dashboard in milliseconds.

---

## 3. WebSocket Events Reference

| Event | Direction | When | Payload |
|---|---|---|---|
| `backfill` | Server → Client | On WS connect | `{records: TelemetryRow[]}` — last 10 rows |
| `telemetry` | Server → Client | Every ESP8266 packet | Full telemetry + packet metadata |
| `ai_recommendation` | Server → Client | On mode change or every 20s | `{device_id, recommendation, severity}` |
| `device_disconnected` | Server → Client | NOC disconnect button | `{device_id, reason}` |
| `device_reconnected` | Server → Client | NOC reconnect button | `{device_id}` |
| `ai_service_status` | Server → Client | AI toggle changed | `{enabled: bool}` |
| `vehicle_ai_status` | Server → Client | Per-vehicle AI toggle | `{device_id, enabled: bool}` |
| `ping` | Server → Client | Every 20 seconds | Keep-alive — client may ignore |
| `pong` | Server → Client | Response to client `{action: "ping"}` | — |

---

## 4. Authentication & Security Layer

```
ESP8266                        Backend
  │                              │
  │─── X-API-Key header ────────►│ SHA-256(key) → lookup in devices table
  │                              │    ↓ found? → get device_secret
  │─── X-HMAC-Signature ────────►│ HMAC-SHA256(device_secret, body)
  │                              │    ↓ matches? → accept
  │                              │    ✗ mismatch? → tamper_detected → reject 401
  │                              │
  │                              │ (Chaos tamper active?)
  │                              │    body mutated BEFORE HMAC check
  │                              │    → HMAC always fails → tamper_detected logged
```

**Key security properties:**
- API keys stored as SHA-256 hashes — plaintext never in DB
- HMAC uses `hmac.compare_digest` — constant-time, no timing oracle
- AES-256-GCM supported backend-side for confidentiality (ESP8266 falls back to HMAC-only due to hardware limits)
- All auth events logged to `auth_logs` table, visible in `/admin`

---

## 5. Protocol Switching (HTTP ↔ MQTT)

The firmware polls `/api/v1/config/protocol` every **30 seconds**. If the backend returns `"mqtt"`, the firmware switches from `postViaHttp()` to `publishViaMqtt()` for the next send.

The MQTT adapter on the backend subscribes to `cvis/telemetry/+`. Incoming MQTT messages are unwrapped (the `_meta` envelope containing API key and HMAC is extracted) and passed to the same `ingest_telemetry_data()` function as HTTP — identical validation, identical persistence, identical WebSocket broadcast.

The NOC protocol switch button calls `POST /api/v1/config/protocol` which:
1. Updates `server_config` in SQLite
2. Publishes `{"protocol": "mqtt"}` on `cvis/config/protocol` MQTT topic (so any connected MQTT client switches immediately)
3. Broadcasts a `config_changed` WebSocket event

---

## 6. Chaos Simulation Layer

The `ChaosMiddleware` is a raw ASGI wrapper around the FastAPI app. It only intercepts `POST /api/v1/telemetry`. For everything else (WebSocket, config, admin endpoints) it passes through directly.

| NOC Control | Mechanism | What the Demo Shows |
|---|---|---|
| Packet Loss (0/5/10/25%) | `random.randint(1,100) <= loss_pct` → returns 503 | Backend drops packet; ESP8266 retries with exponential backoff; NOC shows increased retry count |
| Latency (0/100/300/1000ms) | `asyncio.sleep(ms/1000)` before handler | RTT increases in NOC packet table |
| Tamper Injector | Mutates `battery_pct=999.9` in body bytes | HMAC check fails → `tamper_detected` logged → packet rejected → alert in `/admin` |

---

## 7. Deployment & Update Workflow

### Local changes → Live deployment in 4 commands:
```bash
# On your Windows laptop (in the CCN PROJECT folder):
git commit -am "describe your change"
git push

# SSH into homeserver:
ssh justin@192.168.1.8
cd ~/CVIS && git pull && cd frontend && npm run build && pm2 restart cvis-frontend
```

### Backend changes (Python files):
```bash
ssh justin@192.168.1.8
cd ~/CVIS && git pull && pm2 restart cvis-backend
```

### Firmware changes:
1. Edit files on your laptop
2. Open `firmware_esp8266.ino` in Arduino IDE
3. Click Upload (device connected via USB)
*(Firmware updates don't go through git — flashed directly over USB)*

---

## 8. Known Constraints & Notes

| Item | Detail |
|---|---|
| ISP CGNAT | Port forwarding impossible; Cloudflare Tunnel is the solution |
| AES-GCM on ESP8266 | Hardware stub — always falls back to HMAC-only plaintext. AES-GCM is fully implemented backend-side and testable via the Python simulators |
| Replay protection | Off by default. Uses `(device_id, timestamp_ms)` deduplication. ESP8266 uses `millis()` (boot-relative), not Unix time — fine for deduplication, not suitable for absolute time window checks |
| Ollama AI | Runs on the homeserver. If Ollama is not running, AI recommendations are skipped silently — the vehicle dashboard still works |
| MQTT broker | If Mosquitto is not running, the MQTT adapter starts in inactive mode. HTTP still works normally |
| DB size | SQLite, currently ~18 MB with WAL mode. Upgrade to Postgres only if explicitly needed |
