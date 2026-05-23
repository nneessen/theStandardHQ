-- =============================================================================
-- Rewrite super-admin RLS policies to honor acting_imo_id (Layer 3 isolation)
-- =============================================================================
--
-- PURPOSE:
-- After 20260521213701 + 20260522080218 + 20260522123045 closed non-super-admin
-- leaks, every super-admin RLS policy still says "if you're super-admin,
-- return TRUE" unconditionally. The Layer 2 actingImoId frontend override
-- fixed WRITES (recruits etc. now land under Epic Life) but READS still bypass
-- scoping. This migration teaches RLS to honor the JWT acting_imo_id claim.
--
-- The companion migration 20260522180340_add_effective_imo_id_function.sql
-- added two helpers:
--   - get_effective_imo_id()      — returns acting IMO uuid OR NULL (= see-all)
--   - super_admin_in_scope(uuid)  — true iff super-admin AND (no override
--                                   OR row matches override)
--
-- This migration rewrites every super-admin policy on every imo-scopable
-- table to consult super_admin_in_scope() instead of bare is_super_admin().
--
-- WHAT IS NOT TOUCHED (global tables — by design):
--   imos                  - sidebar switcher MUST see all IMOs
--   permissions, roles, role_permissions
--                          - global RBAC catalog
--   subscription_plans, subscription_addons,
--   subscription_plan_changes, subscription_settings
--                          - billing infrastructure shared across IMOs
--   sync_hierarchy_root, system_audit_log, system_settings
--                          - system-level infra
--   global_expense_categories
--                          - shared catalog (name says it)
--   underwriting_health_conditions
--                          - shared medical knowledge base
--   workflow_events        - global event log, no FK to an IMO source
--   notification_digest_log - per-user notification queue, IMO-agnostic
--
-- PATTERN-MATCH STRATEGY:
-- pg_policies.qual::text renders policies in a canonical form. We use
-- regexp_replace to swap two known shapes of "super-admin always wins":
--
--   Shape A:  is_super_admin()
--   Shape B:  (EXISTS ( SELECT 1
--                FROM user_profiles
--                WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid))
--                       AND (user_profiles.is_super_admin = true))))
--
-- Both get replaced with the table-appropriate super_admin_in_scope(...)
-- call. For tables with a direct imo_id column: super_admin_in_scope(imo_id).
-- For tables that scope via a parent FK: super_admin_in_scope((SELECT imo_id
-- FROM parent WHERE parent.id = this_table.fk)).
--
-- Policies whose qual is more nuanced (e.g. "imo_id IN (subquery joining
-- user_profiles with admin role check) OR is_super_admin = true" — a
-- permission grant, NOT a scope-bypass) are NOT touched by the generic
-- pass and are inventoried in a follow-up section for hand-rewrite.
-- =============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Inventory: capture which policies we MIGHT touch and confirm nothing
-- unexpected gets caught.
-- ----------------------------------------------------------------------------

DO $audit$
DECLARE
  total_super_admin int;
  global_tables_excluded text[] := ARRAY[
    'imos','permissions','roles','role_permissions',
    'subscription_plans','subscription_addons','subscription_plan_changes','subscription_settings',
    'sync_hierarchy_root','system_audit_log','system_settings',
    'global_expense_categories','underwriting_health_conditions',
    'workflow_events','notification_digest_log'
  ];
  candidate_count int;
BEGIN
  SELECT COUNT(*) INTO total_super_admin
    FROM pg_policies
   WHERE schemaname='public' AND (qual::text ~ 'super_admin' OR with_check::text ~ 'super_admin');

  SELECT COUNT(*) INTO candidate_count
    FROM pg_policies
   WHERE schemaname='public'
     AND NOT (tablename = ANY(global_tables_excluded))
     AND (
       qual::text ~ 'is_super_admin\(\)'
       OR qual::text ~ 'user_profiles\.is_super_admin = true'
       OR with_check::text ~ 'is_super_admin\(\)'
       OR with_check::text ~ 'user_profiles\.is_super_admin = true'
     );

  RAISE NOTICE 'Pre-migration: % total super-admin-referencing policies, % candidate rewrites (after excluding global tables)',
    total_super_admin, candidate_count;
