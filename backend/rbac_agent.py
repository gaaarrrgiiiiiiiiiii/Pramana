import json
import re
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

client = genai.Client()

# Fast pre-check: patterns that are obviously harmless and not police-database-related.
# These bypass the LLM RBAC call entirely, returning allowed=True so the router
# can classify them as out-of-scope and serve a graceful decline.
HARMLESS_PATTERNS = [
    r"\brecipe\b", r"\bcook\b", r"\bfood\b", r"\bbake\b",
    r"\bjoke\b", r"\bfunny\b", r"\bhumour\b",
    r"\bcapital of\b", r"\bwhat is the capital\b",
    r"\bpoem\b", r"\bwrite a story\b", r"\bsong\b",
    r"\bweather\b", r"\bstock price\b", r"\bexchange rate\b",
    r"\bpython script\b", r"\bhow do i code\b", r"\bprogramming\b",
    r"\btranslate\b", r"\bdictionary meaning\b",
]

class RBACDecision(BaseModel):
    is_allowed: bool = Field(description="True if the query complies with the role's access policies.")
    reason: str = Field(description="If rejected, the concise reason why. If allowed, leave blank.")

def check_rbac(user_query: str, role: str) -> dict:
    """
    Evaluates a user query against the access control policies for their role.
    All roles are checked via LLM — no role bypasses the gatekeeper entirely.
    Harmless out-of-scope queries are fast-passed before the LLM is called.
    """
    # Fast pre-check: if the query matches an obviously harmless pattern,
    # skip the LLM entirely and allow it through so the router can gracefully
    # decline it as out-of-scope. This prevents RBAC from blocking biryani recipes.
    query_lower = user_query.lower()
    for pattern in HARMLESS_PATTERNS:
        if re.search(pattern, query_lower):
            return {"is_allowed": True, "reason": ""}

    prompt = f"""
You are the RBAC (Role-Based Access Control) Security Agent for the Karnataka State Police database.
A user with the role '{role}' is trying to run the following query:
'{user_query}'

UNIVERSAL BLOCK LIST (applies to ALL roles including SCRB Analyst):
- CANNOT request personally identifiable information about VICTIMS (e.g., home address, phone number of rape/assault victims).
- CANNOT request queries that profile PERPETRATORS by religion, caste, or ethnicity (e.g., "crimes committed by Muslims", "which caste commits the most thefts").
- CANNOT request indirect demographic profiling of perpetrators (e.g., "which community has the highest crime rate").

IMPORTANT CARVE-OUTS — these are ALLOWED and must NOT be blocked:
- Queries about hate crimes where the demographic is mentioned as the VICTIM (e.g., "hate crimes targeting religious minorities", "caste-based discrimination cases") are ALLOWED.
- Queries about statistical crime trends by location or time are ALLOWED.
- Queries about political protests resulting in arrests are ALLOWED.
- Queries about victim demographics in aggregate (e.g., "age group of cyber fraud victims") are ALLOWED.

Rules for Field Officer (restricted):
- CAN query specific cases by ID, date, or location.
- CAN query crime trends in their jurisdiction.
- CANNOT request national-level SCRB aggregate reports.

Rules for Inspector (standard):
- CAN query broader district-level data and IO assignments.
- CAN access network graph data.

Rules for SCRB Analyst (high clearance):
- CAN access district-level statistical reports and aggregates.
- CANNOT access victim PII or perpetrator demographic profiles (universal block still applies).

Evaluate if the query violates the UNIVERSAL BLOCK LIST above.
Return a JSON with `is_allowed` (boolean) and `reason` (string).
    """

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=RBACDecision,
                temperature=0.0
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"RBAC error: {e}")
        # Fail-safe: block on error rather than allow
        return {"is_allowed": False, "reason": "RBAC system error — query blocked for safety."}
