-- tests/sql/get_team_member_ids.test.sql
--
-- Integration tests for the get_team_member_ids() RPC. Same SAVEPOINT +
-- RAISE EXCEPTION pattern as team_pipeline_snapshot.test.sql. Runs against
-- the local Supabase Postgres via run-sql.sh.
--
-- To run:
--   ./scripts/migrations/run-sql.sh -f tests/sql/get_team_member_ids.test.sql
--
-- The vitest wrapper at tests/sql/get_team_member_ids.test.ts invokes this
-- automatically as part of the suite.

\set ON_ERROR_STOP on
\set QUIET on

BEGIN;

-- ============================================================================
-- Fixture setup
-- ============================================================================
-- Three users:
--   manager  — has downlines, has close_config (active)
--   agent_a  — under manager (manager UUID in hierarchy_path), close_config
--   agent_c  — UNRELATED to manager, has close_config (cross-tenant probe)
--
-- Note: hierarchy_path is auto-computed from upline_id by triggers
-- (trigger_set_hierarchy_path_on_insert). Setting hierarchy_path directly
-- does NOT stick. We MUST set upline_id and let the triggers populate it.

INSERT INTO auth.users (id, instance_id, email, role, aud, created_at, updated_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'mgr2@test.local', 'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'agent-a2@test.local', 'authenticated', 'authenticated', now(), now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'agent-c2@test.local', 'authenticated', 'authenticated', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_profiles (id, email, first_name, last_name, upline_id, is_super_admin, archived_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mgr2@test.local', 'Test', 'Manager', NULL, false, NULL),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'agent-a2@test.local', 'Agent', 'A', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false, NULL),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'agent-c2@test.local', 'Agent', 'C', NULL, false, NULL)
ON CONFLICT (id) DO UPDATE SET
  upline_id = EXCLUDED.upline_id,
  is_super_admin = EXCLUDED.is_super_admin,
  archived_at = EXCLUDED.archived_at;

INSERT INTO close_config (user_id, api_key_encrypted, organization_id, organization_name, is_active)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test-fixture', 'orga', 'Manager Org', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'test-fixture', 'orga', 'Agent A Org', true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'test-fixture', 'orgc', 'Agent C Org', true)
ON CONFLICT (user_id) DO UPDATE SET is_active = true;

-- Defensive: verify the hierarchy_path triggers populated correctly.
DO $$
DECLARE
  v_path TEXT;
BEGIN
  SELECT hierarchy_path INTO v_path FROM user_profiles WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF v_path IS NULL OR v_path NOT LIKE '%aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa%' THEN
    RAISE EXCEPTION 'FIXTURE FAIL: agent_a hierarchy_path should contain manager UUID, got: %', COALESCE(v_path, '<NULL>');
  END IF;
END $$;

-- ============================================================================
-- Test 1: Manager (has downline) sees self + agent_a, but NOT agent_c
-- ============================================================================
SAVEPOINT t1;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

DO $$
DECLARE
  v_ids UUID[];
  v_count INT;
BEGIN
  v_ids := get_team_member_ids();
  v_count := array_length(v_ids, 1);

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'TEST 1 FAIL: manager should see exactly 2 ids (self + agent_a), got % (ids=%)', v_count, v_ids;
  END IF;
  IF NOT ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid = ANY (v_ids)) THEN
    RAISE EXCEPTION 'TEST 1 FAIL: manager should see self in result';
  END IF;
  IF NOT ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid = ANY (v_ids)) THEN
    RAISE EXCEPTION 'TEST 1 FAIL: manager should see downline agent_a';
  END IF;
  IF 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid = ANY (v_ids) THEN
    RAISE EXCEPTION 'TEST 1 FAIL: manager should NOT see unrelated agent_c (cross-tenant leak)';
  END IF;
END $$;

RESET ROLE;
RELEASE SAVEPOINT t1;

