import os
import json
from dotenv import load_dotenv

load_dotenv()

# Supported languages with their native script labels
SUPPORTED_LANGUAGES = {
    "Kannada":   "ಕನ್ನಡ",
    "Hindi":     "हिंदी",
    "Tamil":     "தமிழ்",
    "Telugu":    "తెలుగు",
    "Malayalam": "മലയാളം",
    "Marathi":   "मराठी",
    "Bengali":   "বাংলা",
    "Gujarati":  "ગુજરાతી",
    "English":   "English",
}

# Pre-built Kannada fallback translations for common responses
_KANNADA_TEMPLATES = {
    "no_data": "ಈ ಪ್ರಶ್ನೆಗೆ ಯಾವುದೇ ದಾಖಲೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ.",
    "data_found": "ಡೇಟಾಬೇಸ್‌ನಿಂದ {count} ದಾಖಲೆಗಳನ್ನು ಕಂಡುಹಿಡಿಯಲಾಗಿದೆ.",
    "trend": "ವರ್ಷವಾರು ಅಪರಾಧ ಪ್ರವೃತ್ತಿ ವಿಶ್ಲೇಷಣೆ ಪೂರ್ಣಗೊಂಡಿದೆ.",
    "clarification": "ನೀವು ನಿಖರವಾಗಿ ಯಾವ ಮಾಹಿತಿಯನ್ನು ಹುಡುಕುತ್ತಿದ್ದೀರಿ?",
    "error": "ಡೇಟಾಬೇಸ್ ಪ್ರಶ್ನಿಸುವಾಗ ಸಮಸ್ಯೆಯಾಗಿದೆ. ದಯವಿಟ್ಟು ಪುನರಾವರ್ತಿಸಿ.",
    "greeting": "ನಮಸ್ಕಾರ! ನಾನು ಕರ್ನಾಟಕ ಪೊಲೀಸ್ ತನಿಖಾ ಸಹ-ಪೈಲಟ್. ಎಫ್‌ಐಆರ್ ಡೇಟಾ ಅಥವಾ ಅಪರಾಧ ಮಾಹಿತಿಗೆ ಸಹಾಯ ಮಾಡಲು ಸಿದ್ಧ.",
}


def _template_synthesis(user_query: str, intent: str, raw_data: dict, language: str) -> dict:
    """
    Builds a deterministic text answer from the raw_data structure.
    Used when the Gemini LLM is unavailable.
    """
    results = raw_data.get("results", [])
    sql = raw_data.get("sql_query", "")
    explanation = raw_data.get("explanation", "")
    error = raw_data.get("error")
    count = len(results)

    # ── English answer construction ───────────────────────────────────────────
    if intent == "conversational":
        english = "Hello! I am your Karnataka Police Investigative Co-Pilot. I can help you query FIR data, crime trends, criminal networks, and more. What would you like to investigate today?"
        translated = _KANNADA_TEMPLATES["greeting"]
        confidence = 1.0

    elif intent == "clarification_needed":
        cq = raw_data.get("question", "Could you specify the crime type, district, or year you're interested in?")
        english = cq
        translated = _KANNADA_TEMPLATES["clarification"]
        confidence = 0.9

    elif error and not results:
        english = f"I encountered an issue querying the database: {error}. Please try rephrasing your query with a specific crime type, district, or year."
        translated = _KANNADA_TEMPLATES["error"]
        confidence = 0.0

    elif not results:
        english = f"No records found for your query: '{user_query}'. The database may not have matching entries. Try broadening your search."
        translated = _KANNADA_TEMPLATES["no_data"]
        confidence = 0.4

    else:
        # Build a structured answer from the results
        lines = [f"**Found {count} result(s)** for: *{explanation or user_query}*\n"]

        # Detect trend results (has fir_year + total/count column)
        if results and "fir_year" in results[0] and ("total" in results[0] or "count" in results[0]):
            count_key = "total" if "total" in results[0] else "count"
            lines.append("| Year | Count |")
            lines.append("|------|-------|")
            for r in results:
                lines.append(f"| {r.get('fir_year', '?')} | {r.get(count_key, '?'):,} |")

        # Detect district/station aggregation
        elif results and ("district_name" in results[0] or "unit_name" in results[0]) and ("total" in results[0] or "cases" in results[0]):
            name_key = "district_name" if "district_name" in results[0] else "unit_name"
            count_key = "total" if "total" in results[0] else "cases"
            label = "District" if name_key == "district_name" else "Station"
            lines.append(f"| {label} | Count |")
            lines.append("|--------|-------|")
            for r in results[:15]:
                lines.append(f"| {r.get(name_key, '?')} | {r.get(count_key, '?'):,} |")

        # Single count result
        elif results and count == 1 and ("total" in results[0] or "count" in results[0]):
            count_key = "total" if "total" in results[0] else "count"
            val = results[0].get(count_key, 0)
            lines = [f"**Total: {val:,}** records match your query — *{explanation or user_query}*"]

        # Individual FIR listing
        else:
            lines.append("| FIR No. | Year | District | Station | Crime | IO |")
            lines.append("|---------|------|----------|---------|-------|-----|")
            for r in results[:20]:
                fir = r.get("kgid") or r.get("fir_number", "—")
                yr = r.get("fir_year", "—")
                dist = r.get("district_name", "—")
                unit = r.get("unit_name", "—")
                crime = r.get("crime_head") or r.get("crime_group", "—")
                io = r.get("io_name", "—")
                lines.append(f"| {fir} | {yr} | {dist} | {unit} | {crime} | {io} |")

            if count > 20:
                lines.append(f"\n*Showing 20 of {count} results. Refine your query to narrow results.*")

        english = "\n".join(lines)

        # Translated response
        if language == "Kannada":
            translated = _KANNADA_TEMPLATES["data_found"].format(count=count)
            if "fir_year" in (results[0] if results else {}):
                translated = _KANNADA_TEMPLATES["trend"]
        else:
            translated = english  # Fallback: return English for other languages (LLM unavailable)

        confidence = min(0.85, 0.5 + (count / 100))

    return {
        "answer_english": english,
        "answer_translated": translated if language != "English" else english,
        "confidence": confidence
    }


