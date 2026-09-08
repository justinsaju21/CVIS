# CVIS API Reference

**Base URL (production):** `https://api-cvis.justinsaju.me`  
**Base URL (local dev):** `http://localhost:8000`  
**Interactive Swagger UI:** `https://api-cvis.justinsaju.me/docs`

All endpoints return JSON. Timestamps are ISO 8601 UTC. All config changes take effect **immediately with no restart**.

---

## Authentication

When auth enforcement is enabled (default `on`), every telemetry `POST` requires:

| Header | Value |
|---|---|
| `X-API-Key` | 64-char hex key issued at `/api/v1/devices/register` |
| `X-HMAC-Signature` | HMAC-SHA256 hex of the exact plaintext JSON body |
| `X-Encrypted` *(optional)* | `"true"` if the body is an AES-GCM envelope |

All auth failures and tamper events are logged in the `auth_logs` table, visible at `/api/v1/admin/auth-logs` and in the `/admin` dashboard.

---

## System

### `GET /health`
```json
{
  "status": "ok",
  "service": "CVIS Backend",
  "phase": 2,
  "version": "2.0.0",
  "websocket_clients": 2
}
```

---

## Devices

### `POST /api/v1/devices/register`
Register a new vehicle node. **`api_key` and `device_secret` are shown exactly once — store immediately.**

Request:
```json
{"device_id": "ESP32-ALPHA"}
```
Response `201`:
```json
{
  "device_id": "ESP32-ALPHA",
  "api_key": "<64-char hex>",
  "device_secret": "<64-char hex>",
  "registered_at": "2026-09-08T17:00:00+00:00",
  "message": "Device registered. Store your api_key and device_secret — shown once."
}
```
Error `409`: Device already registered and active. Deactivate first if re-registering.

### `GET /api/v1/devices`
List all registered devices (no secrets exposed).

---

## Telemetry

### `POST /api/v1/telemetry`
Ingest a telemetry packet from a vehicle node (HTTP path).

**Headers required (when auth enabled):**
```
X-API-Key: <64-char hex>
X-HMAC-Signature: <HMAC-SHA256 hex of body>
```

**Plaintext body:**
```json
{
  "device_id": "ESP32-ALPHA",
  "schema_version": "1.0",
  "timestamp_ms": 12345,
  "mode": "Healthy",
  "speed_kmh": 62.3,
  "battery_pct": 85.0,
  "battery_temp_c": 30.0,
  "motor_temp_c": 45.0,
  "range_km": 250.0,
  "fault_code": 0,
  "charging_rate_w": 0.0,
  "ambient_temp_c": 28.5,
  "headwind_kmh": 5.0,
  "road_gradient_pct": 0.0,
  "tire_pressure_psi": 36.0,
  "cabin_climate_w": 800.0,
  "max_cell_voltage_delta": 0.02
}
```

**Encrypted body (`X-Encrypted: true`):**
```json
{"iv": "<24-char hex>", "ct": "<hex ciphertext>", "tag": "<32-char hex>"}
```

> **ESP8266 note:** AES-GCM encryption is not supported on ESP8266 hardware — it always falls back to HMAC-only plaintext. AES-GCM is fully implemented backend-side and testable via the Python simulators.

Response `200`:
```json
{"status": "ok", "packet_id": 42, "received_at": "...", "device_id": "ESP32-ALPHA"}
```

Errors:
- `401` — Missing/invalid API key, HMAC mismatch (tamper detected), or replay
- `422` — Malformed payload (Pydantic validation failure — field out of range)
- `503` — Packet dropped by chaos middleware (packet loss simulation)

### `GET /api/v1/telemetry/recent?limit=10&device_id=ESP32-ALPHA`
Most recent N telemetry rows (joined with packet metadata).

### `GET /api/v1/telemetry/packets?limit=50&device_id=ESP32-ALPHA`
Raw packet log for NOC packet table (includes rejected/dropped packets).

---

## Configuration (NOC Controls)

### `GET /api/v1/config/all`
Full config snapshot:
```json
{
  "active_protocol": "http",
  "encryption_enabled": false,
  "auth_enabled": true,
  "replay_protection_enabled": false,
  "ai_service_enabled": true,
  "chaos": {"loss_pct": 0, "latency_ms": 0, "tamper": false}
}
```

### `POST /api/v1/config/protocol`
Switch active protocol. The firmware polls this every 30s and switches without restart.
```json
{"protocol": "http"}
// or
{"protocol": "mqtt"}
```

