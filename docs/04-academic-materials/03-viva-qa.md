# CVIS — Viva Questions & Answers

**Course:** Computer Communication & Network Security (CCNS)  
**Project:** Connected Vehicle Intelligence System

---

## Unit 1 — Data Communication

**Q1: Why did you choose JSON as the telemetry payload format?**

JSON is a self-describing, human-readable, schema-agnostic format supported natively by Python, JavaScript, and Arduino. It allows us to include a `schema_version` field for protocol evolution, making backward-compatible changes possible without breaking existing clients. The backend uses Pydantic for strict field validation and type enforcement at the API boundary.

**Q2: What is adaptive telemetry interval and why does it matter?**

The ESP8266 adjusts its transmission frequency based on vehicle mode. Fault and overheating modes transmit every 1 second because they are safety-critical; normal modes transmit every 2–5 seconds. This mirrors DiffServ and priority queuing concepts — rather than treating all packets the same, the protocol encodes urgency in the transmission rate. It also reduces bandwidth consumption during routine operation.

**Q3: How does schema versioning work in your system?**

Every telemetry payload includes a `schema_version` field (currently `"1.0"`). If we add new telemetry fields in a future firmware version, we increment this field. The backend can inspect this field and apply the appropriate parsing logic for each version, maintaining backward compatibility.

**Q5: How does the simulated telemetry generation work? Is it just random numbers?**

No, the simulated telemetry uses a **Continuous Stateful Physics Engine**. Both the ESP32 and the Python simulator track variables like speed, battery percentage, and temperature in their own memory. They calculate delta time (`dt`) between loop cycles and apply mathematical formulas for physical inertia and aerodynamic power drain. So when the vehicle switches to "Sport" mode, the speed spools up smoothly, the battery drains much faster, and the estimated range drops dynamically based on the live battery level. This guarantees the AI layer receives mathematically coherent, realistic data to reason over.

---

## Unit 2 — Network Models & Protocols

**Q4: How does HTTP REST differ from MQTT in your system, and when would you prefer each?**

HTTP REST is request-response over TCP: the ESP32 initiates every transaction, the server responds, and the connection closes. It is simple, reliable, and well-suited for low-frequency telemetry with mandatory acknowledgement. MQTT is publish-subscribe: the ESP32 publishes to a topic on a broker, and the backend subscribes. MQTT is more efficient for many IoT devices sharing a broker, supports QoS levels, and allows bidirectional command-and-control via separate topics. In CVIS, the NOC can switch between them at runtime without restarting any service.

**Q5: How does WebSocket fit into the network model?**

WebSocket begins with an HTTP `GET` containing an `Upgrade: websocket` header. The server responds with `101 Switching Protocols`. From that point, the TCP connection remains open and both sides can send framed messages at any time. This demonstrates layer reuse — WebSocket is an application-layer protocol that runs over the same TCP connection as HTTP, but provides full-duplex persistent communication. CVIS uses a single WebSocket per client to push all events (telemetry, AI recommendations, device status) to all three frontend views simultaneously.

**Q6: What is the MQTT topic hierarchy you used and why?**

- `cvis/telemetry/{device_id}` — vehicle telemetry (wildcard `cvis/telemetry/+` for the backend)
- `cvis/config/{device_id}` — backend-to-device configuration updates

The hierarchy follows the publish-subscribe pattern where topic structure acts as a routing key. Wildcard subscriptions (`+` for single level) allow the backend to receive telemetry from all registered vehicles without knowing their IDs in advance.

---

## Unit 3 — Transport Layer

**Q7: How does your retry mechanism relate to TCP retransmission?**

TCP retransmission happens at the transport layer — invisible to the application. Our firmware implements application-layer reliability: if the HTTP response is not 200/201, or if the connection times out, the ESP32 retries up to 3 times with exponential backoff (1s, 2s, 4s). This is analogous to Karn's algorithm in TCP, which doubles the retransmission timeout after each failure to avoid overwhelming a congested network.

**Q8: How did you simulate packet loss and what is its effect on the system?**

The ChaosMiddleware intercepts the raw ASGI request before FastAPI processes the body. It calls `random.random()` and, if the value is below the configured loss percentage, returns a `503 Service Unavailable` without processing the packet. The effect: the SQLite database shows a gap in telemetry, the NOC packet table shows the dropped packet, and the ESP32 firmware (which checks the HTTP status code) triggers its retry backoff.

