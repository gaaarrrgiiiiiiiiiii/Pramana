import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def test_db():
    ports = [
        int(os.environ.get("DB_PORT", 5555)),
        5432,
        5555
    ]
    # Remove duplicates
    ports = list(dict.fromkeys(ports))

    for port in ports:
        try:
            conn = psycopg2.connect(
                host=os.environ.get("DB_HOST", "127.0.0.1"),
                port=port,
                dbname=os.environ.get("DB_NAME", "datathon_db"),
                user=os.environ.get("DB_USER", "datathon_user"),
                password=os.environ.get("DB_PASSWORD", "datathon_password"),
                connect_timeout=3
            )
            print(f"CONNECTED_SUCCESS_PORT:{port}")
            conn.close()
            return port
        except Exception as e:
            print(f"PORT_{port}_FAILED: {e}")
    return None

if __name__ == "__main__":
    test_db()
