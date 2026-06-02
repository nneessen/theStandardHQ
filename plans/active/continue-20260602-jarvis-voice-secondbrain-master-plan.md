# MASTER PLAN — Jarvis: flawless voice + total recall + a real second brain

**Created:** 2026-06-02 · **Owner:** Nick · **Surface:** `/command-center` (Jarvis)
**Decisions locked (this session):**
1. **Voice architecture →** adopt a **realtime agent framework** (LiveKit Agents / Pipecat) that KEEPS the Claude orchestrator + ElevenLabs voice, and adds WebRTC transport, streaming STT, server-side turn-taking, and barge-in.
2. **Sequencing →** **stabilize first** (instrument + targeted fixes to stop the gibberish in days), **then rebuild** on the realtime stack.
3. **Second brain →** **in-app per-user RAG/knowledge graph + one-click Obsidian export** (no live Obsidian API exists; this is the real-world equivalent).

> This plan is the senior-engineer "A-to-Z." It is deliberately opinionated. Read §1 (why it's broken) and §2 (the target) first; everything else is execution.

---

## 0. The core insight (why we keep failing)

**A production voice agent is a persistent, stateful, low-latency streaming system. The current implementation is a stateless request/response pipeline stitched onto Supabase Edge Functions.** That mismatch is the root of every symptom — gibberish, latency, "stuck listening," no barge-in, brittle edge cases. We are hand-rolling, on the wrong substrate, the exact problem that mature frameworks (LiveKit Agents, Pipecat) and realtime transports (WebRTC) exist to solve.

We will not "fix the gibberish" with one more patch. We will (a) stop the bleeding fast with instrumentation + targeted fixes, then (b) move the realtime audio loop onto the right substrate while keeping the parts that are genuinely good (the Claude tool-orchestrator brain, ElevenLabs voice, the grounding discipline).

---

## 1. Current state — grounded, with the structural flaws

### What exists today (files)
- **Capture (frontend):** `src/features/assistant/hooks/useAssistantVoiceSession.ts` — MediaRecorder records a whole utterance to a blob, gated by `MIN_UTTERANCE_MS`/`MIN_BLOB_BYTES`; an `AudioContext` does crude client VAD; recent fix `fbc817cf` had to `resume()` a suspended AudioContext ("stuck at listening").
- **STT:** `supabase/functions/assistant-voice-stt/` — uploads the blob to **OpenAI Whisper-1, `response_format: json`, no language hint, no domain prompt**. **Batch** — record → stop → upload → transcribe → return.
- **Brain:** `supabase/functions/assistant-orchestrator/` — Claude, agent routing, tool-use, **SSE** token streaming, sentence-pipelined to TTS. (This part is good and worth keeping.)
- **TTS:** `supabase/functions/assistant-voice-tts/` — ElevenLabs streaming, `optimize_streaming_latency=2` (normalizer ON), MP3 streamed through. Config is already correct (confirmed live: redeploy = "no change").
- **Playback (frontend):** `playStreamingAudio()` feeds the MP3 stream into a **MediaSource (MSE)** SourceBuffer, with a `playBuffered()` blob fallback. MSE-for-`audio/mpeg` is browser-fragile (Safari has no MSE-MP3; some Chromium builds mis-handle non-frame-aligned chunks).

### The structural flaws (why "flawless" is impossible as-is)
1. **Batch STT** → high latency + no partial transcripts + **cannot do barge-in** (you can't interrupt what you can't stream). The user waits for: silence detection → stop → upload → Whisper → response.
2. **Edge Functions are stateless + cold-start-prone** → every turn risks a cold isolate; keep-warm (`?warm=1`) is a band-aid. Realtime audio needs a warm, persistent worker.
3. **HTTP, not WebRTC** → no jitter buffer, no packet-loss recovery, no real-time media plane. Audio glitches and "gibberish" thrive here.
4. **Hand-rolled MSE playback** → the single most likely source of "garbled audio you can't hear." Browser MSE-MP3 inconsistency = corrupted playout. (Phase 0 will confirm by capture, not guess.)
5. **No server-side turn detection / endpointing model** → client VAD is crude; mis-fires ("stuck"), clips speech, or talks over the user.
6. **No barge-in** → the assistant can't be interrupted; feels robotic and "horrible."
7. **Whisper with no domain prompt** → mis-transcribes carriers/products/names ("Foresters", "term life", agent jargon) → the brain answers the wrong question → reads as "it's not doing what I asked."

**Verdict:** the brain (Claude orchestrator + tools + grounding) is sound. The **media + transport + STT streaming + turn-taking** layer is the problem and must be re-platformed.

---

## 2. Target architecture — the realtime voice agent, done right

```
 Browser (WebRTC client)
   mic ──▶ [WebRTC audio track] ──▶  Agent Worker (persistent process; LiveKit Agents or Pipecat)
                                       ├─ Server VAD (Silero) + turn-detection/endpointing
                                       ├─ Streaming STT (Deepgram Nova-2 / AssemblyAI / Whisper-stream)
                                       │     └─ partial + final transcripts (low latency, barge-in-ready)
                                       ├─ LLM = YOUR Claude orchestrator (called as the "LLM service")
                                       │     └─ streaming tokens + tool-use (existing SSE brain, reused)
                                       ├─ Streaming TTS (ElevenLabs Flash v2.5 / Turbo)
                                       └─ Barge-in controller (user speech during TTS → cancel + listen)
   speaker ◀── [WebRTC audio track] ◀── jitter-buffered playout (framework-managed; NO MediaSource)
```

### Why this is flawless-capable
- **WebRTC media plane** → sub-100ms, jitter-buffered, loss-tolerant. **Kills the gibberish** — playout is a managed audio track, not hand-decoded MP3.
- **Streaming STT** → partial transcripts; the agent reacts as you speak; enables barge-in.
- **Server VAD + turn-detection model** → correct endpointing; no "stuck listening," no clipping, no talking over you.
- **Barge-in** → interrupt the assistant naturally; cancels in-flight LLM + TTS instantly.
- **Persistent worker** → no cold starts in the hot path; the model + connections stay warm.
- **Keeps your investment** → Claude orchestrator stays the brain (wrapped as the framework's LLM node); ElevenLabs stays the voice; all tools/grounding reused.

### The one genuinely new piece of infra: the **Agent Worker**
LiveKit/Pipecat agents run as a **persistent server process**, not an edge function. We stand up a small always-on worker (Node or Python) on **Fly.io / Render / Railway / a container**, that:
- Joins the LiveKit room, runs the STT→(Claude)→TTS pipeline.
- Calls the **existing `assistant-orchestrator`** edge function as its "LLM" (HTTP/SSE) so the brain, tools, RLS, and grounding are unchanged — OR (cleaner, later) the orchestrator logic is imported into the worker directly.
- This is the correct substrate for realtime audio and removes the edge-function cold-start tax from the hot path.

### Latency budget (target; measured, not assumed)
End-of-user-speech → first audio out: **p50 < 800ms, p95 < 1.2s.**
Breakdown: endpointing ~200ms · STT final ~80–120ms · Claude first token ~250–350ms · TTS first chunk ~120–180ms · network/playout ~80ms.

### Build-vs-buy within "framework" (recommended split)
- **Transport + agent framework:** **LiveKit Agents** (LiveKit Cloud to start; self-host later) or **Pipecat** (fully OSS, max control). *Recommendation: LiveKit Agents Cloud for speed-to-flawless, revisit self-host on cost.*
- **STT:** **Deepgram Nova-2** (streaming, fast, strong on names/numbers with keyword boosting) — *recommended over Whisper-stream for latency + barge-in.* AssemblyAI is the alternative.
- **LLM:** **keep Claude** via the orchestrator. Non-negotiable — it's the differentiator.
- **TTS:** **keep ElevenLabs** (Flash v2.5 for latency). Already streaming.

---

## 3. PHASE 0 — REVISED 2026-06-02: go straight to LiveKit (Phase 0 patches DROPPED)

**Decision change (owner):** skip the stabilization band-aids and start directly on the realtime rebuild. The reasoning is correct and overrides the earlier "stabilize-first" pick:
- The Phase-0 **code** (blob-playback swap, Whisper domain-prompt, MediaSource fixes) is **throwaway** — LiveKit + Deepgram replace the entire STT + transport + playback path, so patching it is effort spent on soon-deleted code.
- **The typed path works now** (after today's routing/grounding/queryPolicies fixes), so voice doesn't need a band-aid — use **text** for lookups in the interim; voice returns *flawless*, not patched.
- One clean effort beats two; no dead code (repo rule).

**What carries over (NOT throwaway), folded into M1:** per-turn **observability/tracing** (§8) is built fresh on the new pipeline; and we still confirm the gibberish root cause — but empirically, *inside* the new stack's instrumentation, not by patching the old one.

**The real critical-path change:** M1 is now first, and its blocker is **owner account setup** (Deepgram + LiveKit Cloud + Fly.io). That account setup *is* the new "step 0." Everything below in this section (old Phase-0 detail) is retained only as reference for what the old pipeline did.

---

### (Reference only — superseded) Original Phase 0 — Stabilize + instrument

**Goal:** stop the gibberish for the user NOW, and capture telemetry so the rebuild targets the real cause — senior engineers instrument, they don't keep guessing. We've asked "audio vs words?" twice; Phase 0 answers it empirically.

### 0.1 Instrument one real failing session end-to-end
- **TTS:** log the exact text sent to ElevenLabs + returned byte length + content-type (already logs char count; add a debug capture of the first/last chunk sizes). Add a flag to **dump the synthesized MP3** for one session to storage for offline inspection.
- **Client playback:** record which path ran (`playStreamingAudio` MSE vs `playBuffered` blob), `MediaSource.isTypeSupported('audio/mpeg')` on the user's browser, and any `SourceBuffer`/audio element errors. Surface in a `/voice-agent/diagnostics` panel.
- **STT:** at a debug level (PII-aware), log the actual Whisper transcript next to the user's spoken intent so we can measure mis-transcription. Capture confidence if available.
- **Capture the user's exact environment:** browser + OS + device (Safari vs Chrome is decisive for MSE-MP3).

### 0.2 Targeted fixes (highest-probability, low-risk)
- **Default to blob playback** (`playBuffered`) on any browser where MSE-MP3 is unsupported/suspect; only use MSE where proven. Trades ~200–400ms first-audio for **reliable, non-garbled** audio. This is the most likely gibberish killer — ship it first behind a flag, then default-on if it clears.
- **Whisper accuracy:** add `language: "en"` + a **domain `prompt`** seeding carrier/product/jargon vocabulary (Foresters, Mutual of Omaha, term/whole/IUL, "annual premium", common client-name patterns). Cuts mis-transcription materially.
- **Sentence chunking to TTS:** verify the SSE→TTS sentence splitter isn't sending fragments that synthesize with broken prosody; buffer to clause/sentence boundaries.
- **Confirm `assistant-voice-stt`/`-tts` are deployed at HEAD** (the rate-limit add to STT is currently uncommitted — commit + deploy deliberately, not by accident).

### 0.3 Acceptance bar for Phase 0 (must pass before calling it "stabilized")
On **the user's actual device/browser**: 5 consecutive turns with (1) intelligible audio (no gibberish), (2) correct transcription of a numbers+names sentence ("what did I sell for the Gores this month"), (3) first-audio < 2s. Recorded as a short screen capture.

---

## 4. PHASE 1 — Realtime transport + streaming STT + turn-taking

1. **Stand up the Agent Worker** (LiveKit Agents, Node or Python) on Fly.io/Render; health-checked, autoscaled-to-1-warm.
2. **WebRTC client** in `/command-center` (LiveKit JS SDK) replacing MediaRecorder capture + MSE playback. Mic → audio track; assistant audio ← track (framework playout).
3. **Streaming STT (Deepgram Nova-2)** wired into the worker; partial + final transcripts; **keyword boosting** for carriers/products/names.
4. **Server VAD (Silero) + turn-detection** for correct endpointing.
5. **Brain bridge:** worker calls `assistant-orchestrator` (reuse SSE, tools, RLS, grounding) as the LLM node. No brain rewrite.
6. **Feature flag + parallel run:** new stack behind `assistant_preferences.voice_engine = 'realtime'`; old pipeline stays until cutover. Internal dogfood on Nick's account first.

---

## 5. PHASE 2 — Streaming TTS + barge-in + flawless playout

1. **Streaming TTS** (ElevenLabs Flash v2.5) inside the worker; synthesize as Claude streams sentences; play out over the WebRTC track (jitter-buffered by the framework — **no MediaSource**).
2. **Barge-in:** server VAD detects user speech during playout → instantly stop TTS, cancel in-flight Claude/tool work, flush, start listening. This is the single biggest "feels flawless" upgrade.
3. **Endpointing tuning:** silence-hold, min/max utterance, interrupt thresholds — tuned against the eval set (§8), not by feel.
4. **Cutover:** flip default to `realtime` once §8 SLOs hold for a week; keep the old path one release as fallback, then delete (no dead code per repo rules).

---

## 6. PHASE 3 — "Look up anything" (retrieval completeness)

**Principle (already proven with `queryPolicies`):** structured, RLS-scoped, allowlisted read tools per domain — never text-to-SQL (money/tenant/PII risk). Build the family so Jarvis can reach any of the user's data safely.

- **Tool family (mirror `queryPolicies`):** `queryClients`, `queryCommissions` (incl. chargebacks/advances), `queryLeads`, `queryRecruits`, `queryContracts/carrierRules`. Each: scope mine/team, filters, date ranges, SAFE column allowlist, exact counts + sums, RLS on `ctx.db`. (`queryPolicies` is the template — DONE this session.)
- **Planner:** the agent router already picks tools; add a light "decompose multi-part questions → multiple tool calls → synthesize" step for "the full picture" asks.
- **Semantic layer:** §7's RAG covers unstructured ("what did I say about client X", notes, call summaries).
- **Guardrail:** every new tool ships with the tenant-isolation smoke (`scripts/test-queryPolicies-tenancy.sh` is the template) + grounding tests.

---

## 7. PHASE 4 — The second brain (in-app RAG + knowledge graph + Obsidian export)

**Reality check first (the user asked "what happened to the Obsidian stuff"):** there is **no server-callable Obsidian API** — the Local REST/MCP plugin runs on-device and edge functions/workers can't reach a user's localhost. So "Jarvis lives in my Obsidian vault" isn't buildable server-side. The real-world equivalent (and what was designed, not yet built) is an **in-app knowledge store Jarvis owns, that gets smarter over time, with one-click export to your Obsidian vault.**

### 7.1 Storage + retrieval (greenfield, self-contained)
- `user_knowledge_entries` (RLS `user_id = auth.uid()`), `pgvector`, `embedding vector(1536)`.
- `embed-knowledge-entry` edge fn (OpenAI `text-embedding-3-small` or Voyage) on insert/update.
- `match_documents(query_embedding, k)` RPC (cosine, RLS-scoped).
- `searchUserKnowledge` tool + knowledge-aware agent; gated by `assistant_preferences.enabled_knowledge`.

### 7.2 Make it a GRAPH, not just flat vectors (the "knowledge graph" ask)
- Lightweight entity + relationship extraction (clients ↔ policies ↔ carriers ↔ interactions) into Postgres (`knowledge_entities`, `knowledge_edges`), so Jarvis can answer relational questions ("everything tied to the Gore household") and traverse, not just nearest-neighbor.
- Hybrid retrieval: structured entities + vector recall + the §6 query tools = "look up anything" + "remember everything."

### 7.3 Ingestion (how it gets smarter over time)
- In-app note/daily-log editor.
- **Voice daily-log:** reuse the realtime STT — talk to Jarvis, it files structured notes.
- Auto-ingest: opt-in capture of Jarvis's own grounded answers + the entities they touched, so context compounds.

### 7.4 Obsidian export (honest, one-click)
- "Export to Obsidian": `.zip` of `.md` files with **YAML frontmatter + `[[wikilinks]]`** mirroring the entity graph → the user drops it into their own vault. Re-runnable/incremental. No live API promised.

---

## 8. CROSS-CUTTING — testing, eval, observability ("no mistakes, no missing edge cases")

This is how senior teams guarantee quality; it runs through every phase.
- **Voice eval harness:** a fixed corpus of recorded utterances (accents, background noise, fast/slow, numbers, currency, carrier/client names, interruptions) → assert **WER < target**, correct tool calls, intelligible TTS (automated MOS proxy + spot human checks). Regression-gate every voice change.
- **Latency SLOs + dashboard:** per-turn p50/p95 for endpointing, STT, first-token, first-audio; alert on regressions. Correlate by `conversation_id` (already logged).
- **Brain regression suite:** extend the deno suite (now 95/0) — routing, grounding, tool correctness, the **follow-up-continuity** + **no-false-fabrication** cases (today's bug → permanent tests).
- **Tenant-isolation smokes** for every data tool (template exists).
- **Load/soak:** N concurrent voice sessions on the worker; verify warm-pool + autoscale.
- **Structured tracing** per turn (STT in, transcript, tool calls, tokens, TTS out, timings) for fast post-mortems.

## 9. Edge-case catalog (explicit — must each have a defined behavior + a test)
Barge-in mid-sentence · user silence / no-speech / accidental tap · overlapping speech · network drop + reconnect mid-turn · worker cold/restart · very long answers (chunk + allow interrupt) · numbers/dates/currency pronunciation · homophones & near-miss names · mic permission denied / no device · heavy background noise · STT low-confidence (ask to repeat, don't guess) · TTS/STT vendor outage (graceful spoken fallback) · tool error mid-turn (say so, don't fabricate) · **follow-up routing** (fixed today) · **never claim it fabricated real prior data** (fixed today) · multi-IMO/tenant isolation · rate-limit hit (spoken, graceful).

## 10. Cost / vendors (rough, to size budget)
- **LiveKit Cloud:** ~$ per participant-minute (free dev tier; self-host kills this later).
- **Deepgram Nova-2 streaming:** ~$0.0043–0.0077/min.
- **ElevenLabs Flash:** keep current plan; Flash is cheaper/faster than v2.
- **Agent worker host (Fly/Render):** ~$5–25/mo for a warm small instance, scales with concurrency.
- **Embeddings:** `text-embedding-3-small` ~$0.02/M tokens — negligible.
- Net: a small fixed worker cost + per-minute STT/transport + existing TTS. Sized for a handful of concurrent users to start; scales linearly.

## 11. Milestones / sequencing
- **M0 — days:** Phase 0 stabilize + instrument; Phase-0 acceptance bar green on Nick's device. *(stops the gibberish)*
- **M1 — 1–2 wks:** Agent worker + LiveKit + Deepgram streaming STT + turn-taking; brain bridged; flagged parallel run; Nick dogfoods.
- **M2 — ~1 wk:** Streaming TTS + barge-in + WebRTC playout; SLOs met for a week; cut over; delete old path.
- **M3 — ~1 wk:** Retrieval tool family (§6) + tenancy smokes.
- **M4 — 1–2 wks:** Second brain (§7) — RAG + graph + ingestion + Obsidian export.
- **Cross-cutting (§8) runs the whole time;** every phase ships with its evals/tests.

## 12. Decisions — LOCKED 2026-06-02 (owner delegated the call)
1. **STT = Deepgram Nova-2 (streaming).** Lowest latency for barge-in; **keyword boosting** directly fixes the carrier/client-name mis-hearing (Foresters, IUL, surnames); ~$0.0043/min; first-class LiveKit plugin. Keep Whisper-1 as a cheap fallback for resilience.
2. **Framework = LiveKit Agents (Node/TypeScript worker).** LiveKit **Cloud** for the WebRTC transport/SFU (generous free tier — most cost-effective at this scale; the hard real-time part is managed). A small **Node/TS** agent worker (`@livekit/agents` + `@livekit/agents-plugin-deepgram` + `-elevenlabs` + `-silero`) self-hosted on **Fly.io**, bridging to the existing Claude `assistant-orchestrator` over HTTP/SSE. **Refined Python→Node 2026-06-02:** the worker stays in the owner's native TypeScript so a solo dev can maintain it with no second toolchain — the Node Agents SDK is production-ready with the plugins we need; Python's marginal maturity isn't worth a polyglot codebase here. Self-host LiveKit later only if volume explodes.

### M1 build order (concrete) — env confirmed in `.env.local`: `LIVEKIT_URL/API_KEY/API_SECRET`, `DEEPGRAM_API_KEY`
1. **[DONE]** `supabase/functions/assistant-voice-livekit-token/` — mints the client's room token; identity = verified `auth.uid()` (LiveKit-signed), room `jarvis-<uid>`. Validated via `deno check` against `livekit-server-sdk@2`.
2. **Secrets:** set `LIVEKIT_API_KEY/SECRET/URL` as **Supabase** function secrets (for the token fn) and as **Fly** secrets (for the worker), plus `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, and `VOICE_WORKER_SECRET` on Fly. (Owner runs `supabase secrets set` / `fly secrets set`; values live in `.env.local`, never echoed.)
3. **Worker** (`/services/jarvis-voice-worker/`, Node): LiveKit Agents entrypoint → Silero VAD + turn detector → Deepgram STT (keyword-boost carriers/products/names) → **LLM node = a thin client that POSTs to `assistant-orchestrator`** (SSE) → ElevenLabs streaming TTS → barge-in. Register with LiveKit Cloud (auto-dispatch into `jarvis-*` rooms).
4. **Frontend** (`useAssistantVoiceSession.ts` rewrite or sibling): `@livekit/components-react` / `livekit-client` — fetch token from #1, join room, publish mic, play agent track. Delete the MediaRecorder + MediaSource path on cutover.
5. **Fly deploy** of the worker (`fly.toml`, Dockerfile, min-instances=1 warm).

### Worker → brain auth model (REVISED 2026-06-02 after security review — prior design REJECTED)
**REJECTED (CRITICAL-unsafe):** a shared `VOICE_WORKER_SECRET` + `x-user-id` header → orchestrator service-role-scopes tools to that id. Security review proved it fails OPEN across tenants:
- `queryPolicies` `scope:'team'` carries NO app-level `user_id` filter (only `scope:'mine'` adds one) — it relies 100% on RLS. Run it on a service-role client and a bare team query returns **every tenant's** policies + client names; `sumAllPremiums` sums the whole table.
- Under service-role, `auth.uid()` is NULL → even `scope:'mine'` loses its IMO intersection, AND the `revocation_deny` policy (`NOT is_access_revoked(auth.uid())`) stops applying — silently disabling the FFG/Founders **access kill switch**.
- The shared secret is a god-key (impersonate anyone), long-lived, no per-user revocation, no replay protection.

**ADOPTED — keep the user's real RLS-scoped JWT end to end:** the browser forwards the signed-in user's **Supabase JWT** to the worker over the LiveKit **data channel** (`canPublishData`, DTLS-encrypted; the `jarvis-<uid>` room is single-human by construction — only the user + the trusted worker). The worker then calls `assistant-orchestrator` with `Authorization: Bearer <user JWT>` EXACTLY as the browser does today → `ctx.db` stays RLS-scoped, the orchestrator's `db.auth.getUser(token)` identity derivation is unchanged, NO service-role for tools, NO god-secret, and `revocation_deny` keeps working. **Token refresh:** Supabase JWTs expire (~1h) and a voice session can outlive that — the browser pushes a refreshed token over the same data channel on each refresh; the worker swaps it for subsequent turns. (`VOICE_WORKER_SECRET` may still gate worker↔orchestrator as a service-to-service check, but NEVER as the user identity.) This keeps the `queryPolicies.ts` header invariant — "RLS is the ceiling regardless of any argument" — actually true on the voice path.

### Review-driven worker requirements (security + scalability review, 2026-06-02)
- **Voice rate-limit bucket (HIGH — blocks voice if missed):** the worker MUST NOT reuse the orchestrator's 30-req/hr per-user request bucket (`AI_REQ_MAX_PER_HOUR`) — a single voice user runs 10+ turns/min and would trip their own cap mid-conversation (and two tabs share the bucket). Give the voice path its OWN request bucket (e.g. `ratelimit:req:assistant-voice:<uid>`, ~300–600/hr), or exempt it from the request axis and rely on the per-user token-budget axis (200k/day) as the real spend ceiling.
- **Worker process isolation + scaling (MED — scaling):** run each room job in its OWN subprocess (LiveKit Agents job-per-process) so one room's CPU spike (Silero VAD / turn-detector inference) or crash can't block/kill others sharing the Node event loop. Set an explicit `max-jobs-per-worker`; autoscale horizontally on LiveKit worker-load / active-job-count with ≥1 warm. `min-instances=1` alone is a single point of failure, not a scaling plan. Derive the real sessions-per-instance number from the §8 soak test — do not fabricate a per-core figure.
- **Worker→orchestrator HTTP:** pooled keep-alive agent (not a fresh TCP+TLS per turn) + per-turn timeouts/backpressure so one slow turn can't starve other users.

### Deferred code fix (queryPolicies money path)
`sumAllPremiums` uses OFFSET pagination over a random-UUID `id` — not concurrency-stable (skip/double-count under a concurrent in-scope write at scope:'team' with >1000 matches; not a factor at current scale, and `premiumsComplete` does NOT flag it). Migrate to KEYSET (`.gt("id", lastId)` + `.limit`) — needs `gt()` added to `ToolSelectBuilder` and a rewrite of the offset-based `sumAllPremiums` test suite (do both in one pass). Comment in the code marks it.
3. **Budget ceiling = $200/month** for NEW voice infra (Deepgram + LiveKit + Fly worker + embeddings), on top of existing Claude/ElevenLabs/OpenAI spend. Expected actual at current Epic-Life scale: **~$50–90/mo**. Lever if it grows: self-host LiveKit (drops transport cost).
4. **Phase 0 = GREEN-LIT, start immediately.** Needs zero new vendors — builds in the existing codebase. Ship blob-playback default + Whisper `language`+domain-prompt + the diagnostics capture this week.

### What the owner must set up for M1 (accounts/keys — billing is theirs, can't be done for them)
- Deepgram account → API key. · LiveKit Cloud project → API key/secret + WS URL. · Fly.io account (for the worker). Provide these as edge/worker secrets when M1 starts; until then Phase 0 proceeds without them.

## 13. Immediate next actions (this/next session)
1. Build the **Phase-0 diagnostics panel** + capture ONE real failing session on Nick's device (answers audio-vs-words empirically).
2. Ship **blob-playback default + Whisper `language`+`prompt`** behind a flag; verify against the Phase-0 acceptance bar.
3. Spike the **Agent Worker** (LiveKit Agents "hello world" joining a room, bridged to `assistant-orchestrator`) to de-risk M1.
4. Commit the uncommitted `assistant-voice-stt` rate-limit change deliberately + deploy.

## 14. Related
Memory: `project_jarvis_querypolicies.md` (queryPolicies + the routing/grounding fixes shipped today), `project_jarvis_latency_fixes.md`, `project_jarvis_phase1_perf_databugs.md`. Prior vision notes: `~/.claude/plans/jarvis-is-super-slow-whimsical-scroll.md`. Voice files: `useAssistantVoiceSession.ts`, `assistant-voice-stt/`, `assistant-voice-tts/`, `assistant-orchestrator/`.
