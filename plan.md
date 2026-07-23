# Challenge 01 — Intelligent Conversational AI for KSP Crime Database
## Implementation Plan (Month-Long Build)

**Core thesis:** Don't build a chatbot over crime data. Build a system an investigator could trust *and* a judge could interrogate on stage without it falling apart. A month is enough time that "it worked in the demo" is no longer good enough — you should be able to say "we tested this against X" for almost every claim you make.

**Scope ambition for a month:** with this much runway, don't limit yourself to 3 shallow features. Build all 3 core differentiators to real depth, AND properly finish the secondary features (voice, PDF export, RBAC) rather than stubbing them. The extra time should show up as *rigor* — evaluation, edge-case testing, real user feedback — not just more features bolted on.

Core pillars (non-negotiable depth):
1. Multi-agent NL query engine with visible, inspectable audit trail
2. Kannada + English (code-mixed) understanding, tested on real messy input
3. Graph-based criminal network analysis
4. Explainability + bias-awareness built in and *evaluated*, not just asserted

Fully finished secondary features (you now have time for these to be real, not stubs):
5. Voice interaction
6. PDF export of conversation history
7. Role-based access control, actually enforced
8. Predictive/early-warning signals — done carefully, with guardrails

---

## Week 0 — Framing & Scoping (Days 1–3)

**Goal:** Lock the story and architecture before writing production code — but with a month, you also have room to do real groundwork here rather than rushing it.

- Define 2–3 demo scenarios end-to-end (e.g., a repeat-offender network case, a hotspot/trend investigation, a cross-station pattern case). With a month you can afford breadth of scenario without sacrificing depth, and multiple scenarios make the demo feel like a real product rather than one rehearsed trick.
- Write the hardest questions a skeptical officer/judge could ask, and design answers into the system architecture now:
  - "What happens when the AI is wrong?"
  - "How do you stop this from encoding existing policing bias?"
  - "Why should an investigator trust this over their own judgment?"
  - "What's your evaluation methodology — how do you know it works?"
- Adopt the framing: **every output is a "lead," never a verdict.** This should show up in UI copy and in system design, not just be a talking point.
- If feasible, talk to anyone with actual police/investigative experience (even informally) to sanity-check assumptions about how investigators actually think and query. This is the single biggest way to make the project feel authentic rather than academic — most competing teams won't bother.
- Divide roles with more granularity than a weekend hackathon would allow: data engineering, agent orchestration, NLP/language layer, graph/network analysis, frontend/UX, evaluation & testing, pitch/narrative owner. Assign an evaluation owner specifically — someone whose job is to try to break the system, not build it.
- Set up project management: a shared backlog, weekly milestones, and a shared repo with CI from day one (this alone will look more mature to judges who ask about your process).

**Output:** scenario docs, architecture diagram, role assignments, working repo with CI skeleton.

---

## Week 1 — Data Foundation (Days 4–10)

**Goal:** Realistic-enough data so every later demo and evaluation looks credible, not toy — and with a week available, build a data layer robust enough to survive tough questioning.

- Source or synthesize a crime records dataset: FIR-style records (complainant, accused, offense type, location, date, station), with real volume (tens of thousands of records, ideally combining a public dataset like the Kaggle Karnataka FIR dataset with your own synthetic augmentation).
- Verify any dataset claims yourself before using them in demo or pitch — don't cite an unverified stat, and document your data provenance clearly (this is something judges will ask about, and having a clean answer is a differentiator on its own).
- Design a schema that supports:
  - Entities: person, case, location, station, offense, vehicle (if relevant)
  - Relationships: co-accused, victim-accused, repeat appearances across cases, station jurisdiction
- Build a proper ETL/ingestion pipeline (not a one-off script) — with a month, this should be re-runnable and documented, showing engineering maturity.
- Inject a small number of deliberately "plantable" patterns into the synthetic data (a repeat co-offender network, a location cluster, a seasonal trend) so your demo scenarios have something real and specific to surface.
- Load structured data into a relational store; load relationship data into a graph store (nodes = people/locations, edges = case links). Build indexes and test query performance at realistic scale now, not on demo day.
- Write a short data documentation page: schema, provenance, known limitations, and how synthetic augmentation was done — useful both internally and as a credibility artifact for judges.

**Output:** documented, versioned dataset + schema, queryable from both relational and graph angles, tested at scale.

---

## Week 2 — Core Multi-Agent Query Engine (Days 11–17)

**Goal:** The technical heart of the project — this is what separates you from a single-LLM-call wrapper. With a week, build this to production-grade rigor, not prototype-grade.

- **Router agent:** classifies incoming query intent (factual lookup / pattern discovery / network question / trend question), with a labeled evaluation set you build yourselves to measure routing accuracy.
- **Specialist agents**, each narrow and auditable:
  - Structured-query agent (translates NL → safe, parameterized DB query — never raw SQL injection from the LLM; test adversarial inputs deliberately)
  - Network-analysis agent (graph traversal queries — "who is connected to X, how, since when")
  - Trend/hotspot agent (aggregation over time/location)
