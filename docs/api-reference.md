# CVIS API Reference

Base URL: `http://<server-host>:8000`

Interactive docs (auto-generated): `http://localhost:8000/docs`

All endpoints return JSON. Timestamps are ISO 8601 UTC.

---

## Authentication

When auth enforcement is enabled (default), every telemetry `POST` requires:

| Header | Value |
|---|---|
| `X-API-Key` | 64-char hex key issued at `/api/v1/devices/register` |
| `X-HMAC-Signature` | HMAC-SHA256 hex of the exact request body string |
| `X-Encrypted` (optional) | `"true"` if the body is an AES-GCM envelope |

All auth failures and tamper events are logged in the `auth_logs` table and visible at `/api/v1/admin/auth-logs`.

---

## System

### `GET /health`
Server health check.
```json
{"status": "ok", "service": "CVIS Backend", "phase": 2, "version": "2.0.0", "websocket_clients": 0}
```

---

## Devices

### `POST /api/v1/devices/register`
Register a new ESP32 vehicle node. **Returns api_key once — store immediately.**

Request:
```json
{"device_id": "ESP32-001"}
```
Response `201`:
```json
{
  "device_id": "ESP32-001",
  "api_key": "<64-char hex>",
  "device_secret": "<64-char hex>",
  "registered_at": "2026-01-01T00:00:00+00:00",
  "message": "..."
}
```
Error `409`: Device already registered and active.

### `GET /api/v1/devices`
List all registered devices (no secrets).

---

## Telemetry

### `POST /api/v1/telemetry`
Ingest a telemetry packet from a vehicle node.

**Plaintext body:**
```json
{
  "device_id": "ESP32-001",
  "schema_version": "1.0",
  "timestamp_ms": 12345,
  "mode": "Healthy",
  "speed_kmh": 60.0,
  "battery_pct": 80.0,
  "battery_temp_c": 30.0,
  "motor_temp_c": 45.0,
  "range_km": 250.0,
  "fault_code": 0,
  "charging_rate_w": 0.0
}
```

**Encrypted body (X-Encrypted: true):**
```json
{"iv": "<24-char hex>", "ct": "<hex>", "tag": "<32-char hex>"}
```

Response `200`: `{"status": "ok", "packet_id": 1, "received_at": "...", "device_id": "..."}`

Errors:
- `401` — Auth fail / HMAC mismatch / Replay detected
- `422` — Malformed payload (Pydantic validation failure)
- `503` — Packet dropped (chaos simulation: packet loss)

### `GET /api/v1/telemetry/recent?limit=10`
Most recent N telemetry rows.

### `GET /api/v1/telemetry/packets?limit=50`
Raw packet log (for NOC packet table).

---

## Configuration (NOC Controls)

All config changes take effect immediately with no restart required.

### `GET /api/v1/config/all`
Full config snapshot.
```json
{
  "active_protocol": "http",
  "encryption_enabled": false,
  "auth_enabled": true,
  "replay_protection_enabled": false,
  "chaos": {"loss_pct": 0, "latency_ms": 0, "tamper": false}
}
```

### `POST /api/v1/config/protocol`
Switch active protocol. ESP32 nodes subscribe to MQTT broadcasts.
```json
{"protocol": "http"}  // or "mqtt"
```

### `POST /api/v1/config/encryption`
Toggle AES-256-GCM payload encryption.
```json
{"enabled": true}
```

### `POST /api/v1/config/auth`
Toggle authentication enforcement.
```json
{"enabled": false}
```
When disabled, packets are accepted without credentials and logged as `no_auth`.

### `POST /api/v1/config/chaos`
Set chaos simulation parameters.
```json
{"loss_pct": 10, "latency_ms": 300, "tamper": false}
```
- `loss_pct`: one of `0, 5, 10, 25`
- `latency_ms`: one of `0, 100, 300, 1000`
- `tamper`: mutates payload post-signature → triggers HMAC rejection

### `POST /api/v1/config/replay`
Toggle replay protection.
```json
{"enabled": true}
```

### `POST /api/v1/config/mode`
Force a specific driving mode in the backend simulator (used by the dashboard).
```json
{"mode": "Sport"} // or null to resume automatic cycling
```

---

## AI

### `GET /api/v1/ai/status`
Check if Ollama is running and the required model is available.

### `POST /api/v1/ai/recommendation`
On-demand multi-factor AI recommendation for the latest telemetry snapshot.
```json
{"device_id": "ESP32-001"}
```
Response: `{"device_id": "...", "mode": "...", "recommendation": "<natural language>"}`

