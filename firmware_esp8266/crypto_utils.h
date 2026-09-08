// ================================================================
// CVIS ESP8266 — crypto_utils.h
// Hardware HMAC-SHA256 using BearSSL (native to ESP8266).
// AES-256-GCM is disabled in this ESP8266 port due to lack of 
// hardware acceleration.
// ================================================================

#pragma once

#include <Arduino.h>
#include <string.h>
#include <bearssl/bearssl_hash.h>
#include <bearssl/bearssl_hmac.h>

// ─── Hex conversion helpers ────────────────────────────────────
static void bytesToHex(const uint8_t* bytes, size_t len, char* out) {
  for (size_t i = 0; i < len; i++) {
    sprintf(out + i * 2, "%02x", bytes[i]);
  }
  out[len * 2] = '\0';
}

static bool hexToBytes(const char* hex, uint8_t* out, size_t outLen) {
  size_t hexLen = strlen(hex);
  if (hexLen != outLen * 2) return false;
  for (size_t i = 0; i < outLen; i++) {
    char byte_str[3] = {hex[i * 2], hex[i * 2 + 1], '\0'};
    out[i] = (uint8_t)strtol(byte_str, nullptr, 16);
  }
  return true;
}

// ─── HMAC-SHA256 ──────────────────────────────────────────────
// Computes HMAC-SHA256(secret, data) and stores hex in outHex[65].
static bool hmacSha256(
  const char* secretHex,   // 64-char hex device_secret
  const char* data,        // JSON payload string
  char*       outHex       // output: 64-char hex HMAC + null
) {
  uint8_t secret[32];
  if (!hexToBytes(secretHex, secret, 32)) {
    Serial.println("[CRYPTO] hmacSha256: invalid secret hex");
    return false;
  }

  br_hmac_key_context kc;
  br_hmac_context ctx;
  
  // Initialize BearSSL HMAC with SHA-256 and the secret key
  br_hmac_key_init(&kc, &br_sha256_vtable, secret, 32);
  br_hmac_init(&ctx, &kc, 0);
  
  // Hash the payload
  br_hmac_update(&ctx, data, strlen(data));
  
  // Output the digest
  uint8_t digest[32];
  br_hmac_out(&ctx, digest);

  bytesToHex(digest, 32, outHex);
  return true;
}

// ─── AES-256-GCM Encrypt (Stub for ESP8266) ───────────────────
// Fails intentionally to force fallback to plaintext JSON
static bool aesGcmEncrypt(
  const char* secretHex, 
  const char* plaintext,
  char*       ivHex,     
  char*       ctHex,     
  char*       tagHex     
) {
  return false; // Hardware limitation on ESP8266
}
