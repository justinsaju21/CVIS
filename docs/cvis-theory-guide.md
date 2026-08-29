# CVIS: Network Security & Simulation Theory Guide

This document explains the core networking and cryptographic concepts demonstrated in the Connected Vehicle Intelligence System (CVIS). It is designed to help you understand *why* the system behaves the way it does, making it an excellent resource for exam preparation, viva questions, and project presentations.

---

## 1. Authentication (Who is sending the data?)
**Control:** `Auth Enforcement` toggle in the NOC.

### The Theory:
In a real-world IoT environment, servers receive millions of packets from the open internet. The server must verify that the packet came from a registered, legitimate vehicle (e.g., `ESP32-ALPHA`) and not a malicious hacker. 

### How CVIS Implements It:
- **API Keys:** When a vehicle is first registered, it is assigned a unique `device_id` and a long, random `API Key`. 
- **The Process:** Every time the vehicle sends a packet, it attaches its API Key in the HTTP Headers (as `X-API-Key`).
- **NOC Behavior:** 
  - When **Auth Enforcement is ON**, the backend checks this API key against the SQLite database. If it is missing or invalid (e.g., if you click **Disconnect Vehicle**, which deactivates the key), the backend instantly **rejects** the packet (`AUTH_FAIL`).
  - When **Auth Enforcement is OFF**, the backend ignores the API key and accepts data from anyone.

---

## 2. Data Integrity (Was the data changed in transit?)
**Control:** `Packet Tampering Injector` in the NOC.

### The Theory:
Even if a packet comes from a legitimate vehicle, a hacker could intercept it on the network (a "Man-in-the-Middle" attack) and alter the contents—for example, changing the vehicle's speed from `50 km/h` to `150 km/h`.

### How CVIS Implements It:
To prevent this, CVIS uses **HMAC-SHA256** (Hash-based Message Authentication Code).
- **The Secret:** The vehicle and the server share a cryptographic `device_secret` that is never sent over the network.
- **The Signature:** Before sending the data, the vehicle hashes the JSON payload combined with its secret to create a unique "signature" (e.g., `a4f8b9...`). It attaches this signature to the packet.
- **NOC Behavior (Tampering ON):** When you turn on the Tampering Injector, the simulator maliciously modifies the payload *after* the signature has been generated. When the server receives it, it calculates its own hash of the modified payload. Because the payload changed, the server's hash **does not match** the signature on the packet, and it raises a `tamper_detected` error.

---

## 3. Confidentiality (Can anyone read the data?)
**Control:** `AES-256-GCM Encryption` toggle in the NOC.

### The Theory:
While HMAC guarantees the data wasn't *changed*, it doesn't prevent hackers from *reading* it. Telemetry is sent in plain text, meaning anyone monitoring the network can see the vehicle's speed, location, and battery status.

### How CVIS Implements It:
To hide the data, CVIS uses **AES-256-GCM** (Advanced Encryption Standard in Galois/Counter Mode).
- **The Encryption:** The vehicle uses its `device_secret` as the AES key to scramble the JSON payload into unreadable ciphertext. 
- **The GCM Advantage:** GCM is special because it provides both Confidentiality (encryption) *and* Integrity (it generates an authentication tag, acting like HMAC).
- **NOC Behavior:** When AES is ON, you will see the Raw Payload in the Packet Inspector turn into unreadable base64 strings (`{"iv": "...", "ct": "...", "tag": "..."}`). If Auth Enforcement is OFF, the backend won't look up the AES key to decrypt it, which is why the packet gets rejected and shows up as `UNKNOWN` with `0 B` size!

---

## 4. Network Chaos (Packet Loss & Latency)
**Controls:** `Packet Loss` and `Artificial Latency` sliders in the NOC.

### The Theory:
Vehicles drive through tunnels, bad weather, and remote areas with poor cellular coverage. A robust backend must be able to handle network instability without crashing.

### How CVIS Implements It:
Instead of forcing you to use complex network-shaping software (like Linux `tc`), CVIS implements a **Chaos Middleware** directly in the FastAPI backend.
- **Artificial Latency:** The middleware pauses the incoming request (using `asyncio.sleep`) for a specified number of milliseconds (e.g., 300ms) before processing it. This simulates a slow 3G cellular connection.
- **Packet Loss:** The middleware rolls a random number. If you set Packet Loss to `25%`, there is a 1 in 4 chance the middleware will immediately drop the request and return an HTTP timeout/error, pretending the packet never arrived.
- **Real-world Effect:** You will see the Live Packet Flow animation stall, and the vehicle's telemetry will stop updating smoothly. The MQTT protocol handles this much better than HTTP because MQTT has built-in retry mechanisms!

---

## 5. Protocol Switching (HTTP vs MQTT)
**Control:** `Protocol` toggle in the NOC.

### The Theory:
- **HTTP (REST):** A heavy, "request-response" protocol. Every time the vehicle sends data, it must open a new TCP connection, send large headers, wait for the server to reply, and close the connection. It is reliable but consumes more battery and bandwidth.
- **MQTT:** A lightweight, "publish-subscribe" protocol designed specifically for IoT. The vehicle opens a single persistent TCP connection to a broker (like Mosquitto) and rapidly fires tiny messages. 

### How CVIS Implements It:
CVIS supports both simultaneously. When you switch protocols in the NOC, the backend updates a configuration flag. On the next polling cycle, the simulated vehicle detects the change and seamlessly switches from making HTTP `POST` requests to publishing to the MQTT `cvis/telemetry/ESP32-ALPHA` topic!
