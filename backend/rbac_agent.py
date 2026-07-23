import re

# ─── HARD BLOCKS (applies to ALL roles, even SCRB Analyst) ─────────────────
# These are specific sensitive request patterns that should always be blocked.
BLOCKED_PATTERNS = [
    # Victim PII
    r"\bvictim.*address\b",
    r"\bvictim.*phone\b",
    r"\bvictim.*mobile\b",
    r"\bvictim.*contact\b",
    r"\baddress.*rape.*victim\b",
    r"\bphone.*assault.*victim\b",
    # Perpetrator demographic profiling
    r"\bcrime.*by (muslim|hindu|christian|sikh|dalit|brahmin|scheduled caste|obc|forward caste)\b",
    r"\bwhich (community|religion|caste|race) (commit|commits|has the most|is responsible)\b",
    r"\b(muslim|hindu|christian|sikh|dalit|brahmin).*crime rate\b",
    r"\bethnic.*profil\b",
    r"\bcaste.*criminal\b",
]

# ─── Role-specific restrictions ─────────────────────────────────────────────
# Field Officers cannot query national-level SCRB aggregate reports.
FIELD_OFFICER_BLOCKS = [
    r"\bnational.*aggregate\b",
    r"\bscrb.*report\b",
    r"\ball.*districts.*aggregate\b",
    r"\bnationwide.*crime\b",
]

# Role display name normalisation (handle varying capitalisation from JWT)
def _normalise_role(role: str) -> str:
    role_lower = role.lower().strip()
    if "scrb" in role_lower or "analyst" in role_lower or "admin" in role_lower:
        return "SCRB Analyst"
    if "inspector" in role_lower:
        return "Inspector"
    return "Field Officer"


def check_rbac(user_query: str, role: str) -> dict:
    """
    Fast, deterministic rule-based RBAC check.
    Returns {'is_allowed': bool, 'reason': str}.

    Replaces the previous LLM-based check which was unreliable
    (failed closed on Gemini API errors, blocking all queries).
    """
    query_lower = user_query.lower().strip()
    normalised_role = _normalise_role(role)

    # 1. Hard blocks for all roles
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, query_lower):
            return {
                "is_allowed": False,
                "reason": (
                    "This query involves protected information: victim PII or "
                    "perpetrator demographic profiling is not permitted."
                )
            }

    # 2. Field Officer restrictions
    if normalised_role == "Field Officer":
        for pattern in FIELD_OFFICER_BLOCKS:
            if re.search(pattern, query_lower):
                return {
                    "is_allowed": False,
                    "reason": "Field Officers cannot access national-level SCRB aggregate reports."
                }

    # 3. Everything else is allowed — the semantic router will further classify
    #    out-of-scope queries (recipes, weather, etc.) and decline them gracefully.
    return {"is_allowed": True, "reason": ""}
