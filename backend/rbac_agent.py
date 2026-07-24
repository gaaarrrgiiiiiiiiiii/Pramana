import re

# ─── HARD BLOCKS (applies to ALL roles, even SCRB Analyst) ─────────────────
# These are specific sensitive request patterns that should always be blocked.
# Sensitive request patterns that should always be blocked.
BLOCKED_PATTERNS = [
    # Victim PII (addresses, phone numbers, contact info of victims of sensitive crimes like rape/assault)
    r"\bvictim\w*.*(address|phone|mobile|contact)\w*\b",
    r"\b(address|phone|mobile|contact)\w*.*victim\w*\b",
    
    # Perpetrator demographic/religious/caste/ethnic/class profiling
    r"\b(muslim|hindu|christian|sikh|dalit|brahmin|scheduled caste|obc|forward caste)s?\b",
    r"\b(religion|caste|ethnic|ethnicity|race|caste-based|religious group)s?\b",
    r"\b(community|communities|economic class)\b.*\b(theft|murder|crime|criminal|arrest|rate|breakdown|responsible)\b",
    r"\b(theft|murder|crime|criminal|arrest|rate|breakdown|responsible)\b.*\b(community|communities|economic class)\b",
    r"\bnames? suggest\b",
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
    """
    query_lower = user_query.lower().strip()
    normalised_role = _normalise_role(role)

    # Allow legitimate queries about caste-based discrimination/violence (SC/ST Act cases)
    is_legitimate_civil_rights = any(
        w in query_lower for w in [
            "discrimination", "atrocity", "atrocities", "motive",
            "sc/st", "sc-st", "hate crime", "protest"
        ]
    )

    # 1. Hard blocks for all roles
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, query_lower):
            # If it's a perpetrator profiling pattern but matches civil rights keywords, allow it
            if is_legitimate_civil_rights and "victim" not in pattern:
                continue
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

    # 3. Everything else is allowed
    return {"is_allowed": True, "reason": ""}
