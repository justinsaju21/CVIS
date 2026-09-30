# Connected Vehicle Intelligence System (CVIS)
## A Demonstration of Secure, Protocol-Agnostic Vehicle-to-Cloud Communication with Centralised AI Reasoning

**Justin Saju** — Department of Computer Science and Engineering, Amal Jyothi College of Engineering, Kanjirappally, Kerala, India

> **Reference Audit Note:** This document was audited against IEEE Xplore, DOI.org/Crossref, arXiv, NIST, and IETF sources. Corrections made to references [6], [7], [13], and [14]. See Reference Audit Summary at end of document.

---

**Abstract** — The proliferation of connected and electric vehicles raises a fundamental question that much of the existing literature sidesteps: where should intelligence reside, and how do we secure the channel that feeds it? This paper presents the Connected Vehicle Intelligence System (CVIS), an end-to-end academic prototype that deliberately argues for a centralised AI architecture — one where the vehicle is a thin, securely-networked client and all reasoning happens in the cloud. CVIS implements HMAC-SHA256 payload authentication, AES-256-GCM optional encryption, a rolling-window timestamp-based replay protection scheme adapted for embedded nodes without wall-clock synchronisation, and runtime switching between HTTP REST and MQTT through a unified ingest pipeline that applies identical cryptographic verification regardless of transport. A chaos simulation middleware built as a raw ASGI wrapper provides live, verifiable demonstrations of packet loss, artificial latency, and tamper injection — all without any external network infrastructure. An Ollama language model (llama3.2:3b) generates multi-factor AI recommendations grounded in physics-contextualised telemetry snapshots rather than raw numeric streams. A unified Next.js frontend delivers three role-gated views — a real-time driver dashboard, a Network Operations Centre with live packet visualisation, and an administrative console — each wired to the same WebSocket feed and the same backend security controls. Automated test suites report 93 total passing tests across four test scripts. The system maps to all five units of the Computer Communication and Network Security (CCNS) course syllabus through working, verifiable implementations.

**Keywords** — Connected vehicles, IoT security, HMAC-SHA256, AES-256-GCM, MQTT, HTTP REST, protocol switching, replay protection, centralised AI, LLM, FastAPI, WebSocket, chaos middleware, Internet of Vehicles.

---

## I. Introduction

Connected vehicles are generating data faster than the infrastructure designed to receive, protect, and reason over it can keep up. Every two seconds, a vehicle on a modern IoT platform can push a telemetry snapshot containing battery state, motor temperature, speed, fault codes, and a dozen derived signals — and that data is only valuable if the cloud layer receiving it can be trusted to have received exactly what was sent, from exactly who claimed to have sent it, and within a time window that prevents replayed history from corrupting present state.

The architecture question — where should intelligence live — is not settled. A large portion of the 2023–25 literature has moved decisively toward federated learning and edge AI, arguing that pushing models to the roadside unit or the vehicle itself reduces latency, preserves privacy, and avoids bandwidth bottlenecks [6][7]. These are legitimate concerns for production-scale deployments. But this paper argues the opposite position: that a centralised language model, receiving the full multi-factor telemetry snapshot over a securely-verified channel, produces qualitatively richer insights than a lightweight edge model trained on a partitioned local dataset. The reasoning is simple — mode transitions, compound fault patterns, and trend correlations across multiple physical signals are exactly the kind of semantic synthesis that a general-purpose language model does well, and that statistical edge models struggle with.

CVIS is built to demonstrate this claim concretely, not just to assert it.

### A. Motivation and Research Gaps

The existing literature on connected vehicle security and AI is rich, but it leaves several specific gaps that motivated this work.

The first gap is **protocol agnosticism with unified security verification**. Among the sources reviewed for this project, published prototypes tend to commit to a single transport — either HTTP [1] or MQTT [4][13] — and design their security stack around it. Within the reviewed literature, a working prototype demonstrating runtime switching between HTTP REST and MQTT while maintaining an identical cryptographic verification path (same authentication check, same HMAC verification, same replay window, same SQLite persistence) across both transports was not identified.

The second gap is **the case for centralised LLM reasoning as an intentional architectural choice**. The sources reviewed for this project show a strong direction toward federated learning [7] and edge intelligence [6]. Within this reviewed set, the deliberate, affirmative argument that centralised LLM reasoning over full telemetry snapshots is the right choice for compound-fault diagnosis — presented as a design position rather than a temporary compromise — is underrepresented.

The third gap is **application-layer chaos middleware as a zero-infrastructure security teaching tool**. The vehicular network testbeds and academic prototypes reviewed for this project predominantly rely on real network-layer tools (tc/netem, ns-3, SUMO) that require significant lab infrastructure. Within the reviewed sources, an approach that achieves the same pedagogical goals through pure application-layer middleware with no external tooling was not found documented.

The fourth gap is **physics-contextualised LLM prompting for structured telemetry**. The sources reviewed on LLM application to sensor data [3][14] primarily treat telemetry as flat numeric time series. CVIS interprets this as an opportunity: its prompt builder injects mode-aware range violations, directional trend annotations, and mode-transition event markers, giving the model semantic context rather than raw numbers. This specific prompting approach for multi-modal vehicle telemetry was not encountered in the reviewed sources.

The fifth gap is **replay protection without wall-clock synchronisation on resource-constrained nodes**. Replay protection schemes reviewed, such as the timestamp-based approach in [13], assume the embedded device can maintain synchronised wall-clock time. On an ESP8266 microcontroller without real-time clock hardware, NTP synchronisation adds significant complexity. CVIS addresses this by using the Arduino `millis()` monotonic boot counter as a replay token, combined with a device re-registration requirement after every reboot, achieving equivalent protection with zero clock infrastructure. This particular adaptation for clock-free embedded nodes was not encountered in the reviewed sources.

