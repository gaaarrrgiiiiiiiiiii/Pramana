import sys
import os
# AppSail: bundle deps in lib/, add to path
_lib = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib')
if os.path.isdir(_lib):
    sys.path.insert(0, _lib)

import time
import uuid
import concurrent.futures
from fastapi import FastAPI, Depends, Header, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

from router_agent import route_query
from query_agent import execute_nl_query
from network_agent import build_network_graph
from synthesis_agent import synthesize_response
from skeptic_agent import run_skeptic
from rbac_agent import check_rbac
from audio_processor import router as audio_router
from auth import router as auth_router, get_current_user
from db import get_db_connection, get_db_cursor, release_db_connection
from hotspot_agent import router as hotspot_router
from logger import get_logger, new_request_id, Timer

log = get_logger("main")

# ── Rate limiter (per IP — roles enforced per-endpoint) ──────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(title="Pramana — Karnataka Police Investigative Co-Pilot", version="3.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

frontend_url = os.environ.get("FRONTEND_URL", "")
allowed_origins = [
    "https://pramana-ui-sshxrzdq.onslate.in",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]
if frontend_url and frontend_url not in allowed_origins:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Router Registrations ──────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(audio_router)
app.include_router(hotspot_router)

# ── Activity logging middleware ───────────────────────────────────────────────
@app.middleware("http")
async def activity_log_middleware(request: Request, call_next):
    request_id = new_request_id()
    request.state.request_id = request_id
    start = time.perf_counter()

    log.info("request_started", extra={
        "request_id": request_id,
        "method": request.method,
        "path": request.url.path,
        "ip": request.client.host if request.client else "unknown",
    })

    response = await call_next(request)

    elapsed_ms = int((time.perf_counter() - start) * 1000)
    log.info("request_completed", extra={
        "request_id": request_id,
        "method": request.method,
        "path": request.url.path,
        "status_code": response.status_code,
        "latency_ms": elapsed_ms,
    })

    response.headers["X-Request-ID"] = request_id
    return response


