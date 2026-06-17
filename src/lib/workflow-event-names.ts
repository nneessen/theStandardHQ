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

  // Custom events
  CUSTOM_TRIGGER: "custom.trigger",
} as const;