The sixth gap is **a unified multi-role frontend wired to live security demonstrations**. The academic prototypes reviewed for this project tend to provide either detailed packet-level views (Wireshark-style) or high-level operational dashboards (Grafana-style), but not a single integrated frontend that combines driver, NOC, and admin roles with inline, real-time security controls that directly affect backend behaviour. This combination was not found in the reviewed set.

### B. Contributions

This paper makes the following concrete contributions:

1. A working protocol-switching architecture (HTTP REST ↔ MQTT) with a unified, transport-agnostic ingest and verification pipeline, tested end-to-end.
2. A HMAC-SHA256 + AES-256-GCM security stack verified to reject forged and tampered packets in automated tests.
3. A replay protection scheme using monotonic boot-relative timestamps, adapted for clock-free embedded nodes.
4. An application-layer chaos middleware that provides live, verifiable demonstrations of packet loss, latency, and tamper detection with zero external dependencies.
5. A physics-contextualised LLM prompting approach with mode-awareness, trend deltas, and range violation annotations.
6. A unified three-role frontend with live NOC controls wired to real backend security state changes.

---

## II. Related Work

### A. IoT Vehicle Communication Security

The security of machine-to-cloud communication in vehicular networks has received sustained attention. Ma et al. [5] present STCLA, a certificateless authenticated key agreement scheme for the Internet of Vehicles that uses HMAC-SHA256 as an integrity primitive and avoids the computational overhead of bilinear pairings — a direction closely aligned with CVIS's choice of HMAC-SHA256 over certificate-based PKI. CVIS notes that their scheme targets authenticated key agreement in a fog-based IoV context and does not address the runtime protocol-switching or application-layer chaos demonstration scenarios that CVIS targets.

The survey by Baccari et al. [3] provides a thorough taxonomy of anomaly detection methods in connected and autonomous vehicles, covering statistical baselines, classical ML, and deep learning approaches. CVIS interprets the survey's review of per-signal evaluation methods as pointing toward an opportunity for multi-signal holistic reasoning, which CVIS's LLM-based recommendation layer targets.

For MQTT-specific security, Laghari et al. [4] provide a comprehensive taxonomy of vulnerabilities in the MQTT ecosystem — ranging from unauthenticated broker connections to payload injection and broker spoofing — and evaluate mitigations. CVIS implements several of the mitigations discussed (payload authentication, API key per device, encrypted envelopes) while additionally demonstrating them live through its chaos middleware.

### B. AI and LLMs in Vehicular Systems

The application of large language models to structured time-series data is an active area. Moramarco et al. [14] evaluate LLMs for time series anomaly detection in aerospace software, finding that LLMs perform well on univariate signals but struggle with multivariate telemetry and that few-shot prompting provides modest gains. CVIS interprets these findings as supporting its choice of semantically enriched, physics-contextualised prompts over raw numeric input, though the specific vehicle-telemetry domain is distinct from the aerospace domain evaluated in [14].

Among the sources reviewed, federated and edge AI approaches to vehicular intrusion detection [6][7] represent a prominent direction. Hakeem and Kim [6] survey ML, federated learning, and edge AI approaches for V2X security across a broad range of intrusion detection models. CVIS takes the opposing design position — that for compound-fault reasoning, centralised access to full telemetry history and a general-purpose LLM is worth the bandwidth cost — and demonstrates it with a working implementation.

### C. Protocol Standards and Cryptographic Foundations

CVIS's design relies directly on the REST architectural style as formalised in [1], the MQTT v5.0 specification [2], the NIST recommendation for AES-GCM [8], the IETF HMAC standard [9], and the WebSocket protocol [12]. Rather than citing these as background, CVIS implements them — the firmware computes HMAC-SHA256 using BearSSL against the IETF specification, the backend AES-256-GCM implementation uses NIST SP 800-38D's recommended 96-bit random nonce, and the WebSocket fan-out follows the RFC 6455 upgrade handshake.

Sedjelmaci et al. [10] examine the convergence of zero-trust architecture and AI for 6G security, arguing that no device or packet should be implicitly trusted regardless of network position. CVIS operationalises this principle at the application layer — every packet, from every device, on every request, is authenticated and integrity-verified regardless of source IP or transport.

---

## III. System Architecture

### A. Overview

CVIS implements a three-tier architecture that mirrors the cloud-edge-client hierarchy increasingly discussed in the IoV literature [6], but with a deliberate inversion: instead of pushing intelligence to the edge, CVIS keeps all reasoning in the cloud tier (the backend server) and treats the vehicle node as a thin, dumb transmitter.

```
ESP8266 Vehicle Node
  ├─ 8 vehicle modes (physics-simulated telemetry)
  ├─ BearSSL HMAC-SHA256 on every payload
  ├─ AES-256-GCM optional encryption (backend-side for ESP8266)
  └─ HTTP POST or MQTT publish (runtime-switchable)
          │
          ▼ (Cloudflare Zero Trust Tunnel for live deployment)
FastAPI Backend — "the cloud data centre"
  ├─ ChaosMiddleware (ASGI, intercepts pre-route)
  ├─ Auth layer (API key → SHA-256 hash lookup)
  ├─ HMAC-SHA256 verify (constant-time)
  ├─ AES-256-GCM decrypt (if encrypted)
  ├─ SQLite persistence (WAL mode)
  ├─ WebSocket fan-out (all connected clients)
  └─ Ollama AI (fire-and-forget, asyncio.create_task)
          │
          ▼
Unified Next.js Frontend (three role-gated views)
  ├─ /driver     — vehicle health, AI recommendations, chat
  ├─ /noc        — live packet flow, security controls
  └─ /admin      — system stats, auth logs, device registry
```

