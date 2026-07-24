import os, psycopg2
from dotenv import load_dotenv
load_dotenv()

conn = psycopg2.connect(
    host=os.environ.get('DB_HOST','127.0.0.1'),
    port=os.environ.get('DB_PORT','5555'),
    dbname=os.environ.get('DB_NAME','datathon_db'),
    user=os.environ.get('DB_USER','datathon_user'),
    password=os.environ.get('DB_PASSWORD','datathon_password')
)
cur = conn.cursor()

# Add feedback column if not exists
cur.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS feedback SMALLINT DEFAULT NULL")
print("messages.feedback column: OK")

# Verify activity_log exists
cur.execute("SELECT COUNT(*) FROM activity_log")
print(f"activity_log table exists, rows: {cur.fetchone()[0]}")

conn.commit()
cur.close()
conn.close()
print("All schema updates applied successfully.")
