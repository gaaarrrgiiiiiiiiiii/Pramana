"""
import_real_data.py
──────────────────
Imports the real Karnataka Police FIR dataset (1.6M rows) from
data/FIR_Details_Data.csv into Postgres.

Strategy:
  1. Populate lookup tables: stations, offense_types, locations
  2. Bulk-insert into fir_raw (all 34 original columns)
  3. Populate normalized cases table from fir_raw
  4. Generate lightweight random embeddings (upgrade to real embeddings later)

Run: python import_real_data.py
"""

import psycopg2
from psycopg2.extras import execute_values
import pandas as pd
import datetime
import random
import math
import sys

DB_PARAMS = {
    'dbname': 'datathon_db',
    'user':   'datathon_user',
    'password': 'datathon_password',
    'host':   '127.0.0.1',
    'port':   '5555'
}

CSV_PATH  = 'data/FIR_Details_Data.csv'
CHUNK_SIZE = 10_000   # rows per commit cycle

# ──────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────

def safe_int(val, default=0):
    try:
        v = int(float(str(val).strip()))
        return v if not math.isnan(float(str(val))) else default
    except Exception:
        return default

def safe_float(val):
    try:
        v = float(str(val).strip())
        return None if math.isnan(v) else v
    except Exception:
        return None

def safe_str(val, max_len=None):
    if pd.isna(val):
        return None
    s = str(val).strip()
    if max_len:
        s = s[:max_len]
    return s if s else None

def rand_embedding():
    return [random.random() for _ in range(768)]

def build_date(year, month, day):
    try:
        y = int(year) if not math.isnan(float(year)) else 2020
        m = int(month) if not math.isnan(float(month)) else 1
        d = int(day)   if not math.isnan(float(day))   else 1
        m = max(1, min(12, m))
        d = max(1, min(28, d))   # cap at 28 to avoid month-end issues
        return datetime.date(y, m, d)
    except Exception:
        return datetime.date(2020, 1, 1)


# ──────────────────────────────────────────────────────────────
# PHASE 1 — Build lookup dictionaries from first CSV pass
# ──────────────────────────────────────────────────────────────

def build_lookups(df):
    """Return sets of unique stations and offense types from a chunk."""
    stations  = set()
    offenses  = set()

    for _, row in df.iterrows():
        dist  = safe_str(row.get('District_Name'), 100)
        unit  = safe_str(row.get('UnitName'), 200)
        uid   = safe_str(row.get('Unit_ID'), 50)
        cg    = safe_str(row.get('CrimeGroup_Name'), 200)
        ch    = safe_str(row.get('CrimeHead_Name'), 300)
        act   = safe_str(row.get('ActSection'), 500)

        if dist and unit:
            stations.add((unit, uid, dist))
        if cg and ch:
            offenses.add((cg, ch, act))

    return stations, offenses


def upsert_stations(cursor, stations):
    """Insert unique stations and return {(name,district): id}."""
    print(f"  Upserting {len(stations)} unique stations...")
    execute_values(cursor,
        """INSERT INTO stations (name, unit_id, district)
           VALUES %s
           ON CONFLICT (name, district) DO NOTHING""",
        list(stations))

    cursor.execute("SELECT id, name, district FROM stations")
    return {(r[1], r[2]): r[0] for r in cursor.fetchall()}


def upsert_offenses(cursor, offenses):
    """Insert unique offense types and return {(crime_group,crime_head): id}."""
    print(f"  Upserting {len(offenses)} unique offense types...")
    execute_values(cursor,
        """INSERT INTO offense_types (crime_group, crime_head, act_section)
           VALUES %s
           ON CONFLICT (crime_group, crime_head) DO NOTHING""",
        list(offenses))

    cursor.execute("SELECT id, crime_group, crime_head FROM offense_types")
    return {(r[1], r[2]): r[0] for r in cursor.fetchall()}


# ──────────────────────────────────────────────────────────────
# PHASE 2 — Import fir_raw and cases in chunks
# ──────────────────────────────────────────────────────────────

