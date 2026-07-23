import os
import time
import concurrent.futures
from fastapi import FastAPI, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor

from router_agent import route_query
from query_agent import execute_nl_query
from network_agent import build_network_graph
from synthesis_agent import synthesize_response
from skeptic_agent import run_skeptic
from rbac_agent import check_rbac
from audio_processor import router as audio_router
from auth import router as auth_router, get_current_user, get_db_connection
from hotspot_agent import router as hotspot_router

app = FastAPI(title="Datathon Investigative Co-Pilot", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(audio_router, prefix="/api", tags=["Audio"])
app.include_router(auth_router)
app.include_router(hotspot_router)

class QueryRequest(BaseModel):
    query: str
    language: str = "Kannada"
    session_id: int | None = None
    conversation_history: list = []

class QueryResponse(BaseModel):
    answer_english: str
    answer_translated: str
    language: str
    confidence: float
    intent: str
    audit_trail: list[str]
    raw_data: dict

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}

@app.post("/api/query", response_model=QueryResponse)
async def process_query(req: QueryRequest, current_user: dict = Depends(get_current_user)):
    audit_trail = []
    user_role = current_user.get("role", "Field Officer")
    user_id = current_user.get("id")

    # 0. RBAC Gatekeeper — uses authenticated role from JWT
    t0 = time.time()
    audit_trail.append(f"Authenticated user '{current_user.get('sub')}' as {user_role}")
    rbac_res = check_rbac(req.query, user_role)
    t_rbac = time.time() - t0

    if not rbac_res.get("is_allowed"):
        audit_trail.append(f"RBAC BLOCKED: {rbac_res.get('reason')} ({t_rbac:.2f}s)")
        return QueryResponse(
            answer_english=f"Access Denied: {rbac_res.get('reason')}",
            answer_translated="ಪ್ರವೇಶವನ್ನು ನಿರಾಕರಿಸಲಾಗಿದೆ.",
            language=req.language,
            confidence=1.0,
            intent="blocked",
            audit_trail=audit_trail,
            raw_data={}
        )
    audit_trail.append(f"RBAC cleared ({t_rbac:.2f}s)")

    # Ensure Session Exists
    session_id = req.session_id
    if not session_id:
        try:
            conn = get_db_connection()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            title = req.query[:40] + "..." if len(req.query) > 40 else req.query
            cur.execute("INSERT INTO sessions (user_id, title) VALUES (%s, %s) RETURNING id", (user_id, title))
            session_id = cur.fetchone()["id"]
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            print(f"Error auto-creating session: {e}")

    # 1. Semantic Router & Query Normalization
    t1 = time.time()
    router_decision = route_query(req.query, req.conversation_history)
    intent = router_decision.get("intent", "factual")
    resolved_query = router_decision.get("resolved_query") or req.query
    clarification_q = router_decision.get("clarification_question", "")
    t_route = time.time() - t1
    audit_trail.append(f"RouterAgent classified intent: '{intent}' (Resolved: '{resolved_query}') ({t_route:.2f}s)")

    if intent == "out-of-scope":
        return QueryResponse(
            answer_english="I am specialized strictly in Karnataka Police FIR data and crime intelligence. I cannot help with external or general non-police topics.",
            answer_translated="ನಾನು ಕರ್ನಾಟಕ ಪೊಲೀಸ್ ಎಫ್‌ಐಆರ್ ಡೇಟಾ ಮತ್ತು ಅಪರಾಧ ಗುಪ್ತಚರದಲ್ಲಿ ಮಾತ್ರ ಪರಿಣತಿಯನ್ನು ಹೊಂದಿದ್ದೇನೆ.",
            language=req.language,
            confidence=1.0,
            intent=intent,
            audit_trail=audit_trail,
            raw_data={}
        )

    if intent == "conversational":
        synthesis = synthesize_response(
            req.query, intent, {"message": "General assistant conversation"}, req.language, req.conversation_history
        )
        return QueryResponse(
            answer_english=synthesis.get("answer_english", "Hello! I am your Karnataka Police Investigative Co-Pilot. How can I assist with FIR data today?"),
            answer_translated=synthesis.get("answer_translated", "ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಕರ್ನಾಟಕ ಪೊಲೀಸ್ ತನಿಖಾ ಸಹ-ಪೈಲಟ್."),
            language=req.language,
            confidence=1.0,
            intent=intent,
            audit_trail=audit_trail,
            raw_data={}
        )

    if intent == "clarification_needed":
        # Synthesize clarification in target language too
        synthesis = synthesize_response(
            req.query, intent, {"clarification_needed": True, "question": clarification_q}, req.language, req.conversation_history
        )
        return QueryResponse(
            answer_english=synthesis.get("answer_english", clarification_q or "Could you please specify which FIR, district, or crime type you would like to analyze?"),
            answer_translated=synthesis.get("answer_translated", "ದಯವಿಟ್ಟು ನೀವು ಯಾವ ಎಫ್‌ಐಆರ್ ಅಥವಾ ಜಿಲ್ಲೆಯನ್ನು ವಿಶ್ಲೇಷಿಸಲು ಬಯಸುತ್ತೀರಿ ಎಂದು ನಿರ್ದಿಷ್ಟಪಡಿಸಬಹುದೇ?"),
            language=req.language,
            confidence=0.9,
            intent=intent,
            audit_trail=audit_trail,
            raw_data={}
        )

    raw_data = {}

    # 2. Specialist Agent Execution using resolved_query (fixed typos/context)
    t2 = time.time()
    try:
        if intent in ("factual", "trend"):
            raw_data = execute_nl_query(resolved_query)
            if raw_data.get("error"):
                audit_trail.append(f"QueryAgent failed: {raw_data['error']}")
            else:
                audit_trail.append(f"QueryAgent executed SQL — {len(raw_data.get('results', []))} rows returned.")
        elif intent == "network":
            raw_data = build_network_graph(resolved_query)
            audit_trail.append(f"NetworkAgent built graph with {len(raw_data.get('nodes', []))} nodes, {len(raw_data.get('edges', []))} edges.")
    except Exception as e:
        audit_trail.append(f"Agent execution error: {str(e)}")
        raw_data = {"error": str(e)}
    t_agent = time.time() - t2
    audit_trail[-1] += f" ({t_agent:.2f}s)"

    # 3 & 4. Synthesis & Skeptic — run concurrently with context
    t3 = time.time()
    if "error" in raw_data and not raw_data.get("results"):
        synthesis = {
            "answer_english": "I encountered an issue querying the database. Could you rephrase your search question?",
            "answer_translated": "ಡೇಟಾಬೇಸ್ ಪ್ರಶ್ನಿಸುವಾಗ ಸಮಸ್ಯೆಯಾಗಿದೆ. ದಯವಿಟ್ಟು ಪುನರಾವರ್ತಿಸಿ.",
            "confidence": 0.0
        }
        audit_trail.append("SynthesisAgent skipped due to upstream error.")
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future_synthesis = executor.submit(
                synthesize_response, resolved_query, intent, raw_data, req.language, req.conversation_history
            )
            future_skeptic = executor.submit(run_skeptic, resolved_query, raw_data)

            try:
                synthesis = future_synthesis.result()
                skeptic_res = future_skeptic.result()

                t_final = time.time() - t3
                audit_trail.append(f"SynthesisAgent & SkepticAgent ran concurrently ({t_final:.2f}s)")

                if not skeptic_res.get("is_valid"):
                    audit_trail.append(f"SkepticAgent flagged: {skeptic_res.get('skeptic_feedback')}")
                    synthesis["confidence"] = max(0.0, synthesis.get("confidence", 0.8) - 0.5)
                    synthesis["answer_english"] += f"\n\n[System Warning: {skeptic_res.get('skeptic_feedback')}]"
                else:
                    audit_trail.append("SkepticAgent validated raw data sufficiency.")

            except Exception as e:
                audit_trail.append(f"Synthesis/Skeptic execution error: {str(e)}")
                synthesis = {
                    "answer_english": "The data was fetched but I could not synthesize a clear response.",
                    "answer_translated": "ಡೇಟಾವನ್ನು ಪಡೆಯಲಾಗಿದೆ ಆದರೆ ನನಗೆ ಸ್ಪಷ್ಟ ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಸಂಶ್ಲೇಷಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
                    "confidence": 0.5
                }

    # Save turn to DB messages table
    if session_id:
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO messages (session_id, user_id, query, answer_english, answer_translated, language, intent, confidence)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                session_id, user_id, req.query,
                synthesis.get("answer_english"), synthesis.get("answer_translated"),
                req.language, intent, synthesis.get("confidence", 0.0)
            ))
            cur.execute("UPDATE sessions SET updated_at = NOW() WHERE id = %s", (session_id,))
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            print(f"Error persisting chat message: {e}")

    return QueryResponse(
        answer_english=synthesis.get("answer_english", ""),
        answer_translated=synthesis.get("answer_translated", ""),
        language=req.language,
        confidence=synthesis.get("confidence", 0.0),
        intent=intent,
        audit_trail=audit_trail,
        raw_data=raw_data
    )
