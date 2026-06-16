-- Workflows Phase 1 — reconcile trigger_event_types to the canonical event
-- catalog (src/features/workflows/eventCatalog.ts).
--
-- Problem: the registry drifted from reality. The EventType manager tab
-- (findAllEventTypes) and the wizard picker (findActiveTriggerEventTypes,
-- is_active=true) read different sets, and several rows were "dead triggers"
-- (selectable but never emitted: user.login/logout, email.sent/failed, etc.)
-- while events that ARE emitted had no per-event template variables.
--
-- Fix: seed exactly the 11 events the app actually emits, each with its category
-- and event-aware available_variables, all is_active=true; DELETE everything
-- else. After this, findAll == findActive (tab matches the picker exactly) and
-- every selectable event truly fires. Idempotent (upsert on the unique
-- event_name); safe on prod (deletes only never-emitted rows; workflows store
-- the event name as a string, not an FK, so nothing is orphaned).

DO $$
DECLARE
  common  text[] := ARRAY[
    'user_name','user_first_name','user_last_name','user_email','company_name',
    'current_date','date_today','date_tomorrow','date_current_month',
    'date_current_year','app_url','portal_link','workflow_name'];
  recruit text[] := ARRAY[
    'recruit_name','recruit_first_name','recruit_last_name','recruit_email',
    'recruit_phone','recruit_status','recruit_city','recruit_state',
    'recruit_contract_level'];
  agent   text[] := ARRAY['recruit_name','recruit_first_name','recruit_email'];
BEGIN
  INSERT INTO public.trigger_event_types
    (event_name, category, description, available_variables, is_active)
  VALUES
    ('recruit.created','recruit','A new recruit is added to a pipeline.',
       to_jsonb(recruit || common), true),
    ('recruit.phase_changed','recruit','A recruit advances to a new onboarding phase.',
       to_jsonb(recruit || ARRAY['phase_name','phase_description','days_in_phase'] || common), true),
    ('recruit.graduated_to_agent','recruit','A recruit completes onboarding and becomes a licensed agent.',
       to_jsonb(recruit || common), true),
    ('recruit.dropped_out','recruit','A recruit is marked as dropped from the pipeline.',
       to_jsonb(recruit || common), true),
    ('policy.created','policy','A new policy is written.',
       to_jsonb(agent || common), true),
    ('policy.cancelled','policy','A policy is cancelled or lapses.',
       to_jsonb(agent || common), true),
    ('policy.renewed','policy','A policy renews for another term.',
       to_jsonb(agent || common), true),
    ('commission.earned','commission','A commission is recorded as earned.',
       to_jsonb(agent || common), true),
    ('commission.paid','commission','A commission is marked paid out.',
       to_jsonb(agent || common), true),
    ('commission.chargeback','commission','A previously paid commission is charged back.',
       to_jsonb(agent || common), true),
    ('lead.pack_purchased','lead','An agent purchases a pack of leads.',
       to_jsonb(agent || common), true)
  ON CONFLICT (event_name) DO UPDATE SET
    category            = EXCLUDED.category,
    description         = EXCLUDED.description,
    available_variables = EXCLUDED.available_variables,
    is_active           = EXCLUDED.is_active;

  -- Remove dead triggers (anything not in the active catalog set).
  DELETE FROM public.trigger_event_types
  WHERE event_name NOT IN (
    'recruit.created','recruit.phase_changed','recruit.graduated_to_agent',
    'recruit.dropped_out','policy.created','policy.cancelled','policy.renewed',
    'commission.earned','commission.paid','commission.chargeback',
    'lead.pack_purchased'
  );
END $$;