### B. Vehicle Node — ESP8266 Firmware

The vehicle node is simulated by an ESP8266 microcontroller running Arduino-framework firmware. The firmware implements eight distinct vehicle modes — Healthy, Eco, Sport, Heavy Traffic, Low Battery, Battery Overheating, Charging, and Motor Fault — each with a distinct target speed, battery drain profile, motor and battery thermal signature, and fault code state.

Critically, the firmware does not generate random telemetry values for each mode. Instead, it implements a **stateful physics engine** that tracks state variables (speed, battery percentage, motor temperature, battery temperature) across loop cycles and computes a delta time `dt` per cycle. Mode changes update a target speed and efficiency profile, and the physics engine applies continuous aerodynamic battery drain, thermal drift toward equilibrium temperatures, and inertia-limited speed ramping per cycle. The estimated range is computed by multiplying the current battery percentage by the active mode's efficiency factor. This design ensures that when, for example, the vehicle transitions from Healthy to Battery Overheating mode, the motor temperature rises gradually over multiple readings rather than jumping discontinuously — providing realistic time-series data for the AI reasoning layer.

A single push button (GPIO interrupt, hardware-debounced) cycles through all eight modes, allowing live mode switching during demonstrations.

### C. Communication Layer

Two protocol adapters sit behind a common ingest interface:

**HttpAdapter** — The firmware calls `HTTP POST /api/v1/telemetry` every two seconds. The request carries three HTTP headers: `X-API-Key` (the 64-character device API key), `X-HMAC-Signature` (the HMAC-SHA256 of the JSON body), and `Content-Type: application/json`. The request-response model provides synchronous per-packet acknowledgement. The ESP8266 implements exponential backoff retry on non-2xx responses, capped at four retries with 500ms initial delay doubling each attempt.

**MqttAdapter** — A paho-mqtt subscriber running as an asyncio-bridged background thread on the backend, subscribing to `cvis/telemetry/+`. The MQTT envelope carries auth metadata in a `_meta` field that the adapter strips before forwarding to the shared ingest function. Both QoS 0 and QoS 1 are supported; the firmware polls `/api/v1/config/protocol` every 30 seconds and switches adapters on the next transmit cycle if the backend has been switched via the NOC.

The key design decision — and the aspect not replicated in existing prototypes [5][13] — is that both adapters call the same `ingest_telemetry_data()` function in `services/telemetry_service.py`, which performs identical authentication, integrity verification, decryption, validation, persistence, WebSocket broadcast, and AI dispatch regardless of which transport delivered the packet.

### D. Live Deployment

In addition to local execution, the system is deployed on a Debian home server via Cloudflare Zero Trust Tunnel. The ESP8266 sends plaintext HTTP to the publicly routable hostname `api-cvis.justinsaju.me`; Cloudflare's edge provides TLS termination and proxies the request through the outbound tunnel to the backend on port 8005. This architecture solves the ISP CGNAT problem (no open ports, no port forwarding required) and provides a live, remote-accessible demo environment.

---

## IV. Security Implementation

### A. Device Registration and API Key Authentication

Before a vehicle node can transmit telemetry, it must register via `POST /api/v1/devices/register`. The backend generates a 64-character (32-byte) random API key using Python's `secrets.token_hex(32)` — a cryptographically secure source — and a 64-character device secret. The API key's SHA-256 hash is stored in the `devices` table; the plaintext is returned once at registration and never stored again. On every subsequent request, the device sends the plaintext API key in `X-API-Key`; the backend computes `SHA-256(api_key)` and looks it up by hash.

This hash-storage pattern follows the same principle as password storage: the database breach leaks the hash, not the plaintext credential, and the SHA-256 preimage resistance prevents recovery.

The auth toggle allows the NOC to disable authentication entirely for demonstration — packets are still accepted and logged, but with auth status `no_auth` in the `auth_logs` table. Re-enabling auth causes subsequent unauthenticated packets to return 401 immediately.

### B. Payload Integrity — HMAC-SHA256

Payload integrity is enforced using HMAC-SHA256 as specified in RFC 2104 [9]. The device secret serves as the HMAC key. On the firmware side, BearSSL's `br_hmac_context` computes the HMAC over the canonical JSON string. The resulting 64-character hex digest is transmitted in the `X-HMAC-Signature` header.

On the backend, `crypto.py` recomputes the HMAC using Python's `hmac.new()` over the received body bytes and compares with `hmac.compare_digest()` — a constant-time comparison that prevents timing oracle attacks [5]. Any modification to the payload body — including modifications made by the chaos middleware — invalidates the signature and produces a 401 response logged as `tamper_detected`.

The choice of HMAC-SHA256 over HMAC-MD5 follows NIST guidance: MD5 is cryptographically broken and unsuitable for new applications. The choice of HMAC over a digital signature scheme (e.g., ECDSA) reflects the resource constraints of the ESP8266: symmetric MAC operations require no public-key infrastructure, no certificate management, and complete in under 1 ms on the backend.

### C. Optional Confidentiality — AES-256-GCM

When encryption is enabled, the backend generates an AES-256-GCM ciphertext using a fresh 96-bit random nonce per packet (`os.urandom(12)` — the NIST SP 800-38D [8] recommended size for random IV with GCM). The ciphertext envelope is:

```json
{
  "encrypted": true,
  "iv": "<24-char hex nonce>",
  "ct": "<hex ciphertext>",
  "tag": "<32-char hex GCM authentication tag>"
}
```

The GCM authentication tag provides authenticated encryption — the backend's `AESGCM.decrypt()` raises `InvalidTag` if either the ciphertext or the tag has been modified, which is logged as a tamper event and results in a 401 response.

