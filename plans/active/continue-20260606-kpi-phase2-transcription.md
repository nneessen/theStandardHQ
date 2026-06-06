# CONTINUE — KPI section Phase 2 (call-recording transcription)

> Handoff for a fresh session. Pick up here and build **Phase 2** of the new `/kpi`
> inbound-call KPI section: the `transcribe-call-recording` Whisper edge function +
> the frontend wiring that invokes it and shows transcripts. ACTIVE_SESSION_CONTINUATION,
> <72h old → continue without re-asking (per project CLAUDE.md).

## TL;DR
Phase 1 (the `/kpi` UI + DB foundation) is shipped. Phase 2 adds **transcription only**
(no analysis/detection yet — that's Phase 3). A user uploads a recording (Phase 1 already
stores it + inserts a row at `transcription_status='pending'`); Phase 2 transcribes it with
OpenAI Whisper and writes the transcript + segments back. Edge-function **deploy is
owner-gated** — you build + verify; the owner deploys.

---

## WHERE THINGS STAND (verify with `git log`/`git status` first — the owner curates git fast)

**On PROD + committed:**
- Migration `supabase/migrations/20260606135121_kpi_inbound_call_intelligence.sql` APPLIED to prod,
  committed in `3dc3588e`. 5 tables (`kpi_call_recordings`, `kpi_daily_call_metrics`,
  `kpi_word_tracks`, `kpi_word_track_detections`, `kpi_discovered_phrases`) + private
  `call-recordings` storage bucket, multi-tenant RLS, security-hardened (2 opus reviews).
- `src/types/database.types.ts` regenerated from prod (has the `kpi_` tables), committed.
- Track A cleanup (deleted Lead Drop/Business Tools/Orchestrator/Reports; Lead Vendors gated to
  `nickneessen@thestandardhq.com` + `epiclife.neessen@gmail.com`; Agent Roadmap nav restored) — committed `f79e9b96`.

**Phase 1 frontend + wipe fix — committed at the END of the prior session** (this handoff was
committed alongside it). If `git show HEAD:src/features/kpi/index.ts` exists, it's in. Files:
- `src/features/kpi/` — `KpiPage` (3 tabs: Dashboard | Recordings | Word Tracks); `ManualKpiEntryPanel`
  (upsert `kpi_daily_call_metrics`); `KpiDashboardTab` (FlapTiles + derived closing%/CPA/policies-per-client,
  no-placeholder); `RecordingsTab`/`RecordingUploadDropZone`/`RecordingsList` (upload→storage→insert
  `transcription_status='pending'`, signed-URL player, `deriveRecordingStatus` badge);
  `WordTracksTab`/`WordTrackForm`/`WordTrackLibrary`. Hooks in `src/features/kpi/hooks/`, lib in
  `src/features/kpi/lib/` (incl. `kpi-derivations.ts` + tests, `recording-status.ts`,
  `format-call-duration.ts`), `services/recordingStorageService.ts`, `types/kpi.types.ts`.
- `/kpi` route + "Call KPIs" nav item, gated `requireEmailIncludes: "epiclife"` (sidebar) + `RouteGuard requireEmailIncludes="epiclife"` (router).
- `scripts/check-kpi-section.mjs` smoke check.
- `supabase/functions/_shared/sunset-constants.ts` — added `"call-recordings"` to `PRIVATE_USER_BUCKETS`
  (account wipe purges call audio). **OPEN: `confirm-and-wipe-account` must be REDEPLOYED for this to take effect.**

**Identity for inserts (already done in Phase 1, mirror it):** `imo_id = useImo().effectiveImoId ?? user.imo_id`;
`agent_id`/`owner_id`/`uploader_id` = `useAuth().user.id`. RLS WITH CHECK pins `imo_id = get_my_imo_id()`
and triggers assert agent/owner belong to that IMO. Storage path = `{agent_id}/{yyyy}/{mm}/{ts}_{sanitized}`
(storage RLS keys on `foldername[1] = agent_id`).

