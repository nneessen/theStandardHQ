-- tests/sql/team_pipeline_snapshot.test.sql
--
-- Integration tests for the get_team_pipeline_snapshot + user_can_view_team_tab
-- RPCs. Runs against the local Supabase Postgres via run-sql.sh.
--
-- Test approach: use SAVEPOINTs + RAISE EXCEPTION to assert expectations.
-- Each test runs in a transaction that rolls back, so the database is left
-- untouched. If any assertion fails, the script exits with a non-zero code.
--
-- To run:
--   ./scripts/migrations/run-sql.sh -f tests/sql/team_pipeline_snapshot.test.sql
--
-- The vitest wrapper at tests/sql/team_pipeline_snapshot.test.ts invokes this
-- automatically as part of the suite.

\set ON_ERROR_STOP on
\set QUIET on

BEGIN;

-- ============================================================================
-- Fixture setup
-- ============================================================================
-- Create three users:
--   manager  — has downlines, has close_config (active), is in their own
--              hierarchy_path → none, but is upline of agent_a
--   agent_a  — under manager (manager UUID in hierarchy_path), close_config
--   agent_c  — UNRELATED to manager, has close_config (cross-tenant probe)

-- Create auth.users rows (required for FK on user_profiles)
INSERT INTO auth.users (id, instance_id, email, role, aud, created_at, updated_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'mgr@test.local', 'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'agent-a@test.local', 'authenticated', 'authenticated', now(), now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'agent-c@test.local', 'authenticated', 'authenticated', now(), now())
ON CONFLICT (id) DO NOTHING;

-- NOTE: hierarchy_path is auto-computed from upline_id by triggers
-- (trigger_set_hierarchy_path_on_insert, trigger_update_hierarchy_path_on_upline_change).
-- Setting hierarchy_path directly does NOT stick. We MUST set upline_id and
-- let the triggers populate the path string.
INSERT INTO user_profiles (id, email, first_name, last_name, upline_id, is_super_admin, archived_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mgr@test.local', 'Test', 'Manager', NULL, false, NULL),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'agent-a@test.local', 'Agent', 'A', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false, NULL),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'agent-c@test.local', 'Agent', 'C', NULL, false, NULL)
ON CONFLICT (id) DO UPDATE SET
  upline_id = EXCLUDED.upline_id,
  is_super_admin = EXCLUDED.is_super_admin,
  archived_at = EXCLUDED.archived_at;

-- Defensive: verify the hierarchy_path triggers populated correctly.
-- If is_upline_of() ever changes its semantic, this will surface as a fixture error
-- rather than as a confusing test 1 failure.
DO $$
DECLARE
  v_path TEXT;
BEGIN
  SELECT hierarchy_path INTO v_path FROM user_profiles WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF v_path IS NULL OR v_path NOT LIKE '%aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa%' THEN
    RAISE EXCEPTION 'FIXTURE FAIL: agent_a hierarchy_path should contain manager UUID, got: %', COALESCE(v_path, '<NULL>');
  END IF;
END $$;

INSERT INTO close_config (user_id, api_key_encrypted, organization_id, organization_name, is_active)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test-fixture', 'orga', 'Manager Org', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'test-fixture', 'orga', 'Agent A Org', true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'test-fixture', 'orgc', 'Agent C Org', true)
ON CONFLICT (user_id) DO UPDATE SET is_active = true;

-- Insert known fixture lead_heat_scores rows
-- Agent A: 4 leads, 200 dials, 50 connects (25%), 1 hot, 2 stale, 1 NA streak
INSERT INTO lead_heat_scores (user_id, close_lead_id, score, heat_level, signals)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'lead-a-1', 85, 'hot', '{
    "callsOutbound": 100, "callsAnswered": 30,
    "consecutiveNoAnswers": 0, "straightToVmCount": 0,
    "hoursSinceLastTouch": 2, "hasActiveOpportunity": true,
    "opportunityValueUsd": 5000, "isPositiveStatus": true
  }'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'lead-a-2', 50, 'neutral', '{
    "callsOutbound": 60, "callsAnswered": 15,
    "consecutiveNoAnswers": 4, "straightToVmCount": 2,
    "hoursSinceLastTouch": 100, "hasActiveOpportunity": false,
    "opportunityValueUsd": 0, "isPositiveStatus": false
  }'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'lead-a-3', 30, 'cold', '{
    "callsOutbound": 30, "callsAnswered": 4,
    "consecutiveNoAnswers": 0, "straightToVmCount": 1,
    "hoursSinceLastTouch": 80, "hasActiveOpportunity": false,
    "opportunityValueUsd": 0, "isPositiveStatus": false
  }'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'lead-a-4', 15, 'cold', '{
    "callsOutbound": 10, "callsAnswered": 1,
    "consecutiveNoAnswers": 0, "straightToVmCount": 0,
    "hoursSinceLastTouch": 60, "hasActiveOpportunity": true,
    "opportunityValueUsd": 2500, "isPositiveStatus": true
  }'::jsonb)
ON CONFLICT (user_id, close_lead_id) DO UPDATE SET signals = EXCLUDED.signals;

-- Agent C: 1 lead, isolated cross-tenant fixture
INSERT INTO lead_heat_scores (user_id, close_lead_id, score, heat_level, signals)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'lead-c-1', 90, 'hot', '{
    "callsOutbound": 50, "callsAnswered": 20,
    "consecutiveNoAnswers": 0, "straightToVmCount": 0,
    "hoursSinceLastTouch": 1, "hasActiveOpportunity": true,
    "opportunityValueUsd": 99999, "isPositiveStatus": true
  }'::jsonb)
