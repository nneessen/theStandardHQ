-- supabase/migrations/20260626142357_account_setup_tokens.sql
-- App-controlled "set your password" tokens for newly-created accounts.
--
-- WHY: The Add-Agent onboarding (create-auth-user) emailed a Supabase *recovery*
-- link whose real lifetime is governed by the project Auth OTP/email-link expiry
-- (NOT the 72h `expiresIn` the code passed — that option is silently ignored) and
-- which is single-use, so corporate email scanners pre-clicking it burned the
-- token before the human arrived. This table is an app-owned alternative with a
-- real 7-day expiry we control and read-only validation, so a scanner GET can't
-- consume it. Mirrors the recruit_invitations pattern.

-- ============================================================================
-- TABLE: account_setup_tokens
-- ============================================================================

CREATE TABLE account_setup_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The account that will set its password (user_profiles.id == auth.users.id)
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Who created the account / triggered setup (the upline / admin)
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- Denormalized email so the public validate RPC can show it without a join
  email TEXT NOT NULL,

  -- Secure token for the public /set-password/{token} link
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

  -- Real 7-day expiry we own
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

  -- Consumed only when a password is actually set (read-only validation never sets this)
  used_at TIMESTAMPTZ,

  -- Resend tracking (cap enforced in the resend edge function, mirrors recruit flow)
  resend_count INTEGER NOT NULL DEFAULT 0,
  last_resent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE account_setup_tokens IS
  'App-owned password-setup tokens for newly created accounts (replaces fragile Supabase recovery links for onboarding).';

-- One live (unused) token per user is the normal case; the resend path updates the
-- existing row in place. A partial unique index keeps at most one unused token per user.
CREATE UNIQUE INDEX idx_account_setup_tokens_user_unused
  ON account_setup_tokens(user_id)
  WHERE used_at IS NULL;

CREATE INDEX idx_account_setup_tokens_expires
  ON account_setup_tokens(expires_at)
  WHERE used_at IS NULL;

-- ============================================================================
-- RLS: locked down. No anon/authenticated access at all — the table is reached
-- ONLY through the SECURITY DEFINER validate RPC below and the service-role edge
-- functions (set-account-password / resend-account-setup / create-auth-user).
-- ============================================================================

ALTER TABLE account_setup_tokens ENABLE ROW LEVEL SECURITY;

-- Belt-and-suspenders: revoke any broad default grants so a stray token is never
-- selectable directly by a client role (the token is a credential).
REVOKE ALL ON account_setup_tokens FROM anon, authenticated;

-- ============================================================================
-- PUBLIC RPC: validate a setup token (READ-ONLY — never consumes the token)
-- Safe for email-scanner pre-clicks: a GET only reads, it cannot burn the token.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_account_setup_by_token(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token account_setup_tokens%ROWTYPE;
  v_user user_profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_token
  FROM account_setup_tokens
  WHERE token = p_token
  LIMIT 1;

  IF v_token.id IS NULL THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'not_found',
      'message', 'This link is invalid. Ask your team leader to resend it.'
    );
  END IF;

  IF v_token.used_at IS NOT NULL THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'already_used',
      'message', 'Your password has already been set. Please log in.'
    );
  END IF;

  IF v_token.expires_at < NOW() THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'expired',
      'message', 'This link has expired. Ask your team leader to resend it.'
    );
  END IF;

  SELECT * INTO v_user FROM user_profiles WHERE id = v_token.user_id;

  RETURN json_build_object(
    'valid', true,
    'email', v_token.email,
    'first_name', v_user.first_name
  );
END;
$$;

-- Public access for the unauthenticated /set-password page.
GRANT EXECUTE ON FUNCTION get_account_setup_by_token(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_account_setup_by_token(UUID) TO authenticated;

-- ============================================================================
-- SERVICE RPC: create or refresh a user's setup token (atomic).
-- Used by create-auth-user (initial, p_enforce_cap=false) and resend-account-setup
-- (p_enforce_cap=true, max 5 like resend_recruit_invitation). Keeps at most one
-- unused token per user (the partial unique index), so a resend rotates in place.
-- Service-role only — never exposed to clients.
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_account_setup_token(
  p_user_id UUID,
  p_email TEXT,
  p_created_by UUID DEFAULT NULL,
  p_enforce_cap BOOLEAN DEFAULT TRUE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing account_setup_tokens%ROWTYPE;
  v_token UUID;
  v_count INTEGER;
BEGIN
  SELECT * INTO v_existing
  FROM account_setup_tokens
  WHERE user_id = p_user_id AND used_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    IF p_enforce_cap AND v_existing.resend_count >= 5 THEN
      RETURN json_build_object('capped', true, 'resend_count', v_existing.resend_count);
    END IF;

    v_token := gen_random_uuid();
    UPDATE account_setup_tokens
    SET token = v_token,
        expires_at = NOW() + INTERVAL '7 days',
        email = p_email,
        created_by = COALESCE(p_created_by, created_by),
        resend_count = CASE WHEN p_enforce_cap THEN resend_count + 1 ELSE resend_count END,
        last_resent_at = CASE WHEN p_enforce_cap THEN NOW() ELSE last_resent_at END
    WHERE id = v_existing.id
    RETURNING token, resend_count INTO v_token, v_count;
  ELSE
    INSERT INTO account_setup_tokens (user_id, email, created_by)
    VALUES (p_user_id, p_email, p_created_by)
    RETURNING token, resend_count INTO v_token, v_count;
  END IF;

  RETURN json_build_object('capped', false, 'token', v_token, 'resend_count', v_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION upsert_account_setup_token(UUID, TEXT, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_account_setup_token(UUID, TEXT, UUID, BOOLEAN) TO service_role;
