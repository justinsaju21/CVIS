# CVIS — Demo Script

**Event:** CCNS Course Project Viva Demo  
**Duration:** 15 minutes  
**Live System:** `https://cvis.justinsaju.me`  
**ESP8266:** Flash and connect to WiFi before demo

---

## Pre-Demo Checklist (5 minutes before)

- [ ] ESP8266 is powered on and connected to WiFi (`THE MAN`)
- [ ] Serial Monitor open — confirm `[HTTP] POST OK → 200` is printing every 2 seconds
- [ ] `https://cvis.justinsaju.me/driver/alpha` open in browser — charts should already be pre-populated from backfill
- [ ] `https://cvis.justinsaju.me/noc` open in second tab
- [ ] `https://cvis.justinsaju.me/admin` open in third tab
- [ ] Verify AI is running: `https://api-cvis.justinsaju.me/api/v1/ai/status` → `"running": true`
- [ ] Mosquitto running on homeserver (for MQTT demo): `sudo systemctl status mosquitto`

> **If ESP8266 is not available:** The backend Python simulator can be used instead:
> ```bash
> ssh justin@192.168.1.8
> cd ~/CVIS/backend && python test_phase6.py
> ```

---

## Part 1 — Introduction (2 min)

> *"CVIS demonstrates a centralised vehicle intelligence architecture. The thesis is that AI belongs in the cloud — the vehicle is a thin, securely-networked client. This project is about the secure communication layer that makes that architecture possible, not about building a chatbot."*

**Show:** `/driver/alpha` — note that charts are already populated even though the page just loaded. Explain the WebSocket backfill: the server sends the last 10 telemetry rows immediately on connect.

**Point out:**
- The live connection indicator (green dot)
- Three nav links: Driver / NOC / Admin
- The mode badge showing current operating mode

---

## Part 2 — Live Telemetry and Physics (2 min)

**Show (on `/driver/alpha`):**
- Battery arc animating in real-time
- Speed gauge updating every 2 seconds
- History charts drawing as new data arrives
- AI recommendation typing in (if Ollama is running)

> *"The ESP8266 runs a stateful physics engine. The values aren't random — they're physically coherent. For example, watch what happens when I switch to Sport mode..."*

**Press the button on the ESP8266** to cycle to **Sport** mode.

**Show:**
- Motor temperature rising gradually (heat exchange model)
- Battery drain accelerating
- Range estimate dropping
- AI recommendation updating to reflect new mode

> *"Speed builds up with inertia — it doesn't teleport to 120 km/h instantly. Battery drains faster because aerodynamic drag increases with the square of velocity. The AI receives all eight telemetry fields simultaneously and reasons across all of them — it's not just threshold if/else logic."*

---

## Part 3 — NOC Demonstration (6 min)

**Switch to `/noc` tab.**

> *"The Network Operations Centre is the primary demo surface for CCNS concepts. Every control here causes a real, verifiable backend behaviour change."*

### 3A — Packet Inspector (30s)
Click any packet row in the table. Show:
- Full JSON payload
- HMAC-SHA256 signature in header
- `auth_ok` status
- Encryption method (HMAC-SHA256 or PLAIN)
- AI response if present

### 3B — Tamper Detection — *HMAC-SHA256, Unit 4* (90s)

> *"I'll now demonstrate packet integrity using HMAC-SHA256."*

**Action:** Click **Tamper Inject**.

**Wait** for the next packet to arrive (~2 seconds).

**Show:** The packet row turns red. `tamper_detected` in auth column. Open inspector.

> *"The chaos middleware mutated `battery_pct` to 999.9 in the body bytes AFTER the HMAC signature was already computed. The backend recomputed the HMAC over the received body and compared using constant-time `hmac.compare_digest` — preventing timing oracle attacks. The signatures didn't match, so the packet was rejected with 401. The auth log now has a `tamper_detected` entry."*

**Turn tamper off** after showing.

### 3C — Auth Toggle (45s)

> *"Now I'll show what happens when authentication is disabled — demonstrating insecure open traffic."*

**Action:** Click **Auth: OFF**.

**Show:** Next few packets arrive with `no_auth` status — they're accepted but flagged.

**Action:** Click **Auth: ON**.

> *"Without auth, any device could send packets. With it enabled, only registered devices with valid API keys and correct HMAC signatures are accepted."*

