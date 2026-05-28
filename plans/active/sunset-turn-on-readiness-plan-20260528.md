# Platform-Sunset / FFG-Revocation — Turn-On Readiness Plan

Date: 2026-05-28
Owner: Nick (operational flip); Claude (engineering phases)
Branch: `feat/platform-sunset-revocation`
Status of this plan: **active** — defines everything that must happen before the RED BUTTON is pressed on the real FFG/Self Made IMO.

> Purpose: a single, accurate, phase-gated checklist to get the kill switch from "deployed dormant"
> to "safe to turn on." Each phase has explicit **exit criteria**; do not advance until they are met.
> Principle ordering, per direction: **review everything → test everything → hunt bugs/edge cases →
> rehearse end-to-end → merge → flip.**

---

## 0. Current state (verified on remote, 2026-05-28 — not from memory)

**Already done / live:**
- All 10 sunset migrations applied to **remote prod** and **local**; **0 IMOs revoked** (fully dormant).
  - A–E + F/G + public-surface gate (`20260527114910`) + M-D (`20260528083600`) + M-E (`20260528083601`).
- Deny-by-default gate on **194** RLS tables; completeness tripwire → **0** ungated (remote).
- Wipe FK model verified against the live catalog: every registry `cascade` table truly cascades; all
  17 NO-ACTION FK refs to `user_profiles` are handled; no RESTRICT. M-A tripwire now guards drift.
- `mv_*` matviews carry **no SELECT** grant to `authenticated`/`anon` (not API-readable).
- M-D: `get_imos_with_system_automations` revoked from anon/authenticated (the "no tell" leak closed).
- M-E: deny predicate wrapped in `(SELECT …)` → one InitPlan/statement, not per-row (EXPLAIN-confirmed).
- Edge functions deployed to prod (activate / generate-export / confirm-and-wipe / lifecycle-cron;
  complete-recruit-registration updated). **Re-confirm parity in Phase 1.**
- Prior review findings B1/M1/M2/M3/M4 confirmed genuinely fixed in code.
- Committed to the branch: `5780a884` (M-D/M-E/M-A) + `b8684a5d` (re-review docs).

**Correction to an earlier assumption:** the self-serve-subscription **billing workstream is already
on `main`** (every billing file is byte-identical between `main` and `HEAD`). `main..HEAD` is therefore
**sunset-only** (migrations + edge fns + frontend + docs + `database.types.ts` + a README touch). There
is **nothing to unbundle**; the 4 pre-existing `subscriptionService.test.ts` failures live on `main`
already and are out of scope for this branch.

**What a merge to `main` actually delivers to prod:** only the **frontend** (Vite bundle) — `SunsetGate`
(wired into both `App.tsx` branches), the sunset page, the RED BUTTON (`PlatformRevocationControl`),
`useRevocation` hooks, constants, a minor `CommissionRatesManagement` change — plus `database.types.ts`
and docs. The DB + edge layers are already on prod. (`main` = production deploy via Vercel.)

**Open findings carried in (none blocking a dormant merge):**
- **M-B** — a revoked user keeps a valid JWT; generic service-role edge fns aren't uniformly gated
  (own-data only; no cross-tenant path found). Decision needed.
- **M-C** — ✅ **RESOLVED 2026-05-28** by the seeded remote rehearsal (see
  `phase4-rehearsal-evidence-20260528.md`). Full chain proven; it caught + fixed a blocking defect (B2).
- **L1** — `account-lifecycle-cron` returns 200 even when every task errored.
- **L5** — `invoke_account_lifecycle_daily()` lacks `REVOKE … FROM PUBLIC`.
- **L6** — Migration B comment imprecise re matview non-SELECT grants (doc nit).
- **L7** — possible double-INSERT into `account_deletion_log` under concurrent cron ticks.

**Phase-4 findings (2026-05-28):**
- **B2 (was BLOCKING for the flip — FIXED + redeployed + re-validated)** — `confirm-and-wipe-account`,
  `generate-user-export-bundle`, `activate-imo-revocation` selected a non-existent `user_profiles.
  full_name` column → PostgREST 400 silently nulled the profile lookup → the wipe RPC was **skipped**
  (business data survived while auth+storage were destroyed and the log falsely reported success). Fixed
  to `first_name,last_name` + computed `fullName` across all 3 fns; regression guard added to
  `wipe-export-parity.test.ts`; redeployed to prod; re-validated end-to-end (real `by_table` deletion).
  **The deployed fix is uncommitted — commit it before the Phase-6 merge so `main` matches prod.**
