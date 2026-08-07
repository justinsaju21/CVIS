# AGENTS.md — Connected Vehicle Intelligence System (CVIS)

This file is the binding build contract for any AI coding agent (Claude Code, Antigravity, or human contributor) working on this repository. It must be read in full before writing any code. Deviating from phase order, architecture, or scope defined here is not permitted without an explicit human instruction referencing this file.

Companion files this repo also uses (create if missing, update after every phase):
- `PROGRESS.md` — running log of what's been built, tested, and what's next
- `docs/build-plan.md` — the 8-week schedule mirrored from this file, with checkboxes
- `docs/ccns-mapping.md` — the syllabus mapping table (Unit 1–5), updated as features land

---

## 1. Project Identity

**Name:** Connected Vehicle Intelligence System (CVIS)
**Type:** Academic project, industry-inspired, CCNS (Computer Communication & Network Security) course
**Core thesis:** AI should live centrally (cloud/data-centre), not embedded per-vehicle. The vehicle is a thin, securely-networked client. This project demonstrates the *secure communication layer* that makes that architecture work — AI is the application riding on top of it, not the point of the project.

**Primary grading surface:** Networking + Security concepts, explicitly mapped to CCNS Units 1–5. AI is secondary and must never be implemented as simple if/else thresholding — it must reason over multiple telemetry values.

**Non-goals (do not build):**
- Real EV hardware / real sensors — telemetry is simulated on ESP32
- A generic chatbot with no telemetry grounding
- Three separate frontend codebases (see §3 — this was explicitly rejected in favor of one unified app)

---

## 2. Architecture (Authoritative)

```
ESP32 Vehicle Node (simulated telemetry, 1 push button = mode cycle)
        │
        ▼
Secure Communication Layer (HTTP REST ⇄ MQTT, runtime-switchable)
        │  — JSON payload, JWT/API key auth, AES-GCM/HMAC integrity,
        │    ack + retry, logged
        ▼
FastAPI Backend (the "laptop = cloud/data-centre")
        │  — protocol adapters, middleware chaos layer (loss/latency/tamper),
        │    Ollama AI reasoning layer, SQLite persistence
        ▼
Unified Next.js Frontend (single app, three role-gated views)
        ├── /driver   → Driver Dashboard
        ├── /noc      → CVIS Network Operations Center
        └── /admin    → Administrator Console
```

**Why unified frontend, not three apps:** same feature set, same grading checklist, one shared websocket feed, one shared component library, one auth context. This is the single biggest scope-reduction decision in this project and must not be reversed mid-build. Role-based routing (simple role flag, no need for full RBAC infra) is sufficient — this is an academic prototype, not a production SaaS.

**Protocol switching stays exactly as originally specced — full HTTP REST and MQTT support, runtime-switchable, no shortcut here.** This is a first-class feature, not a stretch goal. Both protocol adapters must be real, working clients (not one mocked).

---

## 3. Component Contracts

### 3.1 ESP32 Vehicle Node (`/firmware`)
- Arduino framework, WiFi-connected
- Generates telemetry every N seconds with **logically coherent** values (e.g., Sport Mode → higher motor temp + higher speed + faster battery drain; Battery Overheating → high motor temp + reduced range + fault code set)
- One push button (GPIO interrupt, debounced) cycles 8 modes: Healthy, Eco, Sport, Heavy Traffic, Low Battery, Battery Overheating, Charging, Motor Fault
- Sends telemetry via whichever protocol the backend currently has active (poll a `/config/protocol` endpoint or subscribe to a control topic — agent decides based on protocol in use)
- Signs/encrypts payload before sending (see §3.2)

### 3.2 Communication Layer (`/backend/comms`)
- Two adapters behind a common interface: `HttpAdapter`, `MqttAdapter` — switchable at runtime via NOC control, no restart required
- JSON payload schema versioned and documented
- Auth: JWT or API key per device (device registration flow required)
- Integrity: **HMAC-SHA256 or AES-GCM** on every payload — this replaces any vague "encryption toggle" with a real cryptographic integrity check the backend actually verifies and can reject on failure. This is the concrete implementation of "Packet Tampering → backend detects and rejects."
- Ack + retry: backend acks receipt; ESP32 retries on timeout with backoff
- Every packet logged (timestamp, direction, protocol, size, status) to SQLite for NOC/admin consumption

