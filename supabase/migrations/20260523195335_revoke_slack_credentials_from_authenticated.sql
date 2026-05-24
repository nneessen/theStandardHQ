-- ============================================================================
-- Lock down get_agency_slack_credentials to service_role only
-- ============================================================================
--
-- Leak found during the Epic Life authenticated-surface audit (2026-05-23):
--   get_agency_slack_credentials(p_imo_id uuid, p_agency_id uuid) is
--   SECURITY DEFINER and was EXECUTABLE by `authenticated` (and PUBLIC). It
--   returns Slack OAuth secrets (client_secret_encrypted, signing_secret_encrypted)
--   for any IMO/agency id passed in. With Epic Life's IMO id already disclosed,
--   any authenticated user could call it and retrieve another tenant's Slack
--   credentials. It has NO tenant gate.
--
-- Why REVOKE instead of gate:
--   The only callers are two edge functions — slack-oauth-init and
--   slack-oauth-callback — both of which use the SERVICE_ROLE key (verified
--   2026-05-23). No user-facing path calls this function, so it never needs to
--   be reachable by `authenticated`/`anon`. Removing the grant eliminates the
--   leak with zero risk to the OAuth flows. Gating with row_in_acting_scope
--   would add an auth.uid()-dependent check that is meaningless under
--   service_role and only adds failure modes.
--
-- Note: function EXECUTE defaults to PUBLIC, and service_role inherits it that
-- way, so after REVOKE FROM PUBLIC we must explicitly GRANT to service_role to
-- keep the edge functions working.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.get_agency_slack_credentials(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_agency_slack_credentials(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_agency_slack_credentials(uuid, uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.get_agency_slack_credentials(uuid, uuid) TO service_role;
