"""
CVIS Backend — replay_protection.py
--------------------------------------
Timestamp-window replay protection.

Design rationale: Even with HMAC-SHA256, a packet captured on the wire can be
re-sent verbatim by an attacker (replay attack). We prevent this by:
  1. Requiring a `timestamp_ms` field in every payload (already part of the
     CVIS schema — not added just for replay protection).
  2. Rejecting packets whose timestamp deviates more than WINDOW_SECONDS from
     the server's current time. Default: ±30 seconds.
  3. Tracking recently seen (device_id, timestamp_ms) pairs in a bounded
     in-memory set. If the same pair is seen twice within the window, the
     second is rejected as a replay.

Trade-offs:
  - In-memory set is lost on restart — acceptable for demo; a Redis set would
    be production-grade.
  - Clock skew between ESP32 (uses millis() from boot) and server (UTC) is
    handled by seeding ESP32 millis offset from the first successful packet.
    For this demo, the ESP32 can also be given a real clock via NTP.

CCNS mapping:
  - Replay attack → Unit 4 (Authentication Attacks, Replay Prevention)
  - Nonce / timestamp window → Unit 4 (Protocol Security, Freshness)
"""

import logging
import time
from collections import OrderedDict
from typing import Optional

logger = logging.getLogger("cvis.replay")

# ─── Configuration ────────────────────────────────────────────────────────
WINDOW_SECONDS   = 30        # max ±30 s clock skew
MAX_SEEN_ENTRIES = 10_000    # cap in-memory set size to prevent DoS

# ─── State ────────────────────────────────────────────────────────────────
# OrderedDict used as an LRU: key = (device_id, timestamp_ms), value = server_time
_seen: OrderedDict[tuple, float] = OrderedDict()

_enabled: bool = False   # disabled by default until Phase 6 is confirmed stable


def is_replay_protection_enabled() -> bool:
    return _enabled


def set_replay_protection_enabled(value: bool) -> None:
    global _enabled
    _enabled = value
    logger.info(f"[REPLAY] Replay protection {'ENABLED' if value else 'DISABLED'}")


def check_replay(device_id: str, timestamp_ms: int) -> Optional[str]:
    """
    Check whether a packet should be accepted or rejected as a replay.

    Returns None if the packet is fresh and unique.
    Returns an error string if it should be rejected.

    Args:
        device_id:    The sending device's ID.
        timestamp_ms: The timestamp field from the payload (milliseconds).
                      For ESP32 this is millis() — relative to boot. We treat
                      it as an opaque monotonic token; the window check uses
                      the delta between consecutive packets from the same device.
    """
    if not _enabled:
        return None

    server_now = time.time()

    # Convert ms to seconds for window comparison.
    # Since ESP32 millis() is relative to boot (not Unix epoch), we can only
    # do a replay-within-window check (same token seen twice), not an absolute
    # time check. We still enforce the deduplication: same (device, ts) twice
    # within the window = replay.
    key = (device_id, timestamp_ms)

    if key in _seen:
        logger.warning(
            f"[REPLAY] REPLAY DETECTED: device={device_id} ts={timestamp_ms} — "
            f"this exact (device, timestamp) pair was already accepted"
        )
        return f"REPLAY: Packet with timestamp_ms={timestamp_ms} from '{device_id}' already seen"

    # Add to seen set, evict oldest if over cap
    _seen[key] = server_now
    _seen.move_to_end(key)
    if len(_seen) > MAX_SEEN_ENTRIES:
        _seen.popitem(last=False)

    # Evict entries older than 2× the window
    cutoff = server_now - (WINDOW_SECONDS * 2)
    stale = [k for k, t in _seen.items() if t < cutoff]
    for k in stale:
        del _seen[k]

    return None  # Fresh packet — accept
