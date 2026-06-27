# Call Reviews — PII Redaction Phase 3: Review / Approve + Backfill

**Date:** 2026-06-27
**Status:** PLANNED (not started). Phases 0–2 shipped to prod.
**Prereq:** the Phase 2 owner acceptance test should pass first (worker mutes real audio).

> ⚠️ This phase is the one that **re-shares recordings to the whole IMO** and
> **destroys the raw original**. A single mistake re-exposes client SSN/banking
> data. Every transition that ends in `approved` must be enforced at the DB
> layer (trigger), not just in app code — assume the edge function can be
> bypassed by a direct PostgREST call from any owner/admin token.

---

## 1. Where we are (post Phase 0–2)

`kpi_call_recordings` lifecycle column **`redaction_status`**:
`pending | detecting | needs_review | approved | failed`.

- **Phase 0**: IMO-wide reads (recordings row, `kpi_word_track_detections`,
  `kpi_call_markers`, redacted storage) all gated on `redaction_status='approved'`.
  Raw `call-recordings` storage IMO policy dropped (owner/upline/admin only).
- **Phase 1**: transcribe detects PII (Claude+regex) → redacts `transcript_text`/
  `transcript_segments` in place, writes `redaction_spans`/`redaction_detector`,
  lands `needs_review`. Analyze runs on the redacted text.
- **Phase 2**: `redact-call-audio` → Railway `audio-worker` mutes the spans →
  `call-recordings-redacted/<agent_id>/redacted/<id>.mp3`, writes
  `redacted_storage_path`/`audio_redacted_at`/`audio_redaction_status`
  (`pending|processing|done|failed`)/`audio_redaction_error`. Player serves the
  redacted copy when present. Redacted-bucket IMO SELECT gated on
  `redaction_status='approved'` via exact-match EXISTS join.

**Today everything is SAFE but LOCKED**: every recording sits in `needs_review`
(or `pending` for the 34 pre-Phase-1 rows), invisible to regular agents, because
there is no way to approve. Phase 3 builds the approval + backfill.

## 2. Goals

1. **Review/approve UI** (admin) — listen to the MUTED audio, see the redacted
   transcript + spans, adjust spans if needed, then approve → shareable IMO-wide.
2. **Approve action** — flips `needs_review → approved`, stamps reviewer, purges
   the raw original. Enforced server-side AND at the DB layer.
3. **Span edit + re-mute** — fix a missed/false span → re-mute from raw → re-review.
4. **Reject** — keep a recording private (never share).
5. **Backfill** — re-process the 34 existing `pending` recordings safely.

## 3. The state machine (authoritative — enforce with a trigger)

Allowed transitions for `redaction_status`:

| From | To | By | Preconditions |
| --- | --- | --- | --- |
| (insert) | `pending` | upload | — |
| `pending`/`failed`/`skipped` | `detecting` | transcribe claim | — |
| `detecting` | `needs_review` | transcribe done | transcript redacted |
| `detecting`/any | `failed` | transcribe/worker fail | — |
| `needs_review` | `approved` | **admin only** | `audio_redaction_status='done'` AND `redacted_storage_path IS NOT NULL` |
| `needs_review` | `rejected` | admin/owner | — |
| `approved` | `needs_review` | re-transcribe re-arm | (raw must still exist) |
| `rejected` | `needs_review` | admin re-open | — |

**FORBIDDEN (trigger must RAISE):**
- `pending → approved` (would share a never-redacted recording).
- Any `* → approved` where `audio_redaction_status<>'done'` or
  `redacted_storage_path IS NULL` (would share unmuted/again-raw audio).
- `* → approved` by a non-admin (regular owner cannot self-approve their own call
  into the whole IMO — requires an IMO admin / super-admin gatekeeper).
- Setting `redaction_status='approved'` while `redaction_detector IS NULL`
  (detection never ran).

> **THE core security control.** A `BEFORE UPDATE` trigger on
> `kpi_call_recordings` enforces the table above. RLS lets owner/upline/admin
> UPDATE the row, so without this trigger an owner could `PATCH
> redaction_status=approved` directly via the API and skip muting + review. The
> trigger runs regardless of API path and cannot be bypassed by an RLS-passing
> token. The approve edge function is the *ergonomic* path; the trigger is the
> *guarantee*.

`is_imo_admin()` / `super_admin_in_scope(imo_id)` define "admin".

