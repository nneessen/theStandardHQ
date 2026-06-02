# Jarvis voice rebuild — LiveKit realtime architecture (2026-06-02)

Durable record of the Jarvis (Command Center assistant) realtime-voice rebuild and the
companion data-completeness work. Full execution plan: `plans/active/continue-20260602-jarvis-voice-secondbrain-master-plan.md`. Worker: `services/jarvis-voice-worker/`.

## Why the old voice failed (the core insight)

A flawless voice agent is a **persistent, streaming, low-latency system**. The previous
implementation was a **stateless request/response pipeline on Supabase Edge Functions**:
batch OpenAI Whisper STT (record → stop → upload → transcribe), the Claude orchestrator
over SSE, ElevenLabs TTS, and **hand-rolled `MediaSource` MP3 playback in the browser**.
That substrate mismatch is the root of the gibberish, latency, "stuck listening," and the
lack of barge-in — edge functions (stateless, cold-start-prone, HTTP not WebRTC) are the
wrong place for realtime audio, and browser MSE-for-`audio/mpeg` is the likely source of
"garbled audio you can't hear."

## Architecture decision (locked)

Keep the good parts — the **Claude `assistant-orchestrator` brain (tools, grounding, RLS),
ElevenLabs voice** — and move the media/transport/turn-taking onto a real framework:

```
Browser ⇄ WebRTC ⇄ Agent Worker (LiveKit Agents, Node, always-on on Fly.io)
            ├ Silero VAD + turn-detection (correct endpointing)
            ├ Deepgram STT nova-3 (streaming, keyword-boosted for carriers/products/names)
            ├ "LLM" = the existing assistant-orchestrator (Claude, unchanged) via SSE
            ├ ElevenLabs TTS (streaming)
            └ barge-in
```

- **Build-vs-buy:** LiveKit Cloud for the WebRTC transport (managed, free tier) + a self-run
  **Node** agent worker (`@livekit/agents@1.4.5`). Node (not Python) keeps it in the owner's
  TS stack for solo maintenance. Deepgram Nova-3 over Whisper for streaming + keyword boosting.
- **The worker is a NEW always-on process** (Fly.io) because realtime audio needs a persistent,
  stateful, warm process — not an edge function. It bridges to the orchestrator over HTTP/SSE,
  so the brain/tools/RLS are reused unchanged. In 1.x the bridge is a `voice.Agent` subclass
  overriding `llmNode()` to return a `ReadableStream<string>` of the orchestrator's deltas
  (1.x `LLMStream` has no public text adapter).

## Worker → brain auth (CRITICAL — the rejected design and the adopted one)

**REJECTED:** a shared `VOICE_WORKER_SECRET` + `x-user-id` header → orchestrator
service-role-scopes tools to that id. A security review proved it **fails OPEN across
tenants**: `queryPolicies scope:'team'` carries NO app-level user filter (it relies 100% on
RLS), so under a service-role client a bare team query returns **every tenant's** policies +
client names; and under service-role `auth.uid()` is NULL, which also **disables the
`revocation_deny` access kill-switch** the Founders/FFG sunset depends on. The shared secret
is also a god-key (impersonate anyone).

**ADOPTED:** the browser forwards the signed-in user's **Supabase JWT over the LiveKit data
channel** (`{type:auth,jwt}`, re-sent on each ~1h refresh; the room is single-human by
construction). The worker calls the orchestrator with **that JWT**, so `ctx.db` stays
RLS-scoped exactly like the typed path and `revocation_deny` keeps working — no service-role,
no god-secret. Defense-in-depth: the worker binds the JWT's `sub` to the room owner (parsed
from the LiveKit-signed room name) and rejects a mismatch. The frontend MUST publish the JWT
**addressed to the agent identity only** (`publishData` broadcasts by default).

## Other load-bearing decisions

- **Per-session rooms** `jarvis-<uid>-<sessionUuid>` (not per-user): same user in two tabs
  was being EVICTED by LiveKit identity collision; identity stays `= auth.uid()` so worker
  trust is intact.
- **Voice rate-limit:** the orchestrator's 30-req/hr per-user request cap would trip
  mid-conversation (10+ turns/min); the voice path needs its own higher bucket.
- **Worker scaling:** job-per-process isolation + `maxJobs` + autoscale (no SPOF); the heavy
  ML (STT/TTS) is cloud-offloaded but Silero VAD/turn-detection runs per-room on worker CPU.

## Companion data work (the "no data gaps" demand)

- **`queryPolicies` tool** — flexible, RLS-scoped LIST/COUNT/FILTER over the `policies` table
  for self/team (status, lifecycle, product, date), exact count + full-coverage AP/IP sums +
  client name + per-policy detail; SAFE-column allowlist (no contact PII); `dateField`/`product`
  enum allowlisted server-side. NOT text-to-SQL (money/tenant safety). Shipped + deployed.
- **Agent continuity + grounding fixes** — a follow-up ("yes") was re-routing to a default
  agent lacking the policy tool, which then **falsely told the user it had "made up" real
  data**. Fixed: `routeToAgent` keeps the prior turn's specialist on a no-intent follow-up;
  grounding rules forbid disavowing a prior tool-backed answer.

## Status (2026-06-02)

- ✅ **Token endpoint** `assistant-voice-livekit-token` — deployed; warm-200 + 401-on-unauth.
- ✅ **Worker scaffold** `services/jarvis-voice-worker/` — `npm ci` (0 vulns), typecheck +
  build green against `@livekit/agents@1.4.5`; security + supply-chain reviewed/hardened.
  **NOT runtime-verified** (needs a live LiveKit room + the frontend client).
- ⏭️ **Frontend LiveKit client** (replace `useAssistantVoiceSession.ts`) → **Fly deploy** →
  first runtime smoke → cut over (delete the MediaRecorder + MediaSource path).

## Second brain (planned, not built)

In-app per-user `pgvector` RAG + a knowledge graph (entities + relationships) that learns over
time, with one-click **Obsidian export** (there is no server-callable Obsidian API — the plugin
is on-device — so true live two-way sync isn't buildable; export is the real equivalent).
