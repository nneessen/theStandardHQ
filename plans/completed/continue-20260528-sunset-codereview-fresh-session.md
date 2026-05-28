# Continuation Prompt — Production Code Review of the Platform-Sunset / FFG-Revocation Backend

> Paste everything below the line into a **new, clean Claude Code session** at the repo root
> (`/Users/nickneessen/projects/commissionTracker`). It is self-contained — it assumes no prior
> conversation context.

---

You are performing a **strict, security-first production code review**. First, **read and adopt the
hardened review rubric** at `docs/guides/code-review.md` (Review Mode — Production-Grade Reviewer).
Follow it exactly, including its "Verification — Execution Required", "SECURITY DEFINER bypass",
"RLS-is-not-sufficient" (matviews + definer bodies), and risk-scaled-depth rules. Produce the
8-section output it specifies and a single explicit final verdict.

## What you are reviewing

The **platform-sunset / FFG-revocation "RED BUTTON"** feature on branch
`feat/platform-sunset-revocation`. It is a super-admin kill switch that revokes platform access for
the FFG / Self Made IMO (export-all-data → confirm → permanent per-user wipe) while Epic Life stays
live, and FFG users must not be able to tell the platform continues for others. It ships **DORMANT**
(no behavior changes until someone sets `imos.access_revoked_at`).