### 3.3 AI Backend (`/backend/ai`)
- Ollama, **small model** — `llama3.2:3b` or `phi3-mini`. Do not use a large model; live demo latency is the priority over marginal quality.
- AI reasons over the *combined* telemetry snapshot (battery, temp, mode, speed, fault code together), not single fields
- Two AI surfaces: (1) auto-generated recommendation/alert per telemetry update, (2) free-text driver chat grounded in current + recent telemetry
- Must produce natural-language explanations, not just labels

### 3.4 Unified Frontend (`/frontend`)
Next.js + Tailwind, one app, one websocket connection, three routed views:

**`/driver`** — Vehicle Health, Battery Status, Remaining Range, Current Mode, AI Recommendation, Alerts, Historical Graphs (Recharts), Chat with CVIS

**`/noc`** — this is the centerpiece, build it with care:
- Live animated packet flow (source → destination, protocol-colored)
- Packet table: number, source, destination, timestamp, protocol, size, RTT, latency, retry count, encryption status, auth status, connection status
- Click-to-expand packet inspector: header, JSON payload, timestamp, vehicle ID, encryption info, AI response, metadata
- **Live controls** (each wired to real backend behavior, not cosmetic toggles):
  - Protocol switch: HTTP ⇄ MQTT
  - Encryption toggle: Plain JSON / AES-GCM
  - Auth toggle: on/off, demonstrate real packet rejection when off
  - Packet loss slider: 0/5/10/25% — implemented as **backend middleware** that probabilistically drops before processing (see §3.5), not real network-layer packet dropping
  - Artificial latency slider: 0/100/300/1000ms — same middleware approach
  - Packet tampering injector: mutate a payload post-signature, confirm backend rejects via HMAC/AES-GCM check
  - Disconnect vehicle / Stop AI service buttons — simulate each failure mode independently

**`/admin`** — Connected vehicles, vehicle status, server status, AI status, active sessions, packet statistics, auth logs, failed requests, alerts, error logs, CPU/memory usage

### 3.5 Chaos/Simulation Middleware (`/backend/middleware`)
**This replaces any literal network manipulation.** Packet loss, latency, and tampering are simulated at the backend request-handling layer (middleware that intercepts before/after the real handler), configurable live from the NOC. This is fully legitimate for CCNS demonstration purposes and dramatically cheaper to build and debug than real network shaping — do not attempt real network-layer packet manipulation (e.g., tc/netem) unless explicitly instructed later.

---

## 4. Security Implementation (must be real, not simulated-only)

- Device registration: each ESP32 gets a unique device ID + provisioned secret/API key
- JWT or signed API key on every request/message
- HMAC-SHA256 (minimum) or AES-GCM on payload for integrity + optional confidentiality
- TLS/HTTPS on the FastAPI layer where feasible for the demo environment
- Session management for frontend/admin login
- All auth failures and tamper rejections logged and surfaced in `/admin`
- Replay protection: optional, implement only after core phases are stable (nonce or timestamp window)

---

## 5. Tech Stack (locked)

| Layer | Choice |
|---|---|
| Firmware | ESP32, Arduino framework |
| Backend | Python, FastAPI |
| AI | Ollama, llama3.2:3b or phi3-mini |
| Frontend | Next.js, Tailwind CSS |
| DB | SQLite (upgrade to Postgres only if explicitly requested) |
| Charts | Recharts |
| Protocols | HTTP REST + MQTT (both real, runtime-switchable) |
| Realtime to frontend | WebSocket (single shared connection, fan-out to all three views) |

Do not substitute any of these without explicit instruction.

---

## 6. Phased Build Plan (8 Weeks) — strict phase gating

Each phase must be **fully working and tested** before the next begins. Agent must update `PROGRESS.md` at the end of each phase with: what was built, how it was tested, what's deferred.

