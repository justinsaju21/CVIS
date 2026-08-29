"""
CVIS Backend — db.py
--------------------
Manages the aiosqlite connection and schema initialisation.

Design rationale: A single async database module keeps all SQL in one place,
making it straightforward to migrate to Postgres later (Phase 5+ if required).
The schema is versioned via a `schema_version` table so future migrations can
detect what state the DB is in without external tools.
"""

import aiosqlite
import logging
from pathlib import Path
from config import settings

logger = logging.getLogger("cvis.db")

# The single shared connection, opened at startup and closed at shutdown.
_db: aiosqlite.Connection | None = None


async def get_db() -> aiosqlite.Connection:
    """Return the active database connection (opened at startup)."""
    if _db is None:
        raise RuntimeError("Database not initialised — call init_db() first.")
    return _db


async def init_db() -> None:
    """Open the SQLite connection and create all tables if they don't exist."""
    global _db
    db_path = Path(settings.DATABASE_URL)
    logger.info(f"Opening database: {db_path.resolve()}")

    _db = await aiosqlite.connect(db_path)
    _db.row_factory = aiosqlite.Row  # rows behave like dicts

    await _db.execute("PRAGMA journal_mode=WAL;")   # concurrent read-write
    await _db.execute("PRAGMA foreign_keys=ON;")

    await _create_schema()
    logger.info("Database ready.")


async def close_db() -> None:
    """Gracefully close the database connection."""
    global _db
    if _db:
        await _db.close()
        _db = None
        logger.info("Database connection closed.")


