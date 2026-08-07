# CVIS Security Analysis

## Overview

This document analyses the security properties of the CVIS communication layer, the attack surface, defences implemented, and residual risks. Every claim maps to a concrete implementation in the codebase.

---

## 1. Security Properties Implemented

### 1.1 Authentication — API Key per Device

- **What:** Each registered ESP32 device is issued a 64-character (32-byte) random API key at registration.
- **Storage:** Backend stores SHA-256(api_key) only — the plaintext is shown once and never recoverable.
- **Transport:** Sent in the `X-API-Key` HTTP header on every request, or in the `_meta.api_key` field of MQTT envelopes.
- **Verification:** The backend looks up the SHA-256 hash; timing is not a concern since hash lookup is constant-time per SQLite index scan.
- **Code:** [`backend/crypto.py`](../backend/crypto.py) — `hash_api_key()`, [`backend/auth.py`](../backend/auth.py) — `require_api_key()`
- **CCNS:** Unit 4 — Authentication, Device Identity

### 1.2 Message Integrity — HMAC-SHA256

- **What:** Every payload is signed with HMAC-SHA256 using the device_secret (32 bytes, never transmitted after registration).
- **Coverage:** HMAC covers the entire plaintext JSON body, in transmission order.
- **Verification:** Constant-time comparison via `hmac.compare_digest()` — prevents timing oracle attacks.
- **Failure mode:** HMAC mismatch → 401 Unauthorized + `tamper_detected` event logged in auth_logs.
- **Code:** [`backend/crypto.py`](../backend/crypto.py) — `compute_hmac()`, `verify_hmac()`
- **CCNS:** Unit 4 — Message Authentication Codes, Hash Functions

### 1.3 Confidentiality + Integrity — AES-256-GCM

- **What:** Optional payload encryption using AES-256-GCM (AEAD — provides both confidentiality and integrity in one operation).
- **Key:** device_secret (32 bytes) reused as the AES-256 key — same secret, different usage mode.
- **IV:** Fresh 96-bit (12-byte) random IV generated per packet via `os.urandom()` (ESP32: `esp_random()`). IV reuse with the same key would be catastrophic — this is enforced by construction.
- **Tag:** 128-bit GCM authentication tag. Backend uses Python `cryptography` library `AESGCM.decrypt()` which raises `InvalidTag` on failure.
- **Failure mode:** Tag mismatch → `InvalidTag` exception → 401 + `tamper_detected` logged.
- **Code:** [`backend/crypto.py`](../backend/crypto.py) — `aes_gcm_encrypt()`, `aes_gcm_decrypt()`
- **CCNS:** Unit 4 — Symmetric Encryption, Authenticated Encryption

### 1.4 Replay Protection

- **What:** Timestamp-window deduplication. The same `(device_id, timestamp_ms)` pair is rejected if seen more than once.
- **Window:** In-memory bounded set, entries evicted after 2× the window (default 60 seconds). Restarts clear the set (acceptable for demo; production would use Redis).
- **Failure mode:** Duplicate pair → `REPLAY:` ValueError → 401 + `tamper_detected` logged.
- **Enabled by:** NOC or admin via `POST /api/v1/config/replay {"enabled": true}`. Off by default until the communication layer is stable.
- **Code:** [`backend/replay_protection.py`](../backend/replay_protection.py)
- **CCNS:** Unit 4 — Replay Attack Prevention, Protocol Freshness

### 1.5 Session Management (Frontend)

- Frontend authenticates via role-based routing — no RBAC infrastructure required for prototype.
- Backend admin endpoints are not auth-gated in the prototype (no frontend auth yet). **TODO Phase 6:** Add Bearer token or session cookie for admin/NOC endpoints before demo.

---

## 2. Attack Surface Analysis

| Attack Vector | Implemented Defence | Residual Risk |
|---|---|---|
| **Spoofed packet (wrong device)** | API key verification → 401 | Brute-force: 2^256 search space — infeasible |
| **Packet tampering (in transit)** | HMAC-SHA256 → 401 + log | None while HMAC key is secret |
| **Replay attack** | Timestamp-window deduplication → 401 | ESP32 millis() wraps at ~49 days; window covers this |
| **Eavesdropping / sniffing** | AES-256-GCM (when enabled) | Disabled by default; enable for production |
| **Forged HMAC** | Constant-time verify prevents timing oracle | None |
| **Credential theft** | API key hashed in DB, device_secret never re-transmitted | Lost key requires re-registration |
| **Denial of Service** | Not in scope for academic prototype | No rate limiting implemented |
| **SQL injection** | All DB queries use parameterised `?` placeholders | None via standard SQLite parametric queries |
| **MQTT broker spoofing** | MQTT runs on localhost — no external broker in demo | Production: TLS-MQTT + broker ACLs needed |
| **Backend admin endpoint access** | Not auth-gated in prototype | Frontend auth gates needed before production |

---

## 3. Chaos Simulation — Security Relevance

The chaos middleware (packet loss, latency, tamper injection) is not a security feature — it is a **demonstration tool** for showing the security layer working correctly under adverse conditions:

- **Tamper injection:** The middleware mutates a payload field after HMAC signing. The backend's HMAC verification detects this exactly as it would detect a real man-in-the-middle attack.
- **Packet loss:** Shows the ESP32 retry-with-backoff behaviour — analogous to UDP loss or TCP segment loss.
- **Latency:** Shows the RTT impact of network congestion — relevant to real-time command/control systems.

This approach is entirely legitimate for a CCNS demonstration and is explicitly approved in AGENTS.md §3.5.

---

## 4. Cryptographic Choices — Justification

| Choice | Justification |
|---|---|
| HMAC-SHA256 (not HMAC-MD5) | MD5 is cryptographically broken. SHA-256 is the current NIST standard. |
| AES-256-GCM (not AES-128-CBC) | GCM provides AEAD (no separate MAC needed). CBC requires padding and a separate MAC. 256-bit key provides 128-bit security against Grover's algorithm. |
| 96-bit GCM IV | NIST SP 800-38D recommended size for random IV with GCM. |
| Per-call fresh IV | IV reuse under the same key in GCM is catastrophic (allows key recovery). Fresh IV per packet is mandatory. |
| mbedTLS on ESP32 | Bundled with ESP32 Arduino SDK. FIPS-certified implementation. No additional library. |
| `hmac.compare_digest()` | Python's constant-time comparison for HMAC. Prevents timing-oracle attacks. |

---

## 5. Known Limitations (Acceptable for Academic Prototype)

1. **No TLS on HTTP layer** — Traffic is plaintext HTTP over LAN. For production, HTTPS with a valid certificate is required. In the demo environment, the LAN is trusted and the cryptographic layer (HMAC/AES-GCM) provides the integrity guarantee at the application layer.

2. **MQTT broker has no auth** — Mosquitto is running without ACLs or TLS. Production would require TLS-MQTT and per-client certificates.

3. **Replay window uses millis() not UTC** — Since ESP32 millis() resets to 0 on boot, a reset followed by re-sending would use the same timestamp_ms values. Mitigated by: (a) replay set clears on server restart, (b) device must re-authenticate after boot, (c) timestamps are only ~49-day unique.

4. **No backend admin auth** — Admin and NOC endpoints are not behind a login gate in the prototype. The first-priority TODO before live demo.

5. **In-memory replay set** — Lost on server restart. Redis would provide persistence. Acceptable for demo.
