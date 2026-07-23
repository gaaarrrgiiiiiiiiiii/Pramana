import json
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

client = genai.Client()

class RouterDecision(BaseModel):
    reasoning: str = Field(description="One-line reasoning for why this query falls into the chosen intent.")
    intent: str = Field(description="The classified intent.", enum=["factual", "network", "trend", "clarification_needed", "conversational", "out-of-scope"])
    resolved_query: str = Field(description="If the query is grammatically incorrect, typo-ridden, vague, or relies on prior context, rewrite it into a full, clean, standalone search question. If clear, return as-is. If completely ambiguous, leave blank.")
    clarification_question: str = Field(description="If intent is 'clarification_needed', write a polite, natural question back to the user asking what specific FIRs/cases/district/offense details they are looking for. Otherwise leave blank.")

def route_query(query: str, conversation_history: list = None) -> dict:
    """
    Semantic Router & Query Resolver:
    - Normalizes typos, broken grammar, and informal language (e.g. 'show me da theft caes in blr' -> 'Show theft cases in Bengaluru').
    - Uses conversation history to resolve context references (e.g., 'which station had the most of those?').
    - If the user's intent is ambiguous regarding police data, asks for clarification.
    - If conversational/general greeting, responds conversationally.
    - If out-of-scope, flags it.
    """
    history_str = ""
    if conversation_history:
        history_str = "\nPrior Conversation Context:\n" + "\n".join(
            [f"- User: {item.get('query')}\n  Assistant: {item.get('answer_english')}" for item in conversation_history[-3:]]
        ) + "\n"

    prompt = f"""
You are the Conversational Semantic Router for the Karnataka State Police Database.
Analyze the user's input with full semantic understanding.

{history_str}Current User Query: '{query}'

Intents:
1. factual: Lookups for specific cases, FIR counts, crime types, statuses, locations, IO details, or victim/accused stats.
2. network: Relationship/association queries (e.g., connections between officers, cases, gangs, stations).
3. trend: Aggregations, rankings, year-over-year growth, or temporal analysis over time.
4. clarification_needed: The query is related to police/FIR data but too brief, confusing, or ambiguous to query the database accurately (e.g., "tell me about that case", "show police", "cases"). Ask a helpful clarifying question!
5. conversational: Greetings, thanks, polite banter, or questions asking who you are / what you can do (e.g., "hi", "hello", "who are you", "what can you help me with", "thanks").
6. out-of-scope: Questions entirely unrelated to police/crime data (e.g., recipes, sports, stock market, coding tutorials).

ROBUST SEMANTIC RULES:
- Fix typos, informal shorthand, and poor grammar automatically in `resolved_query` (e.g. "thft" -> "theft", "blr" -> "Bengaluru", "wat is status" -> "What is the status of").
- Use `conversation_history` to resolve relative references (e.g., "which station had the most of those?" -> "Which station had the most theft cases in Bengaluru?").
- If the user query is a simple greeting or general assistant query, classify as `conversational`.
- If the query is completely unrelated to police work, classify as `out-of-scope`.
- If the query wants crime/police data but is too vague to search, classify as `clarification_needed` and provide `clarification_question`.

Return a JSON with `reasoning`, `intent`, `resolved_query`, and `clarification_question`.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=RouterDecision,
                temperature=0.1
            ),
        )
        
        result = json.loads(response.text)
        print(f"Semantic Router Output: {result}")
        return result
    except Exception as e:
        print(f"Router error: {e}")
        return {
            "reasoning": "Fallback due to router exception",
            "intent": "factual",
            "resolved_query": query,
            "clarification_question": ""
        }