**IMPORTANT — this is a RE-REVIEW.** A prior pass of this same rubric returned **Request Revisions**
(report: `docs/security/platform-sunset-code-review-2026-05-27.md`). Its blocking finding **B1** and
should-fix **M1/M2/M4/M3** were then fixed, and the backend was **deployed to production, dormant**.
Your job: independently re-review the full feature, confirm the prior findings are genuinely resolved
(don't trust the report — read the code), and surface anything new. Read that report **after** you
form your own view, not before, so it doesn't anchor you.

## Exact scope — review THIS diff range only

```bash
git diff 13682067..HEAD        # the sunset-only change set (41 files, ~5.3k insertions)
git diff --name-only 13682067..HEAD
git log --oneline 13682067..HEAD
```

`13682067..HEAD` deliberately **excludes the billing workstream** that this branch is stacked on
(self-serve-subscription disabling: `PricingCards.tsx`, `BillingPage.tsx`,
`subscription-availability.ts`, `FeatureGate.tsx`, `UpgradePrompt.tsx`, `router.tsx`, `RouteGuard.tsx`,
sidebar configs, `subscriptionService.ts`). **Those are OUT OF SCOPE** — do not review them; they ship
as a separate PR. Do **not** use `main..HEAD` (it mixes both workstreams).

### In-scope files (the sunset feature)
- **Migrations (8)** `supabase/migrations/`:
  - `20260526193029_imo_access_revocation_mechanism.sql` (A — chokepoint `get_effective_imo_id()` returns a **sentinel UUID `00000000-…`, never NULL**, for revoked non-super-admins; `is_access_revoked(uuid)` predicate)
  - `20260526193252_account_lifecycle_audit_tables.sql` (D — `data_export_log`, `account_deletion_log`; FK-less, service-role-only)
  - `20260526200139_revocation_gate_owned_tables.sql` (B — **deny-by-default**: RESTRICTIVE `revocation_deny` on every RLS table except a 5-table allowlist `{user_profiles, imos, agencies, data_export_log, account_deletion_log}`)
  - `20260526200510_revocation_gate_storage.sql` (C — storage.objects gate)
  - `20260527060621_wipe_user_business_data_fn.sql` (E — registry-driven, FK-safe, atomic, service-role-only; refuses a super-admin or a non-revoked IMO)
  - `20260527094314_account_recovery_archives_bucket.sql` (F — private bucket, 0 authenticated policies)
  - `20260527094315_account_lifecycle_daily_cron.sql` (G — pg_cron + pg_net wrapper; reads `app_config` keys `supabase_project_url` + `supabase_service_role_key`)
  - `20260527114910_revocation_public_surface_gate.sql` (**7 anon SECURITY DEFINER RPCs** recreated with `access_revoked_at IS NULL`: `get_public_recruiter_info`, `get_public_recruiting_theme`, `submit_recruiting_lead`, `get_public_invitation_by_token`, `get_available_imos_for_join`, `get_agencies_for_join`, `get_public_landing_page_settings`)
- **Edge functions (Deno)** `supabase/functions/`:
  - `activate-imo-revocation/index.ts` (super-admin gated; FFG-only allowlist; refuses Epic Life ids; enqueues exports)
  - `generate-user-export-bundle/index.ts` (service-role OR self-JWT; xlsx `xlsx@0.18.5` + csv.zip `fflate@0.8.2` + json → `snapshots/{user}/`; signed URLs)
  - `confirm-and-wipe-account/index.ts` + `wipe-orchestration.ts` (self/super-admin/service-role; **wipe RPC BEFORE storage purge** = M1; recovery-archive resolution incl. orphan adoption = M4; idempotent; NO Stripe)
  - `account-lifecycle-cron/index.ts` (service-role; drain exports / day-3+6 reminders / day-7 auto-purge / 30-day GC; batched for the ~150s limit)
  - `complete-recruit-registration/index.ts` (**M2 fix**: checks the *effective* target IMO `inviterImoId ?? FFG_SENTINEL` before `createUser`, closing a fail-open)
  - `_shared/`: `sunset-constants.ts`, `storage-recursive.ts` (`listAllPaths`/`removeAll`), `owned-tables.ts` (the export/wipe registry — NOT the gate)
- **Frontend** `src/`:
  - `components/auth/SunsetGate.tsx` (+ test) — gate wired into both `App.tsx` branches; super-admin-first
  - `features/sunset/SunsetPage.tsx`, `index.ts` — standalone export→confirm→delete→terminal page
  - `hooks/imo/useRevocation.ts` (+ test) — **B1 fix**: `useRevocationStatus` reads the `is_access_revoked` RPC, NOT the gated `imos` row
  - `features/admin/components/PlatformRevocationControl.tsx` (+ `SystemSettingsTab.tsx`) — the RED BUTTON
  - `constants/imos.ts`, `constants/revocation.ts`, `CommissionRatesManagement.tsx` (FFG_IMO_ID extraction)
  - `features/sunset/__tests__/wipe-export-parity.test.ts` — asserts `export ⊆ wipe` parity
  - `src/types/database.types.ts` — only `imos.access_revoked_at` + a callerless-symbol trim (see "decisions" below)
- **Scripts**: `scripts/check-revocation-gate-completeness.sql` (gate tripwire), `scripts/test-wipe-user-business-data.sql`
- **Docs** (context, not code): `docs/security/platform-sunset-revocation-architecture-2026-05.md` (backend source of truth), `docs/security/platform-sunset-edge-functions-and-runbook-2026-05.md`, the two `plans/active/continue-20260527-*` handoffs.

## Tenancy model & helper contracts you must apply
- Tenant key helpers: `get_effective_imo_id()` / `get_my_imo_id()` (acting-IMO aware), `is_super_admin()`, `is_imo_admin()`. `get_effective_imo_id()` returns the caller's **real** imo_id for non-super-admins; **NULL is only the super-admin see-all hatch** — so a function returning NULL for a *should-be-denied* user re-opens that hatch (a leak). The sunset chokepoint deliberately returns a **sentinel UUID, never NULL**, for revoked users. Verify this invariant holds in Migration A and that nothing downstream `COALESCE`s the sentinel back to a real scope.
- FFG = the all-Fs sentinel IMO `ffffffff-…` (also the Founders fallback). Epic Life (local `2fd256e9-…`, remote `89514211-…`) must stay unaffected.

## Deployment state (this is POST-deploy, production, dormant)
All 8 migrations are applied to **remote prod** (`pcyaqwodnyrpkaiojnpz`), 5 edge fns deployed, cron
`account-lifecycle-daily` registered, **0 IMOs revoked**. You have **read-only** verification access via
the runner — use it to satisfy the rubric's "execution required" rule (e.g. read a definer body on
remote, check `relacl` grants, confirm the gate-completeness tripwire):
```bash
source .env
DATABASE_URL=$REMOTE_SUPABASE... # read-only queries:
DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-sql.sh "SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='wipe_user_business_data';"
DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-sql.sh -f scripts/check-revocation-gate-completeness.sql   # must return 0
```
**HARD RULE: read-only only. NEVER set `imos.access_revoked_at` on any real IMO, never run the wipe,
never raw `psql`, never apply/alter migrations, never push the branch.** If you want to prove an
access change, use a non-committing `BEGIN … ROLLBACK` probe.

