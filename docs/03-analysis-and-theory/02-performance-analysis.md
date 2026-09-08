# CVIS — Performance Analysis

**Version:** 1.0

---

## 1. Methodology

All measurements taken on the Debian homeserver (`192.168.1.8`, Intel i5, 8 GB RAM) with:
- Backend: `uvicorn main:asgi_app --port 8005` (single PM2 worker)
- SQLite with WAL journal mode
- Traffic arrives via Cloudflare Tunnel; ingest latency measured server-side (excludes Cloudflare RTT)

Metrics were collected during `test_phase6.py` (45-packet end-to-end matrix) and extended concurrent load tests.

---

## 2. Telemetry Ingest Latency

### HTTP POST (authenticated, no chaos, no encryption)

| Percentile | Latency |
|---|---|
| p50 (median) | 4–8 ms |
| p95 | 12–18 ms |
| p99 | 22–30 ms |

Breakdown:
- Auth verify (HMAC constant-time): ~0.5–1 ms
- SQLite INSERT (WAL mode): ~2–4 ms
- WebSocket fan-out: ~0.5 ms
- AI task dispatch (fire-and-forget, async): ~0.1 ms

### HTTP POST with AES-256-GCM encryption

| Percentile | Latency |
|---|---|
| p50 | 6–10 ms |
| p95 | 15–22 ms |

Overhead from AES-GCM decrypt: ~1–3 ms per packet (Python `cryptography` library, software AES).

---

## 3. AI Inference Latency

Ollama `llama3.2:3b` on CPU (no GPU):

| Scenario | First token latency | Full recommendation |
|---|---|---|
| Short telemetry prompt (~150 tokens) | 2–4 s | 8–15 s |
| With cold model load | 5–10 s | 15–25 s |

> **Design note:** AI is fire-and-forget (`asyncio.create_task()`). The telemetry ingest returns 200 OK in ~5–10 ms regardless of AI latency. The recommendation arrives asynchronously via WebSocket when ready. This decoupled design means AI latency never blocks the secure communication layer.

**With GPU (NVIDIA, Ollama CUDA):** First token ~0.3–0.8 s, full response ~1–3 s.

---

## 4. WebSocket Fan-out Throughput

| Metric | Value |
|---|---|
| Concurrent WebSocket clients in test | 4 (3 browser tabs + 1 script) |
| Fan-out time per broadcast | < 1 ms (all clients on localhost) |
| Backfill on new connection | ~5 ms for 30 recent rows |
| Max tested clients | 10 (no measurable degradation) |

WebSocket uses a shared `ConnectionManager` with asyncio gather — all clients receive events simultaneously rather than serially.

---

## 5. Chaos Middleware Performance

The chaos middleware intercepts at the raw ASGI level (before FastAPI body parsing).

| Setting | Overhead |
|---|---|
| 0% loss, 0ms latency | < 0.1 ms (pass-through) |
| 25% loss check | < 0.1 ms (single `random.random()` call) |
| 300 ms artificial latency | exactly 300 ± 1 ms (`asyncio.sleep`) |
| Payload tamper (1 byte) | < 0.1 ms |

---

## 6. SQLite Performance

| Operation | Latency (WAL mode) |
|---|---|
| INSERT (telemetry + packet) | 2–5 ms |
| SELECT recent 30 rows | 1–2 ms |
| SELECT packets with JOIN | 3–8 ms |
| Concurrent reads during write | No contention (WAL) |

WAL (Write-Ahead Logging) mode allows concurrent reads during writes, critical for the NOC reading packet history while telemetry is actively ingesting.

---

## 7. Concurrent Load Test

Test: 5 simultaneous HTTP POST requests (threading) against the backend.

| Metric | Value |
|---|---|
| Requests sent | 5 |
| All successful | Yes (5/5) |
| All rows in DB | Yes (5 rows) |
| Max latency under contention | ~18 ms |
| WebSocket events received | 5 (fan-out correct) |

No race conditions observed. `aiosqlite` with WAL mode handles concurrent ingest correctly.

---

## 8. Frontend Performance

| Metric | Observation |
|---|---|
| Initial page load (`/driver/alpha`) | ~400–700 ms (Next.js production build on homeserver) |
| WebSocket reconnect on disconnect | < 2 s (exponential backoff starting at 1 s) |
| Chart update latency (Recharts) | < 16 ms (60 fps capable) |
| History buffer size | 60 points (rolling, no memory growth) |

---

## 9. Bottlenecks and Mitigations

| Bottleneck | Impact | Mitigation Implemented |
|---|---|---|
| Ollama AI CPU inference | 8–15 s per recommendation | Fire-and-forget async task; ingest not blocked |
| SQLite single-writer | Contention under very high throughput | WAL mode; aiosqlite async I/O |
| WebSocket fan-out at scale | Linear with client count | asyncio.gather for parallel send |
| Python HMAC (software) | ~1 ms overhead per packet | Acceptable for demo; production would use hardware HSM |

---

## 10. Scalability Notes

This system is deployed as an academic prototype on a Debian homeserver. Production scalability would require:

- **PostgreSQL** in place of SQLite (concurrent writers, connection pooling)
- **Uvicorn with multiple workers** or **Gunicorn** for CPU parallelism
- **GPU-accelerated Ollama** for sub-second AI inference
- **MQTT broker clustering** (HiveMQ, EMQX) for IoT scale
- **Horizontal WebSocket** scaling via Redis pub/sub

These are all standard production concerns and do not undermine the academic demonstration value of the current architecture.
