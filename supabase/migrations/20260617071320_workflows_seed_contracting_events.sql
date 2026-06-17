-- Workflows P2 — seed 8 contracting trigger events (new "contracting" category).
--
-- Emitted by:
--   carrierContractRequestService.createContractRequest  -> contracting.request_created
--   carrierContractRequestService.updateContractRequest  -> contracting.request_writing_received
--                                                          / contracting.request_completed
--   contractingHubService.setStatus (RPC)                -> contracting.carrier_{submitted,approved,denied,terminated}
--   contractingHubService.setContractedUnder (RPC)       -> contracting.held_under_set
--
-- recipientId = the affected person's user_profiles.id (the recruit for request.*,
-- the agent for carrier.*/held_under). agent_* tags are filled from that profile;
-- domain values (carrierId, requestId, writingNumber, …) ride in context_*.
-- available_variables = agent recipient + common (mirrors eventCatalog AGENT_VARS).
--
-- NOT seeded (deferred): contracting.carrier_newly_eligible (Tier-D DB-trigger
-- fan-out) and the 3 sponsorship.* events (need RPC-return capture + approve/deny
-- stage disambiguation) — a focused follow-up.

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
    ('contracting.request_created','contracting','A carrier contracting request is created for a recruit.',
       to_jsonb(agent_vars || common), true),
    ('contracting.request_writing_received','contracting','A contracting request reaches the writing-number-received stage.',
       to_jsonb(agent_vars || common), true),
    ('contracting.request_completed','contracting','A carrier contracting request is completed.',
       to_jsonb(agent_vars || common), true),
    ('contracting.carrier_submitted','contracting','An agent''s carrier contract is submitted.',
       to_jsonb(agent_vars || common), true),
    ('contracting.carrier_approved','contracting','An agent''s carrier contract is approved.',
       to_jsonb(agent_vars || common), true),
    ('contracting.carrier_denied','contracting','An agent''s carrier contract is denied.',
       to_jsonb(agent_vars || common), true),
    ('contracting.carrier_terminated','contracting','An agent''s carrier contract is terminated.',
       to_jsonb(agent_vars || common), true),
    ('contracting.held_under_set','contracting','An agent''s carrier contract is set to be held under a sponsor.',
       to_jsonb(agent_vars || common), true)
  ON CONFLICT (event_name) DO UPDATE SET
    category            = EXCLUDED.category,
    description         = EXCLUDED.description,
    available_variables = EXCLUDED.available_variables,
    is_active           = EXCLUDED.is_active;

  -- Keep the registry in lockstep with the active catalog (32 events).
  DELETE FROM public.trigger_event_types
  WHERE event_name NOT IN (
    'recruit.created','recruit.phase_changed','recruit.graduated_to_agent',
    'recruit.dropped_out',
    'policy.created','policy.cancelled','policy.renewed',
    'policy.approved','policy.active','policy.denied','policy.withdrawn','policy.lapsed',
    'commission.earned','commission.paid','commission.chargeback',
    'commission.cancelled','commission.chargeback_reversed','chargeback.resolved','override.paid',
    'lead.pack_purchased',
    'agent.approved','agent.denied','agent.licensed','agent.contract_level_changed',
    'contracting.request_created','contracting.request_writing_received',
    'contracting.request_completed','contracting.carrier_submitted',
    'contracting.carrier_approved','contracting.carrier_denied',
    'contracting.carrier_terminated','contracting.held_under_set'
  );
END $$;
