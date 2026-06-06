-- Migration: Simplify custom domains flow
--
-- Collapses the custom-domain lifecycle from a 5-step manual state machine
-- (draft -> pending_dns -> verified -> provisioning -> active, with separate
-- "Verify DNS" and "Provision" user actions) down to:
--
--   draft -> pending_dns -> [provisioning] -> active   (+ error)
--
-- The domain is registered with Vercel at create time and a single CNAME is all
-- the user adds; Vercel verifies ownership via that CNAME and auto-issues SSL.
-- The homegrown `_thestandardhq-verify` TXT step is removed entirely (it was both
-- redundant and broken — Deno.resolveDns appended the edge container's search
-- suffix, so it could never resolve). The `verified` status is therefore retired
-- from the runtime flow (the enum value remains for historical rows / safety).
--
-- Changes:
--   1. Rewrite admin_update_domain_status() transition rules.
--   2. Drop NOT NULL on verification_token (no longer generated).

-- ============================================================================
-- 1. Rewrite the state-machine transitions
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_update_domain_status(
  p_domain_id UUID,
  p_user_id UUID,
  p_new_status custom_domain_status,
  p_verified_at TIMESTAMPTZ DEFAULT NULL,
  p_provider_domain_id TEXT DEFAULT NULL,
  p_provider_metadata JSONB DEFAULT NULL,
  p_last_error TEXT DEFAULT NULL
)
RETURNS custom_domains
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_domain custom_domains;
  v_old_status custom_domain_status;
BEGIN
  -- Fetch current domain and verify ownership
  SELECT * INTO v_domain
  FROM custom_domains
  WHERE id = p_domain_id AND user_id = p_user_id;

  IF v_domain IS NULL THEN
    RAISE EXCEPTION 'Domain not found or access denied';
  END IF;

  v_old_status := v_domain.status;

  -- Simplified state machine:
  --   draft        -> pending_dns
  --   pending_dns  -> provisioning | active | error
  --   provisioning -> active | error
  --   error        -> pending_dns           (retry: re-add + re-check DNS)
  IF NOT (
    (v_old_status = 'draft' AND p_new_status = 'pending_dns') OR
    (v_old_status = 'pending_dns' AND p_new_status IN ('provisioning', 'active', 'error')) OR
    (v_old_status = 'provisioning' AND p_new_status IN ('active', 'error')) OR
    (v_old_status = 'error' AND p_new_status = 'pending_dns')
  ) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', v_old_status, p_new_status;
  END IF;

  -- Perform update
  UPDATE custom_domains SET
    status = p_new_status,
    verified_at = COALESCE(p_verified_at, verified_at),
    provider_domain_id = COALESCE(p_provider_domain_id, provider_domain_id),
    provider_metadata = COALESCE(p_provider_metadata, provider_metadata),
    last_error = p_last_error,
    updated_at = NOW()
  WHERE id = p_domain_id
  RETURNING * INTO v_domain;

  RETURN v_domain;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_update_domain_status FROM PUBLIC;

-- ============================================================================
-- 2. verification_token is no longer generated — make it optional
-- ============================================================================

ALTER TABLE custom_domains ALTER COLUMN verification_token DROP NOT NULL;

COMMENT ON COLUMN custom_domains.verification_token IS
  'Deprecated. Previously a DNS TXT verification token; ownership is now proven by the CNAME via Vercel. Nullable; no longer generated.';
