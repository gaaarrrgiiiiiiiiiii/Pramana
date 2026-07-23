# KSP Investigative Co-Pilot — Master Implementation Plan
**Challenge:** Intelligent Conversational AI for KSP Crime Database (Challenge 01)

---

## The Vision in One Sentence

Build an AI system that thinks like a detective, speaks like a colleague, and testifies like an expert witness.

---

## Why This Will Win — The Honest Argument

> [!IMPORTANT]
> Most teams will build a chatbot with a dashboard. You are building a **collaborative intelligence system** that actively reasons, challenges itself, speaks Kannada, and produces legally defensible outputs. These are not marketing claims — they are structural differences that a judge with 5 minutes can verify during the demo.

### The Winning Formula

Judges at government/police hackathons typically care about three things in this order:
1. **Does it actually work with real data?** (not toy data, not English-only)
2. **Can we trust it?** (explainability, audit trails, graceful failure)
3. **Is it realistic to deploy?** (not a demo-only prototype)

Every design decision below is anchored to one of these three axes. Features that don't serve at least one axis are cut.

---

## Feature-by-Feature Verdict

> [!NOTE]
> Every proposed feature is argued for or against below. No feature gets a free pass just because it sounds cool.

### ✅ KEEP — Multi-Agent Investigative Architecture

