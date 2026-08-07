"""
CVIS Backend — middleware/chaos.py
------------------------------------
Chaos/simulation middleware — packet loss, artificial latency, and tampering.

Design rationale: Simulating adverse network conditions at the middleware layer
is pedagogically equivalent to real network-layer manipulation for this demo
environment. The middleware intercepts every request to the telemetry endpoint
before the route handler runs, applying configured chaos parameters. This lets
the NOC demonstrate packet loss, latency, and tamper-detection live without
any external network tools.

Chaos effects:
  - Packet loss: probabilistically returns 503 before processing
  - Latency: asyncio.sleep() to simulate network delay
  - Tamper: mutates the raw request body AFTER it's received but BEFORE
    HMAC verification runs — this is how we demonstrate tamper detection.
    The HMAC signature in the header still reflects the original body,
    so verification fails and the backend logs 'tamper_detected'.

CCNS mapping:
  - Packet loss → Unit 3 (Reliability, Packet Loss in TCP/UDP)
  - Artificial latency → Unit 3 (RTT, Propagation Delay, Queuing Delay)
  - Tamper injection → Unit 4 (Integrity Violation, HMAC/AES-GCM detection)
"""

import asyncio
import json
import logging
import random
import time
from dataclasses import dataclass, field

from starlette.types import ASGIApp

logger = logging.getLogger("cvis.chaos")

# ─── Chaos configuration (mutable singleton) ─────────────────────────────

@dataclass
class ChaosConfiguration:
    loss_pct:       int   = 0      # 0, 5, 10, or 25
    latency_ms:     int   = 0      # 0, 100, 300, or 1000
    tamper_enabled: bool  = False

    # Metrics (updated live for admin view)
    total_requests:  int = field(default=0, repr=False)
    dropped_packets: int = field(default=0, repr=False)
    tampered_packets: int = field(default=0, repr=False)
    latency_added:   int = field(default=0, repr=False)  # total ms added


# Module-level singleton — imported by config router
chaos_config = ChaosConfiguration()


# ─── Tamper helper ────────────────────────────────────────────────────────

def _tamper_body(body_bytes: bytes) -> bytes:
    """
    Mutate a field in the JSON body to simulate packet tampering.
    The HMAC signature in the header still covers the ORIGINAL body,
    so HMAC verification will fail → 'tamper_detected' logged.
    """
    try:
        data = json.loads(body_bytes)
        # Flip a numeric field to an obviously wrong value
        if "battery_pct" in data:
            data["battery_pct"] = 999.9
        elif "speed_kmh" in data:
            data["speed_kmh"] = -1.0
        elif "fault_code" in data:
            data["fault_code"] = 0xFF
        tampered = json.dumps(data).encode("utf-8")
        logger.warning(f"[CHAOS] Payload tampered: {len(body_bytes)}B → {len(tampered)}B")
        return tampered
    except Exception:
        # If JSON parsing fails, corrupt the raw bytes directly
        return body_bytes + b"TAMPERED"


# ─── Middleware ───────────────────────────────────────────────────────────

class ChaosMiddleware:
    """
    Raw ASGI middleware that applies chaos simulation to
    /api/v1/telemetry POST requests only.

    Using raw ASGI (not BaseHTTPMiddleware) gives us direct control
    over the receive() callable, which is the only reliable way to
    inject a tampered body before FastAPI's body caching reads it.
    """

    AFFECTED_PATH = "/api/v1/telemetry"

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        # Only process HTTP requests to the telemetry endpoint
        if not (scope["type"] == "http" and
                scope.get("method") == "POST" and
                scope.get("path") == self.AFFECTED_PATH):
            await self.app(scope, receive, send)
            return

        chaos_config.total_requests += 1
        start_time = time.monotonic()

        # ── 1. Read the body first (we need it for tamper + pass-through) ──
        body_chunks = []
        more_body = True
        while more_body:
            msg = await receive()
            body_chunks.append(msg.get("body", b""))
            more_body = msg.get("more_body", False)
        original_body = b"".join(body_chunks)

        # ── 2. Artificial latency ────────────────────────────────────────
        if chaos_config.latency_ms > 0:
            await asyncio.sleep(chaos_config.latency_ms / 1000.0)
            chaos_config.latency_added += chaos_config.latency_ms
            logger.debug(f"[CHAOS] Latency injected: {chaos_config.latency_ms}ms")

        # ── 3. Packet loss ───────────────────────────────────────────────
        if chaos_config.loss_pct > 0:
            if random.randint(1, 100) <= chaos_config.loss_pct:
                chaos_config.dropped_packets += 1
                logger.info(
                    f"[CHAOS] Packet DROPPED (loss={chaos_config.loss_pct}%) "
                    f"— total dropped: {chaos_config.dropped_packets}"
                )
                # Send 503 directly via ASGI
                response_body = json.dumps({
                    "detail": "Packet dropped (chaos simulation)",
                    "chaos": "packet_loss",
                }).encode()
                await send({"type": "http.response.start", "status": 503,
                            "headers": [[b"content-type", b"application/json"]]})
                await send({"type": "http.response.body",
                            "body": response_body, "more_body": False})
                return

        # ── 4. Payload tampering ─────────────────────────────────────────
        final_body = original_body
        if chaos_config.tamper_enabled:
            final_body = _tamper_body(original_body)
            chaos_config.tampered_packets += 1
            logger.info(
                f"[CHAOS] Payload tampered — total tampered: "
                f"{chaos_config.tampered_packets}"
            )

        # ── 5. Rebuild receive() with the (possibly tampered) body ───────
        body_sent = False

        async def patched_receive():
            nonlocal body_sent
            if not body_sent:
                body_sent = True
                return {"type": "http.request", "body": final_body, "more_body": False}
            # Subsequent calls (disconnect etc.) return disconnect
            return {"type": "http.disconnect"}

        await self.app(scope, patched_receive, send)
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        logger.debug(f"[CHAOS] Request completed in {elapsed_ms}ms")


# ─── Chaos stats (for admin endpoint) ────────────────────────────────────

def get_chaos_stats() -> dict:
    return {
        "config": {
            "loss_pct":   chaos_config.loss_pct,
            "latency_ms": chaos_config.latency_ms,
            "tamper":     chaos_config.tamper_enabled,
        },
        "metrics": {
            "total_requests":   chaos_config.total_requests,
            "dropped_packets":  chaos_config.dropped_packets,
            "tampered_packets": chaos_config.tampered_packets,
            "total_latency_ms_added": chaos_config.latency_added,
        },
    }