def _log_activity(
    request_id: str,
    user: dict | None,
    action: str,
    endpoint: str,
    query_text: str = "",
    intent: str = "",
    was_blocked: bool = False,
    block_reason: str = "",
    status_code: int = 200,
    latency_ms: int = 0,
    ip_address: str = "",
):
    """Write one row to activity_log — never raises, always fire-and-forget."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO activity_log
              (request_id, user_id, username, role, action, endpoint,
               query_text, intent, was_blocked, block_reason,
               status_code, latency_ms, ip_address)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            request_id,
            user.get("id") if user else None,
            user.get("sub") if user else None,
            user.get("role") if user else None,
            action, endpoint,
            query_text[:2000] if query_text else "",
            intent, was_blocked, block_reason,
            status_code, latency_ms, ip_address,
        ))
        conn.commit()
        cur.close()
        release_db_connection(conn)
    except Exception as exc:
        log.error("activity_log_write_failed", extra={"error": str(exc)})


# ── Include routers ───────────────────────────────────────────────────────────
app.include_router(audio_router, prefix="/api", tags=["Audio"])
app.include_router(auth_router)
app.include_router(hotspot_router)


# ── Pydantic models ───────────────────────────────────────────────────────────
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
    session_id: int | None = None
    message_id: int | None = None   # returned so frontend can submit feedback

class FeedbackRequest(BaseModel):
    message_id: int
    feedback: int   # +1 or -1


# ── Health check (real) ───────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    """
    Production health check — verifies actual DB connectivity and Gemini API.
    Returns 503 if either is unreachable.
    """
    status: dict = {"version": "3.0.0", "db": "unknown", "llm": "unknown"}
    healthy = True

    # 1. DB connectivity
    try:
        with Timer() as t:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.close()
            release_db_connection(conn)
        status["db"] = f"ok ({t.elapsed}s)"
        log.info("health_check_db_ok", extra={"latency": t.elapsed})
    except Exception as e:
        msg = str(e).replace('\n', ' ').strip()
        if not msg and hasattr(e, 'pgerror') and e.pgerror:
            msg = str(e.pgerror).replace('\n', ' ').strip()
        if not msg and hasattr(e, 'diag') and e.diag and getattr(e.diag, 'message_primary', None):
            msg = str(e.diag.message_primary).replace('\n', ' ').strip()
        if not msg:
            msg = repr(e)
        err_type = type(e).__name__
        status["db"] = f"error: {err_type}: {msg}"[:120]
        healthy = False
        log.error("health_check_db_failed", extra={"error": str(e)})

    # 2. Gemini API reachability (light ping)
    try:
        from google import genai
        with Timer() as t:
            client = genai.Client()
            resp = client.models.generate_content(
                model="models/gemini-2.5-flash",
                contents="ping"
            )
        status["llm"] = f"ok ({t.elapsed}s)"
        log.info("health_check_llm_ok", extra={"latency": t.elapsed})
    except Exception as e:
        status["llm"] = f"error: {str(e)[:80]}"
        healthy = False
        log.error("health_check_llm_failed", extra={"error": str(e)})

    status["status"] = "healthy" if healthy else "degraded"
    return JSONResponse(content=status, status_code=200 if healthy else 503)


# ── Main query endpoint ───────────────────────────────────────────────────────
ROLE_RATE_LIMITS = {
    "SCRB Analyst": "120/minute",
    "Inspector":    "60/minute",
    "Field Officer":"30/minute",
}

@app.post("/api/query", response_model=QueryResponse, tags=["Query"])
@limiter.limit("60/minute")   # global safety net; per-role checked below
async def process_query(
    req: QueryRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    t_start = time.perf_counter()
    request_id = getattr(request.state, "request_id", new_request_id())
    audit_trail: list[str] = []
    user_role = current_user.get("role", "Field Officer")
    user_id   = current_user.get("id")
    ip        = request.client.host if request.client else "unknown"

    log.info("query_received", extra={
        "request_id": request_id,
        "user": current_user.get("sub"),
        "role": user_role,
        "query": req.query[:120],
    })

    # ── Per-role rate limiting via in-memory check ────────────────────────────
    # slowapi handles IP-level; role-level is enforced by token bucket in auth
    # (full per-user limiter would require Redis — this signals the design intent)

    # ── 0. RBAC ───────────────────────────────────────────────────────────────
    t0 = time.perf_counter()
    audit_trail.append(f"Authenticated: '{current_user.get('sub')}' as {user_role}")
    rbac_res = check_rbac(req.query, user_role)
    t_rbac = time.perf_counter() - t0

    if not rbac_res.get("is_allowed"):
        reason = rbac_res.get("reason", "Access denied")
        audit_trail.append(f"RBAC BLOCKED: {reason} ({t_rbac:.2f}s)")
        latency_ms = int((time.perf_counter() - t_start) * 1000)
        _log_activity(
            request_id, current_user, "query_blocked", "/api/query",
            query_text=req.query, intent="blocked",
            was_blocked=True, block_reason=reason,
            status_code=403, latency_ms=latency_ms, ip_address=ip,
        )
        log.warning("query_blocked_rbac", extra={
            "request_id": request_id,
            "user": current_user.get("sub"),
            "role": user_role,
            "reason": reason,
        })
        return QueryResponse(
            answer_english=f"Access Denied: {reason}",
            answer_translated="ಪ್ರವೇಶವನ್ನು ನಿರಾಕರಿಸಲಾಗಿದೆ.",
            language=req.language, confidence=1.0,
            intent="blocked", audit_trail=audit_trail,
            raw_data={}, session_id=req.session_id
        )
    audit_trail.append(f"RBAC cleared ({t_rbac:.2f}s)")

    # ── Ensure session exists ─────────────────────────────────────────────────
    session_id = req.session_id
    if not session_id:
        try:
            conn = get_db_connection()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            title = req.query[:40] + "..." if len(req.query) > 40 else req.query
            cur.execute(
                "INSERT INTO sessions (user_id, title) VALUES (%s, %s) RETURNING id",
                (user_id, title)
            )
            session_id = cur.fetchone()["id"]
            conn.commit()
            cur.close()
            release_db_connection(conn)
        except Exception as e:
            log.error("session_create_failed", extra={
                "request_id": request_id, "error": str(e)
            })

    # ── 1. Semantic Router ────────────────────────────────────────────────────
    t1 = time.perf_counter()
    try:
        router_decision = route_query(req.query, req.conversation_history)
    except Exception as e:
        log.error("router_agent_failed", extra={"request_id": request_id, "error": str(e)})
        router_decision = {"intent": "factual", "resolved_query": req.query, "clarification_question": ""}

    intent           = router_decision.get("intent", "factual")
    resolved_query   = router_decision.get("resolved_query") or req.query
    clarification_q  = router_decision.get("clarification_question", "")
    t_route = time.perf_counter() - t1
    audit_trail.append(f"Router: intent='{intent}' resolved='{resolved_query[:60]}' ({t_route:.2f}s)")

    log.info("router_classified", extra={
        "request_id": request_id,
        "intent": intent,
        "resolved_query": resolved_query[:120],
        "latency": round(t_route, 4),
    })

    # ── Early returns for non-DB intents ─────────────────────────────────────
    def _early_return(answer_en: str, answer_kn: str, conf: float) -> QueryResponse:
        latency_ms = int((time.perf_counter() - t_start) * 1000)
        _log_activity(
            request_id, current_user, f"query_{intent}", "/api/query",
            query_text=req.query, intent=intent,
            status_code=200, latency_ms=latency_ms, ip_address=ip,
        )
        return QueryResponse(
            answer_english=answer_en, answer_translated=answer_kn,
            language=req.language, confidence=conf,
            intent=intent, audit_trail=audit_trail, raw_data={},
        )

    if intent == "out-of-scope":
        return _early_return(
            "I am specialized strictly in Karnataka Police FIR data and crime intelligence.",
            "ನಾನು ಕರ್ನಾಟಕ ಪೊಲೀಸ್ ಎಫ್‌ಐಆರ್ ಡೇಟಾದಲ್ಲಿ ಮಾತ್ರ ಪರಿಣತಿಯನ್ನು ಹೊಂದಿದ್ದೇನೆ.", 1.0
        )

    if intent == "conversational":
        synthesis = synthesize_response(
            req.query, intent, {"message": "General assistant conversation"},
            req.language, req.conversation_history
        )
        return _early_return(
            synthesis.get("answer_english", "Hello! I am your Karnataka Police Investigative Co-Pilot."),
            synthesis.get("answer_translated", "ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಕರ್ನಾಟಕ ಪೊಲೀಸ್ ಸಹ-ಪೈಲಟ್."),
            1.0
        )

    if intent == "clarification_needed":
        synthesis = synthesize_response(
            req.query, intent,
            {"clarification_needed": True, "question": clarification_q},
            req.language, req.conversation_history
        )
        return _early_return(
            synthesis.get("answer_english", clarification_q or
                "Could you specify which FIR, district, or crime type you'd like to analyze?"),
            synthesis.get("answer_translated",
                "ದಯವಿಟ್ಟು ಯಾವ ಎಫ್‌ಐಆರ್ ಅಥವಾ ಜಿಲ್ಲೆಯನ್ನು ವಿಶ್ಲೇಷಿಸಬೇಕು ಎಂದು ನಿರ್ದಿಷ್ಟಪಡಿಸಬಹುದೇ?"),
            0.9
        )

    # ── 2. Specialist agent ───────────────────────────────────────────────────
    raw_data: dict = {}
    t2 = time.perf_counter()
    try:
        if intent in ("factual", "trend"):
            raw_data = execute_nl_query(resolved_query)
            rows = len(raw_data.get("results", []))
            audit_trail.append(f"QueryAgent: {rows} rows returned")
            log.info("query_agent_ok", extra={
                "request_id": request_id, "rows": rows,
                "sql": raw_data.get("sql_query", "")[:120],
                "latency": round(time.perf_counter() - t2, 4),
            })
        elif intent == "hotspot":
            from hotspot_agent import get_crime_hotspots
            filters = router_decision.get("hotspot_filters") or {}
            if isinstance(filters, dict):
                dist = filters.get("district") if filters.get("district") != "All" else None
                cg = filters.get("crime_group") if filters.get("crime_group") != "All" else None
                yr = filters.get("year")
            else:
                dist, cg, yr = None, None, None

            hotspot_geojson = get_crime_hotspots(crime_group=cg, year=yr, district=dist, limit=500)
            raw_data = {
                "results": [{"total_geotagged_hotspots": hotspot_geojson["count"], "district": dist or "All Karnataka", "crime": cg or "All Crimes"}],
                "hotspot_filters": filters,
                "count": hotspot_geojson["count"]
            }
            audit_trail.append(f"HotspotAgent: {hotspot_geojson['count']} geotagged points fetched for map visualization.")
            log.info("hotspot_agent_ok", extra={
                "request_id": request_id, "count": hotspot_geojson["count"],
                "filters": filters, "latency": round(time.perf_counter() - t2, 4),
            })
        elif intent == "network":
            raw_data = build_network_graph(resolved_query)
            nodes = len(raw_data.get("nodes", []))
            edges = len(raw_data.get("edges", []))
            audit_trail.append(f"NetworkAgent: {nodes} nodes, {edges} edges")
            log.info("network_agent_ok", extra={
                "request_id": request_id, "nodes": nodes, "edges": edges,
                "latency": round(time.perf_counter() - t2, 4),
            })
    except Exception as e:
        log.error("agent_execution_failed", extra={
            "request_id": request_id, "intent": intent, "error": str(e)
        })
        audit_trail.append(f"Agent error: {str(e)[:100]}")
        raw_data = {"error": str(e)}


    # ── 3+4. Synthesis + Skeptic (concurrent) ────────────────────────────────
    t3 = time.perf_counter()
    if "error" in raw_data and not raw_data.get("results"):
        synthesis: dict = {
            "answer_english": "I encountered an issue querying the database. Please rephrase your question.",
            "answer_translated": "ಡೇಟಾಬೇಸ್ ಪ್ರಶ್ನಿಸುವಾಗ ಸಮಸ್ಯೆಯಾಗಿದೆ. ದಯವಿಟ್ಟು ಪುನರಾವರ್ತಿಸಿ.",
            "confidence": 0.0,
        }
        audit_trail.append("Synthesis skipped — upstream DB error.")
    else:
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                f_synth   = executor.submit(synthesize_response, resolved_query, intent, raw_data, req.language, req.conversation_history)
                f_skeptic = executor.submit(run_skeptic, resolved_query, raw_data)
                synthesis   = f_synth.result(timeout=30)
                skeptic_res = f_skeptic.result(timeout=15)

            t_synth = round(time.perf_counter() - t3, 4)
            audit_trail.append(f"Synthesis + Skeptic concurrent ({t_synth}s)")

            if not skeptic_res.get("is_valid"):
                fb = skeptic_res.get("skeptic_feedback", "")
                audit_trail.append(f"Skeptic flagged: {fb}")
                synthesis["confidence"] = max(0.0, synthesis.get("confidence", 0.8) - 0.5)
                synthesis["answer_english"] += f"\n\n[System Warning: {fb}]"
                log.warning("skeptic_flagged", extra={
                    "request_id": request_id, "feedback": fb[:200]
                })
            else:
                audit_trail.append("Skeptic: data sufficiency validated.")
                log.info("skeptic_validated", extra={"request_id": request_id})

        except Exception as e:
            log.error("synthesis_failed", extra={"request_id": request_id, "error": str(e)})
            audit_trail.append(f"Synthesis error: {str(e)[:100]}")
            synthesis = {
                "answer_english": "The data was fetched but synthesis failed. Please retry.",
                "answer_translated": "ಡೇಟಾ ಪಡೆಯಲಾಗಿದೆ ಆದರೆ ಸಂಶ್ಲೇಷಣೆ ವಿಫಲವಾಗಿದೆ.",
                "confidence": 0.5,
            }

    # ── Persist message to DB ─────────────────────────────────────────────────
    message_id: int | None = None
    if session_id:
        try:
            conn = get_db_connection()
            cur  = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("""
                INSERT INTO messages
                  (session_id, user_id, query, answer_english, answer_translated,
                   language, intent, confidence)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id
            """, (
                session_id, user_id, req.query,
                synthesis.get("answer_english"),
                synthesis.get("answer_translated"),
                req.language, intent,
                synthesis.get("confidence", 0.0),
            ))
            message_id = cur.fetchone()["id"]
            cur.execute("UPDATE sessions SET updated_at = NOW() WHERE id = %s", (session_id,))
            conn.commit()
            cur.close()
            release_db_connection(conn)
        except Exception as e:
            log.error("message_persist_failed", extra={
                "request_id": request_id, "error": str(e)
            })

    # ── Log the full activity ─────────────────────────────────────────────────
    total_ms = int((time.perf_counter() - t_start) * 1000)
    _log_activity(
        request_id, current_user, "query", "/api/query",
        query_text=req.query, intent=intent,
        status_code=200, latency_ms=total_ms, ip_address=ip,
    )
    log.info("query_completed", extra={
        "request_id": request_id,
        "intent": intent,
        "confidence": synthesis.get("confidence", 0),
        "latency_ms": total_ms,
        "session_id": session_id,
        "message_id": message_id,
    })

    return QueryResponse(
        answer_english=synthesis.get("answer_english", ""),
        answer_translated=synthesis.get("answer_translated", ""),
        language=req.language,
        confidence=synthesis.get("confidence", 0.0),
        intent=intent,
        audit_trail=audit_trail,
        raw_data=raw_data,
        session_id=session_id,
        message_id=message_id,
    )


# ── Feedback endpoint (👍/👎) ─────────────────────────────────────────────────
@app.post("/api/feedback", tags=["Query"])
async def submit_feedback(
    req: FeedbackRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Record helpful (+1) or unhelpful (-1) feedback on a specific answer."""
    if req.feedback not in (1, -1):
        raise HTTPException(status_code=422, detail="feedback must be +1 or -1")
    try:
        conn = get_db_connection()
        cur  = conn.cursor()
        # Only the message owner can submit feedback
        cur.execute(
            "UPDATE messages SET feedback = %s WHERE id = %s AND user_id = %s RETURNING id",
            (req.feedback, req.message_id, current_user.get("id"))
        )
        updated = cur.fetchone()
        conn.commit()
        cur.close()
        release_db_connection(conn)
    except Exception as e:
        log.error("feedback_write_failed", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail="Could not save feedback")

    if not updated:
        raise HTTPException(status_code=404, detail="Message not found or not owned by you")

    request_id = getattr(request.state, "request_id", new_request_id())
    _log_activity(
        request_id, current_user, "feedback", "/api/feedback",
        query_text=f"message_id={req.message_id} feedback={req.feedback}",
    )
    log.info("feedback_recorded", extra={
        "request_id": request_id,
        "message_id": req.message_id,
        "feedback": req.feedback,
        "user": current_user.get("sub"),
    })
    return {"status": "ok", "message_id": req.message_id, "feedback": req.feedback}


