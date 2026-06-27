# CONTINUATION PROMPT — Call Reviews PII Redaction, Phase 3

> Paste the block below into a fresh Claude Code session in this repo to resume.
> It is self-contained; it points at the full plan + memory rather than restating them.

---

We're implementing **Phase 3** of the Call Reviews PII-redaction project for the
insurance KPI app (React 19.1 + TS + Supabase/Postgres). Phases 0–2 are SHIPPED to
prod. Phase 3 is the **review/approve + backfill** phase — the one that re-shares
recordings IMO-wide and destroys the raw original, so a single mistake re-exposes
client SSN/banking data. Treat correctness and security as paramount.

## Read these FIRST (do not skip — they are the source of truth)
1. `plans/active/call-reviews-pii-redaction-phase3-plan-20260627.md` — the complete,
   red-teamed Phase 3 plan (state machine, schema, trigger rules, approve flow,
   span-edit/re-mute, reject, review UI, backfill, threat model S1–S15, open
   decisions, verification, files, non-negotiables). **This is the spec — follow it.**
2. Memory: `project_call_reviews_pii_redaction_20260626.md` — what Phases 0–2 shipped
   and every gotcha (commits, migrations, edge fns, the legacy-JWT trap).
3. `plans/active/call-reviews-pii-redaction-plan-20260626.md` — the original
   Phases 0–3 overview (context).

## What already exists (don't rebuild)
- `kpi_call_recordings.redaction_status` (`pending|detecting|needs_review|approved|failed`)
  + `redaction_spans`, `redaction_detector`, `redacted_storage_path`,
  `audio_redacted_at`, `audio_redaction_status`, `audio_redaction_error`.
- Phase 0 RLS: all IMO-wide reads (row, `kpi_word_track_detections`,
  `kpi_call_markers`, redacted-storage SELECT) gated on `redaction_status='approved'`;
  raw `call-recordings` IMO read policy DROPPED.
- Phase 1 edge fn `transcribe-call-recording` + `_shared/pii-redaction.ts` (redacts
  transcript in place → `needs_review`).
- Phase 2 edge fn `redact-call-audio` + Railway `services/audio-worker/` (mutes spans
  → `call-recordings-redacted` bucket) — DEPLOYED & wired
  (`AUDIO_WORKER_URL`/`AUDIO_WORKER_KEY` set). Player serves the muted copy.

## STEP 1 — Resolve the open decisions in §11 of the plan BEFORE coding
Ask the user (these change the schema/trigger/UI, so they qualify under the
"ask when it touches schema/permissions/migrations" rule):
1. **Who can approve?** (rec: IMO-admin / super-admin only — a gatekeeper distinct
   from the uploader).
2. **Raw purge timing** (rec: purge immediately on approve).
3. **Reject** = new `rejected` status (rec) vs reuse `archived_at`.
4. **Backfill** = one-shot script (rec for the 34) vs in-app button.
5. **Human-typed PII** (`caller_name`, marker notes, title) — NOT scanned by the
   pipeline, becomes IMO-visible on approval. Pick: surface-for-manual-scrub (min),
   mask caller_name, and/or regex these fields. **Don't ship without an answer.**
6. **Span-edit authority** (rec: same admin-only gate as approve).

## STEP 2 — Build, in this order (all detailed in the plan)
1. **Migration** (use the runner, never psql): add cols `pii_reviewed_at`,
   `pii_reviewed_by`, `raw_audio_purged_at`, `spans_version`, `muted_spans_version`;
   add `rejected` enum value (TS-enforced, no CHECK); create the `BEFORE UPDATE`
   trigger `kpi_call_recordings_redaction_guard` enforcing the §3 state machine +
   §3 trigger-context rules (`SET search_path`, NULL-uid cannot `→approved`,
   spans-change bumps `spans_version` + forces `audio_redaction_status='pending'`,
   admin-only `→approved` with all preconditions incl. `muted_spans_version =
   spans_version`). Apply LOCAL first, verify with live RLS sessions, then PROD.
