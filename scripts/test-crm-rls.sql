-- Inbound-CRM Phase 0 RLS test (rolled-back). The RPC smoke test runs as superuser,
-- which BYPASSES RLS — so the policies on the three new tables are otherwise never
-- exercised. Since Supabase grants `authenticated` table-level DML by default, RLS is
-- the ONLY protection here. This test sets request.jwt.claims + SET ROLE authenticated
-- to assert (Plan §11): an agent sees only their own inbound_calls, a different agent
-- sees none of them, and a non-super-admin sees zero credential/mapping rows + cannot
-- write inbound_calls. Everything is discarded by ROLLBACK.
--
--   ./scripts/migrations/run-sql.sh -f scripts/test-crm-rls.sql
\set ON_ERROR_STOP on
BEGIN;

-- Two real agents in the same imo (so RLS, not a missing row, is what differs).
SELECT a.id AS agent_a, b.id AS agent_b, a.imo_id AS imo_a
FROM user_profiles a
JOIN user_profiles b ON b.imo_id = a.imo_id AND b.id <> a.id
WHERE a.imo_id IS NOT NULL
LIMIT 1 \gset

-- Seed fixtures as superuser (RLS bypassed here on purpose).
INSERT INTO inbound_calls (imo_id, request_tag, agent_id, ani, status)
  VALUES (:'imo_a', 'rls-A', :'agent_a', '+15550000001', 'ringing');
INSERT INTO imo_call_platform_credentials (imo_id, client_id, client_secret_hash)
  VALUES (:'imo_a', 'rls-cred', 'hash');
INSERT INTO imo_agent_external_ids (imo_id, user_id, pc_id)
  VALUES (:'imo_a', :'agent_a', 'rls-pc');

-- ── Identity: agent A ─────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims', json_build_object('sub', :'agent_a', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $a$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM inbound_calls WHERE request_tag = 'rls-A';
  IF v <> 1 THEN RAISE EXCEPTION 'RLS FAIL: agent A cannot see own inbound_call (saw %)', v; END IF;

  SELECT count(*) INTO v FROM imo_call_platform_credentials;
  IF v <> 0 THEN RAISE EXCEPTION 'RLS FAIL: non-super-admin sees % credential rows (expected 0)', v; END IF;

  SELECT count(*) INTO v FROM imo_agent_external_ids;
  IF v <> 0 THEN RAISE EXCEPTION 'RLS FAIL: non-super-admin sees % mapping rows (expected 0)', v; END IF;
  RAISE NOTICE 'RLS OK  agent A: sees own call; 0 credentials; 0 mappings';

  -- Writes must be denied (no INSERT policy on inbound_calls for authenticated).
  BEGIN
    INSERT INTO inbound_calls (imo_id, request_tag, agent_id, ani, status)
      VALUES ('00000000-0000-0000-0000-000000000000', 'rls-evil', NULL, 'x', 'ringing');
    RAISE EXCEPTION 'RLS FAIL: authenticated was able to INSERT into inbound_calls';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'RLS OK  agent A INSERT into inbound_calls denied';
  END;
END $a$;
RESET ROLE;

-- ── Identity: agent B (same imo, different user) ──────────────────────────────
SELECT set_config('request.jwt.claims', json_build_object('sub', :'agent_b', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $b$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM inbound_calls WHERE request_tag = 'rls-A';
  IF v <> 0 THEN RAISE EXCEPTION 'RLS FAIL: agent B can see agent A inbound_call (saw %)', v; END IF;
  RAISE NOTICE 'RLS OK  agent B: cannot see agent A''s call';
END $b$;
RESET ROLE;

DO $done$ BEGIN RAISE NOTICE 'ALL_RLS_CHECKS_PASSED'; END $done$;
ROLLBACK;
