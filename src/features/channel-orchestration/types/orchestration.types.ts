// src/features/channel-orchestration/types/orchestration.types.ts
// TypeScript interfaces for the channel orchestration API

// ─── Helper Types ──────────────────────────────────────────────

export type ChannelType = "sms" | "voice";

export type ConversationStatus =
  | "open"
  | "awaiting_reply"
  | "scheduling"
  | "scheduled"
  | "stale";

export type ComparisonOperator = "eq" | "gt" | "gte" | "lt" | "lte";

export type CustomFieldOperator = "eq" | "neq" | "contains" | "not_empty";

export type TranscriptFormat =
  | "full_transcript"
  | "summary_only"
  | "summary_with_highlights";

export type VoiceOutcome =
  | "answered"
  | "voicemail"
  | "no_answer"
  | "busy"
  | "error";

export type WritebackEvent =
  | "voice_call_answered"
  | "voice_call_voicemail"
  | "voice_call_no_answer"
  | "voice_call_busy"
  | "appointment_booked"
  | "appointment_completed"
  | "appointment_no_show"
  | "appointment_cancelled";

export const WRITEBACK_EVENTS: { value: WritebackEvent; label: string }[] = [
  { value: "voice_call_answered", label: "Voice Call Answered" },
  { value: "voice_call_voicemail", label: "Voice Call Voicemail" },
  { value: "voice_call_no_answer", label: "Voice Call No Answer" },
  { value: "voice_call_busy", label: "Voice Call Busy" },
  { value: "appointment_booked", label: "Appointment Booked" },
  { value: "appointment_completed", label: "Appointment Completed" },
  { value: "appointment_no_show", label: "Appointment No-Show" },
  { value: "appointment_cancelled", label: "Appointment Cancelled" },
];

export const CONVERSATION_STATUSES: {
  value: ConversationStatus;
  label: string;
}[] = [
  { value: "open", label: "Open" },
  { value: "awaiting_reply", label: "Awaiting Reply" },
  { value: "scheduling", label: "Scheduling" },
  { value: "scheduled", label: "Scheduled" },
  { value: "stale", label: "Stale" },
];

export const VOICE_OUTCOMES: { value: string; label: string }[] = [
  { value: "answered", label: "Answered" },
  { value: "voicemail", label: "Voicemail" },
  { value: "no_answer", label: "No Answer" },
  { value: "busy", label: "Busy" },
];

// ─── Orchestration Rules ───────────────────────────────────────

export interface ChannelHistoryCondition {
  smsAttempts?: { operator: ComparisonOperator; value: number };
  voiceAttempts?: { operator: ComparisonOperator; value: number };
  lastSmsAgeMinutes?: { operator: ComparisonOperator; value: number };
  lastVoiceAgeMinutes?: { operator: ComparisonOperator; value: number };
  lastVoiceOutcome?: string[];
}

export interface CustomFieldCondition {
  fieldKey: string;
  operator: CustomFieldOperator;
  value?: string;
}

export interface TimeWindow {
  startTime: string; // "HH:mm" (24hr)
  endTime: string; // "HH:mm" (24hr)
  days: number[]; // 0=Sun, 6=Sat
  timezone: string; // IANA e.g. "America/New_York"
}

export interface RuleConditions {
  leadStatuses?: string[];
  leadSources?: string[];
  conversationStatuses?: ConversationStatus[];
  timeWindow?: TimeWindow | null;
  customFieldConditions?: CustomFieldCondition[];
  channelHistory?: ChannelHistoryCondition;
}

export interface EscalationConfig {
  channel: ChannelType;
  attempts: number; // 1-20
  escalateTo: ChannelType;
}

export interface RuleAction {
  allowedChannels: ChannelType[];
  preferredChannel?: ChannelType;
  cooldownMinutes?: number | null; // 0-10080
  escalateAfter?: EscalationConfig;
}

export interface FallbackAction {
  allowedChannels: ChannelType[];
  preferredChannel: ChannelType;
}

export interface OrchestrationRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RuleConditions;
  action: RuleAction;
}

export interface OrchestrationRuleset {
  id: string;
  agentId: string;
  name: string;
  isActive: boolean;
  rules: OrchestrationRule[];
  fallbackAction: FallbackAction;
  templateKey: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Templates ─────────────────────────────────────────────────

export interface OrchestrationTemplate {
  id: string;
  name: string;
  description: string;
  ruleCount: number;
  tags: string[];
}

export interface OrchestrationTemplatePreview {
  id: string;
  name: string;
  description: string;
  tags: string[];
  rules: OrchestrationRule[];
  fallbackAction: FallbackAction;
}

// ─── Evaluation ────────────────────────────────────────────────

export interface EvaluationContext {
  leadStatus?: string;
  leadSource?: string;
  conversationStatus?: ConversationStatus;
  channel?: ChannelType;
  evaluateAt?: string; // ISO-8601
}

export interface OrchestrationDecision {
  allowed: boolean;
  allowedChannels: ChannelType[];
  preferredChannel: ChannelType;
  matchedRuleId: string | null;
  matchedRuleName: string | null;
  reason: string;
  cooldownUntil: string | null;
}

// ─── Post-Call Config ──────────────────────────────────────────

export interface StatusMapping {
  event: string;
  statusLabel: string;
}

export interface CustomFieldMapping {
  event: string;
  fieldName: string;
  valueTemplate: string;
}

export interface PostCallConfig {
  statusMapping: {
    enabled: boolean;
    mappings: StatusMapping[];
  };
  customFieldMapping: {
    enabled: boolean;
    mappings: CustomFieldMapping[];
  };
  transcriptWriteback: {
    enabled: boolean;
    autoWriteback: boolean;
    format: TranscriptFormat;
    includeRecordingLink: boolean;
  };
}

// ─── Voice Sessions ────────────────────────────────────────────

export interface VoiceSession {
  id: string;
  agentId: string;
  conversationId: string | null;
  closeLeadId: string | null;
  outcome: VoiceOutcome | null;
  workflowType: string;
  durationMs: number | null;
  startedAt: string | null;
  endedAt: string | null;
  transcript: { role: string; content: string }[] | null;
  summary: string | null;
  recordingUrl: string | null;
  createdAt: string;
}

export interface VoiceSessionListResponse {
  items: VoiceSession[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface WritebackResult {
  written: boolean;
  closeActivityId: string;
  format: TranscriptFormat;
}

// ─── Close CRM Data (for dropdowns) ───────────────────────────

export interface CloseLeadSource {
  id: string;
  label: string;
}

export interface CloseCustomField {
  key: string;
  name: string;
  type: string;
}

export interface CloseSmartView {
  id: string;
  name: string;
}

// ─── Mutation Payloads ─────────────────────────────────────────

export interface CreateRulePayload {
  name: string;
  enabled?: boolean;
  conditions: RuleConditions;
  action: RuleAction;
}

export interface UpdateRulePayload {
  ruleId: string;
  patch: {
    name?: string;
    enabled?: boolean;
    conditions?: RuleConditions;
    action?: RuleAction;
  };
}

export interface CreateOrUpdateRulesetPayload {
  name?: string;
  isActive?: boolean;
  rules: CreateRulePayload[];
  fallbackAction?: FallbackAction;
}

export interface ApplyTemplatePayload {
  templateKey: string;
  mode: "replace" | "append";
}
