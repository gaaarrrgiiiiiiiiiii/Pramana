import json
import requests
import time
from auth import create_access_token

def run_evaluations():
    print("Starting AI Pipeline Evaluation...")
    
    with open("eval_queries.json", "r") as f:
        queries = json.load(f)
        
    results = []
    correct_intents = 0
    total = len(queries)
    
    for q in queries:
        print(f"Testing Query [{q['id']}]: {q['query']}")
        
        role = q.get("test_role", "Inspector")
        
        # Map roles to valid database user IDs from the users table
        role_id_map = {
            "SCRB Analyst": 1,
            "Inspector": 2,
            "Field Officer": 4,
            "DGP": 1
        }
        user_id = role_id_map.get(role, 4)
        
        # Create a mock token for this role
        token_payload = {
            "sub": f"test_{role.lower().replace(' ', '_')}",
            "id": user_id,
            "full_name": f"Test {role}",
            "role": role,
            "badge_number": f"BADGE_{role.upper().replace(' ', '_')}",
            "district": "Bengaluru"
        }
        token = create_access_token(token_payload)
        
        headers = {
            "Authorization": f"Bearer {token}"
        }
        
        payload = {
            "query": q["query"]
        }
        
        try:
            start_time = time.time()
            resp = requests.post("http://127.0.0.1:8000/api/query", json=payload, headers=headers, timeout=60)
            latency = time.time() - start_time
            
            if resp.status_code == 200:
                data = resp.json()
                actual_intent = data.get("intent")
                
                # Treat 'blocked' as a valid intent for adversarial queries
                if q.get("is_adversarial") and "RBAC BLOCKED" in str(data.get("audit_trail", [])):
                    actual_intent = "blocked"
                    
                is_correct = actual_intent == q["expected_intent"]
                if is_correct:
                    correct_intents += 1
                    
                results.append({
                    "id": q["id"],
                    "query": q["query"],
                    "expected_intent": q["expected_intent"],
                    "actual_intent": actual_intent,
                    "is_correct": is_correct,
                    "latency_seconds": round(latency, 2),
                    "confidence": data.get("confidence", 0)
                })
            else:
                print(f"  -> Error HTTP {resp.status_code}")
                results.append({
                    "id": q["id"],
                    "query": q["query"],
                    "error": f"HTTP {resp.status_code}"
                })
        except Exception as e:
            print(f"  -> Exception: {e}")
            results.append({
                "id": q["id"],
                "query": q["query"],
                "error": str(e)
            })
            
    # Compute latency stats from measured results only (exclude errors/timeouts)
    measured = [r for r in results if "latency_seconds" in r]
    latencies = [r["latency_seconds"] for r in measured]
    avg_latency = round(sum(latencies) / len(latencies), 2) if latencies else 0
    
    # Per-category averages
    categories = {"factual": [], "trend": [], "network": [], "out-of-scope": [], "blocked": []}
    for r in measured:
        cat = r.get("expected_intent", "")
        if cat in categories:
            categories[cat].append(r["latency_seconds"])
    
    latency_by_category = {
        cat: round(sum(v)/len(v), 2) for cat, v in categories.items() if v
    }
    
    accuracy = (correct_intents / total) * 100 if total > 0 else 0

    report = {
        "total_queries": total,
        "correct_intent_routing": correct_intents,
        "routing_accuracy": f"{accuracy}%",
        "latency_stats": {
            "overall_avg_seconds": avg_latency,
            "by_category": latency_by_category,
            "min_seconds": round(min(latencies), 2) if latencies else 0,
            "max_seconds": round(max(latencies), 2) if latencies else 0,
        },
        "detailed_results": results
    }
    
    with open("eval_results.json", "w") as f:
        json.dump(report, f, indent=2)
        
    print(f"\nEvaluation Complete! Accuracy: {accuracy}%")
    print("Results saved to eval_results.json")

if __name__ == "__main__":
    run_evaluations()