ON CONFLICT (user_id, close_lead_id) DO UPDATE SET signals = EXCLUDED.signals;

-- ============================================================================
-- Test 1: Manager sees self + agent_a, but NOT agent_c
-- ============================================================================
SAVEPOINT t1;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

DO $$
DECLARE
  v_total_rows INTEGER;
  v_agent_a_seen BOOLEAN;
  v_agent_c_seen BOOLEAN;
  v_self_seen BOOLEAN;
BEGIN
  SELECT count(*) INTO v_total_rows FROM get_team_pipeline_snapshot();
  SELECT EXISTS (SELECT 1 FROM get_team_pipeline_snapshot() WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') INTO v_agent_a_seen;
  SELECT EXISTS (SELECT 1 FROM get_team_pipeline_snapshot() WHERE user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') INTO v_agent_c_seen;
  SELECT EXISTS (SELECT 1 FROM get_team_pipeline_snapshot() WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND is_self = true) INTO v_self_seen;

  IF NOT v_self_seen THEN
    RAISE EXCEPTION 'TEST 1 FAIL: manager should see self with is_self=true';
  END IF;
  IF NOT v_agent_a_seen THEN
    RAISE EXCEPTION 'TEST 1 FAIL: manager should see downline agent_a';
  END IF;
  IF v_agent_c_seen THEN
    RAISE EXCEPTION 'TEST 1 FAIL: manager should NOT see unrelated agent_c (cross-tenant leak)';
  END IF;
END $$;

RESET ROLE;
RELEASE SAVEPOINT t1;

-- ============================================================================
-- Test 2: Aggregation correctness for agent_a
-- Expected: 4 leads, 200 dials, 50 connects, 25.00% rate, 1 hot, 2 stale, 1 NA streak
-- ============================================================================
SAVEPOINT t2;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

DO $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT * INTO v_row FROM get_team_pipeline_snapshot()
   WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  IF v_row.total_leads <> 4 THEN
    RAISE EXCEPTION 'TEST 2 FAIL: expected 4 leads for agent_a, got %', v_row.total_leads;
  END IF;
  IF v_row.total_dials <> 200 THEN
    RAISE EXCEPTION 'TEST 2 FAIL: expected 200 dials for agent_a, got %', v_row.total_dials;
  END IF;
  IF v_row.total_connects <> 50 THEN
    RAISE EXCEPTION 'TEST 2 FAIL: expected 50 connects for agent_a, got %', v_row.total_connects;
  END IF;
  -- 50 / 200 = 0.2500
  IF v_row.connect_rate <> 0.2500 THEN
    RAISE EXCEPTION 'TEST 2 FAIL: expected connect_rate=0.2500 for agent_a, got %', v_row.connect_rate;
  END IF;
  IF v_row.hot_count <> 1 THEN
    RAISE EXCEPTION 'TEST 2 FAIL: expected 1 hot for agent_a, got %', v_row.hot_count;
  END IF;
  -- 2 leads have hours_since_last_touch > 72 (lead-a-2: 100h, lead-a-3: 80h)
  IF v_row.stale_leads_count <> 2 THEN
    RAISE EXCEPTION 'TEST 2 FAIL: expected 2 stale leads for agent_a, got %', v_row.stale_leads_count;
  END IF;
  -- 1 lead has consecutive_no_answers >= 3 (lead-a-2: 4)
  IF v_row.no_answer_streak <> 1 THEN
    RAISE EXCEPTION 'TEST 2 FAIL: expected 1 no_answer_streak for agent_a, got %', v_row.no_answer_streak;
  END IF;
  -- 2 leads have hasActiveOpportunity = true (lead-a-1, lead-a-4)
  IF v_row.active_opps_count <> 2 THEN
    RAISE EXCEPTION 'TEST 2 FAIL: expected 2 active opps for agent_a, got %', v_row.active_opps_count;
  END IF;
  -- 5000 + 2500 = 7500
  IF v_row.open_opp_value_usd <> 7500 THEN
    RAISE EXCEPTION 'TEST 2 FAIL: expected open_opp_value_usd=7500 for agent_a, got %', v_row.open_opp_value_usd;
  END IF;
  -- straight_to_vm: 0 + 2 + 1 + 0 = 3
  IF v_row.straight_to_vm <> 3 THEN
    RAISE EXCEPTION 'TEST 2 FAIL: expected straight_to_vm=3 for agent_a, got %', v_row.straight_to_vm;
  END IF;
END $$;

RESET ROLE;
RELEASE SAVEPOINT t2;

-- ============================================================================
-- Test 3: Cross-tenant probe — agent_c should NOT see manager's data
-- ============================================================================
SAVEPOINT t3;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';

DO $$
DECLARE
  v_total_rows INTEGER;
  v_can_view BOOLEAN;
BEGIN
  -- agent_c has no downlines and no super_admin → cannot view team tab
  SELECT user_can_view_team_tab() INTO v_can_view;
  IF v_can_view THEN
    RAISE EXCEPTION 'TEST 3 FAIL: agent_c should NOT be able to view team tab (no downlines)';
  END IF;

  -- agent_c calling the snapshot RPC: should see only themselves (they have close_config)
  SELECT count(*) INTO v_total_rows FROM get_team_pipeline_snapshot();
  IF v_total_rows <> 1 THEN
    RAISE EXCEPTION 'TEST 3 FAIL: agent_c should see exactly 1 row (self), got %', v_total_rows;
  END IF;

  -- And calling with a target list pointing to manager's data should return 0
  SELECT count(*) INTO v_total_rows
    FROM get_team_pipeline_snapshot(ARRAY['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']::uuid[]);
  IF v_total_rows <> 0 THEN
    RAISE EXCEPTION 'TEST 3 FAIL: agent_c targeting manager UUID should return 0 rows (cross-tenant blocked), got %', v_total_rows;
  END IF;

  -- And targeting agent_a (who is also unrelated to agent_c) should return 0
  SELECT count(*) INTO v_total_rows
    FROM get_team_pipeline_snapshot(ARRAY['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']::uuid[]);
  IF v_total_rows <> 0 THEN
    RAISE EXCEPTION 'TEST 3 FAIL: agent_c targeting agent_a UUID should return 0 rows, got %', v_total_rows;
  END IF;
END $$;

RESET ROLE;
RELEASE SAVEPOINT t3;

-- ============================================================================
-- Test 4: Visibility check — manager (with downline) CAN view, no upline cannot
-- ============================================================================
SAVEPOINT t4;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

DO $$
DECLARE
  v_can_view BOOLEAN;
BEGIN
  SELECT user_can_view_team_tab() INTO v_can_view;
  IF NOT v_can_view THEN
    RAISE EXCEPTION 'TEST 4 FAIL: manager (has downline) should be able to view team tab';
  END IF;
END $$;

RESET ROLE;
RELEASE SAVEPOINT t4;

-- ============================================================================
-- Test 5: Anonymous call → not authenticated exception
-- ============================================================================
SAVEPOINT t5;
SET LOCAL ROLE authenticated;
-- No JWT claims set
SET LOCAL request.jwt.claims = '{}';

DO $$
BEGIN
  BEGIN
    PERFORM get_team_pipeline_snapshot();
    RAISE EXCEPTION 'TEST 5 FAIL: expected "not authenticated" exception with empty JWT';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'not authenticated' THEN
        RAISE EXCEPTION 'TEST 5 FAIL: expected "not authenticated", got %', SQLERRM;
      END IF;
  END;
END $$;

RESET ROLE;
RELEASE SAVEPOINT t5;

-- ============================================================================
-- Test 6: Archived manager should not appear in their own team query
-- (Verify the archived_at filter works for the caller themselves)
-- ============================================================================
SAVEPOINT t6;
UPDATE user_profiles SET archived_at = now() WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

DO $$
DECLARE
  v_self_seen BOOLEAN;
  v_agent_a_seen BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM get_team_pipeline_snapshot() WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') INTO v_self_seen;
  SELECT EXISTS (SELECT 1 FROM get_team_pipeline_snapshot() WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') INTO v_agent_a_seen;

  IF v_self_seen THEN
    RAISE EXCEPTION 'TEST 6 FAIL: archived manager should not appear in own team result';
  END IF;
  -- Agent A should still be visible because manager's UUID is in agent_a's hierarchy_path,
  -- and is_upline_of-style check uses hierarchy_path, not the caller's archived state.
  IF NOT v_agent_a_seen THEN
    RAISE EXCEPTION 'TEST 6 FAIL: agent_a should still appear (caller archived but downline not)';
  END IF;
END $$;

RESET ROLE;
RELEASE SAVEPOINT t6;

-- ============================================================================
-- Done — rollback all fixture data
-- ============================================================================
ROLLBACK;

\echo
\echo '✅ All team_pipeline_snapshot integration tests passed.'
