-- Workflows P2 — seed the 4 agent lifecycle trigger events.
--
-- These are now emitted by src/services/users/userService.ts:
--   agent.approved                 — approve()
--   agent.denied                   — deny()
--   agent.licensed                 — graduateRecruit() (recruit becomes a licensed agent)
--   agent.contract_level_changed   — updateContractLevel()
--
-- The "affected agent" IS the recipient (emit sets recipientId = the agent's
-- user_profiles.id), so process-workflow.buildTemplateVariables fills the agent_*
-- template variables from that profile. available_variables mirrors the catalog
-- (src/features/workflows/eventCatalog.ts AGENT_VARS + COMMON).
--
-- Idempotent (upsert on the unique event_name). After this the active set is the
-- 15 events the app emits (existing 11 + these 4). The DELETE keeps the registry
-- in lockstep with the catalog (findAll == findActive; no dead triggers).

DO $$
DECLARE
  common     text[] := ARRAY[
    'user_name','user_first_name','user_last_name','user_email','company_name',
    'current_date','date_today','date_tomorrow','date_current_month',
    'date_current_year','app_url','workflow_name'];
  agent_vars text[] := ARRAY[
    'agent_name','agent_first_name','agent_email','agent_contract_level',
    'agent_license_number','agent_npn','agent_status'];
BEGIN
  INSERT INTO public.trigger_event_types
    (event_name, category, description, available_variables, is_active)
  VALUES
    ('agent.approved','agent','An agent''s account is approved into the system.',
       to_jsonb(agent_vars || common), true),
    ('agent.denied','agent','An agent''s account request is denied.',
       to_jsonb(agent_vars || common), true),
    ('agent.licensed','agent','A recruit graduates and becomes a licensed agent.',
       to_jsonb(agent_vars || common), true),
    ('agent.contract_level_changed','agent','An agent''s commission contract level is changed.',
       to_jsonb(agent_vars || common), true)
  ON CONFLICT (event_name) DO UPDATE SET
    category            = EXCLUDED.category,
    description         = EXCLUDED.description,
    available_variables = EXCLUDED.available_variables,
    is_active           = EXCLUDED.is_active;

  -- Keep the registry in lockstep with the active catalog (15 events).
  DELETE FROM public.trigger_event_types
  WHERE event_name NOT IN (
    'recruit.created','recruit.phase_changed','recruit.graduated_to_agent',
    'recruit.dropped_out','policy.created','policy.cancelled','policy.renewed',
    'commission.earned','commission.paid','commission.chargeback',
    'lead.pack_purchased',
    'agent.approved','agent.denied','agent.licensed','agent.contract_level_changed'
  );
END $$;
