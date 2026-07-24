import os
import re
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

# ─── DB Connection ────────────────────────────────────────────────────────────
def get_db_connection():
    db_name = os.environ.get("DB_NAME")
    if not db_name:
        raise RuntimeError("DB_NAME environment variable is not set.")
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "127.0.0.1"),
        port=os.environ.get("DB_PORT", "5555"),
        dbname=db_name,
        user=os.environ.get("DB_USER", "datathon_user"),
        password=os.environ.get("DB_PASSWORD", "datathon_password")
    )

# ─── Schema description passed to LLM ────────────────────────────────────────
SCHEMA_INFO = """
Table `stations`:
- id SERIAL PRIMARY KEY
- name VARCHAR(200) — police station name
- district VARCHAR(100) — district name

Table `offense_types`:
- id SERIAL PRIMARY KEY
- crime_group VARCHAR(200) — broad category (e.g. 'THEFT', 'KIDNAPPING AND ABDUCTION')
- crime_head VARCHAR(300) — specific charge
- act_section TEXT — IPC/special law section

Table `cases`:
- id SERIAL PRIMARY KEY
- fir_number VARCHAR(100) — unique FIR identifier (KGID)
- fir_year SMALLINT, fir_month SMALLINT, fir_day SMALLINT
- date_filed DATE
- fir_type VARCHAR(100), fir_stage VARCHAR(100), complaint_mode VARCHAR(100)
- status VARCHAR(100) DEFAULT 'Under Investigation'
- station_id INTEGER (fk → stations.id)
- offense_type_id INTEGER (fk → offense_types.id)
- io_name VARCHAR(200) — Investigating Officer full name
- distance_from_ps DECIMAL(12,2) — km from police station
- victim_count, accused_count, arrested_count INTEGER
- victim_male, victim_female, victim_boy, victim_girl INTEGER
- arrested_male, arrested_female INTEGER
- accused_chargesheeted, conviction_count INTEGER

Table `fir_raw` (1.6M rows — mirrors the full CSV; use for counts, trends, and text search):
- id SERIAL PRIMARY KEY
- district_name VARCHAR(100)
- unit_name VARCHAR(200) — police station/unit
- fir_year SMALLINT, fir_month SMALLINT, fir_day SMALLINT
- offence_duration VARCHAR(200)
- fir_type VARCHAR(100), fir_stage VARCHAR(100), complaint_mode VARCHAR(100)
- crime_group VARCHAR(200) — e.g. 'THEFT', 'MURDER', 'CYBERCRIME'
- crime_head VARCHAR(300) — specific charge head
- latitude DECIMAL(10,6), longitude DECIMAL(11,6)
- act_section TEXT
- io_name VARCHAR(200) — Investigating Officer name
- kgid VARCHAR(100) — FIR number
- internal_io VARCHAR(10)
- place_of_offence TEXT — free-text offence location
- distance_from_ps DECIMAL(12,2)
- beat_name VARCHAR(200), village_area VARCHAR(200)
- victim_male, victim_female, victim_boy, victim_girl INTEGER
- victim_count, accused_count, arrested_male, arrested_female INTEGER
- arrested_count, accused_chargesheeted, conviction_count INTEGER
- unit_id VARCHAR(50)
- case_id INTEGER (fk → cases.id, nullable)

QUERY GUIDELINES:
- ALWAYS LIMIT queries returning individual rows to 50 rows max.
- For counts, totals, and trend analysis, ALWAYS query fir_raw — it has all 1.6M records.
- Use ILIKE for case-insensitive string matching.
- Always use read-only SELECT statements.
"""

# ─── Keyword → SQL Pattern Fallbacks ─────────────────────────────────────────
# Used when the LLM is unavailable (API key revoked, quota exceeded, etc.)
_DISTRICT_MAP = {
    "bangalore": "Bengaluru", "bengaluru": "Bengaluru", "blr": "Bengaluru",
    "mysore": "Mysuru", "mysuru": "Mysuru",
    "hubli": "Dharwad", "dharwad": "Dharwad",
    "mangalore": "Dakshina Kannada", "mangaluru": "Dakshina Kannada",
    "belgaum": "Belagavi", "belagavi": "Belagavi",
    "gulbarga": "Kalaburagi", "kalaburagi": "Kalaburagi",
    "bellary": "Ballari", "ballari": "Ballari",
    "shimoga": "Shivamogga", "shivamogga": "Shivamogga",
    "tumkur": "Tumakuru", "tumakuru": "Tumakuru",
    "udupi": "Udupi", "hassan": "Hassan",
}

