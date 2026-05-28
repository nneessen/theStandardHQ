# Platform Sunset / FFG Revocation — Production Code RE-REVIEW (2026-05-28)

Date: 2026-05-28
Reviewer: independent re-review pass (rubric: `docs/guides/code-review.md`, Production-Grade Reviewer)
Scope: **sunset-only diff** `git diff 13682067..HEAD` — 41 files, ~5.3k insertions, 9 commits.
Billing workstream (`PricingCards`, `BillingPage`, `subscription-availability`, `RouteGuard`, …) is
**out of scope** (separate PR) and was not reviewed.

This is a **re-review**. The prior pass (`platform-sunset-code-review-2026-05-27.md`) returned
**Request Revisions** with one blocking (B1) and several should-fix (M1/M2/M3/M4) findings, all since
fixed, and the backend deployed to **production, dormant** (0 IMOs revoked). I formed my own view
from the code first, then confirmed the prior findings against the source and the live remote
catalog — not the report.

## Verdict: **Approve with Required Changes**

The architecture is sound and the prior B1/M1/M2/M3/M4 fixes are **genuinely present in the code**, not
just claimed. I found **no new blocking defect** and **no cross-tenant leak**. The sentinel-not-NULL
chokepoint, deny-by-default RLS gate, FK-safe atomic wipe, edge-function auth boundaries, and pinned
imports all hold up. Because the feature ships **dormant**, merging is safe.

The "Required Changes" are **gates on the operational revoke flip, not the merge** — they address a
real verification gap and two robustness/threat-model items below. None block a dormant merge.

---

## Verification performed (execution, not just typecheck)

Per the rubric's "execution required" rule, against **remote prod** (read-only; no mutation, no
revoke, no wipe):

1. **Wipe FK model — verified empirically.** Enumerated all 118 FKs referencing `public.user_profiles`
   with their `ON DELETE` action + NOT NULL flag. **Every** registry table marked `wipe:"cascade"` has
   a real `ON DELETE CASCADE` FK; **all 17** `NO ACTION` refs to `user_profiles` are covered by
   `ACTOR_REFS_TO_NULL` / `ACTOR_REFS_TO_REASSIGN`; there are **no `RESTRICT`** refs. So the
   `user_profiles` delete cannot be blocked by an unhandled FK, and no cascade-marked table silently
   survives. The migration's "verified empirically" claim is accurate as of today.
2. **Gate completeness tripwire** (`scripts/check-revocation-gate-completeness.sql`) on remote → **0
   rows** (no ungated RLS table outside the 5-table allowlist).
3. **Dormant state** confirmed: `SELECT count(*) FROM imos WHERE access_revoked_at IS NOT NULL` → **0**.
4. **Matview exposure** (`relkind='m'`): the 8 `mv_*` carry INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/
   TRIGGER/MAINTAIN grants to `authenticated`/`anon` but **no SELECT** — so they are **not readable**
   via PostgREST. The kill-switch matview blind-spot does **not** leak. (Migration B's comment says
   "granted to neither" — imprecise; the security-relevant property, no SELECT, holds.)
5. **Deployed function bodies**: `wipe_user_business_data` on remote contains both the refuse-super-admin
   and the refuse-non-revoked guards; `is_access_revoked`, `get_effective_imo_id`, `wipe_…` are all
   `SECURITY DEFINER`.
