# CVIS — Testing Documentation

**Version:** 1.0  
**Phases Covered:** 1 through 6

---

## 1. Test Strategy

CVIS uses a layered test approach:

| Layer | Method | File |
|---|---|---|
| Phase 1 — Core pipeline | Python script, automated assertions | `test_phase1.py` |
| Phase 2 — Auth + integrity | Python script, positive + negative cases | `test_phase2.py` |
| Phase 3 — AI integration | Python script, graceful skip if Ollama offline | `test_phase3.py` |
| Phase 6 — End-to-end | Full matrix: 8 modes × both protocols × chaos | `test_phase6.py` |
| Frontend | Manual browser testing (user-performed) | — |

All scripts register a test device, obtain an API key, and exercise the backend over HTTP. No mocks — every assertion hits the real running server.

---

## 2. Phase 1 — Smoke Tests

**File:** `backend/test_phase1.py`  
**Prerequisites:** Backend running (`uvicorn main:asgi_app --port 8000`)  
**Result:** 20/20 passed

### Test Cases

| # | Test | Method | Expected |
|---|---|---|---|
| 1 | Health check | GET /health | 200, `"status":"ok"` |
| 2 | Telemetry POST — Healthy mode | POST /api/v1/telemetry | 200/201 |
| 3 | Telemetry POST — Eco mode | POST /api/v1/telemetry | 200/201 |
| 4 | Telemetry POST — Sport mode | POST /api/v1/telemetry | 200/201 |
| 5 | Telemetry POST — Heavy Traffic | POST /api/v1/telemetry | 200/201 |
| 6 | Telemetry POST — Low Battery | POST /api/v1/telemetry | 200/201 |
| 7 | Telemetry POST — Battery Overheating | POST /api/v1/telemetry | 200/201 |
| 8 | Telemetry POST — Charging | POST /api/v1/telemetry | 200/201 |
| 9 | Telemetry POST — Motor Fault | POST /api/v1/telemetry | 200/201 |
| 10 | Invalid battery_pct (150) | POST /api/v1/telemetry | 422 |
| 11 | Invalid speed (-5) | POST /api/v1/telemetry | 422 |
| 12 | Missing required field | POST /api/v1/telemetry | 422 |
| 13 | Retrieve recent telemetry | GET /api/v1/telemetry/recent | 200, list |
| 14 | Get packets list | GET /api/v1/telemetry/packets | 200, list |
| 15 | WebSocket connect | ws://localhost:8000/ws | 101 Upgrade |
| 16 | WebSocket backfill received | ws receive | `telemetry_backfill` event |
| 17 | DB persistence | Query SQLite directly | Rows present |
| 18 | Concurrent POSTs (5 threads) | POST ×5 | All 200 |
| 19 | Payload size logged | GET /packets | size_bytes > 0 |
| 20 | Protocol field logged | GET /packets | protocol = "http" |

### Run

```bash
cd backend && python test_phase1.py
```

---

## 3. Phase 2 — Auth + Integrity Tests

**File:** `backend/test_phase2.py`  
**Prerequisites:** Backend running, device registration available  
**Result:** 28/28 passed

### Test Cases

| # | Test | Expected |
|---|---|---|
| 1 | Device registration | 200, api_key returned |
| 2 | Re-registration (same device_id) | 409 Conflict |
| 3 | Valid API key + HMAC | 200 OK |
| 4 | Missing X-API-Key header | 401 Unauthorized |
| 5 | Wrong API key | 401 Unauthorized |
| 6 | Valid key, forged HMAC | 401 + tamper_detected in auth_logs |
| 7 | Truncated HMAC | 401 |
| 8 | Duplicate timestamp within window (< 30s) | 401 (replay protection) |
| 9 | AES-GCM encrypted + valid HMAC | 200 OK, decrypted correctly |
| 10 | AES-GCM: wrong IV | 422 |
| 11 | AES-GCM: truncated ciphertext | 422 |
| 12 | AES-GCM: corrupted GCM tag | 422 |
| 13 | Chaos tamper → HMAC fail | 401 + tamper_detected |
| 14 | Auth toggle off → no_auth logged | 200 + no_auth |
| 15 | Auth toggle re-enable → 401 again | 401 |
| 16 | Packet loss 25% (10 sends) | ~3 drops (statistical) |
| 17 | Latency 300ms | Response RTT ≥ 300ms |
| 18 | Protocol switch to mqtt | 200 from config endpoint |
| 19 | Protocol switch to http | 200 from config endpoint |
| 20 | GET /admin/stats | 200, all fields present |
| 21 | GET /admin/auth-logs | 200, includes auth_fail events |
| 22 | GET /admin/auth-logs?event_type=tamper_detected | 200, filtered |
| 23 | GET /admin/devices | 200, test device listed |
| 24 | GET /admin/packet-stats | 200, period_hours returned |
| 25 | GET /admin/error-log | 200, rejected packets listed |
| 26 | Replay protection: duplicate nonce | 401 |
| 27 | Deactivate device | 200, subsequent telemetry → 401 |
| 28 | Re-register deactivated device | 200, new key issued |

