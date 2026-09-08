# CVIS Installation Guide
*For first-time local setup or setting up a fresh homeserver*

> **Already deployed on the homeserver?** See [`homeserver_deployment_guide.md`](./homeserver_deployment_guide.md) instead.  
> **Live URLs:** `https://cvis.justinsaju.me` (frontend) · `https://api-cvis.justinsaju.me` (API)

---

## Prerequisites

| Software | Version | Install |
|---|---|---|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Mosquitto MQTT Broker | 2.x | [mosquitto.org](https://mosquitto.org) (optional — only for MQTT mode) |
| Ollama | latest | [ollama.ai](https://ollama.ai) (optional — only for AI recommendations) |
| Arduino IDE | 2.x | [arduino.cc](https://arduino.cc) (only for flashing firmware) |
| Git | any | — |

---

## 1. Clone the Repository

```bash
git clone https://github.com/justinsaju21/CVIS.git cvis
cd cvis
```

---

## 2. Backend Setup

```bash
cd backend

# Create + activate virtual environment
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install all dependencies
pip install -r requirements.txt
```

### Environment Variables

```bash
# Copy the template
cp .env.example .env      # Linux/macOS
copy .env.example .env    # Windows

# Default .env values (adjust as needed):
LOG_LEVEL=info
HOST=0.0.0.0
PORT=8000
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_TIMEOUT_S=20
```

> **Note:** The homeserver runs on port `8005` to avoid conflicts. For local dev, port `8000` is fine.

### Start the Backend

```bash
# Standard (recommended):
uvicorn main:asgi_app --host 0.0.0.0 --port 8000

# With hot-reload for development:
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The SQLite database (`backend/cvis.db`) is created automatically on first run.

Verify:
```
http://localhost:8000/health          → {"status": "ok", ...}
http://localhost:8000/docs            → Swagger UI (full API reference)
```

---

## 3. Register a Device

Before the ESP8266 can send authenticated telemetry, it must be registered:

```bash
curl -X POST http://localhost:8000/api/v1/devices/register \
  -H "Content-Type: application/json" \
  -d '{"device_id": "ESP32-ALPHA"}'
```

Response:
```json
{
  "device_id": "ESP32-ALPHA",
  "api_key": "<64-char hex — save this>",
  "device_secret": "<64-char hex — save this>",
  "registered_at": "...",
  "message": "..."
}
```

> **⚠ Store the `api_key` and `device_secret` immediately — they are shown exactly once.**  
> Paste both into `firmware_esp8266/secrets.h`.

---

## 4. Frontend Setup

```bash
cd frontend
npm install

# Development (with hot-reload):
npm run dev
# → http://localhost:3000

# Production build (what the homeserver uses):
npm run build
npm start
# → http://localhost:3000
```

### Frontend Environment Variables

```bash
# frontend/.env.local (for local dev):
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws

# frontend/.env (for homeserver production — already configured):
NEXT_PUBLIC_API_URL=https://api-cvis.justinsaju.me
NEXT_PUBLIC_WS_URL=wss://api-cvis.justinsaju.me/ws
```

---

## 5. ESP8266 Firmware

> **Hardware note:** This project uses an **ESP8266** (not ESP32). The board is `Generic ESP8266 Module` in Arduino IDE.

### Required Arduino Libraries

Install via Arduino IDE → **Library Manager**:
- `ArduinoJson` by Benoit Blanchon — v7.x
- `PubSubClient` by Nick O'Leary — v2.8+
- BearSSL is **bundled** with the ESP8266 Arduino core — no separate install

### Board Package

In Arduino IDE → **Boards Manager**, install:
- `esp8266 by ESP8266 Community` — version 3.x

### Configuration

```bash
# The secrets file already exists for the deployed device:
firmware_esp8266/secrets.h

# If setting up a fresh device, copy the template:
cp firmware/secrets.h.example firmware_esp8266/secrets.h
```

Edit `secrets.h`:
```cpp
#define WIFI_SSID       "YourWiFiNetwork"
#define WIFI_PASSWORD   "YourPassword"
#define BACKEND_HOST    "api-cvis.justinsaju.me"  // or LAN IP for local dev
#define BACKEND_PORT    "80"                        // 80 for Cloudflare; 8000 for local
#define DEVICE_ID       "ESP32-ALPHA"              // must match registered device_id
#define API_KEY         "<64-char hex from registration>"
#define DEVICE_SECRET   "<64-char hex from registration>"
```

### Flash

1. Open `firmware_esp8266/firmware_esp8266.ino` in **Arduino IDE 2.x**
2. Board: **Generic ESP8266 Module**
3. Select the correct COM port
4. Click **Upload**

### Serial Monitor Output (115200 baud)

```
=== CVIS Vehicle Node — ESP8266 ===
[WiFi] Connecting to THE MAN.......
[WiFi] Connected — IP: 192.168.1.x
[PROTO] Polling config: http
[TX] [http] Mode: Healthy | Batt: 85.0% | Speed: 62.3 km/h
[HTTP] POST OK (attempt 1) → 200
```

---

## 6. Mosquitto MQTT Broker (Optional)

Only required if you want to demo MQTT protocol switching.

### Linux (homeserver):
```bash
sudo apt install mosquitto mosquitto-clients
sudo systemctl enable mosquitto
sudo systemctl start mosquitto
```

### Windows (local dev):
```powershell
# Install from https://mosquitto.org/download/
net start mosquitto
```

### Verify MQTT:
```bash
# Subscribe in one terminal
mosquitto_sub -t "cvis/telemetry/#" -v

# In another terminal, backend should log:
# [MQTT] Adapter started — broker localhost:1883
# [MQTT] Connected to broker, subscribed to cvis/telemetry/+
```

---

## 7. Ollama AI (Optional)

Without Ollama, telemetry still flows and is displayed — only AI recommendations are skipped.

```bash
# Install from https://ollama.ai
ollama pull llama3.2:3b
ollama serve
```

Verify:
```bash
curl http://localhost:11434/api/tags
curl http://localhost:8000/api/v1/ai/status
```

---

## 8. Backend Test Suite

```bash
cd backend
# (venv active, backend running in another terminal)

python test_phase1.py   # Core pipeline: telemetry ingest, WebSocket
python test_phase2.py   # Auth + HMAC + AES-GCM + MQTT
python test_phase3.py   # AI recommendations (requires Ollama)
python test_phase6.py   # Full end-to-end: all 8 modes × protocols × chaos
```

---

## 9. NOC Controls via curl

```bash
BASE="http://localhost:8000"

# Switch to MQTT
curl -sX POST $BASE/api/v1/config/protocol \
  -H "Content-Type: application/json" -d '{"protocol": "mqtt"}'

# Enable AES-GCM (note: ESP8266 falls back to HMAC-only — test with simulator)
curl -sX POST $BASE/api/v1/config/encryption \
  -H "Content-Type: application/json" -d '{"enabled": true}'

# Enable chaos: 10% packet loss + 300ms latency
curl -sX POST $BASE/api/v1/config/chaos \
  -H "Content-Type: application/json" \
  -d '{"loss_pct": 10, "latency_ms": 300, "tamper": false}'

# Inject tamper (next packet will have HMAC mismatch → rejected)
curl -sX POST $BASE/api/v1/config/chaos \
  -H "Content-Type: application/json" \
  -d '{"loss_pct": 0, "latency_ms": 0, "tamper": true}'

# Stop AI service
curl -sX POST $BASE/api/v1/control/ai-service \
  -H "Content-Type: application/json" -d '{"enabled": false}'
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `ModuleNotFoundError: paho` | `pip install -r requirements.txt` |
| `ImportError: InvalidTag` | `pip install cryptography==43.0.3` |
| `409 Conflict` on register | Device already exists; deactivate at `POST /api/v1/admin/deactivate-device?device_id=...` |
| `401` on telemetry POST | Check `X-API-Key` header and `X-HMAC-Signature` are set correctly |
| MQTT adapter inactive | Start Mosquitto — `sudo systemctl start mosquitto` |
| AI status `running: false` | Start Ollama — `ollama serve` |
| ESP8266 not connecting | Check `BACKEND_HOST` in `secrets.h` — must be `api-cvis.justinsaju.me` (or LAN IP for local) |
| ESP8266 `HTTP -1` | WiFi or DNS issue — check Serial Monitor, verify SSID/password |
| Frontend blank | Check `NEXT_PUBLIC_API_URL` in `.env` points to running backend |
