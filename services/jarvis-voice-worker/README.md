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

## Status — type-checks against @livekit/agents 1.4.5 (not yet runtime-verified)

- ✅ `src/orchestrator-bridge.ts` — SSE bridge to `assistant-orchestrator` (final, SDK-agnostic).
- ✅ `src/agent.ts` — worker entrypoint + pipeline + JWT/data-channel store, **reconciled to
  the real `@livekit/agents@1.4.5` API**: bridges via a `voice.Agent` `llmNode()` override
  (returns a `ReadableStream<string>` of the orchestrator's deltas — 1.x `LLMStream` has no
  public text adapter), `ChatContext.items`, `ServerOptions`, Deepgram `nova-3`.
  `npm ci` → 0 vulns; `npm run typecheck` → 0 errors; `npm run build` → emits `dist/`.
- ⚠️ **Not runtime-verified.** Type-checking ≠ running — the worker needs a live LiveKit room
  + the frontend client publishing the JWT over the data channel + a real STT→brain→TTS turn.
  That smoke can't happen until the frontend client + Fly deploy land.

## Next steps (the path to first audio)

Done: ✅ `npm ci` (0 vulns) · ✅ `npm run typecheck` (0 errors) · ✅ `npm run build`. Remaining:

```bash
cd services/jarvis-voice-worker
cp .env.example .env.local       # fill from the repo-root .env.local (LIVEKIT_*, DEEPGRAM,
                                 # ELEVENLABS, SUPABASE_URL, SUPABASE_ANON_KEY)
npm run dev                      # run the worker against LiveKit Cloud (first RUNTIME smoke)
```

Then build the **frontend client** (replace `src/features/assistant/hooks/useAssistantVoiceSession.ts`):
fetch a token from `assistant-voice-livekit-token`, join the room with `livekit-client`,
publish the mic, and play the agent's audio track.

**Security requirement for the JWT hand-off (do not skip):** publish the user's Supabase JWT
over the data channel **addressed to the agent participant's identity only, with reliable
delivery** — `publishData` defaults to an unaddressed BROADCAST to all participants, so always
pass the explicit destination. Re-publish on every ~1h token refresh (the worker swaps it).
The worker already binds the JWT's `sub` to the room owner (`agent.ts`), but addressed
delivery keeps the token off any other participant's wire in the first place.

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