**Trigger evaluation-context rules (get these exactly right):**
- The `BEFORE UPDATE` trigger `kpi_call_recordings_redaction_guard` does **two
  independent jobs**: (a) the spans-version re-arm — when
  `NEW.redaction_spans IS DISTINCT FROM OLD.redaction_spans`, bump
  `NEW.spans_version = OLD.spans_version + 1` and force
  `NEW.audio_redaction_status = 'pending'`; (b) the approval-authority guard —
  when `NEW.redaction_status IS DISTINCT FROM OLD.redaction_status`, enforce the
  transition table + the `→approved` preconditions + the admin check.
- Declare it `SET search_path = public, pg_temp` (or schema-qualify every
  reference) so a malicious/temp-schema object can't shadow `is_imo_admin` etc.
- **`auth.uid()` is NULL for service-role / worker / migration writes.** The worker
  only ever writes `audio_*`, `redacted_storage_path`, `muted_spans_version` — it
  never changes `redaction_status`, so job (b) is skipped for it (the
  `IS DISTINCT FROM` guard). Decide the rule explicitly: **a NULL-uid write may
  NOT move `redaction_status` to `approved`** (no human gatekeeper → reject). Other
  status moves by service-role (e.g. a backfill batch using service-role) must use
  a documented service path; if the backfill needs to set statuses, run it under a
  real admin JWT OR add a narrow, explicit allowance and note it here.
- Use the same `is_imo_admin()` semantics the RLS policies use (acting-IMO aware)
  so trigger and policy can't disagree. The trigger is the guarantee; RLS is the
  first gate.

## 4. Schema additions (migration)

```sql
ALTER TABLE public.kpi_call_recordings
  ADD COLUMN IF NOT EXISTS pii_reviewed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pii_reviewed_by     UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS raw_audio_purged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS spans_version       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS muted_spans_version INTEGER NOT NULL DEFAULT 0;
```
- `rejected` is a new `redaction_status` enum value (TS-enforced, no CHECK).
- **`spans_version` / `muted_spans_version` — the clock-free "muting is current"
  proof (replaces any timestamp comparison).** A `BEFORE UPDATE` trigger bumps
  `spans_version` and forces `audio_redaction_status='pending'` **whenever
  `redaction_spans` changes** (`NEW.redaction_spans IS DISTINCT FROM OLD`). This
  works even on a direct PostgREST PATCH that skips the edit edge fn. The worker,
  after muting, writes back `muted_spans_version = <the version it muted>` (the
  edge fn passes the current `spans_version` to the worker; the worker echoes it
  into the row alongside `redacted_storage_path`). **Approve requires
  `muted_spans_version = spans_version`** — no wall clocks, no cross-host skew, no
  bypass. (Worker also keeps writing `audio_redacted_at` for display only.)
- Plus the `BEFORE UPDATE` trigger `kpi_call_recordings_redaction_guard`.
- Regenerate `database.types.ts` by HAND (full prod regen breaks the build — see
  [[project-add-to-team-invite-fix-20260626]]).

## 5. Approve flow — edge fn `approve-call-redaction` (+ DB trigger backstop)

`POST { recording_id }` with a user JWT:
1. auth (401); load under USER client (RLS → 404); Epic/AI gate (403).
2. **Authorize admin**: require `is_imo_admin()` or `super_admin_in_scope` for
   the recording's IMO (not just owner). (Decision §11.)
3. **Preconditions** (also enforced by the trigger): `redaction_status='needs_review'`,
   `audio_redaction_status='done'`, `redacted_storage_path IS NOT NULL`,
   `redaction_detector IS NOT NULL`, and **muting is current** —
   `muted_spans_version = spans_version` (the worker muted the exact span set that
   is on the row now). If spans were edited after the last mute the trigger has
   already bumped `spans_version` past `muted_spans_version` → block ("re-mute
   first"). No timestamps, no cross-host clock skew.
4. **Claim**: UPDATE `redaction_status='approved'`, `pii_reviewed_at=now()`,
   `pii_reviewed_by=auth.uid()` WHERE id AND `redaction_status='needs_review'`
   under the USER client (RLS enforces admin via the trigger + policy). 0 rows →
   403/409. This is atomic (concurrent approves: only one wins).
5. **Purge raw** (best-effort, admin client): delete `storage_path` from
   `call-recordings`; on success set `raw_audio_purged_at=now()`. A failure does
   NOT roll back the approval (the recording is correctly shared; raw lingers but
   is owner/admin-only). Log + a retry path (cron/manual) sweeps stragglers.
6. Return ok.

**Why purge AFTER the flip (not before):** if the flip fails we keep raw (safe,
re-approvable); if purge fails we're shared without raw (the goal) and raw is a
locked straggler. The unsafe ordering would be the reverse only if flip could
fail after purge AND leave a sharable-but-broken state — it can't (no redacted =
no peer playback via the RLS join).

