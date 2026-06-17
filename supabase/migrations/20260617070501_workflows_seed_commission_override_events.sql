-- Workflows P2 — seed 4 commission/override trigger events.
--
-- Now emitted by the commissions/overrides services:
--   commission.cancelled            — CommissionStatusService.markAsCancelled
--   commission.chargeback_reversed  — CommissionStatusService.reverseChargeback
--   chargeback.resolved             — chargebackService.resolve
--   override.paid                   — overrideService.updateOverrideStatus (gated status='paid')
--
-- recipientId = the affected agent's user_profiles.id (the commission/override
-- owner; for override.paid the upline payee). Domain values ride in context_*
-- (dedicated commission_* tags are a Phase 3 add). available_variables mirrors
-- the existing commission.* rows (agent recipient + common). Idempotent.
--
-- NOTE: override.created is intentionally NOT seeded — overrides are bulk-created
-- by an RPC/DB-trigger with no clean per-agent client emit site, so it is deferred
-- to the Tier-D signal sweep (P4).

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
    ('commission.cancelled','commission','A commission is cancelled.',
       to_jsonb(agent || common), true),
    ('commission.chargeback_reversed','commission','A charged-back commission is restored to earned.',
       to_jsonb(agent || common), true),
    ('chargeback.resolved','commission','A chargeback is marked resolved.',
       to_jsonb(agent || common), true),
    ('override.paid','commission','An override commission is paid out to an upline agent.',
       to_jsonb(agent || common), true)
  ON CONFLICT (event_name) DO UPDATE SET
    category            = EXCLUDED.category,
    description         = EXCLUDED.description,
    available_variables = EXCLUDED.available_variables,
    is_active           = EXCLUDED.is_active;

  -- Keep the registry in lockstep with the active catalog (24 events).
  DELETE FROM public.trigger_event_types
  WHERE event_name NOT IN (
    'recruit.created','recruit.phase_changed','recruit.graduated_to_agent',
    'recruit.dropped_out',
    'policy.created','policy.cancelled','policy.renewed',
    'policy.approved','policy.active','policy.denied','policy.withdrawn','policy.lapsed',
    'commission.earned','commission.paid','commission.chargeback',
    'commission.cancelled','commission.chargeback_reversed','chargeback.resolved','override.paid',
    'lead.pack_purchased',
    'agent.approved','agent.denied','agent.licensed','agent.contract_level_changed'
  );
END $$;
