# HANDOFF — Platform Sunset / FFG "RED BUTTON" — post-code-review fixes → STEP 6/7

**Created:** 2026-05-27 · **Supersedes** the day's earlier handoff for the now-done STEP 5 + the
code-review fixes. The phase-2 build handoff
(`continue-20260527-platform-sunset-phase2-edge-fns-frontend.md`) is still the reference for STEP
6/7 mechanics — read it for the rehearsal/deploy detail; this doc records what changed since.

**Read first:**
- Code review + findings: `docs/security/platform-sunset-code-review-2026-05-27.md`
- Backend design: `docs/security/platform-sunset-revocation-architecture-2026-05.md`
- Runbook: `docs/security/platform-sunset-edge-functions-and-runbook-2026-05.md`
- Memory: `project_platform_sunset_ffg_revocation.md`

---

## 0. ONE-LINE STATE
The feature (Migrations A–G + public-surface gate + 5 edge fns + frontend gate/RED BUTTON) is built,
**LOCAL only, DORMANT**. STEP 5 (the `export ⊆ wipe` parity test) is **done**. A full-branch
production code review returned **Request Revisions**; its blocking (B1) + should-fix (M1/M2/M4 +
the types leak M3) findings are **FIXED IN CODE, UNCOMMITTED**. Next: **decide whether to commit
the fixes**, then **STEP 6 = staging rehearsal** (the runtime gate for the edge-fn fixes), then
**STEP 7 = remote deploy**.

---

## 1. GIT STATE (branch `feat/platform-sunset-revocation`, NOT pushed)
3 committed feature commits (`180b5395` migrations, `31c620e5` edge fns, `56001862` frontend) on top
of the billing tip. **Uncommitted working-tree changes from this session:**
- `src/hooks/imo/useRevocation.ts` — B1 fix
- `supabase/functions/confirm-and-wipe-account/index.ts` — M1 + M4
- `supabase/functions/complete-recruit-registration/index.ts` — M2
- `src/types/database.types.ts` — M3 (removed 4 leaked symbols)
- `src/features/sunset/__tests__/wipe-export-parity.test.ts` — **untracked** (STEP 5)
- Updated docs: the 3 `docs/security/platform-sunset-*` files (this review + fix reflections)

**Nothing committed this session.** Commit rules: only `main` deploys (Vercel); never push non-main.
The backend (migrations + edge fns) deploys to remote via scripts, branch-independent. Per the
agreed plan: **backend to remote first, frontend merge to main deferred.**

---

## 2. WHAT THE CODE REVIEW FIXED (verify before trusting — see the review doc for full detail)
- **B1 (was BLOCKING):** `useRevocationStatus` now detects revocation via the `is_access_revoked`
  SECURITY DEFINER RPC, NOT the gated `imos` read (which returns the sentinel → `imo===null` → the
  feature was inert). Build green; **routing not yet verified against a rendered revoked session.**
- **M1:** `confirm-and-wipe-account` runs the guarded wipe RPC **before** the storage purge (no
  unhealable half-wipe if the IMO is restored mid-flight).
- **M2:** `complete-recruit-registration` checks the **effective** target IMO
  (`inviterImoId ?? FFG_SENTINEL_IMO_ID` — Founders fallback == FFG sentinel), closing the fail-open.
- **M4:** `confirm-and-wipe-account` adopts an orphaned `recovery/{user}/` archive on retry.
- **M3:** trimmed `database.types.ts` to the sunset delta (removed 4 callerless leaked symbols).

**Verified:** `npm run build` green (0 TS errors); parity Vitest green; `check-pinned-imports.sh`
clean. **NOT verified (needs STEP 6 — local stack can't):** M1/M2/M4 runtime behavior + B1 routing.

---

## 3. REMAINING WORK — IN ORDER

### ▶ STEP 5.5 — Decide & commit (START HERE)
- Resolve the **4 pre-existing `subscriptionService.test.ts` failures** (`findByUserIdWithPlan` ×2,
  `getUsageStatus` ×2) — they predate these fixes but violate the "100% passing" rule. Triage: fix
  or confirm tracked elsewhere.
- Decide commit grouping for the uncommitted fixes (suggest one `fix(sunset): address code-review
  B1/M1/M2/M4 + trim leaked types` + the parity test, or split). Commit only when the owner says.

### STEP 6 — Seeded rehearsal on a **staging Supabase project** (decided venue)
This is the runtime verification gate for B1 routing + M1/M2/M4. Needs the owner to stand up a
staging project (project-ref, URL, service-role key, DB URL). Then: mirror schema (all migrations
A–G + public-surface gate; re-run Migration B + completeness check → 0; §7 storage-DELETE precheck
→ 200/200 on the hosted stack), deploy the 5 edge fns, seed a throwaway IMO **using the FFG sentinel
id `ffffffff-…`** (lets `activate-imo-revocation` fire-test unmodified), then rehearse
dormant→activate→export→download→confirm→wipe→recovery + cron day-3/6/7/30, and teardown. Confirm a
revoked **rendered** session lands on the sunset page (B1) and M1/M2/M4 behave.

### STEP 7 — Remote (production) backend deploy
Pre-flight gates (all must pass): `npm run build` 0 errors; parity Vitest green;
`check-pinned-imports.sh`; **§7 storage-DELETE remote precheck → 200/200 (403 = STOP)**; `app_config`
has `supabase_project_url` + `service_role_key` on remote; **M5: diff `pg_get_functiondef` on REMOTE
for the 7 public RPCs** before `CREATE OR REPLACE` (not version-tracked — could revert a newer remote
body). Then apply A–G + `20260527114910` via the runner against `$REMOTE_DATABASE_URL` (watch the
"Target DB" banner), re-run Migration B + completeness on remote, regen + commit
`database.types.ts`, deploy the 5 edge fns (`--project-ref pcyaqwodnyrpkaiojnpz`), confirm the cron
job registered. Ships **DORMANT** — do NOT set `access_revoked_at` on real FFG.

### Tail / open
- **M6** — billing `/billing` silent-redirect UX (toast or gate the upgrade links).
- **L1–L6** — see the code-review doc (cron-always-200, snapshot GC, generating-poll, anon RPC leak
  L4, cron REVOKE, the subscription test case).
- Add a **revoked-session regression test** (assert `is_access_revoked` → `isRevoked`) so B1 can't
  silently regress.

---

## 4. HARD RULES (unchanged)
- Migrations via the runner only, to LOCAL **and** REMOTE; never raw psql; regen + commit
  `database.types.ts` after schema changes.
- Chokepoint must never return NULL to deny — sentinel UUID only.
- Stripe is manual; the wipe path does zero Stripe; red-button FIRST, then cancel in Stripe.
- Validation: `npm run build` (NOT `validate-app.sh` — it hangs).
- Commit only when the owner asks; never push / never touch remote DB without saying so.
- Vault: `docs/` is source of truth; sync new docs downstream; never touch the vault `CLAUDE.md`.

---

## 5. KEY ENVIRONMENT FACTS
- LOCAL: FFG = `ffffffff-…` (super-admin `nickneessen@thestandardhq.com`), Epic Life =
  `2fd256e9-9abb-445e-b405-62436555648a`. REMOTE Epic Life = `89514211-…`. FFG sentinel identical
  across envs. Founders fallback IMO == FFG sentinel (`20260522080218`).
- Project ref `pcyaqwodnyrpkaiojnpz`; types regen `npm run generate:types`.
- Known local-stack gaps (NOT code bugs): storage object DELETE fails locally; signed URLs embed
  `kong:8000`. Both fine on hosted — which is why STEP 6 uses a staging project.
