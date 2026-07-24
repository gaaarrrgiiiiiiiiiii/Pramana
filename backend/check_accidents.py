import os, psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
load_dotenv()

conn = psycopg2.connect(
    host=os.environ.get('DB_HOST','127.0.0.1'),
    port=os.environ.get('DB_PORT','5555'),
    dbname=os.environ.get('DB_NAME','datathon_db'),
    user=os.environ.get('DB_USER','datathon_user'),
    password=os.environ.get('DB_PASSWORD','datathon_password')
)
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute("SELECT DISTINCT crime_group FROM fir_raw WHERE crime_group ILIKE '%ACCIDENT%' OR crime_group ILIKE '%MOTOR%'")
print('Crime Groups for Accidents:', [r['crime_group'] for r in cur.fetchall()])

cur.execute("SELECT DISTINCT crime_head FROM fir_raw WHERE crime_head ILIKE '%ACCIDENT%' OR crime_head ILIKE '%MOTOR%' LIMIT 10")
print('Crime Heads for Accidents:', [r['crime_head'] for r in cur.fetchall()])

cur.execute("SELECT COUNT(*) as cnt FROM fir_raw WHERE crime_group ILIKE '%MOTOR VEHICLE ACCIDENT%' OR crime_group ILIKE '%ACCIDENT%'")
print('Total accident count in fir_raw:', cur.fetchone()['cnt'])

cur.execute("SELECT COUNT(*) as cnt FROM cases WHERE offense_type_id IN (SELECT id FROM offense_types WHERE crime_group ILIKE '%ACCIDENT%')")
print('Total accident count in relational cases table:', cur.fetchone()['cnt'])

cur.close(); conn.close()
