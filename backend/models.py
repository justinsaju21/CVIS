"""
CVIS Backend — models.py
-------------------------
Pydantic models for validating inbound telemetry payloads.

Design rationale: A versioned, strictly-typed schema means the backend can
reject malformed packets at the boundary rather than mid-processing. The
schema_version field lets future phases introduce v2 payloads alongside v1
without a breaking change.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re


class TelemetryPayload(BaseModel):
    """
    Telemetry packet submitted by an ESP32 vehicle node via HTTP POST.

    All fields match the firmware's serializeTelemetry() output.
    Values are validated to realistic physical bounds.
    """

    # ─── Identity ──────────────────────────────────────────────
    device_id: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="Unique identifier for the transmitting vehicle node.",
        examples=["ESP32-001"],
    )
    schema_version: str = Field(
        default="1.0",
        pattern=r"^\d+\.\d+$",
        description="Payload schema version (semver-lite, e.g. '1.0').",
    )
    timestamp_ms: int = Field(
        ...,
        ge=0,
        description="ESP32 uptime in milliseconds at time of packet creation.",
    )

    # ─── Operating mode ────────────────────────────────────────
    mode: str = Field(
        ...,
        description="Current vehicle operating mode.",
    )

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        allowed = {
            "Healthy", "Eco", "Sport", "Heavy Traffic",
            "Low Battery", "Battery Overheating", "Charging", "Motor Fault",
        }
        if v not in allowed:
            raise ValueError(f"Unknown mode '{v}'. Allowed: {sorted(allowed)}")
        return v

    # ─── Telemetry fields ──────────────────────────────────────
    speed_kmh: float = Field(
        default=0.0,
        ge=0.0,
        le=250.0,
        description="Vehicle speed in km/h.",
    )
    battery_pct: float = Field(
        default=0.0,
        ge=0.0,
        le=100.0,
        description="State of charge as a percentage (0–100).",
    )
    battery_temp_c: float = Field(
        default=25.0,
        ge=-20.0,
        le=100.0,
        description="Battery pack temperature in Celsius.",
    )
    motor_temp_c: float = Field(
        default=25.0,
        ge=-20.0,
        le=150.0,
        description="Motor temperature in Celsius.",
    )
    range_km: float = Field(
        default=0.0,
        ge=0.0,
        le=1000.0,
        description="Estimated remaining range in kilometres.",
    )
    fault_code: int = Field(
        default=0,
        ge=0,
        description="Active fault code (0 = no fault; 0x02 = battery overheat; 0x04 = motor fault).",
    )
    charging_rate_w: float = Field(
        default=0.0,
        ge=0.0,
        le=350000.0,
        description="Active charging power in Watts (0 when not charging).",
    )
    ambient_temp_c: Optional[float] = Field(
        default=None,
        description="Outside ambient temperature in Celsius.",
    )
    headwind_kmh: Optional[float] = Field(
        default=None,
        description="Estimated headwind speed in km/h.",
    )
    road_gradient_pct: Optional[float] = Field(
        default=None,
        description="Road elevation gradient as a percentage (e.g. 5.0 for 5% uphill).",
    )
    tire_pressure_psi: Optional[float] = Field(
        default=None,
        description="Average tire pressure in PSI.",
    )
    cabin_climate_w: Optional[float] = Field(
        default=None,
        description="Power draw of the cabin climate control (AC/Heater) in Watts.",
    )
    max_cell_voltage_delta: Optional[float] = Field(
        default=None,
        description="Maximum voltage difference between any two battery cells.",
    )


class TelemetryResponse(BaseModel):
    """Response body returned to the ESP32 after a successful ingest."""
    status: str = "ok"
    packet_id: int
    received_at: str