### `POST /api/v1/ai/chat`
Grounded driver chat using current + recent telemetry as context.
```json
{"device_id": "ESP32-001", "message": "Should I be worried about the battery?"}
```
Response: `{"device_id": "...", "mode": "...", "message": "...", "reply": "<natural language>"}`

---

## Control (NOC)

### `POST /api/v1/control/disconnect`
Deactivate a vehicle node. Next packet from this device → 401. MQTT disconnect broadcast sent.
```json
{"device_id": "ESP32-001", "reason": "scheduled maintenance"}
```

### `POST /api/v1/control/reconnect`
Re-activate a deactivated device (existing credentials remain valid).
```json
{"device_id": "ESP32-001", "reason": "maintenance complete"}
```

### `GET /api/v1/control/ai-service`
Get AI service enabled state.

### `POST /api/v1/control/ai-service`
Stop or start the AI recommendation layer. Telemetry still flows when stopped.
```json
{"enabled": false}
```

---

## Admin

### `GET /api/v1/admin/stats`
Comprehensive server, system, packet, auth, AI, and chaos stats.

### `GET /api/v1/admin/auth-logs?limit=50&event_type=tamper_detected`
Auth and tamper event log. `event_type` filter: `auth_ok | auth_fail | tamper_detected | registered | no_auth | disconnected | reconnected`

### `GET /api/v1/admin/packet-stats?hours=24`
Packets per hour + mode distribution for the last N hours.

### `GET /api/v1/admin/devices`
All registered devices with last-seen telemetry.

### `GET /api/v1/admin/error-log?limit=50`
Failed packets (status ≠ 'ok').

### `POST /api/v1/admin/deactivate-device?device_id=ESP32-001`
Admin: deactivate a device for re-registration (test/maintenance use).

---

## WebSocket

### `WS /ws`
Real-time event stream. Connect once; server pushes all events.

**Event types:**
```json
{"event": "telemetry",            "packet_id": 1, "received_at": "...", ...telemetry fields}
{"event": "ai_recommendation",    "packet_id": 1, "device_id": "...", "mode": "...", "recommendation": "..."}
{"event": "device_disconnected",  "device_id": "...", "reason": "..."}
{"event": "device_reconnected",   "device_id": "..."}
{"event": "ai_service_status",    "enabled": false}
```

On connect, the server sends the 10 most recent telemetry records as `telemetry_backfill` events.

---

## MQTT Topics

| Topic | Direction | Purpose |
|---|---|---|
| `cvis/telemetry/{device_id}` | Vehicle → Backend | Telemetry packet |
| `cvis/config/protocol` | Backend → Vehicle | Protocol switch broadcast |
| `cvis/config/encryption` | Backend → Vehicle | Encryption toggle broadcast |
| `cvis/config/control/{device_id}` | Backend → Vehicle | Disconnect command |

**MQTT payload envelope:**
```json
{
  "_meta": {"api_key": "...", "hmac": "<HMAC-SHA256 of plaintext>"},
  "device_id": "...", "schema_version": "1.0", ...telemetry fields
}
```
Or encrypted:
```json
{
  "_meta": {"api_key": "...", "hmac": "<HMAC-SHA256 of plaintext>"},
  "encrypted": true, "iv": "...", "ct": "...", "tag": "..."
}
```

---

## Telemetry Payload Schema

| Field | Type | Range | Notes |
|---|---|---|---|
| `device_id` | string | — | Registered device ID |
| `schema_version` | string | `"1.0"` | — |
| `timestamp_ms` | int | 0 – 2^32 | ESP32 millis() — monotonic since boot |
| `mode` | string | See below | Vehicle operating mode |
| `speed_kmh` | float | 0 – 200 | Simulated GPS speed |
| `battery_pct` | float | 0 – 100 | State of charge |
| `battery_temp_c` | float | 15 – 80 | Battery pack temperature |
| `motor_temp_c` | float | 20 – 120 | Motor controller temperature |
| `range_km` | float | 0 – 500 | Estimated remaining range |
| `fault_code` | int | 0x00, 0x02, 0x04 | 0=none, 2=battery thermal, 4=motor fault |
| `charging_rate_w` | float | 0 – 22000 | Charging power (0 if not charging) |

**Modes:** `Healthy`, `Eco`, `Sport`, `Heavy Traffic`, `Low Battery`, `Battery Overheating`, `Charging`, `Motor Fault`