## 6. Span edit + re-mute

- Admin edits `redaction_spans` (add a missed span heard in the muted audio,
  remove a false bleep) via an edge fn `update-redaction-spans` (or a guarded
  client UPDATE). The **trigger does the re-arming automatically**: any change to
  `redaction_spans` bumps `spans_version` and forces
  `audio_redaction_status='pending'`, even on a direct PostgREST PATCH that skips
  the edit edge fn. The edit fn then fires `redact-call-audio` (force) so muting
  actually runs; if it's a raw PATCH the cron sweeper (or a manual re-mute) picks
  up the `pending` row. (Defense in depth: the edge fn may also set those columns,
  but correctness no longer depends on it doing so.)
- The worker re-mutes **from the RAW original** (never the already-muted file —
  avoids compounding and lets a removed span restore that audio) and writes back
  `muted_spans_version = <the spans_version it muted>`.
- Approve is blocked until `audio_redaction_status='done'` again AND
  `muted_spans_version = spans_version`.
- **Only possible pre-approval** (raw still exists). After approval raw is purged.

## 7. Reject

- `needs_review → rejected` (admin/owner). Stays locked forever; excluded from the
  review queue and the shared library. Raw + transcript remain (locked,
  owner/admin) — reviewer chose not to share. A later `rejected → needs_review`
  re-opens it. (Reject does NOT purge — the owner may still want their own copy.)

## 8. Review queue + UI (admin-gated)

- New route/page `Review queue`: lists `redaction_status='needs_review'` for the
  acting IMO (admins only — gate the nav + route; RLS already hides needs_review
  from peers). Columns: agent, date, #spans, `redaction_detector` (⚠️ badge if
  `regex_only`), `audio_redaction_status`.
