"""
CVIS Backend — main.py
-----------------------
FastAPI application entry point.

Phase 2+ additions:
- ChaosMiddleware added before routing
- MQTT adapter started in background (graceful if Mosquitto not running)
- New routers: devices, config, ai, admin
- Chaos settings restored from DB on startup
- Ollama HTTP client closed on shutdown
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db import init_db, close_db, get_config
from middleware.chaos import ChaosMiddleware, chaos_config
from routers import telemetry as telemetry_router
from routers import ws as ws_router
from routers import devices as devices_router
from routers import config as config_router
from routers import ai as ai_router
from routers import admin as admin_router
from routers import control as control_router

# ─── Logging ───────────────────────────────────────────────────────────────
logging.basicConfig(
    level=settings.LOG_LEVEL.upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("cvis.main")


# ─── MQTT telemetry handler (bridges into ingest service) ─────────────────
async def _handle_mqtt_telemetry(topic: str, payload_str: str) -> None:
    """
    Called by the MQTT adapter for each cvis/telemetry/+ message.
    Parses auth metadata from the MQTT envelope and calls the shared ingest service.
    """
    import json
    import auth as auth_module
    from services.telemetry_service import ingest_telemetry_data

    try:
        data = json.loads(payload_str)
    except json.JSONDecodeError as e:
        logger.warning(f"[MQTT] Malformed JSON on topic {topic}: {e}")
        return

    # Extract _meta auth fields
    meta           = data.pop("_meta", {})
    api_key        = meta.get("api_key")
    hmac_signature = meta.get("hmac")

    # Encrypted envelope
    encrypted = data.pop("encrypted", False)
    iv        = data.pop("iv",  None)
    ct        = data.pop("ct",  None)
    tag       = data.pop("tag", None)

    # Re-serialise the canonical payload (without _meta)
    raw_json = json.dumps(data)

    try:
        await ingest_telemetry_data(
            raw_json,
            protocol="mqtt",
            source_ip=topic,
            api_key=api_key,
            hmac_signature=hmac_signature,
            encrypted=encrypted,
            iv=iv,
            ct=ct,
            tag=tag,
            auth_enabled=auth_module.is_auth_enabled(),
        )
    except ValueError as e:
        logger.warning(f"[MQTT] Ingest rejected on {topic}: {e}")


# ─── Lifespan ──────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("=== CVIS Backend starting (Phase 2) ===")
    await init_db()

    # Restore chaos settings from DB
    try:
        chaos_config.loss_pct      = int(await get_config("chaos_loss_pct")   or "0")
        chaos_config.latency_ms    = int(await get_config("chaos_latency_ms") or "0")
        chaos_config.tamper_enabled = (await get_config("chaos_tamper") or "false") == "true"

        import auth as auth_module
        auth_enabled = (await get_config("auth_enabled") or "true") == "true"
        auth_module.set_auth_enabled(auth_enabled)

        from replay_protection import set_replay_protection_enabled
        replay_enabled = (await get_config("replay_protection") or "false") == "true"
        set_replay_protection_enabled(replay_enabled)
    except Exception as e:
        logger.warning(f"[STARTUP] Failed to restore config: {e}")

    # Start MQTT adapter (non-fatal if broker not running)
    from comms.mqtt_adapter import mqtt_adapter
    loop = asyncio.get_event_loop()
    mqtt_adapter.set_telemetry_handler(_handle_mqtt_telemetry)
    mqtt_started = mqtt_adapter.start(loop)
    if not mqtt_started:
        logger.warning("[STARTUP] MQTT adapter inactive — start Mosquitto broker to enable MQTT")

    yield

    # Shutdown
    logger.info("=== CVIS Backend shutting down ===")
    mqtt_adapter.stop()
    from ai.ollama_client import close_http_client
    await close_http_client()
    await close_db()


# ─── FastAPI app ───────────────────────────────────────────────────────────
app = FastAPI(
    title="CVIS — Connected Vehicle Intelligence System",
    description=(
        "Backend for the CVIS academic project. "
        "Receives telemetry from ESP32 vehicle nodes via HTTP or MQTT, "
        "enforces HMAC-SHA256 / AES-GCM integrity, persists to SQLite, "
        "runs Ollama AI analysis, and fans out to frontend via WebSocket."
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ───────────────────────────────────────────────────────────────
app.include_router(telemetry_router.router)
app.include_router(ws_router.router)
app.include_router(devices_router.router)
app.include_router(config_router.router)
app.include_router(ai_router.router)
app.include_router(admin_router.router)
app.include_router(control_router.router)

# ─── Health check (on FastAPI app, before ASGI wrap) ─────────────────────
@app.get("/health", tags=["system"])
async def health() -> dict:
    from ws_manager import manager
    return {
        "status": "ok",
        "service": "CVIS Backend",
        "phase": 2,
        "version": "2.0.0",
        "websocket_clients": manager.connection_count,
    }


# ─── Chaos middleware ASGI wrap ────────────────────────────────────────────
# Wraps the fully-configured FastAPI app so the raw ASGI receive() is
# intercepted before FastAPI's body caching. Use 'asgi_app' in uvicorn:
#   uvicorn main:asgi_app --reload
asgi_app = ChaosMiddleware(app)


# ─── Dev entry point ───────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(
        "main:asgi_app",
        host=settings.HOST,
        port=settings.PORT,
        log_level=settings.LOG_LEVEL,
        reload=False,   # reload=True incompatible with non-FastAPI entry point
    )
