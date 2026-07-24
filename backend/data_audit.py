import os, psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
load_dotenv()

conn = psycopg2.connect(
    host=os.environ.get("DB_HOST","127.0.0.1"), port=os.environ.get("DB_PORT","5555"),
    dbname=os.environ.get("DB_NAME","datathon_db"), user=os.environ.get("DB_USER","datathon_user"),
    password=os.environ.get("DB_PASSWORD","datathon_password")
)
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=== TOP CRIME GROUPS FOR FACTUAL QUERIES ===")
cur.execute("SELECT crime_group, COUNT(*) as cnt FROM fir_raw GROUP BY crime_group ORDER BY cnt DESC LIMIT 15")
for r in cur.fetchall(): print(f"  {r['crime_group']} -> {r['cnt']}")

print("\n=== TOP DISTRICTS ===")
cur.execute("SELECT district_name, COUNT(*) as cnt FROM fir_raw GROUP BY district_name ORDER BY cnt DESC LIMIT 10")
for r in cur.fetchall(): print(f"  {r['district_name']} -> {r['cnt']}")

print("\n=== YEARS AVAILABLE ===")
cur.execute("SELECT DISTINCT fir_year FROM fir_raw WHERE fir_year IS NOT NULL ORDER BY fir_year")
print([r['fir_year'] for r in cur.fetchall()])

print("\n=== TOP POLICE STATIONS ===")
cur.execute("SELECT unit_name, district_name, COUNT(*) as cnt FROM fir_raw GROUP BY unit_name, district_name ORDER BY cnt DESC LIMIT 10")
for r in cur.fetchall(): print(f"  {r['unit_name']} ({r['district_name']}) -> {r['cnt']}")

print("\n=== IO NAMES (for network graph) ===")
cur.execute("SELECT io_name, COUNT(*) as cnt FROM fir_raw WHERE io_name IS NOT NULL AND io_name != '' GROUP BY io_name ORDER BY cnt DESC LIMIT 10")
for r in cur.fetchall(): print(f"  {r['io_name']} -> {r['cnt']}")

print("\n=== ACCUSED COUNT > 5 (gang data) ===")
cur.execute("SELECT unit_name, district_name, crime_group, accused_count FROM fir_raw WHERE accused_count > 5 ORDER BY accused_count DESC LIMIT 10")
for r in cur.fetchall(): print(f"  {r['crime_group']} | {r['unit_name']} | accused={r['accused_count']}")

print("\n=== CRIME_HEAD samples ===")
cur.execute("SELECT DISTINCT crime_head FROM fir_raw WHERE crime_head IS NOT NULL ORDER BY crime_head LIMIT 20")
for r in cur.fetchall(): print(f"  {r['crime_head']}")

print("\n=== PLACE OF OFFENCE samples (for network) ===")
cur.execute("SELECT place_of_offence FROM fir_raw WHERE place_of_offence IS NOT NULL AND length(place_of_offence) > 5 LIMIT 5")
for r in cur.fetchall(): print(f"  {r['place_of_offence'][:80]}")

print("\n=== SESSIONS IN DB ===")
cur.execute("SELECT COUNT(*) as total FROM sessions")
print(cur.fetchone())
cur.execute("SELECT COUNT(*) as total FROM messages")
print(cur.fetchone())

cur.close(); conn.close()
