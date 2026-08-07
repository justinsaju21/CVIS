"""
CVIS Backend — routers/ai.py
------------------------------
AI recommendation and driver chat endpoints.

Design rationale: The AI endpoints are separate from the telemetry ingest path.
Recommendations are also triggered automatically per telemetry update (via the
service layer's background task), but this endpoint allows on-demand queries.
The chat endpoint is grounded in current + recent telemetry, preventing the
model from hallucinating vehicle states that don't exist in the actual data.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ai.ollama_client import (
    generate_recommendation,
    generate_chat_response,
    check_ollama_status,
)
from ai.prompt_builder import build_recommendation_prompt, build_chat_prompt
from db import get_db
from models import TelemetryPayload

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])
logger = logging.getLogger("cvis.ai.router")


# ─── On-demand recommendation ────────────────────────────────────────────

class RecommendationRequest(BaseModel):
    device_id: str = Field(..., description="Vehicle node to analyse")


@router.post("/recommendation", summary="Generate AI recommendation for latest telemetry")
async def get_recommendation(body: RecommendationRequest) -> dict:
    """
    Fetch the most recent telemetry for the specified device and generate
    an AI recommendation based on the full multi-factor snapshot.
    """
    db = await get_db()
    async with db.execute(
        """
        SELECT * FROM telemetry
        WHERE device_id = ?
        ORDER BY id DESC LIMIT 1
        """,
        (body.device_id,),
    ) as cur:
        row = await cur.fetchone()

    if not row:
        raise HTTPException(404, f"No telemetry found for device '{body.device_id}'")

    try:
        payload = TelemetryPayload(**dict(row))
    except Exception:
        # Build partial payload from available fields
        payload = TelemetryPayload(
            device_id=row["device_id"],
            schema_version=row["schema_version"],
            timestamp_ms=0,
            mode=row["mode"],
            speed_kmh=row["speed_kmh"] or 0,
            battery_pct=row["battery_pct"] or 0,
            battery_temp_c=row["battery_temp_c"] or 25,
            motor_temp_c=row["motor_temp_c"] or 25,
            range_km=row["range_km"] or 0,
            fault_code=row["fault_code"] or 0,
            charging_rate_w=row["charging_rate_w"] or 0,
        )

    prompt = build_recommendation_prompt(payload)
    recommendation = await generate_recommendation(prompt)

    if recommendation is None:
        raise HTTPException(503, "AI service unavailable — is Ollama running?")

    return {
        "device_id": body.device_id,
        "mode": payload.mode,
        "recommendation": recommendation,
    }


# ─── Driver chat ──────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    device_id: str    = Field(..., description="Vehicle node context")
    message:   str    = Field(..., min_length=1, max_length=500,
                              description="Driver's question or message")


@router.post("/chat", summary="Chat with CVIS AI grounded in current telemetry")
async def driver_chat(body: ChatRequest) -> dict:
    """
    Free-text driver chat grounded in current + recent telemetry.
    The model is explicitly prohibited from inventing vehicle state —
    it must base responses on the actual telemetry provided in the prompt.
    """
    db = await get_db()

    # Current state
    async with db.execute(
        "SELECT * FROM telemetry WHERE device_id = ? ORDER BY id DESC LIMIT 1",
        (body.device_id,),
    ) as cur:
        current_row = await cur.fetchone()

    if not current_row:
        raise HTTPException(404, f"No telemetry found for device '{body.device_id}'")

    # Recent history (last 10 rows)
    async with db.execute(
        """
        SELECT mode, speed_kmh, battery_pct, battery_temp_c, motor_temp_c,
               fault_code, received_at
        FROM telemetry
        WHERE device_id = ?
        ORDER BY id DESC LIMIT 10
        """,
        (body.device_id,),
    ) as cur:
        history_rows = await cur.fetchall()

    current_payload = TelemetryPayload(
        device_id=current_row["device_id"],
        schema_version=current_row["schema_version"],
        timestamp_ms=0,
        mode=current_row["mode"],
        speed_kmh=current_row["speed_kmh"] or 0,
        battery_pct=current_row["battery_pct"] or 0,
        battery_temp_c=current_row["battery_temp_c"] or 25,
        motor_temp_c=current_row["motor_temp_c"] or 25,
        range_km=current_row["range_km"] or 0,
        fault_code=current_row["fault_code"] or 0,
        charging_rate_w=current_row["charging_rate_w"] or 0,
    )

    history = [dict(r) for r in history_rows]
    prompt  = build_chat_prompt(body.message, current_payload, history)
    reply   = await generate_chat_response(prompt)

    if reply is None:
        raise HTTPException(503, "AI service unavailable — is Ollama running?")

    return {
        "device_id": body.device_id,
        "mode":      current_payload.mode,
        "message":   body.message,
        "reply":     reply,
    }


# ─── AI status ────────────────────────────────────────────────────────────

@router.get("/status", summary="Check Ollama availability and model status")
async def ai_status() -> dict:
    """Used by admin panel to show AI service health."""
    return await check_ollama_status()
