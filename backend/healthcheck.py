import os
from dotenv import load_dotenv
load_dotenv()

# Simulate full pipeline
os.environ["GEMINI_API_KEY"] = os.environ.get("GEMINI_API_KEY", "")

print("=== PRAMANA SYSTEM HEALTH CHECK ===\n")

# 1. Test API Key
print("1. Testing Gemini API key...")
try:
    from google import genai
    client = genai.Client()
    resp = client.models.generate_content(model='models/gemini-2.5-flash', contents='Say: API_OK')
    print(f"   PASS: {resp.text.strip()}\n")
except Exception as e:
    print(f"   FAIL: {e}\n")

# 2. Test Router
print("2. Testing Semantic Router...")
try:
    from router_agent import route_query
    r = route_query("show me theft cases in bangalore 2022")
    print(f"   PASS: intent={r['intent']} | resolved='{r['resolved_query']}'\n")
except Exception as e:
    print(f"   FAIL: {e}\n")

# 3. Test Query Agent
print("3. Testing Query Agent (NL -> SQL -> DB)...")
try:
    from query_agent import execute_nl_query
    res = execute_nl_query("How many theft cases in Bengaluru in 2022?")
    count = len(res.get("results", []))
    print(f"   PASS: {count} results | SQL: {res.get('sql_query','')[:60]}\n")
except Exception as e:
    print(f"   FAIL: {e}\n")

# 4. Test Synthesis
print("4. Testing Synthesis Agent...")
try:
    from synthesis_agent import synthesize_response
    fake_data = {"results": [{"total": 12345}], "sql_query": "SELECT COUNT(*)", "explanation": "Theft count in Bengaluru 2022"}
    syn = synthesize_response("how many theft cases in bangalore", "factual", fake_data, "Kannada")
    print(f"   PASS: confidence={syn.get('confidence')}")
    print(f"   English: {syn.get('answer_english','')[:80]}")
    print(f"   Kannada: {syn.get('answer_translated','')[:80]}\n")
except Exception as e:
    print(f"   FAIL: {e}\n")

print("=== HEALTH CHECK COMPLETE ===")
