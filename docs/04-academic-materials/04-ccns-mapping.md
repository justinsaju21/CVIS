# CVIS — CCNS Unit Mapping Table
<!-- Updated after every phase. Maps every implemented feature to a specific CCNS (Computer Communication & Network Security) syllabus learning outcome. -->

---

## Unit 1 — Data Communication & Computer Networks

| Feature | Topic | How It Demonstrates the Concept |
|---|---|---|
| JSON telemetry payload schema | Data encoding, structured messages | Fixed schema with typed fields, version field, fault codes — protocol design at the application-data level |
| Pydantic validation at ingest | Data integrity, schema enforcement | Out-of-range or malformed packets rejected at API boundary before persistence — application-layer filtering |
| Adaptive telemetry intervals | Bandwidth optimisation, priority-based comms | Fault/overheat → 1s interval; normal → 5–8s. Shows how protocol design can encode priority without separate QoS channels |
| Schema versioning (`schema_version`) | Protocol evolution, backward compatibility | Version field allows the backend to handle future payload formats without breaking existing clients |
| Runtime protocol switch (HTTP ⇄ MQTT) | Protocol agnosticism, adapter pattern | Both protocols use the same ingest pipeline — demonstrates how a layered architecture decouples transport from application |

---

## Unit 2 — Network Models & Protocols

| Feature | Topic | How It Demonstrates the Concept |
|---|---|---|
| WiFi → IP → TCP → HTTP stack | OSI / TCP-IP model, layered architecture | Each layer is distinct: WiFi (Physical+Data Link), IP (Network), TCP (Transport), HTTP (Application) |
| MQTT adapter (publish-subscribe) | Message broker protocol, topic routing | `cvis/telemetry/{device_id}` topic hierarchy; broker fan-out; decoupled publisher/subscriber — contrast with HTTP request-response |
| HTTP REST vs MQTT comparison | Protocol selection rationale | REST = pull/request-response, good for low-frequency reliable delivery. MQTT = push/event-driven, efficient for many IoT devices. NOC can switch live |
| WebSocket protocol upgrade | Bidirectional persistent connection, HTTP upgrade | `101 Switching Protocols` from HTTP to WebSocket on the same TCP connection — demonstrates layer-3 reuse |
| MQTT control topics (`cvis/config/+`) | Command & control messaging, pub-sub patterns | Backend publishes config changes to control topics; vehicles subscribe and reconfigure without polling |
| Packet metadata (size, RTT, timestamp) | Network measurement, traffic analysis | Every packet logged with direction, protocol, size, and latency — enables NOC analytics and performance benchmarking |

---

## Unit 3 — Transport Layer & Reliability

| Feature | Topic | How It Demonstrates the Concept |
|---|---|---|
| HTTP over TCP (reliable transport) | Reliable delivery, connection-oriented | HTTP guarantees delivery via TCP — contrasted with MQTT over TCP but with optional QoS levels |
| Retry with exponential backoff | Reliability, congestion avoidance | ESP32 retries 3× with doubling delay on server failure — analogous to TCP retransmission and Karn's algorithm |
| WebSocket persistent connection | Persistent bidirectional channel | Long-lived TCP connection with WebSocket framing — demonstrates how session persistence differs from stateless HTTP |
| Chaos: packet loss simulation | Packet loss, reliability, QoS | 0/5/10/25% probabilistic drop at backend middleware — demonstrates impact of packet loss on application-layer reliability |
| Chaos: artificial latency | Latency, RTT, propagation delay | 0/100/300/1000ms injected before handler — demonstrates how latency degrades responsiveness and changes protocol behaviour |
| Adaptive telemetry rate | QoS, traffic shaping | High-priority modes (fault, overheat) use 1s intervals — mirrors DiffServ / priority queue concepts |
| Ack + retry in firmware | Transport-layer acknowledgement | ESP32 checks HTTP 200/201 as application-level ACK; retries on 500/timeout — application-layer reliability over TCP |

---

## Unit 4 — Network Security

