# CONTINUATION — Jarvis Voice M1: frontend LiveKit client → Fly deploy → first audio

**Created:** 2026-06-02 · **Branch:** `main` · **Goal:** take the realtime voice worker from
"type-checks" to **first real audio** — and make it *awesome* (flawless, low-latency, no gibberish).
**Read first:** the architecture + decisions live in
`plans/active/continue-20260602-jarvis-voice-secondbrain-master-plan.md` and
`docs/jarvis-voice-rebuild-livekit-architecture.md`. This file is the step-by-step for the
remaining M1 work.

---

---

## ✅ UPDATE — session 2 (2026-06-02 PM): client + infra DONE; blocked on LiveKit creds

Everything buildable is built and verified. **The only thing standing between here and first audio
is a valid LiveKit key/secret** — the current pair is rejected by LiveKit Cloud.

**Shipped this session (all `tsc`/eslint/deno/docker green, committed):**
- **Worker runtime smoke** — `npm run dev` boots the never-run worker: loads all 4 plugins,
  registers/listens (1.4.5). The Docker image builds **end-to-end** with weights baked.
- **Frontend realtime client** — `src/features/assistant/hooks/useJarvisVoiceSession.ts`
  (`livekit-client`): token → join → mic → JWT published **addressed to the agent identity only**
  (reliable; bounded re-send to beat the worker's `dataReceived`-registration join race + re-send
  on every `TOKEN_REFRESHED`) → play agent track; **mic-only** analyser (agent visuals were
  already synthetic; remote-track Web Audio reads zero in some Chrome builds); state from the
  verified `lk.agent.state` attribute. Shared `voiceSession.types.ts` (`VoiceSessionUi`) so
  `VoiceOrb`/`VoiceImmersion`/`CommandCenterLayout` render either transport. `AssistantPage`
  calls **both** hooks unconditionally and selects by the flag (legacy path untouched).
- **`voice_engine` gate** — prod migration `20260602164643` (`text NOT NULL DEFAULT 'legacy'`),
  types synced (surgical 3-line add — a full regen with the local CLI v2.23.4 is a 33k-line
  semicolon-only reformat; do NOT commit that), plumbed through prefs + an opt-in **toggle** in
  the assistant settings sheet (Realtime voice · Beta).
- **Voice rate-limit bucket** — bridge sends `x-jarvis-surface: voice`; orchestrator →
  `ratelimit:req:assistant-voice:<uid>` @ 600/hr (token axis unchanged). `core/rateBucket.ts` +
  deno tests; suite 105/0.
- **Dockerfile** — bakes Silero/turn-detector weights via `livekit-agents download-files`.

**⛔ THE BLOCKER (owner-only): LiveKit credentials are invalid.**
The key/secret in `.env.local` — and the *same* key (`APIHeZgZXPh5xwJ`) in the deployed token
endpoint's Supabase secret — are **rejected by LiveKit Cloud: 401 "invalid token"** for
`standard-hq-wz8p7ono.livekit.cloud`. Proven 3 ways (worker WS registration, `RoomServiceClient.
listRooms`, swapped-pair retry). Token signing is local, so this was invisible until the first
worker run. **Nothing downstream can be verified until this is fixed.**

**Exact remaining steps (owner):**
1. LiveKit Cloud dashboard → project `standard-hq-wz8p7ono` → confirm it's active → create/confirm
   a **valid** API key + secret. Set the SAME valid pair in **all three** places:
   - repo-root `.env.local` (`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`/`LIVEKIT_URL`),
   - Supabase function secret (`supabase secrets set` for `assistant-voice-livekit-token`),
   - `fly secrets set` on the worker.
   Re-verify with: `cd services/jarvis-voice-worker && node -e "import('livekit-server-sdk').then(...)"`
   (a `RoomServiceClient.listRooms()` returning OK) — or just `npm run dev` and watch it register.
2. Get a real `ELEVENLABS_API_KEY` (the worker `.env.local` has a placeholder) into worker
   `.env.local` + `fly secrets`.
3. `cd services/jarvis-voice-worker && flyctl auth login && fly launch --no-deploy && fly deploy && fly scale count 1`.
4. On your account: assistant settings → enable **Voice** + **Realtime voice (Beta)** → open
   `/command-center` → start a session → speak. Verify the §5 "awesome" bar; measure latency.

Below is the original step-by-step (still accurate for the owner-gated steps).

---

## TL;DR — exactly where we are

