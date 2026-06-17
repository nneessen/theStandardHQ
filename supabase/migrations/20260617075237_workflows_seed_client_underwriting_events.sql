-- Workflows P2 — seed 4 client + underwriting trigger events (new "client" and
-- "underwriting" categories).
--
-- Emitted by:
--   ClientService.create / createOrFind (new-insert branch only) -> client.created
--       (recipient = the owning agent)
--   ruleService.submitForReview/approveRuleSet/rejectRuleSet
--       -> underwriting.rule_set_submitted / _approved / _rejected
--       (recipient = the rule set AUTHOR via created_by, not the reviewer)
--
-- recipientId = a user_profiles.id; agent_* tags fill from it, domain values ride
-- in context_*. available_variables = agent recipient + common. Idempotent.
--
-- NOT seeded (deferred to P3): kpi.lead_outcome_won / kpi.lead_outcome_lost — written
-- only by the close-lead-heat-score Deno cron edge fn (Tier C; no React emit site).

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
    ('client.created','client','An agent adds a new client.',
       to_jsonb(agent_vars || common), true),
    ('underwriting.rule_set_submitted','underwriting','An underwriting rule set is submitted for review.',
       to_jsonb(agent_vars || common), true),
    ('underwriting.rule_set_approved','underwriting','An underwriting rule set is approved (notifies the submitter).',
       to_jsonb(agent_vars || common), true),
    ('underwriting.rule_set_rejected','underwriting','An underwriting rule set is rejected (notifies the submitter).',
       to_jsonb(agent_vars || common), true)
  ON CONFLICT (event_name) DO UPDATE SET
    category            = EXCLUDED.category,
    description         = EXCLUDED.description,
    available_variables = EXCLUDED.available_variables,
    is_active           = EXCLUDED.is_active;

  -- Keep the registry in lockstep with the active catalog (63 events).
  DELETE FROM public.trigger_event_types
  WHERE event_name NOT IN (
    'recruit.created','recruit.phase_changed','recruit.graduated_to_agent',
    'recruit.dropped_out',
    'recruit.pipeline_enrolled','recruit.phase_completed','recruit.phase_blocked',
    'recruit.checklist_item_completed','recruit.checklist_item_awaiting_approval',
    'recruit.quiz_passed','recruit.quiz_failed','recruit.onboarding_completed',
    'policy.created','policy.cancelled','policy.renewed',
    'policy.approved','policy.active','policy.denied','policy.withdrawn','policy.lapsed',
    'commission.earned','commission.paid','commission.chargeback',
    'commission.cancelled','commission.chargeback_reversed','chargeback.resolved','override.paid',
    'lead.pack_purchased',
    'lead.accepted','lead.rejected','lead_pack.roi_updated',
    'prospect.converted','prospect.status_changed','instagram.lead_created',
    'agent.approved','agent.denied','agent.licensed','agent.contract_level_changed',
    'contracting.request_created','contracting.request_writing_received',
    'contracting.request_completed','contracting.carrier_submitted',
    'contracting.carrier_approved','contracting.carrier_denied',
    'contracting.carrier_terminated','contracting.held_under_set',
    'document.uploaded','document.approved','document.rejected','document.all_required_approved',
    'invitation.accepted','join_request.created','join_request.approved','join_request.rejected',
    'agency_request.created','agency_request.approved','agency_request.rejected',
    'agency.created','agency.ownership_transferred',
    'client.created','underwriting.rule_set_submitted',
    'underwriting.rule_set_approved','underwriting.rule_set_rejected'
  );
END $$;
