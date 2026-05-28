-- ============================================================================
-- Platform-sunset Phase-5 cleanup: lifecycle hardening (L5 + L7)
-- ============================================================================
-- Two low-severity robustness fixes from the turn-on readiness review. Both are
-- dormant-safe (no behavior change until an IMO is revoked) and idempotent.
--
-- L5 — invoke_account_lifecycle_daily() is the pg_cron wrapper that reads the
--      service-role key from app_config and net.http_post's the lifecycle edge
--      fn. It was GRANTed to PUBLIC by default. The key is only ever read inside
--      the SECURITY DEFINER body (never returned), but there is no reason for any
--      non-cron caller to invoke it, so lock it to postgres + service_role.
--
-- L7 — account_deletion_log holds one row per wiped user, written/updated by
--      confirm-and-wipe-account (UPDATE-most-recent on retry, else INSERT). Two
--      concurrent cron ticks processing the same straggler could both see no
--      prior row and double-INSERT (no constraint stopped it). A partial unique
--      index enforces one row per user so the losing INSERT fails fast (the wipe
--      is idempotent; the retry then finds the row and UPDATEs it).
-- ============================================================================

BEGIN;

-- L5 ------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.invoke_account_lifecycle_daily() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoke_account_lifecycle_daily() FROM anon;
REVOKE ALL ON FUNCTION public.invoke_account_lifecycle_daily() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_account_lifecycle_daily() TO service_role;

-- L7 ------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_log_user_id_uniq
  ON public.account_deletion_log (user_id)
  WHERE user_id IS NOT NULL;

COMMIT;
