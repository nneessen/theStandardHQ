# CONTINUE — Jarvis Voice Quality: get PRIMARY evidence before any more edits

**Branch:** `feat/jarvis-durable-memory`  •  **Date written:** 2026-06-05
**Status:** Hardening work is CODE-COMPLETE but **UNPROVEN and UNCOMMITTED**. The
user-facing problem is **STILL BROKEN**. Do **NOT** make another code/deploy change
until primary evidence is in hand (see the hard rule below).

---

## The one thing that matters

The owner uses Jarvis voice daily and after a full hardening pass it is **still broken**.
Their last report (verbatim):

> "When I open Jarvis, it's supposed to immediately start at the voice session and that
> screen just disappeared instantly. It's still not working. Also still sounds like
> fucking gibberish constantly and then you can't even fucking tell Jarvis to stop
> talking. I thought we had something where we could interject or interrupt."

Three distinct symptoms, all unsolved:
1. **Voice session screen disappears instantly** on opening Jarvis (frontend / mount).
2. **Gibberish constantly** (audio you can't make words out of).
3. **No barge-in** — can't interrupt Jarvis while it's talking.

The user has been told "fixed" before and it wasn't. Treat **listen-loop on real prod
usage** as the only acceptance gate. Green unit tests do NOT mean fixed.

---

## HARD RULE for the next session (from the advisor — do not skip)

**No more blind edits or deploys.** Every "no session reached the worker" inference last
session came from a **lying log**: `fly logs --no-tail` returns STALE cached logs (it
showed the same 21:20 session for hours while the user was actively hearing audio). I
burned the whole session reasoning from that artifact.

Before touching code, collect primary evidence:

### A. Ask the user three discriminating questions
1. **Which frontend are you testing on** — your normal prod site (thestandardhq.com), or
   `localhost:3000` via `bash scripts/dev-voice-prod.sh`?
2. **Is the gibberish** (a) garbled/robotic audio you can't make words out of → points at
   the **audio pipeline (sample-rate / encoding / streaming format)**, OR (b) a clear
   voice saying the **wrong words** → points at the **text layer** (already addressed)?
3. **What is the exact browser-console error** at the moment the voice screen disappears?
   (Open DevTools → Console, reproduce, copy the red error + the failing request URL.)

### B. Capture ONE real session with a LIVE log stream (not `--no-tail`)
```bash
# Stream (NOT --no-tail) into a file in the background, then have the user reproduce ONCE.
fly logs --app standardhq-jarvis-voice
```
Run it via the Bash tool with `run_in_background: true`, have the user start one voice
session and speak one query, then read the captured task output. Look specifically for:
- `[jarvis] llmNode invoked … text="…"` — confirms which worker/model ran and the
  **actual synthesized text** (proves text layer vs audio layer).
- ElevenLabs / Deepgram connection lines, sample-rate, any TTS error.
- `adaptive interruption is disabled by default in production mode` (barge-in cause).

One clean capture + the three answers collapses most of the uncertainty. Do not deploy
again without it.

---

## Reframed hypotheses (what to actually investigate, per advisor)

### 1. Gibberish → AUDIO PIPELINE, not text (likely the wrong layer was fixed)
"Gibberish **constantly**" on a brand-new TTS model (`eleven_multilingual_v2`) is the
tell. The text-normalization work (markdown strip, numbers→words) only fixes **wrong
words**, not **garbled audio**. The audio path was **never touched**. Check:
- ElevenLabs plugin **output encoding / sampleRate** vs what the LiveKit room/track
  expects (mismatch → chipmunk/garbled). Inspect the TTS construction in
  `services/jarvis-voice-worker/src/agent.ts` (~line 263-270) and the plugin defaults.
- Whether the stream format the plugin emits matches the AgentSession output sample rate.
- This is the **prime suspect**. Confirm with the log capture + the user's answer to Q2.

### 2. Screen disappears instantly → frontend mount / auto-start
Need the URL (Q1) + console error (Q3) first. Candidate areas:
- `src/features/assistant/AssistantPage.tsx` — the immersion auto-start / engine-select.
- `src/features/assistant/hooks/useJarvisVoiceSession.ts` — `AGENT_READY_TIMEOUT_MS`
  watchdog (12s) and `mapAgentState`; a thrown error or an unhandled rejection on
  `start()` could unmount the immersion.
- `src/features/assistant/components/VoiceImmersion.tsx` — what dismisses it.
Get the console error before guessing.

### 3. Barge-in → enable interruption (currently OFF)
Log line already found: **"adaptive interruption is disabled by default in production
mode."** In `@livekit/agents@1.4.5` interruption must be explicitly enabled on the
`AgentSession` (and AEC/turn-detection must be warmed). Investigate the AgentSession
construction in `agent.ts` and enable interruption + verify the VAD/turn-detector is
wired so the user's speech actually interrupts TTS. Verify against the installed SDK
version's API (`node_modules/@livekit/agents`), don't assume the option name.

---

## What is already in the working tree (code-complete, UNPROVEN, UNCOMMITTED)

All from Steps 1–4 of the plan
(`/Users/nickneessen/.claude/plans/i-ve-been-using-jarvis-foamy-clarke.md`). Nothing
committed yet.

**Worker (`services/jarvis-voice-worker/src/`):**
- `agent.ts` — TTS `eleven_turbo_v2_5`→`eleven_multilingual_v2` + `voiceSettings`
  `{stability:0.5, similarity_boost:0.75, use_speaker_boost:true}`; room-owner regex
  case-fold fix (dropped `/i`); empty-STT guard; `llmNode` wraps orchestrator in
  `normalizeSpeechStream`; lifecycle guards (participantDisconnected→shutdown when
  `remoteParticipants.size===0`, 30-min maxTimer, `ctx.room.off` in shutdown,
  `jobMemoryLimitMB:700`/`jobMemoryWarnMB:500`).
- `speech-text.ts` (NEW) — `toSpokenText` (markdown strip + number/currency/percent) +
  `normalizeSpeechStream` (sentence-buffered streaming, O(n) `scanned` offset). 4-digit
  regex `/(?<![\dA-Za-z,.])\d{4,}(?![\dA-Za-z,.])/g`. 21 worker tests pass.
- `speech-text.test.ts` (NEW) — passing.
- `orchestrator-bridge.ts` — `HANG_GUARD_MS` 45s→28s.

**Orchestrator (`supabase/functions/assistant-orchestrator/`):**
- `core/agents.ts` — `VOICE_OUTPUT_DIRECTIVE` const; `buildSystemPrompt(agent, name, now,
  memory, isVoiceSurface)` appends it last.
- `core/rateBucket.ts` — `tokenRateBucket()`, `TOKEN_MAX_PER_DAY_TYPED=200_000`,
  `TOKEN_MAX_PER_DAY_VOICE=500_000`.
- `index.ts` — `CACHE_READ_COST_WEIGHT=0.1` (cache_read weighted in tokensUsed),
  `VOICE_MAX_TOKENS_PER_TURN=600`, `tokBucket=tokenRateBucket(...)` at preflight+report,
  `isVoiceSurface`→buildSystemPrompt, wall-time cap warn.
  **NOTE: index.ts has 6 PRE-EXISTING deno-check errors (underwriting types) unrelated to
  these changes — do not chase them.**
- `core/__tests__/agents.test.ts` (NEW).

**Frontend (`src/features/assistant/`):**
- `hooks/useJarvisVoiceSession.ts` — `mapAgentState(undefined)`→"checking";
  `AGENT_READY_TIMEOUT_MS=12000` watchdog in `start()`; clears on real state; no-regress
  guard.
- `components/VoiceImmersion.tsx` — CAPTION "CONNECTING"; HINT map; waveform mic-reactive
  only when listening; reactor `level` gated on `hearing`.
- `components/VoiceOrb.tsx` — labels; `isActive` includes "checking".
- `AssistantPage.tsx` — `useKeepWarm(voiceEnabled, !realtimeEnabled)`; `voiceHearing`
  gates audioLevel sampling.
- `hooks/useKeepWarm.ts` — `ORCHESTRATOR_TARGET` on both paths; `LEGACY_VOICE_TARGETS`
  only when `includeLegacyVoice`.

**Shared / scripts:**
- `supabase/functions/_shared/cors.ts` — ALLOWED_ORIGINS fixed list (thestandardhq.com +
  localhost:5173/3000/3001 only; NOT Vercel previews).
- `scripts/dev-voice-prod.sh` (NEW) — runs Vite against PROD Supabase so localhost:3000
  reaches the deployed Fly worker. Verified to serve the prod URL.

**Deferred (do NOT do yet):** Step 5 (delete legacy + flip `voice_engine` default) — keep
the legacy fallback until realtime is proven good on the owner's real usage.

---

## Hard constraints (project rules — never violate)
- **Migrations:** ONLY `./scripts/migrations/run-migration.sh <file>` /
  `./scripts/migrations/run-sql.sh "..."`. NEVER `psql` directly. Runner DEFAULTS TO LOCAL
  — prefix `DATABASE_URL="$REMOTE_DATABASE_URL"` for prod (source `.env`).
- **`src/types/database.types.ts`:** never read whole (~162k tokens; hook blocks it). Use
  `node scripts/dbtype.mjs <name>` or `--list`.
- **Types sync:** if schema changes, regen from PROD `--project-id pcyaqwodnyrpkaiojnpz`,
  never `--local` (local DB drifted).
- Naming: Components PascalCase, files kebab-case, fns/vars camelCase. No new files left
  alongside old ones. No mock data in prod code.
- Edge deploy is owner-gated (flyctl + supabase). Do not assume a deploy happened.

## Verification (when you DO get to changes)
- Worker: `cd services/jarvis-voice-worker && npm run typecheck && npm test`
- Orchestrator: `deno test` in `supabase/functions/assistant-orchestrator/core`
  (ignore the 6 pre-existing underwriting deno-check errors in index.ts).
- Frontend: `npx tsc --noEmit && npm run build` (zero errors).
- **Acceptance = deploy worker + orchestrator, then LISTEN on real prod usage.** Money +
  percent query ("what's my premium and persistency"): numbers spoken naturally, no
  garbled audio, you can interrupt mid-sentence, screen stays up, multi-minute session
  does not 429.

## Relevant memory
- `project_jarvis_voice_quality_harden_20260604.md` (this work — marked UNPROVEN)
- `project_jarvis_voice_livekit_creds_invalid.md` (the 3-bug fix chain; voice DID work
  end-to-end once — STT→llmNode→TTS proven Jun 3)
- `project_jarvis_querypolicies.md`, `project_edge_deploy_safety_and_download_clobber.md`

---

## FIRST ACTION next session
Do **A** and **B** above (three questions + one live-stream log capture). Read the capture
for `llmNode invoked … text="…"`. Only then decide which of the three symptom hypotheses to
fix first. **No code edits, no deploy, until that evidence is in hand.**
