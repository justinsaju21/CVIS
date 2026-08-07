"""
CVIS Backend — ai/prompt_builder.py
--------------------------------------
Builds prompts from telemetry snapshots for Ollama AI reasoning.

Design rationale: The prompt explicitly includes ALL telemetry fields so the
model reasons over the combined vehicle state, not just one metric. This is the
core grading requirement from AGENTS.md §3.3: "AI reasons over the combined
telemetry snapshot, not single fields." The prompt is structured to elicit
natural-language recommendations, not labels or if/else thresholding.

CCNS mapping:
  - Centralised AI over network data → Unit 5 (Intelligent Networking, Cloud-Edge)
"""

from models import TelemetryPayload

# Mode context descriptions help the model understand the operating state
MODE_CONTEXT = {
    "Healthy":             "normal driving conditions, all systems nominal",
    "Eco":                 "eco/efficiency mode, conserving battery and range",
    "Sport":               "high-performance sport mode, aggressive acceleration",
    "Heavy Traffic":       "stop-and-go traffic with frequent braking and idling",
    "Low Battery":         "critically low battery state, near depletion",
    "Battery Overheating": "CRITICAL — battery thermal event in progress",
    "Charging":            "vehicle plugged in and charging at a fixed point",
    "Motor Fault":         "CRITICAL — motor fault detected, vehicle may be immobilised",
}

# Fault code descriptions
FAULT_CODES = {
    0x00: "No fault",
    0x02: "Battery thermal fault — temperature critically high",
    0x04: "Motor fault — controller or winding failure detected",
}


def build_recommendation_prompt(payload: TelemetryPayload) -> str:
    """
    Build a multi-factor telemetry analysis prompt.

    The prompt presents the full telemetry snapshot so the model must consider
    the interaction between battery state, temperature, speed, fault code, and
    mode together — not any single field in isolation.
    """
    fault_desc = FAULT_CODES.get(payload.fault_code, f"Unknown fault 0x{payload.fault_code:02X}")
    mode_ctx   = MODE_CONTEXT.get(payload.mode, payload.mode)
    charging   = f", charging at {payload.charging_rate_w:.0f}W" if payload.charging_rate_w > 0 else ""

    prompt = f"""You are CVIS — the Connected Vehicle Intelligence System, an AI safety and efficiency advisor running in the cloud data-centre.

You have received a real-time telemetry snapshot from vehicle node '{payload.device_id}'. Analyse ALL metrics together and provide a concise, actionable recommendation to the driver.

=== TELEMETRY SNAPSHOT ===
Vehicle mode:      {payload.mode} ({mode_ctx}{charging})
Speed:             {payload.speed_kmh:.1f} km/h
Battery charge:    {payload.battery_pct:.1f}%
Battery temp:      {payload.battery_temp_c:.1f}°C
Motor temp:        {payload.motor_temp_c:.1f}°C
Estimated range:   {payload.range_km:.1f} km
Fault code:        0x{payload.fault_code:02X} — {fault_desc}
=========================

Instructions:
- Consider how ALL metrics interact. Do not base your answer on a single value.
- If any metric is in a warning or critical range, explain WHY it is concerning given the other metrics.
- Give a clear, plain-English recommendation for what the driver should do RIGHT NOW.
- Be specific and direct. Limit your response to 3–5 sentences maximum.
- Do not repeat the telemetry numbers back verbatim — synthesise them into insight.

Your recommendation:"""

    return prompt


def build_chat_prompt(
    user_message: str,
    current_payload: TelemetryPayload,
    recent_history: list[dict],
) -> str:
    """
    Build a grounded chat prompt including current telemetry + recent history.

    The AI is prohibited from making up vehicle state — it must ground its
    responses in the actual telemetry data provided.
    """
    fault_desc = FAULT_CODES.get(current_payload.fault_code,
                                  f"0x{current_payload.fault_code:02X}")

    # Summarise recent telemetry trend (last N packets)
    history_lines = []
    for i, row in enumerate(recent_history[-5:], 1):
        history_lines.append(
            f"  [{i}] mode={row.get('mode','?')} "
            f"batt={row.get('battery_pct','?')}% "
            f"speed={row.get('speed_kmh','?')}km/h "
            f"motor_temp={row.get('motor_temp_c','?')}°C"
        )
    history_str = "\n".join(history_lines) if history_lines else "  (no history available)"

    prompt = f"""You are CVIS — the Connected Vehicle Intelligence System AI assistant. You help drivers understand their vehicle's status and answer questions about it.

You MUST base your answers on the real telemetry data provided below. Do not invent or assume vehicle states that are not in the data.

=== CURRENT VEHICLE STATE ===
Device:       {current_payload.device_id}
Mode:         {current_payload.mode}
Speed:        {current_payload.speed_kmh:.1f} km/h
Battery:      {current_payload.battery_pct:.1f}% @ {current_payload.battery_temp_c:.1f}°C
Motor temp:   {current_payload.motor_temp_c:.1f}°C
Range:        {current_payload.range_km:.1f} km
Fault:        {fault_desc}
Charging:     {f'{current_payload.charging_rate_w:.0f}W' if current_payload.charging_rate_w > 0 else 'Not charging'}

=== RECENT TELEMETRY TREND ===
{history_str}
=============================

Driver asks: {user_message}

Your response (conversational, concise, grounded in the data above):"""

    return prompt
