# Call Reviews — PII Redaction (SSN / Banking) Plan

**Date:** 2026-06-26
**Owner decisions (locked):**
- Gate posture = **Quarantine until confirmed** (a human approves before a recording is shareable IMO-wide).
- Existing data = **Lock now, backfill redaction** (immediately restrict every existing recording to owner/admin; redact + re-open each as it clears).

## The problem

`/call-reviews` is an open, IMO-wide training library. Every agent in the IMO can read any
recording's transcript **and** mint a signed URL to the raw audio file. Client calls contain
spoken SSNs and bank/card numbers. Sharing those = a real legal/retention liability.

Two distinct exposures:
1. **Readable** — transcript + AI fields show the PII as text. (Easier.)
2. **Audible** — the player streams the *original* audio; the SSN is spoken aloud to every
   listener. Starring out the transcript does **not** fix this. (The real problem.)

## Architecture decision

AI **recognizes** the PII (Deepgram redaction models + a Claude/regex verification pass over
word-level timestamps). A deterministic **media edit** (ffmpeg muting) **erases** it from the
audio. AI alone is not enough — muting the audio file is a media-processing step, run on a
worker, not in a Deno edge function.

**Key ordering win:** `analyze-call-transcript` reads only `transcript_segments` from the DB
row — it never touches the audio. So if redaction runs **between** transcribe and analyze, then
`ai_summary`, `objection_events[].quote/.resolution`, `caller_existing_coverage`,
`ai_key_moments[].label`, and `kpi_word_track_detections.detected_phrase` are all clean by
construction. Redact upstream once; don't chase every output column.

**Raw audio must actually go away.** Hiding it ≠ removing liability. Redacted file becomes
canonical; raw is purged after approval (kept transiently, owner/admin-only, only so re-mutes
re-derive from the original rather than compounding).

## PII surface (confirmed)

| Table | Field | Verbatim? | Rendered? |
|---|---|---|---|
| kpi_call_recordings | `transcript_text` | all spoken words | no (search only) |
| kpi_call_recordings | `transcript_segments[].text` | verbatim utterances | TranscriptPanel |
| kpi_call_recordings | `ai_summary` | AI paraphrase | CallAnalysisPanel |
| kpi_call_recordings | `objection_events[].quote` / `.resolution` | verbatim client speech | CallAnalysisPanel |
| kpi_call_recordings | `caller_existing_coverage` | AI free-text | header use |
| kpi_call_recordings | `ai_key_moments[].label` | model label | CallAnalysisPanel |
| kpi_word_track_detections | `detected_phrase` | verbatim agent speech | fetched, not rendered |
| kpi_call_markers | `note` | human-entered | CallMarkersPanel |

Export bundle (`generate-user-export-bundle` / `owned-tables.ts`) does **not** include any
`kpi_call_*` table — no right-to-data leak path. Good.

## Visibility today (confirmed) & what changes

- Table read: permissive `kpi_call_recordings_imo_read` → any IMO member SELECTs any row.
- Storage read: `call_recordings_storage_imo_select` → any IMO member signs a URL to any raw
  object (scoped by `{agent_id}` path prefix → `user_profiles.imo_id`).
- Owner/upline/admin keep access via `kpi_call_recordings_rw` + `call_recordings_storage_select`.
- No sharing/visibility/redaction flag exists. `archived_at`, `audio_deleted_at` exist
  (app-layer / retention only, no RLS teeth).

We add a `redaction_status` and gate **both** IMO-wide policies on `= 'approved'`. With the
column defaulting to non-approved, this is simultaneously the **lock-now** switch and the
**per-recording re-open** mechanism.

---

## Schema additions (`kpi_call_recordings`)

- `redaction_status text NOT NULL DEFAULT 'pending'`
  — `pending | detecting | needs_review | approved | failed`
- `redaction_spans jsonb` — `[{ start, end, type, source, confidence }]` (audio time ranges to mute)
- `redacted_storage_path text` — path to the muted audio (canonical playable file)
- `redacted_bucket text` — e.g. `call-recordings-redacted`
- `audio_redacted_at timestamptz` — when the muted file was produced
- `pii_reviewed_at timestamptz`, `pii_reviewed_by uuid` — who approved
- `raw_audio_purged_at timestamptz` — original destroyed (reuse `audio_deleted_at` pattern)
- (optional) `transcript_words jsonb` — per-word `{ w, start, end, speaker }` for precise spans

No CHECK constraints on the status enum (project rule — enforce in TS).

## New bucket

`call-recordings-redacted` (private). Raw stays in `call-recordings` but loses IMO-wide read.
- `call-recordings` (raw): **drop** `call_recordings_storage_imo_select` → owner/upline/admin only.
- `call-recordings-redacted`: new IMO-wide SELECT policy, gated via `EXISTS (SELECT 1 FROM
  kpi_call_recordings r WHERE r.redacted_storage_path = name AND r.redaction_status='approved'
  AND kpi_same_imo_agent(r.agent_id))`. Owner/admin SELECT unconditionally.

