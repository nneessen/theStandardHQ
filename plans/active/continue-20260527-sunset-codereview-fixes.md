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
**The backend is fully DEPLOYED TO PRODUCTION and DORMANT (2026-05-28).** STEPS 5, 5.5, 6 (Option A
lightweight verification), and **7 (remote prod deploy)** are all DONE. All 8 migrations applied to
remote (A pre-existed; D/B/C/E/F/G/public-gate applied this session), deny-by-default covers 194 RLS
tables (completeness → 0), 5 edge fns deployed, cron registered, public funnel intact, **0 IMOs
revoked**. `database.types.ts` regen intentionally skipped on this branch (deferred to main-merge;
see STEP 7). **What's left: (a) the FRONTEND merge to `main`** (SunsetGate/RED BUTTON/sunset page —
only `main` deploys via Vercel; not yet merged), **(b) Option B full seeded rehearsal BEFORE any real
`access_revoked_at` flip**, (c) the M6/L1–L6 tail. Do NOT set `access_revoked_at` on real FFG.

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

### ✅ STEP 5.5 — DONE (2026-05-28)
- The 4 `subscriptionService.test.ts` failures triaged as **billing-workstream debt, out of scope**
  (source migrated `.single()`→`.maybeSingle()`, tests still mock `.single()`; fail on billing tip
  `42bbadd1`, untouched by sunset). Tracked for a future `fix/billing-subscription-test-mocks` branch.
- Code-review fixes committed in 3 split commits (NOT pushed): `e7dd4601` test(sunset) parity,
  `bc1f6d5d` fix(sunset) B1/M1/M2/M4 + trim types, `a09919d9` docs(sunset) review report + handoff.

### ✅ STEP 6 — DONE as **Option A (lightweight)** (2026-05-28)
Owner chose lightweight verification over a full staging-project rehearsal (a faithful clone of a
562-migration project = 1–3 day sub-project; the only irreducible hosted-only risk is storage DELETE,
which the §7 precheck answers directly). Delivered:
- **§7 storage-DELETE precheck against PROD** (`user-documents/__wipe-precheck__/`, image/png mime —
  text/plain is 415): upload 200 / DELETE 200 / GET-after 400. **Hosted storage DELETE works** → the
  wipe's `removeAll`, recovery GC, and M1/M4 storage ops are safe on remote. (This is also the STEP 7
  precheck — already satisfied.)
- **B1**: durable regression tests instead of a live local toggle — `src/hooks/imo/__tests__/useRevocation.test.tsx`
  (asserts `isRevoked` derives from the `is_access_revoked` RPC keyed by caller id; super-admin never
  revoked + RPC never called; no anon call) + `src/components/auth/SunsetGate.test.tsx` (spinner /
  SunsetPage / shell routing). **NOT done: a live rendered revoked browser session** — deferred to the
  STEP 7 dormant deploy + monitoring window (Option A explicitly accepts this).
- **M1/M4**: extracted the wipe ordering + recovery-archive logic into a pure, Deno-free module
  `supabase/functions/confirm-and-wipe-account/wipe-orchestration.ts` (repo convention) and unit-tested
  it — `__tests__/wipe-orchestration.test.ts` (8 tests): M1 wipe-before-purge, wipe-throws→no-purge,
  no-reassign→refuse-before-destruction, profile-gone→skip-wipe-still-purge; M4 full-copy, orphan
  adoption, nothing-to-claim, partial-copy rollback. `index.ts` delegates to the helpers. `deno check`
  clean; build green; pinned imports clean.
- **Uncommitted** (working tree, awaiting owner commit say-so): new `wipe-orchestration.ts` +
  `__tests__/wipe-orchestration.test.ts` + `useRevocation.test.tsx` + `SunsetGate.test.tsx`; modified
  `confirm-and-wipe-account/index.ts`.
- Deferred (gated before any **active** flip on real FFG): Option B full seeded rehearsal.

### ✅ STEP 7 — Remote (production) backend deploy — DONE (2026-05-28), DORMANT
Deployed to prod (`pcyaqwodnyrpkaiojnpz`). The feature is LIVE-but-DORMANT: nothing changes until
the owner sets `imos.access_revoked_at` (do NOT — that's a separate, deliberate action).

**Pre-flight (all passed):** build 0 errors · parity Vitest green · pinned imports clean · §7
storage-DELETE prod precheck 200/200 · `app_config` has both keys · **M5 RPC-body diff: PASS**
(local-vs-remote diff for the 7 public RPCs showed ONLY the intended `access_revoked_at IS NULL`
predicate additions; remote bodies were current, nothing clobbered; remote pre-deploy bodies saved
to `~/sunset-rollback-20260528-remote-rpcs/` as rollback artifact). `get_advisors` SKIPPED (Supabase
MCP not authenticated this session; the deny-by-default completeness tripwire is the stronger gate
and DID run → 0).

**SURPRISE (handoff was wrong):** Migration A (`20260526193029`) was **already applied + tracked on
remote** from a prior session — objects exist with correct sentinel logic (not drift). The other 7
were absent (verified no partial state). Runner skipped A, applied D,B,C,E,F,G,public-gate — each
against the REMOTE "Target DB" banner, all `✅ APPLIED SUCCESSFULLY`.

**Verified on remote:** Migration B deny-by-default attached to **194 RLS tables** (allowlist:
user_profiles, imos, agencies, data_export_log, account_deletion_log); completeness tripwire → **0
uncovered**. All 7 public RPCs now carry the predicate; funnel intact (`get_available_imos_for_join()`
→ 1 listed IMO). 5 edge fns deployed (default verify_jwt — all callers send a valid JWT incl. the
cron's service-role Bearer). Cron `account-lifecycle-daily` registered (`15 9 * * *`, active). **Dormancy
confirmed: 0 IMOs revoked, 0 export/deletion-log rows.**

**`database.types.ts` regen — DELIBERATELY SKIPPED on this branch** (decided w/ advisor): no frontend
caller references the 4 newly-deployed backend-only objects (data_export_log, account_deletion_log,
wipe_user_business_data, invoke_account_lifecycle_daily); the frontend-relevant types
(imos.access_revoked_at, is_access_revoked RPC) are already committed; and a full regen re-adds 4
unrelated symbols the reviewed M3 commit `bc1f6d5d` trimmed (pre-existing base drift: they exist on
remote but not in the branch's types). Authoritative regen deferred to the **main-merge**. If frontend
code later touches those 4 objects via the typed client, surgical-add then.

**Monitor:** B's RESTRICTIVE `is_access_revoked(auth.uid())` now runs on every RLS check across 194
tables — by-design deny-by-default, no-op while dormant; watch query latency on prod.

### Tail / open
- **M6** — billing `/billing` silent-redirect UX (toast or gate the upgrade links).
- **L1–L6** — see the code-review doc (cron-always-200, snapshot GC, generating-poll, anon RPC leak
  L4, cron REVOKE, the subscription test case).
- ✅ Revoked-session regression test (B1) — DONE in STEP 6 Option A (`useRevocation.test.tsx`).
- **Option B full seeded rehearsal** — deferred; gate BEFORE the first real `access_revoked_at` flip.

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
