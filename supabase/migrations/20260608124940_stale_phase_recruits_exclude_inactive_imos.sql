-- Exclude inactive / sunset-revoked IMOs from the phase-stall reminder source.
--
-- WHY: get_stale_phase_recruits() (the source for the process-automation-reminders
-- phase_stall path) joined recruit_phase_progress -> pipeline_automations ->
-- user_profiles but never joined imos, so it returned recruits in deactivated or
-- access-revoked IMOs (e.g. the dead FFG IMO). When the reminder cron is re-enabled
-- this would message contacts in tenants that should be dark. Add the IMO gate.
--
-- NOTE: this is one part of safely re-enabling the reminder cron (task #12). The
-- remaining part — adding a communication-suppression/consent check to the edge
-- function's Mailgun/SMS send path — requires an edge-function redeploy and is NOT
-- covered here. Do not re-schedule the cron until that ships.

CREATE OR REPLACE FUNCTION public.get_stale_phase_recruits()
  RETURNS TABLE(recruit_id uuid, phase_id uuid, days_in_phase integer, automation_delay_days integer)
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT DISTINCT
    rpp.user_id AS recruit_id,
    rpp.phase_id,
    EXTRACT(DAY FROM (NOW() - rpp.started_at))::integer AS days_in_phase,
    pa.delay_days AS automation_delay_days
  FROM recruit_phase_progress rpp
  JOIN pipeline_automations pa ON pa.phase_id = rpp.phase_id
  JOIN user_profiles up ON up.id = rpp.user_id
  JOIN imos i ON i.id = up.imo_id
  WHERE
    rpp.status = 'in_progress'
    AND rpp.started_at IS NOT NULL
    AND pa.trigger_type = 'phase_stall'
    AND pa.is_active = true
    AND EXTRACT(DAY FROM (NOW() - rpp.started_at)) >= pa.delay_days
    AND up.onboarding_status NOT IN ('completed', 'graduated')
    -- Never surface recruits in deactivated or sunset-revoked IMOs.
    AND i.is_active = true
    AND i.access_revoked_at IS NULL
  ORDER BY days_in_phase DESC;
$function$;