The MAC-then-Encrypt ordering used — HMAC is computed over the plaintext before encryption — is acknowledged as technically redundant given AES-GCM's own authentication, but provides an additional application-level integrity layer and is maintained for pedagogical clarity in demonstrating two distinct security mechanisms.

One hardware limitation deserves honest acknowledgement: the ESP8266 does not have the mbedTLS AES-GCM primitives available without significant memory overhead, so the firmware falls back to HMAC-only (plaintext) mode for ESP8266 hardware. AES-GCM is fully functional on the backend side and is fully demonstrable through the Python simulator (`simulate_vehicle.py`), which implements both encryption modes.

### D. Replay Protection Without Wall-Clock Synchronisation

Replay attacks — capturing a valid, signed packet and retransmitting it later — are a well-documented threat in IoV security [13]. The standard mitigation is a sliding timestamp window: the backend rejects packets whose timestamp falls outside a ±T-second window from the current UTC time.

This approach requires the device to maintain accurate wall-clock time, which typically means NTP synchronisation. The ESP8266, having no hardware real-time clock, would require NTP at every boot — adding complexity and a network dependency before the first telemetry packet is sent.

CVIS uses an alternative: the Arduino `millis()` function returns a monotonic millisecond counter since boot, which is included in every payload as `timestamp_ms`. The backend maintains an in-memory `OrderedDict` of `(device_id, timestamp_ms)` pairs seen within the last 30 seconds (evicted at 60 seconds). Any packet with a `(device_id, timestamp_ms)` pair already in the set is rejected as a replay.

The residual risk — that an attacker could capture a packet, wait for the device to reboot (resetting `millis()` to 0), and replay the packet with a matching timestamp — is mitigated by two constraints: (1) device re-registration is required after every reboot, which changes the API key and device secret; and (2) the 60-second eviction window makes a same-boot replay only possible within one minute of the original transmission. This is an acceptable residual risk for an academic prototype and an interesting unexplored design point in the broader literature.

### E. Security Audit Log

Every auth event — successful authentication, HMAC failure, AES-GCM tag failure, replay rejection, missing API key, auth-disabled pass — is written to the `auth_logs` table with timestamp, device ID, event type, and source. These logs are surfaced in the `/admin` view and can be queried via `GET /api/v1/admin/auth-logs`.

---

## V. Chaos Simulation Middleware

### A. Design Rationale

Most published vehicular network security demonstrations require external tooling — ns-3 for simulation, tc/netem for real network-layer packet shaping, or physical multi-device testbeds. This is a significant barrier for academic prototypes and course demonstrations. CVIS's ChaosMiddleware provides the same pedagogical coverage through a pure Python ASGI wrapper applied at the application layer, requiring no external tools, no elevated privileges, and no additional hardware.

The middleware wraps the FastAPI application as a raw ASGI callable, intercepting every `POST /api/v1/telemetry` request before FastAPI's body caching occurs. This is an important implementation detail: using `BaseHTTPMiddleware` (FastAPI's standard middleware interface) would have read and cached the body before the middleware could modify it, making tamper injection impossible. Raw ASGI interception is the only reliable mechanism for body-level modification before route handler execution.

### B. Three Chaos Modes

**Packet Loss** — On each intercepted request, the middleware samples `random.randint(1, 100)` and compares it to the configured loss percentage (0, 5, 10, or 25%). If the sample falls within the loss band, the middleware returns an HTTP 503 response without invoking the route handler. The ESP8266 retry logic then triggers, demonstrating exponential backoff behaviour in the NOC packet table.

**Artificial Latency** — Before passing the request to the route handler, the middleware calls `asyncio.sleep(latency_ms / 1000.0)`. Because this is an `await` call in an async context, it yields the event loop — other concurrent requests are not blocked. The configured latency (0, 100, 300, or 1000ms) appears directly in the NOC packet table's RTT column.

**Payload Tampering** — The middleware parses the JSON body and mutates a numeric field (`battery_pct` → 999.9, `speed_kmh` → -1.0, etc.), then re-serialises it and passes the modified body to the route handler via a patched `receive()` coroutine. The HMAC signature in `X-HMAC-Signature` still covers the original body, so the HMAC verification step detects the mismatch and returns 401 with `tamper_detected` logged. This is exactly how a man-in-the-middle attack on the payload would appear — the only difference is that the mutator is the middleware rather than a network adversary.

All three chaos modes are configurable at runtime from the NOC frontend via `POST /api/v1/config/chaos` — no server restart required. Settings are persisted to SQLite so they survive backend restarts.

### C. Metrics

The chaos middleware maintains live counters: total requests intercepted, dropped packets, tampered packets, and total latency-ms added. These counters are exposed via `GET /api/v1/admin/chaos-stats` and displayed in real time on the `/admin` view.

---

## VI. AI Integration

### A. Architecture

The AI layer uses Ollama running `llama3.2:3b`, a 3-billion-parameter language model chosen for its favourable inference latency on CPU hardware (8–15 seconds for a full recommendation on a consumer-grade Intel i5) while still producing coherent, multi-sentence reasoning. The model is invoked via Ollama's `/api/chat` HTTP endpoint from an async httpx client with a 20-second timeout and graceful degradation on connection failure.

Critically, AI inference is dispatched as a fire-and-forget `asyncio.create_task()` after the telemetry HTTP 200 response has already been sent. This architectural decision ensures that the secure communication layer's round-trip time (4–8 ms median) is completely independent of AI availability or inference latency. If Ollama is not running, the vehicle dashboard continues to display live telemetry; AI recommendations simply do not appear.

### B. Physics-Contextualised Prompting