| Piece | Status |
|---|---|
| Token endpoint `assistant-voice-livekit-token` | ✅ built, **deployed**, warm-200 + 401-on-unauth verified. Mints a per-session room `jarvis-<uid>-<uuid>`, identity = LiveKit-signed `auth.uid()`. |
| Node agent worker `services/jarvis-voice-worker/` | ✅ scaffolded, security + supply-chain reviewed/hardened, **`npm ci` (0 vulns) + typecheck + build green vs `@livekit/agents@1.4.5`**. ❌ **never run.** |
| Frontend LiveKit client | ❌ not started (still the old MediaRecorder+MediaSource hook). |
| Fly deploy of the worker | ❌ not done (Dockerfile + fly.toml ready). |
| First audio / live-room smoke | ❌ blocked on the three above. |

**The worker can't be runtime-verified in isolation** — it needs (a) a client to join its room and
(b) the user's JWT over the data channel before it will call the brain. So the order is forced:
**build the client → deploy the worker → smoke in a live room.** That's this doc.

---

## 0. Prerequisites + footguns (read before coding)

1. **Secrets are in the repo-root `.env.local`** (gitignored): `LIVEKIT_URL/API_KEY/API_SECRET`,
   `DEEPGRAM_API_KEY`. You also need `ELEVENLABS_API_KEY` (already used by `assistant-voice-tts`)
   and `SUPABASE_URL` + `SUPABASE_ANON_KEY`. **Never echo secret values**; copy via
   `grep '^X=' .env.local > tmp && fly secrets set/supabase secrets set --env-file tmp && rm tmp`.
2. **The security model is non-negotiable** (security review): the worker calls the orchestrator
   with the **user's own Supabase JWT** (relayed over the LiveKit data channel), NEVER a worker
   secret / service-role. The worker already binds the JWT `sub` to the room owner. The client MUST
   publish the JWT **addressed to the agent participant only** (`publishData` defaults to broadcast).
3. **Voice rate-limit bucket is a PREREQUISITE for real use** (not the first 2-turn smoke). The
   orchestrator's 30-req/hr per-user request cap (`AI_REQ_MAX_PER_HOUR`, `index.ts:88,98-113`) would
   trip mid-conversation (10+ turns/min). See §4 — wire this before declaring "done."
4. **Model weights:** Silero VAD / the turn-detector download weights. The Dockerfile's
   `download-files` step was REMOVED (it masked failures). Now that the SDK is installed, find the
   real CLI subcommand (`cd services/jarvis-voice-worker && node dist/agent.js --help`) and add it
   back to the Dockerfile **pinned**, before `CMD`, so the image bakes weights (no cold first-turn
   download). If there's no such subcommand in 1.4.5, accept a one-time runtime download + note it.
5. **Don't break the typed path.** Jarvis text mode works great (post-this-session fixes). The client
   work only swaps the *voice transport*; leave the typed flow intact. Voice behind a flag
   (`assistant_preferences.voice_engine = 'realtime'`) so you can dogfood before cutover.
6. **Background autocommit** sweeps foreign `src/features/**` files — when you commit, use **explicit
   paths** + `--no-verify` + `git diff-tree --no-commit-id --name-only -r HEAD` to confirm only your
   files landed (lots of foreign uncommitted board/analytics work is present).

---

## 1. Runtime-verify the worker (coupled to the client — do alongside §2)

The worker's full path can only be verified end-to-end with the client (it needs the JWT). But you
can de-risk the *pipeline* first:

- **Pipeline-only smoke (optional, before the client):** `cp .env.example .env.local` (fill it),
  `npm run dev`. The worker registers with LiveKit Cloud and waits for dispatch. Join its room with
  the **LiveKit Agents Playground** (`agents-playground.livekit.io`, point it at your LiveKit project).
  You'll get STT→…→TTS *except* the brain call, because the playground won't send the auth JWT → the
  worker speaks its "not connected to your account yet" fallback. That still proves VAD + Deepgram STT
  + ElevenLabs TTS + turn-taking work. (If you want to test the *bridge* too, temporarily read a dev
  JWT from an env var in `SessionState` — REMOVE before commit.)
- **Full verify** happens in §5 once the client sends the real JWT.

What to watch in `npm run dev` logs: worker registered; on a room join, "participant connected";
the `dataReceived` handler firing; the JWT `sub`-bind accepting; the orchestrator call returning
text; ElevenLabs audio published.

---

## 2. Frontend LiveKit client (the big piece)

**Replace** `src/features/assistant/hooks/useAssistantVoiceSession.ts` (the MediaRecorder + MSE
path) with a LiveKit client. Keep the existing command-center voice UI shell; swap only the transport.

**Dep:** `npm i livekit-client` (a custom hook is cleaner than `@livekit/components-react` for a
drop-in replacement, but components-react's `RoomAudioRenderer` is a convenient way to play agent
audio — your call).

**The flow (a `useJarvisVoiceSession` hook):**
1. **Token:** `POST ${SUPABASE_URL}/functions/v1/assistant-voice-livekit-token` with headers
   `Authorization: Bearer <supabase session access_token>`, `apikey: <anon>`, body `{}` →
   `{ token, url, room }`.
