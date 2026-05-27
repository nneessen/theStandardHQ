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
**Nothing is on remote. There is no UI. There are no export/wipe edge functions.** The feature is
roughly one-third done. **Next concrete step: the 4 edge functions** (export + wipe path), because
the frontend and the rehearsal both depend on them.

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

### ▶ STEP 1 — Edge functions (START HERE) — `supabase/functions/`
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

### STEP 2 — Migrations F + G
- **F** `account-recovery-archives` private bucket: `snapshots/{user_id}/…` (frozen export kept for the wipe) + `recovery/{user_id}/…` (30-day post-wipe). Service-role only.
- **G** `invoke_account_lifecycle_daily()` pg_cron — copy the `invoke_lead_heat_scoring()` pg_cron + pg_net + `app_config` pattern from `20260427180000_lead_heat_cron_weekly.sql`. Daily.

### STEP 3 — Frontend
- `src/components/auth/SunsetGate.tsx` (new): order `loading→spinner` · `isSuperAdmin→children` (FIRST) · `revoked→<SunsetPage/>` · else children. Wire into BOTH `AuthenticatedApp` branches in `src/App.tsx`, INSIDE `<ImoProvider>`. No `/sunset` route.
- `src/features/sunset/` page + components (calm standalone layout, NOT theme-v2 shell). Delete button disabled until a download occurred AND confirm checkbox ticked; "bundle pending" polls + blocks delete. Post-wipe: `queryClient.clear()` → clear local/session keys → `signOut()` → terminal confirmation (no link back).
- `src/features/admin/components/PlatformRevocationControl.tsx` (new) in `SystemSettingsTab.tsx`, super-admin only. Double-confirm: type `REVOKE ${imo.name}` (computed). Reversible deactivate (single confirm). Shows status (active since / users remaining / purge deadline).
- `src/hooks/imo/useRevocationStatus.ts` (new): derive from `useImo().imo?.access_revoked_at != null`. **Confirm `ImoRepository.findWithAgencies` selects the new `access_revoked_at` column** (add it if not). Other hooks: useExportBundles (poll while pending), useDownloadExport, useDeleteMyAccount; admin useRevocationAdminStatus, useActivate/DeactivateRevocation.
- Extract `FFG_IMO_ID` to `src/constants/imos.ts` (replace hardcode at `CommissionRatesManagement.tsx:57`).

### STEP 4 — Part 4: public/unauthenticated leak surfaces (treat as first-class, not a tail item)
Backend-disable for the revoked IMO: custom-domain recruiting funnel + public join/register
(`/join/$recruiterId`, `/join-*`, `/register/*`), public leaderboard shares (`/slack/name-leaderboard`),
neutral transactional email copy. This is the part most likely to break "FFG must not know" — give it
the same file-level depth as Parts 1–3.

### STEP 5 — `export ⊆ wipe` parity unit test (Vitest)
Assert the three SQL arrays in Migration E mirror `owned-tables.ts` (ACTOR_REFS_TO_NULL /
ACTOR_REFS_TO_REASSIGN / wipe==="explicit") and every owner column exists in the catalog. CI drift tripwire.

### STEP 6 — Seeded full rehearsal
Throwaway IMO + users. Verify: dormant→activate DENY (empty sets, **not** errors) across owned tables
+ storage; super-admin NOT locked out (real JWT); Epic Life unaffected; full export→confirm→wipe→recovery;
red-button double-confirm + deactivate.

### STEP 7 — Remote deploy
`npm run build` (0 TS errors) + supabase `get_advisors` lint + SunsetGate ordering unit tests. THEN
apply ALL migrations A–G to **remote** via the runner, **re-run Migration B + the completeness check
on remote** (remote has more tables), regen `src/types/database.types.ts`, commit migrations.

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
