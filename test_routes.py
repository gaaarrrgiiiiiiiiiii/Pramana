import requests
import time
import json

try:
    import brotli
    HAS_BROTLI = True
except ImportError:
    HAS_BROTLI = False

frontend = "https://pramana-ui-sshxrzdq.onslate.in"
backend = "https://pramana-api-50044352049.development.catalystappsail.in"

# Get token
r_login = requests.post(
    backend + "/api/login",
    data="username=inspector1&password=pass123",
    headers={"Content-Type": "application/x-www-form-urlencoded"},
)
token = r_login.json().get("access_token", "")
print("LOGIN:", r_login.status_code)
print("Has brotli:", HAS_BROTLI)

# Use urllib3 directly to get raw bytes (requests auto-decompresses and may fail silently)
import urllib3
http = urllib3.PoolManager()

payload = json.dumps({"query": "hello", "language": "English"}).encode("utf-8")

print()
print("--- TEST: POST /api/query (raw bytes, no auto-decompress) ---")
t0 = time.time()
r = http.request(
    "POST",
    frontend + "/api/query",
    body=payload,
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
        "Accept-Encoding": "br, gzip, deflate, identity",
    },
    preload_content=True,
    decode_content=False,  # DO NOT auto-decode
)
elapsed = time.time() - t0
print("Status:", r.status, "in", round(elapsed, 1), "s")
print("Content-Encoding:", r.headers.get("Content-Encoding", "none"))
print("Content-Type:", r.headers.get("Content-Type", "?"))
print("Raw body len:", len(r.data))

if r.data and HAS_BROTLI:
    ce = r.headers.get("Content-Encoding", "")
    if "br" in ce:
        try:
            decompressed = brotli.decompress(r.data)
            print("Brotli decompressed len:", len(decompressed))
            print("Decompressed text:", decompressed[:500].decode("utf-8", errors="replace"))
        except Exception as e:
            print("Brotli decompress failed:", e)
            print("Raw bytes[:100]:", r.data[:100])
    else:
        print("Not Brotli encoded, raw text:", r.data[:500].decode("utf-8", errors="replace"))
elif r.data:
    print("Raw bytes[:100]:", r.data[:100])
else:
    print("EMPTY BODY - no data at all!")

# Also test with Accept-Encoding: identity to bypass compression
print()
print("--- TEST: POST /api/query (Accept-Encoding: identity) ---")
t0 = time.time()
r2 = http.request(
    "POST",
    frontend + "/api/query",
    body=payload,
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
        "Accept-Encoding": "identity",
    },
    preload_content=True,
    decode_content=False,
)
elapsed = time.time() - t0
print("Status:", r2.status, "in", round(elapsed, 1), "s")
print("Content-Encoding:", r2.headers.get("Content-Encoding", "none"))
print("Raw body len:", len(r2.data))
if r2.data:
    print("Body:", r2.data[:500].decode("utf-8", errors="replace"))
else:
    print("EMPTY BODY!")
