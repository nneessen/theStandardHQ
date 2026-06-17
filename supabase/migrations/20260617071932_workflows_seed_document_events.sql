-- Workflows P2 — seed 4 document trigger events (new "document" category).
--
-- Emitted by src/services/documents/documentService.ts:
--   uploadDocument -> document.uploaded
--   approve        -> document.approved (+ document.all_required_approved when it
--                     clears the owner's last outstanding required document)
--   reject         -> document.rejected
--
-- recipientId = the document OWNER's user_profiles.id (NOT the approver), so the
-- agent_* tags fill from that profile; domain values (documentName/type) ride in
-- context_*. available_variables = agent recipient + common. Idempotent.
--
-- NOT seeded (deferred to Tier-D sweep, P4): document.expired / document.expiring
-- (bulk/periodic, no clean per-row client emit site).

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
    ('document.uploaded','document','A document is uploaded to an agent''s vault.',
       to_jsonb(agent_vars || common), true),
    ('document.approved','document','A submitted document is approved.',
       to_jsonb(agent_vars || common), true),
    ('document.rejected','document','A submitted document is rejected.',
       to_jsonb(agent_vars || common), true),
    ('document.all_required_approved','document','An agent''s last outstanding required document is approved.',
       to_jsonb(agent_vars || common), true)
  ON CONFLICT (event_name) DO UPDATE SET
    category            = EXCLUDED.category,
    description         = EXCLUDED.description,
    available_variables = EXCLUDED.available_variables,
    is_active           = EXCLUDED.is_active;

  -- Keep the registry in lockstep with the active catalog (36 events).
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
    'contracting.carrier_terminated','contracting.held_under_set',
    'document.uploaded','document.approved','document.rejected','document.all_required_approved'
  );
END $$;