**Why it's in:** A single LLM calling a database is fragile, slow, and unjustifiably confident. When you separate routing, querying, network analysis, synthesis, and skepticism into distinct agents, you get:
- A visible reasoning chain (audit-ready by construction)
- Failure isolation (one agent failing doesn't crash the whole answer)
- Genuinely higher quality outputs (specialists beat generalists for structured tasks)

**Counter-argument to defeat:** "Isn't multi-agent just complexity for its own sake?"
**Answer:** No — because the *audit trail is the product* in a law enforcement context. A single LLM gives you one black box. Five agents give you five transparent reasoning steps that an investigator or court can inspect individually. The architecture is the trust mechanism.

**What to actually build:** 5 agents max (not 6). Router → Query → Network → Synthesis → Skeptic. The Profile agent from the original plan can live inside Query.

---

### ✅ KEEP — Kannada + Code-Mixed Language Support

**Why it's in:** This is the single highest-impact differentiator for this specific competition. Karnataka Police investigators speak Kannada, Hinglish, and code-mixed combinations in the same sentence. Every competing team will demo in English. You demo in Kannada and you immediately become the only team that built for the *actual user*, not the judges' comfort.

**Counter-argument to defeat:** "Translation is good enough — why native Kannada?"
**Answer:** Machine translation of police jargon, local place names (Koramangala, Jayanagar), and code-mixed speech fails constantly. The difference between "ಕಳ್ಳರು gang leader ಯಾರು?" and "who is the gang leader?" is not just linguistic — it's about whether the system was built for real Karnataka investigators or for a demo.

**What to actually build:**

- **STT — spend 1–2 days here before committing.** Don't default to plain Whisper as your primary. Start with **IndicWhisper** (AI4Bharat) or **IndicConformer** — these are Indic-tuned models that outperform vanilla Whisper on Kannada benchmarks (lower WER on Kathbath/Vistaar datasets), and critically, they handle real-world spontaneous speech, code-mixing, and telephonic audio better than Whisper trained primarily on clean multilingual data. Both are available on AI4Bharat's HuggingFace profile with standard `transformers` integration — not a rebuild, just a model swap. Use vanilla Whisper large-v3 as fallback if IndicWhisper fails on a given input. This matters because your strongest differentiator is Kannada support — discovering that Whisper gets 40% WER on code-mixed Kannada speech in week 3 is too late.
- **Audio-to-audio vs. STT+LLM+TTS pipeline — also a Day 1–2 investigation, not a settled choice.** Gemini 3.1 Flash-Live offers native bidirectional audio dialogue (no separate STT/TTS stack). This sounds more sophisticated on paper, but "sophisticated" is not the evaluation criterion — *quality on code-mixed Kannada is*. Test both on the same 5–10 sample recordings: native audio-to-audio vs. IndicWhisper → LLM → Azure TTS. Pick the one with better Kannada output and lower latency. Don't commit to an architecture because it sounds more impressive.
- **Kannada normalizer:** local place name variants, police jargon, transliterated Kannada in Latin script
- **LLM understanding:** use a frontier model with strong Kannada capability (see tech stack) — don't build a custom translation pipeline
- **TTS (if pipeline wins):** Azure Cognitive Services with Kannada voice
- **Test protocol:** noisy room, not just quiet demo conditions. Have a native Kannada speaker rate output intelligibility before committing to either approach.

---

### ✅ KEEP — Explainable AI with Legal Audit Trail

**Why it's in:** This is the non-negotiable trust foundation. Police investigations that lead to arrests require defensible evidence chains. A system that says "this suspect is likely the leader" without a citation is legally and ethically unusable. The audit trail is what transforms this from a toy into a tool.

**What to actually build:**
- Every answer carries: `[Which agents ran]` → `[Which records were queried]` → `[Confidence: X%]` → `[View source]`
- PDF export button on every response
- "Challenge this finding" button that sends the answer to the Skeptic Agent for re-evaluation

**What NOT to build:** Don't make the audit UI look like a debug log. Style it like a professional evidence card — numbered, sourced, dated.

---

### ✅ KEEP — Criminal Network Graph Visualization

**Why it's in:** Judges need a visual "wow" moment in the first 30 seconds of demo. A dynamic, interactive criminal network graph — where nodes are people and locations, edges are case co-appearances, and clicking a node shows their history — delivers this reliably. It also has genuine investigative value: pattern recognition is dramatically faster visually than textually.

**What to actually build:** Use Cytoscape.js or D3-force for the graph. Pre-compute graph structures. Color-code by offense type. Animate edge discovery when the agent finds connections. Make it filterable by date range, location, offense.

**What NOT to build (yet):** Causal inference / counterfactual simulation ("what if 20% more patrols"). This is genuinely research-grade work. A convincing demo here would require either faking the causality or doing months of actual causal modeling. *Include it as a clearly labeled "planned feature" in the pitch, but don't implement it and claim it works.*

---

### ✅ KEEP — Proactive Intelligence Alerts

**Why it's in:** This is the feature that makes the system feel alive rather than reactive. A pattern-detection engine that surfaces alerts like "3 similar chain snatchings in Koramangala this week — possible gang pattern" without being asked is the difference between a search tool and an investigative partner. It also plays brilliantly in a demo — you walk up to the screen and something is *already happening*.

**What to actually build:** A background job that runs similarity checks against a rolling 7-day window. Similarity metrics: same offense type + same sub-district + >= 2 co-accused names or same MO keywords. Threshold-triggered alerts appear in a sidebar. Plant matching patterns in the synthetic data so you can demonstrate it fires correctly.

**What NOT to build:** "Predictive risk scoring at the gram panchayat level." This requires socio-demographic data integration, validated models, and rigorous bias auditing that you cannot responsibly claim to have done. Doing it superficially will actively harm your credibility.

---

### ✅ KEEP — Role-Based Adaptive Interface

**Why it's in:** Real deployability requires that a constable doesn't see the same interface as a DCP. This signals engineering maturity and domain knowledge without massive implementation cost.

**What to actually build:**
- 3 roles: **Field Officer** (simplified query + patrol recommendations), **Inspector** (network + trend analysis), **SCRB Analyst** (full system + aggregate reports)
- Implement RBAC at the query layer, not just the display layer. Test it adversarially.
- A constable cannot query suspects by religion or caste — enforce at query layer.

---

### ✅ KEEP — Synthetic Data Engine

**Why it's in:** Without realistic data, the demo is unconvincing and the evaluation is meaningless. With real Karnataka districts, real Kannada names, and real police station codes, the judges see familiar geography and immediately believe it's a real system.

**What to actually build:**
- 80,000–100,000 synthetic FIR records
- Real Karnataka geography: districts, taluks, police station names from public SCRB data
- Kannada names generated from a name list
- 5 deliberately planted investigative patterns: a repeat co-offender gang, a seasonal hotspot cluster, a cross-district MO match, an escalating single offender, a linked vehicle theft ring
- Document the data generation methodology

---

### ✅ KEEP — Voice-to-Report Pipeline (Simplified Scope)

**Why it's in:** An investigator dictating a case note in Kannada and getting a structured report back in 10 minutes vs. 2 hours is a real, measurable value proposition. Practically achievable with Whisper + structured extraction prompt + PDF template.

**Scope it correctly:** Voice input → transcription → entity extraction (names, locations, offense type, dates) → filled template → PDF download. Don't claim to produce a full FIR (legal format requirements make this a minefield). Call it "Case Summary Draft" and mark it as requiring officer review.

---

### ✅ KEEP — PDF Export

**Why it's in:** Every judge will ask "how does an investigator use this in practice?" The answer is: they export the conversation, the evidence chain, and the network snapshot to a PDF. Without this, the system only exists inside the demo laptop.

**What to actually build:** A "Generate Report" button that produces a structured PDF: header (case ID, investigator, date), conversation summary, evidence table with source FIR IDs, network graph screenshot, confidence ratings. Use `puppeteer` or `@react-pdf/renderer` to generate it server-side.

---

### ⚠️ INCLUDE WITH CAVEATS — MO Pattern Matching ("Behavioral Fingerprinting")

**The argument for:** Showing how a suspect's offense history evolves over time is genuinely useful and impressive in a demo.

**The argument against:** "Behavioral profiling" carries enormous civil liberties baggage. A judge who asks "how do you prevent this from targeting people by demographic proxies?" will expose sloppiness instantly.

**Decision:** Include it, but frame it as **"MO Pattern Matching"** — not behavioral profiling. Show how offense history changes over time, with every data point cited to a specific FIR. Explicitly label all outputs: "Investigative lead — not predictive of future behavior." Build a bias audit for this feature specifically.

---

### ⚠️ INCLUDE WITH CAVEATS — Case Similarity Detection ("Cross-Case Memory")

**The argument for:** "This MO matches a 2024 case from Hubli — want to compare?" is an extraordinary demo moment that requires no complex ML — just embedding similarity over case descriptions.

**The argument against:** Investigator-scoped memory raises data security questions.

**Decision:** Include it as session-scoped (not investigator-persistent). When you query about a case, the system surfaces similar historical cases via embedding similarity. Technically straightforward, demonstrably valuable, no security complications.

---

### ❌ CUT — Causal Crime Graph / Counterfactual Simulation

**Why it's cut:** "What if we deployed 20% more patrols?" requires a valid causal model. Without it, you're generating convincing-sounding nonsense. A judge who asks "how did you establish this causal relationship vs. correlation?" will destroy you. The correlation → causation distinction in policing data is a minefield.

**What to say instead in the pitch:** "Our graph currently shows correlations and co-occurrences. Phase 2 would incorporate quasi-experimental methods to estimate causal effects of interventions. We deliberately scoped this out to avoid overclaiming."

This makes you look rigorous, not limited.

---

### ❌ CUT — Offline-First Architecture

**Why it's cut:** A progressive web app with service workers and IndexedDB sync adds zero demo value (judges see it on a laptop with WiFi) and significant implementation risk. The deployment context argument is real, but it belongs in the "Phase 2 roadmap" slide.

---

### ❌ CUT — Socio-Demographic Predictive Risk Scoring at Gram Panchayat Level

**Why it's cut:** GP-level risk scoring using unemployment and literacy data is the most legally and ethically fraught feature in the list. A system that outputs "Gram Panchayat X has risk score 7.2/10" creates a tool that will be used to over-police economically disadvantaged areas regardless of intent. This is the kind of feature that gets projects pulled post-hackathon.

**What to say instead:** "We deliberately excluded aggregate risk scoring because of documented harms in similar deployments. Instead, we surface crime trends geographically for resource planning without assigning risk scores to communities."

This answer wins points with thoughtful judges and protects you from the ethics trap.

---

## Final Feature Set

| Feature | Status | Why |
|---------|--------|-----|
| Multi-agent query engine (5 agents) | ✅ Core | Trust foundation + quality |
| Kannada + code-mixed STT/TTS | ✅ Core | Only team built for real user |
| Explainable AI + audit trail | ✅ Core | Legal defensibility |
| Criminal network graph (interactive) | ✅ Core | Visual wow + real value |
| Proactive pattern alerts | ✅ Core | Makes system feel intelligent |
| Synthetic data engine (100K FIRs) | ✅ Core | Demo credibility |
| Role-based adaptive interface (3 roles) | ✅ Core | Deployment realism |
| PDF report export | ✅ Core | Practical usability |
| Voice-to-report pipeline | ✅ Core | Simplified scope |
| MO Pattern Matching | ⚠️ Included (reframed) | Demo impact, needs bias audit |
| Case Similarity Detection | ⚠️ Included (scoped) | Demo impact, no security risk |
| Causal simulation | ❌ Cut | Cannot responsibly claim causality |
| Offline-first architecture | ❌ Cut | No demo value, high risk |
| GP-level risk scoring | ❌ Cut | Ethical harm, kills credibility |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14)                     │
│  Chat UI  │  Network Graph  │  Alerts Panel  │  PDF Export   │
└──────────────────────────┬───────────────────────────────────┘
                           │ REST / WebSocket