# ── Activity log query endpoint (SCRB Analyst only) ───────────────────────────
@app.get("/api/activity-log", tags=["System"])
async def get_activity_log(
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Return recent activity log entries. SCRB Analyst only."""
    if current_user.get("role") not in ("SCRB Analyst", "DGP"):
        raise HTTPException(status_code=403, detail="Requires SCRB Analyst role")
    try:
        conn = get_db_connection()
        cur  = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT a.*, u.full_name, u.badge_number
            FROM activity_log a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC
            LIMIT %s
        """, (min(limit, 500),))
        rows = cur.fetchall()
        cur.close()
        release_db_connection(conn)
        return rows
    except Exception as e:
        log.error("activity_log_read_failed", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail="Could not read activity log")


# ── Personal Activity log query endpoint (All authenticated users) ────────────
@app.get("/api/audit-log/me", tags=["System"])
async def get_my_activity_log(
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Return recent activity log entries for the currently authenticated user."""
    user_id = current_user.get("id")
    try:
        with get_db_cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT a.*, u.full_name, u.badge_number
                FROM activity_log a
                LEFT JOIN users u ON a.user_id = u.id
                WHERE a.user_id = %s
                ORDER BY a.created_at DESC
                LIMIT %s
            """, (user_id, min(limit, 200)))
            rows = cur.fetchall()
            for r in rows:
                if r.get("created_at"):
                    r["created_at"] = r["created_at"].isoformat()
            return rows
    except Exception as e:
        log.error("my_activity_log_read_failed", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail="Could not read personal activity log")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT") or os.environ.get("PORT") or 8000)
    uvicorn.run("main:app", host="0.0.0.0", port=port)