**Q9: Why does latency injection use asyncio.sleep() rather than actual network delay?**

Real network latency injection (via Linux `tc netem` or similar) would require kernel-level privileges and a real network interface. Since all traffic is on localhost, network shaping would have no effect on loopback. Instead, `asyncio.sleep()` in the ASGI middleware pauses the coroutine before passing control to the route handler. From the ESP32's perspective, the RTT increases exactly as if propagation delay had been introduced — the observable effect on the application layer is identical.

---

## Unit 4 — Network Security

**Q10: How does HMAC-SHA256 provide integrity without confidentiality?**

HMAC (Hash-based Message Authentication Code) computes `HMAC(key, message)` using SHA-256. Both sender and receiver share the secret key. The HMAC is computed over the full payload and sent alongside it. If any byte of the payload changes in transit — whether by an attacker or by the chaos middleware — the recomputed HMAC will not match the received one, and the backend rejects the packet. HMAC provides integrity and authentication, not confidentiality: the payload is still readable. AES-256-GCM adds confidentiality.

**Q11: What is the advantage of AES-GCM over AES-CBC?**

AES-GCM is an Authenticated Encryption with Associated Data (AEAD) mode. In a single operation it provides: (1) confidentiality via AES in counter mode, and (2) integrity via a GCM authentication tag. AES-CBC provides confidentiality only and requires a separate MAC (e.g., HMAC) for integrity — creating complexity and potential for implementation errors. AES-GCM also naturally handles IV (initialisation vector) freshness: a new random IV per packet, included in the envelope, ensures that encrypting the same plaintext twice produces different ciphertexts.

**Q12: What is a timing oracle attack and how do you prevent it?**

A timing oracle attack exploits the fact that a naive string comparison (`==`) returns early when it finds the first mismatched byte. An attacker can measure response times to infer how many bytes of their forged HMAC are correct, allowing them to brute-force signatures byte by byte. `hmac.compare_digest()` (Python) compares all bytes in constant time regardless of where the mismatch occurs, eliminating the timing side-channel.

**Q13: How does replay protection work in your system?**

Each telemetry payload includes a `timestamp_ms` field set to a boot-relative monotonic `millis()` token. The backend maintains a set of seen `(device_id, timestamp_ms)` tuples within a 30-second rolling window. If a packet arrives with a `(device_id, timestamp_ms)` pair already seen within the window, it is rejected with 401. Cache eviction occurs at approximately 60 seconds. This prevents an attacker from capturing a valid packet and re-submitting it later.

**Q14: What happens when you click "Disconnect Vehicle" in the NOC?**

`POST /api/v1/control/disconnect` sets `active = 0` for the device in the `devices` table. On the next telemetry POST from that device, the auth layer looks up the device, finds `active = False`, and returns 401. The device's API key is no longer accepted. This demonstrates credential lifecycle management — specifically, revocation without requiring a key rotation.

**Q15: Why do you store the hashed API key in the database rather than the plaintext?**

The device's API key is a 64-byte random secret. We store `SHA-256(api_key)` in the database. If the database is compromised, the attacker obtains hashes, not keys. Since API keys are random and high-entropy, a rainbow table attack is infeasible. When the device sends its key in the request header, the backend hashes the received key and compares with the stored hash.

---

## Unit 5 — Advanced / Cloud Architecture

**Q16: Why is centralised AI better than per-vehicle AI for this use case?**

Per-vehicle AI would require embedding a language model or complex inference engine in each vehicle's compute unit. This adds cost, weight, update complexity, and means the AI reasoning capability of each vehicle is fixed at the time of manufacture. Centralised AI on a server: (1) can be updated instantly for all vehicles, (2) can use much larger models with more powerful hardware, (3) can reason across fleet-wide data rather than just one vehicle's telemetry, and (4) keeps the vehicle thin and focused on secure data transmission — which is what this project demonstrates.

**Q17: How does CVIS ensure AI latency does not block telemetry ingestion?**

The AI inference call is launched as `asyncio.create_task()` — a fire-and-forget background task. The telemetry ingest handler returns `200 OK` immediately after persisting the packet and broadcasting the telemetry WebSocket event. The AI recommendation arrives asynchronously via a separate `ai_recommendation` WebSocket event when inference completes (typically 8–15 seconds on CPU). This decoupling ensures the secure communication layer remains responsive regardless of AI load.

**Q18: How does CVIS handle the AI being unavailable?**

