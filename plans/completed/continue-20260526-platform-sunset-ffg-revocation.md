# HANDOFF — Platform Sunset / FFG Access Revocation ("RED BUTTON")

**Last updated:** 2026-05-27 · **Status:** backend enforcement + audit layer + WIPE FN (E) DONE
(local, dormant); recovery bucket (F) + crons (G) + edge functions + frontend remaining.
**Master plan:** `~/.claude/plans/we-need-to-develop-nested-turtle.md` (full context/decisions).
**Memory:** `project_platform_sunset_ffg_revocation.md`.

---

## 1. WHAT THIS FEATURE IS

A super-admin "RED BUTTON" that revokes platform access for the **FFG / Self Made IMO**
(sentinel `ffffffff-ffff-ffff-ffff-ffffffffffff`) while **Epic Life stays fully live**. Revoked
FFG users must **not** be able to tell the platform continues for anyone else.

Flow: owner flips the switch → every FFG non-super-admin user is dropped onto a neutral **sunset
page** → they download ALL their data (Excel / CSV / PDF) → confirm "my data is correct" →
**permanent full-account wipe** (business data + `auth.users` login; **Stripe cancel is MANUAL —
see §1**). A hidden 30-day recovery archive is kept then destroyed. Anyone who never returns is **auto-purged 7 days**
after activation. Cut-off email + day-3 + day-6 reminder emails.

### Settled decisions (do NOT relitigate)
- Targeting by IMO via **data** (`imos.access_revoked_at` timestamp), never hardcoded ids
  (local/remote ids differ; FFG sentinel `ffffffff-...` is the one stable id).
- **Super-admin bypass evaluated FIRST everywhere** — the owner (`nickneessen@thestandardhq.com`)
  is himself on the FFG IMO and must never be locked out. (Other super-admin context:
  `is_super_admin` is a `user_profiles` column, not a role.)
- **Two switches:** (A) reversible `access_revoked_at` flag; (B) irreversible per-user wipe. Never one button.
- Wipe = FULL account (data + auth.users). User-triggered: download → confirm → wipe.
  **Stripe cancellation + any refunds are MANUAL (owner, in the Stripe dashboard) — decision
  2026-05-27.** The wipe path performs NO Stripe operations. Ordering: press the RED BUTTON
  FIRST, then cancel in Stripe, because `customer.subscription.deleted` downgrades the user to
  the free plan + deprovisions their chat bot (`stripe-webhook/index.ts:1550-1566`, `:1642`) — a
  visible "tell" if done before revocation locks them out.
- Enforcement is backend (RLS) AND frontend (sunset page) — not UI-only.
- Integrity: pre-generate each user's export bundle at activation (point-in-time), **async** (not
  synchronously in the activate call — ~150s edge fn limit).
- Formats: Excel (.xlsx multi-sheet) + CSV (.zip) server-side; **PDF generated client-side** from JSON.
- Ships **DORMANT**: nothing changes for any user until the owner sets `access_revoked_at`.

---

## 2. DONE THIS SESSION — applied to LOCAL DB only, all DORMANT, NOT committed to git

All four migrations applied locally via `./scripts/migrations/run-migration.sh`. **NOT yet applied
to remote** (batched at end per plan). Files are `git add -N` (intent-to-add), nothing committed.

1. **Migration A** — `supabase/migrations/20260526193029_imo_access_revocation_mechanism.sql`
   - `imos.access_revoked_at timestamptz DEFAULT NULL` (NULL = dormant).
   - `is_access_revoked(p_user_id uuid)` — SECURITY DEFINER STABLE, super-admin-FIRST, EXISTS on
     `imos.access_revoked_at <= now()` for the user's IMO. GRANTed to authenticated.
   - `CREATE OR REPLACE get_effective_imo_id()` adds a **sentinel-UUID** deny branch
     (`00000000-0000-0000-0000-000000000000`). ⚠️ **NEVER return NULL** — NULL is the super-admin
     see-all hatch AND `get_my_imo_id()`'s COALESCE would fall through to the real imo_id (double leak).
   - Verified: revoking an IMO flips only that IMO's users; dormant = all false.

