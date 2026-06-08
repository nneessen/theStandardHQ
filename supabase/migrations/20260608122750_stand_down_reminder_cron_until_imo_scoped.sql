-- Stand down the recruiting reminder cron until its send path is suppression-aware
-- and IMO-scoped (task #12).
--
-- WHY: enabling it (migration 20260608091228) activated a path that
--   (a) sends via Mailgun/SMS with NO communication-suppression / consent check, and
--   (b) selects stale-phase recruits / pipeline_automations with NO imo_id /
--       imos.is_active / access_revoked_at filter,
-- so the daily run could message contacts across ALL tenants — including sunset/
-- revoked IMOs (e.g. the dead FFG IMO) — without consent. Additionally
-- invoke_automation_reminders() was SECURITY DEFINER with no REVOKE, so PostgREST
-- exposed it to anon/authenticated for on-demand invocation.
--
-- FIX: unschedule the job and revoke public execute on the wrapper. Re-enable only
-- after the edge function gains suppression + IMO/active/not-revoked scoping (#12).

SELECT cron.unschedule('process-automation-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-automation-reminders');

REVOKE EXECUTE ON FUNCTION public.invoke_automation_reminders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invoke_automation_reminders() FROM anon;
REVOKE EXECUTE ON FUNCTION public.invoke_automation_reminders() FROM authenticated;
