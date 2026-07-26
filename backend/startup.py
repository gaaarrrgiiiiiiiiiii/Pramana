"""
Catalyst AppSail startup script for Pramana backend.
Installs dependencies from requirements.txt, then starts uvicorn server.
"""
import os
import sys
import subprocess

print("[startup] Starting Pramana AppSail initialization...", flush=True)

# Install requirements
print("[startup] Installing requirements...", flush=True)
try:
    res = subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
        capture_output=True,
        text=True
    )
    if res.returncode != 0:
        print(f"[startup ERROR] Pip install failed:\nSTDOUT: {res.stdout}\nSTDERR: {res.stderr}", flush=True)
    else:
        print("[startup] Dependencies installed successfully.", flush=True)
except Exception as e:
    print(f"[startup ERROR] Exception during pip install: {e}", flush=True)

# Get Catalyst port
port = int(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT") or os.environ.get("PORT") or 9000)
print(f"[startup] Launching uvicorn on 0.0.0.0:{port}...", flush=True)

# Run uvicorn via python main.py or uvicorn directly
os.execvp(
    sys.executable,
    [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", str(port)]
)