**NOT runtime-tested:** Phase 1 was verified static-only (tsc/eslint/build/vitest). The owner should
load `/kpi` as an `epiclife` user and exercise the 3 tabs. Ideally do that before relying on Phase 2.

---

## PHASE 2 — BUILD THIS

### A. New edge function `supabase/functions/transcribe-call-recording/index.ts`
Reuse the Whisper multipart pattern from `supabase/functions/assistant-voice-stt/index.ts`
(`OPENAI_API_KEY` secret already exists there) and the shared helpers
`supabase/functions/_shared/{cors.ts,supabase-client.ts,rate-limit.ts}`.

Contract:
- `POST { recording_id: uuid }`; `Authorization: Bearer <user_jwt>`; `verify_jwt = true`.
- **Auth/ownership:** read the recording row with a **USER-scoped** client so RLS enforces
  visibility → 404 if not visible. Then **Epic-Life gate**: `is_epic_life_imo(get_my_imo_id())`
  (RPC) → 403 otherwise. (Same gate the assistant uses; keep RLS generic, gate at the fn.)
- **Rate limit:** `enforceRateLimit` from `_shared/rate-limit.ts`, bucket
  `ratelimit:req:transcribe-call-recording:{userId}`, ~10/hr, 3600s window.
- **Idempotency:** if `transcription_status IN ('completed','processing')` → return `{ok:true}` immediately.
- Set `transcription_status='processing'`. Download the audio via an **admin** client:
  `storage.from('call-recordings').download(storage_path)`.
- **File-size guard:** bucket allows 500MB but **Whisper caps at 25MB**. If `blob.size > 25*1024*1024`
  → set `transcription_status='skipped'`, `transcription_error='Recording exceeds Whisper 25 MB limit; upload mono ~64kbps'`,
  return 413 (do NOT fail the whole record — manual KPI + playback still work). Validate extension
  (mp3/mp4/mpeg/mpga/m4a/wav/webm) → 400 + skipped if bad.
- **Whisper call:** same FormData/`POST https://api.openai.com/v1/audio/transcriptions`, `model=whisper-1`,
  `Authorization: Bearer OPENAI_API_KEY` as assistant-voice-stt — BUT deviate: `response_format='verbose_json'`
  + `timestamp_granularities[]='segment'` + `language='en'` (assistant-voice-stt uses `json`/text-only + an 8MB realtime cap).
- **On success:** write `transcript_text`, `transcript_segments` (JSONB array of `{id,start,end,text}` from
  verbose_json), `duration_seconds`, `transcript_language`, `transcription_model='whisper-1'`,
  `transcribed_at=now()`, `transcription_status='completed'`. **On error:** `transcription_status='failed'`
  + `transcription_error`.
- **Leave `analysis_status='pending'`** — do NOT call any analyze fn (Phase 3 builds
  `analyze-call-transcript`; for Phase 2 just stop after transcription). Add a `// Phase 3:` TODO comment
  where the fire-and-forget analyze call will go.
- **PII:** never log transcript/recording content to stdout.
- Add the function to `supabase/config.toml` if functions are declared there (check the file;
  `verify_jwt` may default true). Keep `verify_jwt=true`.

