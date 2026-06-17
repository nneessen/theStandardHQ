-- Workflows P2 — seed 7 training trigger events (new "training" category).
--
-- Emitted by the training-modules + agent-roadmap services:
--   trainingAssignmentService.create        -> training.assignment_created
--                                              (individual assignments only; assigned_to != null)
--   trainingProgressService.completeLesson  -> training.lesson_completed (recipient = auth.uid)
--   trainingQuizService.submitAttempt        -> training.quiz_passed / training.quiz_failed
--                                              (mutually exclusive on result.passed; recipient = auth.uid)
--   presentationSubmissionService.submit     -> training.presentation_submitted (recipient = submitter)
--   presentationSubmissionService.review     -> training.presentation_approved (status='approved';
--                                              recipient = submission owner, not the reviewer)
--   roadmapProgressService.upsertProgress    -> training.roadmap_item_completed
--                                              (capture-before-mutate; only on a real ->completed transition)
--
-- recipientId = a user_profiles.id; agent_* tags fill from it, domain values ride in
-- context_*. available_variables = agent recipient + common. Idempotent.
--
-- NOT seeded (deferred): training.certification_awarded (Tier-C, P3) and
-- training.roadmap_completed (Tier-D derived, P4).

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
    ('training.assignment_created','training','A training module is assigned to an agent.',
       to_jsonb(agent_vars || common), true),
    ('training.lesson_completed','training','An agent completes a training lesson.',
       to_jsonb(agent_vars || common), true),
    ('training.quiz_passed','training','An agent passes a training-module quiz.',
       to_jsonb(agent_vars || common), true),
    ('training.quiz_failed','training','An agent fails a training-module quiz attempt.',
       to_jsonb(agent_vars || common), true),
    ('training.presentation_submitted','training','An agent submits a weekly presentation recording.',
       to_jsonb(agent_vars || common), true),
    ('training.presentation_approved','training','A submitted presentation is approved by a manager.',
       to_jsonb(agent_vars || common), true),
    ('training.roadmap_item_completed','training','An agent marks an agent-roadmap item complete.',
       to_jsonb(agent_vars || common), true)
  ON CONFLICT (event_name) DO UPDATE SET
    category            = EXCLUDED.category,
    description         = EXCLUDED.description,
    available_variables = EXCLUDED.available_variables,
    is_active           = EXCLUDED.is_active;

  -- Keep the registry in lockstep with the active catalog (70 events).
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
    'underwriting.rule_set_approved','underwriting.rule_set_rejected',
    'training.assignment_created','training.lesson_completed',
    'training.quiz_passed','training.quiz_failed',
    'training.presentation_submitted','training.presentation_approved',
    'training.roadmap_item_completed'
  );
END $$;
