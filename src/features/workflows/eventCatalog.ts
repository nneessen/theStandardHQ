// src/features/workflows/eventCatalog.ts
//
// CANONICAL catalog of workflow trigger events — the single source of truth that
// reconciles three things that used to drift apart:
//   1. WORKFLOW_EVENTS constants (what the app emits)        — workflowEventEmitter.ts
//   2. trigger_event_types rows (what the picker offers)     — seeded by migration
//   3. the per-event dynamic template-tag list               — availableVariables
//
// RULE: an event is `active` (selectable in the wizard + shown in the manager tab)
// ONLY if app/server code actually emits it. Events that are declared but not yet
// wired stay `active: false` so they can't become "dead triggers" a user can pick
// but that never fire. When emission is added for one, flip it to `active: true`
// AND add it to the seed migration in the same change. The drift test
// (eventCatalog.test.ts) fails CI if the catalog and WORKFLOW_EVENTS diverge or if
// an availableVariables key is not a real template variable.

import { WORKFLOW_EVENTS } from "@/lib/workflow-event-names";

export type WorkflowEventCategory =
  | "recruit"
  | "policy"
  | "commission"
  | "lead"
  | "agent";

export interface WorkflowEventDef {
  /** Dot-namespaced event key, e.g. "recruit.created". */
  eventName: string;
  category: WorkflowEventCategory | "user" | "email" | "system";
  label: string;
  description: string;
  /** Template-variable keys relevant to this event (drives event-aware tags). */
  availableVariables: string[];
  /** True only if the event is actually emitted today (selectable in the UI). */
  active: boolean;
}

// Shared variable groups. Every key MUST (a) exist in TEMPLATE_VARIABLE_KEYS AND
// (b) actually be populated by buildTemplateVariables() in process-workflow — we
// do not advertise tags that render empty. (portal_link / phase_* are NOT filled
// yet; they'll be re-added when their population lands in Phase 3.)
const COMMON = [
  "user_name",
  "user_first_name",
  "user_last_name",
  "user_email",
  "company_name",
  "current_date",
  "date_today",
  "date_tomorrow",
  "date_current_month",
  "date_current_year",
  "app_url",
  "workflow_name",
];

const RECRUIT = [
  "recruit_name",
  "recruit_first_name",
  "recruit_last_name",
  "recruit_email",
  "recruit_phone",
  "recruit_status",
  "recruit_city",
  "recruit_state",
  "recruit_contract_level",
];

// The "affected agent" of a policy/commission/lead event is rendered through the
// recruit_* recipient variables today (buildTemplateVariables fills them from the
// recipient profile). Domain-specific policy_*/commission_* tags are a Phase 3 add.
const AGENT = ["recruit_name", "recruit_first_name", "recruit_email"];

// Agent LIFECYCLE events carry the affected agent's OWN profile (the emit sets
// recipientId = the agent's user_profiles.id). buildTemplateVariables populates
// these agent_* keys from that recipient profile.
const AGENT_VARS = [
  "agent_name",
  "agent_first_name",
  "agent_email",
  "agent_contract_level",
  "agent_license_number",
  "agent_npn",
  "agent_status",
];

