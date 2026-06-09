# CONTINUE — Call Reviews (all-agents live-call training platform)

> Build an all-agents Training surface for reviewing live call recordings: diarized
> transcript (client vs agent), synced audio player, manual markers (incl. hold), AI
> analysis (objections / word-tracks / demographics / summary), and a script library
> beside the transcript. Reuses the existing `/kpi` `kpi_*` data layer + storage bucket
> and the `training-modules` presentation player/markers system.

## STATUS — P0–P3 ALL SHIPPED (Jun 9, 2026)
P0 schema + P1 Deepgram diarization committed `05b4578e`; P2 Claude analysis + P3 full UI
committed `48e0c53a` (both → origin/main). Migrations `20260609074223` + `20260609081428` applied
LOCAL+PROD. tsc/eslint/`npm run build`/`deno check`/`scripts/check-call-reviews.mjs` all green.
**ONLY REMAINING = owner-gated deploy** (see P1/P2 deploy notes below) + a browser runtime test.
GATING NOTE: the nav/route is `public:true` + `noRecruits` (NOT epiclife-email-gated — that would
hide it from regular agents); Epic-Life scoping is enforced by RLS + the edge-fn `is_epic_life_imo` gate.

## OWNER DECISIONS (locked Jun 9, 2026)
- **Visibility:** OPEN IMO-wide — every approved agent can listen to every recording in the IMO.
- **Upload/curation:** ANY agent uploads & shares — uploads flow straight into the shared library.
- **v1 scope:** ALL FOUR — (1) diarized transcript + player, (2) manual markers + hold time,
  (3) AI call analysis, (4) script library beside transcript.
- **Gating (my default, not asked):** all approved agents, recruits excluded (`noRecruits`),
  Epic-Life-gated to match the sibling `/kpi` (`requireEmailIncludes:'epiclife'` is per-IMO via
  `is_epic_life_imo`; the page itself is `public:true` for all agents within that IMO).

## DECISIONS I MADE (per advisor)
- **Transcription: Deepgram REPLACES Whisper.** Deepgram prerecorded
  (`model=nova-2&diarize=true&utterances=true&smart_format=true&paragraphs=true`) returns
  transcript + speaker labels + per-speaker talk-time in ONE call AND removes the 25 MB Whisper cap.
  Now is the only cheap moment to change `transcript_segments` shape (no real transcripts exist yet).
  `DEEPGRAM_API_KEY` exists as a Fly secret (Jarvis voice worker, nova-2-general) → owner adds it to
  Supabase edge-fn secrets. Deepgram returns `speaker:0/1`; map first-speaker→agent on inbound +
  one-click flip in UI (`speaker_role_map`).
- **Hold-time = manual markers, NOT audio inference** (no dialer API; silence≠hold). `marker_type='hold'`
  with `start_seconds`→`end_seconds`; `total_hold_seconds` aggregated from hold markers.
- **Objection/smoke-screen count = Claude analyze pass**, NOT word-track detection (word-tracks only
  match the AGENT's scripted lines; objections come from the CLIENT). Stored as `objection_count`,
  `smoke_screen_count`, `objection_events JSONB`.
- **Consent (open IMO-wide exposes client PII):** add a one-time consent-ack checkbox on upload
  (store in `metadata.consent_ack`); listen-audit deferred to Phase 4. Recommended, not blocking.

## ARCHITECTURE
One data layer (`kpi_*` tables + `call-recordings` bucket). Two surfaces:
`/kpi` (admin dashboard, epiclife-gated, EXISTING) and `/call-reviews` (all-agents training, NEW).
One pipeline: upload → `transcribe-call-recording` (Deepgram, diarized) → `analyze-call-transcript`
(Claude). Building the pipeline ALSO lights up the 8 currently-empty `/kpi` dashboard panels.

## PHASES
- **P0 — schema (migration `20260609074223_call_reviews_training_platform.sql`)**: IMO-wide SELECT
  policy on `kpi_call_recordings` + IMO-wide storage SELECT (helper `kpi_same_imo_agent`); new table
  `kpi_call_markers` (denorm trigger + RESTRICTIVE revocation_deny); additive columns on
  `kpi_call_recordings` (diarization/hold/objection/summary/provider). Then regen `database.types.ts`.
- **P1 — Deepgram rewrite** of `supabase/functions/transcribe-call-recording/index.ts` (diarized
  segments `{speaker,start,end,text}` + talk-time split + role heuristic; drop 25 MB cap). OWNER deploys
  (`DEEPGRAM_API_KEY` to Supabase + `supabase functions deploy`).
- **P2 — `analyze-call-transcript`** new edge fn (Claude `claude-sonnet-4-6` — VERIFY id; reuse
  `close-lead-heat-score/ai-analyzer.ts`): objections + word-track detections + AI demographics +
  summary. Writes `kpi_word_track_detections` + recording columns. OWNER deploys.
- **P3 — frontend** `src/features/call-reviews/`: nav item (Training group) + `/call-reviews` route;
  library list (IMO-wide, filter/search); upload (consent ack); review page reusing
  `PresentationMediaPlayer` + `PresentationMarkersPanel` (→ `kpi_call_markers`) + new diarized
  `TranscriptPanel`; tabs Transcript/Markers/Analysis/Script; FlapTile header stats.
- **P4 — completion**: status polling, verify `/kpi` panels populate, export-bundle includes `kpi_*`,
  listen-audit.

## NON-NEGOTIABLES
- Migrations ONLY via `./scripts/migrations/run-migration.sh` (prod: `source .env &&
  DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-migration.sh <file>`; verify prod host).
- Regen types from `--project-id pcyaqwodnyrpkaiojnpz` (PROD), never `--local`.
- Enums in TS, never DB CHECK constraints. No placeholders. Commit promptly (concurrent-git mishaps).
- Edge deploys are OWNER-GATED.

## VERIFY EACH STEP
`npx tsc --noEmit` · `npx eslint <changed>` · `npm run build` · `npm test` ·
`node scripts/check-kpi-section.mjs` · `scripts/check-revocation-gate-completeness.sql` green.
