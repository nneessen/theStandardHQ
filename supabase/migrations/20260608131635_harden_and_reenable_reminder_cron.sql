-- Re-enable the recruiting reminder cron now that it is safe (#12).
--
-- Prereqs now satisfied:
--   * Send path is suppression-aware: process-automation-reminders now runs every
--     recipient (email + sms, all three trigger types) through is_suppressed before
--     Mailgun/Twilio. (Edge function redeployed 2026-06-08.)
--   * Sources exclude inactive/sunset-revoked IMOs: get_stale_phase_recruits was
--     fixed in 20260608124940; this migration fixes the other two sources
--     (get_approaching_deadline_items, get_imos_with_system_automations) so the
--     deadline + password paths can't surface dark tenants.
--   * invoke_automation_reminders stays REVOKE'd from anon/authenticated (20260608122750).

-- 1) item_deadline_approaching source — exclude inactive/revoked IMOs.
CREATE OR REPLACE FUNCTION public.get_approaching_deadline_items()
  RETURNS TABLE(recruit_id uuid, checklist_item_id uuid, days_until_deadline integer, automation_delay_days integer)
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT DISTINCT
    rcp.user_id AS recruit_id,
    rcp.checklist_item_id,
    GREATEST(0, (
      pp.estimated_days - EXTRACT(DAY FROM (NOW() - rpp.started_at))::integer
    ))::integer AS days_until_deadline,
    pa.delay_days AS automation_delay_days
  FROM recruit_checklist_progress rcp
  JOIN phase_checklist_items pci ON pci.id = rcp.checklist_item_id
  JOIN pipeline_phases pp ON pp.id = pci.phase_id
  JOIN recruit_phase_progress rpp ON rpp.phase_id = pp.id AND rpp.user_id = rcp.user_id
  JOIN pipeline_automations pa ON pa.checklist_item_id = rcp.checklist_item_id
  JOIN user_profiles up ON up.id = rcp.user_id
  JOIN imos i ON i.id = up.imo_id
  WHERE
    rcp.status NOT IN ('completed', 'approved')
    AND rpp.status = 'in_progress'
    AND rpp.started_at IS NOT NULL
    AND pp.estimated_days IS NOT NULL
    AND pa.trigger_type = 'item_deadline_approaching'
    AND pa.is_active = true
    AND (pp.estimated_days - EXTRACT(DAY FROM (NOW() - rpp.started_at))::integer) <= pa.delay_days
    AND (pp.estimated_days - EXTRACT(DAY FROM (NOW() - rpp.started_at))::integer) >= 0
    AND up.onboarding_status NOT IN ('completed', 'graduated')
    AND i.is_active = true
    AND i.access_revoked_at IS NULL
  ORDER BY days_until_deadline ASC;
$function$;

-- 2) password_reminder source (per-IMO loop) — exclude inactive/revoked IMOs.
CREATE OR REPLACE FUNCTION public.get_imos_with_system_automations(p_trigger_type text)
  RETURNS TABLE(imo_id uuid, imo_name text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    pa.imo_id,
    i.name AS imo_name
  FROM pipeline_automations pa
  JOIN imos i ON i.id = pa.imo_id
  WHERE pa.trigger_type::TEXT = p_trigger_type
    AND pa.is_active = true
    AND pa.phase_id IS NULL
    AND pa.checklist_item_id IS NULL
    AND i.is_active = true
    AND i.access_revoked_at IS NULL;
END;
$function$;

-- 3) Re-schedule the daily reminder run (stood down in 20260608122750).
SELECT cron.unschedule('process-automation-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-automation-reminders');

SELECT cron.schedule(
  'process-automation-reminders',
  '0 13 * * *',
  'SELECT invoke_automation_reminders();'
);