def synthesize_response(
    user_query: str,
    intent: str,
    raw_data: dict,
    language: str = "Kannada",
    conversation_history: list = None
) -> dict:
    """
    Synthesizes a natural language response from raw database results.
    Primary: Gemini LLM for rich, contextual answers.
    Fallback: Template-based synthesis (structured markdown tables).
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    lm_available = api_key and not api_key.startswith("your_")

    if lm_available:
        try:
            from google import genai
            from google.genai import types
            from pydantic import BaseModel, Field

            class SynthesisResult(BaseModel):
                answer_english: str = Field(description="The clear, concise answer in English.")
                answer_translated: str = Field(description="The accurate translation of the answer in the requested target language.")
                confidence: float = Field(description="Confidence score between 0.0 and 1.0 based on data quality.")

            client = genai.Client()

            translate_instruction = (
                f"2. Translate the answer accurately into {language}. Use proper grammar and natural phrasing for {language}."
                if language != "English"
                else "2. For answer_translated, copy the English answer exactly (language is set to English)."
            )

            history_str = ""
            if conversation_history:
                history_str = "\nPrior Conversation Context:\n" + "\n".join(
                    [f"- User: {item.get('query')}\n  Assistant: {item.get('answer_english')}" for item in conversation_history[-3:]]
                ) + "\n"

            prompt = f"""You are the Synthesis Agent for the Karnataka State Police Investigative Co-Pilot.
Your job is to take raw database results and explain them clearly to a police officer.

{history_str}Current User Query: {user_query}
Intent Category: {intent}
Raw Database Output: {json.dumps(raw_data, indent=2, default=str)}

Instructions:
1. Provide a direct, professional answer in English. Understand pronouns like 'those', 'it', 'they' in reference to the prior conversation.
{translate_instruction}
3. Assign a confidence score (0.0 to 1.0). If you have to summarize 50+ rows loosely, lower the score.

Return a JSON matching the requested schema with fields: answer_english, answer_translated, confidence.
"""
            response = client.models.generate_content(
                model='models/gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=SynthesisResult,
                    temperature=0.3
                ),
            )
            return json.loads(response.text)

        except Exception as e:
            print(f"[SynthesisAgent] Gemini LLM failed: {e}. Using template fallback.")

    # ── Template-based fallback ───────────────────────────────────────────────
    return _template_synthesis(user_query, intent, raw_data, language)

