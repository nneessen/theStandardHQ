// src/lib/workflow-event-names.ts
//
// Canonical workflow event-name constants. Lives in @/lib (not the services
// layer) so BOTH the emitter (src/services/events/workflowEventEmitter.ts) and
// the workflows feature (src/features/workflows/eventCatalog.ts) can import it
// without crossing the "features must not import @/services" lint boundary.
//
// The emitter re-exports this as WORKFLOW_EVENTS for backward compatibility, so
// existing `import { WORKFLOW_EVENTS } from "@/services/events/workflowEventEmitter"`
// call sites keep working.

export const WORKFLOW_EVENTS = {
  // Recruit events
  RECRUIT_CREATED: "recruit.created",
  RECRUIT_PHASE_CHANGED: "recruit.phase_changed",
  RECRUIT_GRADUATED_TO_AGENT: "recruit.graduated_to_agent",
  RECRUIT_DROPPED_OUT: "recruit.dropped_out",
  RECRUIT_PIPELINE_ENROLLED: "recruit.pipeline_enrolled",
  RECRUIT_PHASE_COMPLETED: "recruit.phase_completed",
  RECRUIT_PHASE_BLOCKED: "recruit.phase_blocked",
  RECRUIT_CHECKLIST_ITEM_COMPLETED: "recruit.checklist_item_completed",
  RECRUIT_CHECKLIST_ITEM_AWAITING_APPROVAL:
    "recruit.checklist_item_awaiting_approval",
  RECRUIT_QUIZ_PASSED: "recruit.quiz_passed",
  RECRUIT_QUIZ_FAILED: "recruit.quiz_failed",
  RECRUIT_ONBOARDING_COMPLETED: "recruit.onboarding_completed",

  // Policy events
  POLICY_CREATED: "policy.created",
  POLICY_APPROVED: "policy.approved",
  POLICY_ACTIVE: "policy.active",
  POLICY_DENIED: "policy.denied",
  POLICY_WITHDRAWN: "policy.withdrawn",
  POLICY_CANCELLED: "policy.cancelled",
  POLICY_LAPSED: "policy.lapsed",
  POLICY_RENEWED: "policy.renewed",
  POLICY_OVER_30_DAYS_NOT_ISSUED: "policy.over_30_days_not_issued",

  // Commission events
  COMMISSION_EARNED: "commission.earned",
  COMMISSION_CHARGEBACK: "commission.chargeback",
  COMMISSION_PAID: "commission.paid",
  COMMISSION_CANCELLED: "commission.cancelled",
  COMMISSION_CHARGEBACK_REVERSED: "commission.chargeback_reversed",
  CHARGEBACK_RESOLVED: "chargeback.resolved",
  OVERRIDE_PAID: "override.paid",

  // Agent lifecycle events (emitted by userService)
  AGENT_APPROVED: "agent.approved",
  AGENT_DENIED: "agent.denied",
  AGENT_LICENSED: "agent.licensed",
  AGENT_CONTRACT_LEVEL_CHANGED: "agent.contract_level_changed",

  // Hierarchy / team / access events
  INVITATION_ACCEPTED: "invitation.accepted",
  JOIN_REQUEST_CREATED: "join_request.created",
  JOIN_REQUEST_APPROVED: "join_request.approved",
  JOIN_REQUEST_REJECTED: "join_request.rejected",
  AGENCY_REQUEST_CREATED: "agency_request.created",
  AGENCY_REQUEST_APPROVED: "agency_request.approved",
  AGENCY_REQUEST_REJECTED: "agency_request.rejected",
  AGENCY_CREATED: "agency.created",
  AGENCY_OWNERSHIP_TRANSFERRED: "agency.ownership_transferred",

  // Client events
  CLIENT_CREATED: "client.created",

  // Underwriting rule-set events
  UNDERWRITING_RULE_SET_SUBMITTED: "underwriting.rule_set_submitted",
  UNDERWRITING_RULE_SET_APPROVED: "underwriting.rule_set_approved",
  UNDERWRITING_RULE_SET_REJECTED: "underwriting.rule_set_rejected",

  // Document events (agent document vault)
  DOCUMENT_UPLOADED: "document.uploaded",
  DOCUMENT_APPROVED: "document.approved",
  DOCUMENT_REJECTED: "document.rejected",
  DOCUMENT_ALL_REQUIRED_APPROVED: "document.all_required_approved",

  // Contracting events (carrier contract requests + carrier status)
  CONTRACTING_REQUEST_CREATED: "contracting.request_created",
  CONTRACTING_REQUEST_WRITING_RECEIVED: "contracting.request_writing_received",
  CONTRACTING_REQUEST_COMPLETED: "contracting.request_completed",
  CONTRACTING_CARRIER_SUBMITTED: "contracting.carrier_submitted",
  CONTRACTING_CARRIER_APPROVED: "contracting.carrier_approved",
  CONTRACTING_CARRIER_DENIED: "contracting.carrier_denied",
  CONTRACTING_CARRIER_TERMINATED: "contracting.carrier_terminated",
  CONTRACTING_HELD_UNDER_SET: "contracting.held_under_set",

  // User events
  USER_LOGIN: "user.login",
  USER_LOGOUT: "user.logout",
  USER_ROLE_CHANGED: "user.role_changed",

  // Email events
  EMAIL_SENT: "email.sent",
  EMAIL_FAILED: "email.failed",
  EMAIL_BOUNCED: "email.bounced",

  // Lead events
  LEAD_PACK_PURCHASED: "lead.pack_purchased",
  LEAD_CONVERSION_THRESHOLD: "lead.conversion_threshold",
  LEAD_ACCEPTED: "lead.accepted",
  LEAD_REJECTED: "lead.rejected",
  LEAD_PACK_ROI_UPDATED: "lead_pack.roi_updated",
  PROSPECT_CONVERTED: "prospect.converted",
  PROSPECT_STATUS_CHANGED: "prospect.status_changed",
  INSTAGRAM_LEAD_CREATED: "instagram.lead_created",

  // Custom events
  CUSTOM_TRIGGER: "custom.trigger",
} as const;
