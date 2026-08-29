// ============================================================
// CVIS ESP32 Firmware — Phase 2
// Auth + HMAC-SHA256 + AES-GCM + MQTT + Protocol Polling
// ============================================================
// Phase 2 adds:
//   - X-API-Key header on every HTTP request
//   - HMAC-SHA256 body signing (via crypto_utils.h)
//   - AES-GCM payload encryption when backend enables it
//   - Poll /api/v1/config/protocol to self-switch HTTP ↔ MQTT
//   - Subscribe to MQTT control topics for live protocol switches
//   - Publish telemetry to MQTT cvis/telemetry/{device_id}
//
// CCNS mapping:
//   Auth      → Unit 4 (Authentication, Device Identity)
//   HMAC      → Unit 4 (Message Integrity)
//   AES-GCM   → Unit 4 (Confidentiality + Authenticated Encryption)
//   MQTT      → Unit 2 (Publish-Subscribe, Message Broker)
//   Retry     → Unit 3 (Reliability, Retransmission)
// ============================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "secrets.h"
#include "crypto_utils.h"

// ─── Pin configuration ─────────────────────────────────────
#define BUTTON_PIN      0
#define LED_OK_PIN      2

// ─── MQTT broker ───────────────────────────────────────────
#define MQTT_BROKER_HOST  BACKEND_HOST   // same machine as FastAPI
#define MQTT_BROKER_PORT  1883
#define MQTT_CLIENT_ID    "cvis-vehicle-" DEVICE_ID

// ─── Config poll interval ──────────────────────────────────
#define CONFIG_POLL_INTERVAL_MS  30000   // check protocol config every 30 s

// ─── Vehicle modes ────────────────────────────────────────────
enum VehicleMode {
  MODE_HEALTHY          = 0,
  MODE_ECO              = 1,
  MODE_SPORT            = 2,
  MODE_HEAVY_TRAFFIC    = 3,
  MODE_LOW_BATTERY      = 4,
  MODE_BATTERY_OVERHEAT = 5,
  MODE_CHARGING         = 6,
  MODE_MOTOR_FAULT      = 7,
  MODE_COUNT            = 8
};

const char* MODE_NAMES[MODE_COUNT] = {
  "Healthy", "Eco", "Sport", "Heavy Traffic",
  "Low Battery", "Battery Overheating", "Charging", "Motor Fault"
};

const uint32_t MODE_INTERVALS_MS[MODE_COUNT] = {
  5000, 8000, 3000, 4000, 2000, 1000, 10000, 1000
};

// ─── Retry config ──────────────────────────────────────────
#define MAX_RETRIES     3
#define RETRY_BASE_MS   500

// ─── Active protocol: "http" | "mqtt" ───────────────────────
char activeProtocol[8] = "http";

// ─── Encryption flag (set by backend config) ────────────────
bool encryptionEnabled = false;

// ─── State ─────────────────────────────────────────────────
volatile uint8_t  currentMode      = MODE_HEALTHY;
volatile bool     modeChanged      = false;
uint32_t          lastSendMs       = 0;
uint32_t          lastConfigPollMs = 0;
uint32_t          lastPhysicsMs    = 0;

// Physics state
float state_speed      = 60.0f;
float state_batt_pct   = 80.0f;
float state_batt_temp  = 30.0f;
float state_motor_temp = 45.0f;

// ─── Network clients ───────────────────────────────────────
WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);

// ─── Telemetry packet struct ───────────────────────────────
struct TelemetryPacket {
  const char* device_id;
  const char* schema_version;
  unsigned long timestamp_ms;
  const char*  mode;
  float speed_kmh;
  float battery_pct;
  float battery_temp_c;
  float motor_temp_c;
  float range_km;
  int   fault_code;
  float charging_rate_w;
};

// ─── Helpers ──────────────────────────────────────────────────
float vary(float base, float range) {
  return base + ((float)random(-100, 100) / 100.0f) * range;
}