END
$audit$;

-- ----------------------------------------------------------------------------
-- Main rewrite loop.
-- ----------------------------------------------------------------------------

DO $rewrite$
DECLARE
  pol RECORD;
  replacement_expr text;
  new_qual text;
  new_check text;
  with_check_clause text;
  roles_clause text;
  for_clause text;
  rewrote_count int := 0;
  skipped_count int := 0;
  global_tables_excluded constant text[] := ARRAY[
    'imos','permissions','roles','role_permissions',
    'subscription_plans','subscription_addons','subscription_plan_changes','subscription_settings',
    'sync_hierarchy_root','system_audit_log','system_settings',
    'global_expense_categories','underwriting_health_conditions',
    'workflow_events','notification_digest_log'
  ];
  -- These are the exact regex patterns we know how to rewrite safely.
  -- Anything else gets skipped and logged for manual review.
  pattern_simple constant text := 'is_super_admin\(\)';
  pattern_exists constant text :=
    E'\\(EXISTS \\( SELECT 1[[:space:]]+FROM user_profiles[[:space:]]+WHERE \\(\\(user_profiles\\.id = (\\( SELECT auth\\.uid\\(\\) AS uid\\)|auth\\.uid\\(\\))\\) AND \\(user_profiles\\.is_super_admin = true\\)\\)\\)\\)';
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check, roles, permissive
      FROM pg_policies
     WHERE schemaname = 'public'
       AND NOT (tablename = ANY(global_tables_excluded))
       AND (
         qual::text ~ pattern_simple
         OR qual::text ~ pattern_exists
         OR with_check::text ~ pattern_simple
         OR with_check::text ~ pattern_exists
       )
     ORDER BY tablename, policyname
  LOOP
    -- Pick replacement expression based on whether the table has a direct
    -- imo_id column or scopes via a known parent FK.
    replacement_expr := CASE pol.tablename
      WHEN 'agent_state_licenses'        THEN format('super_admin_in_scope((SELECT imo_id FROM user_profiles WHERE id = %I.agent_id))', pol.tablename)
      WHEN 'alert_rule_evaluations'      THEN format('super_admin_in_scope((SELECT imo_id FROM alert_rules WHERE id = %I.rule_id))', pol.tablename)
      WHEN 'clients'                     THEN format('super_admin_in_scope((SELECT imo_id FROM user_profiles WHERE id = %I.user_id))', pol.tablename)
      WHEN 'close_ai_generations'        THEN format('super_admin_in_scope((SELECT imo_id FROM user_profiles WHERE id = %I.user_id))', pol.tablename)
      WHEN 'email_templates'             THEN format('super_admin_in_scope((SELECT imo_id FROM user_profiles WHERE id = %I.created_by))', pol.tablename)
      WHEN 'marketing_audience_members'  THEN format('super_admin_in_scope((SELECT up.imo_id FROM marketing_audiences ma JOIN user_profiles up ON up.id = ma.created_by WHERE ma.id = %I.audience_id))', pol.tablename)
      WHEN 'marketing_audiences'         THEN format('super_admin_in_scope((SELECT imo_id FROM user_profiles WHERE id = %I.created_by))', pol.tablename)
      WHEN 'marketing_brand_settings'    THEN format('super_admin_in_scope((SELECT imo_id FROM user_profiles WHERE id = %I.created_by))', pol.tablename)
      WHEN 'marketing_external_contacts' THEN format('super_admin_in_scope((SELECT imo_id FROM user_profiles WHERE id = %I.created_by))', pol.tablename)
      WHEN 'pipeline_automation_logs'    THEN format('super_admin_in_scope((SELECT imo_id FROM pipeline_automations WHERE id = %I.automation_id))', pol.tablename)
      WHEN 'pipeline_phases'             THEN format('super_admin_in_scope((SELECT imo_id FROM pipeline_templates WHERE id = %I.template_id))', pol.tablename)
      WHEN 'roadmap_item_progress'       THEN format('super_admin_in_scope((SELECT imo_id FROM user_profiles WHERE id = %I.user_id))', pol.tablename)
      WHEN 'roadmap_items'               THEN format('super_admin_in_scope((SELECT rt.imo_id FROM roadmap_sections rs JOIN roadmap_templates rt ON rt.id = rs.roadmap_id WHERE rs.id = %I.section_id))', pol.tablename)
      WHEN 'roadmap_sections'            THEN format('super_admin_in_scope((SELECT imo_id FROM roadmap_templates WHERE id = %I.roadmap_id))', pol.tablename)
      WHEN 'scheduled_report_deliveries' THEN format('super_admin_in_scope((SELECT imo_id FROM scheduled_reports WHERE id = %I.schedule_id))', pol.tablename)
      WHEN 'signature_submitters'        THEN format('super_admin_in_scope((SELECT imo_id FROM signature_submissions WHERE id = %I.submission_id))', pol.tablename)
      WHEN 'state_classifications'       THEN format('super_admin_in_scope((SELECT imo_id FROM agencies WHERE id = %I.agency_id))', pol.tablename)
      WHEN 'team_seat_packs'             THEN format('super_admin_in_scope((SELECT imo_id FROM user_profiles WHERE id = %I.owner_id))', pol.tablename)
      WHEN 'team_uw_wizard_seats'        THEN format('super_admin_in_scope((SELECT imo_id FROM user_profiles WHERE id = %I.team_owner_id))', pol.tablename)
      WHEN 'user_subscription_addons'    THEN format('super_admin_in_scope((SELECT imo_id FROM user_profiles WHERE id = %I.user_id))', pol.tablename)
      WHEN 'user_subscriptions'          THEN format('super_admin_in_scope((SELECT imo_id FROM user_profiles WHERE id = %I.user_id))', pol.tablename)
      WHEN 'user_targets'                THEN format('super_admin_in_scope((SELECT imo_id FROM user_profiles WHERE id = %I.user_id))', pol.tablename)
      WHEN 'writing_number_history'      THEN format('super_admin_in_scope((SELECT imo_id FROM user_profiles WHERE id = %I.agent_id))', pol.tablename)
      ELSE
        -- Default: only if the table actually has imo_id. If not (schema drift,
        -- remote-only tables, etc.), set NULL and skip the policy with a notice.
        CASE
          WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = pol.schemaname
               AND table_name   = pol.tablename
               AND column_name  = 'imo_id'
          ) THEN format('super_admin_in_scope(%I.imo_id)', pol.tablename)
          ELSE NULL
        END
    END;

    IF replacement_expr IS NULL THEN
      RAISE NOTICE 'SKIP — %.% (no imo_id column AND no per-table FK rule)', pol.tablename, pol.policyname;
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    -- Apply both regex substitutions to qual + with_check.
    new_qual := pol.qual::text;
    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, pattern_exists, replacement_expr, 'g');
      new_qual := regexp_replace(new_qual, pattern_simple, replacement_expr, 'g');
    END IF;

    new_check := pol.with_check::text;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, pattern_exists, replacement_expr, 'g');
      new_check := regexp_replace(new_check, pattern_simple, replacement_expr, 'g');
    END IF;

    -- If neither qual nor with_check changed, skip — the policy used a pattern
    -- we don't recognize. Log and continue.
    IF (new_qual IS NOT DISTINCT FROM pol.qual::text)
       AND (new_check IS NOT DISTINCT FROM pol.with_check::text) THEN
      RAISE NOTICE 'SKIP — no recognized super-admin pattern in %.% (cmd=%)',
        pol.tablename, pol.policyname, pol.cmd;
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    -- Construct the CREATE POLICY statement.
    for_clause := CASE pol.cmd
      WHEN 'ALL'    THEN 'FOR ALL'
      WHEN 'SELECT' THEN 'FOR SELECT'
      WHEN 'INSERT' THEN 'FOR INSERT'
      WHEN 'UPDATE' THEN 'FOR UPDATE'
      WHEN 'DELETE' THEN 'FOR DELETE'
    END;

    roles_clause := CASE
      WHEN pol.roles = '{public}'::name[] THEN ''
      ELSE 'TO ' || array_to_string(pol.roles, ', ')
    END;

    with_check_clause := CASE
      WHEN new_check IS NULL THEN ''
      ELSE 'WITH CHECK (' || new_check || ')'
    END;

    -- Drop and recreate. The runner script wraps everything in a transaction,
    -- so a single failure rolls all rewrites back.
    EXECUTE format('DROP POLICY %I ON %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);

    EXECUTE format('CREATE POLICY %I ON %I.%I %s %s %s %s',
                   pol.policyname,
                   pol.schemaname,
                   pol.tablename,
                   for_clause,
                   roles_clause,
                   CASE WHEN new_qual IS NULL THEN '' ELSE 'USING (' || new_qual || ')' END,
                   with_check_clause);

    rewrote_count := rewrote_count + 1;
  END LOOP;

  RAISE NOTICE '== Rewrite summary: % policies rewrote, % skipped (unrecognized pattern) ==',
    rewrote_count, skipped_count;
END
$rewrite$;

-- ----------------------------------------------------------------------------
-- Post-rewrite assertion: every super-admin-referencing policy on a
-- non-global table must now reference super_admin_in_scope (or be one of the
-- skipped legacy permission grants flagged for follow-up).
-- ----------------------------------------------------------------------------

DO $assert$
DECLARE
  unscoped_count int;
  unscoped_examples text;
  global_tables_excluded constant text[] := ARRAY[
    'imos','permissions','roles','role_permissions',
    'subscription_plans','subscription_addons','subscription_plan_changes','subscription_settings',
    'sync_hierarchy_root','system_audit_log','system_settings',
    'global_expense_categories','underwriting_health_conditions',
    'workflow_events','notification_digest_log'
  ];
BEGIN
  -- Count policies on non-global tables that still reference is_super_admin
  -- without also referencing super_admin_in_scope. These are the legacy
  -- "permission grant" style we deliberately skipped — log them so they're
  -- visible for follow-up.
  WITH leftovers AS (
    SELECT tablename, policyname, cmd, qual::text AS qual_text
      FROM pg_policies
     WHERE schemaname='public'
       AND NOT (tablename = ANY(global_tables_excluded))
       AND (qual::text ~ 'super_admin' OR with_check::text ~ 'super_admin')
       AND NOT (qual::text ~ 'super_admin_in_scope' OR with_check::text ~ 'super_admin_in_scope')
  )
  SELECT COUNT(*), string_agg(tablename || '.' || policyname, ', ' ORDER BY tablename, policyname)
    INTO unscoped_count, unscoped_examples
    FROM leftovers;

  IF unscoped_count > 0 THEN
    RAISE NOTICE 'FOLLOW-UP: % scopable policies still reference super_admin without super_admin_in_scope', unscoped_count;
    RAISE NOTICE 'Affected: %', unscoped_examples;
    RAISE NOTICE 'These are legacy "admin OR super_admin role check" patterns — they already restrict to user.imo_id and need separate hand-rewrite for acting-IMO support.';
  ELSE
    RAISE NOTICE 'All scopable super-admin policies now reference super_admin_in_scope';
  END IF;
END
$assert$;

COMMIT;
