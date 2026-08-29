# CVIS Installation Guide

## Prerequisites

| Software | Version | Install |
|---|---|---|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) (for frontend — later) |
| Mosquitto | 2.x | [mosquitto.org](https://mosquitto.org) (for MQTT) |
| Ollama | latest | [ollama.ai](https://ollama.ai) (for AI) |
| Arduino IDE | 2.x | [arduino.cc](https://arduino.cc) (for ESP32 firmware) |
| Git | any | — |

---

## 1. Clone the Project

```bash
git clone <repo-url> cvis
cd cvis
```

---

## 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/macOS)
source venv/bin/activate

# Install all dependencies
pip install -r requirements.txt
```

### Environment Configuration

```bash
# Copy the template
copy .env.example .env    # Windows
cp .env.example .env      # Linux/macOS

# Edit .env — set LOG_LEVEL, HOST, PORT if needed
```

Default `.env`:
```
LOG_LEVEL=info
HOST=0.0.0.0
PORT=8000
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_TIMEOUT_S=20
```

### Start the Backend

```bash
# Development (from backend/ directory, venv active)
uvicorn main:asgi_app --host 0.0.0.0 --port 8000

# With reload (development only — note: reload requires 'main:app' not 'main:asgi_app')
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The database (`cvis.db`) is created automatically on first run. Verify at:
```
http://localhost:8000/health
http://localhost:8000/docs
```

---

## 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The unified Next.js dashboard will be available at:
```
http://localhost:3000
```

---

## 3. Register a Device

```bash
curl -X POST http://localhost:8000/api/v1/devices/register \
  -H "Content-Type: application/json" \
  -d '{"device_id": "ESP32-001"}'
```

**Save the `api_key` and `device_secret` — they are shown exactly once.**

Or via the interactive docs at `http://localhost:8000/docs`.

---

## 4. Mosquitto MQTT Broker (Optional — required for MQTT mode)

### Windows

1. Download installer from [mosquitto.org/download](https://mosquitto.org/download/)
2. Install with default settings
3. Start the service:
   ```powershell
   net start mosquitto
   ```
   Or run manually:
   ```powershell
   mosquitto -v
   ```

### Linux (Ubuntu/Debian)

```bash
sudo apt install mosquitto mosquitto-clients
sudo systemctl enable mosquitto
sudo systemctl start mosquitto
```

### macOS

```bash
brew install mosquitto
brew services start mosquitto
```

### Verify

```bash
# Subscribe in one terminal
mosquitto_sub -t "cvis/telemetry/#" -v

# Publish test in another
mosquitto_pub -t "cvis/telemetry/test" -m '{"test": true}'
```

When Mosquitto is running, the CVIS backend automatically connects on startup and logs:
```
[MQTT] Adapter started — broker localhost:1883
[MQTT] Connected to broker, subscribed to cvis/telemetry/+
```

---

## 5. Ollama AI Setup (Optional — required for AI recommendations)

```bash
# Install Ollama from https://ollama.ai
# Then pull the model:
ollama pull llama3.2:3b

# Start the inference server (runs on localhost:11434)
ollama serve
```

Verify:
```bash
curl http://localhost:11434/api/tags
```

The backend auto-detects Ollama. Check via:
```
http://localhost:8000/api/v1/ai/status
```

---

## 6. ESP32 Firmware

### Required Arduino Libraries

Install via Arduino IDE Library Manager:
- `ArduinoJson` by Benoit Blanchon (v7.x)
- `PubSubClient` by Nick O'Leary (v2.8+)
- `ESP32` board package by Espressif (v3.x)

mbedTLS is bundled in the ESP32 Arduino core — no additional install.

### Configuration

```bash
# Copy secrets template
cp firmware/secrets.h.example firmware/secrets.h

# Edit secrets.h:
# WIFI_SSID       — your WiFi network
# WIFI_PASSWORD   — your WiFi password
# BACKEND_HOST    — your laptop's LAN IP (e.g. 192.168.1.100)
# BACKEND_PORT    — "8000"
# DEVICE_ID       — "ESP32-001" (must match registered device_id)
# API_KEY         — from step 3 above
# DEVICE_SECRET   — from step 3 above
```

### Flash

1. Open `firmware/firmware.ino` in Arduino IDE 2.x
2. Select board: **ESP32 Dev Module** (or your specific board)
3. Select correct COM port
4. Click Upload

### Verify

Serial Monitor (115200 baud):
```
=== CVIS Vehicle Node — Phase 2 ===
[WiFi] Connecting to MyNetwork.......
[WiFi] Connected — IP: 192.168.1.50
[TX] [http] Mode: Healthy              | Batt:  80.0% | Speed:  60.2 km/h | Motor:  45.3°C | Fault: 0x00
[HTTP] POST OK (attempt 1, plain) → 200
```

---

## 7. Run Tests

```bash
cd backend
# (venv active, server running)

# Phase 1: Core pipeline
python test_phase1.py

# Phase 2: Auth + HMAC + chaos
python test_phase2.py

# Phase 3: AI (requires Ollama)
python test_phase3.py

# Phase 6: End-to-end hardening
python test_phase6.py
```

---

## 8. NOC Controls (via curl / API)

```bash
# Switch to MQTT protocol
curl -X POST http://localhost:8000/api/v1/config/protocol \
  -H "Content-Type: application/json" -d '{"protocol": "mqtt"}'

# Enable AES-GCM encryption
curl -X POST http://localhost:8000/api/v1/config/encryption \
  -H "Content-Type: application/json" -d '{"enabled": true}'

# Enable chaos: 10% packet loss + 300ms latency
curl -X POST http://localhost:8000/api/v1/config/chaos \
  -H "Content-Type: application/json" \
  -d '{"loss_pct": 10, "latency_ms": 300, "tamper": false}'

# Enable tamper injection (triggers HMAC rejection)
curl -X POST http://localhost:8000/api/v1/config/chaos \
  -H "Content-Type: application/json" \
  -d '{"loss_pct": 0, "latency_ms": 0, "tamper": true}'

# Stop AI service
curl -X POST http://localhost:8000/api/v1/control/ai-service \
  -H "Content-Type: application/json" -d '{"enabled": false}'

# Disconnect a vehicle
curl -X POST http://localhost:8000/api/v1/control/disconnect \
  -H "Content-Type: application/json" \
  -d '{"device_id": "ESP32-001", "reason": "demo disconnect"}'
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `ModuleNotFoundError: paho` | `pip install -r requirements.txt` |
| `ImportError: InvalidTag` | `pip install cryptography==43.0.3` |
| `409 Conflict` on register | Device already registered; use `/admin/deactivate-device?device_id=...` first |
| `401` on telemetry POST | Check X-API-Key and X-HMAC-Signature headers |
| MQTT adapter inactive | Start Mosquitto (`net start mosquitto`) |
| AI status `running: false` | Start Ollama (`ollama serve`) |
| ESP32 not connecting | Check BACKEND_HOST in secrets.h — must be LAN IP, not localhost |
