# Continuation — Jarvis Voice Session

Updated 2026-05-28. Worktree: `/Users/nickneessen/projects/commissionTracker-jarvis`,
branch `feat/assistant-command-center`. Migration runner only — never psql.

## Architecture decision (made with the user, live-priced)

**Option A pipeline + ElevenLabs voice**, both STT and TTS server-side:

```
mic → (browser records utterance, hands-free VAD turn-taking)
    → assistant-voice-stt  (OpenAI Whisper, server-side)        → transcript
    → assistant-orchestrator (Claude, UNCHANGED — 13 agents, M1/M2/H1 guards)
    → assistant-voice-tts  (ElevenLabs streaming, server-side)  → audio
    → browser plays the reply, then resumes listening
```

Why: reuses the entire verified Claude brain + security boundary untouched. Both
the user's speech (Whisper) and the reply voice (ElevenLabs) stay inside our trust
boundary — consistent with the M1 PII stance. The user explicitly rejected browser
Web Speech STT because it streams raw mic audio to Google.

Cost (verified May 2026): Whisper $0.006/min (pennies); ElevenLabs turbo
`eleven_turbo_v2_5` ~$0.09–0.23 per spoken reply. TTS char count is capped at 2000
server-side and logged (count only, no text) for cost visibility.

## DONE this session — voice pipeline built + validated (NOT deployed)

All built, `deno check` clean, `npm run build` zero errors, 47 orchestrator safety
tests + 8 new sanitizer tests + 7 assistant Vitest tests all pass.

**Edge functions (Deno):**
- `supabase/functions/assistant-voice-stt/index.ts` — NEW. Auth + Epic gate,
  accepts multipart `file`, calls Whisper `whisper-1`, returns `{text}`. Caps at
  8MB, never logs audio/transcript. Returns `{available:false}` if `OPENAI_API_KEY`
  missing.
- `supabase/functions/assistant-voice-tts/index.ts` — NEW (replaces the deleted
  `assistant-voice-token` stub). Auth + Epic gate, `{probe:true}` returns
  `{available}`, otherwise sanitizes text → ElevenLabs `/stream` → passes through
  `audio/mpeg`. Caps 2000 chars, logs char count only (no text). `ELEVENLABS_API_KEY`,
  optional `ELEVENLABS_VOICE_ID` (default Rachel `21m00Tcm4TlvDq8ikWAM`).