2. **Connect:** `const room = new Room({ adaptiveStream: true, dynacast: true });
   await room.connect(url, token);`
3. **Mic:** `await room.localParticipant.setMicrophoneEnabled(true);` (prompt for permission; handle
   denial). The mic streams continuously — barge-in is server-side (AgentSession), no client logic.
4. **Send the JWT to the agent ONLY (security-critical):** detect the agent participant
   (`participant.kind === ParticipantKind.Agent` in livekit-client) on `RoomEvent.ParticipantConnected`
   (and scan already-present participants), then:
   ```ts
   const data = new TextEncoder().encode(JSON.stringify({ type: "auth", jwt: accessToken }));
   await room.localParticipant.publishData(data, { reliable: true, destinationIdentities: [agentIdentity] });
   ```
   **Never** publish without `destinationIdentities` (that broadcasts the JWT). **Re-send on every
   Supabase token refresh** (subscribe to `supabase.auth.onAuthStateChange` / TOKEN_REFRESHED).
5. **Play agent audio:** on `RoomEvent.TrackSubscribed`, if `track.kind === Track.Kind.Audio`,
   `track.attach()` → an `<audio autoplay>` element (or use `RoomAudioRenderer`). Handle the browser
   autoplay policy — start the session on a user gesture (the existing "start" button).
6. **Transcript (optional, nice-to-have):** the orchestrator already streams text; for the voice UI
   you can either show the worker-published transcript (have the worker publish user/assistant text
   over the data channel) or keep voice audio-only for v1. Decide; don't block first audio on it.
7. **Teardown:** `room.disconnect()` on stop/unmount; revoke mic.
8. **Edge cases:** mic-permission denied (graceful message); agent never joins within ~8s (timeout +
   retry/fallback to typed); reconnect (`RoomEvent.Disconnected` → re-token + reconnect); the
   session flag off → keep the old path.

**Gate it:** behind `assistant_preferences.voice_engine === 'realtime'` so you dogfood on your own
account before deleting the old MediaRecorder/MediaSource code (delete on cutover — repo rule, no
dead code).

---

## 3. Fly deploy of the worker

```bash
cd services/jarvis-voice-worker
fly launch --no-deploy            # creates the app from fly.toml (first time; keep app name jarvis-voice-worker)
# set secrets WITHOUT echoing values:
grep -E '^(LIVEKIT_|DEEPGRAM_|ELEVENLABS_|SUPABASE_)' ../../.env.local > /tmp/wk.env  # add ELEVENLABS_/SUPABASE_ if missing
fly secrets set --app jarvis-voice-worker $(cat /tmp/wk.env | xargs) ; rm /tmp/wk.env   # or: fly secrets import < /tmp/wk.env
fly deploy
fly scale count 1                 # keep ≥1 warm (worker holds a persistent WS to LiveKit; never scale to zero)
fly logs                          # confirm: "registered worker id=… " / connected to LiveKit Cloud
```
- Confirm the Docker build succeeds (it now runs `npm ci` against the committed lockfile + `npm run build`).
- Re-add the **pinned** model-weights download step to the Dockerfile (see §0.4) before this.
- `SUPABASE_URL` = `https://pcyaqwodnyrpkaiojnpz.supabase.co`; `SUPABASE_ANON_KEY` = the prod anon key.
- After deploy, the worker auto-dispatches into `jarvis-*` rooms — no per-room registration needed.

---

## 4. Voice rate-limit bucket (do before real multi-turn use)

The worker calls the orchestrator once per turn → the per-user 30-req/hr request cap trips mid-call.
Fix (touches the worker bridge + the orchestrator):
- Worker (`orchestrator-bridge.ts`): add a header e.g. `x-jarvis-surface: voice` to the fetch.
- Orchestrator (`index.ts`, the rate-limit block ~`:88-113`): when that header is present, key the
  REQUEST bucket as `ratelimit:req:assistant-voice:${user.id}` with a higher cap (~300–600/hr), OR
  skip the request axis for voice and rely on the per-user **token** bucket (200k/day) as the real
  ceiling (the token bucket is the meaningful cost guard and is already per-user-correct).
- Keep the token-budget axis as-is. Add a unit test in the orchestrator's deno suite.

---

## 5. Live-room smoke = FIRST AUDIO (the payoff) + the "awesome" bar

With the client deployed (Vercel) + the worker on Fly:
1. Open `/command-center`, start a voice session on your account → token minted → room joined → worker
   dispatched → client sends the JWT (addressed to the agent) → speak.
2. **Verify the path** (Fly logs): JWT received + `sub`-bound to owner + orchestrator call 200 +
   real grounded answer + ElevenLabs audio.