2. **Migration D** — `supabase/migrations/20260526193252_account_lifecycle_audit_tables.sql`
   - `data_export_log` + `account_deletion_log`. user_id/imo_id are **plain columns, NO FK** (rows
     survive the user's deletion). RLS ON, **zero policies** = service-role-only access.

3. **Owned-tables registry** — `supabase/functions/_shared/owned-tables.ts` (catalog-validated)
   - `EXPORTED_TABLES` (35 user-facing) + `WIPE_ONLY_TABLES` (~45 internal) + `ACTOR_REFS_TO_NULL`
     (nullable NO-ACTION refs → SET NULL) + `ACTOR_REFS_TO_REASSIGN` (6 NOT-NULL refs → reassign to
     super-admin so shared content like training_modules survives).
   - Each row: `table`, `ownerColumn`, `export`, `sheet`, `wipe` ("cascade"|"explicit"), `storageBucket`.
   - **Review fixes applied:** `commissions` corrected cascade→**explicit** (it has NO FK to
     user_profiles → would orphan otherwise); bucket name `presentation-submissions`→`presentation-recordings`.

4. **Migration B** — `supabase/migrations/20260526200139_revocation_gate_owned_tables.sql`
   (**DENY-BY-DEFAULT** — refactored 2026-05-27 after the review below; RLS-verified)
   - RESTRICTIVE `revocation_deny` (`FOR ALL TO authenticated USING/WITH CHECK
     (NOT is_access_revoked(auth.uid()))`) attached to **EVERY RLS-enabled public base table
     EXCEPT a 5-table allowlist** (`user_profiles`, `imos`, `agencies`, `data_export_log`,
     `account_deletion_log`) — currently 190 tables. Catalog-driven `DO` loop, not a hardcoded
     list. AND-s a deny onto permissive policies, closing the imo_id-less gap, the `imo_id IS NULL`
     disjunct, AND any future table in one stroke. Allowlist = what a revoked session reads BEFORE
     SunsetGate renders (auth→user_profiles, ImoProvider→imos+agencies embed) + service-role-only
     audit tables.
   - **WHY deny-by-default (the big find this session):** a gate-completeness review proved the
     prior blocklist (the owned-tables registry) was structurally unreliable — it had already
     missed 8+ tables with direct `auth.uid()` read policies that bypass the chokepoint
     (`user_targets`, `chargebacks`, `messages`, `carrier_contracts`, `roadmap_item_progress`,
     `team_*_seats`, …). A kill switch must fail closed → flipped to whitelist-what's-allowed.
     **Reads = deny-by-default (this migration); destruction = explicit allowlist (the registry
     drives wipe/export only).** Owner approved the pivot.
   - Verified: 190 gated / 5 allowlisted (un-gated); completeness tripwire returns 0; on
     `user_targets` (a previously-leaking table) a non-super-admin sees their row when dormant and
     **0 rows after revocation** (real-JWT rolled-back test); service-role wipe unaffected.
   - **RLS blind spot (documented invariant, NOT a current leak):** the 8 `mv_*` materialized
     views can't enforce RLS, but are granted to NEITHER authenticated NOR anon
     (`has_table_privilege` = false) → unreachable by a revoked JWT. Never grant them to
     authenticated/anon; front with SECURITY DEFINER RPCs. (A code-review agent flagged these as a
     "critical leak"; primary-source `has_table_privilege` REFUTED it.)
   - Tripwire: `scripts/check-revocation-gate-completeness.sql` (self-deriving from applied
     policies; also asserts the policy qual references `is_access_revoked`). Run on LOCAL + REMOTE.

   **Registry change (`_shared/owned-tables.ts`):** +6 genuinely-owned tables found by the review —
   `carrier_contracts`/`carrier_contract_requests`/`roadmap_item_progress` (EXPORTED, user chose
   export+wipe; all CASCADE), `presentation_markers`/`team_seat_packs`/`team_uw_wizard_seats`
   (WIPE_ONLY, CASCADE). Migration E unchanged (all 6 are cascade → cleared by the profile delete).
   Removed the short-lived GATE_ONLY/ALL_GATED exports (the gate is no longer registry-driven).

5. **Migration C** — `supabase/migrations/20260526200510_revocation_gate_storage.sql` (verified)
   - RESTRICTIVE `revocation_deny_storage` on `storage.objects` scoped to private buckets
     `user-documents`, `contract-documents`, `presentation-recordings`. Shared buckets untouched.

6. **Migration E** — `supabase/migrations/20260527060621_wipe_user_business_data_fn.sql` (TESTED)
   - `wipe_user_business_data(p_user_id, p_reassign_to_user_id) → jsonb` manifest. SECURITY DEFINER,
     `search_path=public,pg_temp`, REVOKE PUBLIC/authenticated/anon + GRANT service_role only.
   - Guards: refuse NULL target; noop if profile already gone (idempotent); **refuse super-admin
     target** (column check on p_user_id, NOT is_access_revoked — under service-role is_super_admin()
     reads the session); **refuse non-revoked IMO** (can't wipe a live Epic Life user); reassign
     target must be a distinct super-admin.
   - Order: (1) NULL the 11 nullable actor-refs → (2) reassign the 6 NOT-NULL actor-refs to the
     super-admin → **(2.5) NULL inbound `commissions.related_advance_id` pointers** (the ONE
     gotcha: it's a plain NO-ACTION self-FK; a SURVIVING user's commission pointing at the wiped
     user's row would FK-violate and roll back the whole wipe — code-review finding, fixed +
     tested) → (3) DELETE 44 explicit tables → (4) DELETE user_profiles (CASCADE clears the 36
     cascade tables). Driven by `_shared/owned-tables.ts`; arrays parity-audited = exact match.
   - **Catalog fully validated (local):** all 80 tables+owner cols exist; all 36 cascade-marked
     tables truly CASCADE; all 17 NO-ACTION refs to user_profiles covered by actor-ref lists;
     nullability matches the NULL/reassign split; upline_id/recruiter_id are SET NULL (no downline
     cascade/block). Does NOT touch hard_delete_user (distinct signature).
   - **Out of scope (the `confirm-and-wipe-account` edge fn owns these):** storage purge, Stripe
     cancel, `auth.users` delete, `account_deletion_log` insert.
   - Empirical test (rolled-back txn, reusable): `scripts/test-wipe-user-business-data.sql`. Covers
     cascade delete, explicit delete, intra-user + **cross-user** commissions self-ref,
     actor-ref NULL, actor-ref reassign (shared module survives), idempotency. All pass.
   - Reviews: security-review = no findings; code-review (high) = 1 substantive (the self-FK,
     fixed), rest cosmetic. Open: the `export ⊆ wipe` parity UNIT TEST (TS) doesn't exist yet —
     build it (asserts the SQL arrays ⊆ owned-tables.ts) so future drift trips CI.

### Reviews run this session (both passes addressed)
- **Security review (HIGH ×1):** found the chokepoint alone didn't cover imo_id-less tables, and
  the `imo_id IS NULL` disjunct still leaked shared rows. **Both closed by Migrations B + C.**
  Confirmed `pipeline_phases`/`phase_checklist_items` use imo_id-IS-NULL for DEFAULT templates —
  intentionally NOT gated (shared config, no PII, no Epic Life tell).
- **Code review (correctness ×1):** `commissions` mis-marked cascade → fixed to explicit.
- Cleared: sentinel has zero collisions, SECURITY DEFINER/search_path correct, audit tables deny-all.

### Verified under a REAL JWT (rolled-back txn) — the reusable test pattern:
`auth.uid()` reads GUC `request.jwt.claim.sub`. To test RLS as a user in psql:
```sql
BEGIN;
INSERT INTO clients (user_id, name) VALUES ((SELECT id FROM user_profiles WHERE email='nick@nickneessen.com'),'ZZ_TEST');
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM user_profiles WHERE email='nick@nickneessen.com'),true);
SET LOCAL ROLE authenticated;
SELECT count(*) FROM clients WHERE name='ZZ_TEST';   -- dormant => 1
RESET ROLE;
UPDATE imos SET access_revoked_at=now() WHERE name='Epic Life';
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM user_profiles WHERE email='nick@nickneessen.com'),true);
SET LOCAL ROLE authenticated;
SELECT count(*) FROM clients WHERE name='ZZ_TEST';   -- revoked => 0
RESET ROLE; ROLLBACK;
```
Results obtained: dormant=1 visible, revoked=0, super-admin (FFG revoked)=never denied. ✅

---

## 3. ⚠️ HARD RULES
- **NEVER set `imos.access_revoked_at` on any real IMO until ALL of B, C ship AND the wipe path is
  tested.** A's sentinel only denies chokepoint-referencing policies; B/C cover the rest. (B+C are
  done locally, so the enforcement precondition is met locally — but nothing is on remote yet.)
- **Migrations: local AND remote, via the runner only.** `./scripts/migrations/run-migration.sh FILE.sql`
  then `source .env && DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-migration.sh FILE.sql`.
  Fresh `date +%Y%m%d%H%M%S` timestamp avoids the function-version downgrade block. NEVER raw psql.
- **Remote deploy is BATCHED at the end** (plan sequencing) — local only during the build.
- Super-admin carve-out can't be fully verified in service-role psql (auth.uid()=NULL there) — use
  the SET ROLE authenticated + set_config JWT pattern above, or a real browser session.

---

## 4. REMAINING WORK (in order) — task list IDs #6–#10

(Migration E DONE — see §2 item 6. `daily_sales_logs` open question RESOLVED: kept
`wipe:"explicit"` — clean/orphan-free for whole-IMO sunset, rows already exported.)

### Migration F — recovery bucket (task #6)
Private bucket `account-recovery-archives`, prefixes `snapshots/{user_id}/...` (frozen export,
retained for the wipe) + `recovery/{user_id}/...` (30-day post-wipe archive). Service-role only.

### Migration G — crons (task #6)
`invoke_account_lifecycle_daily()` copying the `invoke_lead_heat_scoring()` pg_cron + pg_net +
`app_config` pattern (see `20260427180000_lead_heat_cron_weekly.sql`). Daily schedule.

### Edge functions (task #7) — `supabase/functions/`
Reuse `_shared/supabase-client.ts` (`createSupabaseAdminClient`), CORS/auth from `send-email`,
Stripe + JWT from `create-portal-session`, `auth.admin.*` from `check-user-exists`. Pin esm.sh
imports (`scripts/check-pinned-imports.sh`).
- `activate-imo-revocation` (super-admin gated): set `access_revoked_at`; **refuse if target id is
  an Epic Life id**; require confirm text; then **async enqueue** one `data_export_log` row
  (status='pending') per affected user. DO NOT generate bundles synchronously here.
- `generate-user-export-bundle` (service-role): xlsx multi-sheet + csv zip + json, driven by
  `EXPORTED_TABLES`. Copy header/label maps from `src/features/policies/utils/policyExport.ts` +
  `src/utils/exportHelpers.ts` into `_shared/export-schema.ts` (Deno can't import `@/` aliases).
  Writes to `snapshots/{user_id}/`. Invoked by the cron drain + on-demand from the sunset page.
- `confirm-and-wipe-account` (user-JWT auth, self only / super-admin): copy snapshot →
  `recovery/` (set recovery_expires_at=+30d) → purge storage `{user}/` →
  `rpc('wipe_user_business_data', {p_user_id, p_reassign_to_user_id:<super-admin id>})` →
  `auth.admin.deleteUser` → INSERT `account_deletion_log` (reason='self_confirmed'). Idempotent.
  **NO Stripe call** — cancellation is manual (see §1 decision 2026-05-27). Do not re-add it.
- `account-lifecycle-cron` (service-role, pg_cron): drain pending exports; day-3/day-6 reminder
  emails; day-7 auto-purge (same wipe path, reason='auto_purge_7d'); 30-day recovery GC.
- Emails: reuse `send-email` with neutral templated bodies (no Epic Life mention).

### Frontend (task #8)
- `src/components/auth/SunsetGate.tsx` (new): order `loading→spinner` · `isSuperAdmin→children`
  (FIRST) · `revoked→<SunsetPage/>` · else children. Wire into BOTH `AuthenticatedApp` branches in
  `src/App.tsx` INSIDE `<ImoProvider>` (needs `useImo()`). No `/sunset` route (dormant = unreachable).
- `src/features/sunset/` page + components (calm standalone layout, NOT theme-v2 shell). Neutral copy
  is drafted in the master plan. Delete button disabled until a download occurred AND confirm checkbox
  ticked; "bundle pending" polls + blocks delete. Post-wipe: queryClient.clear() → clear local/session
  keys → signOut() → terminal confirmation (no link back).
- `src/features/admin/components/PlatformRevocationControl.tsx` (new) in `SystemSettingsTab.tsx`,
  super-admin-only. Double-confirm: type `REVOKE ${imo.name}` (computed, not hardcoded). Reversible
  deactivate (single confirm). Shows status (active since / users remaining / purge deadline).
- `src/hooks/imo/useRevocationStatus.ts` (new): derive from `useImo().imo?.access_revoked_at != null`
  — piggybacks existing context fetch, zero new queries. **Confirm `ImoRepository.findWithAgencies`
  selects the new `access_revoked_at` column** (else add it). Sunset hooks: useExportBundles (poll
  while pending), useDownloadExport, useDeleteMyAccount. Admin: useRevocationAdminStatus,
  useActivate/DeactivateRevocation.
- Extract `FFG_IMO_ID` to `src/constants/imos.ts` (replace hardcode at `CommissionRatesManagement.tsx:57`).

### Part 4 — public/unauthenticated leak surfaces (task #9), backend, disable for revoked IMO:
custom-domain recruiting funnel + public join/register (`/join/$recruiterId`, `/join-*`, `/register/*`),
public leaderboard shares (`/slack/name-leaderboard`), neutral transactional email copy. Needs the same
file-level depth as Parts 1–3 before its PR merges.

### Rehearsal + ship (task #10)
Seed throwaway IMO+users; verify dormant→activate DENY (not error) across owned tables + storage;
super-admin NOT locked out (real JWT); Epic Life unaffected; full export→confirm→wipe→recovery flow;
red-button double-confirm + deactivate. Then `npm run build` (zero TS errors) + supabase `get_advisors`
lint + SunsetGate ordering unit tests. THEN apply ALL migrations A–G to **remote** and regenerate
`src/types/database.types.ts` (`npx supabase gen types typescript --project-id <id>`), commit.

---

## 5. KEY ENVIRONMENT FACTS
- LOCAL: FFG = `ffffffff-...` (super-admin `nickneessen@thestandardhq.com` lives here),
  Epic Life = `2fd256e9-9abb-445e-b405-62436555648a` (user `nick@nickneessen.com`). REMOTE Epic
  Life id differs (`89514211-...`). FFG sentinel is identical across envs.
- Task list (this project) IDs: #6 wipe fn/bucket/crons, #7 edge fns, #8 frontend, #9 Part 4, #10 rehearsal.
- Validation: prefer `npm run build` (NOT validate-app.sh — it hangs).
- Nothing committed; user controls commits. Don't push to remote DB or git without saying so.

## 6. OPEN ITEMS (non-blocking)
- **Pre-existing audit-trigger noise:** seeding/DML on `commissions` + `clients` logs
  `WARNING: record "new"/"old" has no field "agency_id"/"imo_id"`. Source is
  `20251222_032_audit_triggers.sql` + `20260212165109_fix_audit_trigger_columns.sql` (NOT this
  branch); the trigger swallows its own error (WARNING, not ERROR). Harmless to the wipe but fires
  on every commission/client write in prod too — worth a separate fix someday, out of scope here.
- **Build the `export ⊆ wipe` parity unit test** (TS, Vitest): assert the three SQL arrays in
  Migration E mirror `owned-tables.ts` (ACTOR_REFS_TO_NULL / ACTOR_REFS_TO_REASSIGN / wipe==="explicit")
  and that every owner column exists in the catalog. This is the drift tripwire referenced in the
  registry header; it does not exist yet. (The GATE completeness tripwire IS built:
  `scripts/check-revocation-gate-completeness.sql`.)
- **Materialized-view invariant (cross-cutting):** the 8 `mv_*` views are user-scoped and RLS-exempt;
  they're safe ONLY because authenticated/anon lack SELECT. Pre-activation rehearsal must re-confirm
  `has_table_privilege('authenticated', 'public.mv_*', 'SELECT') = false` on REMOTE too. Separately,
  a code-review flagged a pre-existing potential `anon` cross-tenant concern on these — worth a
  standalone audit, out of scope for the sunset.
- **Run the gate-completeness check on REMOTE** after the batch deploy (remote may have extra tables);
  re-run Migration B there so the catalog loop covers remote's table set.
