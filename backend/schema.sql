-- Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────
-- NORMALIZED LOOKUP TABLES
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    unit_id VARCHAR(50),
    district VARCHAR(100) NOT NULL,
    UNIQUE(name, district)
);

CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    place_name TEXT,
    beat_name VARCHAR(200),
    village_area VARCHAR(200),
    district VARCHAR(100),
    latitude DECIMAL(10, 6),
    longitude DECIMAL(11, 6),
    station_id INTEGER REFERENCES stations(id)
);

CREATE TABLE IF NOT EXISTS offense_types (
    id SERIAL PRIMARY KEY,
    crime_group VARCHAR(200) NOT NULL,
    crime_head VARCHAR(300) NOT NULL,
    act_section TEXT,
    UNIQUE(crime_group, crime_head)
);

-- ─────────────────────────────────────────────
-- MAIN CASES TABLE (real FIR data)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cases (
    id SERIAL PRIMARY KEY,
    fir_number VARCHAR(100) UNIQUE NOT NULL,   -- KGID from dataset
    fir_year SMALLINT,
    fir_month SMALLINT,
    fir_day SMALLINT,
    date_filed DATE,
    fir_type VARCHAR(100),
    fir_stage VARCHAR(100),
    complaint_mode VARCHAR(100),
    offence_duration VARCHAR(200),
    status VARCHAR(100) DEFAULT 'Under Investigation',
    station_id INTEGER REFERENCES stations(id),
    location_id INTEGER REFERENCES locations(id),
    offense_type_id INTEGER REFERENCES offense_types(id),
    io_name VARCHAR(200),                        -- Investigating Officer
    internal_io BOOLEAN DEFAULT FALSE,
    distance_from_ps DECIMAL(12,2),               -- km from police station
    victim_count INTEGER DEFAULT 0,
    accused_count INTEGER DEFAULT 0,
    arrested_count INTEGER DEFAULT 0,
    accused_chargesheeted INTEGER DEFAULT 0,
    conviction_count INTEGER DEFAULT 0,
    victim_male INTEGER DEFAULT 0,
    victim_female INTEGER DEFAULT 0,
    victim_boy INTEGER DEFAULT 0,
    victim_girl INTEGER DEFAULT 0,
    arrested_male INTEGER DEFAULT 0,
    arrested_female INTEGER DEFAULT 0,
    case_embedding vector(768)
);

-- ─────────────────────────────────────────────
-- RAW FIR TABLE (exact 34-column mirror of CSV)
-- Used for full-text search and unstructured queries
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fir_raw (
    id SERIAL PRIMARY KEY,
    district_name VARCHAR(100),
    unit_name VARCHAR(200),
    fir_year SMALLINT,
    fir_month SMALLINT,
    fir_day SMALLINT,
    offence_duration VARCHAR(200),
    fir_type VARCHAR(100),
    fir_stage VARCHAR(100),
    complaint_mode VARCHAR(100),
    crime_group VARCHAR(200),
    crime_head VARCHAR(300),
    latitude DECIMAL(10, 6),
    longitude DECIMAL(11, 6),
    act_section TEXT,
    io_name VARCHAR(200),
    kgid VARCHAR(100),
    internal_io VARCHAR(10),
    place_of_offence TEXT,
    distance_from_ps DECIMAL(12,2),
    beat_name VARCHAR(200),
    village_area VARCHAR(200),
    victim_male INTEGER DEFAULT 0,
    victim_female INTEGER DEFAULT 0,
    victim_boy INTEGER DEFAULT 0,
    victim_girl INTEGER DEFAULT 0,
    age_zero INTEGER DEFAULT 0,
    victim_count INTEGER DEFAULT 0,
    accused_count INTEGER DEFAULT 0,
    arrested_male INTEGER DEFAULT 0,
    arrested_female INTEGER DEFAULT 0,
    arrested_count INTEGER DEFAULT 0,
    accused_chargesheeted INTEGER DEFAULT 0,
    conviction_count INTEGER DEFAULT 0,
    unit_id VARCHAR(50),
    case_id INTEGER REFERENCES cases(id)
);

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cases_fir       ON cases(fir_number);
CREATE INDEX IF NOT EXISTS idx_cases_date      ON cases(date_filed);
CREATE INDEX IF NOT EXISTS idx_cases_year      ON cases(fir_year);
CREATE INDEX IF NOT EXISTS idx_cases_station   ON cases(station_id);
CREATE INDEX IF NOT EXISTS idx_cases_offense   ON cases(offense_type_id);
CREATE INDEX IF NOT EXISTS idx_cases_io        ON cases(io_name);
CREATE INDEX IF NOT EXISTS idx_fir_raw_district ON fir_raw(district_name);
CREATE INDEX IF NOT EXISTS idx_fir_raw_crime   ON fir_raw(crime_group, crime_head);
CREATE INDEX IF NOT EXISTS idx_fir_raw_latlon  ON fir_raw(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_fir_raw_year    ON fir_raw(fir_year, fir_month);
CREATE INDEX IF NOT EXISTS idx_fir_raw_io      ON fir_raw(io_name);
-- Additional indexes for common trend/aggregation query patterns
CREATE INDEX IF NOT EXISTS idx_fir_raw_unit    ON fir_raw(unit_name);
CREATE INDEX IF NOT EXISTS idx_fir_raw_year_crime ON fir_raw(fir_year, crime_group);
CREATE INDEX IF NOT EXISTS idx_fir_raw_beat    ON fir_raw(beat_name);

-- Vector similarity search (hnsw for speed on 1.6M rows)
CREATE INDEX IF NOT EXISTS idx_cases_embedding ON cases USING hnsw (case_embedding vector_l2_ops);

