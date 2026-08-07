"""
CVIS Backend — routers/devices.py
-----------------------------------
Device registration endpoint.

Design rationale: Each ESP32 node must register before it can send telemetry.
Registration issues a unique api_key (for HTTP auth) and a device_secret (for
HMAC-SHA256 signing and AES-GCM encryption). The api_key is shown ONCE at
registration and then stored as a one-way SHA-256 hash — the backend can never
recover it, so the firmware must persist it in secrets.h. This mirrors real
IoT device provisioning flows.

CCNS mapping:
  - Device registration → Unit 4 (Authentication, Key Distribution)
  - One-way hash of API key → Unit 4 (Hash Functions, Secure Storage)
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from crypto import generate_api_key, generate_device_secret, hash_api_key
from db import get_db

router = APIRouter(prefix="/api/v1", tags=["devices"])
logger = logging.getLogger("cvis.devices")


class RegisterRequest(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=64,
                           description="Unique device identifier (e.g. 'ESP32-001')",
                           examples=["ESP32-001"])


class RegisterResponse(BaseModel):
    device_id:     str
    api_key:       str   # shown ONCE — firmware must store this in secrets.h
    device_secret: str   # 32-byte hex — used for HMAC-SHA256 / AES-GCM
    registered_at: str
    message:       str


@router.post(
    "/devices/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new ESP32 vehicle node",
)
async def register_device(body: RegisterRequest) -> RegisterResponse:
    """
    Issue credentials for a new vehicle node.

    - **api_key** — include in `X-API-Key` header on every HTTP request,
      or in the `_meta.api_key` field of MQTT payloads.
    - **device_secret** — used to sign payloads with HMAC-SHA256,
      and as the AES-256-GCM key when encryption is enabled.

    > **Important:** The `api_key` is shown exactly once. Store it immediately
    > in `firmware/secrets.h`. It cannot be recovered — only reset by
    > re-registering the device.
    """
    db = await get_db()

    # Check if device_id is already registered
    async with db.execute(
        "SELECT device_id, active FROM devices WHERE device_id = ?",
        (body.device_id,),
    ) as cur:
        existing = await cur.fetchone()

    if existing and existing["active"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Device '{body.device_id}' is already registered. "
                "To re-register, first deactivate the existing device via /admin."
            ),
        )

    # Generate credentials
    api_key       = generate_api_key()
    device_secret = generate_device_secret()
    api_key_hash  = hash_api_key(api_key)
    registered_at = datetime.now(timezone.utc).isoformat()

    if existing and not existing["active"]:
        # Re-registration: update existing row
        await db.execute(
            """
            UPDATE devices
            SET api_key_hash = ?, device_secret = ?, registered_at = ?, active = 1
            WHERE device_id = ?
            """,
            (api_key_hash, device_secret, registered_at, body.device_id),
        )
    else:
        # New registration
        await db.execute(
            """
            INSERT INTO devices (device_id, api_key_hash, device_secret, registered_at)
            VALUES (?, ?, ?, ?)
            """,
            (body.device_id, api_key_hash, device_secret, registered_at),
        )

    # Log the registration event
    await db.execute(
        """
        INSERT INTO auth_logs (timestamp, device_id, event_type, details)
        VALUES (?, ?, 'registered', 'Device registered successfully')
        """,
        (registered_at, body.device_id),
    )
    await db.commit()

    logger.info(f"[DEVICES] Registered: {body.device_id}")

    return RegisterResponse(
        device_id=body.device_id,
        api_key=api_key,
        device_secret=device_secret,
        registered_at=registered_at,
        message=(
            f"Device '{body.device_id}' registered. "
            "Store api_key and device_secret in firmware/secrets.h — "
            "they cannot be recovered after this response."
        ),
    )


@router.get(
    "/devices",
    summary="List all registered devices",
    tags=["devices"],
)
async def list_devices() -> list[dict]:
    """Return all registered devices (without secrets)."""
    db = await get_db()
    async with db.execute(
        "SELECT device_id, registered_at, active FROM devices ORDER BY registered_at DESC"
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]
