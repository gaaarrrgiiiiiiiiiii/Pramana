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

SECRET_KEY = os.environ.get("JWT_SECRET", "karnataka_police_secret_key_2026_datathon")
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
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM users WHERE username = %s", (req.username,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user or not verify_password(req.password, user["password_hash"]):
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
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "INSERT INTO sessions (user_id, title) VALUES (%s, %s) RETURNING *",
        (current_user["id"], req.title)
    )
    new_session = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return new_session

@router.get("/api/sessions")
def list_sessions(current_user: dict = Depends(get_current_user)):
    """
    Role-based session visibility:
    - SCRB Analyst / DGP: sees ALL sessions across all officers.
    - Inspector: sees sessions for officers in their district.
    - Field Officer: sees ONLY their own sessions.
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    role = current_user.get("role")
    user_id = current_user.get("id")
    district = current_user.get("district")

    if role == "SCRB Analyst":
        cur.execute("""
            SELECT s.*, u.username, u.full_name, u.badge_number, u.role as user_role, u.district
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            ORDER BY s.updated_at DESC
        """)
    elif role == "Inspector":
        cur.execute("""
            SELECT s.*, u.username, u.full_name, u.badge_number, u.role as user_role, u.district
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE u.district = %s OR s.user_id = %s
            ORDER BY s.updated_at DESC
        """, (district, user_id))
    else:
        cur.execute("""
            SELECT s.*, u.username, u.full_name, u.badge_number, u.role as user_role, u.district
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.user_id = %s
            ORDER BY s.updated_at DESC
        """, (user_id,))

    sessions = cur.fetchall()
    cur.close()
    conn.close()
    return sessions

@router.get("/api/sessions/{session_id}")
def get_session_details(session_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM sessions WHERE id = %s", (session_id,))
    session = cur.fetchone()
    if not session:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")

    cur.execute("SELECT * FROM messages WHERE session_id = %s ORDER BY created_at ASC", (session_id,))
    messages = cur.fetchall()
    cur.close()
    conn.close()
    return {"session": session, "messages": messages}
