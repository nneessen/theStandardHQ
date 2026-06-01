-- Platform Terms of Service / Privacy Policy acceptance tracking.
--
-- WHY: Account access is invitation-only, but invitation does not create assent.
-- The Terms contain a binding arbitration clause and a class-action waiver
-- (section 13). Those are only enforceable if each user AFFIRMATIVELY accepts
-- the Terms (clickwrap), not via a passive "by continuing you agree" line
-- (browsewrap, increasingly held unenforceable). This records a timestamped,
-- versioned, per-user acceptance captured by the first-login gate.
--
-- The write goes through a SECURITY DEFINER RPC keyed to auth.uid() so a user
-- can only ever record acceptance for their OWN account.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text;

COMMENT ON COLUMN public.user_profiles.terms_accepted_at IS
  'Timestamp the user affirmatively accepted the Terms of Service & Privacy Policy via the first-login gate. NULL = not yet accepted.';
COMMENT ON COLUMN public.user_profiles.terms_version IS
  'Version (Terms "Last Updated" date, e.g. 2026-05-11) the user accepted. Lets a future Terms revision re-prompt acceptance.';

CREATE OR REPLACE FUNCTION public.accept_platform_terms(p_version text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_version IS NULL OR length(trim(p_version)) = 0 THEN
    RAISE EXCEPTION 'A terms version is required';
  END IF;

  UPDATE public.user_profiles
     SET terms_accepted_at = v_now,
         terms_version = p_version,
         updated_at = v_now
   WHERE id = v_uid;

  RETURN v_now;
END;
$$;

-- Authenticated users only; never anon/public.
REVOKE ALL ON FUNCTION public.accept_platform_terms(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_platform_terms(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_platform_terms(text) TO authenticated;