- **B3 (cosmetic, fixed in B2)** — export manifest/`data_export_log` identity (`email`/`fullName`) was
  null due to the same root cause; table data always exported fine.
- **B4 (fixed in B2)** — on revoke, `activate` enqueued 0 exports (the affected-users query 400'd);
  day-7 auto-purge + self-service export were unaffected.
- **L8 (new, low → Phase 5)** — reminder day-skip if a daily cron tick is missed (`Math.floor`
  daysSince can jump 2→4, skipping day-3); day-7 purge still fires. Needs a `reminder_sent_at`-style
  column to fully fix; accept for now.

---

## Phase 1 — Review everything (in the real merge scope)

**Goal:** a complete, current review of exactly what will reach prod, with no stale assumptions.

1. Re-confirm `main..HEAD` is sunset-only (`git diff --name-only main..HEAD`) — no surprise files.
2. **Edge-function deployment parity:** list deployed functions + versions on prod and diff the
   deployed body of each sunset function against the committed source (don't trust the STEP-7 record).
   Confirm `--no-verify-jwt` flags are intended per function; confirm pinned imports
   (`scripts/check-pinned-imports.sh`).
3. **Frontend review (never browser-tested):** read `SunsetGate`, `SunsetPage`, `PlatformRevocationControl`,
   `useRevocation` for the dormant path, loading races, super-admin-first ordering, and error/empty states.
4. Re-verify the 7 public-surface RPCs + M-D still gate correctly on remote (definer bodies).
5. Confirm the 5 open findings above are still accurately characterized; decide which are in-scope for
   pre-flip vs deferred.

**Exit criteria:** net diff confirmed sunset-only; every deployed edge fn matches source; frontend read
end-to-end with no unaddressed correctness/auth concern; pinned-imports clean.

---

## Phase 2 — Test everything (automated)

**Goal:** every automated check green, on both DBs.

1. `npm run build` — zero TS errors. **(Use `npm run build`, NOT `validate-app.sh` — the latter hangs
   forever in cleanup; prior known issue.)**
2. `quick-check` (`tsc --noEmit && eslint .`).
3. Full `vitest` run (note the 4 pre-existing billing failures are on main, out of scope — do not let
   them mask a real sunset regression).
4. Sunset suites green: `wipe-export-parity` (static), `wipe-orchestration`, `useRevocation`, `SunsetGate`.
5. **DB-backed tripwires on LOCAL and REMOTE:**
   - `RUN_DB_TESTS=1 npx vitest run …/wipe-export-parity.test.ts` (local)
   - `RUN_DB_TESTS=1 PARITY_DB_URL=$REMOTE_DATABASE_URL npx vitest run …` (remote)
   - `scripts/check-revocation-gate-completeness.sql` → 0 (local + remote)
   - `scripts/check-wipe-fk-safety.sql` reviewed (local + remote)
6. `deno check` on each edge function; `scripts/check-pinned-imports.sh`.

**Exit criteria:** all of the above green on both environments; FK-drift + gate tripwires return 0.

---

## Phase 3 — Bug & edge-case hunt (think like an attacker and like Murphy)

**Goal:** explicitly probe the cases unit tests don't cover. For each, decide: covered / fix-now / accept.

Frontend / gate:
- [ ] Non-revoked user logs in → normal app renders (gate is inert). **Must verify in a browser.**
- [ ] Super-admin on the **revoked** FFG IMO → still gets the app, never the sunset page (super-admin-first).
- [ ] Auth-loaded-before-IMO race → no flicker into the sunset page for a super-admin.
- [ ] `is_access_revoked` RPC errors / network blip → gate fails safe, doesn't white-screen the app.

Authorization / tenancy:
- [ ] Revoked user with a still-valid JWT calls a non-sunset edge fn (close-kpi, gmail, lead-heat) →
      returns only their own data, never another tenant's (this is **M-B**; decide accept vs sign-out).
- [ ] Public funnel for the revoked IMO (7 RPCs + M-D fn) → neutral "not found", no "tell".
- [ ] New registration under the revoked IMO (null/wiped inviter → Founders=FFG fallback) → refused (M2).
- [ ] **A user mid-wipe who is currently logged in:** `auth.users` row deleted, but their JWT is still
      valid for a few minutes — what does the next request to any edge fn that calls `getUser(token)`
      return? Confirm it fails closed (401), not a 500 or a partial read. Tied to M-B.
- [ ] **Stale browser bundle:** a tab open on the pre-merge JS won't have `SunsetGate` until refresh; a
      revoked user with a long-lived tab keeps the old app shell until then. Confirm acceptable / tied to
      the M-B sign-out decision.

Billing / Stripe interaction:
- [ ] **Stripe webhook arriving AFTER a wipe** (the `user_profiles` row is gone): does
      `stripe-webhook` fail loud, or silent-500 / orphan-write? The wipe path does no Stripe by design
      (manual cancellation), so a late webhook for a wiped user is a real ordering case.

Wipe / data integrity:
- [ ] Export for a heavy user (many policies/commissions) → completes under the ~150s limit, or is batched.
- [ ] Signed-URL download works on remote (not the local `kong:8000` issue); URL expiry handled.
- [ ] Wipe idempotency: re-run after profile already gone → noop, no error, log UPDATE not re-INSERT.
- [ ] M1: IMO restored mid-flight → wipe RPC refuses, storage left intact (no half-wipe).
- [ ] M4: orphaned `recovery/{user}/` from a crashed run → adopted on retry, GC can reclaim.
- [ ] FK drift (M-A) — confirm tripwire fails loudly if a NO-ACTION FK is added unhandled.
- [ ] Owner (super-admin) account can NEVER be wiped (entry guard) even if passed explicitly.

Lifecycle / cron:
- [ ] Day-3/day-6 reminder boundaries fire exactly once each across daily runs.
- [ ] Day-7 auto-purge of stragglers; restored-then-re-revoked IMO resets the clock sensibly.
- [ ] 30-day recovery GC deletes archives and nulls the path.
- [ ] L7: two cron ticks on the same straggler → no duplicate `account_deletion_log` row.
- [ ] L1: a sweep where every task errors → surfaced (non-200/degraded), not a silent green.
- [ ] **Remote storage-DELETE precheck**: service-role upload+DELETE round-trip on prod returns 200
      *before* any flip (the local stack can't prove the destructive half).

**Exit criteria:** every box above is covered, fixed, or consciously accepted with a written rationale.

---

## Phase 4 — Seeded end-to-end rehearsal (M-C — THE primary gate)

**Goal:** watch the entire chain work once, for real, on a disposable tenant. Never flip the real IMO
without this.

1. Seed a throwaway test IMO + a handful of non-super-admin test users with representative data
   (policies, commissions, documents in storage, recruiting rows).
2. **Revoke the test IMO. NOTE: `activate-imo-revocation` is fail-closed to the FFG sentinel
   (`if (imoId !== FFG_SENTINEL_IMO_ID) return 403`), so it will REJECT a test IMO.** Pick a mechanism:
   - **Option A (recommended) — bypass the activation edge fn:** set the flag directly on remote,
     `UPDATE imos SET access_revoked_at = now() WHERE id = '<test-imo>'`, then manually enqueue export
     rows (or just drive `generate-user-export-bundle` directly in step 3). This faithfully exercises
     **everything downstream** (gate, sunset render, export, wipe, cron) — the high-risk, irreversible
     parts — and only skips the activation fn's own guards (super-admin check, FFG allowlist,
     `REVOKE <name>` confirm), which are thin and unit-reviewed.
   - **Option B (fully faithful) — temporary allowlist widen:** a throwaway commit adding the test IMO
     to `FFG_SENTINEL_IMO_ID`'s allowlist, deploy, rehearse incl. activation, then **revert + redeploy**.
     Use only if you specifically want to rehearse the activation fn end to end.
   - Then confirm: users routed to the sunset page in a real browser session.
3. Drive `generate-user-export-bundle` (cron drain + self-service) → download the bundle via the signed
   URL on remote; open the xlsx/csv and confirm the data is complete (`export ⊆ wipe` in practice).
4. Confirm + wipe one user (`confirm-and-wipe-account`): verify business rows gone, storage purged,
   `auth.users` row deleted, `account_deletion_log` written, recovery archive present with expiry.
5. Let the lifecycle cron run (or invoke manually): reminders, day-7 auto-purge, 30-day GC.
6. Exercise the unhappy paths from Phase 3 against the seeded tenant (restore mid-flight, retry, etc.).
7. Tear down the test IMO; **Switch A restore** proven reversible.

**Exit criteria:** the full activate→export→download→wipe→audit→GC chain observed working on remote
against a seeded tenant, including the M1/M4 unhappy paths; storage delete proven on prod; rendered
revoked session confirmed; documented with evidence (logs, row counts, screenshots).

---

## Phase 5 — Decisions & cleanup

1. **M-B decision:** accept the revoked-but-valid-JWT residual (document it) OR add forced session/refresh
   revocation on flip. Record the choice and rationale.
2. **L1** — return non-200/`degraded` from the cron when `errors.length > 0`.
3. **L5** — `REVOKE … FROM PUBLIC` on `invoke_account_lifecycle_daily()`.
4. **L6** — tighten Migration B's matview comment to "no SELECT grant."
5. **L7** — partial unique index on `account_deletion_log(user_id)` (or accept; daily single-fire).
6. **`database.types.ts` regen** — now **likely safe** (the schema is already on prod), but **verify
   before trusting a full regen**: the original M3 finding was 4 callerless symbols from *undeployed*
   schema (`get_team_analytics_data_impl`, `getuser_commission_profile_impl`, `is_book_duplication_mode`,
   `is_epic_life_imo`). Confirm each of those exists on **remote** first; if any does not, a full regen
   will re-leak undeployed schema → use the surgical hand-edit again instead. Then regenerate, commit,
   confirm build green.
7. Hygiene: README touch + `plans/active` continuation files — keep or retire to `plans/completed/`.

**Exit criteria:** M-B decided + recorded; chosen L-fixes applied to both DBs; types regenerated +
committed; build green.

---

## Phase 6 — Merge to `main` (deploys the frontend to prod)

**Pre-merge checklist:** Phases 1–5 exit criteria all met; build green; `database.types.ts` regenerated;
net diff confirmed sunset-only; the dormant frontend verified harmless in a browser.

1. Open the PR (sunset-only). Final diff review.
2. Merge to `main` → Vercel production deploy. **Deploy via the git auto-deploy, NOT `vercel deploy`
   from the CLI — the CLI honors `.vercelignore` not `.gitignore` and has uploaded local `.env` into the
   prod bundle before (prior incident).**
3. **Post-deploy verification:** confirm the prod bundle URL is correct (per the Vercel-CLI-env lesson);
   log in to prod as a normal user → app works, no sunset page (still dormant); super-admin sees the
   RED BUTTON in System Settings but it is inert.

**Exit criteria:** frontend live on prod, dormant; normal users unaffected; RED BUTTON visible to
super-admin only and not yet pressed.

### Rollback (if the dormant frontend misbehaves on prod)

The DB + edge layers are already live and dormant, so **rollback is frontend-only**: revert the merge
commit on `main` and push → Vercel redeploys the prior bundle. **No DB/migration revert is needed** (the
gate stays dormant whether or not the frontend is present). If `SunsetGate` is the culprit and a full
revert is too broad, the narrowest mitigation is to make `useRevocationStatus` return `isRevoked:false`
unconditionally (gate becomes a pass-through) and redeploy. Keep the migrations in place either way.

---

## Phase 7 — Operational flip (owner-driven, manual — separate from merge)

Per the runbook (`docs/security/platform-sunset-edge-functions-and-runbook-2026-05.md`):
0. **Confirm the Supabase point-in-time-restore window covers T-0** before pressing — cheap insurance
   ahead of an irreversible wipe.
1. Press the RED BUTTON FIRST (Switch A revoke on FFG), THEN cancel Stripe manually in the dashboard
   (cancelling first is a visible "tell").
2. Monitor: users-remaining, export drain, reminder sends, day-7 purge, recovery GC.
3. Switch A is reversible until Switch B (wipe) runs per user.

**Exit criteria:** this phase is NOT executed by Claude. It is a deliberate, monitored action Nick takes
when genuinely ready to decommission FFG.

---

## Execution log

### Phase 1 — Review (executed 2026-05-28) — ✅ EXIT CRITERIA MET

All checks read-only; no mutation, no flip.

- **Net diff sunset-only** — ✅ `git diff --name-only main..HEAD` = 50 files: migrations (10),
  edge fns + 3 `_shared`, frontend (SunsetGate/SunsetPage/RED BUTTON/useRevocation/constants/App),
  `database.types.ts`, docs, scripts, README. No surprise/unrelated files. Working tree clean.
- **Dormancy** — ✅ remote `SELECT count(*) FROM imos WHERE access_revoked_at IS NOT NULL` = **0**.
- **Gate completeness** — ✅ `check-revocation-gate-completeness.sql` on remote = **0 rows**.
- **M-D shipped** — ✅ remote `get_imos_with_system_automations` ACL = `postgres`, `service_role`
  only (no `anon`/`authenticated` EXECUTE). The "tell" surface is closed.
- **M-E shipped** — ✅ all **194** `revocation_deny` policies have the `(SELECT is_access_revoked(
  auth.uid()))` InitPlan wrap; **0** bare per-row. Confirmed via `pg_policies.qual`.
- **7 public-surface RPCs** — ✅ all carry `access_revoked_at` predicate in their definer bodies on
  remote and remain `anon`-EXECUTE (funnels still work for non-revoked IMOs).
- **M3 regen discriminator** — ✅ all 4 callerless symbols (`get_team_analytics_data_impl`,
  `getuser_commission_profile_impl`, `is_book_duplication_mode`, `is_epic_life_imo`) **exist on
  remote** → a full `database.types.ts` regen is now safe (Phase 5).
- **Pinned imports** — ✅ `check-pinned-imports.sh` clean.
- **Edge-fn deploy parity** — ✅ all 5 sunset fns ACTIVE on prod, deployed 2026-05-28 13:01 UTC
  (4 new @ v1, `complete-recruit-registration` @ v9). Every edge-fn source file last committed
  ≤ 12:45 UTC (before deploy); nothing changed since. **Residual:** byte-level body diff not
  performed — `supabase functions download` overwrites the working tree; parity established by
  commit-timestamp chain + STEP-7 deploy record (`7d7a804a`). Low risk; can spot-diff in Phase 4.
- **Frontend read-through** — ✅ `useRevocation` (B1 fix via `is_access_revoked` RPC confirmed),
  `SunsetGate` (super-admin-first encoded in `isRevoked`; loading gates on auth+imo), `SunsetPage`
  (opaque copy, download-gated confirm, 2-step delete), `PlatformRevocationControl` (hard
  `if (!isSuperAdmin) return null`, type-to-confirm, admin query gated on super-admin), App.tsx
  (both branches nest `<SunsetGate>` inside `<ImoProvider>`). No unaddressed correctness/auth concern.
  - **Note (→ Phase 3 / M-B):** `useRevocationStatus` throws on RPC error → `isRevoked=false` →
    gate *fails open* to the app shell, but the RLS gate *fails closed* at the data layer (empty
    sets). Net: a revoked user on an RPC blip sees an empty/broken app, never another tenant's data,
    never the sunset page. Acceptable for dormant merge; revisit with the M-B sign-out decision.

**Verdict:** merge scope is exactly sunset; all dormant invariants hold on remote; no blocker. Proceed to Phase 2.

### Phase 2 — Automated tests (executed 2026-05-28) — ✅ EXIT CRITERIA MET

- **`npm run build`** — ✅ 0 TS errors (~30s).
- **`quick-check`** (`tsc --noEmit && eslint .`) — ✅ 0 errors, 168 warnings (all pre-existing
  `no-explicit-any` in non-sunset edge fns).
- **Sunset suites (static)** — ✅ `wipe-export-parity` (10, 3 DB-gated skipped), `wipe-orchestration`
  (8), `SunsetGate` (3), `useRevocation` (4) → 22 passed.
- **DB-backed FK-drift / parity (M-A)** — ✅ `RUN_DB_TESTS=1` parity test 10/10 on **local** AND
  **remote** (`PARITY_DB_URL=$REMOTE_DATABASE_URL`). Live-catalog FK + column-existence checks pass
  on both.
- **Gate completeness** — ✅ 0 rows on **local** and **remote**.
- **`deno check`** — ✅ the 4 new fns (activate / generate-export / confirm-and-wipe / lifecycle-cron)
  clean. `complete-recruit-registration` has 3 errors at the `rollbackCreatedUser` call (line ~352) —
  **pre-existing, outside the sunset diff** (the sunset diff adds only the M2 inviter-IMO gate before
  `createUser`); fn deployed to prod as v9. Not a blocker.
- **Pinned imports** — ✅ clean.
- **Full vitest** — branch: **49 failed / 1608 passed / 45 skipped**. **Verified against `main`
  (git checkout): main = 49 failed / 1586 passed** — the **identical 18 failed files / 49 failed
  tests**. So **all 49 are pre-existing main debt; zero sunset regressions**. The branch adds 22
  passing sunset tests and introduces no failures. (The plan's earlier "4 billing failures" figure
  undercounted main's test debt — actual pre-existing breakage spans hierarchy/expenses/voice-agent/
  policyCalculations/etc., all out of scope for this branch.)

**Verdict:** every automated gate green on both DBs; the only failures are pre-existing on `main`. Proceed to Phase 3.

### Phase 3 — Bug & edge-case hunt (executed 2026-05-28) — ✅ EXIT CRITERIA MET

Read all core bodies: `confirm-and-wipe-account/index.ts`, `wipe-orchestration.ts`,
`account-lifecycle-cron/index.ts`, `activate-imo-revocation/index.ts`, the wipe RPC migration, and
`stripe-webhook` (subscription.deleted). Triage below — **none blocks a dormant merge.**

| # | Case | Disposition | Rationale |
|---|---|---|---|
| 1 | Non-revoked user logs in → app renders (gate inert) | **Verify in Phase 4 (browser)** | Dormant path: `isRevoked=false` → children. Structurally correct; needs a rendered session. |
| 2 | Super-admin on revoked FFG → app, never sunset | **Covered** | `isRevoked = !isSuperAdmin && …`; super-admin always falls through. Confirm in Phase 4 browser. |
| 3 | Auth-loaded-before-IMO race | **Covered** | `SunsetGate` gates the spinner on **both** `authLoading || imoLoading`. No flicker window. |
| 4 | `is_access_revoked` RPC error / blip | **Accept (→ M-B)** | Gate *fails open* to app shell; RLS layer *fails closed* (empty data). Revoked user never sees another tenant's data or the sunset page. Tie to M-B sign-out decision. |
| 5 | Revoked user w/ valid JWT calls non-sunset edge fn | **Accept (= M-B)** | Own-IMO data only; no cross-tenant path found. Most fns call `getUser()` (deleted/blocked fails closed). Decision in Phase 5. |
| 6 | Public funnel for revoked IMO (7 RPCs + M-D) | **Covered** | All 7 carry `access_revoked_at` on remote; M-D revoked from anon/authenticated. Neutral "not found". |
| 7 | New registration under revoked IMO (M2) | **Covered** | `complete-recruit-registration` checks `inviterImoId ?? FFG_SENTINEL` before `createUser` → `invitation_not_found`. |
| 8 | Mid-wipe user, JWT still valid (M-B) | **Accept (→ M-B)** | After `auth.admin.deleteUser`, `getUser(token)` errors → 401 on edge fns that re-verify. Fails closed. |
| 9 | Stale browser bundle (long-lived tab pre-merge) | **Accept (→ M-B)** | Tab keeps old shell until refresh; RLS still denies data. Closes with the M-B forced-refresh decision. |
| 10 | **Stripe `subscription.deleted` AFTER a wipe** | **Accept + operational mitigation** | `stripe-webhook:1606-1613` returns **HTTP 500** (no orphan write — fails loud) → Stripe retries. Runbook prescribes cancel-at-day-0 (before any wipe), so deletions process while rows exist. Residual: a self-wiper whose cancellation lands later → bounded retry storm, **no data corruption**. `stripe-webhook` is **out of the sunset diff** — do not touch in this PR. |
| 11 | Export for a heavy user < ~150s | **Verify in Phase 4** | One user's own rows via service-role; FFG = single agency, modest per-agent data. Confirm with a representative seed. |
| 12 | Signed-URL download on remote (not `kong:8000`) | **Verify in Phase 4** | Local-only hostname artifact; only observable on remote. |
| 13 | Wipe idempotency (re-run after profile gone) | **Covered** | `priorLog.auth_user_deleted===true` → noop; else skip RPC, retry deleteUser, **UPDATE not INSERT**. |
| 14 | M1: IMO restored mid-flight → wipe refuses, storage intact | **Covered** | `wipeThenPurge` runs guarded RPC first; RPC refuses non-revoked IMO → throws → purge never runs. Unit-tested. |
| 15 | M4: orphaned `recovery/{user}/` adopted on retry | **Covered** | `resolveRecoveryArchive` adopts orphan; all-or-nothing copy w/ rollback. Unit-tested. |
| 16 | FK drift (M-A) tripwire fails loud | **Covered** | `RUN_DB_TESTS` parity green on local **and** remote; tripwire asserts every NO-ACTION/RESTRICT FK is handled. |
| 17 | Owner (super-admin) can never be wiped | **Covered** | `confirm-and-wipe:126` 403 + RPC entry guard (`is_super_admin IS TRUE` → RAISE). Double-guarded. |
| 18 | Day-3/6 reminders fire exactly once | **Covered (normal op)** | Daily tick + `daysSince ∈ {3,6}`; each user crosses each boundary once. See L8. |
| 19 | Day-7 auto-purge; restore resets clock | **Covered** | `daysSince >= 7`; restore clears `access_revoked_at` → `daysSince` undefined → excluded. |
| 20 | 30-day recovery GC deletes + nulls path | **Covered** | Task 4: filter `recovery_expires_at < now`, `removeAll`, null path. Needs remote storage-DELETE (Phase 4). |
| 21 | L7: two cron ticks → duplicate `account_deletion_log` | **Open → Phase 5** | No unique index; daily single-fire makes concurrency near-impossible. Partial unique index in Phase 5. |
| 22 | L1: all-errored sweep returns 200 | **Open → Phase 5** | Confirmed: cron always returns 200. Return `degraded` when `errors.length>0` in Phase 5. |
| 23 | Remote storage-DELETE precheck | **Phase 4 pre-flight** | Local stack can't DELETE; the destructive half is unproven. First step of the rehearsal (see below). |

**New low finding:**
- **L8 (new) — reminder day-skip on a missed cron run.** `daysSince` uses `Math.floor`; if a daily
  tick is missed (infra downtime), a user can jump day-2 → day-4, skipping the day-3 reminder (day-7
  purge still fires at `>= 7`). Accept; a fix needs a `reminder_sent_at`-style column (scope creep).
  Record alongside L1/L5/L6/L7 for Phase 5 consideration.

**Verdict:** all 23 boxes covered / accepted / scheduled; 4 items deferred to the Phase 4 rehearsal
(browser render, heavy-user export, signed-URL download, storage-DELETE precheck); L1/L7/L8 to Phase 5.
**No blocker for a dormant merge.**

---

## Phase 4 — Seeded rehearsal script (prepared 2026-05-28; EXECUTION PENDING USER GO-AHEAD)

> ⚠️ This rehearsal touches **prod storage + a seeded prod tenant** and runs the **irreversible wipe**
> against seeded users. It is the M-C primary gate. **Do not execute without explicit user go-ahead.**
> Never run against the real FFG IMO (`ffffffff-…`) or any real user. Use a throwaway test IMO id.

**Pre-flight 0 — Storage-DELETE precheck (BLOCKS the rehearsal if it fails).** With a **confirmed
remote** service-role key for `https://pcyaqwodnyrpkaiojnpz.supabase.co` (verify the key matches that
project ref before use — the repo `.env`'s `VITE_SUPABASE_URL` currently points local, so do NOT
assume `SUPABASE_SERVICE_ROLE_KEY` is the remote one):
```bash
curl -X POST  "$REMOTE_URL/storage/v1/object/user-documents/__wipe-precheck__/probe.txt" \
  -H "Authorization: Bearer $REMOTE_SERVICE_ROLE_KEY" -H "Content-Type: text/plain" --data "x"
curl -X DELETE "$REMOTE_URL/storage/v1/object/user-documents/__wipe-precheck__/probe.txt" \
  -H "Authorization: Bearer $REMOTE_SERVICE_ROLE_KEY"
```
Both must return 200. A 403 `new row violates row-level security policy` **blocks** the rehearsal —
do not proceed to any wipe until hosted storage-DELETE is proven.

**Pre-flight 1 — PITR window.** Confirm Supabase point-in-time-restore covers T-0 (cheap insurance
ahead of an irreversible wipe on a seeded tenant; also the Phase-7 step-0 habit).

**Step 1 — Seed a throwaway tenant (remote).** Create a test IMO (a fresh random uuid, NOT the FFG
sentinel) and 2–3 non-super-admin users with representative data: a few policies, commissions,
clients, a couple of documents uploaded to `user-documents`, recruiting rows. Record the ids.

**Step 2 — Revoke via Option A (bypass the activation fn).** `activate-imo-revocation` is fail-closed
to the FFG sentinel and 403s any other IMO, so drive the flag directly:
```bash
DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-sql.sh \
  "UPDATE imos SET access_revoked_at = now() WHERE id = '<TEST_IMO_UUID>';"
```
This faithfully exercises everything downstream (gate, sunset render, export, wipe, cron) — it only
skips the activation fn's own thin, unit-reviewed guards. (Option B — temporary allowlist widen +
redeploy + revert — only if you specifically want to rehearse the activation fn end-to-end.)

**Step 3 — Export + download (signed URL on remote).** Invoke `generate-user-export-bundle` for a
seeded user (service-role with `{ userId }`, or self-JWT). Download the xlsx + csv.zip via the
returned signed URL on the hosted host (`*.supabase.co`, not `kong:8000`), open them, and confirm the
data is complete (`export ⊆ wipe` in practice). Confirm a **heavy** seeded user completes < ~150s.

**Step 4 — Confirm + wipe one user.** Invoke `confirm-and-wipe-account` (`{ userId }`). Verify:
business rows gone (run the FK-safety dump / spot counts), the 3 private buckets purged
(**proves the destructive storage half**), `auth.users` row deleted, `account_deletion_log` row
written, `recovery/{user}/` archive present with a `recovery_expires_at` ~30d out.

**Step 5 — Lifecycle cron.** Invoke `account-lifecycle-cron` (service-role) or wait for the 09:15 UTC
tick: confirm reminders (manipulate a seeded user's `access_revoked_at` to day-3/day-6 to fire them),
day-7 auto-purge of a straggler, and (with an expired `recovery_expires_at`) the 30-day GC.

**Step 6 — Unhappy paths (Phase 3 items 11/14/15).** On the seeded tenant: restore mid-flight
(`UPDATE imos SET access_revoked_at = NULL`) and confirm the wipe RPC refuses (storage intact);
re-run a wipe after the profile is gone (idempotent noop, log UPDATE not re-INSERT); orphan a
`recovery/{user}/` and confirm adoption on retry.

**Step 7 — Browser render (Phase 3 items 1/2).** With the test IMO revoked, sign in as a seeded
non-super-admin in a real browser → routed to `SunsetPage` (no app shell). Sign in as a super-admin →
full app, never the sunset page.

**Step 8 — Tear down.** Restore the test IMO (`access_revoked_at = NULL`) to prove Switch A is
reversible, then delete the seeded IMO + any residual users/objects. Confirm prod is left clean and
the real FFG IMO was never touched (`SELECT count(*) FROM imos WHERE access_revoked_at IS NOT NULL` → 0).

**Exit criteria:** activate→export→download→wipe→audit→GC observed working on remote against the
seeded tenant incl. M1/M4 unhappy paths; storage-DELETE proven on prod; rendered revoked + super-admin
sessions confirmed; documented with evidence (logs, row counts, screenshots).

---

## Sequencing summary

Review (1) → Test (2) → Bug/edge-case hunt (3) → **Seeded rehearsal (4, the gate)** → Decisions &
cleanup (5) → Merge to main (6, ships dormant frontend) → Operational flip (7, manual).

Merging (6) is safe once 1–5 pass; it only puts the button on the wall. Pressing it (7) is a separate,
deliberate, owner-driven step.
