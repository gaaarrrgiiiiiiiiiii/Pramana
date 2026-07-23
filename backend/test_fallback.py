import os
os.environ['GEMINI_API_KEY'] = 'your_test_no_llm'

from router_agent import route_query
from query_agent import execute_nl_query

queries = [
    "show me crime trend over the years",
    "show me da theft caes in blr",
    "how many murder cases in 2022",
    "top districts for cybercrime",
    "hello who are you",
    "what is the weather",
]

for q in queries:
    r = route_query(q)
    intent = r.get("intent")
    resolved = r.get("resolved_query", q)
    print(f"Q: {q}")
    print(f"  Intent: {intent} | Resolved: {resolved}")
    if intent in ("factual", "trend"):
        res = execute_nl_query(resolved)
        count = len(res.get("results", []))
        sql = res.get("sql_query", "")
        err = res.get("error")
        print(f"  SQL: {sql[:90]}")
        print(f"  Rows: {count} | Error: {err}")
    print()