-- ============================================================================
-- Test 2: Unrelated user (agent_c) sees ONLY self, never manager or agent_a
-- ============================================================================
SAVEPOINT t2;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';

DO $$
DECLARE
  v_ids UUID[];
  v_count INT;
BEGIN
  v_ids := get_team_member_ids();
  v_count := array_length(v_ids, 1);

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 2 FAIL: agent_c should see exactly 1 id (self), got % (ids=%)', v_count, v_ids;
  END IF;
  IF NOT ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid = ANY (v_ids)) THEN
    RAISE EXCEPTION 'TEST 2 FAIL: agent_c should see self';
  END IF;
  IF 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid = ANY (v_ids) THEN
    RAISE EXCEPTION 'TEST 2 FAIL: agent_c should NOT see manager (cross-tenant)';
  END IF;
  IF 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid = ANY (v_ids) THEN
    RAISE EXCEPTION 'TEST 2 FAIL: agent_c should NOT see agent_a (cross-tenant)';
  END IF;
END $$;

RESET ROLE;
RELEASE SAVEPOINT t2;

-- ============================================================================
-- Test 3: Anonymous call → not authenticated exception
-- ============================================================================
SAVEPOINT t3;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{}';

DO $$
BEGIN
  BEGIN
    PERFORM get_team_member_ids();
    RAISE EXCEPTION 'TEST 3 FAIL: expected "not authenticated" exception with empty JWT';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'not authenticated' THEN
        RAISE EXCEPTION 'TEST 3 FAIL: expected "not authenticated", got %', SQLERRM;
      END IF;
  END;
END $$;

RESET ROLE;
RELEASE SAVEPOINT t3;

-- ============================================================================
-- Test 4: Caller without close_config sees only their downlines, not self
-- (Covers the case where a manager hasn't connected Close themselves)
-- ============================================================================
SAVEPOINT t4;
UPDATE close_config SET is_active = false WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

DO $$
DECLARE
  v_ids UUID[];
BEGIN
  v_ids := get_team_member_ids();
  -- Manager's own close_config is now inactive, so self drops out.
  -- Agent A is still connected, so should still appear.
  IF 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid = ANY (v_ids) THEN
    RAISE EXCEPTION 'TEST 4 FAIL: manager with inactive close_config should not see self in result';
  END IF;
  IF NOT ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid = ANY (v_ids)) THEN
    RAISE EXCEPTION 'TEST 4 FAIL: agent_a should still appear (downline still connected)';
  END IF;
END $$;

RESET ROLE;
RELEASE SAVEPOINT t4;

-- ============================================================================
-- Test 5: Archived downline is filtered out
-- ============================================================================
SAVEPOINT t5;
UPDATE user_profiles SET archived_at = now() WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

DO $$
DECLARE
  v_ids UUID[];
BEGIN
  v_ids := get_team_member_ids();
  IF 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid = ANY (v_ids) THEN
    RAISE EXCEPTION 'TEST 5 FAIL: archived agent_a should not appear in result';
  END IF;
END $$;

RESET ROLE;
RELEASE SAVEPOINT t5;

-- ============================================================================
-- Test 6: Empty array (not NULL) when caller has no team and no close_config
-- ============================================================================
SAVEPOINT t6;
DELETE FROM close_config WHERE user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';

DO $$
DECLARE
  v_ids UUID[];
BEGIN
  v_ids := get_team_member_ids();
  IF v_ids IS NULL THEN
    RAISE EXCEPTION 'TEST 6 FAIL: get_team_member_ids should return empty array, not NULL';
  END IF;
  IF array_length(v_ids, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 6 FAIL: expected empty array, got % elements', array_length(v_ids, 1);
  END IF;
END $$;

RESET ROLE;
RELEASE SAVEPOINT t6;

-- ============================================================================
-- Done — rollback all fixture data
-- ============================================================================
ROLLBACK;

\echo
\echo '✅ All get_team_member_ids integration tests passed.'
