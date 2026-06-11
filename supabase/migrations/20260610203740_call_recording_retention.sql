-- ============================================================================
-- Call-recording storage lifecycle: 180-day audio retention + per-IMO quota.
-- ============================================================================
-- The `call-recordings` bucket has no retention/quota today, so audio grows
-- unbounded even though the transcript + analysis (the durable value) already
-- live in kpi_call_recordings. This migration adds:
--   1. audio_deleted_at  — marks the audio blob purged (row/transcript kept).
--   2. a partial index    — cheap scan for the daily retention cron.
--   3. get_imo_call_recording_usage_bytes() — aggregate usage for the upload
--      quota gate (SECURITY DEFINER: a plain agent's RLS only exposes their own
--      + downline rows, so the whole-IMO sum needs to bypass RLS).
--   4. a SECURITY DEFINER cron wrapper + daily pg_cron schedule that invokes the
--      call-recording-retention-cron edge function (same pattern as
--      invoke_account_lifecycle_daily / 20260527094315).
-- ============================================================================

BEGIN;

-- 1. Audio-purged marker. Row, transcript, objections, summary, metrics all
--    remain; only the audio blob in storage is removed. Excluded from quota.
ALTER TABLE public.kpi_call_recordings
  ADD COLUMN IF NOT EXISTS audio_deleted_at timestamptz;

COMMENT ON COLUMN public.kpi_call_recordings.audio_deleted_at IS
'When the audio blob was purged by the 180-day retention cron. The DB row + transcript + analysis are retained permanently; only the storage object is gone. Excluded from the per-IMO storage quota.';

-- 2. Partial index so the retention cron only scans live, transcribed rows.
CREATE INDEX IF NOT EXISTS idx_kpi_recordings_retention
  ON public.kpi_call_recordings (created_at)
  WHERE audio_deleted_at IS NULL AND transcription_status = 'completed';

-- 3. Whole-IMO live storage usage for the upload quota gate. Aggregate-only
--    (returns a single bigint, never row data), so SECURITY DEFINER is safe and
--    lets any agent in the IMO get the true total despite per-agent RLS.
CREATE OR REPLACE FUNCTION public.get_imo_call_recording_usage_bytes()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(file_size_bytes), 0)::bigint
  FROM public.kpi_call_recordings
  WHERE imo_id = get_effective_imo_id()
    AND audio_deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_imo_call_recording_usage_bytes() TO authenticated;

COMMENT ON FUNCTION public.get_imo_call_recording_usage_bytes() IS
'Total live (non-purged) call-recording bytes for the caller''s effective IMO. SECURITY DEFINER aggregate (no row leakage) so a plain agent gets the whole-IMO total for the upload quota check.';

-- 4. pg_cron + pg_net (no-ops if already present).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 5. SECURITY DEFINER cron wrapper — keeps the service_role key out of
--    cron.job_run_details (mirrors invoke_account_lifecycle_daily).
CREATE OR REPLACE FUNCTION public.invoke_call_recording_retention_daily()
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url     TEXT;
  v_service_role_key TEXT;
  v_request_id       BIGINT;
BEGIN
  SELECT value INTO v_supabase_url
  FROM app_config WHERE key = 'supabase_project_url';

  SELECT value INTO v_service_role_key
  FROM app_config WHERE key = 'supabase_service_role_key';

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE LOG 'call-recording-retention-daily: Missing app_config values';
    RETURN;
  END IF;

  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/call-recording-retention-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.invoke_call_recording_retention_daily() IS
'Invokes call-recording-retention-cron once daily via pg_cron. SECURITY DEFINER wrapper keeps the service_role key out of cron.job_run_details.';

-- 6. Schedule idempotently. 09:30 UTC daily — staggered after the
--    account-lifecycle (09:15) job so they don't pile onto pg_net.
SELECT cron.unschedule('call-recording-retention-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'call-recording-retention-daily');

SELECT cron.schedule(
  'call-recording-retention-daily',
  '30 9 * * *',
  'SELECT public.invoke_call_recording_retention_daily();'
);

COMMIT;
