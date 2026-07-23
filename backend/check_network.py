import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
load_dotenv()

conn = psycopg2.connect(
    host='127.0.0.1', port='5555', dbname='datathon_db',
    user='datathon_user', password='datathon_password'
)
cur = conn.cursor(cursor_factory=RealDictCursor)

# Test: exact search for "Ravi Gang" vs "Ravi"
print("=== Searching for 'Ravi Gang' in fir_raw ===")
cur.execute("SELECT COUNT(*) as cnt FROM fir_raw WHERE io_name ILIKE '%Ravi Gang%' OR unit_name ILIKE '%Ravi Gang%' OR crime_group ILIKE '%Ravi Gang%'")
print('Ravi Gang count:', cur.fetchone()['cnt'])

print("\n=== Searching for 'Ravi' alone in fir_raw ===")
cur.execute("SELECT COUNT(*) as cnt FROM fir_raw WHERE io_name ILIKE '%Ravi%'")
print('Ravi io_name count:', cur.fetchone()['cnt'])

# Show what the NETWORK AGENT fir_raw query returns for "Ravi Gang"
print("\n=== Full network agent fir_raw query for 'Ravi Gang' ===")
target = "Ravi Gang"
cur.execute("""
    SELECT DISTINCT io_name, unit_name, crime_group, fir_year, kgid, district_name
    FROM fir_raw
    WHERE io_name ILIKE %s
       OR unit_name ILIKE %s
       OR crime_group ILIKE %s
       OR place_of_offence ILIKE %s
    LIMIT 5
""", (f"%{target}%", f"%{target}%", f"%{target}%", f"%{target}%"))
rows = cur.fetchall()
print(f"Rows returned: {len(rows)}")
for r in rows:
    print(' -', dict(r))

# Now with just "Ravi"
print("\n=== Full network agent fir_raw query for 'Ravi' ===")
target2 = "Ravi"
cur.execute("""
    SELECT DISTINCT io_name, unit_name, crime_group, fir_year, kgid, district_name
    FROM fir_raw
    WHERE io_name ILIKE %s
       OR unit_name ILIKE %s
       OR crime_group ILIKE %s
    LIMIT 5
""", (f"%{target2}%", f"%{target2}%", f"%{target2}%"))
rows2 = cur.fetchall()
print(f"Rows returned: {len(rows2)}")
for r in rows2:
    print(' -', dict(r))

# Test the CASES JOIN query for "Ravi Gang"
print("\n=== Cases JOIN query for 'Ravi Gang' ===")
cur.execute("""
    SELECT c.id as case_id, c.fir_number, c.io_name, 
           s.name as station_name, s.id as station_id,
           o.crime_group
    FROM cases c
    JOIN stations s ON c.station_id = s.id
    JOIN offense_types o ON c.offense_type_id = o.id
    WHERE c.io_name ILIKE %s OR s.name ILIKE %s OR o.crime_group ILIKE %s
    LIMIT 5
""", ('%Ravi Gang%', '%Ravi Gang%', '%Ravi Gang%'))
rows3 = cur.fetchall()
print(f"Rows returned: {len(rows3)}")

# Test CASES JOIN query for "Ravi" alone
print("\n=== Cases JOIN query for 'Ravi' ===")
cur.execute("""
    SELECT c.id as case_id, c.fir_number, c.io_name, 
           s.name as station_name, s.id as station_id,
           o.crime_group
    FROM cases c
    JOIN stations s ON c.station_id = s.id
    JOIN offense_types o ON c.offense_type_id = o.id
    WHERE c.io_name ILIKE '%Ravi%' OR s.name ILIKE '%Ravi%' OR o.crime_group ILIKE '%Ravi%'
    LIMIT 5
""")
rows4 = cur.fetchall()
print(f"Rows returned: {len(rows4)}")
for r in rows4:
    print(' -', dict(r))

conn.close()
print('\nDONE')