- Review detail (extend `CallReviewDetailPage` or a dedicated screen):
  - plays the **muted** audio (already the default when `redacted_storage_path`
    set); the reviewer confirms no PII is audible.
  - shows the redacted transcript + a spans timeline.
  - **auto-highlight residual digit-runs** still visible in the *redacted*
    transcript (cheap client-side regex: any `\d{4,}` or SSN/card-shaped leftover
    that survived) so a reviewer's eye is pulled to a number the detector missed —
    a number on screen almost certainly means a number still audible. This is a
    review aid, not a gate.
  - **surface the human-typed fields for scrub** (§11.5): `caller_name`, the call
    title/description, and `kpi_call_markers.note` shown together with an inline
    "these will be visible IMO-wide — scrub client identifiers" note (and edit
    controls if we choose masking/edit).
  - **prominent warning** when `redaction_detector='regex_only'` (Claude pass
    didn't run → scrutinize harder) or `audio_redaction_status='failed'`.
  - actions: **Add/remove span** → re-mute; **Approve** (disabled until
    `audio_redaction_status='done'` & `muted_spans_version = spans_version`);
    **Reject**.
- **Disable "re-transcribe" once `redaction_status='approved'` (and especially once
  `raw_audio_purged_at` is set).** Re-*analyze* (re-run AI over the already-redacted
  transcript) is always safe; re-*transcribe* needs the RAW audio and, on a purged
  row, **bricks the recording** (no source → clean `failed`, drops out of shared —
  S7). Gate the button: re-analyze allowed anytime; re-transcribe hidden/disabled
  when approved or purged.
- Never expose the raw audio in this UI — review is on the muted copy.
- **(Enhancement) listen audit.** If/when peers can play approved calls, consider
  logging plays to `kpi_call_listens` (who, which recording, when) so a
  late-discovered missed span has an exposure trail. Not a Phase 3 blocker; note it.

## 9. Backfill the 34 existing recordings

These are `redaction_status='pending'`, hold **raw transcripts (PII)**, **no
spans**, never muted, and their **AI fields (`ai_summary`, `objection_events`,
`ai_key_moments`, `caller_existing_coverage`) + `kpi_word_track_detections` were
generated from the RAW transcript pre-Phase-1 → they contain PII**.

Backfill = a privileged batch (script in `scripts/`, or an admin "Backfill"
action) that, per recording:
1. **Null the stale AI-derived fields** up front (`ai_summary`, `ai_key_moments`,
   `objection_events`, `caller_existing_coverage`) AND delete its
   `kpi_word_track_detections` rows — so old PII can't survive if a later step
   fails.
2. Re-invoke `transcribe-call-recording` (re-arms → Phase 1 redacts transcript +
   spans → fires analyze [regenerates clean AI fields] + redact-call-audio
   [mutes]) → lands `needs_review`.
3. Owner reviews + approves through the queue.

**Edge cases in backfill:**
- **`audio_deleted_at` set** (retention cron purged the raw audio after 180d):
  re-transcribe is impossible (no audio for Deepgram). For these, run a
  **transcript-only redaction** (regex over the stored raw `transcript_text`/
  segments via the shared `pii-redaction` util) + null the AI fields, and leave
  them `rejected`/locked (cannot be shared without muted audio). Flag them in a
  report — do NOT silently skip.
- **Rate limits**: `transcribe-call-recording` is 10/hr/user. A 34-row backfill
  must run as a privileged batch that does NOT go through the per-user limiter
  (service-role invocation, or a dedicated backfill path), spaced to respect
  Deepgram/Anthropic. Log progress; no silent truncation.
- **Anthropic down** → `regex_only` detector → still `needs_review`, flagged for
  closer human review. Acceptable (human gate).

## 10. SECURITY THREAT MODEL (enumerated)

| # | Threat | Mitigation |
| --- | --- | --- |
| S1 | Owner self-approves own PII call to the whole IMO via direct PATCH (bypassing edge fn) | **DB trigger** forbids `→approved` unless caller is IMO-admin/super-admin |
| S2 | Approve an unmuted/again-raw recording (no redacted file / audio not done) | trigger + edge fn require `audio_redaction_status='done'` AND `redacted_storage_path NOT NULL` |
| S3 | Approve after editing spans but before re-muting → new PII unmuted | trigger bumps `spans_version` + forces `audio_redaction_status='pending'` on any `redaction_spans` change; approve requires `muted_spans_version = spans_version` (clock-free; survives a direct PATCH) |
| S4 | `pending → approved` skips redaction entirely | trigger forbids; only `needs_review → approved` |
| S5 | Backfilled row's stale AI fields / detections still hold raw PII when shared | backfill NULLs AI fields + deletes detections BEFORE re-analyze; approve requires `redaction_detector NOT NULL` (Phase-1 ran) |
| S6 | Raw audio retained after approval = lingering liability | purge raw on approve; cron sweeps purge failures; `raw_audio_purged_at` audited |
| S7 | Re-transcribe an approved+purged recording (no raw) → error/false state | transcribe detects missing raw (signed-URL 404 / `audio_deleted_at`) → clean `failed`, recording leaves `approved` (re-arm) so it isn't shared while broken |
| S8 | Peer reads redacted object for an approved row but path mismatch lets them read another | RLS join is byte-exact (`redacted_storage_path = storage.objects.name`); path is `{agent_id}/redacted/{id}.mp3` set by edge fn = worker upload path |
| S9 | Non-admin opens the review queue / approve endpoint | route+nav admin gate; edge fn admin check; RLS hides `needs_review` from peers |
| S10 | Concurrent approves / approve racing re-mute | status-guarded atomic claim; approve requires `done`+current |
| S11 | Reject path leaves data shared | `rejected` is not `approved` → all IMO gates stay closed |
| S12 | Super-admin acting across IMOs approves wrong tenant | `super_admin_in_scope(imo_id)` + acting-IMO scoping |
| S13 | Human-typed PII (caller_name, marker notes, title) shared on approval — pipeline never scans it | Decision §11.5: surface these fields in the review screen for manual scrub and/or mask `caller_name` for IMO readers |
| S14 | Service-role / NULL-uid write flips a row to `approved` with no human gatekeeper | trigger rejects `→approved` when `auth.uid()` IS NULL (see §3 trigger rules) |
| S15 | `rejected` / `audio_deleted_at` rows still hold raw PII transcript at rest | "no raw PII at rest" invariant (§14): rejected & deleted-audio rows get transcript-only regex redaction; only owner/admin can read them; never IMO-shared |

## 11. Open decisions for the user (resolve at session start)

1. **Who can approve?** (recommended: **IMO admin or super-admin only** — a
   gatekeeper distinct from the uploader; the trigger enforces this). Alternative:
   owner + admin. *Approving shares a client call to the whole agency, so admin-only
   is the safer default.*
2. **Raw purge timing:** purge **immediately on approve** (recommended — strongest
   data-minimization) vs keep raw N days then cron-purge (allows re-processing).
3. **Reject semantics:** new `rejected` status (recommended) vs reuse `archived_at`.
4. **Backfill trigger:** one-shot script run by us vs an in-app admin "Backfill"
   button. (Recommended: script first for the 34, button later if recurring.)
5. **Human-entered free-text PII (caller_name, marker notes, call title).** The
   redaction pipeline only cleans the *transcript + audio*. `caller_name` (often a
   real client name), `kpi_call_markers.note`, and any manual title/description an
   agent typed are **never scanned** and become **IMO-visible on approval**. Decide:
   (a) leave as-is and tell reviewers "scrub the title/notes/caller name before
   approving" (the review UI should surface these fields prominently for that),
   (b) auto-mask `caller_name` to initials/first-name for IMO-wide readers, or
   (c) run the regex `pii-redaction` util over these fields too at approve time.
   Recommended: at minimum **(a) + show the fields in the review screen**; (b) is a
   cheap strong win for client names. This is a real residual hole — don't ship
   Phase 3 without an explicit call here.
6. **Span-edit authority:** who may edit `redaction_spans` / re-mute — same
   admin-only gate as approve (recommended), or also the owner/upline? (Editing
   spans before approval is lower-risk than approving, but a malicious edit that
   *removes* a real span then approves is the attack — keep it admin-only and the
   trigger's "edit re-arms to pending" makes the removed-span-then-approve race
   impossible without a fresh mute.)

## 12. Verification plan

- **Trigger unit tests** (SQL/local RLS sessions) — the full matrix:
  - every forbidden transition in §3 RAISEs; every allowed one passes.
  - non-admin `→approved` blocked even via direct UPDATE; `pending→approved` blocked.
  - **service-role / NULL-`auth.uid()` write cannot set `redaction_status='approved'`** (S14).
  - `→approved` blocked when `audio_redaction_status<>'done'`, when
    `redacted_storage_path IS NULL`, when `redaction_detector IS NULL`, and when
    `muted_spans_version <> spans_version`.
  - **editing `redaction_spans` (incl. a raw PostgREST PATCH) bumps `spans_version`
    by 1 and forces `audio_redaction_status='pending'`** — then a stale-version
    approve is blocked until a fresh mute sets `muted_spans_version=spans_version`.
  - worker-shaped write (only `audio_*`/`redacted_storage_path`/`muted_spans_version`,
    `redaction_status` unchanged) passes untouched.
- **Live RLS proof** (mirror Phase 0 method): approve a test recording → a pure
  peer can now SELECT the row + the redacted object, and STILL cannot access raw
  (purged + policy). A `needs_review` peer sees nothing.
- **Span-edit → re-mute → approve** happy path on a test recording.
- **Backfill dry-run** on ONE recording first; confirm AI fields cleared + transcript
  redacted + muted + lands `needs_review`; confirm an `audio_deleted_at` row takes
  the transcript-only path.
- `deno check`, `npm run build`, worker tests green. Deploy all new/changed edge
  fns (`approve-call-redaction`, `update-redaction-spans`, modified transcribe if
  touched). **Don't forget to deploy edge fns.**
- Owner E2E: review a real `needs_review` recording → approve → confirm a regular
  agent can now play the muted copy and the raw is gone.

## 13. Files (create / modify)

- **Migration**: cols + `rejected` enum usage + `BEFORE UPDATE` guard trigger.
- **Edge fns**: `approve-call-redaction/` (new), `update-redaction-spans/` (new),
  possibly a `backfill-call-redaction` batch or a `scripts/` node script.
- **transcribe-call-recording**: handle missing-raw (purged) → clean failure (S7).
- **Frontend**: review-queue page + nav (admin-gated); `CallReviewDetailPage`
  span editor + approve/reject/re-mute controls + detector warnings; hooks
  (`useReviewQueue`, `useApproveRedaction`, `useUpdateSpans`, `useRejectRecording`).
- **Types**: hand-edit `database.types.ts`.
- **Backfill script** + a report of audio_deleted_at rows.

## 14. Non-negotiables (carry into implementation)

- Enforce approval authority + preconditions in the **DB trigger**, not only app code.
- Raw PII never re-exposed: approve requires redaction ran + audio muted + current
  (`muted_spans_version = spans_version`).
- **No raw PII at rest, invariant across ALL terminal states.** Approved rows: raw
  purged. Rejected rows AND `audio_deleted_at` rows: their stored `transcript_text`/
  segments must still be the *redacted* version (never the raw) and stay
  owner/admin-only — a row that can never be muted (no audio) must never be
  IMO-shared. Backfill enforces this for the 34.
- Human-typed fields are out of the pipeline's reach — resolve §11.5 (caller_name /
  marker notes / title) before approval can share a call.
- Backfill clears stale AI/detection PII before re-processing.
- Purge raw on approve; never block approval on purge failure; audit + retry.
- Never log transcript / audio / signed URLs (status codes only).
- Regen types by hand; deploy every edge fn; verify with live RLS + real E2E.