def import_chunk(cursor, chunk_df, station_map, offense_map, location_cache):
    raw_rows  = []
    case_rows = []

    for _, row in chunk_df.iterrows():
        # ── raw values ──────────────────────────────────────
        dist   = safe_str(row.get('District_Name'), 100)
        unit   = safe_str(row.get('UnitName'), 200)
        uid    = safe_str(row.get('Unit_ID'), 50)
        yr     = safe_int(row.get('FIR_YEAR'), 2020)
        mo     = safe_int(row.get('FIR_MONTH'), 1)
        dy     = safe_int(row.get('FIR_Day'), 1)
        dur    = safe_str(row.get('Offence_Duration'), 200)
        ftype  = safe_str(row.get('FIR Type'), 100)
        fstage = safe_str(row.get('FIR_Stage'), 100)
        cmode  = safe_str(row.get('Complaint_Mode'), 100)
        cg     = safe_str(row.get('CrimeGroup_Name'), 200)
        ch     = safe_str(row.get('CrimeHead_Name'), 300)
        lat    = safe_float(row.get('Latitude'))
        lon    = safe_float(row.get('Longitude'))
        act    = safe_str(row.get('ActSection'), 500)
        io     = safe_str(row.get('IOName'), 200)
        kgid   = safe_str(row.get('KGID'), 100)
        int_io = safe_str(row.get('Internal_IO'), 10)
        place  = safe_str(row.get('Place of Offence'))
        dist_ps= safe_float(row.get('Distance from PS'))
        beat   = safe_str(row.get('Beat_Name'), 200)
        village= safe_str(row.get('Village_Area_Name'), 200)
        v_male = safe_int(row.get('Male'))
        v_fem  = safe_int(row.get('Female'))
        v_boy  = safe_int(row.get('Boy'))
        v_girl = safe_int(row.get('Girl'))
        age0   = safe_int(row.get('Age 0'))
        v_cnt  = safe_int(row.get('VICTIM COUNT'))
        a_cnt  = safe_int(row.get('Accused Count'))
        ar_m   = safe_int(row.get('Arrested Male'))
        ar_f   = safe_int(row.get('Arrested Female'))
        # handle tab in column name
        ar_cnt_col = next((c for c in chunk_df.columns if 'Arrested Count' in c), None)
        ar_cnt = safe_int(row.get(ar_cnt_col, 0)) if ar_cnt_col else 0
        chsht  = safe_int(row.get('Accused_ChargeSheeted Count'))
        conv   = safe_int(row.get('Conviction Count'))

        # ── derived fields ──────────────────────────────────
        station_id  = station_map.get((unit, dist)) if unit and dist else None
        offense_id  = offense_map.get((cg, ch))     if cg and ch else None

        # Location: cache by (lat, lon, place) to avoid duplicate inserts
        loc_key  = (lat, lon, place)
        loc_id   = location_cache.get(loc_key)   # resolved later in bulk

        date_filed = build_date(yr, mo, dy)
        fir_num    = kgid if kgid else f"FIR-{yr}-{random.randint(100000,999999)}"
        embedding  = rand_embedding()
        int_io_bool = True if str(int_io).strip().upper() in ('Y', 'YES', '1', 'TRUE') else False

        raw_rows.append((
            dist, unit, yr, mo, dy, dur, ftype, fstage, cmode,
            cg, ch, lat, lon, act, io, kgid, int_io, place,
            dist_ps, beat, village, v_male, v_fem, v_boy, v_girl, age0,
            v_cnt, a_cnt, ar_m, ar_f, ar_cnt, chsht, conv, uid
        ))

        case_rows.append((
            fir_num, yr, mo, dy, date_filed, ftype, fstage, cmode, dur,
            fstage,   # status = fir_stage
            station_id, offense_id,
            io, int_io_bool, dist_ps,
            v_cnt, a_cnt, ar_cnt, chsht, conv,
            v_male, v_fem, v_boy, v_girl, ar_m, ar_f,
            embedding
        ))

    # ── Insert fir_raw ───────────────────────────────────────
    execute_values(cursor, """
        INSERT INTO fir_raw (
            district_name, unit_name, fir_year, fir_month, fir_day,
            offence_duration, fir_type, fir_stage, complaint_mode,
            crime_group, crime_head, latitude, longitude, act_section,
            io_name, kgid, internal_io, place_of_offence, distance_from_ps,
            beat_name, village_area, victim_male, victim_female, victim_boy,
            victim_girl, age_zero, victim_count, accused_count, arrested_male,
            arrested_female, arrested_count, accused_chargesheeted,
            conviction_count, unit_id
        ) VALUES %s
    """, raw_rows)

    # ── Insert cases (ignore duplicate fir_numbers) ──────────
    execute_values(cursor, """
        INSERT INTO cases (
            fir_number, fir_year, fir_month, fir_day, date_filed,
            fir_type, fir_stage, complaint_mode, offence_duration,
            status, station_id, offense_type_id,
            io_name, internal_io, distance_from_ps,
            victim_count, accused_count, arrested_count,
            accused_chargesheeted, conviction_count,
            victim_male, victim_female, victim_boy, victim_girl,
            arrested_male, arrested_female,
            case_embedding
        ) VALUES %s
        ON CONFLICT (fir_number) DO NOTHING
    """, case_rows)


