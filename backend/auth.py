"""
CVIS Backend — auth.py
-----------------------
FastAPI dependencies for device authentication and HMAC integrity verification.

Design rationale: Authentication is enforced as a FastAPI Depends() so it is
applied uniformly without the route function needing to call it explicitly.
The auth toggle (NOC control) is a runtime flag — when disabled, all requests
are still logged as 'no_auth' so the demo can show what open traffic looks like.
Tamper detection is also here: HMAC failure → 'tamper_detected' auth log entry.

CCNS mapping:
  - API key auth → Unit 4 (Authentication, Access Control)
  - HMAC verification → Unit 4 (Message Integrity, MAC)
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request, status

from crypto import verify_hmac

logger = logging.getLogger("cvis.auth")

# ─── Runtime auth toggle ──────────────────────────────────────────────────
# When False, auth headers are not required (for demo: show open traffic).
# Set via NOC control → POST /api/v1/config/auth
_auth_enabled: bool = True


def is_auth_enabled() -> bool:
    return _auth_enabled


def set_auth_enabled(value: bool) -> None:
    global _auth_enabled
    _auth_enabled = value
    logger.info(f"[AUTH] Auth enforcement {'ENABLED' if value else 'DISABLED'}")


# ─── FastAPI dependency: verify API key ───────────────────────────────────

async def require_api_key(
    request: Request,
    x_api_key: Optional[str] = Header(default=None),
) -> Optional[str]:
    """
    FastAPI Depends — validates X-API-Key header against the devices table.

    Returns the device_id associated with the key if valid.
    Raises 401 if auth is enabled and key is missing or invalid.
    When auth is disabled (NOC toggle), returns None and logs the event.
    """
    from db import get_db
    from crypto import hash_api_key

    db = await get_db()

    # Auth disabled (demo mode — open traffic)
    if not _auth_enabled:
        await _log_auth(db, None, "no_auth", str(request.client.host if request.client else "unknown"),
                        "Auth enforcement disabled")
        return None

    if not x_api_key:
        await _log_auth(db, None, "auth_fail", str(request.client.host if request.client else "unknown"),
                        "Missing X-API-Key header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header",
        )

    key_hash = hash_api_key(x_api_key)
    async with db.execute(
        "SELECT device_id FROM devices WHERE api_key_hash = ? AND active = 1",
        (key_hash,),
    ) as cur:
        row = await cur.fetchone()

    if not row:
        await _log_auth(db, None, "auth_fail", str(request.client.host if request.client else "unknown"),
                        "Invalid or unknown API key")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )

    device_id: str = row["device_id"]
    await _log_auth(db, device_id, "auth_ok", str(request.client.host if request.client else "unknown"),
                    "API key accepted")
    return device_id


# ─── FastAPI dependency: verify HMAC ─────────────────────────────────────

async def require_hmac(
    request: Request,
    x_hmac_signature: Optional[str] = Header(default=None),
    device_id: Optional[str] = Depends(require_api_key),
) -> bytes:
    """
    FastAPI Depends — verifies X-HMAC-Signature header against the raw body.

    HMAC is computed over the *exact* request body bytes as received.
    Returns raw body bytes (so the route handler doesn't need to read it again).
    Raises 401 if auth is enabled and HMAC is missing or invalid.
    """
    from db import get_db

    db = await get_db()
    body = await request.body()

    # Auth disabled — skip HMAC check
    if not _auth_enabled:
        return body

    if not x_hmac_signature:
        await _log_auth(db, device_id, "tamper_detected",
                        str(request.client.host if request.client else "unknown"),
                        "Missing X-HMAC-Signature header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-HMAC-Signature header",
        )

    # Look up device_secret for HMAC verification
    async with db.execute(
        "SELECT device_secret FROM devices WHERE device_id = ? AND active = 1",
        (device_id,),
    ) as cur:
        row = await cur.fetchone()

    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Device not found")

    device_secret: str = row["device_secret"]
    payload_str = body.decode("utf-8")

    if not verify_hmac(device_secret, payload_str, x_hmac_signature):
        await _log_auth(db, device_id, "tamper_detected",
                        str(request.client.host if request.client else "unknown"),
                        f"HMAC mismatch — payload may have been tampered")
        logger.warning(f"[AUTH] HMAC FAIL for device={device_id} — TAMPER DETECTED")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="HMAC signature verification failed — packet rejected",
        )

    logger.debug(f"[AUTH] HMAC OK for device={device_id}")
    return body


# ─── Internal auth log helper ────────────────────────────────────────────

async def _log_auth(db, device_id: Optional[str], event_type: str,
                    ip_address: str, details: str) -> None:
    """Insert a row into the auth_logs table."""
    try:
        await db.execute(
            """
            INSERT INTO auth_logs (timestamp, device_id, event_type, ip_address, details)
            VALUES (?, ?, ?, ?, ?)
            """,
            (datetime.now(timezone.utc).isoformat(), device_id, event_type,
             ip_address, details),
        )
        await db.commit()
    except Exception as e:
        logger.error(f"[AUTH] Failed to write auth log: {e}")