### 3D — Packet Loss — *Unit 3* (45s)

**Action:** Set Packet Loss to **25%**.

**Show:** Approximately 1 in 4 packets shows `dropped` / 503 status.

> *"Packet loss is simulated at the ASGI middleware layer — before FastAPI processes the body. This is equivalent to network-layer packet drop for demonstration purposes. The ESP8266 has retry logic with exponential backoff — watch the retry count column increment."*

**Action:** Set back to **0%**.

### 3E — Protocol Switch — *Unit 2* (60s)

> *"CVIS implements two full, real protocol adapters — not one real and one mocked."*

**Action:** Click **MQTT**.

**Show:** After ~30 seconds (firmware poll interval), packet colour changes from cyan → amber.

> *"HTTP uses request-response over TCP — the ESP8266 sends a POST and waits for 200 OK. MQTT uses publish-subscribe through a broker — the ESP8266 publishes to `cvis/telemetry/ESP32-ALPHA` and the broker delivers it to the backend subscriber. Same auth, same HMAC, same ingest pipeline, different transport."*

**Action:** Switch back to **HTTP**.

---

## Part 4 — Admin Console (1.5 min)

**Switch to `/admin` tab.**

**Show:**
- Live CPU % and RAM usage (real psutil data from homeserver)
- Packet statistics — total, ok, rejected from this session
- Auth log — scroll to `tamper_detected` event from the demo
- Device list — `ESP32-ALPHA` with last-seen timestamp

> *"Everything here is real — no mocked counters. The auth log is the audit trail for every security event."*

---

## Part 5 — AI Demonstration (2 min)

**Switch to `/driver/alpha` tab.**

> *"The AI layer runs Ollama with llama3.2:3b — a 3-billion parameter local model. It receives all telemetry fields simultaneously — battery percentage, motor temperature, speed, mode, fault code — and the last 5 historical readings for trend context."*

**Action:** Press the button to switch to **Battery Overheating** mode.

**Wait** for AI recommendation to update.

**Show:** The recommendation addresses the high temperature, fault code, and reduced range — not just one field.

> *"This is multi-factor reasoning. A simple if/else rule would just say 'battery is hot'. The AI explains the implications across multiple variables and suggests concrete action."*

**Action:** Open **Chat with CVIS**. Ask: *"Should I stop the vehicle right now?"*

**Show:** AI responds with context from the live telemetry snapshot.

---

## Part 6 — CCNS Mapping (1 min)

| Concept Demonstrated | CCNS Unit | Feature |
|---|---|---|
| JSON schema, adaptive send interval | Unit 1 | Data communication, payload design |
| HTTP REST vs MQTT, WebSocket | Unit 2 | Network models and protocols |
| Retry + backoff, packet loss, latency | Unit 3 | Transport layer reliability |
| HMAC-SHA256, AES-GCM, replay protection, tamper detection | Unit 4 | Network security |
| Centralised AI reasoning, cloud architecture | Unit 5 | Advanced networking and AI integration |

> *"The full mapping table with 34 features is in `docs/ccns-mapping.md`."*

---

## Part 7 — Closing (30s)

> *"CVIS demonstrates that connected vehicle security is real, not simulated. HMAC verification, AES-GCM encryption, replay protection, and device revocation are all working, verifiable implementations. The AI reasons genuinely over multi-factor telemetry. The NOC gives a real-time view of the secure communication layer in action — accessible from anywhere in the world through a Cloudflare Tunnel."*

---

## Backup Procedures

### If the live site is unreachable:
```bash
ssh justin@192.168.1.8
pm2 status               # check both services
pm2 restart cvis-backend
pm2 restart cvis-frontend
sudo systemctl restart cloudflared
```

### If ESP8266 is not sending data:
- Check Serial Monitor — is it connecting to WiFi?
- If `HTTP -1`: backend host unreachable — check `BACKEND_HOST` in `secrets.h`
- Fall back to Python simulator: `ssh justin@192.168.1.8 && cd ~/CVIS/backend && python test_phase6.py`

### If AI is not responding:
```bash
ssh justin@192.168.1.8
ollama serve &           # start if not running
ollama pull llama3.2:3b  # pull model if needed
```

### If MQTT switch doesn't work:
```bash
ssh justin@192.168.1.8
sudo systemctl start mosquitto
```
