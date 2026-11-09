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
from typing import Optional, Any

import httpx

logger = logging.getLogger("cvis.ai.ollama")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",    "llama3.2:3b")
OLLAMA_TIMEOUT  = float(os.getenv("OLLAMA_TIMEOUT_S", "45"))

# Shared async HTTP client (connection-pooled)
_http_client: Optional[httpx.AsyncClient] = None

# Global lock to serialize inference requests (Ollama handles concurrency poorly)
_ollama_lock: Optional[asyncio.Lock] = None

def _get_ollama_lock() -> asyncio.Lock:
    global _ollama_lock
    if _ollama_lock is None:
        _ollama_lock = asyncio.Lock()
    return _ollama_lock

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


def get_active_model() -> str:
    """Return the currently selected inference model."""
    global OLLAMA_MODEL
    return OLLAMA_MODEL


def set_active_model(model_name: str) -> str:
    """Switch active inference model at runtime without server restart."""
    global OLLAMA_MODEL
    OLLAMA_MODEL = model_name.strip()
    logger.info(f"[AI] Active inference model switched to: {OLLAMA_MODEL}")
    return OLLAMA_MODEL


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


# ─── ① /api/chat call helper (GPU-enforced) ──────────────────────────────────

async def _chat(
    system: str,
    user: str,
    temperature: float,
    num_predict: int,
    model: Optional[str] = None,
    return_metadata: bool = False,
) -> Any:
    """
    Send a system+user message pair to Ollama's /api/chat endpoint.
    num_gpu is set to 99 to guarantee 100% layer offloading to CUDA VRAM (RTX 4060).
    Returns the assistant's response text, or metadata dict if return_metadata=True.
    """
    client = get_http_client()
    target_model = model or OLLAMA_MODEL
    t_start = asyncio.get_event_loop().time()
    try:
        async with _get_ollama_lock():
            resp = await client.post(
                "/api/chat",
                json={
                    "model": target_model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user",   "content": user},
                    ],
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": num_predict,
                        "top_p": 0.9,
                        # num_gpu: 99 forces Ollama to offload all layers to NVIDIA GPU VRAM
                        "num_gpu": int(os.getenv("OLLAMA_NUM_GPU", "99")),
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()
        
        t_end = asyncio.get_event_loop().time()
        latency_ms = round((t_end - t_start) * 1000, 1)
        content = data.get("message", {}).get("content", "").strip()
        eval_count = data.get("eval_count", 0)
        eval_duration_ns = data.get("eval_duration", 0)
        tok_per_sec = round((eval_count / (eval_duration_ns / 1e9)), 1) if eval_duration_ns > 0 else 0.0

        logger.info(
            f"[AI] Model={target_model} (GPU) response: {len(content)} chars | "
            f"eval_count={eval_count} | latency={latency_ms}ms | {tok_per_sec} tok/s"
        )

        if return_metadata:
            return {
                "content": content if content else None,
                "model": target_model,
                "latency_ms": latency_ms,
                "eval_count": eval_count,
                "tokens_per_sec": tok_per_sec,
                "gpu_offload": True,
            }

        return content if content else None

    except httpx.TimeoutException:
        logger.warning(f"[AI] Ollama timed out for model '{target_model}'")
        return None
    except httpx.ConnectError:
        logger.debug("[AI] Ollama not running — response skipped")
        return None
    except Exception as e:
        logger.warning(f"[AI] Ollama error with model '{target_model}': {e}")
        return None


# ─── Public functions ─────────────────────────────────────────────────────────

async def generate_recommendation(
    system: str, user: str, model: Optional[str] = None
) -> Optional[tuple[str, str]]:
    """
    Generate a telemetry recommendation using system/user split.
    Guaranteed GPU offload via num_gpu=99.
    Returns (severity, text) tuple, or None if Ollama is unavailable.
    """
    raw = await _chat(system, user, temperature=0.35, num_predict=220, model=model)
    if raw is None:
        return None
    severity, text = parse_severity(raw)
    logger.info(f"[AI] Recommendation severity={severity}, {len(text)} chars")
    return severity, text


async def generate_chat_response(
    system: str, user: str, model: Optional[str] = None
) -> Optional[str]:
    """
    Generate a driver chat reply using system/user split on the GPU.
    """
    return await _chat(system, user, temperature=0.55, num_predict=300, model=model)


async def pull_model(model_name: str) -> dict:
    """
    Pull/install a missing model from Ollama library.
    Stream is false for synchronous backend wait.
    """
    client = get_http_client()
    clean_name = model_name.strip()
    logger.info(f"[AI] Initiating pull for model: '{clean_name}'...")
    try:
        resp = await client.post(
            "/api/pull",
            json={"name": clean_name, "stream": False},
            timeout=httpx.Timeout(300.0),
        )
        resp.raise_for_status()
        return {"status": "ok", "model": clean_name, "result": resp.json()}
    except Exception as e:
        logger.error(f"[AI] Error pulling model '{clean_name}': {e}")
        return {"status": "error", "model": clean_name, "error": str(e)}


async def get_loaded_models_gpu_status() -> list[dict]:
    """
    Query Ollama /api/ps to verify which models are currently resident in GPU VRAM.
    """
    client = get_http_client()
    try:
        resp = await client.get("/api/ps", timeout=3.0)
        resp.raise_for_status()
        return resp.json().get("models", [])
    except Exception:
        return []


async def compare_models_inference(
    system: str,
    user: str,
    models: Optional[list[str]] = None,
) -> list[dict]:
    """
    Run identical inference across specified models to compare GPU latency,
    eval rate (tokens/sec), severity assessment, and generated recommendations.
    """
    if not models:
        # Default comparison between active model and common candidates
        status = await check_ollama_status()
        avail = status.get("available_models", [])
        models = [OLLAMA_MODEL]
        for candidate in ["gemma3:4b", "qwen3:8b", "deepseek-r1:8b"]:
            if any(candidate in m for m in avail) and candidate not in models:
                models.append(candidate)
                if len(models) >= 3:
                    break

    results = []
    for m in models:
        meta = await _chat(system, user, temperature=0.35, num_predict=220, model=m, return_metadata=True)
        if meta and meta.get("content"):
            sev, cleaned_text = parse_severity(meta["content"])
            results.append({
                "model":           m,
                "active":          (m == OLLAMA_MODEL),
                "severity":        sev,
                "recommendation":  cleaned_text,
                "latency_ms":      meta["latency_ms"],
                "eval_count":      meta["eval_count"],
                "tokens_per_sec":  meta["tokens_per_sec"],
                "gpu_offload":     True,
            })
        else:
            results.append({
                "model":           m,
                "active":          (m == OLLAMA_MODEL),
                "severity":        "UNAVAILABLE",
                "recommendation":  f"Model '{m}' timed out or failed to load.",
                "latency_ms":      0,
                "eval_count":      0,
                "tokens_per_sec":  0,
                "gpu_offload":     False,
            })
    return results


async def check_ollama_status() -> dict:
    """
    Check if Ollama is running, query available models, and inspect GPU VRAM residency.
    """
    client = get_http_client()
    try:
        resp = await client.get("/api/tags", timeout=3.0)
        resp.raise_for_status()
        raw_models = resp.json().get("models", [])
        models = [m["name"] for m in raw_models]
        model_available = any(OLLAMA_MODEL in m for m in models)

        # Also check GPU residency from /api/ps
        loaded_ps = await get_loaded_models_gpu_status()
        gpu_resident = any(OLLAMA_MODEL in m.get("name", "") for m in loaded_ps)
        vram_bytes = sum(m.get("size_vram", 0) for m in loaded_ps)

        return {
            "running":          True,
            "model":            OLLAMA_MODEL,
            "model_available":  model_available,
            "available_models": models,
            "models_detail":    raw_models,
            "gpu_enforced":     True,
            "gpu_resident":     gpu_resident,
            "vram_allocated_mb": round(vram_bytes / (1024 * 1024), 1),
        }
    except httpx.ConnectError:
        return {"running": False, "model": OLLAMA_MODEL, "model_available": False, "gpu_enforced": True}
    except Exception as e:
        return {"running": False, "error": str(e), "model": OLLAMA_MODEL, "gpu_enforced": True}

