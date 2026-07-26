import os
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager

def get_db_connection():
    """
    Returns a fresh PostgreSQL connection for AppSail cloud runtime.
    """
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        # Auto-encode unescaped '#' in password to '%23' to prevent URI fragment truncation
        if "#" in db_url and "%23" not in db_url:
            db_url = db_url.replace("#", "%23")
        if "sslmode" not in db_url:
            delim = "&" if "?" in db_url else "?"
            db_url += f"{delim}sslmode=require&connect_timeout=10"
        for attempt in range(3):
            try:
                conn = psycopg2.connect(db_url)
                return conn
            except Exception:
                if attempt == 2:
                    raise
    
    # Fallback for local dev env
    db_name = os.environ.get("DB_NAME", "datathon_db")
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "127.0.0.1"),
        port=os.environ.get("DB_PORT", "5432"),
        dbname=db_name,
        user=os.environ.get("DB_USER", "datathon_user"),
        password=os.environ.get("DB_PASSWORD", "datathon_password"),
        connect_timeout=10
    )

def release_db_connection(conn):
    if conn:
        try:
            conn.close()
        except Exception:
            pass

@contextmanager
def get_db_cursor(commit=False, cursor_factory=None):
    conn = get_db_connection()
    try:
        if cursor_factory:
            cur = conn.cursor(cursor_factory=cursor_factory)
        else:
            cur = conn.cursor()
        yield cur
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        try:
            cur.close()
        except Exception:
            pass
        release_db_connection(conn)
