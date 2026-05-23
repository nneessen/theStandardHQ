-- =============================================================================
-- Universal IMO gate: enforce effective-imo scoping on every authenticated
-- policy on every imo-scoped table that doesn't already have it.
-- =============================================================================
--
-- THE PROBLEM:
-- Prior migrations gated three categories of policies:
--   - 107 super-admin "see all" policies (20260522180703)
--   -   4 leftover super-admin permission-grant patterns (20260522182322)
--   - 249 ownership policies using auth.uid() (20260522185549)
-- That left 111 more policies on imo-scoped tables that use OTHER access shapes:
--   - `agency_id = get_my_agency_id()`
--   - `has_role(auth.uid(), 'X')`
--   - role-based grants without auth.uid() in qual
--   - any policy that doesn't mention auth.uid() but isn't already gated
-- These are still leaky: when super-admin Nick acts as Epic, they let him see
-- Founders rows because the underlying check (his role, his agency) is
-- satisfied independent of the row's imo_id.
--
-- THE FIX:
-- Append `AND (get_effective_imo_id() IS NULL OR <table>.imo_id IS NULL OR
--   <table>.imo_id = get_effective_imo_id())` to every authenticated-role
-- policy on every imo-scoped table that isn't already gated. Safe for
-- non-super-admins (helper returns their real imo, gate always passes for
-- their own rows). Scopes super-admins correctly when acting.
--
-- IDEMPOTENT: the filter skips policies that already reference
-- get_effective_imo_id() or super_admin_in_scope, so this migration can be
-- re-run if Supabase introduces new policies that need gating.
-- =============================================================================

BEGIN;

DO $rewrite$
DECLARE
  pol RECORD;
  new_qual text;
  new_check text;
  for_clause text;
  roles_clause text;
  with_check_clause text;
  rewrote_count int := 0;
  skipped_count int := 0;
  gate_clause text;
BEGIN
  FOR pol IN
    SELECT p.schemaname, p.tablename, p.policyname, p.cmd, p.qual, p.with_check, p.roles, p.permissive
      FROM pg_policies p
     WHERE p.schemaname = 'public'
       -- Only tables with a direct imo_id column
       AND EXISTS (
         SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema = p.schemaname
            AND c.table_name = p.tablename
            AND c.column_name = 'imo_id'
       )
       -- Skip already-gated policies (idempotent)
       AND NOT (
         COALESCE(p.qual::text, '') ~ 'get_effective_imo_id\(\)'
         OR COALESCE(p.qual::text, '') ~ 'super_admin_in_scope'
         OR COALESCE(p.with_check::text, '') ~ 'get_effective_imo_id\(\)'
         OR COALESCE(p.with_check::text, '') ~ 'super_admin_in_scope'
       )
       -- Only authenticated-role policies; never touch service_role policies
       AND 'authenticated' = ANY(p.roles)
     ORDER BY p.tablename, p.policyname
  LOOP
    gate_clause := format(
      '(get_effective_imo_id() IS NULL OR %I.imo_id IS NULL OR %I.imo_id = get_effective_imo_id())',
      pol.tablename, pol.tablename
    );

    IF pol.qual IS NOT NULL THEN
      new_qual := format('(%s) AND %s', pol.qual::text, gate_clause);
    ELSE
      new_qual := NULL;
    END IF;

    IF pol.with_check IS NOT NULL THEN
      new_check := format('(%s) AND %s', pol.with_check::text, gate_clause);
    ELSE
      new_check := NULL;
    END IF;

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

    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'SKIP — failed to rewrite %.%: %', pol.tablename, pol.policyname, SQLERRM;
      skipped_count := skipped_count + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Universal-gate rewrite: % policies rewrote, % skipped',
    rewrote_count, skipped_count;
END
$rewrite$;

-- Post-condition: zero authenticated-role policies on imo-scoped tables
-- should remain ungated.
DO $assert$
DECLARE
  leftover int;
  leftover_examples text;
BEGIN
  WITH imo_scoped_tables AS (
    SELECT table_name FROM information_schema.columns
     WHERE table_schema='public' AND column_name='imo_id'
  )
  SELECT count(*), string_agg(p.tablename || '.' || p.policyname, ', ' ORDER BY p.tablename, p.policyname)
    INTO leftover, leftover_examples
    FROM pg_policies p
    JOIN imo_scoped_tables t ON t.table_name = p.tablename
   WHERE p.schemaname='public'
     AND 'authenticated' = ANY(p.roles)
     AND NOT (
       COALESCE(p.qual::text, '') ~ 'get_effective_imo_id\(\)'
       OR COALESCE(p.qual::text, '') ~ 'super_admin_in_scope'
       OR COALESCE(p.with_check::text, '') ~ 'get_effective_imo_id\(\)'
       OR COALESCE(p.with_check::text, '') ~ 'super_admin_in_scope'
     );

  IF leftover > 0 THEN
    RAISE NOTICE 'LEFTOVER: % authenticated policies on imo-scoped tables still ungated', leftover;
    RAISE NOTICE 'Affected: %', leftover_examples;
  ELSE
    RAISE NOTICE 'All authenticated policies on imo-scoped tables are now gated';
  END IF;
END
$assert$;

COMMIT;
