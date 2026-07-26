import os
import psycopg2
from psycopg2.pool import ThreadedConnectionPool
from contextlib import contextmanager

_pool = None

def get_pool():
    global _pool
    if _pool is None or _pool.closed:
        db_name = os.environ.get("DB_NAME", "datathon_db")
        _pool = ThreadedConnectionPool(
            minconn=2,
            maxconn=20,
            host=os.environ.get("DB_HOST", "127.0.0.1"),
            port=os.environ.get("DB_PORT", "5432"),
            dbname=db_name,
            user=os.environ.get("DB_USER", "datathon_user"),
            password=os.environ.get("DB_PASSWORD", "datathon_password")
        )
    return _pool

def get_db_connection():
    pool = get_pool()
    return pool.getconn()

def release_db_connection(conn):
    if conn and not conn.closed:
        pool = get_pool()
        pool.putconn(conn)

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