2. **Edge fns**: `approve-call-redaction` (auth→RLS load→Epic/AI gate→admin
   authorize→preconditions→atomic claim→purge raw best-effort), `update-redaction-spans`
   (guarded edit → re-arm → fire `redact-call-audio` force). Worker echoes
   `muted_spans_version`. **Deploy every edge fn after writing/changing it.**
3. **transcribe-call-recording**: handle missing-raw (purged/`audio_deleted_at`) →
   clean `failed`, drop out of `approved` (S7).
4. **Frontend**: admin-gated Review-queue page + nav; review detail with muted-audio
   player, redacted transcript, spans editor, residual-digit auto-highlight,
   human-field scrub surface, detector/`regex_only` warnings, Approve (disabled
   until `done` & `muted_spans_version=spans_version`)/Reject/re-mute; disable
   **re-transcribe** once approved/purged (re-analyze stays allowed). Hooks:
   `useReviewQueue`, `useApproveRedaction`, `useUpdateSpans`, `useRejectRecording`.
5. **Backfill** the 34 `pending` rows: per the plan — NULL stale AI fields +
   delete `kpi_word_track_detections` FIRST, then re-transcribe (privileged batch,
   not the 10/hr user limiter); `audio_deleted_at` rows take the transcript-only
   regex path and stay locked/`rejected`; report, never silently skip.
6. **Types**: hand-edit `src/types/database.types.ts` (full prod regen breaks the
   build). Use `node scripts/dbtype.mjs <name>` to read slices — never read the
   whole file.

## STEP 3 — Verify (plan §12)
Trigger test matrix (every forbidden transition RAISEs incl. NULL-uid `→approved`,
non-admin `→approved`, stale `muted_spans_version`); live RLS proof that an approved
row becomes peer-readable (row + muted object) while raw stays gone; span-edit→re-mute→
approve happy path; backfill dry-run on ONE row + one `audio_deleted_at` row;
`deno check` + `npm run build` zero errors + worker tests green; owner E2E.

## HARD CONSTRAINTS (carry through the whole session)
- **Migrations only via `./scripts/migrations/run-migration.sh`** — NEVER psql.
  Queries via `./scripts/migrations/run-sql.sh`. Prod target needs `source .env`
  then `DATABASE_URL="$REMOTE_DATABASE_URL"`.
- **Deploy every edge function** you create/change (supabase CLI, `--no-verify-jwt`
  where the fn handles its own auth — match the existing fns).
- **Hand-edit `database.types.ts`**; never full-regen; never read it whole (token guard).
- **Never log** transcript text / audio bytes / signed URLs — status codes only.
- **Never touch real auth accounts** — use `.env.local` creds for any test login.
- **Push only to `main`** for prod; don't push other branches (Vercel deploys any push).
- ⚠️ **This prod project DISABLED legacy JWT keys.** The `.env` `SUPABASE_ANON_KEY`
  and `SUPABASE_SERVICE_ROLE_KEY` are stale/rejected — local synthetic storage/REST
  smokes from those keys WILL 401. Edge fns (platform-injected key) and the Railway
  worker (owner-set key) are unaffected. Don't chase that as a bug.
- The **DB trigger is the security guarantee**, not the edge fn — assume any
  owner/admin token can hit PostgREST directly and bypass the edge fn.
- Use the `advisor` tool before committing to the trigger design and before declaring done.

## STILL-PENDING owner-side item (confirm before the destructive backfill/purge)
Phase 2 owner acceptance E2E: upload a call with a spoken FAKE SSN → assert transcript
`[redacted]`, `redaction_spans` set, AI fields clean, `audio_redaction_status='done'`,
`redacted_storage_path` set, and the SSN is **silenced** in the player at the span.
If it shows `failed` with a download/upload 403, the Railway `SUPABASE_SERVICE_ROLE_KEY`
is the legacy one → replace with the new `sb_secret_…` key from Settings→API.

When done, update memory `project_call_reviews_pii_redaction_20260626.md` (+ MEMORY.md
pointer) with what Phase 3 shipped, and sync the knowledge vault if a durable doc lands.
