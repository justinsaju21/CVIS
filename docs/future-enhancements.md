# CVIS Future Enhancements

If we decide to expand the scope of the project without breaking the existing architecture, the following features are excellent, safe additions that strongly align with the CCNS (Computer Communication & Network Security) syllabus.

## 1. DDoS Simulation & Rate Limiting (Security)
*   **The Feature:** Add a "Simulate DDoS Attack" button to the NOC. When clicked, a script blasts the backend with hundreds of invalid packets per second.
*   **The Defense:** Add a "Enable Rate Limiting" toggle. When ON, the FastAPI backend uses middleware to track incoming requests per IP/Device ID and starts dropping packets with a `429 Too Many Requests` status if they exceed 10 packets a second.
*   **Academic Value:** Perfectly demonstrates network defense mechanisms and application-layer security against volumetric attacks.

## 2. Live Bandwidth / Overhead Comparison (Networking)
*   **The Feature:** Add a live line-chart in the NOC showing **Bytes per Second (Throughput)**. 
*   **Academic Value:** Visually proves the core difference between HTTP and MQTT. HTTP throughput will spike higher due to headers and TCP handshakes, while MQTT throughput will remain low. Proves MQTT's efficiency for IoT networks.

## 3. Fleet-Wide AI Anomaly Detection (AI & Big Data)
*   **The Feature:** Add a "Run Fleet Diagnostics" button. This grabs the latest packet from *all 4 cars at once* and asks Ollama to analyze the fleet for systemic issues (e.g., "Are multiple cars experiencing high temps in the same area?").
*   **Academic Value:** Proves the core thesis of the project: that centralizing AI in the cloud allows for macro-level pattern recognition across the entire network, which embedded edge AI cannot do.

## 4. Dynamic API Key Rotation (Security)
*   **The Feature:** Add a "Force Key Rotation" button that invalidates the current `device_secret` for a specific car.
*   **Academic Value:** Demonstrates advanced session management, zero-trust security principles, and automated re-provisioning. The car will fail authentication (red `FAIL` in NOC) until it negotiates a new key.

## 5. Geo-Fencing / Network Zones (Networking)
*   **The Feature:** Add simulated GPS coordinates (Lat/Long) to the telemetry payload. In the NOC, define a "Geo-Fence".
*   **Academic Value:** If a car's coordinates drift outside the allowed network zone, the backend automatically drops its packets or triggers an AI alert for "Unauthorized Vehicle Movement."
