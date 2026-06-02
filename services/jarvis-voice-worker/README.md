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

## Status — scaffold (this commit)

- ✅ `src/orchestrator-bridge.ts` — SSE bridge to `assistant-orchestrator` (final, SDK-agnostic).
- ✅ `src/agent.ts` — worker entrypoint + pipeline wiring + JWT/data-channel store.
- ⚠️ **The `@livekit/agents` symbol/API specifics are written to the AgentSession pattern
  and must be verified after `npm install`** (this framework's Node API moves between minor
  versions). `npm run typecheck` will surface any renamed symbols — reconcile against the
  resolved types in `node_modules/@livekit/agents`. The bridge + auth flow are not affected.

## Next steps (the path to first audio)

```bash
cd services/jarvis-voice-worker
npm install                      # pins @livekit/agents + plugins; creates package-lock
npm run typecheck                # reconcile any SDK symbol drift in src/agent.ts
cp .env.example .env.local       # fill from the repo-root .env.local (LIVEKIT_*, DEEPGRAM,
                                 # ELEVENLABS, SUPABASE_URL, SUPABASE_ANON_KEY)
npm run dev                      # runs the worker against LiveKit Cloud in dev mode
```

Then build the **frontend client** (replace `src/features/assistant/hooks/useAssistantVoiceSession.ts`):
fetch a token from `assistant-voice-livekit-token`, join the room with `livekit-client`,
publish the mic, **publish the user's Supabase JWT over the data channel**, and play the
agent's audio track.

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
