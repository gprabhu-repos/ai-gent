#!/usr/bin/env python3

import hmac
import hashlib

# From the debug logs
x_up_id = "msg_CWMnUfYrotbV7TWpTD2dCXwxaF"
x_up_timestamp = "1761807731143"
body_str = '{"event_type":"agent.health_check","timestamp":"2025-10-30T07:02:11.143286+00:00"}'
secret = "NKdifcgnrkPwlJNZZ26MVwf0YqtfiSNXeSzRBkt8zco"
upwork_signature = "12fae29fcbf293dd8534bdece45b37c6aba92557ceeba4dcf5c7e4ea073f12a3"

# Upwork's format from docs
raw_payload = f"{x_up_id}.{x_up_timestamp}.{body_str}"

print(f"Raw payload: {raw_payload}")
print(f"Payload length: {len(raw_payload)}")
print(f"Secret: {secret}")
print(f"Expected: {upwork_signature}")
print()

# Calculate signature exactly as in docs
signature = hmac.new(
    key=secret.encode("utf-8"),
    msg=raw_payload.encode("utf-8"),
    digestmod=hashlib.sha256
).hexdigest()

print(f"Our calculation: {signature}")
print(f"Match: {signature == upwork_signature}")