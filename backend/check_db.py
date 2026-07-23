import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
load_dotenv()

conn = psycopg2.connect(
    host='127.0.0.1', port='5555', dbname='datathon_db',
    user='datathon_user', password='datathon_password'
)
cur = conn.cursor(cursor_factory=RealDictCursor)

# Check row counts
for table in ['cases', 'stations', 'offense_types', 'fir_raw']:
    cur.execute(f'SELECT COUNT(*) as cnt FROM {table}')
    row = cur.fetchone()
    print(f'{table}: {row["cnt"]} rows')

# Sample crime_groups from fir_raw
print('\nSample crime_groups in fir_raw:')
cur.execute('SELECT DISTINCT crime_group FROM fir_raw LIMIT 20')
for r in cur.fetchall():
    print(' -', r['crime_group'])

# Sample io_names
print('\nSample io_names in fir_raw (first 10):')
cur.execute("SELECT DISTINCT io_name FROM fir_raw WHERE io_name IS NOT NULL LIMIT 10")
for r in cur.fetchall():
    print(' -', r['io_name'])

# Check if 'ravi' appears anywhere
print('\nSearch for Ravi in io_name:')
cur.execute("SELECT COUNT(*) as cnt FROM fir_raw WHERE io_name ILIKE '%ravi%'")
print(' io_name count:', cur.fetchone()['cnt'])

cur.execute("SELECT COUNT(*) as cnt FROM fir_raw WHERE place_of_offence ILIKE '%ravi%'")
print(' place_of_offence count:', cur.fetchone()['cnt'])

# Search cases table too
print('\nSearch for Ravi in cases.io_name:')
cur.execute("SELECT COUNT(*) as cnt FROM cases WHERE io_name ILIKE '%ravi%'")
print(' cases io_name count:', cur.fetchone()['cnt'])

# Sample what terms DO exist in place_of_offence
print('\nSample place_of_offence values:')
cur.execute("SELECT DISTINCT place_of_offence FROM fir_raw WHERE place_of_offence IS NOT NULL LIMIT 10")
for r in cur.fetchall():
    print(' -', r['place_of_offence'])

conn.close()
print('\nDONE')
