"""
CVIS Backend — routers/telemetry.py
-------------------------------------
HTTP telemetry ingest endpoint.

Design rationale: The telemetry router is the HTTP entry point for vehicle
data. It handles auth/HMAC verification via headers and delegates all shared
ingest logic (persist, broadcast, AI trigger) to the telemetry_service module.
AES-GCM decryption is also handled via an encrypted envelope in the body.

CCNS mapping:
  - X-API-Key auth → Unit 4 (Authentication)
  - X-HMAC-Signature → Unit 4 (Message Integrity)
  - AES-GCM encrypted body → Unit 4 (Confidentiality + Integrity)
  - ChaosMiddleware (upstream) → Unit 3 (Reliability, Latency, Packet Loss)
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request, status

import auth as auth_module
from db import get_config, get_db
from services.telemetry_service import ingest_telemetry_data

router = APIRouter(prefix="/api/v1", tags=["telemetry"])
logger = logging.getLogger("cvis.telemetry")


@router.post(
    "/telemetry",
    summary="Ingest a telemetry packet from a vehicle node (HTTP)",
)
async def ingest_telemetry(
    request: Request,
    x_api_key:        Optional[str] = Header(default=None),
    x_hmac_signature: Optional[str] = Header(default=None),
    x_encrypted:      Optional[str] = Header(default=None),
) -> dict:
    """
    Receive a telemetry packet via HTTP.

    **Headers (when auth is enabled):**
    - `X-API-Key`: device API key issued at registration
    - `X-HMAC-Signature`: HMAC-SHA256 hex of the *plaintext* JSON body
    - `X-Encrypted: true` (optional): signals the body is an AES-GCM envelope

    **Body (plaintext mode):**
    ```json
    {"device_id": "...", "schema_version": "1.0", "mode": "Healthy", ...}
    ```

    **Body (encrypted mode, when X-Encrypted: true):**
    ```json
    {"iv": "<12-byte hex>", "ct": "<ciphertext hex>", "tag": "<16-byte hex>"}
    ```
    """
    auth_enabled  = auth_module.is_auth_enabled()
    encrypted     = (x_encrypted or "").lower() == "true"
    source_ip     = str(request.client.host) if request.client else "unknown"
    body_bytes    = await request.body()
    raw_str       = body_bytes.decode("utf-8")

    # Parse encrypted envelope if needed
    iv = ct = tag = None
    if encrypted:
        try:
            envelope = json.loads(raw_str)
            iv  = envelope["iv"]
            ct  = envelope["ct"]
            tag = envelope["tag"]
        except (json.JSONDecodeError, KeyError) as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Malformed AES-GCM envelope: {e}",
            )

    try:
        result = await ingest_telemetry_data(
            raw_str,
            protocol="http",
            source_ip=source_ip,
            api_key=x_api_key,
            hmac_signature=x_hmac_signature,
            encrypted=encrypted,
            iv=iv,
            ct=ct,
            tag=tag,
            auth_enabled=auth_enabled,
        )
    except ValueError as e:
        err = str(e)
        if err.startswith("AUTH_FAIL") or err.startswith("TAMPER") or err.startswith("REPLAY"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail=err)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=err)

    return result


@router.get(
    "/telemetry/recent",
    summary="Fetch the N most recent telemetry rows",
)
async def get_recent_telemetry(limit: int = 10) -> list[dict]:
    """Return the most recent telemetry records for WS backfill on connect."""
    db = await get_db()
    limit = max(1, min(limit, 100))
    async with db.execute(
        """
        SELECT t.*, p.protocol, p.size_bytes
        FROM   telemetry t
        JOIN   packets   p ON p.id = t.packet_id
        ORDER  BY t.id DESC
        LIMIT  ?
        """,
        (limit,),
    ) as cur:
        rows = await cur.fetchall()
    return [dict(row) for row in rows]


@router.get(
    "/telemetry/packets",
    summary="Fetch raw packet log (for NOC packet table)",
)
async def get_packets(limit: int = 50) -> list[dict]:
    """Return the most recent raw packet log entries for the NOC packet table."""
    db = await get_db()
    limit = max(1, min(limit, 500))
    async with db.execute(
        """
        SELECT id as packet_id, received_at as timestamp, device_id, protocol, direction,
               size_bytes, status, raw_json as raw_payload, 'ok' as auth_status, 0 as encrypted
        FROM packets
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]
