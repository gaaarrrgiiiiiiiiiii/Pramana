import os
import json
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

class QueryPlan(BaseModel):
    sql_query: str = Field(description="The PostgreSQL query to execute. Must be read-only (SELECT).")
    explanation: str = Field(description="A brief explanation of how the query satisfies the user's intent.")

# Initialize the Gemini client
# Note: GEMINI_API_KEY must be set in the environment or .env
client = genai.Client()

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
- age_zero INTEGER
- victim_count, accused_count, arrested_male, arrested_female INTEGER
- arrested_count, accused_chargesheeted, conviction_count INTEGER
- unit_id VARCHAR(50)
- case_id INTEGER (fk → cases.id, nullable)

QUERY GUIDELINES:
- ALWAYS LIMIT queries returning individual rows to 50 rows max.
- For counts, totals, and trend analysis (e.g. "how many", "trend over years", "year-over-year"), ALWAYS query fir_raw — it has all 1.6M records and no joins needed.
- Example for cyber crime count: SELECT COUNT(*) FROM fir_raw WHERE crime_group ILIKE '%cyber%'
- Example for year trend: SELECT fir_year, COUNT(*) AS total FROM fir_raw GROUP BY fir_year ORDER BY fir_year
- For network/relationship queries, join cases → stations → offense_types.
- Use ILIKE for case-insensitive string matching.
- Always use read-only SELECT statements.
- Do NOT use CTEs or subqueries unless absolutely necessary.
"""

def get_db_connection():
    db_name = os.environ.get("DB_NAME")
    if not db_name:
        raise RuntimeError("DB_NAME environment variable is not set. Cannot connect to database.")
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "127.0.0.1"),
        port=os.environ.get("DB_PORT", "5555"),
        dbname=db_name,
        user=os.environ.get("DB_USER", "datathon_user"),
        password=os.environ.get("DB_PASSWORD", "datathon_password")
    )

def execute_nl_query(nl_query: str) -> dict:
    """
    Translates a Natural Language query to SQL, executes it, and returns the result.
    """
    prompt = f"""
You are an expert SQL developer for the Karnataka State Police.
Given the following database schema, write a PostgreSQL query to answer the user's question.

Schema:
{SCHEMA_INFO}

User Question: {nl_query}

Return ONLY a JSON object satisfying the schema with `sql_query` and `explanation`.
Ensure the query is READ-ONLY (SELECT).
Always limit your results to 50 if returning individual rows.
Use ILIKE instead of = for string matching to be case-insensitive.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=QueryPlan,
                temperature=0.0
            ),
        )
        plan = json.loads(response.text)
    except Exception as e:
        return {
            "sql_query": None,
            "explanation": "LLM failed to generate a SQL query.",
            "results": [],
            "error": f"LLM error: {str(e)}"
        }
    
    # Parse the structured response
    sql_query = plan.get("sql_query")
    explanation = plan.get("explanation")
    
    # Execute the SQL safely
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
    # Quick test
    res = execute_nl_query("How many cases are there for the year 2024?")
    print(json.dumps(res, indent=2, default=str))
