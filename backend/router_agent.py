import os
import re
import json
from dotenv import load_dotenv

load_dotenv()

# ─── Keyword-based intent classification fallback ────────────────────────────
# Used when Gemini LLM is unavailable (key revoked, quota, network error).

_GREETING_WORDS = {"hi", "hello", "hey", "namaste", "good morning", "good evening",
                   "thanks", "thank you", "who are you", "what can you do", "help me",
                   "what is pramana", "how are you"}

_TREND_WORDS = {"trend", "over the years", "yearly", "annual", "year-over-year",
                "growth", "month wise", "monthly", "over time", "by year", "per year",
                "historical", "past years", "compare year"}

_NETWORK_WORDS = {"connection", "network", "link", "linked", "associated", "gang",
                  "organization", "officer network", "co-accused", "same officer",
                  "related cases", "relationship"}

_OOS_WORDS = {"recipe", "cook", "food", "bake", "joke", "funny", "capital of",
              "weather", "stock", "exchange rate", "python script", "how to code",
              "programming", "song", "poem", "cricket", "football", "sports",
              "translate this word", "dictionary meaning"}

_DISTRICT_MAP = {
    "bangalore": "Bengaluru", "bengaluru": "Bengaluru", "blr": "Bengaluru",
    "mysore": "Mysuru", "mysuru": "Mysuru",
    "hubli": "Dharwad", "dharwad": "Dharwad",
    "mangalore": "Dakshina Kannada", "mangaluru": "Dakshina Kannada",
    "belgaum": "Belagavi", "belagavi": "Belagavi",
    "gulbarga": "Kalaburagi", "kalaburagi": "Kalaburagi",
    "ballari": "Ballari", "bellary": "Ballari",
    "shimoga": "Shivamogga", "shivamogga": "Shivamogga",
    "tumkur": "Tumakuru", "tumakuru": "Tumakuru",
    "udupi": "Udupi", "hassan": "Hassan",
}

_CRIME_MAP = {
    "theft": "theft", "thft": "theft", "stealing": "theft",
    "murder": "murder", "homicide": "murder",
    "rape": "rape", "assault": "assault",
    "kidnap": "kidnapping", "abduction": "kidnapping",
    "fraud": "fraud", "cheating": "fraud",
    "cybercrime": "cybercrime", "cyber": "cybercrime",
    "robbery": "robbery", "dacoity": "dacoity",
    "burglary": "burglary", "housebreaking": "burglary",
    "drug": "narcotics", "narcotic": "narcotics",
    "accident": "accident", "missing": "missing persons",
    "hurt": "hurt", "arson": "arson",
}


def _keyword_route(query: str, conversation_history: list = None) -> dict:
    """
    Classifies intent and resolves query using keyword matching.
    Used as fallback when Gemini is unavailable.
    """
    q_lower = query.lower().strip()
    words = set(q_lower.split())

    # Check greetings / conversational
    for gw in _GREETING_WORDS:
        if gw in q_lower:
            return {
                "reasoning": "Keyword match: greeting/conversational",
                "intent": "conversational",
                "resolved_query": query,
                "clarification_question": ""
            }

    # Check out-of-scope
    for oos in _OOS_WORDS:
        if oos in q_lower:
            return {
                "reasoning": "Keyword match: out-of-scope topic",
                "intent": "out-of-scope",
                "resolved_query": query,
                "clarification_question": ""
            }

    # Check network intent
    for nw in _NETWORK_WORDS:
        if nw in q_lower:
            return {
                "reasoning": "Keyword match: network/relationship query",
                "intent": "network",
                "resolved_query": _normalise_query(query),
                "clarification_question": ""
            }

    # Check trend intent
    for tw in _TREND_WORDS:
        if tw in q_lower:
            return {
                "reasoning": "Keyword match: trend/temporal query",
                "intent": "trend",
                "resolved_query": _normalise_query(query),
                "clarification_question": ""
            }

    # If the query has crime/location keywords → factual
    has_crime = any(kw in q_lower for kw in _CRIME_MAP)
    has_location = any(kw in q_lower for kw in _DISTRICT_MAP)
    has_year = bool(re.search(r"\b20\d{2}\b", q_lower))
    has_fir_kw = any(w in q_lower for w in ["fir", "case", "cases", "report", "incident", "station", "officer", "io", "kgid", "crime", "district"])

    if has_crime or has_location or has_year or has_fir_kw:
        return {
            "reasoning": "Keyword match: factual police/FIR query",
            "intent": "factual",
            "resolved_query": _normalise_query(query),
            "clarification_question": ""
        }

    # Too vague — ask for clarification
    return {
        "reasoning": "Keyword match: insufficient context for database query",
        "intent": "clarification_needed",
        "resolved_query": "",
        "clarification_question": "Could you please provide more details? For example: What crime type, district, year, or specific case are you looking for?"
    }


