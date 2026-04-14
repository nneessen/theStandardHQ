-- Lead Drop: harden RLS on lead_drop_jobs / lead_drop_results
--
-- The original migration (20260414171927_lead_drop_tables.sql) created two
-- overly permissive policies labeled "service" but with no role restriction:
--   - lead_drop_jobs   FOR UPDATE USING (true)
--   - lead_drop_results FOR INSERT WITH CHECK (true)
--
-- Under Postgres RLS, these policies apply to every role that the policy
-- target resolves to (default is PUBLIC via authenticated). Service role
-- already BYPASSes RLS — it doesn't need a policy at all. The net effect
-- was that any authenticated user could:
--   - UPDATE any lead_drop_jobs row (status, counters, recipient_smart_view_id)
--   - INSERT arbitrary lead_drop_results rows attributing them to any job
--
-- Fix: drop the permissive policies. Service role continues to bypass RLS.
-- Authenticated role is left without a mutation policy, which is the correct
-- default-deny posture for append-only state populated by an edge function.

BEGIN;

-- Remove the overly permissive policies.
DROP POLICY IF EXISTS "lead_drop_jobs_update_service"     ON lead_drop_jobs;
DROP POLICY IF EXISTS "lead_drop_results_insert_service"  ON lead_drop_results;

-- Defense-in-depth: explicit deny-all on authenticated role for mutation
-- operations. Service role still bypasses RLS so the edge function is
-- unaffected. These policies make the intent loud in pg_policies output.
CREATE POLICY "lead_drop_jobs_no_update_authenticated" ON lead_drop_jobs
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "lead_drop_jobs_no_delete_authenticated" ON lead_drop_jobs
  FOR DELETE TO authenticated
  USING (false);

CREATE POLICY "lead_drop_results_no_insert_authenticated" ON lead_drop_results
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "lead_drop_results_no_update_authenticated" ON lead_drop_results
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "lead_drop_results_no_delete_authenticated" ON lead_drop_results
  FOR DELETE TO authenticated
  USING (false);

COMMENT ON TABLE lead_drop_jobs IS
  'Bulk lead transfer jobs. INSERT by sender via edge function; UPDATE/DELETE restricted to service_role (edge function) only.';
COMMENT ON TABLE lead_drop_results IS
  'Per-lead results for a drop job. INSERT/UPDATE/DELETE restricted to service_role only. SELECT restricted to job sender or recipient.';

COMMIT;
