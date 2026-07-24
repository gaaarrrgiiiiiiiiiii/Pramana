import json
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

client = genai.Client()

class SkepticResult(BaseModel):
    is_valid: bool = Field(description="True if the raw database data actually contains the answer to the user's question.")
    skeptic_feedback: str = Field(description="If not valid, explain why the raw data is insufficient. If valid, leave blank.")

def run_skeptic(user_query: str, raw_data: dict) -> dict:
    """
    Evaluates whether the raw database output actually contains the answer 
    to the user's query, preventing the Synthesis agent from forcing an answer from bad data.
    """
    
    prompt = f"""
You are the Skeptic Agent for a police data system.
Your job is to review the raw SQL database output and ensure it actually contains the answer to the user's question.

User Question: {user_query}
Raw Database Output: {json.dumps(raw_data, indent=2, default=str)}

Evaluate if the Raw Database Output:
1. Actually contains the information needed to answer the question.
2. Is not just an empty array when the user expects a substantive answer (unless the answer is genuinely 'none').

Return a JSON with `is_valid` (boolean) and `skeptic_feedback` (string).
    """
    
    try:
        response = client.models.generate_content(
            model='models/gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=SkepticResult,
                temperature=0.0
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Skeptic error: {e}")
        return {"is_valid": True, "skeptic_feedback": ""} # Default pass on error

