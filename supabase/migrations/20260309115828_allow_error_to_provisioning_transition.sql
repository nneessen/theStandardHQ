-- supabase/migrations/20260309115828_allow_error_to_provisioning_transition.sql
-- Migration: Allow error -> provisioning transition in custom domain state machine
--
-- Problem: Domains that timeout during provisioning go to "error" state.
-- Users must delete and recreate the domain to retry. This migration adds
-- error -> provisioning as a valid transition so users can retry without
-- losing their DNS verification.

-- ============================================================================
-- UPDATE admin_update_domain_status STATE MACHINE
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

  -- Enforce state machine transitions:
  -- draft -> pending_dns
  -- pending_dns -> verified | error
  -- verified -> provisioning | error
  -- provisioning -> active | error
  -- error -> pending_dns | verified | provisioning (retry without delete)
  IF NOT (
    (v_old_status = 'draft' AND p_new_status = 'pending_dns') OR
    (v_old_status = 'pending_dns' AND p_new_status IN ('verified', 'error')) OR
    (v_old_status = 'verified' AND p_new_status IN ('provisioning', 'error')) OR
    (v_old_status = 'provisioning' AND p_new_status IN ('active', 'error')) OR
    (v_old_status = 'error' AND p_new_status IN ('pending_dns', 'verified', 'provisioning'))
  ) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', v_old_status, p_new_status;
  END IF;

  -- Perform update
  -- Clear last_error on successful transitions (non-error states)
  UPDATE custom_domains SET
    status = p_new_status,
    verified_at = COALESCE(p_verified_at, verified_at),
    provider_domain_id = COALESCE(p_provider_domain_id, provider_domain_id),
    provider_metadata = COALESCE(p_provider_metadata, provider_metadata),
    -- Clear last_error on success, set it on error
    last_error = CASE
      WHEN p_new_status = 'error' THEN p_last_error
      ELSE NULL  -- Clear stale errors on successful transitions
    END,
    updated_at = NOW()
  WHERE id = p_domain_id
  RETURNING * INTO v_domain;

  RETURN v_domain;
END;
$$;

COMMENT ON FUNCTION admin_update_domain_status IS
  'Transitions domain status with state machine enforcement. Allows error -> verified | provisioning for retry. Clears last_error on successful transitions. Called by Edge Functions with service_role only.';

-- Ensure permissions remain restricted
REVOKE EXECUTE ON FUNCTION admin_update_domain_status FROM PUBLIC;