3. **The "awesome" acceptance bar** (from the master plan §8 — this is the whole point):
   - **No gibberish** — audio is clean and intelligible (the WebRTC track playout replaces the old
     MediaSource MP3 decode that caused garble).
   - **Accurate STT** — a numbers+names sentence ("what did I sell for the Gores this month") is
     transcribed correctly (Deepgram nova-3 keyword-boost).
   - **Low latency** — measure end-of-speech → first-audio: target **p50 < 800ms, p95 < 1.2s**.
   - **Barge-in** — interrupt mid-reply; the assistant stops and listens immediately.
   - **Grounded + correct** — real data via the user's RLS-scoped JWT (e.g., the queryPolicies path),
     multi-turn continuity (conversationId threads), no cross-talk between two users / two tabs
     (per-session rooms).
4. If gibberish persists even here, it's NOT the old MediaSource issue — instrument the worker's
   ElevenLabs stream + the WebRTC publish (per the master plan's eval/observability §8).

---

## 6. Definition of done for M1

- [ ] Frontend LiveKit client replaces the old hook (gated by `voice_engine='realtime'`), publishes
      the JWT addressed to the agent, plays the agent track.
- [ ] Worker deployed to Fly (≥1 warm), logs show successful dispatch + auth + brain calls.
- [ ] Voice rate-limit bucket wired (orchestrator + bridge) + tested.
- [ ] Model weights baked into the image (or runtime-download accepted + noted).
- [ ] Live smoke passes the §5 "awesome" bar on your device; latency measured.
- [ ] Old MediaRecorder/MediaSource path deleted on cutover (no dead code).
- [ ] Docs/wiki updated (README status → "runtime-verified"; re-ingest the architecture doc).

Then M2+ from the master plan: barge-in tuning, the eval harness + latency dashboard (§8), and the
retrieval tool family / second brain (§6–7).

---

## 7. Key files + references
- Worker: `services/jarvis-voice-worker/` (`src/agent.ts`, `src/orchestrator-bridge.ts`, `Dockerfile`, `fly.toml`, `README.md`).
- Token endpoint: `supabase/functions/assistant-voice-livekit-token/index.ts`.
- Brain: `supabase/functions/assistant-orchestrator/` (the bridge calls it; SSE `delta`/`done`).
- Old client to replace: `src/features/assistant/hooks/useAssistantVoiceSession.ts`.
- Master plan: `plans/active/continue-20260602-jarvis-voice-secondbrain-master-plan.md` (decisions, auth model, scaling, §8 eval bar).
- Architecture doc / wiki: `docs/jarvis-voice-rebuild-livekit-architecture.md` → wiki `command-center-assistant.md`.
- Memory: `project_jarvis_querypolicies.md`, and MEMORY.md's voice master-plan line.

---

## 8. READY-TO-PASTE PROMPT for the next session

```
Continue Jarvis Voice M1 toward FIRST AUDIO, per
plans/active/continue-20260602-jarvis-voice-m1-frontend-deploy.md. The token endpoint is deployed and
the Node worker (services/jarvis-voice-worker/) type-checks/builds against @livekit/agents@1.4.5 and is
security-reviewed but has NEVER run. Build, in order:

1. The frontend LiveKit client — replace src/features/assistant/hooks/useAssistantVoiceSession.ts with a
   livekit-client hook: fetch a token from assistant-voice-livekit-token, connect, enable mic, and —
   security-critical — publish the user's Supabase JWT over the data channel ADDRESSED TO THE AGENT
   PARTICIPANT ONLY (publishData with destinationIdentities; never broadcast), re-sent on token refresh;
   play the agent's audio track. Gate it behind assistant_preferences.voice_engine='realtime'; keep the
   typed path intact; delete the old MediaRecorder/MediaSource code only on cutover.
2. Wire the voice rate-limit bucket (worker bridge sends x-jarvis-surface:voice; orchestrator uses a
   separate higher request bucket or relies on the token axis) — the 30/hr cap would trip mid-call.
3. Re-add a PINNED model-weights download step to the worker Dockerfile (confirm the @livekit/agents 1.4.5
   CLI subcommand first), then deploy the worker to Fly (fly launch/secrets/deploy/scale count 1).
4. Live-room smoke = first audio: verify the §5 "awesome" bar — no gibberish, accurate STT (numbers+names),
   first-audio p50 <800ms, barge-in, real grounded multi-turn answers, no cross-talk. Measure latency.

HARD CONSTRAINTS: the worker calls the orchestrator with the USER's JWT only (no service-role/worker-secret
— that design was reviewed and rejected as fail-open); do not break the typed Jarvis path; commit with
explicit paths + --no-verify (foreign uncommitted board/analytics files are present) and confirm via
git diff-tree. When done, update the README/wiki status to "runtime-verified" and re-ingest.
```
