# Distributed AI Architecture (Scenario B)

This document outlines the deployment strategy where the core CVIS infrastructure is hosted on a local homeserver, while the heavy AI inference (Ollama) is offloaded to a remote machine (a laptop at a different location) using secure tunneling.

## The Architecture

1.  **The Homeserver (Low RAM/Compute)**
    *   **Runs:** FastAPI Backend, Next.js Frontend, ESP32 Simulator, SQLite Database.
    *   **Role:** Acts as the central Web/Comms Tier. Handles all WebSocket connections, MQTT/HTTP protocol routing, cryptography, and UI rendering.

2.  **The Remote AI Node (High RAM/GPU - e.g., Friend's Laptop in College)**
    *   **Runs:** Ollama (specifically running `llama3.2:3b` or `phi3-mini` as per the `AGENTS.md` contract).
    *   **Role:** Acts as the dedicated AI Compute Tier. Receives telemetry data, runs the LLM inference, and returns natural language safety recommendations.

3.  **The Tunnel (The Bridge)**
    *   **Runs:** Cloudflare Tunnels (`cloudflared`) on the Remote AI Node.
    *   **Role:** Securely exposes the local Ollama port (`11434`) to the public internet via a permanent, stable URL (e.g., `https://ai.yourdomain.com`). The tunnel service can be toggled on/off dynamically by the host when AI inference is needed, preventing unnecessary resource drain.

## Implementation Steps

### Step 1: Set up the Remote AI Node (Friend's Laptop)
1. Install and start Ollama locally.
2. Install `cloudflared` and authenticate it with your Cloudflare account.
3. Start the permanent tunnel routing to Ollama:
   ```bash
   cloudflared tunnel run <tunnel-name>
   ```
4. Copy the permanent HTTPS URL you configured (e.g., `https://ai.yourdomain.com`). When the AI model isn't needed, you simply stop the `cloudflared` process.

### Step 2: Configure the Homeserver Backend
1. In the FastAPI backend configuration (e.g., `.env` or settings), update the AI service endpoint.
2. Change the default `http://localhost:11434` to the secure tunnel URL provided by the remote node.
3. Restart the FastAPI backend.

## Academic & Technical Justification
This distributed setup significantly strengthens the project for a CCNS (Computer Communication & Network Security) evaluation:
*   **Scalability:** Demonstrates a microservices-style approach by offloading heavy ML workloads to a dedicated compute node.
*   **Resource Management:** Proves the system can run on constrained edge hardware (homeserver) by delegating processing power.
*   **Network Traversal:** Showcases secure tunneling and cross-network communication between distributed systems over the public internet.