- **Synthesis agent:** combines specialist outputs into a coherent, plain-language answer, with explicit handling for conflicting or incomplete specialist outputs.
- **Audit layer (build this alongside, not after):** every answer carries a visible trace — which agent ran, which records were touched, what confidence/limits apply. This is your single highest-leverage feature for judge trust.
- **Evaluation harness:** build a set of 50–100 test queries (factual, ambiguous, adversarial, out-of-scope) and track accuracy/failure modes over the rest of the build. Re-run this weekly — a month gives you time to actually show improvement over iterations, which is a compelling thing to show judges directly ("here's our eval score in week 2 vs week 4").
- Add graceful failure handling: what the system says when it doesn't have enough information or confidence — this should be a designed behavior, not an accident.

**Output:** a query goes in, a traceable answer comes out, with the reasoning path inspectable, backed by a running evaluation suite with tracked accuracy over time.

---

## Week 3 — Language Layer, Trust & Safety, Predictive Features (Days 18–24)

**Goal:** With a full week, finish these properly rather than treating them as afterthoughts.

**Language layer:**
- Handle Kannada and English mixed within a single query (very common in real officer speech) — this needs real testing, not a happy-path demo.
- Build a genuine test set of messy inputs: misspellings, transliterated Kannada in Latin script, code-mixing mid-sentence, regional phrasing. Track accuracy on this set explicitly.
- Voice input → transcription → same pipeline as text. With a month, get this fully working, not stubbed — test it in a noisy room, not just a quiet one.

**Trust, safety & explainability:**
- Make "lead, not verdict" structurally real: every UI output labeled with confidence/limitation, e.g., "Investigative lead — verify against source record."
- Full source attribution: every claim links back to the specific case/record it came from.
- Properly implement role-based access control — not a stub. Different query results/fields visible depending on role (e.g., station-level investigator vs. SCRB analyst vs. supervisor). Test that access restrictions actually hold under adversarial querying (e.g., someone trying to get restricted data via an indirect phrasing).
- Write an explicit bias-mitigation section: how the design avoids reinforcing historical policing patterns (e.g., surfacing correlations as leads for human review, not automated flags/scores; avoiding proxies for protected characteristics in any risk-adjacent feature). Back this with a short internal audit — actually check what your model surfaces for different demographic/geographic slices of your data, and document what you found, including any concerning patterns and how you addressed them. This is rare enough among competing teams that doing it at all is a real differentiator.

**Predictive/early-warning features (if pursuing):**
- Keep this narrow and clearly framed as pattern-surfacing, not prediction-of-guilt. E.g., "these 3 factors historically co-occur with X" rather than "this person is high risk."
- Validate against held-out data and report actual precision/recall — don't present an untested model as reliable.

**Output:** the demo scenario runs correctly in English, Kannada, and mixed input; RBAC and audit features fully functional and adversarially tested; documented bias-mitigation analysis with real findings.

---

## Week 4 — Visualization, Integration, Evaluation & Demo Rehearsal (Days 25–30)

**Goal:** Make the reasoning visible, integrate everything into one coherent product, prove it works, and rehearse the story — with real time to do all four properly instead of rushing.

**Visualization:**
- Interactive network graph view for criminal network analysis (nodes/edges, expandable, filterable).
- Hotspot/trend view tied to the same underlying data.
- Conversation view showing the audit trail inline, with enough polish that it reads as a real product screen, not a debug log.
- Full PDF export of a conversation, properly formatted.

**Integration & hardening:**
- End-to-end test all demo scenarios repeatedly, including under bad network conditions, ambiguous queries, and adversarial inputs.
- Run a full pass of your evaluation harness and record final numbers — accuracy, language-handling performance, RBAC test results, bias-audit findings. Package these as a short "evaluation report" artifact for judges; a team that can hand over real numbers on request stands out sharply from one that only has a demo.
- Fix the obvious breakage first (crashes > cosmetic issues), then polish.

**Demo scenario rehearsal:**
- Script the demo as a narrative across your 2–3 scenarios: what the investigator asks, what the system surfaces, why they can trust it (audit trail), and one deliberate moment where the system gracefully declines to answer with full confidence — a system that never fails looks fake; one that fails gracefully looks real.
- Rehearse handling the hard questions from Week 0 live, using your actual evaluation numbers and bias-audit findings as answers, not improvised reassurance.
- Do at least one full dry run in front of someone outside the team acting as a skeptical judge, and revise based on what breaks.
- Re-verify every number or claim you plan to say out loud — no unverified statistics, especially in front of police officials who may know the real numbers.

**Output:** a fully integrated, evaluated product; a written evaluation report; a rehearsed demo script the whole team can deliver consistently under pressure.

---

## What Actually Wins This

Not feature count. The judges will remember whichever team visibly answered, unprompted: *"what happens when this is wrong, and why should an investigator trust it anyway?"* Build that in from Week 2 onward — don't bolt it on in the pitch deck. And with a month to work with, the strongest thing you can bring to the table isn't more features than everyone else — it's real, measured evidence (evaluation numbers, a documented bias audit, tested edge cases) behind the features you do have.