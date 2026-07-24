import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
load_dotenv()

conn = psycopg2.connect(
    host=os.environ.get("DB_HOST", "127.0.0.1"),
    port=os.environ.get("DB_PORT", "5555"),
    dbname=os.environ.get("DB_NAME", "datathon_db"),
    user=os.environ.get("DB_USER", "datathon_user"),
    password=os.environ.get("DB_PASSWORD", "datathon_password")
)
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=" * 60)
print("1. TOTAL ROWS IN fir_raw")
cur.execute("SELECT COUNT(*) as total FROM fir_raw")
print(cur.fetchone())

print("\n2. ROWS WITH NON-NULL COORDINATES")
cur.execute("SELECT COUNT(*) as total FROM fir_raw WHERE latitude IS NOT NULL AND longitude IS NOT NULL")
print(cur.fetchone())

print("\n3. SAMPLE COORDINATES (first 10 non-null)")
cur.execute("""
    SELECT latitude, longitude, district_name, unit_name, crime_group
    FROM fir_raw
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    LIMIT 10
""")
for r in cur.fetchall():
    print(r)

print("\n4. COORDINATE RANGE (min/max lat/lon)")
cur.execute("""
    SELECT 
        MIN(latitude) as min_lat, MAX(latitude) as max_lat,
        MIN(longitude) as min_lon, MAX(longitude) as max_lon,
        AVG(latitude) as avg_lat, AVG(longitude) as avg_lon
    FROM fir_raw
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
""")
print(cur.fetchone())

print("\n5. HOTSPOT FILTER RANGE (current filter: lat 11-19, lon 74-79)")
cur.execute("""
    SELECT COUNT(*) as within_range FROM fir_raw
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    AND latitude BETWEEN 11.0 AND 19.0
    AND longitude BETWEEN 74.0 AND 79.0
""")
print(cur.fetchone())

print("\n6. DISTINCT DISTRICTS IN DATA")
cur.execute("SELECT DISTINCT district_name FROM fir_raw WHERE district_name IS NOT NULL ORDER BY district_name LIMIT 30")
for r in cur.fetchall():
    print(r["district_name"])

print("\n7. SAMPLE of columns in fir_raw (first row)")
cur.execute("SELECT * FROM fir_raw LIMIT 1")
row = cur.fetchone()
if row:
    for k, v in row.items():
        print(f"  {k}: {v}")

print("\n8. KAGGLE CSV CHECK: Is the data from the FIR_Details_Data.csv?")
cur.execute("SELECT kgid, district_name, crime_group, fir_year FROM fir_raw ORDER BY id LIMIT 5")
for r in cur.fetchall():
    print(r)

cur.close()
conn.close()
