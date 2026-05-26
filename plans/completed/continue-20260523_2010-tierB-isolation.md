# Continuation — Epic Life isolation: Tier B authenticated getters + triage

**Generated:** 2026-05-23. **Branch:** main. Prior work is COMMITTED + PUSHED (`b60b9e09`) and migrations APPLIED to local+remote prod.

## Already done & live (do NOT redo)
- **Slack creds** (`20260523195335`): `get_agency_slack_credentials` revoked from authenticated/anon (service_role kept). Only slack-oauth edge fns (service_role) call it.
- **Tier A** (`20260523195642`): GATED `get_imo_metrics`, `get_agency_metrics` via `row_in_acting_scope`; REVOKED `get_imo_submit_totals`, `get_agency_users_for_sms`, `get_agency_hierarchy`, `get_agency_descendants` from authenticated (kept service_role).
- **Super-admin sidebar fix**: `src/hooks/permissions/usePermissions.ts` — `can()/canAny()/canAll()` bypass when `user.is_super_admin === true`. Root cause: super-admin is a profile COLUMN, not a role; `roles` table has NO super_admin row, so role-based `can()` never granted super-admin perms → permission-gated nav items hidden. (User chose: keep `epiclife.neessen@gmail.com` a GLOBAL super-admin.)
- **leadsService**: fallback select now includes `is_listed`.
- Committed the 3 previously-untracked applied migrations (`20260523192047`, `20260523135334`, `20260523140704`) so main matches prod.

## Verified prod facts
- Add-Recruit upline / admin lists already gated in prod (part3 + archived_col live).
- `get_org_chart_data` still UNGATED in prod (agent scope leak open).
- The acting model: `get_effective_imo_id()` returns acting IMO for super-admin, own imo for normal user (ignores claim), NULL for super-admin-not-acting (see-all). `row_in_acting_scope(imo_id)` is the canonical row gate. `row_in_acting_scope` takes an IMO id — for agency/user-keyed fns, resolve the entity's imo_id first.

## REMAINING WORK — Tier B migration (design finalized)
All bodies fetched; gate/revoke decisions made from caller analysis.

**GATE (user-facing):**
1. `get_org_chart_data(text,uuid,bool,int)` — add AGENT-scope auth check. After the existing agency `IF` block (prod body confirmed = archived `archive/2025/20251222_034_org_chart_rpc.sql`), insert:
   ```sql
   IF v_scope = 'agent' THEN
     IF NOT public.row_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id = v_scope_id)) THEN
       RAISE EXCEPTION 'Not authorized to view this agent org chart';
     END IF;
   END IF;
   ```
   Reproduce full prod body (86 lines) with this added. Leave imo/agency branches unchanged.
2. `get_downline_with_emails(uuid,int)` [LANGUAGE sql] — add as FIRST WHERE predicate: `public.row_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id = p_user_id)) AND ...`
3. `get_upline_chain(uuid,int)` [LANGUAGE sql] — final `SELECT * FROM upline_tree WHERE id IS NOT NULL` → append `AND public.row_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id = p_user_id))`
4. `getuser_commission_profile(puser_id uuid, p_lookback_months integer DEFAULT 12)` [2-arg, frontend uses this] — RENAME to `_impl`, REVOKE _impl from authenticated/anon, GRANT _impl to service_role, CREATE plpgsql wrapper same sig that gates `row_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id = puser_id))` then `RETURN QUERY SELECT * FROM ..._impl(...)`. Wrapper RETURNS TABLE(contract_level integer, simple_avg_rate numeric, weighted_avg_rate numeric, product_breakdown jsonb, data_quality text, calculated_at timestamptz). GRANT wrapper to authenticated.
5. `get_team_analytics_data(uuid[],timestamptz,timestamptz)` — RENAME to `_impl` + wrapper (RETURNS json, keep `SET statement_timeout='15s'`). Wrapper: auth check + `IF EXISTS (SELECT 1 FROM user_profiles WHERE id = ANY(p_team_user_ids) AND NOT public.row_in_acting_scope(imo_id)) THEN RAISE EXCEPTION ... USING ERRCODE='42501'; END IF;` then `RETURN ..._impl(...)`.

**REVOKE from authenticated/anon (keep service_role) — no user-facing caller:**
- `build_agent_org_chart(uuid,bool,int)`, `build_agent_downline_tree(uuid,bool,int)`, `build_agency_org_chart(uuid,bool,int)` (reached only internally via get_org_chart_data, SECURITY DEFINER).
- `get_daily_production_by_agent(uuid,uuid)` (edge slack-refresh-leaderboard, service_role).
- `get_user_commission_profile(uuid,integer)` (orphan; frontend uses `getuser_` not `get_user_`).

**LEAVE ALONE (RLS helpers — revoking breaks `user_profiles_select_hierarchy` policy → outage):**
- `get_downline_ids(uuid)`, `get_user_upline_and_recruiter_ids(uuid)`. Low-sensitivity (UUIDs only). Revisit with RLS-aware approach later.

## Then: triage migration (task #4)
Per-function gate-vs-REVOKE for cron/batch helpers: `get_policies_for_lapse_check`, `get_license_expirations_for_check`, `get_commissions_for_threshold_check`, `get_policy_counts_for_check`, `get_pending_first_sale_logs`, `get_password_reminder_users`, `get_valid_users_for_rule`. These are likely service_role cron → REVOKE from authenticated. CHECK pg_policies for RLS usage before revoking each (that's how the get_downline_ids outage risk was caught). Confirm `get_agencies_for_join`/`get_public_invitation_by_token` safe as-is (is_listed / token).

## Verification (run after Tier B)
```bash
source .env && DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-sql.sh "SELECT p.proname,(pg_get_functiondef(p.oid) ~ 'row_in_acting_scope') gated, has_function_privilege('authenticated',p.oid,'EXECUTE') auth FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN ('get_org_chart_data','build_agent_org_chart','build_agent_downline_tree','build_agency_org_chart','get_downline_with_emails','get_upline_chain','getuser_commission_profile','get_team_analytics_data','get_daily_production_by_agent','get_user_commission_profile') ORDER BY gated;"
```
Each target: `gated=true` OR `auth=false`. Behavioral: as normal FFG user, `get_org_chart_data('agent','<epic agent uuid>')` raises; own `get_org_chart_data('auto')` unchanged. `npm run build` green. Apply each migration local+remote, commit+push to main.

## Follow-ups (note)
- `admin_deleteuser` cross-IMO check (write; needs upline relationship — low risk).
- `roles` array has bogus `"super-admin"` string (no such role; inert). Could clean later.
- SupportDialog.tsx has `useState(2)` default with only 2 categories (index OOB) — pre-existing, unrelated.
