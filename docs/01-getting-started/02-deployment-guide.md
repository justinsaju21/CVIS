# CVIS Homeserver Deployment Guide
*Last updated: 2026-09-08 — reflects live production deployment*

> **Current live URLs:**
> - Frontend: `https://cvis.justinsaju.me`
> - Backend API: `https://api-cvis.justinsaju.me`
> - Swagger docs: `https://api-cvis.justinsaju.me/docs`

---

## Architecture Summary

```
ESP8266 (USB-flashed) ──HTTP──► api-cvis.justinsaju.me (Cloudflare)
                                          │
                               Cloudflare Zero Trust Tunnel
                                          │
                               Debian Homeserver 192.168.1.8
                                ├─ cvis-backend  (PM2, port 8005)
                                └─ cvis-frontend (PM2, port 3001)
```

- **No open ports on the router.** Cloudflare Tunnel (`cloudflared`) maintains an outbound tunnel from the homeserver to Cloudflare's edge. This works through CGNAT/double NAT.
- **Backend runs on port 8005** (not 8000 — this is the live config).
- **Frontend runs on port 3001** (Next.js production build, not dev server).
- **PM2** manages both processes with auto-restart on crash/reboot.

---

## 1. Deploying Code Changes

### Frontend + Backend change (most common):
```bash
# On Windows laptop:
git commit -am "your message"
git push

# On homeserver (SSH):
ssh justin@192.168.1.8
cd ~/CVIS
git pull
pm2 restart cvis-backend        # Python restart is instant

cd frontend
npm run build                   # ~30 seconds
pm2 restart cvis-frontend
```

### Backend-only change (Python files):
```bash
ssh justin@192.168.1.8
cd ~/CVIS && git pull && pm2 restart cvis-backend
```

### Firmware change:
- Edit `firmware_esp8266/firmware_esp8266.ino` on your laptop
- Open in **Arduino IDE**, select board = **Generic ESP8266 Module**, correct COM port
- Click **Upload**
- Firmware updates don't go through git — they flash directly over USB

---

## 2. Checking Status

```bash
# SSH into homeserver
ssh justin@192.168.1.8

# See all PM2 processes (both should show 'online')
pm2 list

# Live logs (press Ctrl+C to exit)
pm2 logs cvis-backend
pm2 logs cvis-frontend

# Quick health check
curl http://localhost:8005/health
```

Expected `pm2 list` output:
```
│ 3 │ cvis-backend  │ online │ ...
│ 1 │ cvis-frontend │ online │ ...
```

---

## 3. Environment Configuration

### Backend `.env` (at `~/CVIS/backend/.env`):
```env
LOG_LEVEL=info
HOST=0.0.0.0
PORT=8005
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_TIMEOUT_S=20
```

### Frontend `.env` (at `~/CVIS/frontend/.env`):
```env
NEXT_PUBLIC_API_URL=https://api-cvis.justinsaju.me
NEXT_PUBLIC_WS_URL=wss://api-cvis.justinsaju.me/ws
```

> **Important:** `wss://` not `ws://` — Cloudflare upgrades WebSocket connections to secure.

---

## 4. Ollama AI Setup (Homeserver)

Ollama runs directly on the homeserver (not a friend's laptop — that was an earlier approach that was replaced):

```bash
# Check if running
curl http://localhost:11434/api/tags

# Start if not running
ollama serve &

# Pull model if not already downloaded
ollama pull llama3.2:3b
```

Verify AI is detected by backend:
```
curl https://api-cvis.justinsaju.me/api/v1/ai/status
```

---

## 5. Mosquitto MQTT Broker (Homeserver)

```bash
# Check status
sudo systemctl status mosquitto

# Start
sudo systemctl start mosquitto

# Enable on boot
sudo systemctl enable mosquitto
```

MQTT is on port 1883 (LAN only — not exposed via Cloudflare). The backend connects to `localhost:1883` internally.

---

## 6. Cloudflare Tunnel

The `cloudflared` tunnel is what makes the homeserver reachable from the internet without port forwarding.

```bash
# Check tunnel status
sudo systemctl status cloudflared

# Restart if needed
sudo systemctl restart cloudflared
```

The tunnel config maps:
- `api-cvis.justinsaju.me` → `http://localhost:8005`
- `cvis.justinsaju.me` → `http://localhost:3001`

---

## 7. Firewall (UFW)

```bash
# Allow MQTT from LAN only (already configured)
sudo ufw allow from 192.168.1.0/24 to any port 1883

# Allow SSH
sudo ufw allow ssh

# Status
sudo ufw status
```

Ports 8005 and 3001 are **not** open on UFW — Cloudflare Tunnel connects internally without needing exposed ports.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| Frontend shows blank / can't connect to API | Check `pm2 logs cvis-backend` — restart if crashed |
| ESP8266 gets `HTTP -1` | Check `BACKEND_HOST` in `secrets.h` — should be `api-cvis.justinsaju.me` |
| AI recommendations not appearing | `curl http://localhost:11434/api/tags` — run `ollama serve` if empty |
| MQTT packets not arriving | `sudo systemctl start mosquitto` |
| Changes not appearing after push | Did you run `npm run build && pm2 restart cvis-frontend`? |
| `pm2 list` shows `errored` | `pm2 logs <name>` to see the error, then fix and `pm2 restart <name>` |
| Cloudflare 502/504 | Tunnel is down — `sudo systemctl restart cloudflared` |

---

## 9. PM2 Startup on Reboot

Both services are configured to restart automatically:

```bash
# If PM2 loses its startup config after OS upgrade:
pm2 startup
# (copy and run the command PM2 prints)
pm2 save
```
