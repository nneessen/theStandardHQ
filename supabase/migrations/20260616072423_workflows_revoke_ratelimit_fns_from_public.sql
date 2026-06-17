-- Workflows Phase 0 — finish locking down the rate-limit / tracking functions.
-- The prior migration revoked EXECUTE from anon + authenticated, but Postgres
-- grants EXECUTE to PUBLIC by default (shown as "=X/postgres" in proacl), and
-- PUBLIC includes every role — so the functions were still callable by anyone.
-- Revoke from PUBLIC; service_role keeps its explicit grant (the process-workflow
-- edge function calls these with the service-role key).

REVOKE EXECUTE ON FUNCTION
  public.check_workflow_email_rate_limit(uuid, uuid, text, integer)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.record_workflow_email(uuid, uuid, text, text, boolean, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.get_workflow_email_usage(uuid)
  FROM PUBLIC, anon, authenticated;

-- Belt-and-suspenders: ensure the server role can still execute.
GRANT EXECUTE ON FUNCTION
  public.check_workflow_email_rate_limit(uuid, uuid, text, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION
  public.record_workflow_email(uuid, uuid, text, text, boolean, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION
  public.get_workflow_email_usage(uuid)
  TO service_role;