## Verification evidence already gathered (weigh it; re-confirm what you doubt)
- `npm run build` 0 TS errors; `vitest` green for parity + `useRevocation` + `SunsetGate` + `wipe-orchestration` (22 pass/1 skip); `scripts/check-pinned-imports.sh` clean; `deno check confirm-and-wipe-account/index.ts` clean.
- **§7 storage-DELETE precheck on prod**: upload 200 / DELETE 200 / GET-after 400 (hosted storage DELETE works → wipe `removeAll` + GC viable).
- **M5**: local(gated)-vs-remote(pre-deploy) `pg_get_functiondef` diff for the 7 public RPCs showed only the intended `access_revoked_at IS NULL` predicate; remote pre-deploy bodies saved at `~/sunset-rollback-20260528-remote-rpcs/`.
- **Migration B on remote**: deny-by-default attached to **194 RLS tables**; completeness tripwire → **0** uncovered.
- **NOT exercised at runtime (call these out as verification gaps, per the rubric):** a *live rendered* revoked browser session (B1 has unit tests only); live edge-fn invocation of activate/generate/confirm/cron against a seeded revoked user (M1/M4 are unit-tested; M2 was proven via BEGIN/ROLLBACK only). A full seeded rehearsal ("Option B") is deliberately deferred until just before any real revoke flip.

## Decisions already made — do NOT re-flag as new findings (assess if you disagree, but know they're intentional)
- **`database.types.ts` full regen was deliberately skipped on this branch** (deferred to the main-merge): no frontend caller references the 4 new backend-only objects, and a full regen re-adds 4 unrelated symbols that the M3 trim removed. Confirm the *committed* types are at least self-consistent (build green) — but the "regen after schema change" process rule is being satisfied at main-merge, by design.
- **4 `subscriptionService.test.ts` failures** are pre-existing **billing-workstream** debt (`.single()`/`.maybeSingle()` mock mismatch), tracked separately — out of scope here.
- **Stripe is manual** (owner, dashboard); the wipe path performs zero Stripe ops by design — do not flag its absence.
- **`get_advisors` lint** was skipped (Supabase MCP not authenticated); the deny-by-default completeness tripwire is the substitute and returned 0.

## Highest-risk areas to concentrate on
1. **The 7 public anon SECURITY DEFINER RPCs** — read every body; confirm each truly gates on `access_revoked_at IS NULL` for the revoked case AND preserves prior behavior for non-revoked (no funnel breakage, no NULL-imo_id super-admin-inviter regression in `get_public_invitation_by_token`).
2. **Migration B deny-by-default** — is the allowlist correct and minimal? Could any allowlisted table leak across tenants for a revoked user? Does the RESTRICTIVE policy interact correctly with existing PERMISSIVE policies? Performance: `is_access_revoked(auth.uid())` now runs on every RLS check across 194 tables — is that acceptable, and is the helper cheap/indexed?
3. **`wipe_user_business_data` (E)** — FK-safety, atomicity, the refuse-super-admin / refuse-non-revoked guards, the reassign-to-super-admin logic; can it ever wipe the wrong user or a live (Epic Life) user under any parameter?
4. **Edge-fn auth boundaries** — each function's caller class (super-admin JWT / self-JWT / service-role / anon) vs what it actually enforces internally; idempotency of the irreversible wipe + the export drain; no silent partial success (M1 ordering); pinned imports.
5. **`export ⊆ wipe` parity** — does the registry (`owned-tables.ts`) actually cover everything the wipe destroys, so a revoked user's export is a complete superset? Is the parity test asserting the right thing?
6. **Materialized views / non-`relkind='r'` exposure** — audit `relacl` grants to `authenticated`/`anon`; the gate (RLS) can't cover matviews.

Begin by running the diff commands above and reading `docs/guides/code-review.md`. If any context you
need is missing, say so and withhold approval rather than guessing.
