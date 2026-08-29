"""
CVIS Backend — ai/prompt_builder.py
--------------------------------------
Builds prompts from telemetry snapshots for Ollama AI reasoning.

Design rationale: Each build function now returns a (system, user) tuple so
the Ollama /api/chat endpoint can receive the persona as a permanent system
message (cached, strongly enforced) and the live telemetry as the user turn.

Improvements over v1:
  1. System/user split — model stays in character, focused answers
  2. Trend delta context — rate-of-change data injected for recommendations
  3. Severity classification — model outputs SEVERITY: tag, parsed by router
  4. Mode-transition awareness — transition event flagged when mode changes

CCNS mapping:
  - Centralised AI over network data → Unit 5 (Intelligent Networking, Cloud-Edge)
"""

from models import TelemetryPayload

# ─── Domain knowledge tables ─────────────────────────────────────────────────

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

FAULT_CODES = {
    0x00: "No fault",
    0x02: "Battery thermal fault — temperature critically high",
    0x04: "Motor fault — controller or winding failure detected",
}

# Per-mode expected ranges — used to contextualise whether a reading is normal
# Format: (low_warn, high_warn) — outside this range is flagged
NORMAL_RANGES: dict[str, dict[str, tuple[float, float]]] = {
    "Healthy":             {"motor_temp_c": (20, 65),  "battery_temp_c": (15, 40), "battery_pct": (30, 100)},
    "Eco":                 {"motor_temp_c": (20, 55),  "battery_temp_c": (15, 38), "battery_pct": (20, 100)},
    "Sport":               {"motor_temp_c": (20, 85),  "battery_temp_c": (15, 45), "battery_pct": (15, 100)},
    "Heavy Traffic":       {"motor_temp_c": (20, 70),  "battery_temp_c": (15, 42), "battery_pct": (15, 100)},
    "Low Battery":         {"motor_temp_c": (20, 65),  "battery_temp_c": (15, 40), "battery_pct": (0,  20)},
    "Battery Overheating": {"motor_temp_c": (20, 90),  "battery_temp_c": (50, 80), "battery_pct": (5,  100)},
    "Charging":            {"motor_temp_c": (20, 45),  "battery_temp_c": (15, 45), "battery_pct": (0,  100)},
    "Motor Fault":         {"motor_temp_c": (20, 100), "battery_temp_c": (15, 45), "battery_pct": (5,  100)},
}

# ─── Shared system persona (used in both surfaces) ────────────────────────────

SYSTEM_PERSONA = (
    "You are CVIS — the Connected Vehicle Intelligence System AI, running in the cloud data-centre. "
    "You are a concise, expert vehicle safety and efficiency advisor. "
    "Your role is to analyse telemetry data transmitted over a secure network from electric vehicle nodes "
    "and give drivers actionable, plain-English guidance. "
    "Rules you must always follow:\n"
    "  • Reason over ALL telemetry fields together — never base your response on a single metric.\n"
    "  • Never repeat raw numbers verbatim — synthesise them into meaningful insight.\n"
    "  • Be specific and direct. Avoid generic filler phrases.\n"
    "  • Do not invent vehicle states that are not in the data provided.\n"
    "  • If a fault code is non-zero, always address it prominently."
)

CHAT_SYSTEM_PERSONA = (
    "You are CVIS — the Connected Vehicle Intelligence System AI assistant. "
    "You help drivers understand their vehicle's real-time status and answer their questions. "
    "Rules:\n"
    "  • Base every answer strictly on the telemetry data provided — never guess or invent.\n"
    "  • Keep responses conversational and concise (2–4 sentences unless detail is asked for).\n"
    "  • If the driver asks about something not visible in the data, say so honestly.\n"
    "  • Always acknowledge any active fault codes or critical states in your response."
)


# ─── Helper: compute trend deltas from history rows ──────────────────────────

def _build_trend_block(payload: TelemetryPayload, history: list[dict]) -> str:
    """
    Given the last N telemetry rows (oldest first), compute per-metric trend
    strings and return a formatted block for injection into the prompt.
    """
    if not history or len(history) < 2:
        return "  (insufficient history — only current reading available)"

    # history is returned ORDER BY id DESC, so reverse to get oldest-first
    rows = list(reversed(history))

    def series(key: str) -> list[float]:
        return [float(r.get(key) or 0) for r in rows]

    batt_series  = series("battery_pct")
    motor_series = series("motor_temp_c")
    batt_t_series= series("battery_temp_c")
    speed_series = series("speed_kmh")

    def arrow_series(vals: list[float], unit: str, decimals: int = 1) -> str:
        fmt = f"{{:.{decimals}f}}{unit}"
        return " → ".join(fmt.format(v) for v in vals)

    def delta_tag(vals: list[float], high_bad: bool = True) -> str:
        """Return a human-readable delta annotation."""
        if len(vals) < 2:
            return ""
        d = vals[-1] - vals[0]
        if abs(d) < 0.5:
            return " (stable)"
        direction = "+" if d > 0 else ""
        trend_word = ("rising" if d > 0 else "falling")
        alarm = ""
        if high_bad and d > 0 and abs(d) > 10:
            alarm = " ⚠ RAPID RISE"
        elif not high_bad and d < 0 and abs(d) > 15:
            alarm = " ⚠ RAPID DRAIN"
        return f" ({direction}{d:.1f} total, {trend_word}{alarm})"

    lines = [
        f"  Battery charge: {arrow_series(batt_series, '%')}{delta_tag(batt_series, high_bad=False)}",
        f"  Battery temp:   {arrow_series(batt_t_series, '°C')}{delta_tag(batt_t_series)}",
        f"  Motor temp:     {arrow_series(motor_series, '°C')}{delta_tag(motor_series)}",
        f"  Speed:          {arrow_series(speed_series, 'km/h')} (varying)",
    ]

    # Mode transitions in history
    modes = [r.get("mode", "?") for r in rows]
    unique_modes = list(dict.fromkeys(modes))  # preserves order, deduplicates
    if len(unique_modes) > 1:
        lines.append(f"  Mode history:   {' → '.join(unique_modes)}")

    return "\n".join(lines)


