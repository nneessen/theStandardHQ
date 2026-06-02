# jarvis-voice-worker

Realtime voice worker for Jarvis (M1 of the voice rebuild). A standalone Node service that
runs the LiveKit Agents pipeline — **Silero** VAD/turn-detection → **Deepgram** STT →
**the Claude `assistant-orchestrator`** (your existing brain) → **ElevenLabs** TTS — with
barge-in. It is deployed separately from the app (Supabase/Vercel) because realtime audio
needs an always-on, stateful process, which edge functions are not.

See the full design in
`../../plans/active/continue-20260602-jarvis-voice-secondbrain-master-plan.md`.

## Security model (do not change without re-reading the review)

The worker holds **no service role** and **never impersonates** via a header. Each user's
browser sends that user's **Supabase JWT** over the LiveKit **data channel**
(`{"type":"auth","jwt":"…"}`, re-sent on every ~1h refresh). The worker calls the
orchestrator with **that JWT**, so `ctx.db` stays RLS-scoped exactly like the typed path
and the `revocation_deny` kill switch keeps working. (`src/orchestrator-bridge.ts`.)

## Status — boots + builds; live STT→brain→TTS turn blocked on valid LiveKit creds

- ✅ `src/orchestrator-bridge.ts` — SSE bridge to `assistant-orchestrator` (final, SDK-agnostic).
  Tags each turn `x-jarvis-surface: voice` so the orchestrator uses the voice rate-limit bucket.
- ✅ `src/agent.ts` — worker entrypoint + pipeline + JWT/data-channel store, reconciled to the
  real `@livekit/agents@1.4.5` API: bridges via a `voice.Agent` `llmNode()` override (returns a
  `ReadableStream<string>` of the orchestrator's deltas — 1.x `LLMStream` has no public text
  adapter), `ChatContext.items`, `ServerOptions`. STT = Deepgram **`nova-2-general`** with
  weighted `keywords` boosting (NOT nova-3 — nova-3 ignores `keywords` in favor of unweighted
  `keyterm`, dropping the carrier/product/name boosts; see the comment in `agent.ts`).
- ✅ **Runtime init verified** — `npm run dev` starts the worker, loads all four plugins, and
  registers/listens (LiveKit 1.4.5). `npm ci` → 0 vulns; `typecheck` + `build` → green. The
  Docker image builds and bakes the Silero/turn-detector weights (`livekit-agents download-files`).
- ⛔ **Live turn blocked on credentials.** The LiveKit API key/secret currently in `.env.local`
  (and in the deployed token endpoint's Supabase secret) are **rejected by LiveKit Cloud with
  401 "invalid token"** for `standard-hq-wz8p7ono.livekit.cloud` — verified via worker WS
  registration, `RoomServiceClient.listRooms`, and a swapped-pair retry. No client can join and
  the worker can't register until a **valid** key/secret for that project is set in all three
  places (`.env.local`, the Supabase function secret, and `fly secrets`). Also set a real
  `ELEVENLABS_API_KEY` (the local placeholder won't synthesize).

## Next steps (the path to first audio)

Done this session: ✅ runtime-init smoke · ✅ Docker image builds + bakes weights · ✅ voice
rate-limit bucket wired (orchestrator + this bridge) · ✅ **frontend client built**
(`src/features/assistant/hooks/useJarvisVoiceSession.ts`: token → join → publish mic → publish
the user JWT addressed to the agent identity only (reliable, re-sent on the join race + every
~1h token refresh) → play the agent track; gated behind `assistant_preferences.voice_engine =
'realtime'`, opt-in toggle in the assistant settings sheet). Remaining is **owner-gated**:

1. **Fix the LiveKit credentials** (see the ⛔ above) — set a valid key/secret for
   `standard-hq-wz8p7ono` in `.env.local`, the Supabase function secret, AND `fly secrets`.
2. `flyctl auth login`, then deploy (below).
3. Live first-audio smoke from `/command-center` with `voice_engine='realtime'`.

The JWT hand-off security invariant is already implemented on both ends: the client publishes
`{type:auth,jwt}` **addressed to the agent identity only** (never a broadcast) over the reliable
data channel, and the worker binds the JWT `sub` to the LiveKit-signed room owner before using it.

## Deploy (Fly)

```bash
fly launch --no-deploy            # creates the app from fly.toml (first time)
fly secrets set LIVEKIT_URL=… LIVEKIT_API_KEY=… LIVEKIT_API_SECRET=… \
               DEEPGRAM_API_KEY=… ELEVENLABS_API_KEY=… \
               SUPABASE_URL=… SUPABASE_ANON_KEY=…
fly deploy
fly scale count 1                 # keep ≥1 warm; raise for concurrency
```

**Scaling (per the review):** set `maxJobs` in `WorkerOptions` and run each room job in its
own subprocess (job-per-process) so one room can't block others; autoscale on LiveKit
worker-load. Voice also needs its **own** orchestrator rate-limit bucket (the 30/hr cap
would trip mid-conversation) — wire that when you add the worker→orchestrator path's limit.
