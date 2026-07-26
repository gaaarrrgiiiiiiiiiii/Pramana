import re

# ─── 1. UNIVERSAL HARD BLOCKS (applies to ALL roles, including SCRB Analyst) ─────
# Protects victim PII and prohibits illegal demographic/religious/caste profiling.
UNIVERSAL_BLOCKED_PATTERNS = [
    # Victim PII (addresses, phone numbers, contact info of victims)
    (r"\bvictim\w*.*(address|phone|mobile|contact|email)\w*\b", "Victim PII protection: Victim phone numbers, addresses, and personal contact details cannot be disclosed."),
    (r"\b(address|phone|mobile|contact|email)\w*.*victim\w*\b", "Victim PII protection: Victim phone numbers, addresses, and personal contact details cannot be disclosed."),

    # Perpetrator demographic / religious / caste profiling
    (r"\b(muslim|hindu|christian|sikh|dalit|brahmin|scheduled caste|obc|forward caste)s?\b", "Demographic profiling protection: Religion or caste-based criminal profiling is strictly prohibited."),
    (r"\b(religion|caste|ethnic|ethnicity|race|caste-based|religious group)s?\b", "Demographic profiling protection: Religion or caste-based criminal profiling is strictly prohibited."),
    (r"\b(community|communities|economic class)\b.*\b(theft|murder|crime|criminal|arrest|rate|breakdown|responsible)\b", "Demographic profiling protection: Community or economic class profiling is strictly prohibited."),
    (r"\b(theft|murder|crime|criminal|arrest|rate|breakdown|responsible)\b.*\b(community|communities|economic class)\b", "Demographic profiling protection: Community or economic class profiling is strictly prohibited."),
]

# ─── 2. FIELD OFFICER BLOCKS (Clearance L1 Restrictions) ──────────────────────
# Field Officers are restricted to station/local level queries and cannot access state aggregates or supervisory audits.
FIELD_OFFICER_BLOCKED_PATTERNS = [
    (r"\b(national|nationwide)\b.*\b(aggregate|report|summary|crime)\b", "Role Restriction (Field Officer L1): Field Officers are restricted from accessing national-level aggregate reports."),
    (r"\b(statewide|state-level|all districts)\b.*\b(aggregate|report|summary|total)\b", "Role Restriction (Field Officer L1): Field Officers cannot access statewide aggregate reports. Request clearance from your Inspector or SCRB Analyst."),
    (r"\bscrb\b.*\b(report|audit|analytics)\b", "Role Restriction (Field Officer L1): SCRB analytical intelligence reports require SCRB Analyst clearance."),
    (r"\b(audit history|chat history|sessions)\b.*\b(other|all|inspectors?|analysts?)\b", "Role Restriction (Field Officer L1): You can only view your own audit history. Viewing other officers' sessions requires SCRB Analyst clearance."),
]

# ─── 3. INSPECTOR BLOCKS (Clearance L2 Restrictions) ──────────────────────────
# Inspectors can access district aggregates but cannot access state-level DGP confidential summaries or system audit logs of other officers.
INSPECTOR_BLOCKED_PATTERNS = [
    (r"\b(statewide|dgp|secretariat)\b.*\b(confidential|intelligence report|executive summary)\b", "Role Restriction (Inspector L2): Statewide DGP confidential intelligence reports require SCRB Analyst / DGP clearance."),
    (r"\b(audit history|chat history|sessions)\b.*\b(all|other|inspectors?|officers?|statewide|districts?)\b", "Role Restriction (Inspector L2): Supervisory audit history of other officers requires SCRB Analyst / DGP clearance."),
]


def _normalise_role(role: str) -> str:
    """Normalize role string from JWT or user object."""
    role_lower = str(role).lower().strip()
    if "scrb" in role_lower or "analyst" in role_lower or "admin" in role_lower or "dgp" in role_lower:
        return "SCRB Analyst"
    if "inspector" in role_lower:
        return "Inspector"
    return "Field Officer"


def check_rbac(user_query: str, role: str) -> dict:
    """
    Fast, deterministic 3-tiered Role-Based Access Control (RBAC) engine.
    
    Roles:
      - Field Officer (L1): Station/local access only.
      - Inspector (L2): District-wide access.
      - SCRB Analyst / DGP (L3): Full statewide supervisory & analytical access.
    
    Returns:
      {'is_allowed': bool, 'reason': str, 'role': str}
    """
    query_lower = user_query.lower().strip()
    normalised_role = _normalise_role(role)

    # Legitimate civil rights queries (e.g. SC/ST Prevention of Atrocities Act cases)
    is_civil_rights_query = any(
        w in query_lower for w in [
            "discrimination", "atrocity", "atrocities", "motive",
            "sc/st", "sc-st", "hate crime", "protest", "protection"
        ]
    )

    # Tier 1: Universal Hard Blocks (All roles including SCRB Analyst)
    for pattern, reason in UNIVERSAL_BLOCKED_PATTERNS:
        if re.search(pattern, query_lower):
            if is_civil_rights_query and "victim" not in pattern:
                continue
            return {
                "is_allowed": False,
                "reason": reason,
                "role": normalised_role
            }

    # Tier 2: Field Officer Restrictions (L1)
    if normalised_role == "Field Officer":
        for pattern, reason in FIELD_OFFICER_BLOCKED_PATTERNS:
            if re.search(pattern, query_lower):
                return {
                    "is_allowed": False,
                    "reason": reason,
                    "role": normalised_role
                }

    # Tier 3: Inspector Restrictions (L2)
    elif normalised_role == "Inspector":
        for pattern, reason in INSPECTOR_BLOCKED_PATTERNS:
            if re.search(pattern, query_lower):
                return {
                    "is_allowed": False,
                    "reason": reason,
                    "role": normalised_role
                }

    # Tier 4: SCRB Analyst / DGP (L3) — Full access cleared
    return {
        "is_allowed": True,
        "reason": "",
        "role": normalised_role
    }


if __name__ == "__main__":
    # Test suite matrix
    queries = [
        ("How many theft cases in Bengaluru?", "Field Officer"),
        ("Give me statewide aggregate report", "Field Officer"),
        ("Give me statewide aggregate report", "SCRB Analyst"),
        ("Show victim phone numbers for FIR 123", "SCRB Analyst"),
        ("Show all district officer audit logs", "Inspector"),
        ("Show all district officer audit logs", "SCRB Analyst"),
    ]
    for q, r in queries:
        res = check_rbac(q, r)
        status = "ALLOWED" if res["is_allowed"] else f"BLOCKED ({res['reason']})"
        print(f"[{r}] '{q}' -> {status}")