TelemetryPacket buildTelemetry(uint8_t mode) {
  TelemetryPacket p;
  p.device_id      = DEVICE_ID;
  p.schema_version = "1.0";
  p.timestamp_ms   = millis();
  p.mode           = MODE_NAMES[mode];
  p.fault_code     = 0;
  p.charging_rate_w = 0.0f;

  uint32_t now = millis();
  float dt = 0.1f;
  if (lastPhysicsMs > 0) {
    dt = (now - lastPhysicsMs) / 1000.0f;
  }
  if (dt > 10.0f) dt = 0.1f;
  lastPhysicsMs = now;

  float target_speed = 0;
  float target_batt = 0;
  float target_batt_t = 0;
  float target_motor_t = 0;
  float charge = 0;
  float accel_rate = 8.0f;
  float eff = 1.0f;
  float range_factor = 3.0f;

  switch (mode) {
    case MODE_HEALTHY:
      target_speed = 60; target_batt = 80; target_batt_t = 30; target_motor_t = 45; 
      break;
    case MODE_ECO:
      target_speed = 40; target_batt = 75; target_batt_t = 28; target_motor_t = 38; 
      accel_rate = 5.0f; eff = 0.6f; range_factor = 3.8f;
      break;
    case MODE_SPORT:
      target_speed = 110; target_batt = 65; target_batt_t = 35; target_motor_t = 75; 
      accel_rate = 12.0f; eff = 2.5f; range_factor = 1.8f;
      break;
    case MODE_HEAVY_TRAFFIC:
      target_speed = 15; target_batt = 70; target_batt_t = 31; target_motor_t = 42; 
      eff = 1.5f; range_factor = 2.2f;
      break;
    case MODE_LOW_BATTERY:
      target_speed = 50; target_batt = 12; target_batt_t = 32; target_motor_t = 48; 
      break;
    case MODE_BATTERY_OVERHEAT:
      target_speed = 30; target_batt = 55; target_batt_t = 58; target_motor_t = 65; 
      p.fault_code = 0x02;
      break;
    case MODE_CHARGING:
      target_speed = 0; target_batt = 100; target_batt_t = 38; target_motor_t = 32; 
      charge = 7400;
      break;
    case MODE_MOTOR_FAULT:
      target_speed = 0; target_batt = 60; target_batt_t = 33; target_motor_t = 95; 
      p.fault_code = 0x04; accel_rate = 20.0f;
      break;
  }

  if (state_batt_pct <= 0.0f && mode != MODE_CHARGING) {
      target_speed = 0.0f;
      accel_rate = 5.0f;
  }

  // Speed physics
  float speed_diff = target_speed - state_speed;
  if (abs(speed_diff) < accel_rate * dt) {
      state_speed = target_speed;
  } else {
      state_speed += (accel_rate * dt) * (speed_diff > 0 ? 1 : -1);
  }

  // Battery physics
  float base_drain = 0.02f;
  float power_usage = base_drain + (state_speed / 100.0f) * (state_speed / 100.0f) * 0.15f * eff;
  
  if (mode == MODE_CHARGING) {
      state_batt_pct += 1.0f * dt;
      p.charging_rate_w = vary(charge, 500);
  } else {
      state_batt_pct -= power_usage * dt;
  }

  if (mode == MODE_LOW_BATTERY || mode == MODE_BATTERY_OVERHEAT) {
      float batt_diff = target_batt - state_batt_pct;
      if (abs(batt_diff) > 1.0f) {
          state_batt_pct += (5.0f * dt) * (batt_diff > 0 ? 1 : -1);
      }
  }

  state_batt_pct = constrain(state_batt_pct, 0.0f, 100.0f);

  // Thermal physics
  state_batt_temp += (target_batt_t - state_batt_temp) * 0.2f * dt;
  state_motor_temp += (target_motor_t - state_motor_temp) * 0.2f * dt;

  p.speed_kmh      = max(0.0f, vary(state_speed, 1.5f));
  p.battery_pct    = state_batt_pct;
  p.battery_temp_c = max(0.0f, vary(state_batt_temp, 0.5f));
  p.motor_temp_c   = max(0.0f, vary(state_motor_temp, 1.5f));
  p.range_km       = max(0.0f, vary(state_batt_pct * range_factor, 2.0f));

  return p;
}

// ─── Serialize to canonical JSON ─────────────────────────────
String serializeTelemetry(const TelemetryPacket& p) {
  StaticJsonDocument<512> doc;
  doc["device_id"]       = p.device_id;
  doc["schema_version"]  = p.schema_version;
  doc["timestamp_ms"]    = p.timestamp_ms;
  doc["mode"]            = p.mode;
  doc["speed_kmh"]       = round(p.speed_kmh * 10) / 10.0;
  doc["battery_pct"]     = round(p.battery_pct * 10) / 10.0;
  doc["battery_temp_c"]  = round(p.battery_temp_c * 10) / 10.0;
  doc["motor_temp_c"]    = round(p.motor_temp_c * 10) / 10.0;
  doc["range_km"]        = round(p.range_km * 10) / 10.0;
  doc["fault_code"]      = p.fault_code;
  doc["charging_rate_w"] = round(p.charging_rate_w);
  String out;
  serializeJson(doc, out);
  return out;
}

