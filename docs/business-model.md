# CVIS Business Model — Free / Premium Tier Justification

## Project Thesis Recap

The core claim of CVIS is: **AI should live centrally in the cloud/data-centre, not embedded per vehicle.** The vehicle is a thin, securely-networked client. This document explains why that architectural choice is the correct one economically, and how it enables a viable SaaS tier model.

---

## Why Centralized AI is Economically Superior

### Cost structure of on-vehicle vs. cloud AI

| Factor | Per-Vehicle Embedded AI | Centralised Cloud AI (CVIS model) |
|---|---|---|
| Hardware cost | $50–500/vehicle (edge SoC for inference) | $0 extra per vehicle — shared server |
| Model updates | Physical reflash or OTA per vehicle | Redeploy once on server |
| Model quality | Tiny 1–2B models only (compute-constrained) | Any size — current: llama3.2:3b; upgradeable |
| Fleet scaling | Cost scales linearly with fleet size | Sub-linear — server is shared |
| Security surface | Each vehicle is an attack vector for model extraction | One hardened server, audited network boundary |
| Multi-vehicle context | None — each vehicle only sees itself | Cross-fleet anomaly detection is possible |
| Latency | ~1–5ms (local) | 20–200ms (LAN/WAN round-trip) |

**The only advantage of embedded AI is latency.** For CVIS's safety recommendation use-case, 200ms is imperceptible to a human driver. The recommendation appears in the dashboard within a second — the extra 150ms over embedded is invisible.

Every other factor favours centralised AI, overwhelmingly in fleet operators' favour.

---

## Tier Model

### Free Tier — "CVIS Community"

**Target:** Individual EV owners, small fleets (1–5 vehicles), students, developers.

**Included:**
- Full secure communication layer (HMAC-SHA256, API key auth)
- Telemetry ingestion and storage (7-day rolling history)
- Driver dashboard (`/driver`) — live telemetry, graphs, AI recommendation once per 5 minutes
- Up to 2 registered devices
- WebSocket real-time updates
- Basic `/admin` stats (no fine-grained logs)

**Limits:**
- No AES-GCM encryption (plaintext HMAC integrity only)
- No NOC (`/noc` view locked)
- AI recommendations rate-limited to 1 per 5 minutes
- No replay protection (basic tamper detection only)
- No chaos/simulation controls

**Why free?** Drives adoption, builds dataset, creates switching cost.

---

### Premium Tier — "CVIS Fleet"

**Target:** Fleet operators (10+ vehicles), commercial EV fleets, academic institutions.

**Price point (hypothetical):** $15/vehicle/month, $120/vehicle/year.

**Everything in Free, plus:**

| Feature | Justification |
|---|---|
| AES-256-GCM payload encryption | Confidentiality for sensitive telemetry (cargo, route, driver data) |
| Full NOC (`/noc`) | IT/ops teams need live packet visibility and controls |
| Unlimited AI recommendations | High-value use case: fleet-wide safety monitoring |
| 12-month telemetry history | Compliance, insurance, incident reconstruction |
| Replay protection | Critical for fleet-scale deployment — prevents spoofed data |
| Chaos simulation controls | For teams doing network resilience testing |
| Unlimited device registration | Fleet operators have hundreds of vehicles |
| Cross-fleet anomaly alerts | Server sees all vehicles — can detect coordinated attacks |
| Priority AI inference | Dedicated inference queue, <500ms SLA |
| Auth log export (CSV/JSON) | Compliance and audit requirements |

---

## Why This Validates the CVIS Architecture Thesis

The tier model only works because AI is **centralized**:

1. **Shared compute:** A single inference server handles thousands of vehicles. The marginal cost of one more vehicle asking for an AI recommendation is near-zero (one API call to Ollama).

2. **Upgradeable without touching hardware:** When a better model is released (e.g., llama3.2 → llama4), the server is updated. Zero vehicle reflashes. This is impossible with embedded AI.

3. **Fleet context:** The centralized backend can alert when 20% of a fleet suddenly reports battery overheating (possible systemic defect or coordinated attack). An embedded AI cannot — it has no visibility beyond its own vehicle.

4. **Security boundary:** The HMAC/AES-GCM layer this project implements is precisely what makes thin-client AI viable. Without this communication layer, a centralized AI is blind to untrusted data. CVIS demonstrates the complete stack: secure channel → centralized AI → verified recommendations.

---

## CCNS Mapping

| Business Tier Feature | CCNS Unit |
|---|---|
| HMAC-SHA256 integrity (all tiers) | Unit 4 — Message Authentication Codes |
| AES-GCM encryption (Premium) | Unit 4 — Symmetric Authenticated Encryption |
| API key auth + device registration | Unit 4 — Authentication, Key Distribution |
| Replay protection (Premium) | Unit 4 — Replay Attack Prevention |
| NOC packet flow visualization | Unit 2 — Protocol Analysis, Application Layer |
| Chaos simulation (loss, latency) | Unit 3 — Reliability, QoS, Packet Loss, Delay |
| MQTT publish-subscribe (Premium NOC) | Unit 2 — Message Broker Protocols |
| Centralised AI over secure channel | Unit 5 — Cloud/Edge Architecture, Intelligent Networking |