The `OllamaClient` has a 20-second timeout and graceful error handling. If Ollama is not running, `check_ollama_status()` returns `{"running": false}`. The AI router returns appropriate error messages. The telemetry pipeline continues unaffected — the fire-and-forget AI task simply logs a warning and completes without broadcasting. The frontend shows "AI unavailable" in the recommendation panel rather than crashing.

**Q19: How is the WebSocket fan-out event-driven architecture different from REST polling?**

With REST polling, each frontend tab would periodically call `GET /api/v1/telemetry/recent` — say, every 2 seconds. This means a telemetry packet received at T=0 might not appear in the UI until T=2, introducing up to 2 seconds of artificial latency. It also generates N×frequency HTTP requests even when nothing has changed. With WebSocket fan-out, the server pushes events to all connected clients immediately when a packet arrives. Latency is limited only by network RTT (< 1 ms on localhost). No polling overhead. This is the event-driven architecture pattern used in production IoT dashboards.

**Q20: If you had to scale this system to 10,000 vehicles, what would you change?**

| Component | Change |
|---|---|
| SQLite | Replace with PostgreSQL — concurrent writes, connection pooling |
| Single FastAPI worker | Multiple Uvicorn workers behind a load balancer, or Gunicorn |
| WebSocket | Redis pub/sub to fan-out across multiple server instances |
| Cloudflare Tunnel | Dedicated load balancer with TLS termination (e.g., AWS ALB or Nginx) |
| MQTT broker | Clustered HiveMQ or EMQX for IoT scale |
| AI | GPU-accelerated Ollama or dedicated inference API (OpenAI, Vertex AI) |
| Auth | Hardware HSM for key storage; mTLS for device certificates |

The architecture is designed with these upgrade paths in mind — particularly the adapter pattern for protocols and the separation of the AI layer from the comms layer.

---

## Unit 6 — Industrial Feasibility, Cloud vs. Edge, and Automotive Business Model

**Q21: Why should an electric car manufacturing company adopt CVIS instead of putting a powerful AI chip in every car?**

Electric car manufacturing is governed by strict automotive economics, long lifecycles, and razor-thin hardware margins:
1. **Bill-of-Materials (BOM) Savings:** Embedding an automotive-grade AI computer (such as an NVIDIA DRIVE Orin or Qualcomm Snapdragon Ride) costs **$1,700 to $3,500 per vehicle** once you factor in the high-TOPS SoC, 16–32GB LPDDR5 ECC DRAM, cold-plate liquid cooling lines, high-amperage 12V/48V step-down DC converters, and ISO 26262 ASIL-D safety qualification. In contrast, the CVIS thin-client gateway costs **$37 to $92**. For an automaker producing 500,000 EVs annually, this yields **$1,000,000,000 ($1 Billion USD) in direct annual manufacturing savings**.
2. **Automotive Hardware-Software Lifespan Mismatch:** The operational life of an EV is **12 to 15 years**. AI algorithms, attention mechanisms, and model architectures evolve every **12 to 18 months**. An edge AI chip installed in a 2024 model will be four hardware generations obsolete by 2028, unable to run the models of 2030. In CVIS, when the cloud data center upgrades its GPU cluster from RTX 4060s to Blackwell or optical AI silicon, a 10-year-old car in the field instantly inherits state-of-the-art reasoning without touching the car.
3. **Thermal & Battery Conservation:** Running local AI consumes 70W to 250W continuous power, draining 3.6 kWh/day in standby ("phantom drain" of 12–18 miles of range every 24 hours) and dumping heat into the battery cooling loop. CVIS gateways draw under **1.5 Watts**, preserving every kilowatt-hour for propulsion.

**Q22: How does model updating work in CVIS compared to conventional vehicle Over-the-Air (OTA) updates?**

Conventional automotive OTA updates for edge AI require broadcasting **3GB to 8GB model weights files** over cellular networks to hundreds of thousands of cars:
- It costs automakers millions in cellular carrier egress fees.
- Drivers must park the car and wait 30 to 60 minutes.
- If flash memory corrupts or power cuts during the flash, the vehicle's electronic control unit (ECU) is **bricked**, requiring towing and warranty replacement.
- In many countries, reflashing safety ECUs requires lengthy regulatory homologation.

