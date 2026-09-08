# Connected Vehicle Intelligence System (CVIS)

## A Demonstration of Centralised AI and Secure Vehicle Communication

### CCNS Course Project Report — IEEE Style

---

**Abstract** — This paper presents the Connected Vehicle Intelligence System (CVIS), an academic prototype demonstrating secure, protocol-agnostic communication between IoT vehicle nodes and a centralised AI reasoning layer. CVIS implements HMAC-SHA256 payload authentication, AES-256-GCM optional encryption, runtime protocol switching between HTTP REST and MQTT, replay protection, and a chaos simulation middleware — all verified through automated end-to-end testing. A unified Next.js frontend provides three role-gated views: a real-time driver dashboard, a Network Operations Centre with live packet visualisation and all security controls, and an administrative console. An Ollama language model (llama3.2:3b) provides multi-factor AI recommendations grounded in full vehicle telemetry. The system demonstrates all five CCNS course units through working, verifiable implementations.

**Keywords** — Connected vehicles, IoT security, HMAC-SHA256, AES-GCM, MQTT, HTTP REST, protocol switching, packet integrity, replay protection, centralised AI, FastAPI, WebSocket.

---

## I. Introduction

The proliferation of connected vehicles introduces a fundamental architecture question: where should intelligence reside? Per-vehicle edge AI requires embedding expensive compute hardware in each unit, ties the reasoning capability to the manufacture date, and complicates over-the-air updates. This project argues for a centralised architecture in which the vehicle is a thin, securely-networked client and AI runs in a cloud data centre.

CVIS implements this architecture at the scale of a single developer machine, simulating the vehicle with an ESP32 microcontroller and the cloud data centre with a FastAPI server. The demonstration focus is the *secure communication layer* — the mechanisms by which telemetry is authenticated, optionally encrypted, reliably delivered, and protected against replay and tampering. AI reasoning is the application riding on top of this layer, not the point of the project.

The system is structured across eight development phases, with each phase gated on automated test passage before the next begins. This document covers the complete system as built through Phase 7.

---

## II. System Architecture

### A. Overview

CVIS comprises three tiers:

1. **Vehicle Node** — ESP32 microcontroller running Arduino-framework firmware. Generates telemetry across eight simulated vehicle modes, signs payloads with HMAC-SHA256, optionally encrypts with AES-256-GCM, and transmits via HTTP REST or MQTT.

2. **Backend** — Python FastAPI server acting as the cloud data centre. Implements a ChaosMiddleware ASGI wrapper, authentication layer, cryptographic verification, SQLite persistence, Ollama AI integration, and WebSocket fan-out.

3. **Frontend** — Unified Next.js application with three role-gated views (`/driver`, `/noc`, `/admin`) connected to the backend via a single shared WebSocket.

### B. Communication Layer

The communication layer supports two protocol adapters behind a common ingest interface:

- **HttpAdapter** — POST requests to `/api/v1/telemetry`. Request-response over TCP. Synchronous acknowledgement per packet.
- **MqttAdapter** — paho-mqtt subscriber on `cvis/telemetry/+`. Publish-subscribe via Mosquitto broker. Async bridge to the FastAPI event loop.

The active protocol is switchable at runtime via `POST /api/v1/config/protocol` — no server restart required.

### C. Stateful Physics Simulation

To provide realistic telemetry for the AI reasoning layer, both the physical ESP32 and the Python simulator implement a continuous stateful physics engine. Rather than generating randomized values, the engine tracks variables (speed, battery percentage, temperatures) across loop cycles and calculates delta time (`dt`). Mode changes update a target speed and efficiency profile. Physical inertia, continuous aerodynamic battery drain, and thermal drift are mathematically applied per cycle. The estimated range is dynamically calculated by multiplying the real-time battery percentage by the active mode's efficiency factor. This strict interconnection ensures that when the vehicle's state changes, all dependent telemetry fields react realistically over time.

### D. Ingest Pipeline

Every packet, regardless of transport, passes through the same ingest pipeline:

```
Raw ASGI request
  → ChaosMiddleware (drop / delay / tamper)
  → Auth layer (API-key validation)
  → HMAC-SHA256 verify (constant-time)
  → AES-256-GCM decrypt (if encrypted)
  → Pydantic validation
  → SQLite persist
  → WebSocket broadcast
  → Ollama AI task (fire-and-forget)
```

---

## III. Security Implementation

### A. Device Authentication

