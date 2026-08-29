"""
CVIS Backend — ai/ollama_client.py
------------------------------------
Async HTTP client for the Ollama local inference server.

Design rationale: Uses /api/chat instead of /api/generate so that the system
persona and user content are sent as separate message roles. This produces
significantly more consistent, focused responses from small models like
llama3.2:3b — the system message is cached and acts as a permanent constraint.

Changes vs v1:
  ① /api/chat with system+user messages instead of /api/generate with a
    monolithic prompt string.
  ③ parse_severity() extracts the SEVERITY: tag from recommendation responses
    so the router can return a structured severity field.

CCNS mapping:
  - Centralised AI reasoning via HTTP API → Unit 5 (Cloud/Edge Architecture)
  - Async non-blocking inference call → Unit 3 (Concurrency, Non-blocking I/O)
"""

import logging
import os
import asyncio
from typing import Optional

import httpx

logger = logging.getLogger("cvis.ai.ollama")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",    "llama3.2:3b")
OLLAMA_TIMEOUT  = float(os.getenv("OLLAMA_TIMEOUT_S", "45"))

# Shared async HTTP client (connection-pooled)
_http_client: Optional[httpx.AsyncClient] = None

# Global lock to serialize inference requests (Ollama handles concurrency poorly)
_ollama_lock = asyncio.Lock()

def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            base_url=OLLAMA_BASE_URL,
            timeout=httpx.Timeout(OLLAMA_TIMEOUT),
        )
    return _http_client


async def close_http_client() -> None:
    global _http_client
    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()


# ─── ③ Severity parser ────────────────────────────────────────────────────────

VALID_SEVERITIES = {"NORMAL", "CAUTION", "WARNING", "CRITICAL"}


def parse_severity(text: str) -> tuple[str, str]:
    """
    Extract the SEVERITY: tag from the first line of an AI response.

    Returns (severity, cleaned_text) where severity is one of
    NORMAL | CAUTION | WARNING | CRITICAL (defaults to NORMAL if missing/invalid),
    and cleaned_text is the recommendation without the severity line.
    """
    lines = text.strip().splitlines()
    severity = "NORMAL"
    body_lines = lines

    if lines and lines[0].upper().startswith("SEVERITY:"):
        tag = lines[0].split(":", 1)[1].strip().upper()
        if tag in VALID_SEVERITIES:
            severity = tag
        body_lines = lines[1:]

    cleaned = "\n".join(body_lines).strip()
    return severity, cleaned


# ─── ① /api/chat call helper ─────────────────────────────────────────────────

async def _chat(
    system: str,
    user: str,
    temperature: float,
    num_predict: int,
) -> Optional[str]:
    """
    Send a system+user message pair to Ollama's /api/chat endpoint.
    Returns the assistant's response text, or None on error.
    """
    client = get_http_client()
    try:
        async with _ollama_lock:
            resp = await client.post(
                "/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user",   "content": user},
                    ],
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": num_predict,
                        "top_p": 0.9,
                    },
                },
            )
            resp.raise_for_status()
            data    = resp.json()
        content = data.get("message", {}).get("content", "").strip()
        logger.info(
            f"[AI] Chat response: {len(content)} chars "
            f"(eval_count={data.get('eval_count', '?')})"
        )
        return content if content else None

    except httpx.TimeoutException:
        logger.warning("[AI] Ollama timed out — response skipped")
        return None
    except httpx.ConnectError:
        logger.debug("[AI] Ollama not running — response skipped")
        return None
    except Exception as e:
        logger.warning(f"[AI] Ollama error: {e}")
        return None


# ─── Public functions ─────────────────────────────────────────────────────────

async def generate_recommendation(
    system: str, user: str
) -> Optional[tuple[str, str]]:
    """
    Generate a telemetry recommendation using system/user split.

    Returns (severity, text) tuple, or None if Ollama is unavailable.
    severity is one of NORMAL | CAUTION | WARNING | CRITICAL.
    """
    raw = await _chat(system, user, temperature=0.35, num_predict=220)
    if raw is None:
        return None
    severity, text = parse_severity(raw)
    logger.info(f"[AI] Recommendation severity={severity}, {len(text)} chars")
    return severity, text


async def generate_chat_response(system: str, user: str) -> Optional[str]:
    """
    Generate a driver chat reply using system/user split.
    Slightly higher temperature for conversational variety.
    """
    return await _chat(system, user, temperature=0.55, num_predict=300)


async def check_ollama_status() -> dict:
    """
    Check if Ollama is running and whether the required model is available.
    Used by the admin status endpoint.
    """
    client = get_http_client()
    try:
        resp = await client.get("/api/tags", timeout=3.0)
        resp.raise_for_status()
        models = [m["name"] for m in resp.json().get("models", [])]
        model_available = any(OLLAMA_MODEL in m for m in models)
        return {
            "running":         True,
            "model":           OLLAMA_MODEL,
            "model_available": model_available,
            "available_models": models,
        }
    except httpx.ConnectError:
        return {"running": False, "model": OLLAMA_MODEL, "model_available": False}
    except Exception as e:
        return {"running": False, "error": str(e), "model": OLLAMA_MODEL}
