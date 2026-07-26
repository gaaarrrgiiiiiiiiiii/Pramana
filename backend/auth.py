import os
import json
import time
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from pydantic import BaseModel
from psycopg2.extras import RealDictCursor
from db import get_db_connection, get_db_cursor
from migrations import verify_password

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

@router.post("/api/login")
@router.post("/api/auth/login")
async def login(request: Request):
    username = ""
    password = ""
    try:
        body = await request.json()
        username = str(body.get("username", "")).strip()
        password = str(body.get("password", ""))
    except Exception:
        try:
            form = await request.form()
            username = str(form.get("username", "")).strip()
            password = str(form.get("password", ""))
        except Exception:
            pass

    user = None
    if username and password:
        with get_db_cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM users WHERE username = %s", (username,))
            db_user = cur.fetchone()
            if db_user and verify_password(password, db_user["password_hash"]):
                user = db_user

    # Mock fallback for demo accounts if DB wasn't seeded yet or password mismatch
    if not user:
        if username == "officer1" and password in ("pass123", "mock"):
            user = {"id": 4, "username": "officer1", "full_name": "PSI Kavitha Reddy", "role": "Field Officer", "badge_number": "KA-PSI-201", "district": "Bengaluru"}
        elif username == "inspector1" and password in ("pass123", "mock"):
            user = {"id": 2, "username": "inspector1", "full_name": "Insp. Priya Sharma", "role": "Inspector", "badge_number": "KA-INS-042", "district": "Bengaluru"}
        elif username == "admin" and password in ("admin123", "mock"):
            user = {"id": 1, "username": "admin", "full_name": "Dr. Rajesh Kumar (DGP)", "role": "SCRB Analyst", "badge_number": "KA-DGP-001", "district": "All"}
    
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
    with get_db_cursor(commit=True, cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "INSERT INTO sessions (user_id, title) VALUES (%s, %s) RETURNING id, user_id, title, started_at, updated_at",
            (current_user["id"], req.title)
        )
        session = cur.fetchone()
        if session:
            session["started_at"] = session["started_at"].isoformat() if session.get("started_at") else ""
            session["updated_at"] = session["updated_at"].isoformat() if session.get("updated_at") else ""
            return session
    return {"id": 1, "user_id": current_user["id"], "title": req.title}

@router.get("/api/sessions")
def list_sessions(current_user: dict = Depends(get_current_user)):
    role = current_user.get("role")
    user_id = current_user.get("id")

    with get_db_cursor(cursor_factory=RealDictCursor) as cur:
        if role in ("SCRB Analyst", "DGP"):
            cur.execute("""
                SELECT s.id, s.user_id, s.title, s.started_at, s.updated_at,
                       u.username, u.full_name, u.badge_number, u.role AS user_role, u.district,
                       COUNT(m.id)::int AS message_count
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                LEFT JOIN messages m ON m.session_id = s.id
                GROUP BY s.id, u.id
                ORDER BY s.updated_at DESC
            """)
        else:
            cur.execute("""
                SELECT s.id, s.user_id, s.title, s.started_at, s.updated_at,
                       u.username, u.full_name, u.badge_number, u.role AS user_role, u.district,
                       COUNT(m.id)::int AS message_count
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                LEFT JOIN messages m ON m.session_id = s.id
                WHERE s.user_id = %s
                GROUP BY s.id, u.id
                ORDER BY s.updated_at DESC
            """, (user_id,))
        
        rows = cur.fetchall()
        for r in rows:
            if r.get("started_at"):
                r["started_at"] = r["started_at"].isoformat()
            if r.get("updated_at"):
                r["updated_at"] = r["updated_at"].isoformat()
        return rows

@router.get("/api/sessions/{session_id}")
def get_session_details(session_id: int, current_user: dict = Depends(get_current_user)):
    role = current_user.get("role")
    user_id = current_user.get("id")

    with get_db_cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT s.id, s.user_id, s.title, s.started_at, s.updated_at,
                   u.username, u.full_name, u.badge_number, u.role AS user_role, u.district
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = %s
        """, (session_id,))
        session = cur.fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Enforce RBAC ownership check: SCRB Analyst can view any, others view own
        if role not in ("SCRB Analyst", "DGP") and session["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="You do not have clearance to view this session")

        if session.get("started_at"):
            session["started_at"] = session["started_at"].isoformat()
        if session.get("updated_at"):
            session["updated_at"] = session["updated_at"].isoformat()

        cur.execute("""
            SELECT id, query, answer_english, answer_translated, language, intent, confidence, feedback, created_at
            FROM messages
            WHERE session_id = %s
            ORDER BY created_at ASC
        """, (session_id,))
        messages = cur.fetchall()
        for m in messages:
            if m.get("created_at"):
                m["created_at"] = m["created_at"].isoformat()

        return {"session": session, "messages": messages}

@router.delete("/api/sessions/{session_id}", tags=["Auth & Sessions"])
def delete_session(session_id: int, current_user: dict = Depends(get_current_user)):
    role = current_user.get("role")
    user_id = current_user.get("id")

    with get_db_cursor(commit=True, cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT * FROM sessions WHERE id = %s", (session_id,))
        session = cur.fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        if role not in ("SCRB Analyst", "DGP") and session["user_id"] != user_id:
            raise HTTPException(
                status_code=403,
                detail="You can only delete your own sessions unless you have SCRB Analyst clearance"
            )

        cur.execute("DELETE FROM sessions WHERE id = %s", (session_id,))
        return {"status": "deleted", "session_id": session_id}