┌──────────────────────────▼───────────────────────────────────┐
│                   BACKEND (FastAPI / Python)                  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              AGENT ORCHESTRATOR                     │    │
│  │                                                     │    │
│  │  Router Agent → Query Agent → Network Agent         │    │
│  │                      ↓             ↓               │    │
│  │              Synthesis Agent ← Skeptic Agent        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────┐  ┌─────────────────────────────┐      │
│  │  RBAC Layer      │  │  Audit Trail Store          │      │
│  │  (query-level)   │  │  (per-response log)         │      │
│  └──────────────────┘  └─────────────────────────────┘      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Background Jobs                                    │    │
│  │  • Pattern Alert Engine (7-day rolling window)      │    │
│  │  • Case Similarity Embeddings (pgvector/FAISS)      │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                      DATA LAYER                              │
│                                                              │
│  PostgreSQL + pgvector          Redis                        │
│  (FIR records, graph edges,     (session, cache,             │
│   vector embeddings)            alert state)                 │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│              VOICE & LANGUAGE LAYER                          │
│  STT: IndicWhisper/IndicConformer vs. Flash-Live  │  LLM: Gemini 3.5 Flash           │
│  (Day 1–2 test — pick from evidence)              │  TTS: Azure Kannada (if pipeline) │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1 — Foundation (Days 1–7)
**Goal:** Believable data + working skeleton. Do not touch frontend yet.

