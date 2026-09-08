# CVIS — Build Plan (8-Week Schedule)
<!-- Mirrored from AGENTS.md §6. Check boxes as phases complete. -->

---

## Phase 1 — Core Pipeline, HTTP Only (Week 1–2)
- [x] ESP8266 firmware: 8 modes, adaptive intervals, HTTP POST, retry+backoff
- [x] FastAPI backend: telemetry ingest, SQLite persistence, WebSocket fan-out
- [x] SQLite schema: `packets` + `telemetry` tables
- [x] Smoke test script (`test_phase1.py`)
- [x] Companion docs seeded (PROGRESS.md, build-plan.md, ccns-mapping.md)
- [x] Hardware test with physical ESP8266 board — confirmed live at `https://cvis.justinsaju.me`
- [x] PROGRESS.md updated and signed off ← **gate for Phase 2**

---

## Phase 2 — Auth + Integrity + MQTT (Week 2–3)
- [x] Device registration endpoint (`POST /api/v1/devices/register`)
- [x] JWT / API-key auth on every request (X-API-Key header + FastAPI Depends)
- [x] HMAC-SHA256 payload signing (firmware + backend verify, constant-time)
- [x] AES-GCM optional confidentiality (X-Encrypted header + envelope)
- [x] MQTT adapter (paho-mqtt, cvis/telemetry/+ subscriber, async bridge)
- [x] Runtime protocol switch (`POST /api/v1/config/protocol`)
- [x] Tamper test: send mutated payload → HMAC fail → 401 + `tamper_detected` logged ✅
- [x] Auth toggle (NOC: disable → open traffic; re-enable → 401)
- [x] Chaos middleware (loss/latency/tamper) — raw ASGI, intercepts before body caching
- [x] Admin endpoints (/admin/stats, /auth-logs, /devices, /packet-stats, /error-log)
- [x] PROGRESS.md updated

---

## Phase 3 — AI Integration (Week 3–4)
- [x] Ollama running locally (llama3.2:3b or phi3-mini)
- [x] Telemetry-grounded recommendations endpoint
- [x] Driver chat endpoint (grounded in current + recent telemetry)
- [x] Wire AI responses into `/driver` view
- [x] Test all 8 modes × AI coherence
- [x] PROGRESS.md updated ← gate for Phase 4

---

## Phase 4 — NOC (Week 4–5)
- [x] `/noc` view: live animated packet flow
- [x] Packet table + click-to-expand inspector
- [x] Protocol switch control (HTTP ⇄ MQTT) — wired to backend
- [x] Encryption toggle — wired to backend
- [x] Auth toggle (on/off, real packet rejection demo)
- [x] Packet loss slider (backend chaos middleware)
- [x] Latency slider (backend chaos middleware)
- [x] Tamper injector (mutate post-signature, confirm rejection)
- [x] Disconnect vehicle / Stop AI buttons (POST /control/disconnect + /control/ai-service)
- [x] PROGRESS.md updated ← gate for Phase 5

---

## Phase 5 — Admin Console + Business Model (Week 5–6)
- [x] `/admin` view: all stats, logs, system status
- [x] CPU/memory usage display
- [x] Business model doc (Free/Premium tier justification) → docs/business-model.md
- [x] PROGRESS.md updated ← gate for Phase 6

---

## Phase 6 — Hardening + Testing (Week 6–7)
- [x] End-to-end test: all 8 modes × both protocols × all chaos settings (test_phase6.py: 45/45 passed)
- [x] MQTT reconnect logic (Verified with local Mosquitto broker)
- [x] ESP8266 WiFi drop/reconnect logic (confirmed with physical hardware)
- [x] Replay protection (nonce/timestamp window) — implemented and tested
- [x] PROGRESS.md updated ← gate for Phase 7

---

## Phase 7 — Documentation Pack (Week 7–8)
- [x] Architecture diagrams → docs/architecture-diagrams.md
- [x] Sequence diagrams → docs/architecture-diagrams.md
- [x] Packet flow diagrams → docs/architecture-diagrams.md
- [x] API documentation → docs/api-reference.md
- [x] Installation guide → docs/installation-guide.md
- [x] User manual → docs/user-manual.md
- [x] Testing documentation → docs/testing-documentation.md
- [x] Security analysis → docs/security-analysis.md
- [x] Performance analysis → docs/performance-analysis.md
- [x] IEEE-style project report → docs/ieee-report.md
- [ ] PowerPoint presentation (manual — create from ieee-report.md)
- [x] Demo script → docs/demo-script.md
- [x] Viva Q&A → docs/viva-qa.md
- [x] CCNS Unit 1–5 mapping table (docs/ccns-mapping.md) — 34 features mapped
- [x] End-to-end workflow documentation → docs/cvis-workflow.md
- [x] Homeserver deployment guide → docs/homeserver_deployment_guide.md

---

## Phase 8 — Demo Rehearsal (End of Week 8)
- [x] System deployed live at `https://cvis.justinsaju.me`
- [x] ESP8266 confirmed sending live telemetry over Cloudflare Tunnel
- [ ] Full demo run-through with demo-script.md
- [ ] Fix any rehearsal failures
- [ ] No new features
