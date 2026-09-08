# Connected Vehicle Intelligence System (CVIS)
*Presentation Content Guide*

---

## Slide 1: Title Slide
**Title:** Connected Vehicle Intelligence System (CVIS)
**Subtitle:** A Demonstration of Centralised AI and Secure Vehicle Communication
**Images Required:** Project logo or an architecture placeholder graphic.

---

## Slide 2: Abstract
- **Core Concept:** An academic prototype demonstrating secure, protocol-agnostic communication between IoT vehicle nodes and a centralised AI reasoning layer.
- **Key Features:** 
  - HMAC-SHA256 payload authentication
  - AES-256-GCM optional encryption
  - Runtime protocol switching (HTTP REST / MQTT)
  - Replay protection & Chaos simulation middleware
- **AI Integration:** Uses a centralised Ollama language model (llama3.2:3b) to provide multi-factor AI recommendations grounded in vehicle telemetry.
- **Outcome:** Demonstrates all five CCNS course units through working, verifiable implementations.

---

## Slide 3: Introduction
- **The Context:** The proliferation of connected vehicles requires robust architectures for intelligence and security.
- **The Challenge:** Per-vehicle edge AI requires embedding expensive compute hardware in each unit, ties reasoning capability to manufacture dates, and complicates over-the-air updates.
- **The Thesis:** This project argues for a centralised architecture where the vehicle is a thin, securely-networked client and AI runs in a cloud data centre.
- **Focus Area:** The primary focus is the *secure communication layer*?"authenticating, encrypting, and delivering telemetry despite network instability.

---

## Slide 4: Problem Statement
1. **Security Vulnerabilities:** Telemetry data is susceptible to Man-in-the-Middle (MitM) attacks, payload tampering, and replay attacks.
2. **Network Unpredictability:** Vehicles travel through tunnels and remote areas, facing packet loss and high latency.
3. **Compute Constraints:** Running complex AI locally on vehicle edge devices is expensive and difficult to maintain.

---

## Slide 5: Literature Survey
*References based on core protocols and cryptographic standards utilised in the system:*
- **RFC 2104 (1997):** HMAC: Keyed-Hashing for Message Authentication (Krawczyk et al.)
- **NIST SP 800-38D (2007):** Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM).
- **OASIS Standard (2019):** MQTT Version 5.0 (Publish-Subscribe IoT standard).
- **RFC 6455 (2011):** The WebSocket Protocol for real-time bidirectional communication.
- **Llama 3 (2024):** Meta AI Research on Large Language Models.

---

## Slide 6: Objective
- To build a secure, protocol-agnostic communication layer for connected vehicles.
- To implement robust cryptographic security (HMAC-SHA256, AES-256-GCM) that protects against tampering and eavesdropping.
- To demonstrate network resilience through built-in chaos engineering.
- To prove that AI reasoning can be effectively decoupled and centralised in the cloud.

---

## Slide 7: Existing Methods & Research Gap
- **Existing Methods:** Heavy reliance on Edge AI (computing in the car), basic unencrypted HTTP polling, or siloed security mechanisms that are difficult to update.
- **Research Gap:** 
  - Lack of unified platforms demonstrating real-time protocol switching (HTTP to MQTT) without downtime.
  - Insufficient tools for simulating real-world network chaos (latency, packet loss, tampering) on demand to verify system resilience.
  - Absence of a fully decoupled, multi-factor AI reasoning pipeline built over a strictly secured transport layer.

---

## Slide 8: Proposed Methodology
- **3-Tier Architecture:** Vehicle Node (ESP32), Backend (FastAPI), and Frontend (Next.js).
- **Decoupled AI:** Centralised AI via Ollama (llama3.2:3b), triggered on telemetry ingest via fire-and-forget asynchronous tasks.
- **Chaos Engineering:** Custom ASGI Middleware to probabilistically drop, delay, or tamper with packets.
- **Stateful Physics Engine:** Real-time calculation of vehicle inertia, battery drain, and thermal drift instead of pure random data generation.

---

## Slide 9: System Architecture
*Images Required: CVIS Architecture Diagram showing the 3 tiers.*
1. **Vehicle Node (ESP32):** Arduino-framework firmware generating telemetry, hashing payloads (HMAC), encrypting (AES-GCM), and transmitting via HTTP/MQTT.
2. **Backend Cloud (FastAPI):** Ingest pipeline featuring ChaosMiddleware, API Key Auth, Crypto Verification, SQLite persistence, and WebSocket fan-out.
3. **Unified Frontend (Next.js):** Three role-gated views:
   - `/driver`: Real-time dashboard & AI chat.
   - `/noc`: Network Operations Centre (Chaos & Protocol Controls).
   - `/admin`: Aggregated system statistics.

---

## Slide 10: Design and Implementation (Security & Protocols)
- **Data Integrity:** `HMAC-SHA256(device_secret, canonical_json)` computed on the ESP32. Verified constant-time by the backend.
- **Confidentiality:** `AES-256-GCM` encryption with hardware RNG IV.
- **Replay Protection:** 30-second rolling window cache using `timestamp_ms`.
- **Protocol Switching:** Seamlessly toggles between HTTP REST (request-response) and MQTT (pub-sub) without server restarts.

---

## Slide 11: Partial Results & Observations
*Images Required: Screenshots of the NOC Dashboard or Terminal Output.*
- **Performance:** Telemetry ingest `p50` latency of 4?"8 ms. WebSocket fan-out < 1 ms.
- **AI Latency:** Centralised inference takes 8?"15s on CPU, completely decoupled from the 10ms telemetry ingest.
- **Security Validation:** 
  - Tampered packets (simulated by Chaos Middleware) are instantly rejected (401).
  - AES-GCM packets successfully decrypted in real-time.
- **Automated Testing:** 100% pass rate across smoke tests (Phase 1 & 2), including 45/45 matrix tests on vehicle modes and tampering.

---

## Slide 12: Project Timeline (Development Phases)
- **Phase 1:** Core Pipeline (HTTP Only, DB Schema, WebSockets)
- **Phase 2:** Auth + Integrity + MQTT + Chaos Middleware
- **Phase 3:** AI Integration (Ollama, Prompt Builder)
- **Phase 4:** NOC Controls & UI Implementation
- **Phase 5:** Admin Stats Dashboard
- **Phase 6:** Automated Matrix Testing
- **Phase 7:** Documentation Pack (IEEE Report, User Manual, Theory Guide)
- **Phase 8:** Final Hardware/Broker Validation

---

## Slide 13: Conclusion
- CVIS successfully demonstrates a complete, working implementation of secure vehicle-to-cloud communication. 
- It is not merely a simulation?"cryptographic verification (HMAC, AES) and replay detection are executed on every packet by the backend. 
- The project validates the core thesis: intelligence should be centralised and the vehicle should be a thin, securely-networked client capable of withstanding real-world network chaos.

---

## Slide 14: References
1. R. Fielding, "Architectural Styles and the Design of Network-based Software Architectures," UC Irvine, 2000.
2. OASIS, "MQTT Version 5.0," March 2019.
3. NIST SP 800-38D, "Recommendation for Block Cipher Modes of Operation: GCM," 2007.
4. H. Krawczyk et al., "HMAC: Keyed-Hashing for Message Authentication," RFC 2104, 1997.
5. Meta AI Research, "Llama 3," 2024.
6. Ollama, "Run Large Language Models Locally."
