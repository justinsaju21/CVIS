"""
CVIS Backend — ai/ollama_client.py
------------------------------------
Async HTTP client for the Ollama local inference server.

Design rationale: Ollama exposes a simple HTTP API at localhost:11434. Using
httpx for async HTTP avoids blocking the FastAPI event loop during inference.
The client is intentionally simple — one generate() call, streamed=False for
predictable latency. A timeout (20s) ensures the backend never hangs if Ollama
is slow or unresponsive. The model choice (llama3.2:3b or phi3-mini) is set
via environment variable so it can be swapped without code changes.

CCNS mapping:
  - Centralised AI reasoning via HTTP API → Unit 5 (Cloud/Edge Architecture)
  - Async non-blocking inference call → Unit 3 (Concurrency, Non-blocking I/O)
"""

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger("cvis.ai.ollama")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",    "llama3.2:3b")
OLLAMA_TIMEOUT  = float(os.getenv("OLLAMA_TIMEOUT_S", "20"))

# Shared async HTTP client (connection-pooled)
_http_client: Optional[httpx.AsyncClient] = None


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


async def generate_recommendation(prompt: str) -> Optional[str]:
    """
    Send a prompt to Ollama and return the generated text.

    Returns None if Ollama is unavailable or times out — the caller handles
    this gracefully (AI is non-critical; telemetry still flows without it).
    """
    client = get_http_client()
    try:
        resp = await client.post(
            "/api/generate",
            json={
                "model":  OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.4,   # low temp = consistent, factual
                    "num_predict": 200,   # ~3–5 sentences
                    "top_p": 0.9,
                },
            },
        )
        resp.raise_for_status()
        data = resp.json()
        text = data.get("response", "").strip()
        logger.info(f"[AI] Generated recommendation: {len(text)} chars "
                    f"(eval_count={data.get('eval_count', '?')})")
        return text if text else None

    except httpx.TimeoutException:
        logger.warning("[AI] Ollama timed out — recommendation skipped")
        return None
    except httpx.ConnectError:
        logger.debug("[AI] Ollama not running — recommendation skipped")
        return None
    except Exception as e:
        logger.warning(f"[AI] Ollama error: {e}")
        return None


async def generate_chat_response(prompt: str) -> Optional[str]:
    """Chat response — same generate() call, slightly higher temperature for conversation."""
    client = get_http_client()
    try:
        resp = await client.post(
            "/api/generate",
            json={
                "model":  OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.6,
                    "num_predict": 300,
                    "top_p": 0.95,
                },
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "").strip() or None
    except Exception as e:
        logger.warning(f"[AI] Chat error: {e}")
        return None


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
            "running": True,
            "model": OLLAMA_MODEL,
            "model_available": model_available,
            "available_models": models,
        }
    except httpx.ConnectError:
        return {"running": False, "model": OLLAMA_MODEL, "model_available": False}
    except Exception as e:
        return {"running": False, "error": str(e), "model": OLLAMA_MODEL}