**Phase 1 (Week 1–2) — Core pipeline, HTTP only**
ESP32 → FastAPI (HTTP) → SQLite → minimal `/driver` view showing live telemetry. No auth, no encryption, no AI yet. Goal: prove the pipe works end to end.

**Phase 2 (Week 2–3) — Auth + Integrity + MQTT**
Add device registration, JWT/API key auth, HMAC/AES-GCM signing. Add MQTT adapter alongside HTTP. Add runtime protocol switch (backend-side first, NOC control comes in Phase 4). Test: send tampered packet, confirm rejection.

**Phase 3 (Week 3–4) — AI Integration**
Ollama running locally, telemetry-grounded recommendations, driver chat endpoint. Wire into `/driver` view. Test with all 8 vehicle modes to confirm AI responses are coherent per mode.

**Phase 4 (Week 4–5) — NOC**
Build `/noc`: live packet flow visualization, packet table + inspector, all live controls (protocol, encryption, auth, loss, latency, tamper injection, disconnect, stop-AI). This is the most time-intensive phase — budget accordingly, do not compress it.

**Phase 5 (Week 5–6) — Admin Console + Business Model doc**
Build `/admin` with all specified stats/logs. Write the Free/Premium tier justification doc tying centralized-AI economics back to the project thesis.

**Phase 6 (Week 6–7) — Hardening + Testing**
End-to-end testing across all modes × both protocols × all chaos settings. Fix reconnect logic (MQTT drop/reconnect, ESP32 WiFi drop/reconnect). This week exists specifically to prevent live-demo failure — do not skip it under schedule pressure.

**Phase 7 (Week 7–8) — Documentation Pack**
Architecture diagrams, sequence diagrams, packet flow diagrams, API docs, installation guide, user manual, testing docs, security analysis, performance analysis, IEEE-style report, PPT, demo script, viva Q&A, and the CCNS Unit 1–5 mapping table (`docs/ccns-mapping.md`) — every implemented feature explicitly tied to a syllabus learning outcome.

**Phase 8 (buffer, end of Week 8)** — demo rehearsal, fix whatever breaks in rehearsal. Do not schedule new features here.

---

## 7. Agent Execution Rules

1. **No scope creep.** Do not add features not listed in this file without explicit instruction, even if they seem like natural extensions.
2. **No phase skipping.** Do not start Phase N+1 work until Phase N is confirmed working and `PROGRESS.md` is updated.
3. **Explain before building.** Before implementing a module, state the design rationale in 2-4 sentences (per original CVIS spec requirement).
4. **Test after building.** After implementation, provide: testing procedure, expected output, and which CCNS concept(s) it demonstrates.
5. **Dependency discipline.** Don't introduce new libraries/frameworks outside §5's locked stack without flagging it first.
6. **Real over cosmetic.** Every NOC control must cause a real, verifiable backend behavior change — no toggle that only changes UI state without backend effect.
7. **Keep AI reasoning multi-factor.** Never reduce the AI layer to threshold if/else logic, even under time pressure — this is a graded requirement, not a nice-to-have.
8. **Update companion files every phase:** `PROGRESS.md` (what shipped), `docs/build-plan.md` (checkboxes), `docs/ccns-mapping.md` (new mappings as features land).

---

## 8. Deliverables Checklist (final state)

- [ ] ESP32 firmware (8 modes, realistic telemetry)
- [ ] FastAPI backend (HTTP + MQTT adapters, auth, HMAC/AES-GCM, chaos middleware)
- [ ] Ollama AI integration (recommendations + chat)
- [ ] Unified Next.js frontend: `/driver`, `/noc`, `/admin`
- [ ] SQLite schema + persisted logs
- [ ] Architecture, sequence, and packet-flow diagrams
- [ ] API documentation
- [ ] Installation guide + user manual
- [ ] Testing documentation
- [ ] Security analysis + performance analysis
- [ ] IEEE-style project report
- [ ] PowerPoint presentation
- [ ] Demo script
- [ ] Viva questions & answers
- [ ] CCNS Unit 1–5 mapping table, fully justified