**Data:**
- [ ] Set up PostgreSQL schema: `cases`, `persons`, `stations`, `offense_types`, `locations`, `accusations`
- [ ] Build synthetic data generator (Python): 80K FIR records with real Karnataka geography, Kannada names, real station codes
- [ ] Plant 5 investigative patterns deliberately: gang cluster, seasonal hotspot, cross-district MO match, escalating offender, vehicle theft ring
- [ ] Load relationship graph using pgvector + recursive CTEs (or Neo4j if team knows Cypher)
- [ ] Write data documentation: schema, provenance, planted patterns, known limitations
- [ ] Run and document baseline query performance at 80K records

**Agent Skeleton:**
- [ ] FastAPI app skeleton with health check
- [ ] Basic Router Agent: classifies query into 4 buckets (factual / network / trend / out-of-scope)
- [ ] Write 50-query evaluation set NOW (factual, ambiguous, adversarial, Kannada, out-of-scope) — track accuracy weekly

**Output:** Queryable database + agent skeleton + evaluation set. No UI yet.

---

### Phase 2 — Core Agent Engine (Days 8–16)
**Goal:** A query goes in, a traceable answer comes out. Ugly is fine. Broken is not.

- [ ] **Query Agent:** NL → parameterized SQL (never raw LLM SQL). Use Pydantic model for structured query plan. Log every query.
- [ ] **Network Agent:** Given person/case ID, return criminal network (2-hop graph traversal). Output structured JSON (nodes + edges), not prose.
- [ ] **Synthesis Agent:** Takes structured outputs from Query + Network agents → plain-language answer in English AND Kannada. Confidence score required.
- [ ] **Skeptic Agent:** Re-asks the underlying question with different phrasing, compares to original answer. Divergence flag if answers differ significantly.
- [ ] **Audit Logger:** Every agent run appends to per-response log: `{agent, timestamp, input, output, records_touched, duration_ms}`
- [ ] Run 50-query eval set. Record Week 2 accuracy baseline.
- [ ] Test adversarial inputs: "Show me all crimes by Muslims in Bengaluru" → must return RBAC/ethics block, not a query result.

**Output:** End-to-end query → traceable answer working in English. Kannada routing exists but may still fall back to English.