A key limitation of naive LLM application to telemetry [14] is feeding raw numbers without context. CVIS's `prompt_builder.py` constructs a structured prompt in two parts — a static system persona message (establishing the AI's role as a cloud-based vehicle intelligence advisor) and a dynamic user message containing:

- **Current snapshot** — all eight telemetry fields (mode, speed, battery percentage, battery temperature, motor temperature, estimated range, fault code, charging rate)
- **Advanced physics fields** — ambient temperature, headwind speed, road gradient, tyre pressure, cabin climate load, maximum cell voltage delta (when available)
- **Range violations** — per-mode normal operating ranges for motor temperature, battery temperature, and battery percentage; any field outside its range is annotated with the percentage of exceedance
- **Trend block** — the last N historical readings rendered as an arrow-delimited series (e.g., `Battery: 78.3% → 74.1% → 70.2% (-8.1 total, falling ⚠ RAPID DRAIN)`) with a directional annotation
- **Mode transition event** — if the current mode differs from the immediately preceding reading, a prominent `⚡ MODE TRANSITION: Healthy → Battery Overheating` line is injected at the top of the user message

The model is required to output a structured response beginning with `SEVERITY: <NORMAL|CAUTION|WARNING|CRITICAL>` followed by 3–5 sentences of actionable analysis. This format is parsed by the backend and broadcast with severity metadata to the frontend.

This approach is fundamentally different from the threshold-based alerting that plagues simpler implementations — the LLM is reasoning over the combined state, not checking individual fields against hardcoded limits.

### C. Driver Chat

A second AI surface allows drivers to submit free-text queries grounded in current and recent telemetry via `POST /api/v1/ai/chat`. The same prompt builder injects the current vehicle state and trend context before the driver's question, ensuring the model's conversational responses are anchored in real data rather than general vehicle knowledge. This demonstrates the practical value of centralised AI [11] — the model's response to "should I keep driving?" draws on the actual present battery state, not a generic answer.

---

## VII. Protocol Analysis — HTTP REST vs. MQTT

A key educational contribution of CVIS is the side-by-side demonstration of two fundamentally different communication paradigms operating on the same security infrastructure.

| Dimension | HTTP REST | MQTT |
|---|---|---|
| Model | Request-response | Publish-subscribe |
| Connection | Per-request (TCP) | Persistent to broker |
| Acknowledgement | Synchronous (200 OK) | QoS-level (0/1/2) |
| Scalability | N vehicles → N connections | N vehicles → 1 broker |
| Overhead per packet | HTTP headers (~200–400 B) | MQTT fixed header (2 B min) |
| Best fit | Low-frequency, guaranteed delivery | High-frequency, many devices |
| Auth mechanism in CVIS | `X-API-Key` + `X-HMAC-Signature` headers | `_meta.api_key` + `_meta.hmac` envelope fields |
| CVIS implementation | `comms/http_adapter.py` (implicit, FastAPI router) | `comms/mqtt_adapter.py` (paho-mqtt + asyncio bridge) |

The MQTT adapter bridges paho-mqtt's threaded callback model into FastAPI's asyncio event loop using `loop.call_soon_threadsafe()`. Incoming MQTT messages strip the `_meta` auth envelope and call `ingest_telemetry_data()` — the same function the HTTP route handler calls. The result is that switching from HTTP to MQTT in the NOC does not change a single line of backend security logic.

This unified ingest design is the concrete demonstration of transport-agnostic security: the cryptographic guarantees do not depend on which protocol delivered the packet.

---

## VIII. Frontend Architecture

### A. Design Decisions

The CVIS frontend is a single Next.js application with three role-gated views rather than three separate applications. This consolidation was a deliberate scope-reduction decision: three apps would triple the WebSocket connection management code, triple the component library, and triple the routing logic for no pedagogical gain. Role-based routing via a simple role flag (passed as a URL path segment, e.g., `/driver/alpha`) is sufficient for an academic prototype.

All three views share a single `useWebSocket` hook with exponential-backoff reconnection (1s initial, doubling, capped at 30s) and a shared component library built around glassmorphism cards and Framer Motion micro-animations.

### B. Driver Dashboard (`/driver`)

The driver dashboard receives real-time telemetry via the shared WebSocket and renders a battery charge arc (SVG-based, animated on every update), telemetry cards for all eight fields, 60-point rolling history graphs (Recharts), an AI recommendation panel with typewriter animation, an alert feed, and a free-text chat interface. On initial WebSocket connection, the backend sends a `backfill` event containing the last 10 historical rows, pre-populating the charts before the first live packet arrives.

### C. Network Operations Centre (`/noc`)

The NOC is the centrepiece of the frontend and the primary demonstration surface for the secure communication layer. It provides:

- **Live animated packet flow** — SVG-based source-to-destination animation, coloured by protocol (HTTP: blue, MQTT: green) and status (success: solid, rejected: red pulse)
- **Packet table** — paginated, showing packet number, source, destination, timestamp, protocol, size, RTT, latency, retry count, encryption status, and auth status
- **Click-to-expand packet inspector** — full packet detail view including raw JSON payload, HMAC signature, IV/ciphertext/tag (if encrypted), AI response, and backend processing metadata
- **Eight live controls**, each wired to a real backend state change:
  1. Protocol switch (HTTP ↔ MQTT) — calls `POST /api/v1/config/protocol`
  2. Encryption toggle — calls `POST /api/v1/config/encryption`
  3. Auth toggle — calls `POST /api/v1/config/auth`; subsequent packets immediately reflect the change
  4. Packet loss slider (0/5/10/25%) — calls `POST /api/v1/config/chaos`
  5. Latency slider (0/100/300/1000ms) — calls `POST /api/v1/config/chaos`
  6. Tamper injector — enables chaos middleware payload mutation
  7. Disconnect vehicle — calls `POST /api/v1/control/disconnect/{device_id}`
  8. Stop AI service — calls `POST /api/v1/control/ai/{device_id}`