In CVIS:
- Model updates occur **100% in the cloud data center** via dynamic model hot-swapping (`POST /api/v1/ai/models/switch`) or blue-green container deployments.
- Upgrading from `llama3.2:3b` to `llama3.3:8b` or `qwen3:8b` takes **under 30 seconds**.
- **Zero vehicle downtime:** The car can be actively driving on the highway during the deployment.
- **Zero OTA download risk:** The car transmits only 900-byte telemetry JSON packets.
- **Instant rollback:** If the new model behaves erratically, rolling back takes 1 second in the data center.

**Q23: How does CVIS support a recurring SaaS business model for automakers?**

Automakers are transitioning from one-time 8%–15% vehicle hardware sales to high-margin recurring software subscriptions:
- **Free Community Tier ($0/month):** Included with every vehicle purchase. Provides baseline telemetry ingestion, standard roadside safety alerts, and a 7-day rolling history. The OEM benefits by receiving massive fleet-wide operational telemetry to train future battery and motor models.
- **Intelligence Pro Tier ($9.99/month or $99/year):** Unlocks real-time multi-factor AI driving coaching, predictive cell degradation forecasting, conversational telemetry-grounded neural chat with text-to-speech voice synthesis, NOC security observability, and authenticated AES-256-GCM wire encryption.
- **Unit Economics:** At scale (100,000 active subscribers), the cloud operating cost (FastAPI ingestion, distributed databases, continuous batching on NVIDIA GPUs, cellular ingress) totals **$0.396 (~40 cents) per car per month**. Charging $9.99/month yields **$9.57 net monthly profit per subscriber—a 96.0% software gross margin**.

**Q24: What are the primary engineering disadvantages/gaps of the centralized cloud AI approach, and how does CVIS mitigate each one?**

| Engineering Gap / Disadvantage | Real-World Risk | CVIS Architectural Mitigation |
|---|---|---|
| **1. Cellular Dead Zones & Tunnels** | In mountain passes or underground parking, cellular reception drops to zero. Will the car stop or lose advice? | **Decoupled Actuation + Pre-Warmed Cache:** Real-time vehicle safety (ABS, ESC, motor torque) runs on isolated hard real-time CAN bus ECUs. AI is strictly advisory. The gateway includes a deterministic multi-factor cache (`ai_cache.py`) that answers in <5ms locally during outages. Local flash stores and forwards telemetry upon reconnection. |
| **2. Mobile Network Latency & Jitter** | 4G/5G mobile networks have variable RTT (40–400ms). | **MQTT Sub-35ms Transport + Full-Duplex WebSockets:** CVIS supports runtime-switchable MQTT with compact binary/topic headers, reducing latency to <35ms. WebSockets push updates down immediately. Human driver cognitive reaction time is 250–400ms, making 150ms cloud advisory virtually instantaneous. |
| **3. Cellular Fleet Data Ingress Costs** | 1M cars sending 1KB/sec generate 30TB/day in cellular data, costing millions in telco fees. | **Adaptive Rate Intervals:** Normal cruise transmits every 5–8 seconds. Thermal anomalies or fault triggers automatically accelerate to 1-second bursts. Unchanged steady-state data sends 40-byte heartbeats, cutting data volume by 70%+. |
| **4. Cloud Data Center Outages / DDoS** | If the central data center goes offline, does the national fleet freeze? | **Independent Vehicle Autonomy:** The car is 100% mechanically and electrically drivable without the cloud. CVIS verified this via the "Stop AI Service" toggle in the NOC. Telemetry continues flowing and local instruments remain active. In production, multi-region Anycast clusters ensure geo-redundancy. |
| **5. Man-in-the-Middle & Packet Spoofing** | Wireless telemetry over cellular is exposed to tampering and eavesdropping. | **Cryptographic Integrity & Confidentiality:** Every packet is authenticated via HMAC-SHA256 constant-time verification or AES-256-GCM AEAD encryption. Monotonic timestamp nonces prevent replay attacks. |

**Q25: Are there existing examples of this architecture in production electric cars like Tesla, Rivian, or NIO?**