### B. Frontend wiring (`src/features/kpi/`)
- `hooks/useRecordings.ts` (`useUploadRecording`): after the insert, **invoke** the fn —
  `supabase.functions.invoke('transcribe-call-recording', { body: { recording_id } })` (fire it; don't block the upload UX on completion).
- `useRecordings` list query: add `refetchInterval` (~5000ms) **while any row is non-terminal**
  (`transcription_status`/`analysis_status` in pending/processing) so the status badge updates live;
  stop polling when all terminal.
- `RecordingsList`: add a **transcript view** (drawer/expand showing `transcript_text`) and a
  **Retry** button for rows in `processing` (stalled) or `failed` that re-invokes the fn.
  `deriveRecordingStatus` already maps the two status columns — reuse it.
- Keep no-placeholder discipline: transcript view renders only when `transcript_text` exists.

### C. Verify (required before declaring done)
- `deno check supabase/functions/transcribe-call-recording/index.ts supabase/functions/_shared/*.ts`
- `npx tsc --noEmit` (0 errors) + `npx eslint <changed files>` + `npm run build` (exit 0)
- `node scripts/check-kpi-section.mjs` green (extend it to assert the new fn exists if useful)
- Cannot be runtime-verified without deploy — see below.

### D. Deploy (OWNER-GATED — do NOT run unilaterally; hand to owner)
- Owner: `supabase functions deploy transcribe-call-recording` (verify_jwt true) + ensure `OPENAI_API_KEY`
  secret is set for it. ALSO redeploy `confirm-and-wipe-account` (picks up the call-recordings purge).
- Edge-deploy safety (project memory): before deploy, drift/clobber-diff vs prod; ensure the `_shared`
  closure is committed; `supabase functions download --use-api` CLOBBERS the working tree — only on a clean tree.

---

## NON-NEGOTIABLES / GOTCHAS
- **Migrations:** ONLY via `./scripts/migrations/run-migration.sh`. Runner DEFAULTS TO LOCAL — for prod:
  `source .env && DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-migration.sh <file>`; verify
  `host(inet_server_addr())` is the prod IPv6. (Phase 2 likely needs NO migration.)
- **database.types.ts:** never read whole (PreToolUse hook blocks it). Use `node scripts/dbtype.mjs <name>`
  or targeted Read. Regenerate from `--project-id pcyaqwodnyrpkaiojnpz` (PROD), never `--local` (local drifted).
- **Enums in TS, never DB CHECK constraints.** No placeholders/fake UI (bind to real data or real input).
- **The owner curates git in parallel and a `git reset --hard` wiped uncommitted work once.** COMMIT
  promptly; verify what's already committed before redoing; don't fight concurrent git ops.
- **Verify, don't guess** identifiers (emails/ids) — query the DB (`run-sql.sh`) or codebase.
  See memory `feedback-verify-data-dont-guess`.

## LATER (Phase 3 / 4 / open)
- **Phase 3** `analyze-call-transcript` (Claude `messages.create`, reuse `close-lead-heat-score/ai-analyzer.ts`):
  HYBRID matching — deterministic exact/fuzzy/regex anchored to `transcript_segments` + Claude only for
  semantic/paraphrase + discovery (re-anchor LLM hits to real segments; never trust LLM offsets/timestamps).
  Detections → `kpi_word_track_detections` (`led_to_sale` set deterministically from `outcome`, NOT by LLM;
  effectiveness via a new SQL aggregate RPC `get_kpi_detections_aggregate`, NOT the LLM). **VERIFY the exact
  Claude model id before building (a wrong id silently 404s).** Talk-time stays MANUAL (Whisper has no diarization).
- **Phase 4** AI phrase discovery → `kpi_discovered_phrases` (upsert on `(imo_id, normalized_phrase)`), promote → `kpi_word_tracks`.
- **Open:** export-bundle (right-to-data) doesn't include `kpi_` data yet — add when real data exists.
  Confirm whether to add `policy_id` FK to `kpi_call_recordings` for per-call sales drill-down (owner decision).

## KEY REFERENCES
- Plan: `~/.claude/plans/streamed-churning-backus.md` (Track A + Track B design).
- Memory: `project-sidebar-cleanup-kpi-revamp-20260606` (full state), `feedback-verify-data-dont-guess`.
- Full Phase 2–4 design synthesis was produced by a workflow this session (data-model/pipeline/frontend
  + opus synthesis) — the canonical schema is the migration; the synthesis notes are summarized above.