_CRIME_MAP = {
    "theft": "THEFT", "thft": "THEFT", "stealing": "THEFT",
    "murder": "MURDER", "homicide": "MURDER",
    "rape": "RAPE", "assault": "ASSAULT",
    "kidnap": "KIDNAPPING AND ABDUCTION", "abduction": "KIDNAPPING AND ABDUCTION",
    "fraud": "FRAUD", "cheating": "FRAUD",
    "cybercrime": "CYBERCRIME", "cyber": "CYBERCRIME", "hacking": "CYBERCRIME",
    "robbery": "ROBBERY", "dacoity": "DACOITY",
    "burglary": "BURGLARY", "house breaking": "BURGLARY",
    "drug": "NARCOTICS", "narcotic": "NARCOTICS",
    "accident": "ACCIDENT", "road accident": "ACCIDENT",
    "missing": "MISSING PERSONS", "missing person": "MISSING PERSONS",
    "hurt": "HURT", "grievous hurt": "GRIEVOUS HURT",
    "arson": "ARSON",
}

def _keyword_sql_fallback(nl_query: str) -> dict | None:
    """
    Generates a simple SQL query from keyword matching when the LLM is unavailable.
    Returns None if no pattern matched (let the caller handle it).
    """
    q = nl_query.lower()

    # Find district
    district = None
    for kw, val in _DISTRICT_MAP.items():
        if kw in q:
            district = val
            break

    # Find crime type
    crime = None
    for kw, val in _CRIME_MAP.items():
        if kw in q:
            crime = val
            break

    # Find year
    year_match = re.search(r"\b(20\d{2})\b", q)
    year = int(year_match.group(1)) if year_match else None

    # Detect query type
    is_trend = any(w in q for w in ["trend", "year", "over the years", "yearly", "annual", "growth", "month"])
    is_count = any(w in q for w in ["how many", "count", "total", "number of"])
    is_top = any(w in q for w in ["top", "most", "highest", "maximum", "worst"])
    is_station = any(w in q for w in ["station", "unit", "ps"])
    is_district = any(w in q for w in ["district", "zone", "city", "taluk"])
    is_io = any(w in q for w in ["officer", "io", "investigating officer", "inspector"])

    # Build SQL based on detected pattern
    if is_trend and crime:
        where = f"WHERE crime_group ILIKE '%{crime}%'"
        if district:
            where += f" AND district_name ILIKE '%{district}%'"
        sql = f"SELECT fir_year, COUNT(*) AS total FROM fir_raw {where} GROUP BY fir_year ORDER BY fir_year"
        explanation = f"Year-wise trend of {crime} cases" + (f" in {district}" if district else "")
    elif is_trend:
        where = "WHERE 1=1"
        if district:
            where += f" AND district_name ILIKE '%{district}%'"
        if year:
            where += f" AND fir_year = {year}"
        sql = f"SELECT fir_year, COUNT(*) AS total FROM fir_raw {where} GROUP BY fir_year ORDER BY fir_year"
        explanation = "Year-wise crime trend" + (f" in {district}" if district else "")
    elif is_top and is_station and crime:
        where = f"WHERE crime_group ILIKE '%{crime}%'"
        if district:
            where += f" AND district_name ILIKE '%{district}%'"
        sql = f"SELECT unit_name, COUNT(*) AS total FROM fir_raw {where} GROUP BY unit_name ORDER BY total DESC LIMIT 10"
        explanation = f"Top stations by {crime} cases" + (f" in {district}" if district else "")
    elif is_top and is_district:
        where = "WHERE 1=1"
        if crime:
            where += f" AND crime_group ILIKE '%{crime}%'"
        if year:
            where += f" AND fir_year = {year}"
        sql = f"SELECT district_name, COUNT(*) AS total FROM fir_raw {where} GROUP BY district_name ORDER BY total DESC LIMIT 10"
        explanation = "Top districts by crime count" + (f" ({crime})" if crime else "")
    elif is_count and crime and district:
        where = f"WHERE crime_group ILIKE '%{crime}%' AND district_name ILIKE '%{district}%'"
        if year:
            where += f" AND fir_year = {year}"
        sql = f"SELECT COUNT(*) AS total FROM fir_raw {where}"
        explanation = f"Count of {crime} cases in {district}" + (f" in {year}" if year else "")
    elif is_count and crime:
        where = f"WHERE crime_group ILIKE '%{crime}%'"
        if year:
            where += f" AND fir_year = {year}"
        sql = f"SELECT COUNT(*) AS total FROM fir_raw {where}"
        explanation = f"Total count of {crime} cases" + (f" in {year}" if year else "")
    elif crime and district:
        where = f"WHERE crime_group ILIKE '%{crime}%' AND district_name ILIKE '%{district}%'"
        if year:
            where += f" AND fir_year = {year}"
        sql = f"SELECT kgid, fir_year, district_name, unit_name, crime_head, io_name FROM fir_raw {where} LIMIT 50"
        explanation = f"Listing {crime} cases in {district}" + (f" for {year}" if year else "")
    elif crime:
        where = f"WHERE crime_group ILIKE '%{crime}%'"
        if year:
            where += f" AND fir_year = {year}"
        sql = f"SELECT kgid, fir_year, district_name, unit_name, crime_head, io_name FROM fir_raw {where} LIMIT 50"
        explanation = f"Listing {crime} cases" + (f" for {year}" if year else "")
    elif district:
        where = f"WHERE district_name ILIKE '%{district}%'"
        if year:
            where += f" AND fir_year = {year}"
        sql = f"SELECT fir_year, crime_group, COUNT(*) AS total FROM fir_raw {where} GROUP BY fir_year, crime_group ORDER BY fir_year, total DESC LIMIT 50"
        explanation = f"Crime summary for {district}" + (f" in {year}" if year else "")
    elif is_io:
        sql = "SELECT io_name, COUNT(*) AS cases FROM fir_raw GROUP BY io_name ORDER BY cases DESC LIMIT 20"
        explanation = "Top investigating officers by case count"
    else:
        return None  # No pattern matched; let caller decide

    return {"sql_query": sql, "explanation": explanation}