### `POST /api/v1/config/encryption`
Toggle AES-256-GCM payload encryption (backend instructs ESP32 to encrypt).
```json
{"enabled": true}
```

### `POST /api/v1/config/auth`
Toggle authentication enforcement. When disabled, packets arrive without credentials and are logged as `no_auth`. Demonstrates "open traffic" scenario.
```json
{"enabled": false}
```

### `POST /api/v1/config/chaos`
Set chaos simulation parameters (applied by ChaosMiddleware on `POST /api/v1/telemetry` only):
```json
{"loss_pct": 10, "latency_ms": 300, "tamper": false}
```
- `loss_pct`: `0`, `5`, `10`, or `25` — probabilistic packet drop (returns 503)
- `latency_ms`: `0`, `100`, `300`, or `1000` — `asyncio.sleep()` before processing
- `tamper`: `true/false` — mutates `battery_pct=999.9` in body *after* signature → HMAC fail → `tamper_detected`

### `POST /api/v1/config/replay`
Toggle replay protection (off by default):
```json
{"enabled": true}
```
When enabled, exact duplicate `(device_id, timestamp_ms)` pairs within 60 seconds are rejected as replays.

### `POST /api/v1/config/mobile-app`
Toggle global mobile app access:
```json
{"enabled": true}
```

---

## AI

### `GET /api/v1/ai/status`
```json
{
  "running": true,
  "model_available": true,
  "model": "llama3.2:3b",
  "available_models": ["llama3.2:3b"]
}
```

### `POST /api/v1/ai/recommendation`
On-demand multi-factor AI recommendation using current + recent telemetry:
```json
{"device_id": "ESP32-ALPHA"}
```
Response:
```json
{
  "device_id": "ESP32-ALPHA",
  "mode": "Sport",
  "recommendation": "Motor temperature is approaching 75°C while battery drain is elevated at 3.2%/min. Consider switching to Eco mode if highway section ends soon.",
  "severity": "warn"
}
```

### `POST /api/v1/ai/chat`
Grounded driver chat — AI has access to current snapshot + last 10 telemetry rows:
```json
{"device_id": "ESP32-ALPHA", "message": "Should I be worried about the battery?"}
```
Response:
```json
{
  "device_id": "ESP32-ALPHA",
  "mode": "Sport",
  "message": "Should I be worried about the battery?",
  "reply": "Battery is at 58% with an estimated 142km range. At current Sport mode drain rate (~2.8%/min), you have approximately 20 minutes before hitting Low Battery threshold. Consider Eco mode if your destination is more than 100km away."
}
```

---

## Control (NOC)

### `POST /api/v1/control/disconnect`
Deactivate a vehicle node — next packet returns 401. A `device_disconnected` WS event is broadcast.
```json
{"device_id": "ESP32-ALPHA", "reason": "scheduled maintenance"}
```

### `POST /api/v1/control/reconnect`
Re-activate a deactivated device (credentials remain valid):
```json
{"device_id": "ESP32-ALPHA", "reason": "maintenance complete"}
```

### `GET /api/v1/control/vehicles`
List all fleet vehicles with their status, mode, battery, and AI toggle state.

### `POST /api/v1/control/ai-service`
Stop or start AI recommendations globally. Telemetry still flows.
```json
{"enabled": false}
```

### `POST /api/v1/control/ai-service/vehicle`
Toggle AI per vehicle:
```json
{"device_id": "ESP32-ALPHA", "enabled": false}
```

---

## Admin

### `GET /api/v1/admin/stats`
Full system stats:
```json
{
  "packets": {
    "total": 1240,
    "today": 847,
    "last_hour": 120,
    "avg_size_bytes": 312,
    "protocol_breakdown": {"http": 1100, "mqtt": 140}
  },
  "system": {
    "cpu_pct": 3.1,
    "mem_pct": 46.6,
    "disk_pct": 22.4,
    "uptime_s": 86400,
    "db_size_kb": 18432
  },
  "auth": {
    "active_devices": 5,
    "auth_failures": 3,
    "tamper_events": 2,
    "auth_enabled": true,
    "replay_protection_enabled": false
  },
  "ai": {
    "running": true,
    "model_available": true,
    "service_enabled": true
  },
  "chaos": {
    "total_requests": 847,
    "dropped_packets": 0,
    "tampered_packets": 2,
    "latency_added": 0
  }
}
```