// ─── HTTP POST with auth + HMAC + optional AES-GCM ─────────
bool postViaHttp(const TelemetryPacket& pkt) {
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/v1/telemetry";
  String plaintext = serializeTelemetry(pkt);

  // Compute HMAC of plaintext
  char hmacHex[65];
  if (!hmacSha256(DEVICE_SECRET, plaintext.c_str(), hmacHex)) {
    Serial.println("[AUTH] HMAC computation failed");
    return false;
  }

  String body;
  bool   encrypted = encryptionEnabled;

  if (encrypted) {
    // Encrypt plaintext with AES-GCM
    size_t ctBufLen = plaintext.length() * 2 + 1;
    char  ivHex[25], tagHex[33];
    char* ctHex = (char*)malloc(ctBufLen);
    if (!ctHex || !aesGcmEncrypt(DEVICE_SECRET, plaintext.c_str(), ivHex, ctHex, tagHex)) {
      Serial.println("[CRYPTO] AES-GCM encryption failed");
      if (ctHex) free(ctHex);
      encrypted = false;  // fall back to plaintext
    } else {
      StaticJsonDocument<2048> env;
      env["iv"]  = ivHex;
      env["ct"]  = ctHex;
      env["tag"] = tagHex;
      serializeJson(env, body);
      free(ctHex);
    }
  }

  if (!encrypted) {
    body = plaintext;
  }

  uint32_t delayMs = RETRY_BASE_MS;
  for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    HTTPClient http;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", API_KEY);
    http.addHeader("X-HMAC-Signature", hmacHex);
    if (encrypted) http.addHeader("X-Encrypted", "true");
    http.setTimeout(4000);

    int code = http.POST(body);
    if (code >= 200 && code < 300) {
      Serial.printf("[HTTP] POST OK (attempt %d, %s) → %d\n",
                    attempt, encrypted ? "AES-GCM" : "plain", code);
      http.end();
      return true;
    } else {
      Serial.printf("[HTTP] POST FAILED attempt %d — HTTP %d\n", attempt, code);
      http.end();
      if (attempt < MAX_RETRIES) { delay(delayMs); delayMs *= 2; }
    }
  }
  Serial.println("[HTTP] All retries exhausted.");
  return false;
}

// ─── MQTT publish with auth + HMAC in envelope ──────────────
bool publishViaMqtt(const TelemetryPacket& pkt) {
  if (!mqttClient.connected()) {
    Serial.println("[MQTT] Not connected — attempting reconnect...");
    mqttClient.connect(MQTT_CLIENT_ID);
    if (!mqttClient.connected()) return false;
  }

  String plaintext = serializeTelemetry(pkt);
  char   hmacHex[65];
  hmacSha256(DEVICE_SECRET, plaintext.c_str(), hmacHex);

  StaticJsonDocument<2048> envelope;
  JsonObject meta = envelope.createNestedObject("_meta");
  meta["api_key"] = API_KEY;
  meta["hmac"]    = hmacHex;

  bool encrypted = encryptionEnabled;
  if (encrypted) {
    size_t ctBufLen = plaintext.length() * 2 + 1;
    char ivHex[25], tagHex[33];
    char* ctHex = (char*)malloc(ctBufLen);
    if (ctHex && aesGcmEncrypt(DEVICE_SECRET, plaintext.c_str(), ivHex, ctHex, tagHex)) {
      envelope["encrypted"] = true;
      envelope["iv"]  = ivHex;
      envelope["ct"]  = ctHex;
      envelope["tag"] = tagHex;
      free(ctHex);
    } else {
      if (ctHex) free(ctHex);
      encrypted = false;
    }
  }

  if (!encrypted) {
    // Merge telemetry fields into envelope
    StaticJsonDocument<512> inner;
    deserializeJson(inner, plaintext);
    for (JsonPair kv : inner.as<JsonObject>()) {
      envelope[kv.key()] = kv.value();
    }
  }

  String payload;
  serializeJson(envelope, payload);

  String topic = String("cvis/telemetry/") + DEVICE_ID;
  bool ok = mqttClient.publish(topic.c_str(), payload.c_str());
  if (ok) {
    Serial.printf("[MQTT] Published to %s (%s, %d bytes)\n",
                  topic.c_str(), encrypted ? "AES-GCM" : "plain", payload.length());
  } else {
    Serial.println("[MQTT] Publish failed");
  }
  return ok;
}

// ─── Poll backend for active protocol ───────────────────────
void pollProtocol() {
  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT
               + "/api/v1/config/protocol";
  http.begin(url);
  http.addHeader("X-API-Key", API_KEY);
  int code = http.GET();
  if (code == 200) {
    String resp = http.getString();
    StaticJsonDocument<128> doc;
    if (!deserializeJson(doc, resp)) {
      const char* proto = doc["active_protocol"];
      if (proto && strcmp(proto, activeProtocol) != 0) {
        strncpy(activeProtocol, proto, sizeof(activeProtocol) - 1);
        Serial.printf("[CONFIG] Protocol switched to: %s\n", activeProtocol);
      }
    }
  }

  // Also check encryption config
  url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT
        + "/api/v1/config/encryption";
  http.begin(url);
  http.addHeader("X-API-Key", API_KEY);
  code = http.GET();
  if (code == 200) {
    String resp = http.getString();
    StaticJsonDocument<128> doc;
    if (!deserializeJson(doc, resp)) {
      bool enc = doc["encryption_enabled"] | false;
      if (enc != encryptionEnabled) {
        encryptionEnabled = enc;
        Serial.printf("[CONFIG] Encryption %s\n", enc ? "ENABLED" : "DISABLED");
      }
    }
  }
  http.end();
}

