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

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
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
uint32_t          lastSendMs       = 0;
uint32_t          lastConfigPollMs = 0;
uint32_t          lastPhysicsMs    = 0;
uint32_t          tickCounter      = 0;

// Physics state
float state_speed        = 60.0f;
float state_batt_pct     = 95.0f;
float state_batt_temp    = 30.0f;
float state_motor_temp   = 45.0f;
float state_charge_rate  = 0.0f;

// Advanced environment state
float env_ambient_temp   = 25.0f;
float env_headwind       = 10.0f;
float env_road_grad      = 0.0f;
float env_tire_psi       = 34.0f;
float env_cabin_w        = 500.0f;
float env_cell_delta     = 0.01f;

float target_speed       = 60.0f;
int   current_fault      = 0;
const char* current_mode = "Healthy";

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
  float ambient_temp_c;
  float headwind_kmh;
  float road_gradient_pct;
  float tire_pressure_psi;
  float cabin_climate_w;
  float max_cell_voltage_delta;
};

// ─── Helpers ──────────────────────────────────────────────────
float vary(float base, float range) {
  return base + ((float)random(-100, 100) / 100.0f) * range;
}

void tickPhysics(float dt) {
  tickCounter++;
  
  if (tickCounter % 5 == 0) {
    env_road_grad += ((float)random(-100, 100) / 100.0f);
    env_road_grad = constrain(env_road_grad, -10.0f, 10.0f);
    env_headwind += ((float)random(-200, 200) / 100.0f);
    env_headwind = constrain(env_headwind, 0.0f, 50.0f);
  }
  
  if (tickCounter % 10 == 0 && current_fault == 0) {
    target_speed += ((float)random(-1500, 1500) / 100.0f);
    target_speed = constrain(target_speed, 0.0f, 120.0f);
  }

  // Smooth acceleration
  if (state_speed < target_speed) state_speed += 2.0f * dt;
  else if (state_speed > target_speed) state_speed -= 2.0f * dt;
  state_speed = max(0.0f, state_speed);

  // Load calculation
  float aero_drag = ((state_speed + env_headwind) * (state_speed + env_headwind)) / 10000.0f;
  float gravity_drag = env_road_grad * 0.5f;
  float tire_drag = max(0.0f, (36.0f - env_tire_psi) * 0.1f);
  float load_factor = (state_speed / 50.0f) + aero_drag + gravity_drag + tire_drag;
  load_factor = max(0.1f, load_factor);
  if (state_speed == 0) load_factor = 0.1f;

  float drain_rate = load_factor * 0.1f * dt;
  drain_rate += (env_cabin_w / 5000.0f) * dt;
  state_batt_pct -= drain_rate;
  state_batt_pct = max(0.0f, state_batt_pct);

  float heating = load_factor * 2.0f * dt;
  float cooling = (state_motor_temp - env_ambient_temp) * 0.05f * dt;
  state_motor_temp += (heating - cooling);

  float batt_heating = drain_rate * 5.0f;
  float batt_cooling = (state_batt_temp - env_ambient_temp) * 0.02f * dt;
  state_batt_temp += (batt_heating - batt_cooling);

  current_fault = 0;
  current_mode = "Healthy";
  
  if (state_speed > 80.0f) current_mode = "Sport";
  else if (state_speed > 0 && state_speed < 30.0f) current_mode = "Heavy Traffic";
  else if (state_speed == 0 && state_charge_rate > 0) current_mode = "Charging";

  if (state_batt_pct <= 15.0f) current_mode = "Low Battery";
  if (state_batt_pct <= 0) {
    state_speed = 0; target_speed = 0;
  }

  if (state_motor_temp > 95.0f) {
    current_fault = 0x04;
    current_mode = "Motor Fault";
    target_speed = 0;
  }
  if (state_batt_temp > 60.0f) {
    current_fault = 0x02;
    current_mode = "Battery Overheating";
    if (target_speed > 40.0f) target_speed = 40.0f;
  }
}

TelemetryPacket buildTelemetry() {
  uint32_t now = millis();
  float dt = 0.1f;
  if (lastPhysicsMs > 0) dt = (now - lastPhysicsMs) / 1000.0f;
  if (dt > 5.0f) dt = 0.1f;
  lastPhysicsMs = now;

  tickPhysics(dt);

  float base_range = state_batt_pct * 3.0f;
  if (env_tire_psi < 32.0f) base_range *= 0.9f;
  if (env_headwind > 20.0f) base_range *= 0.85f;
  if (env_cabin_w > 1000.0f) base_range *= 0.95f;
  float range_val = max(0.0f, base_range);

  TelemetryPacket p;
  p.device_id      = DEVICE_ID;
  p.schema_version = "1.0";
  p.timestamp_ms   = now;
  p.mode           = current_mode;
  p.speed_kmh      = state_speed;
  p.battery_pct    = state_batt_pct;
  p.battery_temp_c = state_batt_temp;
  p.motor_temp_c   = state_motor_temp;
  p.range_km       = range_val;
  p.fault_code     = current_fault;
  p.charging_rate_w = state_charge_rate;
  p.ambient_temp_c = env_ambient_temp;
  p.headwind_kmh   = env_headwind;
  p.road_gradient_pct = env_road_grad;
  p.tire_pressure_psi = env_tire_psi;
  p.cabin_climate_w   = env_cabin_w;
  p.max_cell_voltage_delta = env_cell_delta;

  return p;
}

// ─── Serialize to canonical JSON ─────────────────────────────
String serializeTelemetry(const TelemetryPacket& p) {
  StaticJsonDocument<1024> doc;
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
  doc["ambient_temp_c"]  = round(p.ambient_temp_c * 10) / 10.0;
  doc["headwind_kmh"]    = round(p.headwind_kmh * 10) / 10.0;
  doc["road_gradient_pct"] = round(p.road_gradient_pct * 10) / 10.0;
  doc["tire_pressure_psi"] = round(p.tire_pressure_psi * 10) / 10.0;
  doc["cabin_climate_w"]   = round(p.cabin_climate_w * 10) / 10.0;
  doc["max_cell_voltage_delta"] = round(p.max_cell_voltage_delta * 1000) / 1000.0;
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
    WiFiClient client;
    HTTPClient http;
    http.begin(client, url);
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
  WiFiClient client;
  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT
               + "/api/v1/config/protocol";
  http.begin(client, url);
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
  http.begin(client, url);
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

// ─── Button ISR (Inject Faults) ───────────────────────────────
volatile uint32_t lastDebounceMs = 0;
void ICACHE_RAM_ATTR onButtonPress() {
  uint32_t now = millis();
  if (now - lastDebounceMs > 300) {
    lastDebounceMs = now;
    // Inject extreme load to trigger faults
    target_speed = 120.0f;
    env_tire_psi = 10.0f;
    env_road_grad = 10.0f;
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

  randomSeed(analogRead(A0));
  lastConfigPollMs = millis();
}

// ─── loop() ───────────────────────────────────────────────────
void loop() {
  if (mqttClient.connected()) mqttClient.loop();

  uint32_t now = millis();

  // Periodic config poll
  if (now - lastConfigPollMs >= CONFIG_POLL_INTERVAL_MS) {
    lastConfigPollMs = now;
    pollProtocol();
  }

  // Send telemetry every 2 seconds
  if (now - lastSendMs >= 2000) {
    lastSendMs = now;
    TelemetryPacket pkt = buildTelemetry();

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