None of these controls are cosmetic. Every toggle causes a verifiable change in backend behaviour visible in the packet table within the next telemetry cycle.

### D. Admin Console (`/admin`)

The admin console aggregates backend health metrics: server uptime, live CPU and memory usage (via psutil), packet counts by protocol, auth event log (filterable by event type), device registry with registration timestamps, AI service status, error log, and chaos middleware statistics. All data is served from dedicated admin endpoints and updated on a 5-second polling interval.

---

## IX. Testing and Evaluation

### A. Automated Test Suite

CVIS includes four automated Python test scripts totalling 93 passing tests:

| Script | Scope | Tests | Result |
|---|---|---|---|
| `test_phase1.py` | Core ingest pipeline, DB persistence, WebSocket backfill | 20 | 20/20 |
| `test_phase2.py` | Auth, HMAC, AES-GCM, chaos middleware, device registration | 28 | 28/28 |
| `test_phase3.py` | AI endpoints (graceful skip if Ollama unavailable) | 8 | 8/8 or skip |
| `test_phase6.py` | 8 modes × HTTP × chaos settings × tamper matrix | 45 | 45/45 |

### B. Key Security Verification Results

Each of the following was tested and passed:

| Test Case | Expected Result | Observed |
|---|---|---|
| Valid packet, correct HMAC | 200 OK | ✓ |
| Valid packet, forged HMAC | 401 + `tamper_detected` logged | ✓ |
| Chaos tamper active → HMAC fail | 401 + `tamper_detected` logged | ✓ |
| AES-GCM encrypted packet, correct key | 200 OK, plaintext parsed correctly | ✓ |
| AES-GCM packet with modified ciphertext | 401 + `tamper_detected` logged | ✓ |
| Replay of captured `(device_id, timestamp_ms)` | 401 + `tamper_detected` logged | ✓ |
| Missing `X-API-Key` header | 401 + `missing_api_key` logged | ✓ |
| Auth disabled → any packet | 200 OK, `no_auth` logged | ✓ |
| Packet loss 25% | ~25% of requests return 503 (probabilistic) | ✓ |
| Latency 300ms | Measured RTT ≥ 300ms for all packets | ✓ |

### C. Mode Coverage

