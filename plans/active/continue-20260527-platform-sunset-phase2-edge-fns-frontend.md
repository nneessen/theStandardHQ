# HANDOFF — Platform Sunset / FFG "RED BUTTON" — PHASE 2 (edge fns → frontend → Part 4 → rehearsal → remote)

**Created:** 2026-05-27 · **Supersedes** the Phase-1 backend-build handoff (moved to
`plans/completed/continue-20260526-platform-sunset-ffg-revocation.md` — read it + the architecture
doc for backend internals; do NOT restate them, they're settled).
**Backend source of truth:** `docs/security/platform-sunset-revocation-architecture-2026-05.md`
**Master plan / full decision record:** `~/.claude/plans/we-need-to-develop-nested-turtle.md`
**Memory:** `project_platform_sunset_ffg_revocation.md`

---

## 0. ONE-LINE STATE
The backend revocation mechanism + wipe function are **built, proven on LOCAL, and DORMANT**.
**STEPS 1–4 are now DONE (LOCAL, uncommitted, dormant).** STEP 1 = the 4 edge functions. STEP 2 =
Migrations F (recovery bucket) + G (daily cron). STEP 3 = the frontend (SunsetGate wired into both
App.tsx branches, sunset page, RED BUTTON control, hooks, `access_revoked_at` type, `FFG_IMO_ID`).
STEP 4 = the public-surface gate (migration `20260527114910` recreates 7 anon SECURITY DEFINER RPCs
with `access_revoked_at IS NULL`; `complete-recruit-registration` checks the inviter IMO before
createUser; `resolve-custom-domain` covered transitively) — dormant + active (transactional ROLLBACK)
verified. **Nothing is on remote.** **Next concrete step: STEP 5 — the `export ⊆ wipe` parity Vitest.**
Two local-stack limits bound local observability (Storage DELETE + `kong:8000` signed-URL host — both
environmental, hosted fine); the revoked render/download/wipe paths get truly exercised in the STEP 6
rehearsal. See the STEP 7 executable remote-delete prereq below.

### STEP 1 — DONE (2026-05-27), uncommitted in working tree
New files (NOT committed — ship with the others at the owner's word):
- `supabase/functions/_shared/sunset-constants.ts` (FFG sentinel allowlist id, bucket/prefix names, TTLs)
- `supabase/functions/_shared/storage-recursive.ts` (`listAllPaths`/`removeAll` — shared by wipe + cron)
- `supabase/functions/activate-imo-revocation/index.ts` (super-admin; FFG-only allowlist; revoke/restore; enqueues pending exports)
- `supabase/functions/generate-user-export-bundle/index.ts` (service-role OR self-JWT; SheetJS xlsx + fflate csv.zip + json → `snapshots/{user}/`; signed URLs)
- `supabase/functions/confirm-and-wipe-account/index.ts` (self/super-admin/service-role; snapshot→recovery; purge buckets; wipe RPC; deleteUser; idempotent log)
- `supabase/functions/account-lifecycle-cron/index.ts` (drain exports / day-3+6 reminders / day-7 auto-purge / 30-day GC; bounded + batched)

Settled in STEP 1 (do not relitigate): export libs are `xlsx@0.18.5` + `fflate@0.8.2` (smoke-verified
multi-sheet round-trip in Deno). Reminder email `from` is currently `The Standard HQ <noreply@…>` —
**FLAG for the owner before STEP 7**: they may prefer a more neutral sender (e.g. `Account Services`).
`generate` + `confirm` depend on the Migration F bucket `account-recovery-archives` (so they can't fully
run until F ships — that's expected, the smoke pass confirmed they fail closed only at the bucket).

---

## 1. WHAT THIS FEATURE IS (30-second recap)
A super-admin "RED BUTTON" that revokes platform access for the **FFG / Self Made IMO** (sentinel
`ffffffff-ffff-ffff-ffff-ffffffffffff`) while **Epic Life stays fully live**. Revoked FFG users
must **not** be able to tell the platform continues for anyone else. Flow: owner flips the switch →
each FFG non-super-admin user is dropped on a neutral **sunset page** → downloads ALL their data
(xlsx/csv/pdf) → confirms "my data is correct" → **permanent full-account wipe**. 30-day hidden
recovery archive; stragglers auto-purged at **day 7**; cut-off + day-3 + day-6 reminder emails.
Ships **DORMANT** (nothing changes until the owner sets `imos.access_revoked_at`).

---

## 2. WHAT'S DONE — LOCAL ONLY, DORMANT
Backend (Migrations A–E + deny-by-default gate) applied to the **local** DB and verified. See the
architecture doc for the full design; the short version:
- **A** chokepoint: `get_effective_imo_id()` returns a **sentinel UUID** (`00000000-…`, NEVER NULL)
  for revoked non-super-admins + `is_access_revoked(uid)` predicate.
- **B** deny-by-default RESTRICTIVE `revocation_deny` on every RLS table except a 5-table allowlist
  (`user_profiles`, `imos`, `agencies`, + 2 audit). Tripwire: `scripts/check-revocation-gate-completeness.sql` (returns 0).
- **C** storage gate (private buckets). **D** audit tables (`data_export_log`, `account_deletion_log`, FK-less, service-role-only).
- **E** `wipe_user_business_data(p_user_id, p_reassign_to_user_id)` — registry-driven, FK-safe, atomic, service-role-only. Tested (`scripts/test-wipe-user-business-data.sql`).
- Registry: `supabase/functions/_shared/owned-tables.ts` (drives wipe + export, NOT the gate).

**Git/commit state (IMPORTANT):**
- Docs reconciliation committed: repo `502f82cf`, vault `155ac43` (NOT pushed).
- The migration SQL + `owned-tables.ts` + the two SQL scripts are **applied to local DB and STAGED
  in git but NOT committed**, and **NOT applied to remote**. Files:
  `supabase/migrations/2026052619302​9…A`, `…193252…D`, `…200139…B`, `…200510…C`, `20260527060621…E`,
  `supabase/functions/_shared/owned-tables.ts`, `scripts/check-revocation-gate-completeness.sql`,
  `scripts/test-wipe-user-business-data.sql`. (Commit them whenever the owner says; they ship with the remote deploy.)

---

## 3. SETTLED DECISIONS — do NOT relitigate (full record: architecture doc + master plan)
- Target by **data** (`imos.access_revoked_at`), never hardcoded ids. FFG sentinel `ffffffff-…` is the one stable id.
- **Super-admin bypass evaluated FIRST everywhere** (owner is on the FFG IMO; must never be locked out).
- **Two switches:** (A) reversible flag; (B) irreversible per-user wipe. Never one button.
- **Stripe = MANUAL** (owner, Stripe dashboard) — cancellation + refunds. The wipe path performs
  **zero Stripe ops** (do NOT re-add). **Ordering: press RED BUTTON first, THEN cancel in Stripe** —
  `customer.subscription.deleted` downgrades the user to the free plan + deprovisions their chat bot
  (`stripe-webhook/index.ts:1550-1566`, `:1642`), a visible "tell" if done before lock-out.
- Opaque copy (no "Epic Life" / no "platform continues for others"). Formats: xlsx + csv(.zip) server-side, **PDF client-side**.
- Ships DORMANT. Reads fail-closed (gate); destruction is an explicit allowlist (registry).

---

## 4. REMAINING WORK — IN ORDER

### ✅ STEP 1 — Edge functions — DONE (2026-05-27) — `supabase/functions/`
Reuse: `_shared/supabase-client.ts` (`createSupabaseAdminClient`), CORS/auth from `send-email`,
`auth.admin.*` from `check-user-exists`. Pin all esm.sh imports (`scripts/check-pinned-imports.sh`).
**No Stripe calls in any of these.**
1. **`activate-imo-revocation`** (super-admin gated): set `access_revoked_at`; **refuse if target is
   an Epic Life id**; require confirm text; then **async enqueue** one `data_export_log` row
   (status='pending') per affected user. Do NOT generate bundles synchronously (≈150s fn limit).
2. **`generate-user-export-bundle`** (service-role): xlsx multi-sheet + csv zip + json, driven by
   `EXPORTED_TABLES`. Copy header/label maps from `src/features/policies/utils/policyExport.ts` +
   `src/utils/exportHelpers.ts` into a new `_shared/export-schema.ts` (Deno can't use `@/` aliases).
   Writes to `snapshots/{user_id}/`. Invoked by the cron drain + on-demand from the sunset page.
3. **`confirm-and-wipe-account`** (user-JWT, self only / super-admin): copy snapshot → `recovery/`
   (set `recovery_expires_at=+30d`) → purge storage `{user}/` →
   `rpc('wipe_user_business_data', {p_user_id, p_reassign_to_user_id:<super-admin id>})` →
   `auth.admin.deleteUser` → INSERT `account_deletion_log` (reason='self_confirmed'). Idempotent. **No Stripe.**
4. **`account-lifecycle-cron`** (service-role, pg_cron): drain pending exports; day-3/day-6 reminder
   emails; **day-7 auto-purge** (same wipe path, reason='auto_purge_7d'); 30-day recovery GC.
- Emails: reuse `send-email` with neutral templated bodies (no Epic Life mention).

### ✅ STEP 2 — Migrations F + G — DONE (2026-05-27), LOCAL only, uncommitted
- **F** `supabase/migrations/20260527094314_account_recovery_archives_bucket.sql` — `account-recovery-archives`
  private bucket (1GB; xlsx/zip/json), `snapshots/{user}/` + `recovery/{user}/`. **Zero authenticated
  policies = service-role only.** Applied local; verified (private, 0 authed policies).
- **G** `supabase/migrations/20260527094315_account_lifecycle_daily_cron.sql` — `invoke_account_lifecycle_daily()`
  wrapper (app_config + pg_net pattern from `20260404193707`) + `cron.schedule('account-lifecycle-daily','15 9 * * *', …)`.
  Applied local; cron active. **No-op while dormant.**
- End-to-end re-smoke against the now-existing bucket: `generate-user-export-bundle` (fake user) →
  `status: ready`, all 3 files uploaded + signed URLs; atomic snapshot→recovery **copy** verified (all 3 land in recovery). Test data cleaned up.

> **KNOWN LOCAL-STACK LIMITATION (not a code bug; remote unaffected):** on this Supabase CLI
> (`storage-api v1.22.17`) **every Storage object DELETE fails** with `new row violates row-level
> security policy` — for service-role AND authenticated callers, even via raw REST. Root-caused to
> the storage-api's own delete handling (not the `prefixes` RLS, whose trigger `delete_prefix` is
> SECURITY DEFINER; disabling it had no effect). The production app's 10+ `.remove()` call sites
> work for real users, so **hosted/remote is fine**. Consequence: the wipe's `removeAll` (snapshot
> cleanup + private-bucket purge) and the cron's recovery GC **cannot be rehearsed on the local
> stack** — they are code-reviewed + the copy half is verified; the **delete half is gated on the
> STEP 7 remote-delete prereq below.** (To delete test objects locally, connect as `supabase_admin`
> and `SET LOCAL storage.allow_delete_query='true'` in the same txn.)

> **Atomic snapshot→recovery copy:** happy path (all files copied → commit + remove snapshot) is
> verified. The **partial-copy rollback branch is defensive, code-reviewed only** (faking a mid-copy
> failure wasn't worth the contortion) — STEP 6 rehearsal owner: this is inferred, not observed.

### ✅ STEP 3 — Frontend — DONE (2026-05-27), uncommitted; `npm run build` green
Files (new unless noted):
- `src/components/auth/SunsetGate.tsx` — gate: `authLoading||imoLoading→spinner` · `isRevoked→<SunsetPage/>` · else children. `isRevoked` (from `useRevocationStatus`) already encodes super-admin-first (`!isSuperAdmin && access_revoked_at!=null`), so the owner is never locked out. Wired into BOTH `App.tsx` branches inside `<ImoProvider>`, wrapping the whole layout (revoked user gets the standalone page, no shell).
- `src/features/sunset/SunsetPage.tsx` (+ `index.ts`) — calm standalone page. On mount invokes `generate-user-export-bundle` (skipIfReady); download buttons fetch signed URLs **imperatively** (so `hasDownloaded` only flips after bytes leave the bucket); delete gated on `ready && hasDownloaded && confirmChecked` + inline double-confirm; terminal screen on success with an explicit Sign-out (the delete hook clears caches/storage but defers signOut so the redirect doesn't unmount the terminal screen).
- `src/hooks/imo/useRevocation.ts` — `useRevocationStatus`, `useExportBundle`, `useDeleteMyAccount`, `useRevocationAdminStatus`, `useActivate/DeactivateRevocation`; exported via `hooks/imo/index.ts`.
- `src/features/admin/components/PlatformRevocationControl.tsx` — RED BUTTON in `SystemSettingsTab` (section gated on `isSuperAdmin`). Status (revoked-since / users-remaining / purge deadline); typed `REVOKE <imo.name>` to revoke; single-confirm restore.
- `src/constants/imos.ts` (`FFG_IMO_ID`, replaces `CommissionRatesManagement.tsx` hardcode) + `src/constants/revocation.ts` (AUTO_PURGE_AFTER_DAYS / RECOVERY_TTL_DAYS mirror).
- `src/types/database.types.ts` — surgically added `access_revoked_at` to `imos` Row/Insert/Update (STEP 7 full regen is a no-op for it).
- Edge fn refined: `generate-user-export-bundle` gained `skipIfReady` (returns a cron-pre-built bundle's signed URLs instead of rebuilding; smoke-verified `reused:true`).

Verified: `npm run build` 0 errors; every new module serves 200 through Vite dev transform; skipIfReady smoke-invoked. **Not yet observed** (deferred to STEP 6 rehearsal): the *revoked* render path + the download flow — the latter can't run on the local stack anyway (signed URLs embed `kong:8000`, unresolvable from the browser; see runbook §5). **Recommended before STEP 7:** log in once as the normal super-admin and confirm the unchanged shell renders (the dormant pass-through) — ~60s, removes the last inferred-not-observed mark.

### ✅ STEP 4 — Public/unauthenticated leak surfaces — DONE (2026-05-27), LOCAL, uncommitted
Public surfaces resolve their IMO via `anon`-callable SECURITY DEFINER RPCs (+ 2 edge fns) that bypass
RLS, so Migration B (authenticated-only) didn't cover them. `anon` can't read `imos` directly → the
fix injects `access_revoked_at IS NULL` INSIDE each definer fn. A revoked IMO then behaves exactly
like an unlisted/unknown one (existing "Link Not Found"/generic-landing paths render — no new copy, no tell).
- Migration `20260527114910_revocation_public_surface_gate.sql` (applied local; 7 fns version-tracked) —
  faithful CREATE OR REPLACE + the predicate + idempotent `GRANT … TO anon`:
  - **Real closure** (specific-IMO inputs): `get_public_recruiter_info`, `get_public_recruiting_theme`
    (covers /join + custom-domain funnel), `submit_recruiting_lead`, `get_public_invitation_by_token`
    (/register; plpgsql guard after inviter fetch, NULL imo_id super-admin inviters unaffected).
  - **Defence-in-depth** (FFG already `is_listed=false`… actually it's listed=true here, so meaningful):
    `get_available_imos_for_join`, `get_agencies_for_join`, `get_public_landing_page_settings`.
- `complete-recruit-registration/index.ts` — checks the inviter's IMO `access_revoked_at` **before**
  `auth.admin.createUser` (no orphan auth account under a revoked org); neutral `invitation_not_found`.
- `resolve-custom-domain` — needs NO edit: it 404s when `get_public_recruiting_theme` returns null, which
  the migration now does for a revoked IMO (covered transitively).
- `/slack/name-leaderboard` — NOT public (auth-gated via RouteGuard); already covered by SunsetGate + Migration B.
Verified: dormant unchanged (FFG funnel returns "Founders Financial Group", active); **active path proven
via a `BEGIN; UPDATE imos…; <call RPCs>; ROLLBACK;` test** (recruiter_info→0 rows, theme→null, discovery 2→1)
that never commits (hard rule respected). My edge-fn edit is clean; note 3 PRE-EXISTING `deno check` errors
in complete-recruit-registration (`rollbackCreatedUser` client-generic mismatch, lines 326/336) — not mine,
don't block Deno deploy. **Email copy:** the cron reminder is already neutral (STEP 1); no per-surface
transactional emails reference the IMO, so no email changes were needed for Part 4.

### ▶ STEP 5 — `export ⊆ wipe` parity unit test (Vitest) (START HERE)
Assert the three SQL arrays in Migration E mirror `owned-tables.ts` (ACTOR_REFS_TO_NULL /
ACTOR_REFS_TO_REASSIGN / wipe==="explicit") and every owner column exists in the catalog. CI drift tripwire.

### STEP 6 — Seeded full rehearsal
Throwaway IMO + users. Verify: dormant→activate DENY (empty sets, **not** errors) across owned tables
+ storage; super-admin NOT locked out (real JWT); Epic Life unaffected; full export→confirm→wipe→recovery;
red-button double-confirm + deactivate.

### STEP 7 — Remote deploy
`npm run build` (0 TS errors) + supabase `get_advisors` lint + SunsetGate ordering unit tests. THEN
apply ALL migrations A–G to **remote** via the runner, **re-run Migration B + the completeness check
on remote** (remote has more tables), regen `src/types/database.types.ts`, commit migrations. Also
deploy the 4 edge functions to remote (`supabase functions deploy <name>` each).

> **PREREQ — remote Storage DELETE must work (irreversible wipe depends on it).** Before applying
> ANY of A–G to remote, prove the wipe's `removeAll` will function on the hosted project (the local
> stack couldn't — see STEP 2 limitation). Using the **remote** service-role key against an existing
> bucket (e.g. `user-documents`, so you don't depend on F yet):
> ```bash
> # 1. upload a throwaway object
> curl -X POST "$REMOTE_URL/storage/v1/object/user-documents/__wipe-precheck__/probe.txt" \
>   -H "Authorization: Bearer $REMOTE_SERVICE_ROLE_KEY" -H "Content-Type: text/plain" --data "x"
> # 2. delete it
> curl -X DELETE "$REMOTE_URL/storage/v1/object/user-documents/__wipe-precheck__/probe.txt" \
>   -H "Authorization: Bearer $REMOTE_SERVICE_ROLE_KEY"
> ```
> Both must return 200. If the DELETE 403s with the same `new row violates row-level security
> policy`, **STOP** — the wipe path is broken on remote; do NOT apply migrations or activate
> revocation until the hosted storage delete is resolved.

---

## 5. HARD RULES
- **Migrations: local AND remote, via the runner only.**
  `./scripts/migrations/run-migration.sh FILE.sql` then
  `source .env && DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-migration.sh FILE.sql`.
  Fresh `date +%Y%m%d%H%M%S` timestamps. **NEVER raw psql.**
- **NEVER set `imos.access_revoked_at` on a real IMO** until F/G ship AND the full wipe path is tested. (B+C done locally; remote has nothing.)
- **Chokepoint must never return NULL** to deny — sentinel UUID only (NULL = double leak).
- **Stripe is manual; wipe path does zero Stripe.** Red-button-FIRST, then cancel in Stripe.
- Validation: `npm run build` (NOT `validate-app.sh` — it hangs).
- **Commit only when the owner asks; never push / never touch remote DB or git without saying so.**
- Don't relitigate §3. Read the architecture doc before backend work.

---

## 6. KEY ENVIRONMENT FACTS
- LOCAL: FFG = `ffffffff-…` (super-admin `nickneessen@thestandardhq.com` lives here),
  Epic Life = `2fd256e9-9abb-445e-b405-62436555648a`. REMOTE Epic Life = `89514211-…` (differs). FFG sentinel identical across envs.
- Vault: `docs/` is source of truth; sync new docs downstream with `/ingest`. Do NOT touch the vault's `CLAUDE.md`.
