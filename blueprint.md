# CVIS Presentation Blueprint

This document outlines the blueprint for creating the PowerPoint (PPTX) presentation for the **Connected Vehicle Intelligence System (CVIS)** project, aligned strictly with the `AGENTS.md` project contract.

Each slide defines the text content to include, as well as instructions for layout, graphics, diagrams, and spacing.

---

## Slide 1: Connected Vehicle Intelligence System (CVIS)
**Type:** Title Slide

*   **Main Title:** Connected Vehicle Intelligence System (CVIS)
*   **Subtitle:** A Secure Communication Architecture for Cloud-Centric Automotive AI
*   **Footer/Subtext:** [Your Name / Team Name] | Academic Project - CCNS Course
*   **Visual/Layout Instructions:** 
    *   Leave the right half or background for a high-quality title image (e.g., a modern vehicle wireframe connected to a cloud network data center).
    *   Keep the layout clean and modern, matching a "premium" design aesthetic.

---

## Slide 2: Primary Objective & Core Thesis
**Type:** Concept / Objectives

*   **Core Thesis:** 
    *   AI should live centrally (cloud/data-center), not embedded per-vehicle. 
    *   The vehicle acts as a thin, securely-networked client.
*   **Primary Objective:** 
    *   Demonstrate a robust **secure communication layer** that makes this architecture possible. 
    *   Map core networking and security concepts directly to CCNS Units 1–5.
*   **Visual/Layout Instructions:**
    *   Use a two-column layout. Left: bullet points. Right: Leave space for a conceptual diagram showing a "Heavy Edge" (crossed out) vs. "Thin Client + Cloud AI" (highlighted with a checkmark).

---

## Slide 3: Problem Statement & Scope
**Type:** Problem & Scope

*   **Problem Statement:** 
    *   Deploying complex AI models locally on vehicle hardware is expensive, power-intensive, and hard to update. 
    *   Centralizing AI requires overcoming network loss, latency, and strict security threats (tampering, unauthorized access).
*   **Project Scope:** 
    *   **In Scope:** Simulated ESP32 telemetry, robust protocol switching, cryptographic integrity, chaos testing.
    *   **Out of Scope:** Real EV hardware, real sensors, generic chatbots (AI must be grounded in telemetry).
*   **Visual/Layout Instructions:**
    *   Use icons alongside bullet points (e.g., a warning icon for the problem, a target icon for scope). Leave space at the bottom for a horizontal timeline or scope boundary box.

---

## Slide 4: System Abstract & Architecture
**Type:** High-Level Architecture

*   **Text (Abstract):** A four-tier architecture emphasizing network security and simulated edge telemetry.
*   **Visual/Layout Instructions:**
    *   **CRITICAL DIAGRAM SPACE:** Dedicate 70% of this slide to the **Core Architecture Diagram**.
    *   **Diagram Components:** 
        1. `ESP32 Vehicle Node` (Left)
        2. `Secure Communication Layer (HTTP ⇄ MQTT)` (Middle-Left)
        3. `FastAPI Backend + Ollama AI` (Middle-Right)
        4. `Unified Next.js Frontend` (Right)
    *   Show arrows representing the flow of JSON payloads and WebSocket streams.

---

## Slide 5: Methodology: System Design & Interfaces
**Type:** Technical Implementation

*   **Secure Communication Layer:** 
    *   Runtime-switchable adapters: HTTP REST ⇄ MQTT.
    *   Ensures reliable message delivery (Ack + Retry with backoff).
*   **Visual/Layout Instructions:**
    *   Include a flowchart or sequence diagram showing the request/response cycle: ESP32 sends telemetry -> Backend acknowledges receipt -> Frontend updates via WebSocket. 
    *   Leave space to visually separate the HTTP flow and the MQTT flow.

---

## Slide 6: Methodology: ESP32 Firmware (The Edge)
**Type:** Edge / Hardware Simulation

*   **Implementation:** Arduino framework, WiFi-connected simulated telemetry.
*   **Key Features:** 
    *   1 push button cycles through 8 logical states (Healthy, Eco, Sport, Heavy Traffic, Low Battery, Overheating, Charging, Motor Fault).
    *   Telemetry variables (temp, speed, battery) dynamically reflect the active state in a logically coherent way.
