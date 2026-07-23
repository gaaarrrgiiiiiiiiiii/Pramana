import json
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

client = genai.Client()

# Supported languages with their native script labels
SUPPORTED_LANGUAGES = {
    "Kannada":   "ಕನ್ನಡ",
    "Hindi":     "हिंदी",
    "Tamil":     "தமிழ்",
    "Telugu":    "తెలుగు",
    "Malayalam": "മലയാളം",
    "Marathi":   "मराठी",
    "Bengali":   "বাংলা",
    "Gujarati":  "ગુજરાતી",
    "English":   "English",
}

class SynthesisResult(BaseModel):
    answer_english: str = Field(description="The clear, concise answer in English.")
    answer_translated: str = Field(description="The accurate translation of the answer in the requested target language.")
    confidence: float = Field(description="Confidence score between 0.0 and 1.0 based on data quality.")

def synthesize_response(user_query: str, intent: str, raw_data: dict, language: str = "Kannada", conversation_history: list = None) -> dict:
    """
    Takes the raw data from QueryAgent or NetworkAgent and synthesizes
    a natural language response in English and the requested language, incorporating multi-turn context.
    """

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

    prompt = f"""
You are the Synthesis Agent for the Karnataka State Police Investigative Co-Pilot.
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
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SynthesisResult,
            temperature=0.3
        ),
    )

    return json.loads(response.text)
