# CVIS — Demo Script

**Event:** CCNS Course Project Viva Demo  
**Duration:** 15 minutes  
**Prerequisites:** Backend running, frontend running, test simulator ready

---

## Setup Checklist (Before Demo)

- [ ] `uvicorn main:asgi_app --port 8000` running in terminal A
- [ ] `ollama serve` running in terminal B (optional but impressive)
- [ ] `npm run dev` running in terminal C
- [ ] Browser open at `http://localhost:3000`
- [ ] Terminal D ready with `cd backend` for simulator commands
- [ ] All three tabs pre-opened: `/driver`, `/noc`, `/admin`

---

## Part 1 — System Introduction (2 min)

**Say:** *"CVIS demonstrates a centralised vehicle intelligence architecture. The key thesis is that AI should live in the cloud — the vehicle is a thin, securely-networked client. This project is about the secure communication layer, not the AI itself."*

**Show:** The `/driver` page loading — the Cybertruck wireframe animation draws in, then transitions to the dashboard.

**Point out:** The CVIS branding, the three nav links (Driver / NOC / Admin), the live connection indicator.

---

## Part 2 — Live Telemetry (2 min)

**Action:** In terminal D:
```bash
python test_phase6.py
```

**Show:** On `/driver` —
- Battery arc animates to the live value
- Speed, Range, Motor Temp cards update
- History graphs start drawing
- AI recommendation types in (if Ollama is running)

**Say:** *"The ESP32 firmware (or backend simulator) runs a stateful physics engine. When I switch the vehicle into Sport mode from this dashboard..."*

**Action:** Click the Mode badge and select **Sport**.

**Show:** 
- The target speed changes immediately
- The actual speed dial spools up smoothly due to physics inertia math (`dt` calculation)
- The battery drain rate accelerates, and the estimated range drops instantly based on Sport mode's lower efficiency factor.

**Say:** *"Notice how the speed accelerates smoothly, and the range drops. This is a mathematically sound, closed-loop physics engine, not just random telemetry. The AI receives all these inter-dependent telemetry fields simultaneously and reasons over them."*

**Switch to `/noc`** — show packets arriving in real-time, each row populating.

---

## Part 3 — NOC Demonstration (5 min)

**Say:** *"The Network Operations Centre is where I demonstrate all the CCNS networking and security concepts. Every control here causes a real, verifiable backend behaviour change — nothing is cosmetic."*

### 3A — Packet Inspector
**Click any packet row** → show the inspector panel with JSON payload, device ID, encryption status, AI response.

### 3B — Tamper Detection (Core Demo)
**Say:** *"I will now demonstrate HMAC-SHA256 tamper detection — this is Unit 4, Network Security."*

**Action:** Click **Tamper Inject** in the NOC controls.  
**Wait** for next packet to arrive.  
**Show:** The packet row turns red. Status = `rejected`. Open the inspector — show `tamper_detected`.  

**Say:** *"The chaos middleware mutated one byte of the payload after the signature was computed. The backend detected the HMAC mismatch using constant-time comparison — preventing timing oracle attacks — and rejected the packet with a 401. This is now logged in the auth log."*

### 3C — Auth Toggle
**Action:** Click **Auth: OFF**.  
**Show:** Next packets arrive with `no_auth` status — traffic flows but is flagged.  
**Action:** Click **Auth: ON**.  
**Show:** Without a valid key, packets would now 401 again.

**Say:** *"This demonstrates the ability to dynamically toggle authentication — useful for debugging and for demonstrating what happens when security controls are absent."*

### 3D — Packet Loss
**Action:** Set loss to **25%**.  
**Show:** Some packets appear with `dropped` status — approximately 1 in 4.  
**Action:** Set back to **0%**.

**Say:** *"Packet loss is simulated at the ASGI middleware layer — before FastAPI processes the body. This is analogous to network-layer packet loss and demonstrates how application-layer reliability mechanisms respond."*

### 3E — Protocol Switch (if Mosquitto is running)
**Action:** Click **MQTT**.  
**Show:** Packet colour changes from cyan (HTTP) to amber (MQTT).  
**Say:** *"Both HTTP REST and MQTT are real, working protocol adapters. HTTP uses request-response over TCP; MQTT uses publish-subscribe with a broker. The switch requires no restart."*

---

## Part 4 — Admin Console (2 min)

**Navigate to `/admin`**

**Show:**
- CPU and memory gauges (live psutil data)
- Packet statistics — total, ok, rejected
- Auth log — scroll to show `tamper_detected` from the demo
- Device list — test device with last-seen timestamp

**Say:** *"The admin console provides full operational visibility. All data is real — there are no mock counters. The auth log is the audit trail for every security event."*

---

## Part 5 — AI Demonstration (2 min)

**Navigate to `/driver`**

**Say:** *"The AI layer runs Ollama with llama3.2:3b — a 3-billion parameter model. The prompt includes all eight telemetry fields simultaneously — battery percentage, motor temperature, speed, mode, fault code — and requires the model to reason across them."*

**Action:** Click the **Refresh** button on the AI Recommendation panel.

**Show:** The typewriter animation types out a recommendation grounded in the current vehicle state.

**Action:** Open the **Chat with CVIS** panel. Ask: *"Should I continue driving in the current conditions?"*

**Show:** The AI responds with context from the current telemetry.

---

## Part 6 — CCNS Mapping Summary (1 min)

**Say:** *"Every feature I have shown maps directly to a CCNS syllabus unit:"*

| Demo Shown | CCNS Unit | Topic |
|---|---|---|
| JSON schema, adaptive intervals | Unit 1 | Data Communication |
| HTTP vs MQTT, WebSocket | Unit 2 | Network Models & Protocols |
| Retry, packet loss, latency | Unit 3 | Transport Layer |
| HMAC, AES-GCM, replay, tamper | Unit 4 | Network Security |
| Centralised AI, async reasoning | Unit 5 | Advanced / Cloud Architecture |

**Say:** *"The full mapping table with 34 features is in `docs/ccns-mapping.md`."*

---

## Part 7 — Closing (1 min)

**Say:** *"CVIS demonstrates that a connected vehicle system can be built with real security — not simulated security. HMAC verification, AES-256-GCM encryption, replay protection, and device revocation are all working, verifiable implementations. The AI layer is genuinely reasoning over multi-factor telemetry, not applying threshold rules. And the NOC gives a real-time view of the secure communication layer in action."*

---

## Backup Commands

If the simulator crashes:
```bash
cd backend && python test_phase6.py
```

If backend needs restart:
```bash
cd backend && venv\Scripts\uvicorn main:asgi_app --host 0.0.0.0 --port 8000
```

If frontend crashes:
```bash
cd frontend && npm run dev
```