export const WORKFLOW_EVENT_CATALOG: WorkflowEventDef[] = [
  // ---- Recruit (emitted by recruitingService) ----
  {
    eventName: WORKFLOW_EVENTS.RECRUIT_CREATED,
    category: "recruit",
    label: "Recruit created",
    description: "A new recruit is added to a pipeline.",
    availableVariables: [...RECRUIT, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.RECRUIT_PHASE_CHANGED,
    category: "recruit",
    label: "Recruit phase changed",
    description: "A recruit advances to a new onboarding phase.",
    // phase_name/phase_description/days_in_phase are not populated by the engine
    // yet (Phase 3) — omitted so we don't advertise empty tags.
    availableVariables: [...RECRUIT, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.RECRUIT_GRADUATED_TO_AGENT,
    category: "recruit",
    label: "Recruit graduated to agent",
    description: "A recruit completes onboarding and becomes a licensed agent.",
    availableVariables: [...RECRUIT, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.RECRUIT_DROPPED_OUT,
    category: "recruit",
    label: "Recruit dropped out",
    description: "A recruit is marked as dropped from the pipeline.",
    availableVariables: [...RECRUIT, ...COMMON],
    active: true,
  },
  // ---- Policy (emitted by policyService) ----
  {
    eventName: WORKFLOW_EVENTS.POLICY_CREATED,
    category: "policy",
    label: "Policy created",
    description: "A new policy is written.",
    availableVariables: [...AGENT, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.POLICY_APPROVED,
    category: "policy",
    label: "Policy approved",
    description: "A policy application is approved by the carrier.",
    availableVariables: [...AGENT, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.POLICY_ACTIVE,
    category: "policy",
    label: "Policy active",
    description: "A policy becomes active (in force).",
    availableVariables: [...AGENT, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.POLICY_DENIED,
    category: "policy",
    label: "Policy denied",
    description: "A policy application is denied.",
    availableVariables: [...AGENT, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.POLICY_WITHDRAWN,
    category: "policy",
    label: "Policy withdrawn",
    description: "A policy application is withdrawn.",
    availableVariables: [...AGENT, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.POLICY_CANCELLED,
    category: "policy",
    label: "Policy cancelled",
    description: "A policy is cancelled.",
    availableVariables: [...AGENT, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.POLICY_LAPSED,
    category: "policy",
    label: "Policy lapsed",
    description: "A policy lapses (e.g. non-payment).",
    availableVariables: [...AGENT, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.POLICY_RENEWED,
    category: "policy",
    label: "Policy renewed",
    description: "A policy renews for another term.",
    availableVariables: [...AGENT, ...COMMON],
    active: true,
  },
  // ---- Commission (emitted by CommissionCRUDService / chargebackService) ----
  {
    eventName: WORKFLOW_EVENTS.COMMISSION_EARNED,
    category: "commission",
    label: "Commission earned",
    description: "A commission is recorded as earned.",
    availableVariables: [...AGENT, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.COMMISSION_PAID,
    category: "commission",
    label: "Commission paid",
    description: "A commission is marked paid out.",
    availableVariables: [...AGENT, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.COMMISSION_CHARGEBACK,
    category: "commission",
    label: "Commission chargeback",
    description: "A previously paid commission is charged back.",
    availableVariables: [...AGENT, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.COMMISSION_CANCELLED,
    category: "commission",
    label: "Commission cancelled",
    description: "A commission is cancelled.",
    availableVariables: [...AGENT, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.COMMISSION_CHARGEBACK_REVERSED,
    category: "commission",
    label: "Commission chargeback reversed",
    description: "A charged-back commission is restored to earned.",
    availableVariables: [...AGENT, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.CHARGEBACK_RESOLVED,
    category: "commission",
    label: "Chargeback resolved",
    description: "A chargeback is marked resolved.",
    availableVariables: [...AGENT, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.OVERRIDE_PAID,
    category: "commission",
    label: "Override paid",
    description: "An override commission is paid out to an upline agent.",
    availableVariables: [...AGENT, ...COMMON],
    active: true,
  },
  // ---- Lead (emitted by LeadPurchaseService) ----
  {
    eventName: WORKFLOW_EVENTS.LEAD_PACK_PURCHASED,
    category: "lead",
    label: "Lead pack purchased",
    description: "An agent purchases a pack of leads.",
    availableVariables: [...AGENT, ...COMMON],
    active: true,
  },

  // ---- Agent lifecycle (emitted by userService) ----
  {
    eventName: WORKFLOW_EVENTS.AGENT_APPROVED,
    category: "agent",
    label: "Agent approved",
    description: "An agent's account is approved into the system.",
    availableVariables: [...AGENT_VARS, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.AGENT_DENIED,
    category: "agent",
    label: "Agent denied",
    description: "An agent's account request is denied.",
    availableVariables: [...AGENT_VARS, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.AGENT_LICENSED,
    category: "agent",
    label: "Agent licensed",
    description: "A recruit graduates and becomes a licensed agent.",
    availableVariables: [...AGENT_VARS, ...COMMON],
    active: true,
  },
  {
    eventName: WORKFLOW_EVENTS.AGENT_CONTRACT_LEVEL_CHANGED,
    category: "agent",
    label: "Agent contract level changed",
    description: "An agent's commission contract level is changed.",
    availableVariables: [...AGENT_VARS, ...COMMON],
    active: true,
  },

  // ---- Declared but NOT yet emitted (kept out of the picker until wired) ----
  {
    eventName: WORKFLOW_EVENTS.POLICY_OVER_30_DAYS_NOT_ISSUED,
    category: "policy",
    label: "Policy not issued in 30 days",
    description: "Reserved — not yet emitted.",
    availableVariables: [],
    active: false,
  },
  {
    eventName: WORKFLOW_EVENTS.USER_LOGIN,
    category: "user",
    label: "User login",
    description: "Reserved — not yet emitted.",
    availableVariables: [],
    active: false,
  },
  {
    eventName: WORKFLOW_EVENTS.USER_LOGOUT,
    category: "user",
    label: "User logout",
    description: "Reserved — not yet emitted.",
    availableVariables: [],
    active: false,
  },
  {
    eventName: WORKFLOW_EVENTS.USER_ROLE_CHANGED,
    category: "user",
    label: "User role changed",
    description: "Reserved — not yet emitted.",
    availableVariables: [],
    active: false,
  },
  {
    eventName: WORKFLOW_EVENTS.EMAIL_SENT,
    category: "email",
    label: "Email sent",
    description: "Reserved — not yet emitted.",
    availableVariables: [],
    active: false,
  },
  {
    eventName: WORKFLOW_EVENTS.EMAIL_FAILED,
    category: "email",
    label: "Email failed",
    description: "Reserved — not yet emitted.",
    availableVariables: [],
    active: false,
  },
  {
    eventName: WORKFLOW_EVENTS.EMAIL_BOUNCED,
    category: "email",
    label: "Email bounced",
    description: "Reserved — not yet emitted.",
    availableVariables: [],
    active: false,
  },
  {
    eventName: WORKFLOW_EVENTS.LEAD_CONVERSION_THRESHOLD,
    category: "lead",
    label: "Lead conversion threshold",
    description: "Reserved — not yet emitted.",
    availableVariables: [],
    active: false,
  },
  {
    eventName: WORKFLOW_EVENTS.CUSTOM_TRIGGER,
    category: "system",
    label: "Custom trigger",
    description: "Reserved — not yet emitted.",
    availableVariables: [],
    active: false,
  },
];

/** Events that are actually emitted and therefore selectable in the UI. */
export const ACTIVE_WORKFLOW_EVENTS: WorkflowEventDef[] =
  WORKFLOW_EVENT_CATALOG.filter((e) => e.active);

/** Distinct categories used by active events (drives the picker/tab category list). */
export const ACTIVE_EVENT_CATEGORIES: string[] = [
  ...new Set(ACTIVE_WORKFLOW_EVENTS.map((e) => e.category)),
];

export function getEventDef(eventName: string): WorkflowEventDef | undefined {
  return WORKFLOW_EVENT_CATALOG.find((e) => e.eventName === eventName);
}

/** Template-variable keys for an event (falls back to none for unknown events). */
export function getEventVariables(eventName: string): string[] {
  return getEventDef(eventName)?.availableVariables ?? [];
}