- `supabase/functions/assistant-voice-tts/spoken-text.ts` — NEW. Pure
  markdown→speech normalizer (strips `*_#`, unwraps code/links, "$1.5M"→"1.5 million
  dollars", "%"→"percent", bullets→clauses). Isolated from `index.ts` so it's
  offline-testable. Tests in `__tests__/spoken-text.test.ts`.
- `supabase/functions/_shared/assistant-voice-auth.ts` — NEW. Shared
  `authorizeVoiceCaller(req)` (JWT + Epic-Life gate via orchestrator `access.ts`),
  used by both voice fns.
- DELETED `supabase/functions/assistant-voice-token/` (the stub).

**Frontend:**
- `src/features/assistant/hooks/useAssistantVoiceSession.ts` — REWRITTEN from stub
  to a real pipeline: getUserMedia (echo-cancel/noise-suppress), Web Audio
  AnalyserNode VAD for hands-free turn-taking (speech starts capture; ~1.1s silence
  ends it), MediaRecorder per utterance, STT→`onUtterance`→TTS→playback loop, pauses
  capture during playback to avoid echo, restarts listening after each reply. State:
  `idle|checking|unavailable|listening|capturing|thinking|speaking`. On-mount
  availability probe (gated behind `voice_enabled`). Exposes
  `AssistantVoiceSession` type.
- `src/features/assistant/AssistantPage.tsx` — refactored the single send path into
  `runMessage(text): Promise<string|null>` shared by typed text AND spoken
  utterances; instantiates the voice session (`onUtterance: runMessage`,
  `enabled: prefs.voice_enabled`) and passes it down.
- `src/features/assistant/components/VoiceOrb.tsx` — REWRITTEN to a controlled,
  animated component: click to start/stop, sky pulsing halo while listening, green
  glow + sound-wave bars while speaking, spinner while thinking, mic-off +
  toast-reason when unavailable.
- `src/features/assistant/components/CommandCenterLayout.tsx` — forwards the `voice`
  prop to `VoiceOrb`.
- `src/features/assistant/components/AssistantSettingsSheet.tsx` — the Voice toggle
  is now live, wired to the `voice_enabled` preference (was disabled "coming soon").

UX model: web browsers require ONE user gesture for mic + audio autoplay, so the
session starts by clicking the orb once; after that it's fully hands-free
(continuous listen→reply→listen) until you click to stop. True wake-word ("Hey
Jarvis") with NO initial click needs a native app or an always-on in-tab listener —
deferred (see below).

## DEPLOY CHECKLIST — do NOT run without the user's OK (prod ref `pcyaqwodnyrpkaiojnpz`)

1. Set secrets:
   - `supabase secrets set OPENAI_API_KEY=... --project-ref pcyaqwodnyrpkaiojnpz`
   - `supabase secrets set ELEVENLABS_API_KEY=... --project-ref pcyaqwodnyrpkaiojnpz`
   - (optional) `ELEVENLABS_VOICE_ID=...` to override the default voice.
2. Deploy both fns WITH jwt verification (default; do NOT pass `--no-verify-jwt`):
   - `supabase functions deploy assistant-voice-stt --project-ref pcyaqwodnyrpkaiojnpz`
   - `supabase functions deploy assistant-voice-tts --project-ref pcyaqwodnyrpkaiojnpz`
3. Delete the now-orphaned old fn (renamed away from `assistant-voice-token`):
   - `supabase functions delete assistant-voice-token --project-ref pcyaqwodnyrpkaiojnpz`
4. Live E2E: enable Voice in settings → click orb → speak a briefing request →
   confirm transcript appears, reply renders, and reply is spoken. Watch fn logs for
   the `assistant-voice-tts ... chars=` cost line.

NOTE on local testing: dev currently points at PROD Supabase (`.env.local`), so
`supabase.functions.invoke`/fetch from the dev server hits PROD edge fns. The voice
fns will 404 until step 2 is deployed (or run `supabase functions serve` locally
with the secrets exported). No DB migration was added, so there's nothing to apply.

## Temporary state to clean up (carry forward)

- **`.env.local`** (gitignored) points local dev at PROD Supabase
  (`VITE_USE_LOCAL=false`, `VITE_ALLOW_REMOTE_SUPABASE_DEV=true`). Delete to revert
  dev to local Supabase.
- **Test client** on PROD: `clients` id `d072a7de-225d-4e55-ae45-9d1d6c55642b`
  ("Jarvis Test Client (Nick)"). Creating it fired a Close CRM sync — deleting may
  need Close-side cleanup. Keep while testing; delete when done.

## STILL PENDING (separate from the core voice pipeline)

1. **Wake-word / double-clap activation** (the "no initial click" layer). Needs a
   decision: Picovoice Porcupine wake-word (requires a Picovoice access key + bundled
   model) vs a self-contained Web Audio double-clap detector (no key, less precise).
   Gate behind `voice_enabled` + mic permission. Realistic scope: in-tab only while
   the Standard HQ tab is open; truly global is a native-app concern.
1b. **Barge-in (interrupt while speaking).** Today `tick()` is inert during
   `speaking`, so talking over Jarvis is ignored — the only interrupt is clicking the
   orb. Follow-up: during `speaking`, run a lighter VAD; sustained speech >~300ms
   pauses `audio` and transitions to `capturing`. Same UX family as wake-word.
1c. **VAD tuning is empirical — validate in first live E2E.** `SILENCE_HOLD_MS=1100`
   may cut off a thoughtful mid-sentence pause; `SPEECH_RMS=0.04` may trip on HVAC/fan
   noise. First live test should specifically try long pause-y utterances and a noisy
   room. Dials: raise `SILENCE_HOLD_MS` to 1500–1800; raise `SPEECH_RMS` for noisy
   rooms. All in `useAssistantVoiceSession.ts`.
2. **Animated, renameable nav item.** Sidebar command-center item should read the
   user's `assistant_name` (not hardcoded "Command Center") and animate
   (sound-wave / motion), shifting color while Jarvis speaks — tie to the voice
   `speaking` state, reuse the `VoiceOrb` visual language. Nav config:
   `src/components/layout/sidebar/sidebar-nav.config.ts`.
3. **Email UX gaps** (from prior E2E, real but non-blocking):
   - Recipient not auto-filled (M1 strips client email). Fix: let `draftEmailMessage`
     take a contact NAME, resolve the email SERVER-SIDE (RLS-scoped), set `recipient`
     WITHOUT echoing to the model/logs. **Consult the advisor before this — it
     touches the M1 PII boundary.**
   - No email signature. Append a professional signature in the send path
     (`assistant-action-execute` `bodyToHtml`, or as a preference).
4. **Optional:** an `assistant_voice_usage` table for spend tracking (currently
   console-logged char counts only).

## MERGE TO MAIN
E2E (text path) already passed, so the merge gate was met before voice. Voice ships
gated behind `voice_enabled` (default off) + the Epic-Life/super-admin access gate.
Open question for the user: deploy + E2E voice first, then merge — or merge the text
work now and land voice in a follow-up. Never push non-main branches; merge is an
explicit user call.

## Constraints (from CLAUDE.md)
- Migration runner only; apply local + remote. Never psql. (No migration this round.)
- Never push non-main branches (Vercel deploys on push). Never `--no-verify`.
- Edge functions are Deno → validate with `deno check`/`deno test`, not frontend tsc;
  IDE Deno-global errors are false positives.
- After any durable new doc under `docs/`, sync the Obsidian vault
  (`-p commission-tracker`, lint must be 0). (No `docs/` change this round.)