6. **Public-surface completeness (Part 4)**: enumerated every anon-EXECUTE `SECURITY DEFINER` function
   whose body reads `imos` but omits `access_revoked_at` → 4 hits. Resolved each:
   - `get_imo_override_summary`, `get_imo_dashboard_metrics` — derive scope from `get_my_imo_id()`,
     which returns the **sentinel** for a revoked user → empty result. **Gated by the chokepoint; not
     a leak.** (Good evidence the sentinel design also protects derived-scope RPCs Part 4 didn't touch.)
   - `enforce_user_profile_imo_consistency` — a trigger function; anon-EXECUTE is irrelevant.
   - `get_imos_with_system_automations(text)` — **no internal auth guard, no revoked/`is_listed`
     filter**, and (body read) returns `DISTINCT pa.imo_id, i.name` for **every** IMO with an active
     matching automation → multi-row, anon-reachable. This is the **"tell"** surface, not a benign id
     leak → upgraded to **M-D** (below).
7. Build green / parity + `useRevocation` + `SunsetGate` + `wipe-orchestration` vitest green per prior
   evidence (re-confirmed the parity test now parses the SQL arrays **and** compares to the registry —
   the SQL↔TS drift gap I initially suspected is closed).

---

## Prior findings — independently confirmed FIXED

- **B1** (kill switch hid its own detection signal): `useRevocationStatus` calls the
  `is_access_revoked` RPC (definer, bypasses the gate), not the gated `imos` row. `useRevocation.ts:52`.
- **M1** (storage purged before the guarded wipe): `wipeThenPurge` runs the wipe RPC first and only
  invokes `purge()` after it succeeds (or the profile is already gone). `wipe-orchestration.ts:105`.
- **M2** (recruit gate fails open on null/wiped inviter): checks the **effective** IMO
  `inviterImoId ?? FFG_SENTINEL_IMO_ID` before `createUser`. `complete-recruit-registration/index.ts`.
- **M4** (orphaned unrecoverable recovery archive): `resolveRecoveryArchive` adopts an orphaned
  `recovery/{user}/` folder + applies all-or-nothing copy with rollback. `wipe-orchestration.ts:40`.
- **M3** (types leak): committed `database.types.ts` is self-consistent (build green).

---

## New / outstanding findings

### Medium (should-fix; gate the operational flip, not the merge)

- **M-A — No automated FK-safety tripwire for the wipe.** The wipe's correctness depends on a hand-
  maintained model of every FK to `user_profiles` (cascade vs null vs reassign vs explicit). I verified
  it holds **today**, but it has no guard against **schema drift**: a future table with a NOT-NULL
  `NO ACTION` FK to `user_profiles` → the entire wipe `RAISE`s and rolls back (fails loud — bad but
  safe); a future `user_id` table with **no FK** (like `commissions`) and not added to the explicit
  list → its rows **silently survive** the wipe (silent retention of a revoked user's data). Add a
  catalog tripwire (sibling to the gate-completeness check) asserting every `NO ACTION`/`RESTRICT` FK
  to `user_profiles` is in the null/reassign registry, and ideally that every `user_id`-bearing public
  table is either cascade-FK'd or in the explicit list. Wire it into the parity test's `RUN_DB_TESTS`
  path.

- **M-B — Revocation lockout is RLS-layer; a revoked user keeps a valid JWT.** The gate denies the
  user's own JWT at the RLS layer and patches the anon public surfaces, but a revoked user is **not
  signed out** and their access token stays valid until expiry/refresh. Generic authenticated edge
  functions that read via **service-role** (e.g. `close-kpi`, gmail sync, lead-heat, chat-bot) bypass
  RLS and are **not** uniformly gated, so a revoked user could still invoke them. Severity is tempered:
  it is the user's **own** IMO data (which the flow explicitly offers them as an export), and I found
  **no cross-tenant path** (derived-scope RPCs are sentinel-gated; FFG is `is_listed=false`). Recommend:
  (a) document this as accepted residual, and/or (b) force session revocation (sign-out / refresh-token
  revoke) on the flip so the residual window closes. Not blocking.

- **M-C — No end-to-end runtime exercise of the integrated flow.** B1 has unit tests but no *rendered*
  revoked session; M1/M2/M4 are unit-tested but the live edge-fn chain (activate → drain export →
  signed-URL download → confirm-and-wipe → auth delete → audit) has **not** been run against a seeded
  revoked user on a hosted stack (the local stack can't DELETE storage objects / resolve signed URLs).
  This is the prompt's own stated gap. **Required before any real revoke flip**: a seeded staging
  rehearsal ("Option B"). Dormant merge remains safe.

- **M-D — `get_imos_with_system_automations(text)` is an ungated "tell" surface (fix in this PR).**
  Body (read from remote): `SELECT DISTINCT pa.imo_id, i.name FROM pipeline_automations pa JOIN imos i
  … WHERE pa.trigger_type = p_trigger_type AND pa.is_active` — **no auth guard, no `is_listed`, no
  `access_revoked_at`**, anon-EXECUTE, **returns multiple IMOs**. The feature's central requirement is
  that a revoked FFG user "must not be able to tell the platform continues for others." A revoked (or
  pure-anon) caller can enumerate every active IMO with a matching automation by trigger type — that is
  exactly the tell, and it also keeps surfacing the revoked IMO's own name. Part 4 gated the 7 chosen
  RPCs but missed this 8th. Real-world exploitability today is bounded (Epic Life is `is_listed=false`
  and likely has no matching active automation, so the *cross-tenant* tell may currently return only
  FFG itself), but it is a latent breach of the core invariant and a one-line fix consistent with Part
  4: add `AND i.access_revoked_at IS NULL AND i.is_listed = true`, or revoke `anon`. **Recommend fixing
  in this PR**, not deferring — it lives in the same Part-4 surface class.

- **M-E — Deny-by-default RLS predicate calls `is_access_revoked` per-row (perf regression).** Migration
  B's comment claims "one cheap cached EXISTS per query," but `EXPLAIN` under the `authenticated` role
  on `policies` shows `NOT is_access_revoked(<jwt sub>)` in the **Seq Scan Filter** — i.e. evaluated
  **per scanned row**, not as an InitPlan (the only InitPlan in the plan is `auth.uid()` itself). Since
  `is_access_revoked` is `SECURITY DEFINER` SQL, Postgres will **not inline** it, so it is a function
  call (+ 2 PK lookups) per row, on **every** authenticated query across all **194 gated tables**, even
  in the dormant (non-revoked) common case. This repo has had **two prod outages from RLS-function pool
  exhaustion** (CLAUDE.md), and the rubric explicitly calls out connection-pool safety. **Fix:** wrap
  the call in a scalar subquery so the optimizer hoists it to a single per-statement InitPlan —
  `USING (NOT (SELECT public.is_access_revoked(auth.uid())))` (the standard Supabase RLS pattern). One
  evaluation per query instead of one per row, across all 194 tables. Low-risk, high-leverage; do it
  before the gate is ever load-bearing.

### Low (carried forward / confirmed still open)

- **L1** — `account-lifecycle-cron` returns HTTP 200 even when every task pushed to `summary.errors`; a
  fully-failing sweep is invisible to `cron.job_run_details`. Return non-200 / `degraded` when
  `errors.length > 0`.
- **L5** — `invoke_account_lifecycle_daily()` lacks `REVOKE … FROM PUBLIC` (matches the loose existing
  cron pattern; the service-role key is only read inside the definer body, not exposed).
- **L6 (doc nit)** — Migration B's comment that the `mv_*` are "granted to neither authenticated nor
  anon" is imprecise: they carry non-SELECT grants. Tighten the wording to "no SELECT grant" so a
  future reader doesn't `GRANT SELECT` believing the slate is clean.
- **L7 (very low)** — `confirm-and-wipe-account` could double-INSERT an `account_deletion_log` row if
  two cron ticks process the same straggler concurrently (no unique constraint on `user_id`). Daily
  single-fire makes this near-impossible; a partial unique index would close it.

---

## Section rollup (risk-scaled)

1. **High-Risk (Blocking):** none.
2. **Medium:** M-A (wipe FK drift tripwire), M-B (JWT-retained edge-fn residual), M-C (e2e rehearsal
   before flip), **M-D (ungated `get_imos_with_system_automations` "tell" — fix in this PR)**,
   **M-E (per-row `is_access_revoked` in RLS — wrap in `(SELECT …)`)**.
3. **Low:** L1, L5, L6, L7.
4. **Security & RLS:** sentinel-not-NULL chokepoint correct; deny-by-default covers all RLS tables
   (tripwire 0); 7 Part-4 RPCs faithfully gated; derived-scope RPCs (`get_imo_override_summary`,
   `get_imo_dashboard_metrics`) sentinel-gated via `get_my_imo_id()`; matviews not SELECT-able; no
   cross-tenant **data** leak found. Residual: **M-D (tell via automation enumeration)**, M-B.
5. **Data integrity / migrations:** cascade + all 17 NO-ACTION FK refs verified on remote; wipe atomic +
   idempotent; audit logs FK-less (survive wipe); reversible Switch A. Gap: M-A drift guard.
6. **Performance:** **M-E** — deny predicate is per-row across 194 tables (EXPLAIN-confirmed), against a
   repo with prior RLS pool-exhaustion outages; the `(SELECT …)` InitPlan wrap fixes it.
7. **React Query / frontend:** `useRevocationStatus` keyed by user id, sensible `staleTime`; SunsetGate
   gates on both auth+imo loading (super-admin-first); delete mutation clears caches. No issues.
8. **Test coverage gaps:** no rendered-revoked-session test (B1 regression guard); no e2e/idempotency
   edge-fn test (M-C); no FK-drift catalog tripwire (M-A); 4 pre-existing `subscriptionService.test.ts`
   failures are billing-workstream debt, out of scope.

### Justification

Dormant, well-constructed, prior blockers genuinely resolved, FK + gate + matview + public-surface
invariants empirically confirmed on remote. **Safe to merge.** Two new findings emerged from the live
audit: M-D (an 8th anon RPC enumerates active IMOs by automation type with no revoked/`is_listed`
filter — a breach of the "no tell" invariant, low real-world exploitability today but a one-line fix
that belongs in this PR) and M-E (the deny predicate runs per-row, not once per query — a perf
regression best fixed before the gate is load-bearing). Neither is a correctness blocker for a dormant
merge. The **required changes that must precede the operational revoke flip** are: M-C (seeded e2e
rehearsal), M-A (wipe FK-drift tripwire), M-B (residual edge-fn-access decision), plus M-D and M-E
folded into this PR. The flip is a separate action from the merge.