def execute_nl_query(nl_query: str) -> dict:
    """
    Translates NL → SQL using Gemini LLM, with automatic keyword-based fallback
    when the LLM is unavailable (API quota exceeded, key revoked, etc.).
    """
    plan = None
    used_fallback = False

    # ── Try Gemini LLM first ──────────────────────────────────────────────────
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if api_key and not api_key.startswith("your_"):
        try:
            from google import genai
            from google.genai import types
            from pydantic import BaseModel, Field

            class QueryPlan(BaseModel):
                sql_query: str = Field(description="The PostgreSQL query to execute. Must be read-only (SELECT).")
                explanation: str = Field(description="A brief explanation of how the query satisfies the user's intent.")

            client = genai.Client()
            prompt = f"""You are an expert SQL developer for the Karnataka State Police.
Given the following database schema, write a PostgreSQL query to answer the user's question.

Schema:
{SCHEMA_INFO}

User Question: {nl_query}

Return ONLY a JSON object with `sql_query` and `explanation`.
Ensure the query is READ-ONLY (SELECT). Always limit individual row results to 50.
Use ILIKE instead of = for string matching to be case-insensitive.
"""
            response = client.models.generate_content(
                model='models/gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=QueryPlan,
                    temperature=0.0
                ),
            )
            plan = json.loads(response.text)
        except Exception as e:
            print(f"[QueryAgent] Gemini LLM failed: {e}. Falling back to keyword SQL.")
            plan = None

    # ── Keyword SQL fallback ──────────────────────────────────────────────────
    if not plan:
        plan = _keyword_sql_fallback(nl_query)
        if plan:
            used_fallback = True
        else:
            return {
                "sql_query": None,
                "explanation": "Could not determine a SQL query from the input.",
                "results": [],
                "error": "No LLM available and keyword patterns did not match this query. Please be more specific (include crime type, district, or year)."
            }

    sql_query = plan.get("sql_query")
    explanation = plan.get("explanation", "")
    if used_fallback:
        explanation = "[Pattern-matched] " + explanation

    # ── Execute SQL ───────────────────────────────────────────────────────────
    results = []
    error = None
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(sql_query)
                results = [dict(r) for r in cur.fetchall()]
    except Exception as e:
        error = str(e)

    return {
        "sql_query": sql_query,
        "explanation": explanation,
        "results": results,
        "error": error
    }


if __name__ == "__main__":
    # Quick test without LLM
    tests = [
        "show me crime trend over the years",
        "show me theft cases in bangalore",
        "how many murder cases in 2022",
        "top stations for cybercrime",
        "show me da theft caes in blr",
    ]
    for q in tests:
        res = execute_nl_query(q)
        print(f"\nQuery: {q}")
        print(f"SQL: {res.get('sql_query')}")
        print(f"Explanation: {res.get('explanation')}")
        print(f"Error: {res.get('error')}")