---

## Phases

### Phase 0 — Lock now (urgent, ship first, ~1 migration)
The stopgap that closes the live exposure today, independent of the rest.
- Migration: add `redaction_status` (default `'pending'`); rewrite `kpi_call_recordings_imo_read`
  USING → `... AND (redaction_status = 'approved' OR agent_id = auth.uid() OR is_imo_admin())`;
  drop/replace `call_recordings_storage_imo_select` so peers can't sign raw URLs.
- Effect: zero recordings approved → peer agents see an empty library; owner/upline/admin
  unaffected. The feature is "paused for peers" until backfill re-opens recordings.
- Regenerate `database.types.ts` from prod; `npm run build`.

### Phase 1 — Detection + transcript redaction (edge)
- `transcribe-call-recording`: add `words=true` (+ optional `redact=ssn&redact=pci&redact=numbers`)
  to the Deepgram call; parse `results.channels[0].alternatives[0].words[]`; store per-word timing.
- New `detect-call-pii` step (or fold into transcribe): union of (a) Deepgram redaction tokens,
  (b) deterministic regex over words (SSN/card/routing/account digit runs), (c) Claude
  verification pass for missed/contextual PII. Map every hit to word time-spans, **pad each span**
  (~0.3–0.5s both sides — digits bleed at boundaries). Over-redact on purpose.
- Persist the **redacted** `transcript_text` + `transcript_segments` (raw PII never stored);
  write `redaction_spans`; set `redaction_status='needs_review'`.
- Reorder so `analyze-call-transcript` runs on the **redacted** segments → all downstream fields
  clean. (Function already reads only the row; just sequence detection before the analyze fire.)
- Tests: PII detection unit tests (SSN spoken as digits/words, card, "account ends in…"),
  span-merge/padding, redacted-text assertions.

### Phase 2 — Audio worker (Railway ffmpeg)
- New `services/audio-worker/` mirroring `services/paddleocr-service/` (Dockerfile
  `node:20-slim` or `python:3.11-slim` + `apt-get install -y ffmpeg`; `railway.toml`; `/health`).
- `POST /api/mute-audio { bucket, storage_path, spans[], out_bucket, out_path }` with `X-API-Key`:
  download raw via service-role, ffmpeg mute each span (`volume=0` between t0..t1, or a soft beep),
  re-encode, upload to `call-recordings-redacted`. Returns the redacted path + duration.
- New edge fn `redact-call-audio` dispatches the worker (pattern from `business-tools-proxy`),
  writes `redacted_storage_path`/`redacted_bucket`/`audio_redacted_at`.
- Secrets: `AUDIO_WORKER_URL`, `AUDIO_WORKER_KEY` (Supabase); `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `AUDIO_WORKER_KEY` (Railway).
- Player (`useCallRecordingSignedUrl` / `CallReviewDetailPage`): serve `redacted_storage_path`
  from the redacted bucket whenever it exists; raw is never handed to the player for peers.

### Phase 3 — Review/approve UI + backfill
- Review queue (owner/admin): list `needs_review`; per recording show the **redacted** transcript +
  detected spans + the **already-muted** audio so the reviewer hears exactly what peers will hear.
- Span editor: add/remove/adjust a span → re-dispatch the worker (always re-mutes from the raw
  original) → re-review. Approve → `redaction_status='approved'`, stamp `pii_reviewed_*`, purge raw
  (`raw_audio_purged_at`) → recording becomes IMO-wide shareable.
- Backfill: existing recordings have utterance-level segments only and no stored words, so they must
  be **re-transcribed** (Deepgram redact+words) → detect → mute → queue for review. Batch the
  Deepgram/worker passes; owner approves through the queue. Log what's processed; no silent caps.

### Phase 4 (optional, later)
- Listen-audit log (`kpi_call_listens` exists) for compliance trail.
- Upload-time agent guidance ("don't read SSNs back"); consent checkbox already exists.
- Backfill cron/queue instead of manual kick.

## Edge cases
- PII spoken in pieces / as words ("four five six…"); over-redact + Claude verification.
- Span boundaries (padding) so no digit bleeds past the mute.
- Re-mute always from the **raw** original (not the already-muted file) to avoid compounding.
- Recording with no detected PII → still requires approval (quarantine posture) but trivial review.
- Worker failure → `redaction_status='failed'`, stays owner/admin-only, never shared.
- Concurrent re-mutes / approve races → status-guarded claims (mirror the transcribe claim pattern).
- Deepgram returns `words[]` by default; if a response lacks them, fail closed (no auto-approve).

## Verification
- `npm run build` zero errors; regen types from prod after each schema change.
- Edge: deno check + smoke (extend `scripts/smoke-call-transcribe.py`); never log transcript/spans.
- Worker: local ffmpeg mute test on a sample file; confirm muted ranges are silent.
- End-to-end: upload a call with a spoken SSN → detected → muted → reviewer hears silence →
  approve → peer can play redacted, cannot sign raw URL (RLS denies).
