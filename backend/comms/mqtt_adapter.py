"""
CVIS Backend — comms/mqtt_adapter.py
--------------------------------------
MQTT subscriber adapter — receives telemetry published by ESP32 nodes.

Design rationale: paho-mqtt runs a blocking event loop in a dedicated daemon
thread. Messages are dispatched into the FastAPI asyncio event loop via
run_coroutine_threadsafe(), so the ingest pipeline is the same regardless of
whether the packet arrived via HTTP or MQTT. This keeps the protocol layer
transparent to the rest of the backend.

Topic structure:
  cvis/telemetry/{device_id}    — inbound telemetry from vehicle
  cvis/config/protocol          — backend broadcasts protocol switches to ESP32
  cvis/config/encryption        — backend broadcasts encryption toggle to ESP32

MQTT payload (plaintext mode):
{
    "_meta": {"api_key": "...", "hmac": "..."},
    "device_id": "...", "schema_version": "1.0", ...telemetry fields...
}

MQTT payload (AES-GCM encrypted mode):
{
    "_meta": {"api_key": "...", "hmac": "...of plaintext..."},
    "encrypted": true, "iv": "...", "ct": "...", "tag": "..."
}

CCNS mapping:
  - MQTT publish-subscribe → Unit 2 (Application Layer Protocols, Message Brokers)
  - Topic-based routing → Unit 2 (Addressing, Multiplexing)
"""

import asyncio
import json
import logging
import threading
from typing import Callable, Awaitable, Optional

import paho.mqtt.client as mqtt

logger = logging.getLogger("cvis.mqtt")

BROKER_HOST = "localhost"
BROKER_PORT = 1883
TOPIC_TELEMETRY = "cvis/telemetry/+"
TOPIC_CONFIG_PROTOCOL   = "cvis/config/protocol"
TOPIC_CONFIG_ENCRYPTION = "cvis/config/encryption"


class MqttAdapter:
    """
    Wraps paho-mqtt to receive CVIS telemetry over MQTT.

    The adapter runs the paho loop in a background thread and bridges
    messages into the asyncio event loop of the FastAPI server.
    """

    def __init__(self) -> None:
        self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2,
                                   client_id="cvis-backend")
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self._on_telemetry: Optional[Callable[[str, str], Awaitable[None]]] = None
        self._running = False

        self._client.on_connect    = self._on_connect
        self._client.on_message    = self._on_message
        self._client.on_disconnect = self._on_disconnect

    def set_telemetry_handler(
        self, handler: Callable[[str, str], Awaitable[None]]
    ) -> None:
        """Register the async coroutine to call for each telemetry message."""
        self._on_telemetry = handler

    def start(self, loop: asyncio.AbstractEventLoop) -> bool:
        """
        Connect to the broker and start the paho loop in a daemon thread.
        Returns True if connection succeeded, False if broker is unavailable.
        """
        self._loop = loop
        try:
            self._client.connect(BROKER_HOST, BROKER_PORT, keepalive=60)
        except Exception as e:
            logger.warning(f"[MQTT] Cannot connect to broker at "
                           f"{BROKER_HOST}:{BROKER_PORT} — {e}")
            logger.warning("[MQTT] Adapter inactive. Start Mosquitto to enable MQTT.")
            return False

        self._running = True
        self._thread = threading.Thread(
            target=self._client.loop_forever,
            daemon=True,
            name="mqtt-paho-loop",
        )
        self._thread.start()
        logger.info(f"[MQTT] Adapter started — broker {BROKER_HOST}:{BROKER_PORT}")
        return True

    def stop(self) -> None:
        """Disconnect and stop the paho loop."""
        if self._running:
            self._client.disconnect()
            self._running = False
            logger.info("[MQTT] Adapter stopped.")

    def publish_config(self, key: str, value: str) -> None:
        """
        Publish a config update to all subscribed ESP32 nodes.
        Used for protocol-switch and encryption-toggle broadcasts.
        """
        if not self._running:
            return
        topic = f"cvis/config/{key}"
        self._client.publish(topic, value, qos=1, retain=True)
        logger.info(f"[MQTT] Config broadcast: {topic} = {value}")

    # ─── paho callbacks ────────────────────────────────────────────────────

    def _on_connect(self, client, userdata, flags, reason_code, properties) -> None:
        if reason_code == 0:
            client.subscribe(TOPIC_TELEMETRY, qos=1)
            logger.info("[MQTT] Connected to broker, subscribed to cvis/telemetry/+")
        else:
            logger.error(f"[MQTT] Connection failed: reason_code={reason_code}")

    def _on_disconnect(self, client, userdata, flags, reason_code, properties) -> None:
        if reason_code != 0:
            logger.warning(f"[MQTT] Unexpected disconnect: {reason_code} — paho will retry")

    def _on_message(self, client, userdata, msg: mqtt.MQTTMessage) -> None:
        """
        Called by paho in its thread. Bridge into the asyncio event loop.
        """
        topic   = msg.topic
        payload = msg.payload.decode("utf-8", errors="replace")

        if self._on_telemetry and self._loop:
            future = asyncio.run_coroutine_threadsafe(
                self._on_telemetry(topic, payload),
                self._loop,
            )
            # Log but don't block on result
            future.add_done_callback(self._handle_future_error)

    @staticmethod
    def _handle_future_error(fut) -> None:
        if not fut.cancelled() and fut.exception():
            logger.error(f"[MQTT] Ingest coroutine raised: {fut.exception()}")


# Module-level singleton
mqtt_adapter = MqttAdapter()