// ─── MQTT callbacks ────────────────────────────────────────
void mqttOnMessage(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];

  if (String(topic) == "cvis/config/protocol") {
    if (msg != String(activeProtocol)) {
      strncpy(activeProtocol, msg.c_str(), sizeof(activeProtocol) - 1);
      Serial.printf("[MQTT] Protocol switched to: %s\n", activeProtocol);
    }
  } else if (String(topic) == "cvis/config/encryption") {
    bool enc = (msg == "true");
    if (enc != encryptionEnabled) {
      encryptionEnabled = enc;
      Serial.printf("[MQTT] Encryption %s\n", enc ? "ENABLED" : "DISABLED");
    }
  }
}

void connectMqtt() {
  mqttClient.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
  mqttClient.setCallback(mqttOnMessage);
  mqttClient.setKeepAlive(60);

  if (mqttClient.connect(MQTT_CLIENT_ID)) {
    mqttClient.subscribe("cvis/config/protocol");
    mqttClient.subscribe("cvis/config/encryption");
    Serial.println("[MQTT] Connected to broker");
  } else {
    Serial.printf("[MQTT] Connect failed, state=%d\n", mqttClient.state());
  }
}

// ─── Button ISR ───────────────────────────────────────────────
volatile uint32_t lastDebounceMs = 0;
void IRAM_ATTR onButtonPress() {
  uint32_t now = millis();
  if (now - lastDebounceMs > 300) {
    lastDebounceMs = now;
    currentMode = (currentMode + 1) % MODE_COUNT;
    modeChanged = true;
    if (currentMode == MODE_CHARGING) chargingBattPct = 45;
  }
}

void blinkOK(int times = 1) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_OK_PIN, HIGH); delay(80);
    digitalWrite(LED_OK_PIN, LOW);  delay(80);
  }
}

// ─── setup() ──────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== CVIS Vehicle Node — Phase 2 ===");

  pinMode(LED_OK_PIN, OUTPUT);
  digitalWrite(LED_OK_PIN, LOW);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), onButtonPress, FALLING);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.printf("\n[WiFi] Connected — IP: %s\n", WiFi.localIP().toString().c_str());
  blinkOK(3);

  // Initial config poll
  pollProtocol();

  // Connect MQTT (non-fatal if broker not up)
  connectMqtt();

  randomSeed(analogRead(34));
  lastConfigPollMs = millis();
}

// ─── loop() ───────────────────────────────────────────────────
void loop() {
  // Keep MQTT alive
  if (mqttClient.connected()) mqttClient.loop();

  uint8_t  mode     = currentMode;
  uint32_t interval = MODE_INTERVALS_MS[mode];
  uint32_t now      = millis();

  // Mode change: log + send immediately
  if (modeChanged) {
    modeChanged = false;
    Serial.printf("\n[MODE] → %s (interval %ums, proto=%s%s)\n",
                  MODE_NAMES[mode], interval, activeProtocol,
                  encryptionEnabled ? "+AES-GCM" : "");
    lastSendMs = 0;
  }

  // Periodic config poll
  if (now - lastConfigPollMs >= CONFIG_POLL_INTERVAL_MS) {
    lastConfigPollMs = now;
    pollProtocol();
  }

  // Send telemetry
  if (now - lastSendMs >= interval) {
    lastSendMs = now;
    TelemetryPacket pkt = buildTelemetry(mode);

    Serial.printf("[TX] [%s%s] Mode: %-20s | Batt: %5.1f%% | Speed: %5.1f km/h"
                  " | Motor: %5.1f°C | Fault: 0x%02X\n",
                  activeProtocol, encryptionEnabled ? "+ENC" : "",
                  pkt.mode, pkt.battery_pct, pkt.speed_kmh,
                  pkt.motor_temp_c, pkt.fault_code);

    bool ok;
    if (strcmp(activeProtocol, "mqtt") == 0) {
      if (!mqttClient.connected()) connectMqtt();
      ok = publishViaMqtt(pkt);
    } else {
      ok = postViaHttp(pkt);
    }

    if (ok) blinkOK(1);
    else   { blinkOK(2); delay(200); blinkOK(2); }
  }
}