def _range_annotations(payload: TelemetryPayload) -> list[str]:
    """Return list of range-violation strings for the current mode."""
    ranges = NORMAL_RANGES.get(payload.mode, {})
    notes = []
    checks = [
        ("motor_temp_c",   payload.motor_temp_c,   "Motor temp"),
        ("battery_temp_c", payload.battery_temp_c,  "Battery temp"),
        ("battery_pct",    payload.battery_pct,     "Battery charge"),
    ]
    for key, val, label in checks:
        if key not in ranges:
            continue
        lo, hi = ranges[key]
        if val > hi:
            pct_over = ((val - hi) / hi) * 100 if hi > 0 else 0
            notes.append(f"  {label} {val:.1f} — ABOVE normal range for {payload.mode} mode ({lo:.0f}–{hi:.0f}), {pct_over:.0f}% over limit")
        elif val < lo:
            notes.append(f"  {label} {val:.1f} — BELOW normal range for {payload.mode} mode ({lo:.0f}–{hi:.0f})")
    return notes


# ─── Public builder: recommendation ──────────────────────────────────────────

def build_recommendation_prompt(
    payload: TelemetryPayload,
    history: list[dict] | None = None,
    prev_mode: str | None = None,
) -> tuple[str, str]:
    """
    Return (system_message, user_message) for the recommendation surface.

    Args:
        payload:   Current telemetry reading.
        history:   Last N rows from DB (newest first, as returned by ORDER BY id DESC).
        prev_mode: Mode from the immediately preceding reading, for transition detection.

    Changes vs v1:
      ② trend delta context injected from history
      ③ severity classification instruction added
      ④ mode-transition event flagged when prev_mode differs
    """
    fault_desc  = FAULT_CODES.get(payload.fault_code, f"Unknown fault 0x{payload.fault_code:02X}")
    mode_ctx    = MODE_CONTEXT.get(payload.mode, payload.mode)
    charging    = f", charging at {payload.charging_rate_w:.0f}W" if payload.charging_rate_w > 0 else ""
    range_notes = _range_annotations(payload)

    # ④ Mode-transition detection
    transition_line = ""
    if prev_mode and prev_mode != payload.mode:
        transition_line = f"\n⚡ MODE TRANSITION: {prev_mode} → {payload.mode}  ← JUST OCCURRED THIS READING\n"

    # ② Trend block
    trend_block = _build_trend_block(payload, history or [])

    # Range annotations block
    range_block = ("\n=== RANGE VIOLATIONS ===\n" + "\n".join(range_notes) + "\n") if range_notes else ""

    user_msg = f"""Analyse the following real-time telemetry from vehicle '{payload.device_id}' and respond exactly as instructed.
{transition_line}
=== CURRENT SNAPSHOT ===
Mode:           {payload.mode} ({mode_ctx}{charging})
Speed:          {payload.speed_kmh:.1f} km/h
Battery charge: {payload.battery_pct:.1f}%
Battery temp:   {payload.battery_temp_c:.1f}°C
Motor temp:     {payload.motor_temp_c:.1f}°C
Estimated range:{payload.range_km:.1f} km
Fault code:     0x{payload.fault_code:02X} — {fault_desc}
========================
{range_block}
=== TREND (last {len(history or [])} readings, oldest → newest) ===
{trend_block}
==============================================

③ Required output format (follow EXACTLY):
SEVERITY: <one of: NORMAL | CAUTION | WARNING | CRITICAL>
<Your recommendation — 3 to 5 sentences. Consider all metrics and trend direction. If a mode transition just occurred, lead with that. Be specific and direct.>"""

    return SYSTEM_PERSONA, user_msg


# ─── Public builder: driver chat ─────────────────────────────────────────────

def build_chat_prompt(
    user_message: str,
    current_payload: TelemetryPayload,
    recent_history: list[dict],
) -> tuple[str, str]:
    """
    Return (system_message, user_message) for the driver chat surface.

    Changes vs v1:
      ① system/user split — persona in system message
      ② richer trend block (uses shared _build_trend_block)
    """
    fault_desc  = FAULT_CODES.get(current_payload.fault_code, f"0x{current_payload.fault_code:02X}")
    trend_block = _build_trend_block(current_payload, recent_history)

    user_msg = f"""=== CURRENT VEHICLE STATE ===
Device:       {current_payload.device_id}
Mode:         {current_payload.mode}
Speed:        {current_payload.speed_kmh:.1f} km/h
Battery:      {current_payload.battery_pct:.1f}% @ {current_payload.battery_temp_c:.1f}°C
Motor temp:   {current_payload.motor_temp_c:.1f}°C
Range:        {current_payload.range_km:.1f} km
Fault:        {fault_desc}
Charging:     {f'{current_payload.charging_rate_w:.0f}W' if current_payload.charging_rate_w > 0 else 'Not charging'}

=== RECENT TREND (oldest → newest) ===
{trend_block}
=======================================

Driver asks: {user_message}"""

    return CHAT_SYSTEM_PERSONA, user_msg
