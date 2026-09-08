import sqlite3, os, sys, hashlib
from binascii import hexlify

api_key = hexlify(os.urandom(32)).decode()
device_secret = hexlify(os.urandom(32)).decode()
api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()

conn = sqlite3.connect('backend/cvis.db')
c = conn.cursor()
c.execute("DELETE FROM devices WHERE device_id='ESP32-ALPHA'")
c.execute("INSERT INTO devices (device_id, api_key_hash, device_secret, registered_at, active) VALUES ('ESP32-ALPHA', ?, ?, datetime('now'), 1)", (api_key_hash, device_secret))
conn.commit()

print('================================================================')
print('SUCCESS! Here are your credentials for ESP32-ALPHA.')
print('Copy and paste these exact lines into your firmware/secrets.h:')
print('================================================================\n')
print(f'#define API_KEY         "{api_key}"')
print(f'#define DEVICE_SECRET   "{device_secret}"')
print('\n================================================================')