async def _create_schema() -> None:
    """
    Create all tables for Phase 1 + Phase 2.

    packets     — raw log of every inbound packet (protocol-agnostic).
    telemetry   — parsed, structured telemetry fields for each packet.
    devices     — registered vehicle nodes (device_id, api_key, secret).
    auth_logs   — every authentication and tamper event.
    server_config — persistent key-value store for runtime config state.
    """
    assert _db is not None

    await _db.executescript("""
        -- ── Schema version tracker ────────────────────────────────
        CREATE TABLE IF NOT EXISTS schema_version (
            version     TEXT PRIMARY KEY,
            applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- ── Raw packet log ───────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS packets (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            received_at       TEXT    NOT NULL,
            device_id         TEXT    NOT NULL,
            protocol          TEXT    NOT NULL DEFAULT 'http',
            direction         TEXT    NOT NULL DEFAULT 'inbound',
            size_bytes        INTEGER,
            status            TEXT    NOT NULL,
            raw_json          TEXT    NOT NULL,
            encrypted         INTEGER NOT NULL DEFAULT 0,
            encryption_method TEXT    NOT NULL DEFAULT 'PLAIN'
        );

        CREATE INDEX IF NOT EXISTS idx_packets_device_id   ON packets(device_id);
        CREATE INDEX IF NOT EXISTS idx_packets_received_at ON packets(received_at);

        -- ── Structured telemetry ───────────────────────────────────
        CREATE TABLE IF NOT EXISTS telemetry (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            packet_id       INTEGER NOT NULL REFERENCES packets(id),
            received_at     TEXT    NOT NULL,
            device_id       TEXT    NOT NULL,
            schema_version  TEXT    NOT NULL,
            mode            TEXT    NOT NULL,
            speed_kmh       REAL,
            battery_pct     REAL,
            battery_temp_c  REAL,
            motor_temp_c    REAL,
            range_km        REAL,
            fault_code      INTEGER,
            charging_rate_w REAL
        );

        CREATE INDEX IF NOT EXISTS idx_telemetry_device_id   ON telemetry(device_id);
        CREATE INDEX IF NOT EXISTS idx_telemetry_received_at ON telemetry(received_at);

        -- ── Device registry ────────────────────────────────────────
        -- Each registered ESP32 gets a unique api_key and device_secret.
        -- api_key_hash: SHA-256 of the plaintext api_key (one-way).
        -- device_secret: raw 32-byte hex used for HMAC-SHA256 / AES-GCM.
        CREATE TABLE IF NOT EXISTS devices (
            device_id       TEXT    PRIMARY KEY,
            api_key_hash    TEXT    NOT NULL UNIQUE,
            device_secret   TEXT    NOT NULL,
            registered_at   TEXT    NOT NULL DEFAULT (datetime('now')),
            active          INTEGER NOT NULL DEFAULT 1
        );

        -- ── Auth + tamper event log ────────────────────────────────
        -- Every auth event is logged here for NOC/admin visibility.
        -- event_type: 'auth_ok' | 'auth_fail' | 'tamper_detected' |
        --             'registered' | 'no_auth'
        CREATE TABLE IF NOT EXISTS auth_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp   TEXT    NOT NULL,
            device_id   TEXT,
            event_type  TEXT    NOT NULL,
            ip_address  TEXT,
            details     TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_auth_logs_timestamp  ON auth_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_auth_logs_event_type ON auth_logs(event_type);

        -- ── Server runtime config (persistent) ────────────────────
        -- Used for protocol, encryption, auth toggle, chaos settings.
        -- Keys: 'active_protocol', 'encryption_enabled', 'auth_enabled',
        --       'chaos_loss_pct', 'chaos_latency_ms', 'chaos_tamper'
        CREATE TABLE IF NOT EXISTS server_config (
            key         TEXT PRIMARY KEY,
            value       TEXT NOT NULL,
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)

    # Seed default config values (INSERT OR IGNORE — won't overwrite existing)
    defaults = [
        ("active_protocol",    "http"),
        ("encryption_enabled", "false"),
        ("auth_enabled",       "true"),
        ("chaos_loss_pct",     "0"),
        ("chaos_latency_ms",   "0"),
        ("chaos_tamper",       "false"),
        ("replay_protection",  "false"),
        ("mobile_app_enabled", "true"),
    ]
    for key, value in defaults:
        await _db.execute(
            "INSERT OR IGNORE INTO server_config (key, value) VALUES (?, ?)",
            (key, value),
        )

    # Migrate existing DB: add columns if missing (schema 2.1 → 2.2)
    assert _db is not None
    for col_def in [
        "ALTER TABLE packets ADD COLUMN encrypted INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE packets ADD COLUMN encryption_method TEXT NOT NULL DEFAULT 'PLAIN'",
        "ALTER TABLE packets ADD COLUMN auth_status TEXT NOT NULL DEFAULT 'ok'",
        # schema 2.2 — mobile access control
        "ALTER TABLE devices ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'",
        "ALTER TABLE devices ADD COLUMN mobile_access_enabled INTEGER NOT NULL DEFAULT 0",
    ]:
        try:
            await _db.execute(col_def)
            await _db.commit()
            logger.info(f"DB migrated: {col_def}")
        except Exception:
            pass  # column already exists

    # Seed tier/mobile_access for the 4 known ESP32 nodes
    # Alpha and Beta are Premium; Gamma and Delta are Free (demo split)
    premium_devices = ["ESP32-ALPHA", "ESP32-BETA"]
    for device_id in premium_devices:
        await _db.execute(
            "UPDATE devices SET tier = 'premium' WHERE device_id = ? AND tier = 'free'",
            (device_id,),
        )
    await _db.commit()

    # Record schema version
    await _db.execute(
        "INSERT OR IGNORE INTO schema_version (version) VALUES (?)",
        ("2.1",)
    )
    await _db.execute(
        "INSERT OR IGNORE INTO schema_version (version) VALUES (?)",
        ("2.2",)
    )
    await _db.commit()


async def get_config(key: str) -> str | None:
    """Read a single value from server_config."""
    db = await get_db()
    async with db.execute(
        "SELECT value FROM server_config WHERE key = ?", (key,)
    ) as cur:
        row = await cur.fetchone()
    return row["value"] if row else None


async def set_config(key: str, value: str) -> None:
    """Upsert a value into server_config."""
    db = await get_db()
    await db.execute(
        """
        INSERT INTO server_config (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                       updated_at = excluded.updated_at
        """,
        (key, value),
    )
    await db.commit()

