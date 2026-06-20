# CONTINUATION — Inbound-CRM Phase 3, screen-pop UX round (resume here)

**Written:** 2026-06-19. **Branch:** `feat/inbound-crm-phase3`. **HEAD:** `f8abda2b` (`fix(inbound-crm): Phase 3 review fixes — pop reliability + save-failure detection`).
**Deep record:** `~/.claude/projects/-Users-nickneessen-projects-commissionTracker/memory/project_inbound_crm_phase0_build_20260617.md`.
**Punch-list:** `docs/inbound-lead-feature/PHASE3_REVIEW_PUNCHLIST.md` (tracks the 14 review findings; #3 + #4 are the items being closed now).

This session was wrapped to start fresh. Pick up exactly here — do **not** re-do the committed work below.

---

## What this feature IS (one paragraph)

The Standard HQ app is the **CRM/server for an external dialer** (RingCentral / InTelemedia want it
instead of Salesforce). An inbound call routes to an agent → a DB row lands in `inbound_calls` →
a Postgres trigger **broadcasts** a screen-pop to that agent's browser → a **full-screen intake
modal** takes over the screen with the caller's client record + a 4-tab form, all in exact parity
with the Clients detail page (same shared `clientForm/` components). The agent works the call,
captures disposition (call type / carrier / notes), edits the client, optionally starts a pending
application, and saves. Feature is **INERT in prod** (no edge fns deployed, no creds) — local-only.

---

## CRITICAL CONSTRAINTS (do not violate)

1. **Do NOT change ANY end-to-end logins.** Local login: `epiclife.neessen@gmail.com` / `N123j234n345!$!`.
   E2E scripts read `E2E_EMAIL`/`E2E_PASSWORD` from `.env.local`; `BOARD_BASE=http://localhost:4317`.
2. **Migrations only via `./scripts/migrations/run-migration.sh`** — NEVER `psql` directly. Queries via
   `./scripts/migrations/run-sql.sh "…"`. Bare run-sql.sh targets **LOCAL**.
3. **Supabase REVOKE must include `anon` + `authenticated`** (REVOKE FROM PUBLIC alone is insufficient on Supabase).
4. **Never read `src/types/database.types.ts` whole** (~162k tokens; a hook blocks it). Use `node scripts/dbtype.mjs <name>`.
5. **A concurrent session owns the `policies/*` + theme work in the working tree.** Leave those files
   alone and DO NOT commit them (see "Working tree" below). Only `git add` the inbound-crm files.
6. **No psql for function changes; no `npm run generate:types`** unless schema truly changed (it reformats 34k lines).

---

## Working tree state (VERIFY with `git status --short` first)

At wrap time, uncommitted/untracked split into **MINE (commit these)** vs **CONCURRENT SESSION (do NOT touch/commit)**:

**MINE — inbound-crm pop UX (commit when done):**
- `src/contexts/InboundCallContext.tsx` — ✅ rewritten (waitingCall queue; see below). Uncommitted.
- `src/features/inbound-crm/components/InboundCallModal.tsx` — ✅ #3 "Call ended" banner done; ⏳ still
  needs to **consume `waitingCall` + `acceptWaiting`** (currently destructures only `{ activeCall, dismiss }`).
- `scripts/verify-call-ended-keeps-open.py` — untracked, mine (the #3 E2E flip proof).

**CONCURRENT SESSION — policies insights-band + light-mode (DO NOT COMMIT):**
- `src/features/policies/PolicyDashboard.tsx`, `src/features/policies/PolicyList.tsx`,
  `src/features/policies/hooks/usePolicies.ts`, `src/types/client.types.ts`
- `src/features/policies/components/PolicyInsightsBand.tsx`, `src/features/policies/utils/policyInsights.ts`,
  `src/features/policies/utils/__tests__/policyInsights.test.ts`, `scripts/policies-noscroll-check.py`
- `carrier_product_named.csv`, `docs/epic-life/`, `docs/inbound-lead-feature/client-info-screenshots-dashboard/`

→ When committing, **explicitly `git add` only the inbound-crm files** — never `git add -A` / `git add .`.

---

## Architecture — the broadcast screen-pop (already built + committed)

The pop was migrated from `postgres_changes` to **Broadcast-from-trigger** for scale (no single-threaded
WAL reader, no per-subscriber RLS sweep). Committed in `b359ef8a` (perf) + `f8abda2b` (review fixes).

- **Per-agent PRIVATE topic** `inbound:<agent_id>`. DB trigger `inbound_call_broadcast()` calls
  `realtime.send(payload, 'inbound_call', 'inbound:<agent_id>', private => true)`.
- **RLS on `realtime.messages`** (policy `inbound_broadcast_read_own`): `realtime.topic() = 'inbound:'||auth.uid()`
  → each agent only ever receives their own pops; no client-side tenant filtering.
- **Private channels require** `supabase.realtime.setAuth(session.access_token)` **BEFORE** `.subscribe()`
  (auto-auth races subscribe → silent no-messages). This is in `InboundCallContext`.
- **Trigger fires the pop on:** `(INSERT, status='ringing', fired_pop)` **OR** `(UPDATE, status='ringing',
  OLD.agent_id IS NULL → NEW.agent_id NOT NULL)` (late agent-resolve via `ON CONFLICT`). Dismiss broadcast on
  `status → 'ended'`. Payload includes `imo_id` (the modal's `useActiveCallTypes` needs it).
- **Rehydration on (re)subscribe:** a broadcast is fire-and-forget (no replay) → a pop fired during page-load /
  reconnect / the auth-subscribe gap is otherwise lost. On `SUBSCRIBED`, the context queries the agent's
  currently-`ringing` call and pops it if nothing is shown.
- **Scale fixes also shipped:** rate-limit **64-shard** key in `crm-leads` edge fn (breaks the single-row
  `INSERT…ON CONFLICT` lock convoy; proven 5.9× = 2722→16129 tps); `REPLICA IDENTITY DEFAULT` on `inbound_calls`
  (less WAL); `inbound_calls` dropped from the `supabase_realtime` publication (broadcast replaces postgres_changes).

### Migrations (ALL committed; applied LOCAL-only — go-live bundle)
Deploy order at go-live (prod): **trigger mig → frontend build/deploy → publication-drop mig**.
- `20260619134243_inbound_calls_replica_identity_default.sql`
- `20260619134244_inbound_call_broadcast_pop.sql` (trigger + RLS on realtime.messages)
- `20260619150628_inbound_calls_drop_from_publication.sql`
- `20260619165354_inbound_call_broadcast_late_resolve.sql` (the INSERT-or-late-UPDATE pop branch)
- Earlier go-live bundle (still LOCAL-only): `20260618093314_inbound_crm_phase5_hardening.sql`,
  `20260618132257_inbound_crm_phase3_disposition.sql`, `20260618185726_inbound_crm_client_intake.sql`,
  `20260618060715_inbound_crm_guard_overwrite_on_redelivery.sql`.

---

## The #3 / #4 product decisions (owner-approved)

The two remaining HIGH punch-list items were **UX decisions**, now decided:

- **#3 — caller hangs up mid-intake:** **KEEP the modal open**, just flip the header to a **"Call ended —
  finish & save"** state (red accent). The intake outlives the call; the agent finishes, saves, closes
  manually. NO auto-dismiss, NO work wiped. ✅ **IMPLEMENTED** in `InboundCallModal.tsx` (`ended` flag,
  `accent = ended ? "--red" : "--green"`). Proven by `scripts/verify-call-ended-keeps-open.py` (the modal
  stays open `still_open=True` every run; the banner flip is console-proven — see "gotcha" below).

- **#4 — a 2nd live call arrives while an intake is open:** **NEVER clobber the open intake.** Queue the
  2nd call as `waitingCall` and show a small **"call waiting"** indicator the agent can click to switch.
  This is the fix for the owner's bug report *"when a call comes through, it ends the call im on."* The
  context layer is ✅ done; the **modal indicator UI is the main remaining task.**

  Both sub-cases route through the same queue:
  - Agent is **live on call A** (A still ringing) → call B arrives → B is queued as "waiting", A stays open.
  - Agent is **finishing call A** (A ended, modal still open per #3) → call B arrives → B is queued; agent
    saves A, then clicks the waiting indicator (or closes A) to switch to B.

---

## `InboundCallContext.tsx` — already rewritten (reference, don't redo)

Context value is now `{ activeCall, waitingCall, dismiss, acceptWaiting }`. Key mechanics:
- `activeIdRef` mirrors the open call's id, read synchronously inside the broadcast closure (which would
  otherwise see a stale `activeCall`) to decide **pop vs queue**.
- Broadcast handler: `ended` → mark the OPEN call `ended` (keep open) + drop a queued call that ended;
  fresh ringing pop → `if (activeIdRef.current && activeIdRef.current !== row.id) setWaitingCall(row); else { activeIdRef.current = row.id; setActiveCall(row); }`.
- `dismiss()` promotes `waitingCall` → active (or null). `acceptWaiting()` switches to the queued call now.
- Single-subscribe guard (tears down a pre-existing channel on the topic before re-opening — StrictMode /
  auth re-render safe), `setAuth` before subscribe, rehydration on `SUBSCRIBED`. Debug `console.info` logs removed.

---

## PENDING WORK (do these, in order)

### 1. Wire the waiting-call indicator into `InboundCallModal.tsx`
- Change `const { activeCall, dismiss } = useInboundCall();` → also pull `waitingCall, acceptWaiting`.
- Add a compact, on-brand **"Call waiting"** indicator in the header (right cluster, near the badge) that
  appears only when `waitingCall` is set: e.g. a pulsing amber chip `↳ 1 call waiting · <name/phone>` that
  on click calls `acceptWaiting()`. Use existing primitives/tokens (`tint`, `var(--amber)`, `fmtPhone`).
  Keep it dense — match the header's existing chip styling (`tint(badgeVar,14)` pattern).
- Edge: when the agent `dismiss()`es or saves+closes call A, the queued B auto-promotes (already handled in
  context). The indicator just gives an explicit "switch now" affordance.
- Do NOT block/replace the open intake; the whole point is non-destructive queueing.

### 2. Add timestamps to "Recent Calls" (owner: *"can't tell when any of those calls actually came through"*)
- `useInboundCallIntake.ts`: add `created_at` to the `InboundCallHistoryRow` interface AND to the
  `.select("id, call_start, call_program, status, duration, billable, notes")` → add `, created_at`.
- `format.ts`: add a `fmtDateTime(d?)` helper — date **+ time** (e.g. `dt.toLocaleString([], {month:'short',
  day:'numeric', hour:'numeric', minute:'2-digit'})`), reusing `toLocalDate`.
- `ClientRecordRail.tsx` (line ~137): replace `{h.call_start ? fmtDate(h.call_start) : "In progress"}` with
  `fmtDateTime(h.call_start ?? h.created_at)` (fall back to `created_at` when a call never got a `call_start`,
  instead of the unhelpful "In progress").

### 3. Verify + commit (MINE only)
- `npm run typecheck` = 0, `npm run build` green, lint clean (no `@/services`/supabase imports leaking into
  feature components — data access stays in hooks).
- Rebuild is REQUIRED before any Playwright check: `BOARD_BASE` serves the vite **preview of `dist/`**, so
  `npm run build` first. Then re-run `scripts/verify-call-ended-keeps-open.py` (modal stays open + flips) and
  optionally `verify-rehydrate.py` / `verify-broadcast-pop.py`.
- Commit ONLY: `src/contexts/InboundCallContext.tsx`, `src/features/inbound-crm/components/InboundCallModal.tsx`,
  `src/features/inbound-crm/components/clientForm/ClientRecordRail.tsx`,
  `src/features/inbound-crm/components/clientForm/format.ts`,
  `src/features/inbound-crm/hooks/useInboundCallIntake.ts`, `scripts/verify-call-ended-keeps-open.py`.
  Co-author trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

### 4. Re-iterate the #4 design to the user (they asked to confirm)
Explain plainly, both sub-cases (live-on-call vs finishing-an-ended-intake): a 2nd call NEVER closes the open
one; it queues as "call waiting" with a clickable indicator; the queued call also gets a timestamp in Recent
Calls. Confirm the owner's bug (*"a new call ends the call I'm on"*) is fixed by the no-overwrite queue.

---

## Test / proof inventory (all under `scripts/`)
- `verify-call-ended-keeps-open.py` — #3 E2E: modal stays open + flips to "Call ended". **Gotcha:** the
  header is CSS `text-transform:uppercase` so Playwright `inner_text` returns UPPERCASE → use
  case-insensitive `.lower()` checks. The flip-id E2E was confounded earlier because the **user was logged
  in as the same agent firing calls concurrently** (shared `inbound:<agent>` topic) — not a code bug; the
  keep-open core passed every run. Run when the user is NOT also firing test calls.
- `verify-rehydrate.py` — pop fired BEFORE subscribe still appears (rehydration). PASS.
- `verify-broadcast-pop.py` — basic broadcast pop E2E.
- `test-inbound-scale-fixes.sql` — 9/9 incl. T8/T9 (late agent-resolve pop branch).
- `bench-ratelimit-shard.sh` — proves the 64-shard rate-limit (2722→16129 tps).
- `inbound-crm-benchmark.sh` — pgbench DB hot-path. `crm-e2e-local.sh` — 28-check E2E harness.
- `crm-fire-test-call.sh` — seeds a ringing call (named client + policies + a prior ended call) to drive the
  modal. `crm-simulate-inbound.{sh,ts}` — 10-user inbound simulator.

## Docs (under `docs/inbound-lead-feature/`)
- `PHASE3_REVIEW_PUNCHLIST.md` — 14 findings; #3/#4 status. Update #3/#4 → ✅ when this round commits.
- `SCALE_REVIEW.md` — perf/scalability review (1,000 concurrent calls); the post-launch consolidation RPC
  `crm_save_inbound_intake` (folds the 3 non-transactional writes + find-or-create) is scoped here.
- `STANDARD_HQ_INBOUND_CRM_EXECUTIVE_BRIEF.md` — CEO/president brief (RingCentral + InTelemedia meeting).

## Deferred (post-this-round; not blocking)
- Modal save is **3 non-transactional writes** (identity + intake + disposition) → fold into the
  consolidation RPC `crm_save_inbound_intake` (find-or-create handles the "New caller" null-client_id case
  that currently discards typed intake). Post-launch (SCALE_REVIEW.md).
- Go-live: apply the LOCAL-only migration bundle to prod (order above) + deploy edge fns (`config.toml
  verify_jwt=false` + **gateway IP rate-limit in the SAME change** — token endpoint does cost-12 bcrypt;
  unauthenticated flood = all-tenant Postgres DoS) + secrets + first credential. Verify pending policies/
  advances are excluded from earned metrics.

## After committing
- Update the memory index line for `project_inbound_crm_phase0_build_20260617.md` with this round's result.
- Sync any new/changed `docs/` to the Obsidian vault: copy into
  `../_knowledge-vault/raw-sources/commission-tracker/`, fold into the wiki topic page + `log.md` + bump
  `index.md`, then `../_knowledge-vault/scripts/wiki-lint.sh -p commission-tracker` (must exit 0).
