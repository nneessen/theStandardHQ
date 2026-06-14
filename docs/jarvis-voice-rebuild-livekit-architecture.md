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
            ├ Deepgram STT nova-2-general (streaming, weighted-keyword boost for carriers/products/names)
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

## Status (2026-06-02, M1 frontend+infra session)

- ✅ **Token endpoint** `assistant-voice-livekit-token` — deployed; warm-200 + 401-on-unauth.
- ✅ **Worker** `services/jarvis-voice-worker/` — `npm ci` (0 vulns), typecheck + build green
  vs `@livekit/agents@1.4.5`; **runtime-init verified** (`npm run dev` starts, loads all four
  plugins, registers/listens) and the **Docker image builds end-to-end** with model weights
  baked (`livekit-agents download-files`).
- ✅ **Frontend realtime client** `src/features/assistant/hooks/useJarvisVoiceSession.ts` —
  `livekit-client` hook: mint token → join → publish mic → publish the user's Supabase JWT
  **addressed to the agent identity only** (reliable; re-sent on the worker-registration join
  race + every ~1h token refresh) → play the agent track; mic-only analyser for the visualizers;
  UI state derived from the verified `lk.agent.state` participant attribute. Gated behind
  `assistant_preferences.voice_engine = 'realtime'` (new column, prod-migrated; opt-in toggle in
  the assistant settings sheet). The legacy MediaRecorder/MediaSource hook stays for `legacy`
  users and is deleted only at cutover. Both hooks are called unconditionally (React rules) and
  the UI selects one — `tsc`, eslint, and the assistant unit suite are green.
- ✅ **Voice rate-limit bucket** — the worker bridge tags turns `x-jarvis-surface: voice`; the
  orchestrator routes them to `ratelimit:req:assistant-voice:<uid>` at 600/hr (vs the 30/hr
  typed cap) so a 10+-turn/min spoken session never self-throttles; the 200k/day token axis
  stays the real cost ceiling. New deno tests; full orchestrator suite 105/0.
- ⛔ **BLOCKED on LiveKit credentials → no first audio yet.** The API key/secret in `.env.local`
  (and in the deployed token endpoint's Supabase secret — same key `APIHeZgZXPh5xwJ`) are
  **rejected by LiveKit Cloud with 401 "invalid token"** for `standard-hq-wz8p7ono` — proven via
  worker WS registration, `RoomServiceClient.listRooms`, and a swapped-pair retry. (Local token
  signing never validated them; this session's worker smoke was the first real exercise.) Until a
  **valid** key/secret for that project is set in `.env.local` + the Supabase function secret +
  `fly secrets`, no client can join. Also needs a real `ELEVENLABS_API_KEY` and `flyctl auth login`.
- ⏭️ **Remaining (owner-gated):** fix creds → `fly deploy` + `fly scale count 1` → live
  first-audio smoke against the §5 "awesome" bar → flip default to `realtime` → delete legacy path.

## Second brain — DROPPED (Jun 13 2026)

The in-app per-user `pgvector` RAG + knowledge graph + one-click Obsidian export concept was
deliberately cut from scope. It was never built. (The shipped `jarvis_memory` durable-preferences
memory is unrelated and remains.)