Each ESP32 device registers via `POST /api/v1/devices/register`, receiving a 64-byte random API key. The key is stored as `SHA-256(api_key)` in the database — never in plaintext. Subsequent requests include the raw key in the `X-API-Key` header; the backend hashes it and compares with the stored hash.

### B. Payload Integrity — HMAC-SHA256

The firmware computes `HMAC-SHA256(device_secret, canonical_json)` using mbedTLS. The signature is sent in the `X-HMAC-Signature` header. The backend recomputes the HMAC over the received body and compares using `hmac.compare_digest()` — a constant-time operation that prevents timing oracle attacks.

Any modification to the payload — including by the chaos middleware — invalidates the signature and causes a 401 rejection, logged as `tamper_detected`.

### C. Optional Confidentiality — AES-256-GCM

When encryption is enabled, the firmware encrypts the payload using AES-256-GCM with a fresh random IV per packet (hardware RNG on the ESP32). The encrypted envelope contains:

```json
{ "encrypted": true, "iv": "<base64>", "ct": "<base64>", "tag": "<base64>" }
```

### D. Encrypt-then-MAC vs MAC-then-Encrypt

HMAC is computed over the plaintext before encryption. The backend verifies HMAC first (over the expected plaintext reconstruction), then decrypts. This is technically a MAC-then-Encrypt ordering applied within an AEAD envelope. Since AES-GCM's own authentication tag already provides authenticated encryption and prevents ciphertext tampering, the additional HMAC provides an extra layer of application-level integrity over the plaintext but is not cryptographically strictly required.

### E. Replay Protection

Each payload includes `timestamp_ms` (a boot-relative monotonic `millis()` token on the ESP32, not wall-clock time). The backend maintains a bounded set of seen `(device_id, timestamp_ms)` pairs for a 30-second rolling window. Packets within the 30-second window with duplicate timestamps are rejected with 401. Cache eviction occurs at approximately 60 seconds.

### F. Chaos Middleware — Security Demonstrations

A raw ASGI middleware intercepts requests before FastAPI body parsing and can:

- **Drop** — return 503 without processing (probabilistic)
- **Delay** — inject `asyncio.sleep()` before the route handler
- **Tamper** — mutate one byte of the body post-signature, causing HMAC failure

All chaos settings are configurable at runtime from the NOC without restarting the server.

---

## IV. Protocol Analysis — HTTP vs MQTT

| Dimension | HTTP REST | MQTT |
|---|---|---|
| Model | Request-response | Publish-subscribe |
| Connection | Per-request (TCP) | Persistent to broker |
| Acknowledgement | Synchronous (200 OK) | QoS-level (0/1/2) |
| Scalability | N vehicles → N connections | N vehicles → 1 broker |
| Overhead per packet | HTTP headers (~200–400 B) | MQTT fixed header (2 B) |
| Best for | Low-frequency, guaranteed delivery | High-frequency, many devices |
| CVIS implementation | `HttpAdapter` in `comms/` | `MqttAdapter` in `comms/` |

Both protocols pass through the same ingest pipeline, demonstrating that the application layer is fully decoupled from the transport choice.

---

## V. AI Integration

### A. Design Rationale

The AI reasoning layer uses Ollama running `llama3.2:3b` — a 3-billion parameter language model chosen for demo-friendly inference latency (8–15 seconds on CPU). The AI is architecturally decoupled from the communication layer via fire-and-forget `asyncio.create_task()` dispatch. Telemetry ingest returns 200 OK in under 10 ms regardless of AI load.

### B. Multi-factor Prompt

The prompt builder constructs a structured prompt including all eight telemetry fields, the vehicle mode, and recent historical context. The model is required to reason across all values simultaneously — for example, "Sport mode + motor temperature 78°C + battery draining at +3%/min → reduce performance mode before overheating threshold". This is explicitly not threshold if/else logic.

### C. AI Surfaces

1. **Auto-recommendation** — triggered per telemetry ingest, broadcast via `ai_recommendation` WebSocket event to the driver dashboard.
2. **Chat** — driver can submit free-text queries grounded in current and recent telemetry via `POST /api/v1/ai/chat`.

---

## VI. Frontend Architecture

The unified Next.js application avoids the cost and complexity of three separate codebases. All views share:

- A single `useWebSocket` hook with auto-reconnect (exponential backoff)
- A shared component library (glassmorphism cards, Framer Motion animations, Recharts graphs)
- A single auth context (role-based view routing)

