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
- **M-C** — no end-to-end runtime rehearsal of the full flow. **The primary gate.**
- **L1** — `account-lifecycle-cron` returns 200 even when every task errored.
- **L5** — `invoke_account_lifecycle_daily()` lacks `REVOKE … FROM PUBLIC`.
- **L6** — Migration B comment imprecise re matview non-SELECT grants (doc nit).
- **L7** — possible double-INSERT into `account_deletion_log` under concurrent cron ticks.

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

## Sequencing summary

Review (1) → Test (2) → Bug/edge-case hunt (3) → **Seeded rehearsal (4, the gate)** → Decisions &
cleanup (5) → Merge to main (6, ships dormant frontend) → Operational flip (7, manual).

Merging (6) is safe once 1–5 pass; it only puts the button on the wall. Pressing it (7) is a separate,
deliberate, owner-driven step.