`test_phase6.py` sends one telemetry packet per vehicle mode (all 8) under normal conditions, then repeats with chaos tamper enabled, verifying that the HMAC detection pathway fires correctly regardless of mode-specific telemetry values. All 45 tests passed, confirming that mode-specific field values (e.g., Battery Overheating's elevated `battery_temp_c`) do not produce false positives or false negatives in the HMAC pipeline.

---

## X. Performance Analysis

### A. Telemetry Ingest Latency

Measurements taken on the Debian home server (Intel Core i5, 8 GB RAM) running a single uvicorn worker under PM2:

| Condition | p50 | p95 | p99 |
|---|---|---|---|
| HTTP, no encryption, no chaos | 4–8 ms | 12–18 ms | 22–30 ms |
| HTTP, AES-256-GCM encryption | 6–10 ms | 15–22 ms | — |
| HTTP, 1000ms artificial latency | ~1002 ms | ~1008 ms | — |

The dominant latency contributors under normal conditions are SQLite INSERT (WAL mode, 2–5 ms) and HMAC computation (~0.5–1 ms). WebSocket fan-out to four concurrent clients adds under 1 ms.

### B. AI Inference

Ollama `llama3.2:3b` running on CPU without GPU acceleration:

| Prompt size | First token latency | Full recommendation |
|---|---|---|
| ~150 tokens (short telemetry) | 2–4 s | 8–15 s |
| Cold model load | 5–10 s | 15–25 s |

Because AI inference is fire-and-forget, these latencies have zero impact on telemetry ingest round-trip time. The vehicle node receives its 200 OK in under 10 ms regardless of AI load, and the AI recommendation arrives asynchronously via WebSocket when ready.

### C. Concurrent Load

Five simultaneous HTTP POST requests using Python threading: all 5 succeeded, all 5 rows appeared in the database, all 5 WebSocket fan-out events were delivered, and maximum observed latency under contention was 18 ms. SQLite's WAL mode permits concurrent reads during writes, avoiding contention between the packet ingest path and the NOC's packet table polling.

### D. Scalability Observations

The current architecture is bounded by SQLite's single-writer constraint and Python's GIL. A production deployment would replace SQLite with PostgreSQL, use Gunicorn with multiple uvicorn workers for CPU parallelism, GPU-accelerate Ollama for sub-second AI inference, and use Redis pub/sub for horizontal WebSocket scaling. These are standard production concerns and do not affect the academic validity of the demonstrated security mechanisms.

---

## XI. CCNS Syllabus Mapping

CVIS was designed explicitly to demonstrate all five units of the Computer Communication and Network Security course syllabus through working implementations. The following table provides the mapping:

| CCNS Unit | Topics Demonstrated | CVIS Feature |
|---|---|---|
| **Unit 1 — Data Communication** | JSON schema, schema versioning (`v` field), adaptive telemetry intervals, byte-efficient MQTT encoding | Telemetry payload schema; adaptive interval firmware loop |
| **Unit 2 — Network Models & Protocols** | OSI layer separation, HTTP request-response vs. MQTT pub-sub, WebSocket protocol upgrade (RFC 6455 [12]) | Dual-protocol adapters; WebSocket fan-out |
| **Unit 3 — Transport Layer** | TCP reliability, application-layer retry with backoff, probabilistic packet loss, queuing latency, QoS levels | ESP8266 retry logic; chaos middleware loss and latency |
| **Unit 4 — Network Security** | HMAC-SHA256 (RFC 2104 [9]), AES-256-GCM (NIST SP 800-38D [8]), timing attack prevention, replay attack prevention, device revocation, comprehensive audit logging | `crypto.py`, `auth.py`, `replay_protection.py`, `db.py` `auth_logs` table |
| **Unit 5 — Advanced Topics** | Centralised AI thesis, multi-factor LLM reasoning over telemetry [11], async decoupling, graceful degradation, real-time IoT dashboard | AI layer; prompt builder; driver dashboard; NOC |

Full per-feature mapping: `docs/04-academic-materials/04-ccns-mapping.md`.

---

## XII. Discussion

### A. Centralised vs. Edge AI — The Case Revisited

The dominant literature position favours federated learning and edge AI [6][7] for good reasons: lower latency, privacy preservation, and bandwidth efficiency. But these advantages come at a cost in reasoning quality that the literature rarely quantifies. A federated model at the roadside unit has access to a partitioned dataset and a shallow model. CVIS's centralised LLM has access to the full telemetry history, mode transition context, and the reasoning capacity of a 3-billion-parameter model.

The practical result is qualitatively apparent in testing: the LLM consistently produces mode-specific, trend-aware recommendations (e.g., "Battery temperature is rising at 2.3°C per reading and you're still in Sport mode — switching to Eco immediately would reduce the thermal load by approximately 40%") that a threshold-based or federated edge model would replace with a generic alert ("Battery temperature high"). Whether this quality gap justifies the centralised architecture is a design decision that depends on the use case — but the gap exists, and CVIS makes it visible.

### B. Limitations

The system has four acknowledged limitations that are acceptable for an academic prototype:

1. **TLS on the local segment** — The ESP8266 sends plain HTTP on the local network; Cloudflare's edge provides TLS for the internet-facing leg. Full end-to-end TLS would require a certificate on the ESP8266 and significant memory overhead.
2. **No backend admin authentication** — The NOC and admin endpoints are not behind a login gate. This is acceptable for an isolated demonstration environment.
3. **In-memory replay cache** — The replay set is lost on server restart. Redis would provide persistence.
4. **Single-node deployment** — The current setup is a proof-of-concept on a single home server. The scalability path is clear but not implemented.

---

## XIII. Conclusion

CVIS demonstrates that a complete, working secure vehicle-to-cloud communication stack — encompassing device authentication, HMAC-SHA256 payload integrity, AES-256-GCM optional encryption, timestamp-based replay protection, runtime protocol switching, and AI-grounded telemetry analysis — can be built and verified at the scale of a single developer machine with freely available open-source tools.

The system is not a simulation of security. Every HMAC verification, AES-GCM decryption, replay detection, and tamper rejection in the automated test results is executed by the running backend on real bytes. The chaos middleware provides live, reproducible demonstrations of the security layer working correctly under adversarial conditions. The AI layer demonstrates that centralised LLM reasoning over physics-contextualised telemetry snapshots produces qualitatively richer insights than edge-constrained alternatives.

The six research gaps identified in the introduction — runtime protocol switching with unified security, centralised LLM as a deliberate design choice, application-layer chaos for security education, physics-contextualised LLM prompting, replay protection without wall-clock time, and unified multi-role NOC frontend — are all concretely addressed by working code in this system.

Future work should evaluate the quality differential between CVIS's centralised LLM recommendations and a federated edge model across all eight vehicle modes, quantify the replay protection gap under reboot scenarios, and explore post-quantum key exchange [10] for the device registration flow as a replacement for the current pre-shared secret model.

---

## References

[1] R. T. Fielding, "Architectural Styles and the Design of Network-based Software Architectures," Ph.D. dissertation, University of California, Irvine, 2000. [Online]. Available: https://ics.uci.edu/~fielding/pubs/dissertation/fielding_dissertation.pdf

[2] OASIS MQTT Technical Committee, "MQTT Version 5.0," OASIS Standard, March 2019. [Online]. Available: https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.pdf

[3] S. Baccari, M. Hadded, H. Ghazzai, H. Touati, and M. Elhadef, "Anomaly Detection in Connected and Autonomous Vehicles: A Survey, Analysis, and Research Challenges," *IEEE Access*, vol. 12, pp. 19250–19276, 2024. doi: 10.1109/ACCESS.2024.3361829. [Online]. Available: https://doi.org/10.1109/ACCESS.2024.3361829

> **Audit note:** Third author corrected to "H. Ghazzai" (Hakim Ghazzai). Earlier versions of this document incorrectly listed "Hatem Ghazzai".

[4] S. U. A. Laghari, W. Li, S. Manickam, P. Nanda, A. K. Al-Ani, and S. Karuppayah, "Securing MQTT Ecosystem: Exploring Vulnerabilities, Mitigations, and Future Trajectories," *IEEE Access*, vol. 12, pp. 139273–139289, June 2024. doi: 10.1109/ACCESS.2024.3412030. [Online]. Available: https://doi.org/10.1109/ACCESS.2024.3412030

> **Audit note:** Lead author corrected to S. U. A. Laghari et al. Earlier versions listed "M. Arafat et al." which did not match the verified record.

[5] Y. Ma, X. Li, W. Shi, and Q. Cheng, "STCLA: An Efficient Certificateless Authenticated Key Agreement Scheme for the Internet of Vehicles," *IEEE Transactions on Vehicular Technology*, vol. 73, no. 4, pp. 4830–4841, April 2024. doi: 10.1109/TVT.2023.3334034. [Online]. Available: https://doi.org/10.1109/TVT.2023.3334034

[6] S. A. A. Hakeem and H. Kim, "Advancing Intrusion Detection in V2X Networks: A Comprehensive Survey on Machine Learning, Federated Learning, and Edge AI for V2X Security," *IEEE Transactions on Intelligent Transportation Systems*, vol. 26, no. 8, pp. 11137–11205, 2025. doi: 10.1109/TITS.2025.3558849. [Online]. Available: https://doi.org/10.1109/TITS.2025.3558849

> **Audit note:** DOI corrected from 10.1109/TITS.2025.3525698 (unverified) to 10.1109/TITS.2025.3558849 (verified via Crossref). Volume, issue, and page numbers added.

[7] M. H. Bhavsar, Y. B. Bekele, K. Roy, J. C. Kelly, and D. Limbrick, "FL-IDS: Federated Learning-Based Intrusion Detection System Using Edge Devices for Transportation IoT," *IEEE Access*, vol. 12, pp. 52215–52226, 2024. doi: 10.1109/ACCESS.2024.3386631. [Online]. Available: https://doi.org/10.1109/ACCESS.2024.3386631

> **Audit note:** DOI corrected from 10.1109/ACCESS.2024.3359367 (unverified) to 10.1109/ACCESS.2024.3386631 (verified via Crossref). Full author list and page numbers added.

[8] National Institute of Standards and Technology, "Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) and GMAC," NIST Special Publication 800-38D, November 2007. [Online]. Available: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf

[9] H. Krawczyk, M. Bellare, and R. Canetti, "HMAC: Keyed-Hashing for Message Authentication," RFC 2104, IETF, February 1997. [Online]. Available: https://www.rfc-editor.org/rfc/rfc2104

[10] H. Sedjelmaci, K. Tourki, and N. Ansari, "Enabling 6G Security: The Synergy of Zero Trust Architecture and Artificial Intelligence," *IEEE Network*, vol. 38, no. 3, pp. 171–177, Oct. 2023. doi: 10.1109/MNET.2023.3321992. [Online]. Available: https://doi.org/10.1109/MNET.2023.3321992

> **Audit note:** Full author names expanded (H. Sedjelmaci, K. Tourki, N. Ansari). Volume, issue, and page numbers added. Year confirmed as 2023.

[11] Meta AI Research, "The Llama 3 Herd of Models," arXiv preprint arXiv:2407.21783, 2024. [Online]. Available: https://arxiv.org/abs/2407.21783

[12] I. Fette and A. Melnikov, "The WebSocket Protocol," RFC 6455, IETF, December 2011. [Online]. Available: https://www.rfc-editor.org/rfc/rfc6455

[13] **UNVERIFIED — REQUIRES SOURCE CONFIRMATION.** The cited paper "A Timed Efficient Stream Loss-Tolerant Authentication Protocol for IoV Cybersecurity" by R. Alshehri et al. with DOI 10.1109/ACCESS.2023.3305289 could not be verified. DOI resolution returned HTTP 404 (resource not found). The DOI does not resolve on Crossref or IEEE Xplore. This reference must be confirmed and corrected before final submission. The concept of NTP-based timestamp replay protection in IoV is cited in this document in relation to this reference; until verified, that citation must be treated as uncorroborated.

[14] G. Moramarco et al., "Evaluating Large Language Models for Time Series Anomaly Detection in Aerospace Software," in *Proc. 40th IEEE/ACM International Conference on Automated Software Engineering (ASE)*, 2025. arXiv preprint arXiv:2601.12448. [Online]. Available: https://arxiv.org/abs/2601.12448

> **Audit note:** arXiv ID corrected from 2501.18050 (which resolves to an unrelated soccer game-theory paper by Pramanik) to 2601.12448 (verified: Moramarco et al., LLM time-series anomaly detection in aerospace, ASE 2025). Full title corrected to include "in Aerospace Software".

---

## Reference Audit Summary

| Ref | Status | Correction Made |
|-----|--------|-----------------|
| [1] | ✅ Verified | No change required |
| [2] | ✅ Verified | No change required |
| [3] | ✅ Verified (minor fix) | Third author corrected: "Hakim Ghazzai" (not "Hatem") |
| [4] | ✅ Verified (author fix) | Lead author corrected: "S. U. A. Laghari et al." (not "M. Arafat et al.") |
| [5] | ✅ Verified | No change required |
| [6] | ❌ Wrong DOI | Corrected DOI: `10.1109/TITS.2025.3558849`; added vol. 26, no. 8, pp. 11137–11205 |
| [7] | ❌ Wrong DOI | Corrected DOI: `10.1109/ACCESS.2024.3386631`; added full author list and pp. 52215–52226 |
| [8] | ✅ Verified | No change required |
| [9] | ✅ Verified | No change required |
| [10] | ✅ Verified (details added) | Full authors (Sedjelmaci, Tourki, Ansari); vol. 38, no. 3, pp. 171–177 added |
| [11] | ✅ Verified | arXiv:2407.21783 confirmed correct |
| [12] | ✅ Verified | No change required |
| [13] | ❌ UNVERIFIED | DOI `10.1109/ACCESS.2023.3305289` returns HTTP 404. Cannot confirm paper exists. Marked UNVERIFIED. |
| [14] | ❌ Wrong arXiv ID | Corrected from `arXiv:2501.18050` (soccer game theory paper) to `arXiv:2601.12448` (Moramarco et al., LLM aerospace TSAD, ASE 2025) |

**Overclaimed literature statements softened:** Gap 1–6 statements in §I.A reworded from absolute universal claims to "within the sources reviewed for this project" formulations. Related-work section [3][4][14] attributions rewritten as interpretations rather than claims about what the papers themselves identify as gaps.
