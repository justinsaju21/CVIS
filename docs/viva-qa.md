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