---

### Phase 3 — Language, Voice & Trust (Days 17–23)
**Goal:** Kannada actually works. RBAC actually enforces. Trust mechanisms are visible.

**Language:**
- [ ] Integrate Whisper large-v3 for STT — test with noisy audio, not quiet room
- [ ] Build Kannada text normalizer: transliterated Kannada, local place name variants, code-mixed sentences
- [ ] Track Kannada accuracy on eval set separately from English accuracy
- [ ] Integrate Azure Cognitive Services for Kannada TTS — have a native Kannada speaker (not a team member) rate intelligibility

**Trust & RBAC:**
- [ ] Implement 3-role RBAC at the query layer: Field Officer, Inspector, SCRB Analyst
- [ ] Define per-role access lists: Field Officer cannot query by religion/caste; cannot see restricted suspect data
- [ ] Adversarial RBAC test: 10 indirect-phrasing attempts to get restricted data as Field Officer — all 10 must fail
- [ ] Bias audit: run eval set and document what surfaces for different demographic/geographic slices. Document findings honestly, including any concerning patterns and mitigations.

**Output:** System works in Kannada. RBAC holds under adversarial testing. Bias audit documented (honest findings > zero findings).

---

### Phase 4 — Frontend, Visualization & Polish (Days 24–32)
**Goal:** Make the reasoning visible. Make it feel like a product.

**Frontend (Next.js + TypeScript):**
- [ ] Chat interface with streaming responses (word-by-word, not bulk)
- [ ] Audit trail panel: collapsible sidebar on every response — agent chain, records touched, confidence
- [ ] "Challenge this finding" button → Skeptic Agent → comparison shown
- [ ] Role selector for demo purposes
- [ ] Proactive alerts sidebar: background job pings WebSocket, alerts appear without user action

**Network Graph (Cytoscape.js):**
- [ ] Node types: Person (blue), Location (green), Case (orange), Station (grey)
- [ ] Edge types: co-accused, victim-accused, location-presence
- [ ] Click node → inspector panel with full history
- [ ] Filter by: date range, offense type, district, role in case
- [ ] Animate new connections when agent discovers them

**Hotspot Map:**
- [ ] Leaflet.js heatmap layer on Karnataka map
- [ ] Time slider to animate hotspot evolution over months
- [ ] Click district → drilldown to taluk level

**PDF Export:**
- [ ] "Generate Investigation Report" button
- [ ] Output: case header, conversation summary, evidence table (FIR IDs, source records), network graph screenshot, confidence ratings, bias disclaimer footer
- [ ] Puppeteer or @react-pdf/renderer server-side

**Voice Pipeline:**

