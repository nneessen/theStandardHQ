# Continuation (MASTER) — Finish Epic Life tenant isolation

**Generated:** 2026-05-24 · **Branch:** main · **Paste everything below the divider into a new Claude Code conversation.**

This is the single entry point for all remaining Epic Life isolation work. It supersedes/consolidates two sibling handoffs (still on disk for detail):
- `plans/continuation-prompts/continue-20260523_2010-tierB-isolation.md` (Tier B SECURITY DEFINER getters — finalized design)
- `plans/continuation-prompts/continue-20260523_2035-epic-full-isolation-sweep.md` (full per-domain sweep)

---

## Nick's requirement (absolute)
A user created/assigned under **Epic Life** (`imo_id = 89514211-f2bd-4440-9527-90a472c5e622`; its agency "The Standard" = `1df3c15a-f48a-4fbd-b1a8-345793bba2c0`) must see **NOTHING** from FFG (`Founders Financial Group`) — pipelines, carriers, products, users, emails, messaging, slack, leaderboards, lead vendors, training, commissions, policies, anything. Epic gets its own everything. Firing-level sensitive.

## CRITICAL testing rule
Verify isolation **as a NORMAL Epic user, never as a super-admin** — super-admins get `get_effective_imo_id() = NULL` → **see-all by design**, so they will "see FFG" without it being a leak. The `epiclife.neessen@gmail.com` account was demoted on 2026-05-23 to a normal Epic admin (`is_super_admin=false`, `roles={admin,agent}`) specifically so it's a valid test bed.

## Gating model (what "correctly scoped" looks like)
- `get_effective_imo_id()`: super-admin→acting IMO; normal user→own imo (ignores claim); super-admin-not-acting→NULL (see-all).
- `row_in_acting_scope(imo_id uuid)`: canonical row gate. Takes an IMO id — for agency/user-keyed objects, resolve the entity's imo_id first.
- `super_admin_in_scope(imo_id)`: super-admin-only; safe (only widens for super-admins).
- A tenant table's SELECT policy must require `imo_id = get_my_imo_id()` (+ optional `super_admin_in_scope`). 

## THE SYSTEMIC TARGET (this is the main thing to find)
Many RLS policies use `(imo_id = get_my_imo_id() OR imo_id IS NULL)`. The **`imo_id IS NULL` branch makes any null-IMO row "global" → visible to EVERY tenant, including a normal Epic user.** That's the most likely real leak. For each tenant table: find policies with that pattern, then check whether null-IMO rows actually exist (`SELECT imo_id, count(*) FROM <t> GROUP BY imo_id`). Null rows = live leak → either backfill imo_id, clone per-IMO, or drop the null branch (decide per table).

Distinguish: **tenant-private** tables (must be imo-scoped, no null escape) vs **intentionally-global reference data** (carriers/products MAY be a deliberately shared catalog). For each "global" domain, **ASK NICK** whether Epic should own its own copy or share — do NOT assume.

---

## ALREADY DONE & LIVE (do NOT redo)
Migrations applied to local+remote prod AND committed to main (`b60b9e09`, login hotfix `92cd2dd2`):
- `20260523192047` public IMO visibility hardened (anon/discovery surfaces).
- `20260523195335` `get_agency_slack_credentials` revoked to service_role only.
- `20260523195642` Tier A: GATED `get_imo_metrics`,`get_agency_metrics`; REVOKED `get_imo_submit_totals`,`get_agency_users_for_sms`,`get_agency_hierarchy`,`get_agency_descendants` from authenticated.
- `20260523135334` (acting-scope part3) + `20260523140704` (archived_at col) committed.
- Frontend: `usePermissions` super-admin `can()` bypass; `leadsService` selects `is_listed`; `SupportDialog` login-crash fix.
- DATA: `epiclife.neessen@gmail.com` demoted to Epic-scoped admin (prod).
- Verified clean: `pipeline_templates` (4 rows, all FFG-owned, 0 null-IMO; the FFG pipelines Nick saw were super-admin see-all, NOT a leak).

---

## REMAINING WORK (priority order)

### 1. FULL per-domain isolation sweep (the big one)
Run read-only against remote prod first. Enumerate every `imo_id` table + RLS:
```sql
SELECT tablename, policyname, qual FROM pg_policies
WHERE schemaname='public' AND cmd IN ('SELECT','ALL')
  AND (qual ~ 'imo_id IS NULL'
       OR qual !~ '(get_my_imo_id|get_effective_imo_id|row_in_acting_scope|super_admin_in_scope)')
ORDER BY tablename;
```
For each hit: confirm whether null-IMO rows exist; classify private vs global; produce a verdict table (table | private/global | gated? | null-IMO rows? | action). Tables with NO imo_id but tenant data (pipeline_phases, commissions, clients) → verify gated via an imo-scoped parent FK.

