-- Workflows P2 — seed 8 deeper recruit-onboarding trigger events ("recruit" category).
--
-- Emitted by:
--   checklistService.initializeRecruitProgress -> recruit.pipeline_enrolled
--   checklistService.advanceToNextPhase + checkPhaseAutoAdvancement
--       -> recruit.phase_completed (both paths; disjoint RPCs, no double-emit)
--       -> recruit.onboarding_completed (when the final phase completes)
--   checklistService.blockPhase -> recruit.phase_blocked
--   checklistService.updateChecklistItemStatus
--       -> recruit.checklist_item_completed (status='completed' only; document
--          approvals fire document.approved instead)
--       -> recruit.checklist_item_awaiting_approval (in_progress + document_id)
--   checklistResponseService.submitQuizAttempt -> recruit.quiz_passed / recruit.quiz_failed
--
-- recipientId = the recruit's user_profiles.id; recruit_* tags fill from it, domain
-- values ride in context_*. available_variables = recruit recipient + common.
-- Idempotent.
--
-- NOT seeded (deferred): recruit.checklist_item_approved/rejected (redundant — the
-- approve/reject path routes through documentService and fires document.approved/
-- rejected); recruit.invitation_sent (invitee has no profile yet);
-- recruit.invitation_completed (Tier-C edge fn → P3).

DO $$
DECLARE
  common  text[] := ARRAY[
    'user_name','user_first_name','user_last_name','user_email','company_name',
    'current_date','date_today','date_tomorrow','date_current_month',
    'date_current_year','app_url','workflow_name'];
  recruit text[] := ARRAY[
    'recruit_name','recruit_first_name','recruit_last_name','recruit_email',
    'recruit_phone','recruit_status','recruit_city','recruit_state',
    'recruit_contract_level'];
BEGIN
  INSERT INTO public.trigger_event_types
    (event_name, category, description, available_variables, is_active)
  VALUES
    ('recruit.pipeline_enrolled','recruit','A recruit is enrolled into an onboarding pipeline.',
       to_jsonb(recruit || common), true),
    ('recruit.phase_completed','recruit','A recruit completes an onboarding phase.',
       to_jsonb(recruit || common), true),
    ('recruit.phase_blocked','recruit','A recruit''s onboarding phase is marked blocked.',
       to_jsonb(recruit || common), true),
    ('recruit.checklist_item_completed','recruit','A recruit completes an onboarding checklist item.',
       to_jsonb(recruit || common), true),
    ('recruit.checklist_item_awaiting_approval','recruit','A recruit submits a checklist item document for review.',
       to_jsonb(recruit || common), true),
    ('recruit.quiz_passed','recruit','A recruit passes an onboarding quiz.',
       to_jsonb(recruit || common), true),
    ('recruit.quiz_failed','recruit','A recruit fails an onboarding quiz attempt.',
       to_jsonb(recruit || common), true),
    ('recruit.onboarding_completed','recruit','A recruit completes the final onboarding phase.',
       to_jsonb(recruit || common), true)
  ON CONFLICT (event_name) DO UPDATE SET
    category            = EXCLUDED.category,
    description         = EXCLUDED.description,
    available_variables = EXCLUDED.available_variables,
    is_active           = EXCLUDED.is_active;

  -- Keep the registry in lockstep with the active catalog (53 events).
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