### `GET /api/v1/admin/auth-logs?limit=50&event_type=tamper_detected`
Auth and tamper event log.  
`event_type` filter: `auth_ok | auth_fail | tamper_detected | registered | no_auth | disconnected | reconnected`

### `GET /api/v1/admin/packet-stats?hours=24`
Packets per hour + mode distribution for the last N hours.

### `GET /api/v1/admin/devices`
All registered devices with last-seen telemetry.

### `GET /api/v1/admin/error-log?limit=50`
Failed/rejected packets only.

### `POST /api/v1/admin/deactivate-device?device_id=ESP32-ALPHA`
Deactivate a device for re-registration.

---

## WebSocket

### `WS /ws`
Real-time event stream. Connect once — server pushes all events to all connected clients simultaneously.

**On connect**, server immediately sends the last 10 telemetry rows as a backfill:
```json
{"event": "backfill", "records": [...TelemetryRow[]]}
```

**Event types:**

| Event | Payload |
|---|---|
| `backfill` | `{records: TelemetryRow[]}` — last 10 rows, sent once on connect |
| `telemetry` | Full telemetry packet + packet metadata (packet_id, protocol, encrypted, etc.) |
| `ai_recommendation` | `{packet_id, device_id, mode, recommendation, severity}` |
| `device_disconnected` | `{device_id, reason}` |
| `device_reconnected` | `{device_id}` |
| `ai_service_status` | `{enabled: bool}` |
| `vehicle_ai_status` | `{device_id, enabled: bool}` |
| `config_changed` | — (generic, client should re-fetch config) |
| `mobile_access_changed` | `{vehicle_id, enabled: bool}` |
| `ping` | Keep-alive from server every 20s |
| `pong` | Response to client `{action: "ping"}` |

Client keep-alive (optional):
```json
{"action": "ping"}
```

---

## MQTT Topics

| Topic | Direction | Purpose |
|---|---|---|
| `cvis/telemetry/{device_id}` | Vehicle → Backend | Telemetry packet |
| `cvis/config/protocol` | Backend → Vehicle | Protocol switch broadcast |
| `cvis/config/encryption` | Backend → Vehicle | Encryption toggle broadcast |
| `cvis/config/control/{device_id}` | Backend → Vehicle | Disconnect command |

**MQTT payload envelope (plaintext):**
```json
{
  "_meta": {"api_key": "...", "hmac": "<HMAC-SHA256 of plaintext fields>"},
  "device_id": "ESP32-ALPHA",
  "schema_version": "1.0",
  "timestamp_ms": 12345,
  "mode": "Healthy",
  ...all telemetry fields
}
```

---

## Telemetry Payload Schema

| Field | Type | Range | Notes |
|---|---|---|---|
| `device_id` | string | 1–64 chars | Must match registered device |
| `schema_version` | string | `"1.0"` | — |
| `timestamp_ms` | int | 0 – 2³² | ESP8266 `millis()` — boot-relative monotonic |
| `mode` | string | See below | Vehicle operating mode |
| `speed_kmh` | float | 0 – 250 | Simulated GPS speed |
| `battery_pct` | float | 0 – 100 | State of charge |
| `battery_temp_c` | float | -20 – 100 | Battery pack temperature |
| `motor_temp_c` | float | -20 – 150 | Motor controller temperature |
| `range_km` | float | 0 – 1000 | Estimated remaining range |
| `fault_code` | int | 0x00, 0x02, 0x04 | 0=none, 2=battery thermal, 4=motor fault |
| `charging_rate_w` | float | 0 – 350000 | Charging power in Watts (0 if not charging) |
| `ambient_temp_c` *(opt)* | float\|null | — | Outside ambient temperature |
| `headwind_kmh` *(opt)* | float\|null | — | Estimated headwind |
| `road_gradient_pct` *(opt)* | float\|null | — | Road gradient (positive = uphill) |
| `tire_pressure_psi` *(opt)* | float\|null | — | Average tire pressure |
| `cabin_climate_w` *(opt)* | float\|null | — | AC/Heater power draw |
| `max_cell_voltage_delta` *(opt)* | float\|null | — | Max voltage diff between battery cells |

**Valid modes:** `Healthy`, `Eco`, `Sport`, `Heavy Traffic`, `Low Battery`, `Battery Overheating`, `Charging`, `Motor Fault`
