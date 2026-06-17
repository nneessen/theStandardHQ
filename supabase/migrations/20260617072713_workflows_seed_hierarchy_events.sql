-- Workflows P2 — seed 9 hierarchy / team / access trigger events (new "hierarchy" category).
--
-- Emitted by:
--   invitationService.acceptInvitation     -> invitation.accepted (recipient = inviter)
--   JoinRequestService.createRequest        -> join_request.created (recipient = approver)
--   JoinRequestService.approveRequest        -> join_request.approved (recipient = requester)
--   JoinRequestService.rejectRequest         -> join_request.rejected (recipient = requester)
--   AgencyRequestService.createRequest        -> agency_request.created (recipient = approver/upline)
--   AgencyRequestService.approveRequest       -> agency_request.approved (recipient = new owner)
--   AgencyRequestService.rejectRequest        -> agency_request.rejected (recipient = requester)
--   AgencyService.createAgency                -> agency.created (recipient = designated owner; manual creation)
--   AgencyService.transferOwnership           -> agency.ownership_transferred (recipient = new owner)
--
-- recipientId resolves to a user_profiles.id (several via a findWithRelations refetch);
-- agent_* tags fill from that profile, domain values ride in context_*.
-- available_variables = agent recipient + common. Idempotent.
--
-- NOT seeded (deferred): invitation.sent — its invitee may have no profile yet, so the
-- recipient semantics need a product decision.

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
    ('invitation.accepted','hierarchy','An invited agent accepts and registers.',
       to_jsonb(agent_vars || common), true),
    ('join_request.created','hierarchy','An agent requests to join a team (notifies the approver).',
       to_jsonb(agent_vars || common), true),
    ('join_request.approved','hierarchy','A join request is approved.',
       to_jsonb(agent_vars || common), true),
    ('join_request.rejected','hierarchy','A join request is rejected.',
       to_jsonb(agent_vars || common), true),
    ('agency_request.created','hierarchy','An agent requests agency status (notifies the approver).',
       to_jsonb(agent_vars || common), true),
    ('agency_request.approved','hierarchy','An agency request is approved and the agency is created.',
       to_jsonb(agent_vars || common), true),
    ('agency_request.rejected','hierarchy','An agency request is rejected.',
       to_jsonb(agent_vars || common), true),
    ('agency.created','hierarchy','A new agency is created (direct/manual creation).',
       to_jsonb(agent_vars || common), true),
    ('agency.ownership_transferred','hierarchy','An agency''s ownership is transferred to a new owner.',
       to_jsonb(agent_vars || common), true)
  ON CONFLICT (event_name) DO UPDATE SET
    category            = EXCLUDED.category,
    description         = EXCLUDED.description,
    available_variables = EXCLUDED.available_variables,
    is_active           = EXCLUDED.is_active;

  -- Keep the registry in lockstep with the active catalog (45 events).
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
    'document.uploaded','document.approved','document.rejected','document.all_required_approved',
    'invitation.accepted','join_request.created','join_request.approved','join_request.rejected',
    'agency_request.created','agency_request.approved','agency_request.rejected',
    'agency.created','agency.ownership_transferred'
  );
END $$;
