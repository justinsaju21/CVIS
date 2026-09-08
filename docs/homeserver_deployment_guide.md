# CVIS Homeserver Deployment Guide

When migrating the CVIS backend and frontend from your laptop to your homeserver (Scenario B), here is the comprehensive checklist of everything you must configure.

## 1. Network & IP Configuration
Since the backend will now live on the homeserver, the ESP8266 needs to know its new address.
- **Static IP:** Assign a static IP address to your homeserver on your local router (e.g., `192.168.1.100`) so it never changes.
- **Firmware Update:** Update `firmware_esp8266/secrets.h` and change `BACKEND_HOST` to your homeserver's static IP. Flash the ESP8266 again.

## 2. Firewall Rules (Homeserver)
Your homeserver must allow inbound traffic on the specific ports CVIS uses, otherwise the ESP8266 will get `HTTP -1` (Connection Refused).
If it's a Windows homeserver, run this in PowerShell as Administrator:
```powershell
New-NetFirewallRule -DisplayName "CVIS Backend" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "CVIS MQTT" -Direction Inbound -LocalPort 1883 -Protocol TCP -Action Allow
```
*(If it's Linux/Ubuntu, use `sudo ufw allow 8000/tcp` and `sudo ufw allow 1883/tcp`).*

## 3. MQTT Broker (For Phase 2 Grading)
Since the ESP8266 needs to switch to MQTT on command, the homeserver **must** run an MQTT broker.
- **Windows:** Download and install [Eclipse Mosquitto](https://mosquitto.org/download/).
- **Linux:** Run `sudo apt install mosquitto mosquitto-clients`.
- **Config:** Ensure the broker binds to `0.0.0.0` (all interfaces) so the ESP8266 can reach it from the network.

## 4. Remote AI Setup (The Cloudflare Tunnel)
Because your homeserver has RAM limitations, your friend's laptop will run Ollama locally and expose it securely via `cloudflared`.

1. **On your friend's laptop:** 
   Run Ollama and start the persistent Cloudflare tunnel pointing to `localhost:11434`. (They will get a URL like `https://cvis-ai.trycloudflare.com`).
2. **On your homeserver:** 
   Create a `.env` file inside the `backend/` folder and add the following line, replacing the URL with the one your friend generated:
   ```env
   OLLAMA_BASE_URL=https://cvis-ai.trycloudflare.com
   ```
   The FastAPI backend will now route all AI inference requests over the internet to your friend's laptop, completely bypassing your homeserver's RAM limits.

## 5. Starting the Services
On the homeserver, you will run the exact same commands you did on the laptop.

**Backend:**
```bash
cd backend
# Activate virtual environment (venv\Scripts\activate on Windows, source venv/bin/activate on Linux)
uvicorn main:asgi_app --host 0.0.0.0 --port 8000
```
*(Make sure `--host 0.0.0.0` is used so it accepts external connections).*

**Frontend:**
```bash
cd frontend
npm install
npm run build
npm start
```
*(Using `build` and `start` instead of `dev` is highly recommended on a server for performance).*

> **Autostart Tip:** To make this robust, consider using **PM2** (Node.js) or creating a **Systemd Service** (Linux) / **Task Scheduler** (Windows) to automatically start the Python backend, the Next.js frontend, and the Mosquitto broker if the homeserver reboots.