**Domain checklist (confirm zero FFG rows as a normal Epic user):** recruiting (pipeline_phases, pipeline_automations, recruiting_leads, recruiting_progress, recruiter slugs), carriers & products (DECISION: shared vs Epic-owned — ASK), users/team/hierarchy/org-chart, email templates/messages/threads/contacts, slack integrations, leaderboards, lead vendors/packs/purchases, training (modules/lessons/quizzes/progress), underwriting (guides/rule sets/wizard), commissions/overrides/policies/clients/expenses/targets, landing/recruiting page settings, custom domains.

### 2. Tier B SECURITY DEFINER getters (design finalized — bodies already fetched)
**GATE:**
- `get_org_chart_data(text,uuid,bool,int)` — add AGENT-scope check (imo/agency branches already gated). After the agency `IF` block insert:
  ```sql
  IF v_scope = 'agent' THEN
    IF NOT public.row_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id = v_scope_id)) THEN
      RAISE EXCEPTION 'Not authorized to view this agent org chart';
    END IF;
  END IF;
  ```
  (prod body = `archive/2025/20251222_034_org_chart_rpc.sql`; reproduce 86-line body + this.)
- `get_downline_with_emails(uuid,int)` [sql] — first WHERE predicate `public.row_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id=p_user_id)) AND ...`
- `get_upline_chain(uuid,int)` [sql] — final select `... WHERE id IS NOT NULL AND public.row_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id=p_user_id))`
- `getuser_commission_profile(puser_id uuid, p_lookback_months int DEFAULT 12)` — RENAME to `_impl`, revoke _impl from authenticated/anon, grant service_role; CREATE plpgsql wrapper (same sig, RETURNS TABLE(contract_level int, simple_avg_rate numeric, weighted_avg_rate numeric, product_breakdown jsonb, data_quality text, calculated_at timestamptz)) that gates then `RETURN QUERY SELECT * FROM _impl(...)`; grant wrapper to authenticated.
- `get_team_analytics_data(uuid[],timestamptz,timestamptz)` — RENAME to `_impl` + wrapper (RETURNS json, keep `SET statement_timeout='15s'`): auth check + `IF EXISTS(SELECT 1 FROM user_profiles WHERE id=ANY(p_team_user_ids) AND NOT public.row_in_acting_scope(imo_id)) THEN RAISE EXCEPTION ... USING ERRCODE='42501'; END IF;` then return `_impl(...)`.

**REVOKE from authenticated/anon (keep service_role) — no user-facing caller:**
`build_agent_org_chart(uuid,bool,int)`, `build_agent_downline_tree(uuid,bool,int)`, `build_agency_org_chart(uuid,bool,int)`, `get_daily_production_by_agent(uuid,uuid)`, `get_user_commission_profile(uuid,int)` (orphan).

**LEAVE ALONE (RLS helpers — revoking breaks `user_profiles_select_hierarchy` → OUTAGE):**
`get_downline_ids(uuid)`, `get_user_upline_and_recruiter_ids(uuid)`.

### 3. Cron/batch helper triage
Per-function gate-vs-REVOKE for: `get_policies_for_lapse_check`, `get_license_expirations_for_check`, `get_commissions_for_threshold_check`, `get_policy_counts_for_check`, `get_pending_first_sale_logs`, `get_password_reminder_users`, `get_valid_users_for_rule`. Likely service_role cron → REVOKE from authenticated. **CHECK `pg_policies` for RLS usage of each before revoking** (that's how the get_downline_ids outage was caught). Confirm `get_agencies_for_join`/`get_public_invitation_by_token` safe (is_listed/token).

### 4. (Optional, quick) Sidebar nav for Epic admin
Now that the account is non-super-admin, its sidebar = `admin`+`agent` role perms. If items are missing, GRANT the needed `nav.*` permissions to the `admin` role (do NOT re-elevate to super-admin). admin currently has 18 nav perms; agent 8.

---

## Landmines / reminders
- Test as a NORMAL Epic user, never super-admin.
- Some `imo_id IS NULL` rows are legit-global seed data → backfill/clone per-IMO instead of blindly dropping the null branch. Decide per table.
- Before REVOKE on any function, grep `pg_policies` — RLS-helper functions break table access if revoked.
- Migrations: apply BOTH local + remote via `./scripts/migrations/run-migration.sh` then `source .env && DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-migration.sh FILE`. Read-only checks via `run-sql.sh` (sandbox-disable for remote host). Regen `database.types.ts` if signatures change. `npm run build` (NOT validate-app.sh — it hangs). Commit + push to main (prod deploys from main).
- Stage commits DELIBERATELY (a prior `git add -A` shipped an unrelated broken file to prod). Don't blind `add -A` when pushing straight to main.

## Definition of done
A normal Epic Life user sees zero FFG rows on every domain page; every tenant table's RLS is imo-scoped with no live null-IMO leak; Tier B + cron triage applied; per "global" domain Nick has explicitly decided shared-vs-owned; build green; all pushed to main.
