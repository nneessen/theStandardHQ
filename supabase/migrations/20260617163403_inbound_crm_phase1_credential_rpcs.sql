-- Inbound-Call CRM Integration — Phase 1 (credential + pcId admin RPCs)
-- Plan: ~/.claude/plans/we-already-have-a-serialized-lark.md §4
--
-- OAuth2 client-credentials: the dialer platform exchanges a client_id + client_secret
-- (issued here) for a 24h bearer at the crm-oauth-token edge function. Secrets are stored
-- ONE-WAY HASHED via pgcrypto bcrypt (self-salting; never reversible) and the plaintext is
-- shown exactly once at issuance. bcrypt's deliberate slowness lands only on the ~once/24h
-- token mint; the frequent bearer checks use fast HMAC (crm-token-decoder.ts), not these RPCs.
--
-- pcIds are issued by the PLATFORM (they also do call round-robin); we just register their
-- value against our agent via crm_register_agent_pcid.
--
-- SECURITY: every RPC needs explicit `REVOKE FROM anon` because Supabase's ALTER DEFAULT
-- PRIVILEGES grants EXECUTE directly to anon/authenticated (REVOKE FROM PUBLIC is insufficient
-- — see the Phase 0 rpcs migration). Admin RPCs stay granted to authenticated but are
-- super-admin-gated INTERNALLY; crm_authenticate_credential is service_role-ONLY.
-- pgcrypto lives in the `extensions` schema, so its functions are schema-qualified.

BEGIN;

-- pgcrypto (bcrypt + random bytes) lives in the `extensions` schema on Supabase. Make the
-- dependency explicit and self-contained; a no-op where it is already installed.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- NOTE: token `scopes` are carried/echoed but NOT yet enforced anywhere (issuance accepts any
-- array, the verifier only checks it is an array, and the lead RPCs take no scope argument).
-- Only the single 'crm:leads' scope exists today and only a super-admin can issue. Before relying
-- on a restricted scope, add enforcement at issuance + in verifyCrmToken + at the lead RPCs.

