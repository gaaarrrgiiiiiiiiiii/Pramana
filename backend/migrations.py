"""
migrations.py — Run once to create auth/session tables and seed demo users.
Usage: python migrations.py
"""
import hashlib
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return salt.hex() + ':' + key.hex()

def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, key_hex = stored_hash.split(':')
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
        return key.hex() == key_hex
    except Exception:
        return False

DDL = """
-- ──────────────────────────────────────────────
-- USERS  (officer accounts)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name     VARCHAR(200) NOT NULL,
    badge_number  VARCHAR(50)  NOT NULL,
    role          VARCHAR(50)  NOT NULL,   -- Field Officer | Inspector | SCRB Analyst
    district      VARCHAR(100) DEFAULT 'All',
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- SESSIONS  (one session = one "chat" like ChatGPT)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(300) DEFAULT 'New Session',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- MESSAGES  (every Q&A turn saved)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id               SERIAL PRIMARY KEY,
    session_id       INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query            TEXT    NOT NULL,
    answer_english   TEXT,
    answer_translated TEXT,
    language         VARCHAR(50) DEFAULT 'English',
    intent           VARCHAR(50),
    confidence       FLOAT   DEFAULT 0.0,
    feedback         SMALLINT DEFAULT NULL,  -- +1 helpful, -1 not helpful, NULL = no response
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- ACTIVITY_LOG  (system audit — who did what when)
-- Different from messages: this records EVERY API action, not just answers.
-- Answers the question: "Who accessed suspect X's record on Tuesday?"
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
    id            SERIAL PRIMARY KEY,
    request_id    VARCHAR(24) NOT NULL,       -- UUID hex for correlating log lines
    user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username      VARCHAR(100),
    role          VARCHAR(50),
    action        VARCHAR(100) NOT NULL,      -- e.g. 'query', 'login', 'session_view', 'export'
    endpoint      VARCHAR(200),               -- e.g. '/api/query'
    query_text    TEXT,                       -- raw query if applicable
    intent        VARCHAR(50),               -- router classification
    was_blocked   BOOLEAN DEFAULT FALSE,
    block_reason  TEXT,
    status_code   SMALLINT,
    latency_ms    INTEGER,
    ip_address    VARCHAR(45),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user       ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_session    ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_user       ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_user       ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created    ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_action     ON activity_log(action);
"""

DEMO_USERS = [
    {
        "username":    "admin",
        "password":    "admin123",
        "full_name":   "Dr. Rajesh Kumar (DGP)",
        "badge_number":"KA-DGP-001",
        "role":        "SCRB Analyst",
        "district":    "All",
    },
    {
        "username":    "inspector1",
        "password":    "pass123",
        "full_name":   "Insp. Priya Sharma",
        "badge_number":"KA-INS-042",
        "role":        "Inspector",
        "district":    "Bengaluru",
    },
    {
        "username":    "inspector2",
        "password":    "pass123",
        "full_name":   "Insp. Anil Verma",
        "badge_number":"KA-INS-087",
        "role":        "Inspector",
        "district":    "Mysuru",
    },
    {
        "username":    "officer1",
        "password":    "pass123",
        "full_name":   "PSI Kavitha Reddy",
        "badge_number":"KA-PSI-201",
        "role":        "Field Officer",
        "district":    "Bengaluru",
    },
    {
        "username":    "officer2",
        "password":    "pass123",
        "full_name":   "HC Suresh Naik",
        "badge_number":"KA-HC-315",
        "role":        "Field Officer",
        "district":    "Mysuru",
    },
]


def run():
    conn = psycopg2.connect(
        host=os.environ.get("DB_HOST", "127.0.0.1"),
        port=os.environ.get("DB_PORT", "5555"),
        dbname=os.environ.get("DB_NAME", "datathon_db"),
        user=os.environ.get("DB_USER", "datathon_user"),
        password=os.environ.get("DB_PASSWORD", "datathon_password"),
    )
    cur = conn.cursor()

    print("Running DDL migrations...")
    cur.execute(DDL)
    conn.commit()
    print("[OK] Tables created / already exist")

    print("Seeding demo users...")
    for u in DEMO_USERS:
        hashed = hash_password(u["password"])
        cur.execute(
            """
            INSERT INTO users (username, password_hash, full_name, badge_number, role, district)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (username) DO UPDATE
              SET password_hash = EXCLUDED.password_hash,
                  full_name     = EXCLUDED.full_name,
                  role          = EXCLUDED.role,
                  district      = EXCLUDED.district
            """,
            (u["username"], hashed, u["full_name"], u["badge_number"], u["role"], u["district"]),
        )
        print(f"  [OK] {u['username']} ({u['role']})")
    conn.commit()

    cur.close()
    conn.close()
    print("\nMigration complete! Demo accounts ready.")
    print("\nLogin credentials:")
    print("  admin / admin123      -> SCRB Analyst (can view ALL sessions)")
    print("  inspector1 / pass123  -> Inspector (Bengaluru)")
    print("  inspector2 / pass123  -> Inspector (Mysuru)")
    print("  officer1 / pass123    -> Field Officer (Bengaluru)")
    print("  officer2 / pass123    -> Field Officer (Mysuru)")


if __name__ == "__main__":
    run()
