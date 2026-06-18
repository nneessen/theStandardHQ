-- Inbound-CRM Phase 1 credential RPC smoke test (rolled-back). Admin RPCs are
-- super-admin-gated (super_admin_in_scope reads auth.uid()), so we simulate a
-- super-admin via request.jwt.claims + SET ROLE authenticated; crm_authenticate_credential
-- runs in the service-role/superuser context. Assertions use 1/(CASE WHEN cond THEN 1 ELSE 0)
-- so a false condition raises division_by_zero and (with ON_ERROR_STOP) aborts + rolls back.
--
--   ./scripts/migrations/run-sql.sh -f scripts/test-crm-credentials-smoke.sql
\set ON_ERROR_STOP on
BEGIN;

-- Fixture: a super-admin + their imo + a (non-admin) agent in the same imo.
SELECT sa.id AS admin_id, sa.imo_id AS imo_id,
       (SELECT a.id FROM user_profiles a WHERE a.imo_id = sa.imo_id AND a.id <> sa.id LIMIT 1) AS agent_id
FROM user_profiles sa
WHERE sa.is_super_admin = true AND sa.imo_id IS NOT NULL
LIMIT 1 \gset

-- Become the super-admin and issue a credential (capture the one-time plaintext secret).
SELECT set_config('request.jwt.claims', json_build_object('sub', :'admin_id', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT credential_id AS cred_id, client_id AS cred_client, client_secret AS cred_secret
FROM crm_issue_credential(:'imo_id'::uuid, 'smoke', ARRAY['crm:leads']) \gset
RESET ROLE;

-- The issued secret must be base64URL (no '+' '/' '=') so it survives form-urlencoded transport
-- (URLSearchParams decodes a literal '+' to a space).
SELECT 'secret is base64url'   AS chk, 1/(CASE WHEN :'cred_secret' ~ '^[A-Za-z0-9_-]+$' THEN 1 ELSE 0 END) ok;

-- Authenticate (service-role context): correct secret -> 1 row; wrong -> 0; identity correct.
SELECT 'auth correct secret'  AS chk, 1/(CASE WHEN (SELECT count(*) FROM crm_authenticate_credential(:'cred_client', :'cred_secret'))=1 THEN 1 ELSE 0 END) ok;
SELECT 'auth wrong secret'    AS chk, 1/(CASE WHEN (SELECT count(*) FROM crm_authenticate_credential(:'cred_client', 'definitely-wrong'))=0 THEN 1 ELSE 0 END) ok;
SELECT 'auth resolves imo'    AS chk, 1/(CASE WHEN (SELECT imo_id FROM crm_authenticate_credential(:'cred_client', :'cred_secret')) = :'imo_id'::uuid THEN 1 ELSE 0 END) ok;
SELECT 'auth unknown client'  AS chk, 1/(CASE WHEN (SELECT count(*) FROM crm_authenticate_credential('crm_nope', :'cred_secret'))=0 THEN 1 ELSE 0 END) ok;

-- Rotate (super-admin): old secret stops working, new one works.
SET LOCAL ROLE authenticated;
SELECT client_secret AS cred_secret2 FROM crm_rotate_credential(:'cred_id'::uuid) \gset
RESET ROLE;
SELECT 'rotate: old denied'   AS chk, 1/(CASE WHEN (SELECT count(*) FROM crm_authenticate_credential(:'cred_client', :'cred_secret'))=0 THEN 1 ELSE 0 END) ok;
SELECT 'rotate: new works'    AS chk, 1/(CASE WHEN (SELECT count(*) FROM crm_authenticate_credential(:'cred_client', :'cred_secret2'))=1 THEN 1 ELSE 0 END) ok;

-- Revoke (super-admin): credential stops authenticating.
SET LOCAL ROLE authenticated;
SELECT 'revoke returns true'  AS chk, 1/(CASE WHEN crm_revoke_credential(:'cred_id'::uuid) THEN 1 ELSE 0 END) ok;
RESET ROLE;
SELECT 'revoked denies auth'  AS chk, 1/(CASE WHEN (SELECT count(*) FROM crm_authenticate_credential(:'cred_client', :'cred_secret2'))=0 THEN 1 ELSE 0 END) ok;

-- A revoked credential must NOT be rotatable (no silent un-revoke) — re-issue instead.
SET LOCAL ROLE authenticated;
DO $rot$
DECLARE v_cred uuid;
BEGIN
  SELECT id INTO v_cred FROM imo_call_platform_credentials WHERE label = 'smoke' ORDER BY created_at DESC LIMIT 1;
  BEGIN
    PERFORM crm_rotate_credential(v_cred);
    RAISE EXCEPTION 'NEG FAIL: rotating a revoked credential was allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK  rotating a revoked credential refused (42501)';
  END;
END $rot$;
RESET ROLE;

-- Register a PLATFORM-issued pcId for an agent (super-admin), then verify the mapping.
SET LOCAL ROLE authenticated;
SELECT 'register pcid'        AS chk, 1/(CASE WHEN crm_register_agent_pcid(:'imo_id'::uuid, :'agent_id'::uuid, 'platform-pc-001') THEN 1 ELSE 0 END) ok;
RESET ROLE;
SELECT 'pcid mapping exists'  AS chk, 1/(CASE WHEN (SELECT count(*) FROM imo_agent_external_ids WHERE imo_id=:'imo_id'::uuid AND user_id=:'agent_id'::uuid AND pc_id='platform-pc-001')=1 THEN 1 ELSE 0 END) ok;

-- Re-point the SAME pcId to a DIFFERENT agent (the platform recycles pcIds) — must be a clean
-- reassignment, not a 23505. After: the new agent holds it and the original agent no longer does.
SET LOCAL ROLE authenticated;
SELECT 're-point pcid'        AS chk, 1/(CASE WHEN crm_register_agent_pcid(:'imo_id'::uuid, :'admin_id'::uuid, 'platform-pc-001') THEN 1 ELSE 0 END) ok;
RESET ROLE;
SELECT 're-point moved owner' AS chk, 1/(CASE WHEN
       (SELECT count(*) FROM imo_agent_external_ids WHERE imo_id=:'imo_id'::uuid AND pc_id='platform-pc-001' AND user_id=:'admin_id'::uuid)=1
   AND (SELECT count(*) FROM imo_agent_external_ids WHERE imo_id=:'imo_id'::uuid AND pc_id='platform-pc-001' AND user_id=:'agent_id'::uuid)=0
       THEN 1 ELSE 0 END) ok;

-- Negative: a NON-super-admin must be denied (42501). DO block reads auth.uid() (no psql vars).
SELECT set_config('request.jwt.claims', json_build_object('sub', :'agent_id', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $neg$
BEGIN
  BEGIN
    PERFORM crm_issue_credential((SELECT imo_id FROM user_profiles WHERE id = auth.uid()), 'evil', ARRAY['crm:leads']);
    RAISE EXCEPTION 'NEG FAIL: non-super-admin was allowed to issue a credential';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK  non-super-admin issue denied (42501)';
  END;
END $neg$;
RESET ROLE;

DO $done$ BEGIN RAISE NOTICE 'ALL_CREDENTIAL_CHECKS_PASSED'; END $done$;
ROLLBACK;
