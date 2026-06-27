-- Profile-photo reminders (Social Studio / Spotlight).
-- A daily cron kicks the `remind-missing-profile-photos` edge function, which nudges agents who
-- still have no profile photo (email + in-app) so their photo is available for AOTW / welcome
-- graphics. SCOPE = "just my team": only agents whose IMO has a CONNECTED Instagram integration
-- are ever reminded (no platform-wide email blast). Cadence is weekly per agent, tracked by
-- user_profiles.photo_reminder_last_sent_at, until a photo is uploaded.

-- 1. Cadence tracker.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS photo_reminder_last_sent_at timestamptz;

-- 2. The reminder roster (SECURITY DEFINER so the service-role edge fn reads it without broad
--    grants): approved, non-archived, photo-less agents in IG-connected IMOs, not reminded in 7d.
CREATE OR REPLACE FUNCTION public.get_agents_needing_photo_reminder(p_limit int DEFAULT 200)
RETURNS TABLE (user_id uuid, email text, first_name text, imo_id uuid)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT up.id, up.email, up.first_name, up.imo_id
  FROM public.user_profiles up
  WHERE up.approval_status = 'approved'
    AND up.archived_at IS NULL
    AND up.profile_photo_url IS NULL
    AND up.email IS NOT NULL
    AND (up.photo_reminder_last_sent_at IS NULL
         OR up.photo_reminder_last_sent_at < now() - interval '7 days')
    AND EXISTS (
      SELECT 1 FROM public.instagram_integrations ii
      WHERE ii.imo_id = up.imo_id
        AND ii.connection_status = 'connected'
        AND ii.is_active
    )
  ORDER BY up.photo_reminder_last_sent_at NULLS FIRST
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION public.get_agents_needing_photo_reminder(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_agents_needing_photo_reminder(int) TO service_role;

-- 3. Stamp after a successful reminder (holds the weekly cadence).
CREATE OR REPLACE FUNCTION public.mark_photo_reminder_sent(p_user_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  UPDATE public.user_profiles SET photo_reminder_last_sent_at = now() WHERE id = p_user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_photo_reminder_sent(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_photo_reminder_sent(uuid) TO service_role;

-- 4. Let the service-role edge fn post the in-app nudge through the existing RPC.
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, jsonb, timestamptz) TO service_role;

-- 5. Cron kick — same app_config service-key + pg_net pattern as invoke_workflow_worker(), so the
--    key never lands in cron.job_run_details.
CREATE OR REPLACE FUNCTION public.invoke_profile_photo_reminders()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_url text;
  v_key text;
  v_req bigint;
BEGIN
  SELECT value INTO v_url FROM public.app_config WHERE key = 'supabase_project_url';
  SELECT value INTO v_key FROM public.app_config WHERE key = 'supabase_service_role_key';
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE LOG 'invoke_profile_photo_reminders: missing app_config (supabase_project_url / supabase_service_role_key)';
    RETURN;
  END IF;
  SELECT net.http_post(
    url := v_url || '/functions/v1/remind-missing-profile-photos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  ) INTO v_req;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_profile_photo_reminders() FROM PUBLIC, anon, authenticated;

-- 6. Schedule daily at 14:00 UTC (~9–10am US). The edge fn enforces the 7-day per-agent cadence,
--    so a daily run only emails agents actually due. Idempotent reschedule.
SELECT cron.unschedule('profile-photo-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'profile-photo-reminders');

SELECT cron.schedule(
  'profile-photo-reminders',
  '0 14 * * *',
  'SELECT public.invoke_profile_photo_reminders();'
);