# ──────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Karnataka FIR Dataset Importer")
    print("=" * 60)

    conn   = psycopg2.connect(**DB_PARAMS)
    cursor = conn.cursor()

    # Wipe & recreate
    print("\n[1/4] Cleaning existing data...")
    cursor.execute("""
        TRUNCATE TABLE fir_raw, cases, offense_types, locations, stations
        RESTART IDENTITY CASCADE;
    """)
    conn.commit()

    # ── Pass 1: build all unique lookups from full CSV ───────
    print("\n[2/4] Scanning CSV for unique stations & offense types...")
    all_stations = set()
    all_offenses = set()
    total_rows   = 0

    for chunk in pd.read_csv(CSV_PATH, chunksize=50_000,
                             encoding='utf-8', encoding_errors='replace',
                             low_memory=False):
        s, o = build_lookups(chunk)
        all_stations |= s
        all_offenses |= o
        total_rows   += len(chunk)
        print(f"   ...scanned {total_rows:,} rows", end='\r')

    print(f"\n   Total rows: {total_rows:,}")
    print(f"   Unique stations:  {len(all_stations):,}")
    print(f"   Unique offenses:  {len(all_offenses):,}")

    station_map = upsert_stations(cursor, all_stations)
    offense_map = upsert_offenses(cursor, all_offenses)
    conn.commit()

    # ── Pass 2: import data in chunks ────────────────────────
    print(f"\n[3/4] Importing {total_rows:,} FIR records in chunks of {CHUNK_SIZE:,}...")
    imported = 0
    for chunk in pd.read_csv(CSV_PATH, chunksize=CHUNK_SIZE,
                             encoding='utf-8', encoding_errors='replace',
                             low_memory=False):
        import_chunk(cursor, chunk, station_map, offense_map, {})
        conn.commit()
        imported += len(chunk)
        pct = imported / total_rows * 100
        bar = '#' * int(pct // 5) + '-' * (20 - int(pct // 5))
        print(f"   [{bar}] {pct:5.1f}%  ({imported:>9,} / {total_rows:,})", end='\r')

    print(f"\n\n[4/4] Verifying row counts...")
    for tbl in ('stations', 'offense_types', 'cases', 'fir_raw'):
        cursor.execute(f"SELECT COUNT(*) FROM {tbl}")
        cnt = cursor.fetchone()[0]
        print(f"   {tbl:25s}: {cnt:>10,} rows")

    conn.commit()
    cursor.close()
    conn.close()
    print("\n  Import complete! Database is ready.")


if __name__ == '__main__':
    main()
