-- Workflows P2 — seed the 5 new policy lifecycle trigger events.
--
-- Now emitted by src/services/policies/policyService.ts:
--   policy.approved   — update() when status -> 'approved'
--   policy.active     — update() when lifecycleStatus -> 'active' (co-fires with
--                       policy.approved on approve; distinct event)
--   policy.denied     — update() when status -> 'denied'
--   policy.withdrawn  — update() when status -> 'withdrawn'
--   policy.lapsed     — lapsePolicy()
--
-- recipientId = the writing agent's user_profiles.id, so the engine fills the
-- recipient (recruit_*) tags from that profile. Domain values (policyNumber,
-- carrierId, premium, …) ride in the run context as context_* (the dedicated
-- policy_* tags are a Phase 3 add per eventCatalog.ts). available_variables
-- mirrors the existing policy.* rows (agent recipient + common). Idempotent.

DO $$
DECLARE
  common  text[] := ARRAY[
    'user_name','user_first_name','user_last_name','user_email','company_name',
    'current_date','date_today','date_tomorrow','date_current_month',
    'date_current_year','app_url','workflow_name'];
  agent   text[] := ARRAY['recruit_name','recruit_first_name','recruit_email'];
BEGIN
  INSERT INTO public.trigger_event_types
    (event_name, category, description, available_variables, is_active)
  VALUES
    ('policy.approved','policy','A policy application is approved by the carrier.',
       to_jsonb(agent || common), true),
    ('policy.active','policy','A policy becomes active (in force).',
       to_jsonb(agent || common), true),
    ('policy.denied','policy','A policy application is denied.',
       to_jsonb(agent || common), true),
    ('policy.withdrawn','policy','A policy application is withdrawn.',
       to_jsonb(agent || common), true),
    ('policy.lapsed','policy','A policy lapses (e.g. non-payment).',
       to_jsonb(agent || common), true)
  ON CONFLICT (event_name) DO UPDATE SET
    category            = EXCLUDED.category,
    description         = EXCLUDED.description,
    available_variables = EXCLUDED.available_variables,
    is_active           = EXCLUDED.is_active;

  -- Keep the registry in lockstep with the active catalog (20 events).
  DELETE FROM public.trigger_event_types
  WHERE event_name NOT IN (
    'recruit.created','recruit.phase_changed','recruit.graduated_to_agent',
    'recruit.dropped_out',
    'policy.created','policy.cancelled','policy.renewed',
    'policy.approved','policy.active','policy.denied','policy.withdrawn','policy.lapsed',
    'commission.earned','commission.paid','commission.chargeback',
    'lead.pack_purchased',
    'agent.approved','agent.denied','agent.licensed','agent.contract_level_changed'
  );
END $$;
