-- ============================================================================
-- surelc_links RLS behavioral probe
-- ============================================================================
-- Verifies the dual-ownership model (owner_user_id IS NULL = shared/super-admin,
-- = auth.uid() = personal) actually isolates tenants and owners. Inserts ephemeral
-- fixtures, impersonates real users via JWT claims, asserts, then ROLLS BACK
-- (nothing persists).
--
-- Run against PROD (has the multi-IMO data this needs):
--   DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-sql.sh -f scripts/check-surelc-isolation.sql
--
-- EXPECTED: every "pass" column = t, and the two DO-block checks print PASS.
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

-- ---- pick real fixtures -----------------------------------------------------
-- imoX = an IMO with >=2 active, non-revoked, non-super-admin agents
SELECT imo_id AS imox
FROM user_profiles
WHERE imo_id IS NOT NULL
  AND COALESCE(is_super_admin, false) = false
  AND public.is_access_revoked(id) = false
GROUP BY imo_id
HAVING count(*) >= 2
ORDER BY imo_id
LIMIT 1 \gset

SELECT id AS agent_a
FROM user_profiles
WHERE imo_id = :'imox' AND COALESCE(is_super_admin, false) = false
  AND public.is_access_revoked(id) = false
ORDER BY id LIMIT 1 \gset

SELECT id AS agent_b
FROM user_profiles
WHERE imo_id = :'imox' AND COALESCE(is_super_admin, false) = false
  AND public.is_access_revoked(id) = false AND id <> :'agent_a'
ORDER BY id LIMIT 1 \gset

-- imoY = any OTHER IMO (used only to host a cross-tenant shared link)
SELECT id AS imoy
FROM imos
WHERE id <> :'imox'
ORDER BY id LIMIT 1 \gset

-- a super-admin
SELECT id AS super_a
FROM user_profiles
WHERE is_super_admin = true
ORDER BY id LIMIT 1 \gset

\echo 'Fixtures => imoX=':imox'  imoY=':imoy'  agentA=':agent_a'  agentB=':agent_b'  super=':super_a

-- stash ids in custom GUCs so the impersonated DO blocks can read them
SELECT set_config('probe.imox', :'imox', true);
SELECT set_config('probe.agent_a', :'agent_a', true);

-- ---- seed fixtures as the privileged migration role (bypasses RLS) ----------
INSERT INTO surelc_links (imo_id, owner_user_id, label, url, created_by)
VALUES (:'imox', NULL, 'PROBE shared', 'https://surelc.example/shared', :'super_a')
RETURNING id AS shared_link_id \gset

INSERT INTO surelc_links (imo_id, owner_user_id, label, url, created_by)
VALUES (:'imox', :'agent_a', 'PROBE personal A', 'https://surelc.example/a', :'agent_a')
RETURNING id AS pa_id \gset

INSERT INTO surelc_links (imo_id, owner_user_id, label, url, created_by)
VALUES (:'imox', :'agent_b', 'PROBE personal B', 'https://surelc.example/b', :'agent_b')
RETURNING id AS pb_id \gset

-- a SHARED link in a DIFFERENT IMO (agentA must never see it)
INSERT INTO surelc_links (imo_id, owner_user_id, label, url, created_by)
VALUES (:'imoy', NULL, 'PROBE shared other-IMO', 'https://surelc.example/other', :'super_a')
RETURNING id AS shared_other_id \gset

-- ============================================================================
-- Persona: agentA (regular agent in imoX)
-- ============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'agent_a', 'role', 'authenticated')::text, true);

SELECT 'A sees shared link in own IMO'      AS check, (count(*) = 1) AS pass FROM surelc_links WHERE id = :'shared_link_id';
SELECT 'A sees own personal link'           AS check, (count(*) = 1) AS pass FROM surelc_links WHERE id = :'pa_id';
SELECT 'A CANNOT see agent B personal link' AS check, (count(*) = 0) AS pass FROM surelc_links WHERE id = :'pb_id';
SELECT 'A CANNOT see other-IMO shared link' AS check, (count(*) = 0) AS pass FROM surelc_links WHERE id = :'shared_other_id';

-- agentA must NOT be able to insert a SHARED (owner_user_id IS NULL) row
DO $$
BEGIN
  INSERT INTO surelc_links (imo_id, owner_user_id, label, url)
  VALUES (current_setting('probe.imox')::uuid, NULL, 'PROBE hack shared', 'https://x');
  RAISE WARNING 'FAIL: regular agent inserted a SHARED row (RLS hole!)';
EXCEPTION
  WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'PASS: regular agent blocked from inserting shared row';
END $$;

-- agentA MUST be able to insert their own personal row
DO $$
BEGIN
  INSERT INTO surelc_links (imo_id, owner_user_id, label, url)
  VALUES (current_setting('probe.imox')::uuid, current_setting('probe.agent_a')::uuid, 'PROBE my link', 'https://x');
  RAISE NOTICE 'PASS: regular agent inserted own personal link';
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'FAIL: regular agent blocked from own personal insert: %', SQLERRM;
END $$;

RESET ROLE;

-- ============================================================================
-- Persona: super-admin — sees everything (support visibility)
-- ============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'super_a', 'role', 'authenticated')::text, true);

SELECT 'super sees shared link'    AS check, (count(*) = 1) AS pass FROM surelc_links WHERE id = :'shared_link_id';
SELECT 'super sees A personal link' AS check, (count(*) = 1) AS pass FROM surelc_links WHERE id = :'pa_id';

RESET ROLE;

ROLLBACK;
