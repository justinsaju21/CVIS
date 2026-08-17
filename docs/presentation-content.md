# CVIS — Presentation Content Reference

This document holds all the raw text content for each slide of the CVIS PowerPoint presentation.
The corresponding LaTeX source is at `presentation/cvis_presentation.tex`.

---

## Slide 1 — Title
- **Title:** Connected Vehicle Intelligence System (CVIS)
- **Subtitle:** Secure Communication Architecture for Cloud-Centric Automotive AI
- **Authors:** [Your Name(s)]
- **Course:** Computer Communication & Network Security (CCNS)
- **Institution:** SRM Institute of Science and Technology
- **Logo:** SRM logo (top-left or top-right)
- **Background image:** Modern vehicle wireframe + cloud network icon

---

## Slide 2 — Primary Objective & Core Thesis
- **Thesis:** AI should live centrally (cloud/data-centre), not embedded per-vehicle. The vehicle is a thin, securely-networked client.
- **Primary Objective:** Demonstrate the secure communication layer that makes this architecture possible.
- **Grading Focus:** Networking + Security concepts mapped explicitly to CCNS Units 1–5.
- AI is the application on top — not the point of the project.

---

## Slide 3 — Problem Statement & Scope
- **Problem:** Per-vehicle edge AI is expensive, power-heavy, and hard to update. Centralising AI introduces network reliability and security challenges: packet loss, latency, tampering, and unauthorized access.
- **In Scope:** Simulated ESP32 telemetry, HTTP REST + MQTT protocol switching, HMAC/AES-GCM integrity, chaos testing middleware, unified frontend.
- **Out of Scope:** Real EV hardware, generic chatbot AI, three separate frontend apps.

---

## Slide 4 — System Architecture
- **Four-tier overview:**
  1. ESP32 Vehicle Node (simulated)
  2. Secure Communication Layer (HTTP ⇄ MQTT, runtime-switchable)
  3. FastAPI Backend + Ollama AI (laptop = cloud/data-centre)
  4. Unified Next.js Frontend (/driver, /noc, /admin)
- **Tech Stack:** ESP32 (Arduino) → Python FastAPI → SQLite → Next.js + Tailwind

---

## Slide 5 — Methodology: System Design & Interfaces
- Runtime-switchable protocol adapters: HttpAdapter and MqttAdapter behind a shared ingest interface.
- Ingest pipeline: ChaosMiddleware → Auth → HMAC verify → AES-GCM decrypt → Pydantic validate → SQLite → WebSocket broadcast → Ollama AI task.
- Every packet logged: timestamp, direction, protocol, size, status.

---

## Slide 6 — Methodology: ESP32 Firmware
- Arduino framework, WiFi-connected, simulated telemetry every N seconds.
- 1 push button (GPIO interrupt, debounced) cycles 8 modes: Healthy, Eco, Sport, Heavy Traffic, Low Battery, Battery Overheating, Charging, Motor Fault.
- Logically coherent telemetry per mode (e.g., Sport → high temp + high speed + fast battery drain).
- HMAC-SHA256 signed via mbedTLS, AES-256-GCM optional encryption with hardware RNG IV.
- Ack + retry with exponential backoff on timeout/failure.

---

## Slide 7 — Methodology: Backend & Communications
- **Auth:** Device registration → unique API key (SHA-256 hashed in DB, never stored plaintext).
- **Integrity:** HMAC-SHA256 on every payload; constant-time compare_digest() to prevent timing attacks.
- **Encryption:** AES-256-GCM with fresh random IV per packet.
- **Tamper detection:** ChaosMiddleware mutates payload post-signature → HMAC fails → 401 + tamper_detected log.
- **Replay protection:** (device_id, timestamp_ms) deduplication within a bounded time window.
- **MQTT:** paho-mqtt subscriber on `cvis/telemetry/+`, async bridged to FastAPI event loop.

---

## Slide 8 — Methodology: Local AI Integration
- Ollama running locally (`llama3.2:3b` or `phi3-mini`) for low-latency inference.
- AI evaluates the combined telemetry snapshot: battery + temperature + mode + speed + fault codes — no simple if/else thresholds.
- Two surfaces: (1) auto-generated recommendation per telemetry update, (2) free-text driver chat grounded in current + recent telemetry.
- AI is a fire-and-forget async task — ingest pipeline never blocks on AI inference.
- AI service can be independently stopped (kill-switch) without affecting the secure comms layer.

---

## Slide 9 — Methodology: Unified Frontend Architecture
- Single Next.js app, one WebSocket connection, three role-gated views.
- **/driver:** Vehicle health, battery status, remaining range, current mode, AI recommendation, alerts, historical graphs (Recharts), chat with CVIS.
- **/noc:** Live animated packet flow, packet table + inspector, all live controls wired to real backend behavior.
  - Controls: Protocol switch, encryption toggle, auth toggle, packet loss slider (0/5/10/25%), latency slider (0/100/300/1000ms), tamper injector, disconnect vehicle, stop AI.
- **/admin:** Connected vehicles, server/AI status, active sessions, packet statistics, auth logs, failed requests, error logs, CPU/memory.

---

## Slide 10 — Testing & Execution Plan
- **8-phase gated build plan:** Each phase fully tested before next begins.
- Phase 1: HTTP pipeline | Phase 2: Auth + MQTT | Phase 3: AI | Phase 4: NOC | Phase 5: Admin | Phase 6: Hardening | Phase 7: Documentation | Phase 8: Demo rehearsal.
- **Chaos middleware testing:** Packet loss (0–25%), latency (0–1000ms), tamper injection — all at backend middleware level, not real network manipulation.
- **Test results:** Phase 1: 20/20, Phase 2: 28/28, Phase 3: graceful AI degradation verified, Phase 6: end-to-end matrix across all modes × both protocols × all chaos settings.

---

## Slide 11 — Expected Outcomes: Functional Features
- Live packet flow visualization with protocol-colored animations.
- Real-time detection and rejection of tampered packets (HMAC-SHA256).
- Runtime protocol switching (HTTP ↔ MQTT) with no server restart.
- Multi-factor AI recommendations coherent across all 8 vehicle modes.
- Demonstrable resilience: MQTT reconnect, ESP32 WiFi drop/reconnect, AI service kill-switch.
- Full audit trail: auth failures, tamper events, device disconnects — all logged and visible in /admin.

---

## Slide 12 — Expected Outcomes: Assessment & Deliverables
- **CCNS Mapping:** 34 implemented features across all 5 CCNS units (Data Comms, Network Models, Transport, Security, Advanced/Cloud).
- **Deliverables:** Firmware, FastAPI backend, Ollama AI, Unified Next.js frontend, SQLite schema, Architecture/Sequence/Packet diagrams, API docs, Installation guide, User manual, Testing docs, Security analysis, Performance analysis, IEEE-style report, PowerPoint, Demo script, Viva Q&A, CCNS mapping table.
