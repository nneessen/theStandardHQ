-- Workflows P2 — seed 6 leads/prospects trigger events ("lead" category).
--
-- Emitted by:
--   leadsService.acceptLead / rejectLead       -> lead.accepted / lead.rejected
--                                                 (recipient = the authenticated recruiter)
--   LeadPurchaseService.updateRoi              -> lead_pack.roi_updated (recipient = owning agent)
--   prospectService.updateProspect            -> prospect.converted / prospect.status_changed
--                                                 (mutually exclusive on patch.status; recipient = owner_id)
--   instagramService.createLeadFromConversation -> instagram.lead_created (recipient = userId param)
--
-- recipientId = a user_profiles.id; recruit_* recipient tags fill from it, domain
-- values ride in context_*. available_variables mirrors the existing lead.* row.
-- Idempotent.
--
-- NOT seeded (deferred): lead.submitted — fires from a PUBLIC (unauthenticated) page,
-- so it can't emit through the JWT-gated client emitter; needs a server-side/Tier-D path.

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
    ('lead.accepted','lead','A recruiter accepts an inbound recruiting lead.',
       to_jsonb(agent || common), true),
    ('lead.rejected','lead','A recruiter rejects an inbound recruiting lead.',
       to_jsonb(agent || common), true),
    ('lead_pack.roi_updated','lead','An agent updates the ROI (policies/commission) on a lead pack.',
       to_jsonb(agent || common), true),
    ('prospect.converted','lead','A prospect is marked converted.',
       to_jsonb(agent || common), true),
    ('prospect.status_changed','lead','A prospect''s follow-up status changes.',
       to_jsonb(agent || common), true),
    ('instagram.lead_created','lead','A recruiting lead is created from an Instagram conversation.',
       to_jsonb(agent || common), true)
  ON CONFLICT (event_name) DO UPDATE SET
    category            = EXCLUDED.category,
    description         = EXCLUDED.description,
    available_variables = EXCLUDED.available_variables,
    is_active           = EXCLUDED.is_active;

  -- Keep the registry in lockstep with the active catalog (59 events).
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
    'agency.created','agency.ownership_transferred'
  );
END $$;