| Feature | CCNS Topic | How It Demonstrates the Concept |
|---|---|---|
| API key per device | Authentication, device identity | 64-byte random key, SHA-256 hashed in DB. Shows asymmetric storage of secrets (never store plaintext) |
| HMAC-SHA256 on every payload | Message Authentication Code (MAC), integrity | `hmac.new(secret, payload, sha256).hexdigest()` — any modification invalidates the signature, detected by constant-time `compare_digest()` |
| AES-256-GCM encryption | Symmetric authenticated encryption, confidentiality | AEAD: single operation provides both confidentiality (AES-CTR) and integrity (GCM tag). IV freshness per packet is enforced |
| Constant-time HMAC verify | Timing oracle attack prevention | `hmac.compare_digest()` prevents attacker from inferring partial matches via response timing |
| Tamper injection + rejection | Man-in-the-middle attack detection | Chaos middleware mutates one byte post-signature → backend detects HMAC mismatch → 401 + `tamper_detected` log |
| Device deactivation (revocation) | Key revocation, access control | `POST /control/disconnect` sets `active=0` — next packet rejected. Demonstrates credential lifecycle management |
| Replay protection | Replay attack prevention, protocol freshness | `(device_id, timestamp_ms)` deduplication in a bounded time window — prevents captured packets from being re-submitted |
| Auth toggle + rejection logging | Access control audit trail | When auth is disabled, packets accepted as `no_auth` and logged — enables forensic analysis of what happened without auth |
| `auth_logs` table | Security audit logging | All auth failures, tamper events, disconnects, re-registrations logged with timestamp and device_id |
| BearSSL on ESP8266 | Hardware-side cryptographic implementation | HMAC-SHA256 implemented using BearSSL bundled with the ESP8266 Arduino core. AES-GCM is stubbed on hardware; fully functional backend-side. |

---

## Unit 5 — Advanced Topics / Intelligent Networking / Cloud Architecture

| Feature | CCNS Topic | How It Demonstrates the Concept |
|---|---|---|
| Centralised AI (Ollama on homeserver) | Cloud vs. edge intelligence, centralised reasoning | AI runs on the Debian homeserver (simulating cloud/data-centre). Vehicle is a thin client — demonstrates the "AI should not be embedded per-vehicle" thesis |
| Multi-factor telemetry prompt | Intelligent network analysis, context-aware reasoning | Ollama receives all 8 telemetry fields simultaneously; prompt is structured to require cross-field reasoning (e.g., high temp + fault code → specific recommendation) |
| Fire-and-forget AI task | Async processing, non-blocking pipeline | `asyncio.create_task()` runs AI inference without blocking the telemetry ingest response — demonstrates async concurrency in networked systems |
| AI service kill-switch | Service degradation, graceful degradation | When AI is stopped, telemetry still flows — demonstrates that the secure comms layer is independent of the AI layer (project thesis) |
| WebSocket fan-out to all views | Event-driven architecture, publish-subscribe at app layer | One WebSocket server pushes to Driver, NOC, and Admin simultaneously — demonstrates event-driven design for real-time networked applications |
| Cross-mode AI coherence | Knowledge-based systems, context-sensitive response | 8 different vehicle modes produce semantically different AI recommendations — not threshold if/else, but language model reasoning over structured data |

---

## Cumulative Summary

| CCNS Unit | Features Implemented | Key Demonstrations |
|---|---|---|
| Unit 1 — Data Communication | 5 | JSON schema, versioning, adaptive intervals, protocol switching |
| Unit 2 — Network Models & Protocols | 6 | OSI layers, HTTP vs MQTT, WebSocket upgrade, pub-sub |
| Unit 3 — Transport Layer | 7 | TCP reliability, retry, packet loss, latency, QoS |
| Unit 4 — Network Security | 10 | HMAC, AES-GCM, replay, tamper detection, revocation, audit logs |
| Unit 5 — Advanced / Cloud | 6 | Centralised AI, multi-factor reasoning, graceful degradation |
| **Total** | **34** | **Covering all 5 CCNS units** |

---

*Last updated: Phases 1–7 complete. Live deployment confirmed at `https://cvis.justinsaju.me`.*