---

## 4. Phase 3 — AI Integration Tests

**File:** `backend/test_phase3.py`  
**Prerequisites:** Ollama running (`ollama serve`, model pulled)  
**Result:** Passes if Ollama is running; gracefully skips AI assertions otherwise

### Test Cases

| # | Test | Expected |
|---|---|---|
| 1 | GET /ai/status | 200, running/model fields |
| 2 | POST /ai/recommendation (Healthy) | 200, recommendation non-empty |
| 3 | POST /ai/recommendation (Motor Fault) | 200, mentions fault/urgent |
| 4 | POST /ai/recommendation (Battery Overheating) | 200, mentions temperature |
| 5 | POST /ai/recommendation (Low Battery) | 200, mentions range/charging |
| 6 | POST /ai/chat | 200, reply grounded in telemetry |
| 7 | AI WebSocket broadcast | ws receives `ai_recommendation` event |
| 8 | AI service disable | 200, AI stops sending WS events |
| 9 | AI service re-enable | 200, recommendations resume |

---

## 5. Phase 6 — End-to-End Matrix

**File:** `backend/test_phase6.py`  
**Prerequisites:** Backend running  
**Result:** 45/45 passed

### Test Matrix

| Axis | Values |
|---|---|
| Vehicle modes | Healthy, Eco, Sport, Heavy Traffic, Low Battery, Battery Overheating, Charging, Motor Fault (8) |
| Protocols | HTTP, MQTT (2) |
| Auth states | Auth enabled + HMAC (nominal), Tamper inject → rejection (1) |
| Chaos | No chaos, 25% loss (statistical) |

For each mode × HTTP:
1. Send telemetry with valid HMAC → expect 200 + DB row
2. Inject tamper → expect 401 + `tamper_detected`

Additional:
- Replay attack: send same packet twice → second returns 401
- Concurrent sends (5 goroutines) → all 5 logged correctly
- DB integrity: count rows before/after 8-mode send → 8 new rows

---

## 6. Frontend Manual Test Checklist

Performed in-browser at `http://localhost:3000`

### `/driver`
- [ ] Loading animation plays and completes
- [ ] Battery arc animates to correct % on live data
- [ ] Mode badge changes colour per vehicle mode
- [ ] Battery history graph updates every telemetry tick
- [ ] Speed + Motor Temp graph shows two series
- [ ] AI recommendation types in character-by-character
- [ ] Alert feed shows entries for Motor Fault / Low Battery / Battery Overheating
- [ ] Chat panel opens, sends message, receives grounded response

### `/noc`
- [ ] Packet flow animation shows left-to-right particles
- [ ] Packet table populates and scrolls
- [ ] Clicking a row opens the Packet Inspector with JSON
- [ ] Protocol switch button posts to backend and changes config
- [ ] Auth toggle: disable → packets show `no_auth`; enable → 401 on bad keys
- [ ] Packet loss 25%: ~1/4 packets show as dropped
- [ ] Latency 1000ms: visible delay in packet arrival rate
- [ ] Tamper inject: next packet shows red + rejected + `tamper_detected`
- [ ] Disconnect: subsequent telemetry rows show 401

### `/admin`
- [ ] CPU % and memory shown (live, updating)
- [ ] Packet stats match NOC table counts
- [ ] Auth log shows all event types
- [ ] Device list shows test device with last seen time
- [ ] Mode distribution pie updates as modes cycle

---

## 7. Known Limitations

| Item | Status | Notes |
|---|---|---|
| MQTT end-to-end | Partial | Mosquitto broker not always running. MQTT adapter code is complete and tested structurally; live publish requires `mosquitto` running |
| ESP32 hardware | Pending | Physical board not available; telemetry simulated by test scripts |
| AI latency | Variable | llama3.2:3b produces recommendations in 3–15s depending on hardware |
