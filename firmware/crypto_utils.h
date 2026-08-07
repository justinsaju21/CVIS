// ================================================================
// CVIS ESP32 — crypto_utils.h
// Hardware HMAC-SHA256 and AES-256-GCM using mbedTLS
// (included in ESP32 Arduino SDK, no extra library needed)
// ================================================================
// CCNS mapping:
//   HMAC-SHA256 → Unit 4 (Message Integrity, MAC, Hash Functions)
//   AES-256-GCM → Unit 4 (Authenticated Encryption, Confidentiality)
// ================================================================

#pragma once

#include <Arduino.h>
#include <string.h>

// mbedTLS is bundled with the ESP32 Arduino core
extern "C" {
  #include "mbedtls/md.h"
  #include "mbedtls/gcm.h"
  #include "mbedtls/entropy.h"
  #include "mbedtls/ctr_drbg.h"
}

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
// outHex must be at least 65 bytes (64 hex chars + null).
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

  uint8_t digest[32];
  mbedtls_md_context_t ctx;
  const mbedtls_md_info_t* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);

  mbedtls_md_init(&ctx);
  if (mbedtls_md_setup(&ctx, info, 1) != 0) {
    mbedtls_md_free(&ctx);
    return false;
  }
  mbedtls_md_hmac_starts(&ctx, secret, 32);
  mbedtls_md_hmac_update(&ctx, (const uint8_t*)data, strlen(data));
  mbedtls_md_hmac_finish(&ctx, digest);
  mbedtls_md_free(&ctx);

  bytesToHex(digest, 32, outHex);
  return true;
}

// ─── AES-256-GCM Encrypt ──────────────────────────────────────
// Encrypts plaintext JSON and populates ivHex, ctHex, tagHex.
// Buffers must be: ivHex[25], ctHex[len*2+1], tagHex[33]
// Returns true on success.
static bool aesGcmEncrypt(
  const char* secretHex,  // 64-char hex device_secret (32 bytes = 256-bit key)
  const char* plaintext,
  char*       ivHex,      // output: 24-char hex IV (12 bytes)
  char*       ctHex,      // output: hex ciphertext (plaintext len * 2 + 1)
  char*       tagHex      // output: 32-char hex tag (16 bytes)
) {
  uint8_t key[32];
  if (!hexToBytes(secretHex, key, 32)) return false;

  // Generate random 12-byte IV using ESP32 hardware RNG
  uint8_t iv[12];
  for (int i = 0; i < 12; i++) {
    iv[i] = (uint8_t)(esp_random() & 0xFF);
  }

  size_t ptLen = strlen(plaintext);
  uint8_t* ct  = (uint8_t*)malloc(ptLen);
  uint8_t  tag[16];

  if (!ct) {
    Serial.println("[CRYPTO] aesGcmEncrypt: malloc failed");
    return false;
  }

  mbedtls_gcm_context gcm;
  mbedtls_gcm_init(&gcm);

  int ret = mbedtls_gcm_setkey(&gcm, MBEDTLS_CIPHER_ID_AES, key, 256);
  if (ret != 0) {
    free(ct);
    mbedtls_gcm_free(&gcm);
    Serial.printf("[CRYPTO] gcm_setkey failed: %d\n", ret);
    return false;
  }

  ret = mbedtls_gcm_crypt_and_tag(
    &gcm,
    MBEDTLS_GCM_ENCRYPT,
    ptLen,
    iv, 12,          // nonce
    nullptr, 0,      // additional data (none)
    (const uint8_t*)plaintext, ct,
    16, tag          // tag length + output
  );

  mbedtls_gcm_free(&gcm);

  if (ret != 0) {
    free(ct);
    Serial.printf("[CRYPTO] gcm_crypt failed: %d\n", ret);
    return false;
  }

  bytesToHex(iv,  12,    ivHex);
  bytesToHex(ct,  ptLen, ctHex);
  bytesToHex(tag, 16,    tagHex);
  free(ct);
  return true;
}