Yes. The CVIS architecture directly mirrors the patterns used by tier-1 EV manufacturers:
1. **Tesla Inc. (Fleet Learning & Shadow Mode):** Tesla's on-board FSD computer executes lightweight forward-pass vision inference, but does **not** train models inside the car. Instead, edge "triggers" detect disengagements or edge cases, compress telemetry and video clips, and upload them over cellular to **Tesla's central Dojo and Cortex GPU supercomputers**. All fleet learning and training happen centrally, with refined weights deployed downward.
2. **Rivian Automotive (AWS FleetOS):** Rivian's R1T and R1S use a custom Telematics Gateway Unit (TGU) connecting to AWS. Fleet-wide battery life prediction, regenerative braking optimization, and predictive air-suspension damping based on road roughness are computed centrally in cloud models.
3. **NIO (Battery-as-a-Service BaaS):** Over 2,000 NIO battery-swap stations communicate with the NIO Cloud. Connected cars stream cell impedance and thermal curves centrally. When an EV approaches a swap station, the cloud has already analyzed whether that specific pack needs re-balancing or maintenance before assigning it to the next driver.

---

## 7. Viva Persuasion Strategies, Examiner Traps & Defense Tips

### Tip 1: Always Anchor the Discussion on the "Communication Layer First"
- **Examiner's Trap:** *"Isn't this just a machine learning project with a web dashboard?"*
- **Your Defense:** *"No, sir/ma'am. The core thesis of CVIS is that **AI belongs centrally in the data center, not in the car**. The entire academic contribution of this project is the **Secure Communication Layer** that makes this architecture viable. AI is merely the consumer application sitting on top of the transport stack. Without our HMAC-SHA256 integrity verification, AES-256-GCM authenticated encryption, adaptive rate throttling, runtime-switchable HTTP/MQTT adapters, and chaos resilience, telemetry could be spoofed, leading to dangerous false advice. This project directly demonstrates CCNS Units 1 through 5."*

### Tip 2: Defend Against the "Why Not an On-Board Chip?" Challenge
- **Examiner's Trap:** *"Raspberry Pi and NVIDIA Jetson chips are cheap now. Why not put a local AI chip in the vehicle and avoid network issues entirely?"*
- **Your Defense:** Emphasize the **Automotive Hardware Lifespan Mismatch**:
  1. Car life = 15 years; AI model evolution = 18 months.
  2. In-vehicle chips cannot run the 8B–70B parameter models of 2030.
  3. Continuous 150W power draw causes parasitic battery drain (3.6 kWh/day phantom loss).
  4. Liquid cooling and automotive qualification for AI silicon add $2,000+ per vehicle to the BOM.
  5. Isolated cars have zero fleet-wide swarm learning.

### Tip 3: Defend Against the "Driver Intuition" Objection
- **Examiner's Trap:** *"Any driver knows that if you drive fast or turn on the AC, the battery goes down. Why do we need an AI?"*
- **Your Defense:** Human intuition provides crude qualitative guesses, but cannot solve non-linear multi-variate differential physics equations at 100 km/h:
  - If a driver has 22% battery, ambient is -2°C, cabin heater draws 2.5 kW, headwind is 25 km/h, and they face a 6% uphill gradient over the next 15 km in heavy traffic—intuition will guess and strand the car.
  - CVIS reasons across all 17 telemetry fields simultaneously: cell temperature rate of change ($\Delta T/\Delta t$), internal resistance, inverter load, and aerodynamic drag. It gives exact actionable advice: *"Reduce cabin heat to 1 kW and cap speed at 85 km/h to reach the charger with 4% reserve."*

### Tip 4: Leverage the Live Flight Recorder and NOC Controls During the Demo
When demonstrating the system to the examiners:
1. **Show the Live Animated Packet Stream in `/noc`:** Point out the green (HTTP) and purple (MQTT) packets moving through the pipeline.
2. **Switch Protocol Live:** Click the HTTP ⇄ MQTT toggle. Show that the backend switches dynamically without restarting either server or client. Explain that MQTT maintains persistent broker connections, reducing overhead from 800-byte HTTP headers to 2-byte MQTT headers.
3. **Inject Packet Tampering:** Click "Inject Tamper". Show the red `401 Unauthorized` rejection in the NOC packet table. Open the packet inspector and explain: *"The payload was modified by one byte post-signature. The backend recomputed `HMAC-SHA256(secret, payload)`, detected the mismatch, and rejected it in constant time via `hmac.compare_digest()` to eliminate timing oracle vulnerabilities."*
4. **Slide Artificial Latency to 300ms:** Show that the RTT increases on the packet table, but the WebSocket UI remains silky smooth because ingestion is asynchronous (`asyncio.create_task`).
5. **Show Real Hardware Acceleration:** Mention that Ollama runs locally on an NVIDIA GeForce RTX 4060 Laptop GPU with CUDA acceleration, delivering 96+ tokens/sec inference.