-- ============================================================================
-- crm_issue_credential — super-admin issues a credential. Generates client_id +
-- client_secret SERVER-SIDE; stores only the bcrypt hash; returns the plaintext ONCE.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.crm_issue_credential(
  p_imo_id uuid,
  p_label  text   DEFAULT NULL,
  p_scopes text[] DEFAULT ARRAY['crm:leads']::text[]
)
RETURNS TABLE (credential_id uuid, client_id text, client_secret text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id text;
  v_secret    text;
  v_id        uuid;
BEGIN
  IF NOT public.super_admin_in_scope(p_imo_id) THEN
    RAISE EXCEPTION 'not authorized to issue credentials for this IMO' USING ERRCODE = '42501';
  END IF;

  -- client_id: stable non-secret identifier. client_secret: 32 random bytes (<72 for bcrypt),
  -- encoded base64URL (no '+' or '/') so it survives form-urlencoded transport intact —
  -- URLSearchParams decodes a literal '+' to a space, which would silently break form-body auth.
  v_client_id := 'crm_' || encode(extensions.gen_random_bytes(12), 'hex');
  v_secret    := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  INSERT INTO public.imo_call_platform_credentials (imo_id, client_id, client_secret_hash, label, scopes)
  VALUES (p_imo_id, v_client_id, extensions.crypt(v_secret, extensions.gen_salt('bf', 12)), p_label, p_scopes)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_client_id, v_secret;
END;
$$;

-- ============================================================================
-- crm_authenticate_credential — service-role ONLY. Verifies client_id + secret
-- (bcrypt) for an active, non-revoked credential; bumps last_used_at; returns the
-- resolved identity or NO ROWS. NEVER log/RAISE p_secret.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.crm_authenticate_credential(
  p_client_id text,
  p_secret    text
)
RETURNS TABLE (credential_id uuid, imo_id uuid, scopes text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id     uuid;
  v_imo    uuid;
  v_scopes text[];
  v_hash   text;
BEGIN
  SELECT c.id, c.imo_id, c.scopes, c.client_secret_hash
    INTO v_id, v_imo, v_scopes, v_hash
  FROM public.imo_call_platform_credentials c
  WHERE c.client_id = p_client_id
    AND c.is_active
    AND c.revoked_at IS NULL;

  -- Always run exactly one bcrypt round so an unknown/inactive/revoked client_id takes ~the same
  -- time as a known client_id with a wrong secret — removes the client_id existence timing oracle
  -- on this publicly reachable (verify_jwt=false) endpoint.
  IF v_id IS NULL THEN
    PERFORM extensions.crypt(p_secret, extensions.gen_salt('bf', 12));
    RETURN;  -- unknown/inactive/revoked (caller returns 401)
  END IF;

  IF v_hash IS DISTINCT FROM extensions.crypt(p_secret, v_hash) THEN
    RETURN;  -- wrong secret (caller returns 401)
  END IF;

  UPDATE public.imo_call_platform_credentials SET last_used_at = now() WHERE id = v_id;
  RETURN QUERY SELECT v_id, v_imo, v_scopes;
END;
$$;

-- ============================================================================
-- crm_rotate_credential — super-admin rotates the secret; returns the new plaintext ONCE.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.crm_rotate_credential(p_credential_id uuid)
RETURNS TABLE (client_secret text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_imo     uuid;
  v_active  boolean;
  v_revoked timestamptz;
  v_secret  text;
BEGIN
  SELECT c.imo_id, c.is_active, c.revoked_at
    INTO v_imo, v_active, v_revoked
  FROM public.imo_call_platform_credentials c WHERE c.id = p_credential_id;
  IF v_imo IS NULL THEN RAISE EXCEPTION 'credential not found' USING ERRCODE = 'no_data_found'; END IF;
  IF NOT public.super_admin_in_scope(v_imo) THEN
    RAISE EXCEPTION 'not authorized to rotate this credential' USING ERRCODE = '42501';
  END IF;
  -- Rotating must NOT silently un-revoke a credential — re-issue instead.
  IF v_revoked IS NOT NULL OR NOT v_active THEN
    RAISE EXCEPTION 'credential is revoked; re-issue instead of rotating' USING ERRCODE = '42501';
  END IF;

  v_secret := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  UPDATE public.imo_call_platform_credentials
    SET client_secret_hash = extensions.crypt(v_secret, extensions.gen_salt('bf', 12))
  WHERE id = p_credential_id;

  RETURN QUERY SELECT v_secret;
END;
$$;

-- ============================================================================
-- crm_revoke_credential — super-admin revokes a credential (existing bearer tokens
-- remain valid until expiry — stateless 24h tokens; conscious tradeoff).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.crm_revoke_credential(p_credential_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_imo uuid;
BEGIN
  SELECT c.imo_id INTO v_imo FROM public.imo_call_platform_credentials c WHERE c.id = p_credential_id;
  IF v_imo IS NULL THEN RETURN false; END IF;
  IF NOT public.super_admin_in_scope(v_imo) THEN
    RAISE EXCEPTION 'not authorized to revoke this credential' USING ERRCODE = '42501';
  END IF;

  UPDATE public.imo_call_platform_credentials
    SET is_active = false, revoked_at = now()
  WHERE id = p_credential_id;
  RETURN true;
END;
$$;

-- ============================================================================
-- crm_register_agent_pcid — super-admin registers the PLATFORM-issued pcId against an
-- agent (one pcId per agent per IMO). Upsert so re-registration just updates the value.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.crm_register_agent_pcid(
  p_imo_id  uuid,
  p_user_id uuid,
  p_pc_id   text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.super_admin_in_scope(p_imo_id) THEN
    RAISE EXCEPTION 'not authorized to register pcIds for this IMO' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = p_user_id AND up.imo_id = p_imo_id) THEN
    RAISE EXCEPTION 'agent % is not in IMO %', p_user_id, p_imo_id USING ERRCODE = '42501';
  END IF;

  -- A pcId maps to exactly ONE agent (UNIQUE(imo_id, pc_id)). If a DIFFERENT agent currently holds
  -- this platform-issued pcId, release it first so re-pointing the pcId is a clean reassignment
  -- rather than an unhandled unique_violation (23505).
  DELETE FROM public.imo_agent_external_ids
  WHERE imo_id = p_imo_id AND pc_id = p_pc_id AND user_id <> p_user_id;

  INSERT INTO public.imo_agent_external_ids (imo_id, user_id, pc_id)
  VALUES (p_imo_id, p_user_id, p_pc_id)
  ON CONFLICT (imo_id, user_id) DO UPDATE SET pc_id = EXCLUDED.pc_id;
  RETURN true;
END;
$$;

-- ============================================================================
-- Grants. Admin RPCs: authenticated (super-admin-gated internally), never anon.
-- Authenticate: service_role ONLY (takes a secret + returns identity).
-- ============================================================================
REVOKE ALL ON FUNCTION public.crm_issue_credential(uuid, text, text[])      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crm_rotate_credential(uuid)                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crm_revoke_credential(uuid)                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crm_register_agent_pcid(uuid, uuid, text)     FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_issue_credential(uuid, text, text[])   TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_rotate_credential(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_revoke_credential(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_register_agent_pcid(uuid, uuid, text)  TO authenticated;

REVOKE ALL ON FUNCTION public.crm_authenticate_credential(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_authenticate_credential(text, text) TO service_role;

COMMIT;