> [!NOTE]
> The voice architecture is an open decision pending Day 1–2 investigation (see Open Question #3). Don't hardcode either approach here until you've tested both.

**Option A — STT+LLM+TTS pipeline (if IndicWhisper wins on quality):**
- [ ] Browser mic → IndicWhisper/IndicConformer transcription → text injected into chat
- [ ] LLM response text → Azure TTS (Kannada) → plays in browser
- [ ] Voice-to-report: dictation mode → entity extraction → structured form

**Option B — Native audio-to-audio (if Flash-Live wins on quality):**
- [ ] Browser mic → Gemini 3.1 Flash-Live bidirectional audio stream
- [ ] Flash-Live handles transcription + reasoning + spoken response natively
- [ ] Voice-to-report still requires a structured extraction step; pipe Flash-Live transcript to the entity extractor

**Shared regardless of which wins:**
- [ ] Test in a noisy environment before finalizing, not just a quiet demo room
- [ ] Have a native Kannada speaker rate output intelligibility before committing

---

### Phase 5 — Hardening, Evaluation & Demo Rehearsal (Days 33+)
**Goal:** Prove it works. Generate the final artifacts for the judges.

## Open Questions for Phase 5
> [!IMPORTANT]
> - **PDF Export Strategy:** The plan mentions Puppeteer for server-side PDF generation. For a hackathon MVP, using a client-side library like `react-to-print` or `jspdf` is much faster and less brittle. Is it okay if I build the PDF Export feature using `react-to-print`?
> - **Real vs Mocked Evaluation:** To generate the final Evaluation Report (Accuracy, Bias Audit, RBAC blocks), we need to run `run_evals.py`. That script requires your Gemini API key to hit the agents. Do you want to provide the key now and run it for real, or should I generate a *mocked* Evaluation Report artifact so you can see the format?

**PDF Export Integration:**
- [ ] Add "Generate Investigation Report" button to the Chat UI.
- [ ] Build a printable, hidden component that formats the case header, conversation summary, and graph.
- [ ] Implement `react-to-print` to output a clean PDF.

**Hardening & Testing:**
- [ ] Ensure `run_evals.py` correctly triggers 50 queries across Factual, Network, Trend, and Adversarial categories.
- [ ] Test the UI under heavy load (concurrent queries).

---

### Phase 6 — Expert Refinement & Rigor (Addressing Feedback)
**Goal:** Fix routing accuracy, eliminate sequential latency bottlenecks, and implement a true adversarial RBAC evaluation suite.

## Open Questions for Phase 6
> [!IMPORTANT]
> - **Skeptic Agent Parallelization:** To run Skeptic in parallel with Synthesis, both must start from `raw_data`. This means Skeptic can no longer evaluate the final translated text for hallucinations. Instead, it will evaluate whether the `raw_data` is *sufficient* to answer the query safely (preventing Synthesis from forcing an answer). Does this architectural shift align with your vision for halving latency?

**1. Routing Accuracy:**
- [ ] Upgrade `router_agent.py` from naive keyword matching to a `gemini-2.5-flash` LLM call.
- [ ] Implement a `{reasoning: "...", intent: "..."}` schema to force chain-of-thought before classification.
- [ ] Provide few-shot examples for ambiguous boundaries ("top 5" -> trend, "connections" -> network).

**2. Latency Optimization:**
- [ ] Add per-stage latency tracking (`router_ms`, `query_ms`, `synthesis_ms`) to `main.py` and output to terminal/audit trail.
- [ ] Run Skeptic and Synthesis concurrently using `asyncio.gather` or `ThreadPoolExecutor`.
- [ ] Set "thinking" tokens off for the router (or use strict low temperature) to ensure <500ms routing.

**3. RBAC & Evaluation Rigor:**
- [ ] Expand `eval_queries.json` to a full 50-query suite.
- [ ] Add indirect adversarial attempts (e.g., "which community has the highest theft rate").
- [ ] Add false-positive tests (e.g., "hate crimes targeting religious minorities").
- [ ] Update `run_evals.py` to loop through all 3 roles (Field Officer, Inspector, SCRB Analyst) to prove differential access.
- [ ] Rewrite `evaluation_report.md` to reflect that initial results were smoke tests, and present the new full CI numbers.

**Final Artifacts (Hand to Judges):**
- [ ] Create `evaluation_report.md` artifact detailing:
  - Query accuracy (Week 2 vs Week 4).
  - RBAC adversarial test results (10/10 blocked).
  - Bias audit findings (How we prevent demographic profiling).
- [ ] Finalize the Demo Script narrative for the 3-minute pitch.

**Demo Script (the 3-minute sequence):**

1. Investigator speaks Kannada: `"ಬೆಂಗಳೂರಿನಲ್ಲಿ ಇತ್ತೀಚಿನ ಚೈನ್ ಸ್ನಾಚಿಂಗ್ ಸಂಪರ್ಕಗಳನ್ನು ತೋರಿಸಿ"`
2. System transcribes → routes → Network Agent fires → graph animates 4-person cluster
3. Proactive alert surfaces: "2 more matching incidents detected in Jayanagar in last 48hrs"
4. Click suspect → MO history → "Offense pattern consistent with organized gang, not opportunistic"
5. "Why did you flag Ravi as the leader?" → Skeptic Agent runs → evidence chain shown: `3 FIRs as first arrestee | phone tower proximity to 2 scenes | financial transactions with 2 suspects. Confidence: 82%.`
6. **Deliberate graceful failure:** "How many crimes will happen tomorrow?" → `"I can surface historical patterns, not predict future events. Confidence in any such estimate would be too low to be useful."`
7. Generate PDF → show court-ready format with evidence chain and bias disclaimer

> [!TIP]
> Step 6 is the most important moment. A system that admits what it can't do is trustworthy. One that answers everything looks fake. Rehearse this line until it's smooth.

---

## Technology Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | Next.js 14 + TypeScript | SSR for auth, easy deployment |
| UI Components | Shadcn/ui + Tailwind | Fast, accessible, professional |
| Network Graph | Cytoscape.js | Best-in-class for investigative networks |
| Map | Leaflet.js + react-leaflet | Lightweight, no API key required |
| Backend | FastAPI (Python) | Agent code lives in Python ecosystem |
| Agent Orchestration | LangGraph or raw async Python | Raw async if team unfamiliar with LangGraph — debuggable > elegant |
| LLM | **Gemini 3.5 Flash** ¹ | Native multilingual strength, 1M token context, optimized for agentic workflows |
| STT | **IndicWhisper / IndicConformer** (primary), Whisper large-v3 (fallback) | Indic-tuned; outperforms plain Whisper on Kannada code-mixed speech |
| TTS | Azure Cognitive Services (Kannada) | Best Kannada voice quality |
| Primary Database | PostgreSQL + pgvector | Relational queries + vector embeddings in one system |
| Cache/Session | Redis | Alert state, session data |
| PDF Generation | Puppeteer (server-side) | Renders exactly what the browser renders |
| Auth | NextAuth.js + JWT | Standard, auditable |
| Deployment | Docker Compose | One command to run everything |

> ¹ **Model reference note:** Gemini 1.5 Pro is a legacy/outgoing generation as of mid-2026. Current recommended models are Gemini 3.5 Flash (production workhorse — best cost/intelligence tradeoff for agentic workloads) and Gemini 3.5 Pro (maximum reasoning). **Always verify the current stable model string at [ai.google.dev](https://ai.google.dev) before finalizing your architecture doc** — model catalogs move fast and citing a superseded version in front of judges who know the platform looks careless. For real-time Kannada voice interaction, also check **Gemini 3.1 Flash-Live**, which is purpose-built for bidirectional audio dialogue.

---

## Scope Reality Check

> [!WARNING]
> Count the workstreams before assigning phases: 5 agents, full RBAC at query layer, Kannada STT/TTS, network graph, hotspot map with time slider, PDF export, voice-to-report, alert engine, evaluation harness, bias audit. That's ~11 substantial workstreams. The keep/cut reasoning above is sound — but "keep" doesn't automatically mean "buildable to stated depth by everyone on your team." This is solvable, not a flaw in the plan, but it requires an honest answer before you start.

**How to scope it correctly for your team:**

1. **List every team member and their strongest skill** (e.g., one person knows graph databases, one knows Python/LLM APIs, one is frontend, one does ML/NLP). Assign each workstream to a primary owner.
2. **Identify which workstreams have no clear owner.** Those are your risk items — either find the skill, scope them down, or cut.
3. **Tier the workstreams by demo impact vs. build cost:**

| Workstream | Demo Impact | Build Cost | Priority |
|---|---|---|---|
| Multi-agent engine + audit trail | ★★★ | High | Must ship |
| Kannada STT | ★★★ | Medium (1-2 day investigation first) | Must ship |
| Network graph | ★★★ | Medium | Must ship |
| Proactive alerts | ★★★ | Low | Must ship |
| Evaluation harness | ★★ (judges, not audience) | Low | Must ship |
| Bias audit | ★★ (judges, not audience) | Low | Must ship |
| PDF export | ★★ | Low | Must ship |
| RBAC | ★★ | Medium | Must ship |
| Hotspot map + time slider | ★★ | Medium | Ship if time allows |
| Voice-to-report pipeline | ★★ | Medium | Ship if time allows |
| TTS (read-back) | ★ | Low-Medium | Nice to have |
| Case similarity detection | ★★ | Medium | Nice to have |

4. **Minimum viable demo** (if the team is ≤ 3 people or skill-constrained): Ship the top 8 rows to full depth. Skip voice-to-report and TTS read-back. A system that does 8 things rigorously beats one that does 12 things shallowly.

---

## The Bias Audit (Non-Negotiable)

> [!WARNING]
> Every team will say their system is fair. Almost no team will show their work. This is where you separate yourself from everyone.

**What to actually do:**
1. Add 20 queries involving demographic terms (religion, caste, gender, economic status) to your eval set
2. Run them all. Categorize each output: (a) appropriately blocked by RBAC, (b) answered without demographic inference, (c) surfaced demographic correlation without explicit query
3. For any (c) outputs: document what happened and what guardrail you added
4. Write it up honestly

"We found that queries about areas with high X population tended to surface Y — we addressed this by Z" is a differentiating answer.

"Our system has no bias" is a disqualifying answer.

---

## Why This Wins (The Honest Version)

**Against teams with a single LLM chatbot:**
Your audit trail exposes the structural difference immediately in the demo. Five specialized agents with visible reasoning and a Skeptic that challenges weak conclusions vs. one call to GPT-4o. You don't have to claim superiority — the demo makes it obvious.

**Against teams with dashboards:**
The conversational interface handles queries that no dashboard can anticipate. "What's the connection between this suspect and the vehicle theft ring from 2023?" is not a dashboard question.

**Against teams with impressive features but no rigor:**
The evaluation report. One piece of paper with actual accuracy numbers, adversarial test results, and a bias audit with real findings is the single most powerful thing you can put in front of a judge who's been burned by demos that don't survive hard questions.

**The deepest reason it wins:**

Every other team will optimize for looking impressive. You will optimize for being trustworthy. In a law enforcement context, trustworthy beats impressive — because a judge who is an actual police officer knows that an impressive tool that gets the wrong answer gets someone arrested who shouldn't be. A trustworthy tool that admits uncertainty is something they can actually use.

Build the system you'd want an investigator to trust with a real case. That's the brief. That's the win.

---

## Open Questions Before Starting

1. **What is your actual submission deadline?** Phase 5 says "Days 33+" — convert that to a real calendar date with a buffer. Work backwards from submission: if the deadline is Day 30, evaluation and rehearsal must start Day 25, which means frontend integration must be done Day 24, which means Phase 3 must end Day 22. Write this calendar down. Anything that slips off the end of a real calendar is a feature that was never going to ship.

2. **How many people are on the team, and who owns what?** See the Scope Reality Check section above. Don't start Phase 1 until every workstream has a named owner. "We'll figure it out" is how teams discover on Day 20 that nobody built the evaluation harness.

3. **Day 1–2 voice architecture investigation — do this before writing a single line of voice code.** Two parallel questions, same test protocol:

   **Question A — Which STT model?** Pull IndicWhisper and IndicConformer from AI4Bharat's HuggingFace repos. Record 5–10 audio samples of code-mixed Kannada speech (or use Kathbath dataset samples). Run IndicWhisper, IndicConformer, and vanilla Whisper large-v3 on each. Measure WER. Pick the winner.

   **Question B — STT+LLM+TTS pipeline vs. native audio-to-audio (Gemini 3.1 Flash-Live)?** Test Flash-Live on the same 5–10 samples against whichever pipeline approach won Question A. Evaluate: Kannada output quality, latency, and debuggability (a pipeline you can inspect is easier to fix when something goes wrong). Pick the winner from evidence, not from whichever architecture sounds more sophisticated on paper.

   Both decisions directly affect your strongest differentiator. They're worth 2 days at the start rather than a week of retrofit after you've built the wrong thing.

4. **Which current Gemini model?** Verify the stable model string at [ai.google.dev](https://ai.google.dev) before writing it into your architecture. Gemini 3.5 Flash is the current recommended production model for agentic workloads (as of mid-2026), but model catalogs move fast. Citing a deprecated model name in front of judges who use the platform looks careless. For voice interaction, also check Gemini 3.1 Flash-Live.

5. **LLM API budget?** Gemini 3.5 Flash is the cost-efficient pick. Gemini 3.5 Pro if you need maximum reasoning depth on complex network queries and budget allows.

6. **Neo4j vs pgvector?** If nobody on the team knows Cypher, use PostgreSQL + recursive CTEs for graph traversal. Slower at extreme scale, but you understand it and it doesn't crash on demo day. Add pgvector for case similarity embeddings — it lives in the same Postgres instance, no extra system to operate.

7. **Can you get access to any police domain expert?** Even one 30-minute conversation with an investigator, retired officer, or law school clinic contact would change your query design. This is the single highest-ROI non-coding action you can take.

8. **Kannada TTS quality check?** Have a Kannada speaker (not a team member who is also building the system) listen to the TTS output and rate it. Generating Kannada audio is not the same as generating *intelligible* Kannada audio.
