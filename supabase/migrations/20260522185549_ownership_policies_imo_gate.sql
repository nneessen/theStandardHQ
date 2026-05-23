-- =============================================================================
-- Add IMO gate to all ownership-based RLS policies on imo-scoped tables
-- =============================================================================
--
-- THE BUG:
-- Super-admin scoping (20260522180703 + 182322 + 183721) handled super-admin
-- policies, but missed a parallel population of "ownership" policies that
-- grant access purely on identity:
--   `(user_id = auth.uid())`
--   `(created_by = auth.uid())`
--   `(agent_id = auth.uid())`
-- These have NO imo check. When super-admin Nick acts as Epic Life, ownership
-- policies on imo-scoped tables (policies, commissions, training_*, slack_*,
-- workflows, user_profiles, recruit_*, etc.) still let him see his OWN rows —
-- which were created in his REAL IMO (Founders). Result: every page that
-- lists "your X" still shows Founders data when acting as Epic.
--
-- THE FIX:
-- Append `AND (get_effective_imo_id() IS NULL OR imo_id IS NULL OR
--   imo_id = get_effective_imo_id())` to every ownership policy on every
-- imo-scoped table.
--
-- Why this is safe for non-super-admins:
--   get_effective_imo_id() returns their REAL imo_id (claim is ignored for
--   non-super-admins). For a user's OWN row, imo_id = their imo by data
--   integrity (enforce_user_profile_imo_consistency trigger). Gate passes.
--
-- Why this scopes super-admins correctly:
--   Acting as Epic: get_effective_imo_id() = Epic, row.imo_id = Founders →
--   gate fails → row hidden. Even though the agent-view branch would match
--   (user_id = Nick), the AND combination requires both.
--
-- imo_id IS NULL escape: preserves access to truly shared/global rows (rare
-- in this schema but possible).
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
       -- Only tables that actually have an imo_id column
       AND EXISTS (
         SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema = p.schemaname
            AND c.table_name = p.tablename
            AND c.column_name = 'imo_id'
       )
       -- Has auth.uid() in qual (ownership shape) OR with_check
       AND (
         p.qual::text ~ 'auth\.uid\(\)'
         OR p.with_check::text ~ 'auth\.uid\(\)'
       )
       -- Skip policies already scoped (super-admin path or already-gated)
       AND NOT (
         COALESCE(p.qual::text, '') ~ 'get_effective_imo_id\(\)'
         OR COALESCE(p.qual::text, '') ~ 'super_admin_in_scope'
         OR COALESCE(p.with_check::text, '') ~ 'get_effective_imo_id\(\)'
         OR COALESCE(p.with_check::text, '') ~ 'super_admin_in_scope'
       )
     ORDER BY p.tablename, p.policyname
  LOOP
    -- Build the per-policy IMO gate, qualified by the table name so it
    -- resolves correctly inside the policy's row-scoped context.
    gate_clause := format(
      '(get_effective_imo_id() IS NULL OR %I.imo_id IS NULL OR %I.imo_id = get_effective_imo_id())',
      pol.tablename, pol.tablename
    );

    -- Wrap qual and with_check with the gate.
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

    -- Reconstruct the CREATE POLICY statement
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

  RAISE NOTICE 'Ownership-gate rewrite: % policies rewrote, % skipped',
    rewrote_count, skipped_count;
END
$rewrite$;

COMMIT;