def _normalise_query(query: str) -> str:
    """Fix common typos and shorthand in the query."""
    q = query

    # Expand location shorthands
    replacements = {
        r"\bblr\b": "Bengaluru", r"\bbangalore\b": "Bengaluru",
        r"\bmysore\b": "Mysuru", r"\bhubli\b": "Dharwad",
        r"\bmangalore\b": "Dakshina Kannada",
        r"\bbgm\b": "Belagavi", r"\bgulbarga\b": "Kalaburagi",
        # Typos
        r"\bda\b": "the", r"\bdat\b": "that", r"\bcaes\b": "cases",
        r"\bthft\b": "theft", r"\bkilng\b": "killing",
        r"\bmurdr\b": "murder", r"\brapw\b": "rape",
        r"\bfraud\b": "fraud", r"\bcase5\b": "cases",
        r"\bincds\b": "incidents", r"\bstatns\b": "stations",
    }
    for pattern, replacement in replacements.items():
        q = re.sub(pattern, replacement, q, flags=re.IGNORECASE)

    return q.strip()


def route_query(query: str, conversation_history: list = None) -> dict:
    """
    Semantic Router & Query Resolver:
    - Primary: Gemini LLM for full semantic understanding.
    - Fallback: Keyword-based classifier when LLM is unavailable.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    lm_available = api_key and not api_key.startswith("your_")

    if lm_available:
        try:
            from google import genai
            from google.genai import types
            from pydantic import BaseModel, Field

            class RouterDecision(BaseModel):
                reasoning: str = Field(description="One-line reasoning for why this query falls into the chosen intent.")
                intent: str = Field(
                    description="The classified intent.",
                    enum=["factual", "network", "trend", "clarification_needed", "conversational", "out-of-scope"]
                )
                resolved_query: str = Field(
                    description="If the query is grammatically incorrect, typo-ridden, vague, or relies on prior context, rewrite it into a full, clean, standalone search question. If clear, return as-is."
                )
                clarification_question: str = Field(
                    description="If intent is 'clarification_needed', write a polite clarifying question. Otherwise leave blank."
                )

            client = genai.Client()

            history_str = ""
            if conversation_history:
                history_str = "\nPrior Conversation Context:\n" + "\n".join(
                    [f"- User: {item.get('query')}\n  Assistant: {item.get('answer_english')}" for item in conversation_history[-3:]]
                ) + "\n"

            prompt = f"""You are the Conversational Semantic Router for the Karnataka State Police Database.
Analyze the user's input with full semantic understanding.

{history_str}Current User Query: '{query}'

Intents:
1. factual: Lookups for specific cases, FIR counts, crime types, statuses, locations, IO details, or victim/accused stats.
2. network: Relationship/association queries (e.g., connections between officers, cases, gangs, stations).
3. trend: Aggregations, rankings, year-over-year growth, or temporal analysis over time.
4. clarification_needed: The query is related to police/FIR data but too brief, confusing, or ambiguous.
5. conversational: Greetings, thanks, polite banter, or questions asking who you are / what you can do.
6. out-of-scope: Questions entirely unrelated to police/crime data.

RULES:
- Fix typos, informal shorthand, and poor grammar in `resolved_query` (e.g. "thft" → "theft", "blr" → "Bengaluru").
- Use conversation_history to resolve relative references.
- If conversational, respond warmly.
- If out-of-scope, flag it.
- If police data but too vague, ask for clarification.

Return a JSON with `reasoning`, `intent`, `resolved_query`, and `clarification_question`.
"""
            response = client.models.generate_content(
                model='models/gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=RouterDecision,
                    temperature=0.1
                ),
            )
            result = json.loads(response.text)
            print(f"[RouterAgent] LLM Output: {result}")
            return result

        except Exception as e:
            print(f"[RouterAgent] Gemini LLM failed: {e}. Using keyword fallback.")

    # ── Keyword fallback ──────────────────────────────────────────────────────
    result = _keyword_route(query, conversation_history)
    print(f"[RouterAgent] Keyword Fallback Output: {result}")
    return result

