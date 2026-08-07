"""
CVIS Backend — crypto.py
-------------------------
Cryptographic primitives used by the CVIS communication layer.

Design rationale: Centralising all crypto operations here ensures a single
implementation that is tested in isolation. Both HMAC-SHA256 (integrity without
confidentiality) and AES-256-GCM (integrity + confidentiality) are supported.
The backend chooses which to apply based on the current config; the firmware
mirrors the choice. Constant-time comparison (hmac.compare_digest) prevents
timing-oracle attacks against signature verification.

CCNS mapping:
  - HMAC-SHA256 → Unit 4 (Message Integrity, MAC, Hash Functions)
  - AES-256-GCM → Unit 4 (Symmetric Encryption, Authenticated Encryption)
"""

import hashlib
import hmac as _hmac
import os
import secrets

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag


# ─── Key / Secret generation ──────────────────────────────────────────────

def generate_api_key() -> str:
    """Generate a 64-char (32-byte) random API key in hex."""
    return secrets.token_hex(32)


def hash_api_key(api_key: str) -> str:
    """One-way SHA-256 hash for storing API keys. Never store plaintext."""
    return hashlib.sha256(api_key.encode()).hexdigest()


def generate_device_secret() -> str:
    """
    Generate a 64-char (32-byte) random device secret.
    Used as:
      - HMAC-SHA256 key (all 32 bytes)
      - AES-256-GCM key (all 32 bytes = 256-bit key)
    """
    return secrets.token_hex(32)


# ─── HMAC-SHA256 ──────────────────────────────────────────────────────────

def compute_hmac(secret_hex: str, payload: str) -> str:
    """
    Compute HMAC-SHA256(secret, payload) and return the hex digest.

    Args:
        secret_hex: 64-char hex string (32 bytes) — device_secret from DB.
        payload: The raw JSON string exactly as transmitted.

    Returns:
        Lowercase 64-char hex string of the HMAC digest.
    """
    key = bytes.fromhex(secret_hex)
    sig = _hmac.new(key, payload.encode("utf-8"), hashlib.sha256)
    return sig.hexdigest()


def verify_hmac(secret_hex: str, payload: str, signature_hex: str) -> bool:
    """
    Constant-time HMAC-SHA256 verification.

    Returns True if signature matches, False otherwise.
    Uses hmac.compare_digest to prevent timing-oracle attacks.
    """
    expected = compute_hmac(secret_hex, payload)
    try:
        return _hmac.compare_digest(expected, signature_hex.strip().lower())
    except (TypeError, ValueError):
        return False


# ─── AES-256-GCM ──────────────────────────────────────────────────────────

def aes_gcm_encrypt(secret_hex: str, plaintext: str) -> dict:
    """
    Encrypt plaintext string with AES-256-GCM.

    Generates a fresh 96-bit (12-byte) random nonce per call — this is
    mandatory for GCM security. The 128-bit authentication tag is appended
    by the AESGCM wrapper and split out here for explicit transport.

    Returns:
        dict with keys: iv (24-char hex), ct (hex ciphertext), tag (32-char hex)
    """
    key = bytes.fromhex(secret_hex)          # 32 bytes = 256-bit AES key
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)                   # 96-bit nonce (GCM standard)
    # encrypt() appends the 16-byte GCM tag to the ciphertext
    ct_with_tag = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    ct    = ct_with_tag[:-16]
    tag   = ct_with_tag[-16:]
    return {
        "iv":  nonce.hex(),
        "ct":  ct.hex(),
        "tag": tag.hex(),
    }


def aes_gcm_decrypt(secret_hex: str, iv_hex: str, ct_hex: str, tag_hex: str) -> str:
    """
    Decrypt AES-256-GCM ciphertext.

    Raises:
        InvalidTag: if the authentication tag does not match — indicates
                    tampering or wrong key. Caller must treat this as a
                    tamper-detection event and log/reject accordingly.
        ValueError: if hex strings are malformed.
    """
    key  = bytes.fromhex(secret_hex)
    aesgcm = AESGCM(key)
    nonce  = bytes.fromhex(iv_hex)
    # Reassemble ciphertext + tag for AESGCM.decrypt()
    ct_with_tag = bytes.fromhex(ct_hex) + bytes.fromhex(tag_hex)
    plaintext = aesgcm.decrypt(nonce, ct_with_tag, None)
    return plaintext.decode("utf-8")
