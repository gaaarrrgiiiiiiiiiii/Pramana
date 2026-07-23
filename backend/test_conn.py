import os
import psycopg2
from dotenv import load_dotenv
load_dotenv()

for port in [5555, 5432]:
    try:
        conn = psycopg2.connect(
            host=os.environ.get("DB_HOST", "127.0.0.1"),
            port=port,
            dbname=os.environ.get("DB_NAME", "datathon_db"),
            user=os.environ.get("DB_USER", "datathon_user"),
            password=os.environ.get("DB_PASSWORD", "datathon_password"),
        )
        print(f"SUCCESS on port {port}!")
        conn.close()
        break
    except Exception as e:
        print(f"FAILED port {port}: {e}")
