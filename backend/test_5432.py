import psycopg2
import sys

for user, password in [('datathon_user', 'datathon_password'), ('postgres', 'postgres'), ('postgres', 'admin'), ('postgres', 'root'), ('postgres', '')]:
    try:
        conn = psycopg2.connect(
            host='127.0.0.1',
            port=5432,
            dbname='postgres',
            user=user,
            password=password,
            connect_timeout=3
        )
        print(f"SUCCESS: user={user}, password={password} on port 5432")
        conn.close()
        sys.exit(0)
    except Exception as e:
        print(f"FAILED user={user}: {e}")