### Driver Dashboard
Real-time vehicle health: battery arc, telemetry cards, 60-point history graphs (Recharts), AI recommendation panel with typewriter animation, alert feed, and free-text chat.

### Network Operations Centre
Live packet flow animation, paginated packet table with click-to-expand inspector, and eight live controls — each wired to real backend behaviour: protocol switch, encryption toggle, auth toggle, packet loss slider, latency slider, tamper injector, disconnect vehicle, stop AI.

### Admin Console
Aggregated statistics: server uptime, live CPU/memory (psutil), packet counts, protocol breakdown, auth event log, device registry, error log.

---

## VII. Testing

### A. Automated Tests

| Script | Coverage | Result |
|---|---|---|
| `test_phase1.py` | Core ingest pipeline | 20/20 |
| `test_phase2.py` | Auth, HMAC, AES-GCM, chaos | 28/28 |
| `test_phase3.py` | AI endpoints (requires Ollama) | Pass/skip |
| `test_phase6.py` | 8 modes × HTTP × tamper matrix | 45/45 |

### B. Key Security Tests

- Valid packet with correct HMAC → 200 OK ✓
- Valid packet with forged HMAC → 401 + `tamper_detected` logged ✓
- Chaos tamper → HMAC fail → 401 ✓
- AES-GCM encrypted packet → 200 OK, decrypted correctly ✓
- Replay of captured packet → 401 ✓
- No API key → 401 ✓
- Auth disabled → `no_auth` logged, packet accepted ✓

---

## VIII. Performance

| Metric | Value |
|---|---|
| Telemetry ingest p50 latency | 4–8 ms |
| Telemetry ingest p95 latency | 12–18 ms |
| AI inference latency (llama3.2:3b, CPU) | 8–15 s |
| WebSocket fan-out (4 clients) | < 1 ms |
| SQLite INSERT (WAL mode) | 2–5 ms |
| Concurrent packet ingestion (5 threads) | All 5/5 successful |

AI latency is decoupled from ingest latency by design. The secure communication layer operates independently of AI availability.

---

## IX. CCNS Syllabus Mapping Summary

| Unit | Topics Demonstrated | Count |
|---|---|---|
| Unit 1 — Data Communication | JSON schema, schema versioning, adaptive intervals, protocol agnosticism | 5 |
| Unit 2 — Network Models & Protocols | OSI layers, HTTP vs MQTT, WebSocket upgrade, pub-sub routing | 6 |
| Unit 3 — Transport Layer | TCP reliability, app-layer retry, packet loss, latency, QoS | 7 |
| Unit 4 — Network Security | HMAC, AES-GCM, timing attack prevention, replay protection, revocation, audit logs | 10 |
| Unit 5 — Advanced Topics | Centralised AI thesis, multi-factor reasoning, async decoupling, graceful degradation | 6 |
| **Total** | **All 5 CCNS units** | **34** |

Full mapping: `docs/ccns-mapping.md`

---

## X. Conclusion

CVIS demonstrates a complete, working implementation of secure vehicle-to-cloud communication across all five CCNS course units. The system is not a simulation of security — HMAC verification, AES-GCM decryption, replay detection, and tamper rejection are all executed on every packet by the running backend. The chaos middleware provides live, verifiable demonstrations of network-layer threats. The AI layer, while non-trivial, is architecturally secondary to the secure communication layer — consistent with the project thesis that intelligence should be centralised and the vehicle should be a thin, securely-networked client.

---

## References

[1] R. Fielding, "Architectural Styles and the Design of Network-based Software Architectures," PhD thesis, UC Irvine, 2000.

[2] OASIS MQTT Technical Committee, "MQTT Version 5.0," OASIS Standard, March 2019.

[3] National Institute of Standards and Technology, "Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM)," NIST SP 800-38D, 2007.

[4] H. Krawczyk, M. Bellare, R. Canetti, "HMAC: Keyed-Hashing for Message Authentication," RFC 2104, IETF, 1997.

[5] I. Fette, A. Melnikov, "The WebSocket Protocol," RFC 6455, IETF, 2011.

[6] ARM Holdings, "mbedTLS Cryptographic Library," https://github.com/Mbed-TLS/mbedtls

[7] Meta AI Research, "Llama 3," 2024. https://ai.meta.com/llama/

[8] Ollama, "Ollama — Run Large Language Models Locally," https://ollama.ai
