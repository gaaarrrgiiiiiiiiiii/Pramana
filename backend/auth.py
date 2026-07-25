import os
import json
import time
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from migrations import verify_password, hash_password

SECRET_KEY = os.environ.get("JWT_SECRET")
if not SECRET_KEY:
    raise RuntimeError(
        "FATAL: JWT_SECRET environment variable is not set. "
        "Set it in .env before starting the server. "
        "Example: JWT_SECRET=your-256-bit-random-secret"
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

router = APIRouter(tags=["Auth & Sessions"])

def get_db_connection():
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "127.0.0.1"),
        port=os.environ.get("DB_PORT", "5555"),
        dbname=os.environ.get("DB_NAME", "datathon_db"),
        user=os.environ.get("DB_USER", "datathon_user"),
        password=os.environ.get("DB_PASSWORD", "datathon_password")
    )

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token"
        )
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

@router.post("/api/login", response_model=LoginResponse)
def login(req: LoginRequest):
    user = None
    if req.username == "officer1": user = {"id":1, "username": "officer1", "password_hash": "mock", "full_name": "Demo Officer", "role": "Field Officer", "badge_number": "123", "district": "Test"}
    elif req.username == "inspector1": user = {"id":2, "username": "inspector1", "password_hash": "mock", "full_name": "Demo Inspector", "role": "Inspector", "badge_number": "124", "district": "Test"}
    elif req.username == "admin": user = {"id":3, "username": "admin", "password_hash": "mock", "full_name": "Demo Admin", "role": "SCRB Analyst", "badge_number": "125", "district": "Test"}
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or badge password"
        )

    token_data = {
        "sub": user["username"],
        "id": user["id"],
        "full_name": user["full_name"],
        "role": user["role"],
        "badge_number": user["badge_number"],
        "district": user["district"]
    }
    token = create_access_token(token_data)

    user_info = {
        "id": user["id"],
        "username": user["username"],
        "full_name": user["full_name"],
        "badge_number": user["badge_number"],
        "role": user["role"],
        "district": user["district"]
    }
    return LoginResponse(access_token=token, user=user_info)

@router.get("/api/me")
def read_current_user(current_user: dict = Depends(get_current_user)):
    return current_user

# ── Session & History Management ────────────────────────────────────

class CreateSessionRequest(BaseModel):
    title: str = "New Investigation"

@router.post("/api/sessions")
def create_session(req: CreateSessionRequest, current_user: dict = Depends(get_current_user)):
    return {"id": 1, "user_id": current_user["id"], "title": req.title, "created_at": "2023-01-01T00:00:00Z", "updated_at": "2023-01-01T00:00:00Z"}

@router.get("/api/sessions")
def list_sessions(current_user: dict = Depends(get_current_user)):
    return []

@router.get("/api/sessions/{session_id}")
def get_session_details(session_id: int, current_user: dict = Depends(get_current_user)):
    return {"session": {"id": session_id, "title": "Mock Session"}, "messages": []}


@router.delete("/api/sessions/{session_id}", tags=["Auth & Sessions"])
def delete_session(session_id: int, current_user: dict = Depends(get_current_user)):
    """
    Delete a session and all its messages.
    - Field Officers / Inspectors: can delete only their own sessions.
    - SCRB Analyst / DGP: can delete any session (compliance purge).
    Deletion is permanent and non-reversible.
    """
    conn = get_db_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    # Verify session exists
    cur.execute("SELECT * FROM sessions WHERE id = %s", (session_id,))
    session = cur.fetchone()
    if not session:
        cur.close(); conn.close()
        raise HTTPException(status_code=404, detail="Session not found")

    role    = current_user.get("role")
    user_id = current_user.get("id")

    # Enforce ownership unless SCRB/DGP
    if role not in ("SCRB Analyst", "DGP") and session["user_id"] != user_id:
        cur.close(); conn.close()
        raise HTTPException(
            status_code=403,
            detail="You can only delete your own sessions unless you have SCRB Analyst clearance"
        )

    cur.execute("DELETE FROM sessions WHERE id = %s", (session_id,))
    conn.commit()
    cur.close()
    conn.close()
    return {"status": "deleted", "session_id": session_id}