*   **Visual/Layout Instructions:**
    *   Insert a photo/render of an ESP32 board. 
    *   Include a code snippet or a small table mapping "Vehicle Mode" to "Telemetry Output" (e.g., Sport Mode -> High Temp, Fast Drain).

---

## Slide 7: Methodology: Backend & Communications
**Type:** Server & Security

*   **Tech Stack:** FastAPI, SQLite database.
*   **Security Mechanisms:**
    *   Device Registration (Unique ID + API Key/JWT).
    *   Cryptographic Integrity: HMAC-SHA256 or AES-GCM on every payload.
    *   Strict rejection of tampered packets.
*   **Visual/Layout Instructions:**
    *   Add a diagram illustrating the cryptography process: Payload + Secret Key -> Hashing Algorithm -> HMAC attached to payload.
    *   Leave space for a small screenshot of SQLite logs showing accepted/rejected packets.

---

## Slide 8: Methodology: Local AI Integration
**Type:** AI Logic Layer

*   **AI Engine:** Local Ollama (`llama3.2:3b` or `phi3-mini`) for ultra-low latency.
*   **Multi-factor Reasoning:** 
    *   AI does not use simple `if/else` thresholds. It evaluates the *combined* telemetry snapshot (battery + temp + mode + speed + fault codes) to produce natural-language explanations.
*   **Visual/Layout Instructions:**
    *   Include a visual comparison: "Bad AI" (if temp > 90 -> alert) vs. "CVIS AI" (Analyzes combined data stream to generate contextual advice).
    *   Show a mock UI chat bubble of a grounded AI recommendation.

---

## Slide 9: Methodology: Unified Frontend Architecture
**Type:** User Interface

*   **Framework:** Next.js + Tailwind CSS + Recharts + WebSockets.
*   **Three Routed Views (One App):**
    *   `/driver`: Live dashboard, AI chat, vehicle health.
    *   `/noc`: Network Operations Center (Live controls, packet inspector).
    *   `/admin`: Fleet stats, error logs, server status.
*   **Visual/Layout Instructions:**
    *   **SCREENSHOT HEAVY:** Divide the slide into three sections. Place mockups or actual screenshots of the Driver Dashboard, NOC, and Admin panels.

---

## Slide 10: Testing & Execution Plan
**Type:** Project Management & Validation

*   **Execution Plan:** Strict 8-week phased build (Core -> Auth/MQTT -> AI -> NOC -> Admin -> Hardening -> Docs).
*   **Testing via Chaos Middleware:**
    *   Live NOC controls to inject artificial network issues at the backend level.
    *   Simulate 0-25% packet loss, up to 1000ms latency, and payload tampering.
*   **Visual/Layout Instructions:**
    *   Insert a Gantt chart or a staggered timeline graphic for the 8 phases.
    *   Include an image of the "Chaos Sliders" from the NOC UI.

---

## Slide 11: Expected Outcomes: Functional Features
**Type:** Results & Demonstration

*   **Live NOC Capabilities:** Real-time visibility into the exact packet flow (source, destination, protocol, encryption status).
*   **Demonstrable Resilience:** Showcasing how the system recovers from dropped MQTT connections or ESP32 WiFi disconnects.
*   **Dynamic Response:** Proving the backend actively drops bad packets without crashing.
*   **Visual/Layout Instructions:**
    *   Include an animated GIF representation (if possible) or a static diagram showing a packet being intercepted and dropped by the security layer.
    *   Leave space for "Demo Highlight" bullet points.

---

## Slide 12: Expected Outcomes: Assessment & Deliverables
**Type:** Conclusion

*   **Academic Alignment:** Full mapping of networking features to CCNS Units 1–5.
*   **Deliverables:** 
    *   Fully functional hardware-software prototype.
    *   Comprehensive Documentation: API Docs, Architecture/Sequence Diagrams, IEEE-style report, Security Analysis.
*   **Visual/Layout Instructions:**
    *   Include a stylized checklist graphic for the deliverables.
    *   Leave a clean, uncrowded space at the bottom right for a "Q&A" / "Thank You" closer.
