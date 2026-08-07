# CVIS — PROGRESS.md
<!-- Running log: what shipped, how it was tested, what's deferred -->

---

## Phase 1 — Core Pipeline, HTTP Only
**Status:** ✅ Complete — 20/20 smoke tests passed. Pending: hardware test on physical ESP32.
**Target:** Week 1–2

### What was built
| Component | File(s) | Notes |
|---|---|---|
| ESP32 Firmware | `firmware/firmware.ino` | 8 modes, adaptive intervals, HTTP POST, retry+backoff, button ISR |
| Secrets template | `firmware/secrets.h.example` | Copy → `secrets.h`, gitignored |
| FastAPI backend | `backend/main.py` | DB init, CORS, routers |
| DB schema | `backend/db.py` | `packets` + `telemetry` tables |
| Pydantic models | `backend/models.py` | Typed, physically-bounded |
| WebSocket | `backend/ws_manager.py`, `routers/ws.py` | Fan-out + backfill |
| Telemetry ingest | `backend/routers/telemetry.py` | POST + broadcast |
| Smoke test | `backend/test_phase1.py` | 20/20 passed |

---

## Phase 2 — Auth + Integrity + MQTT
**Status:** ✅ Complete — 28/28 tests passed + chaos tamper end-to-end verified.
**Target:** Week 2–3

### What was built
| Component | File(s) | Notes |
|---|---|---|
| Crypto primitives | `backend/crypto.py` | HMAC-SHA256 + AES-256-GCM (constant-time verify) |
| Auth dependency | `backend/auth.py` | FastAPI Depends: X-API-Key + X-HMAC-Signature, runtime toggle |
| DB schema v2 | `backend/db.py` | Added `devices`, `auth_logs`, `server_config` tables |
| Device registration | `backend/routers/devices.py` | `POST /api/v1/devices/register` — issues api_key + device_secret |
| Config router | `backend/routers/config.py` | Protocol / encryption / auth / chaos NOC controls |
| Telemetry service | `backend/services/telemetry_service.py` | Shared ingest: auth → decrypt → HMAC → store → broadcast → AI |
| MQTT adapter | `backend/comms/mqtt_adapter.py` | paho-mqtt subscriber, bridges to asyncio event loop |
| Chaos middleware | `backend/middleware/chaos.py` | Raw ASGI: packet loss, latency, payload tamper injection |
| Admin router | `backend/routers/admin.py` | Real stats: packets, auth logs, devices, system CPU/mem |
| Phase 2 firmware | `firmware/firmware.ino` | API key header, HMAC signing, AES-GCM, MQTT publish, config poll |
| ESP32 crypto | `firmware/crypto_utils.h` | mbedTLS HMAC-SHA256 + AES-256-GCM, hardware RNG IV |
| Smoke test | `backend/test_phase2.py` | 28/28 passed |

### Key security demonstrations
- **Auth rejection:** No/bad X-API-Key → 401 (logged in auth_logs)
- **HMAC tamper detection:** Forged/bad signature → 401 + `tamper_detected` auth log
- **Chaos tamper → HMAC fail:** ChaosMiddleware mutates body post-signature → HMAC fails → 401 ✅
- **AES-GCM encrypted POST:** Encrypt → HMAC on plaintext → backend decrypts + verifies → 200 ✅
- **Auth toggle:** NOC disables auth → open traffic logged as `no_auth`; re-enable → 401 again
- **Packet loss:** Probabilistic 503 at configured % (0/5/10/25%)
- **Latency:** asyncio.sleep() before route handler (0/100/300/1000ms)

---

## Phase 3 — AI Integration
**Status:** ✅ Backend complete. Ollama endpoints functional; live AI tests require `ollama serve`.
**Target:** Week 3–4

### What was built
| Component | File(s) | Notes |
|---|---|---|
| Ollama client | `backend/ai/ollama_client.py` | Async httpx, 20s timeout, graceful degradation |
| Prompt builder | `backend/ai/prompt_builder.py` | Multi-factor prompt: all telemetry fields + mode context |
| AI router | `backend/routers/ai.py` | `/ai/recommendation`, `/ai/chat`, `/ai/status` |
| Auto-trigger | `services/telemetry_service.py` | Fire-and-forget AI task per ingest → WS broadcast |
| AI test | `backend/test_phase3.py` | Gracefully skips if Ollama not running |

### To enable AI
```bash
# Install Ollama from https://ollama.ai
ollama serve
ollama pull llama3.2:3b  # or: ollama pull phi3-mini
python test_phase3.py
```

---

## Phase 4 Backend — Chaos Middleware (NOC Controls)
**Status:** ✅ All controls implemented and tested.

The chaos middleware and config endpoints are Phase 4's backend half.
NOC UI wiring deferred to Phase 4 proper (user will provide UI reference).

---

## Phase 5 Backend — Admin Stats
**Status:** ✅ All admin endpoints implemented.

Frontend (`/admin`) deferred until user provides UI reference.

---

## What's deferred

| Item | Phase | Status |
|---|---|---|
| ESP32 hardware test | Phase 1 | Pending hardware |
| Mosquitto MQTT broker setup + test | Phase 2 | Pending `mosquitto` install |
| Ollama live AI test | Phase 3 | Pending `ollama serve` |
| Frontend: `/driver` view | Phase 1 UI | ✅ Built (React/Next.js) |
| Frontend: `/noc` view | Phase 4 UI | ✅ Built (React/Next.js) |
| Frontend: `/admin` view | Phase 5 UI | ✅ Built (React/Next.js) |

---

*Last updated: Phase 2–5 backend build*
