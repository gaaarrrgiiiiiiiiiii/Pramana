import os
from dotenv import load_dotenv
load_dotenv()
from google import genai

client = genai.Client()

# These are the correct model IDs from the list
test_models = [
    'models/gemini-2.5-flash-lite',
    'models/gemini-2.5-flash',
    'models/gemini-flash-latest',
    'models/gemini-2.0-flash-001',
]

print("Testing models with this API key...")
for model in test_models:
    try:
        resp = client.models.generate_content(model=model, contents='Say: PRAMANA_OK')
        print(f"WORKS: {model}")
        print(f"  Response: {resp.text.strip()[:50]}")
        break
    except Exception as e:
        print(f"FAIL:  {model} -> {str(e)[:100]}")

