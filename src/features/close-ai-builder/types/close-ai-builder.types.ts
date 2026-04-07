// Types for the Close AI Builder feature.
// Kept in sync with the edge function payloads at supabase/functions/close-ai-builder.

// ─── AI-generated content (before save) ───────────────────────────

export interface GeneratedEmailTemplate {
  name: string;
  subject: string;
  body: string;
}

export interface GeneratedSmsTemplate {
  name: string;
  text: string;
}

export interface GeneratedSequenceStep {
  step_type: "email" | "sms";
  /** 1-indexed day from sequence start (Day 1 = immediate). */
  day: number;
  generated_email?: {
    name: string;
    subject: string;
    body: string;
  };
  generated_sms?: {
    name: string;
    text: string;
  };
  threading?: "new_thread" | "old_thread";
}

export interface GeneratedSequence {
  name: string;
  timezone: string;
  steps: GeneratedSequenceStep[];
  rationale?: string;
}

// ─── Generation options (from UI form) ────────────────────────────

export interface EmailPromptOptions {
  tone?: string;
  length?: "short" | "medium" | "long";
  audience?: string;
  constraints?: string;
}

export interface SmsPromptOptions {
  tone?: string;
  audience?: string;
  maxChars?: number;
  includeStop?: boolean;
  constraints?: string;
}

export interface SequencePromptOptions {
  audience?: string;
  tone?: string;
  totalDays?: number;
  touchCount?: number;
  channels?: Array<"email" | "sms">;
  /** Always "America/New_York" at save time (hardcoded). Sent to AI for copy context only. */
  timezone?: string;
  threading?: "new_thread" | "old_thread";
  /**
   * Annotation of intent — stored in close_ai_generations.options and
   * surfaced in the save banner. NOT a Close API field (Close sequences
   * don't have a run-once vs run-multiple property). See post-save
   * instruction banner for how Nick's team should enforce this in Close UI.
   */
  runMode?: "once" | "multiple";
  constraints?: string;
}

// ─── Edge function responses ──────────────────────────────────────

export interface TokenUsage {
  input: number;
  output: number;
}

export interface EmailGenerationResponse {
  generation_id: string;
  template: GeneratedEmailTemplate;
  model: string;
  tokens: TokenUsage;
}

export interface SmsGenerationResponse {
  generation_id: string;
  template: GeneratedSmsTemplate;
  model: string;
  tokens: TokenUsage;
}

export interface SequenceGenerationResponse {
  generation_id: string;
  sequence: GeneratedSequence;
  model: string;
  tokens: TokenUsage;
}

// ─── Close object shapes (from list + save responses) ─────────────

export interface CloseEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_shared: boolean;
  is_archived: boolean;
  date_created: string;
  date_updated: string;
  organization_id: string;
  created_by: string;
  updated_by: string;
}

export interface CloseSmsTemplate {
  id: string;
  name: string;
  text: string;
  is_shared: boolean;
  status: string;
  date_created: string;
  date_updated: string;
  organization_id: string;
  owned_by: string;
}

export interface CloseSequenceStep {
  id?: string;
  step_type: "email" | "sms";
  delay: number;
  email_template_id: string | null;
  sms_template_id: string | null;
  threading: "new_thread" | "old_thread" | null;
  required?: boolean;
}

export interface CloseSequence {
  id: string;
  name: string;
  timezone: string;
  status: string;
  steps: CloseSequenceStep[];
  trigger_query: string | null;
  allow_manual_enrollment: boolean;
  date_created: string;
  date_updated: string;
  organization_id: string;
  owner_id: string;
}

// ─── Save responses ───────────────────────────────────────────────

export interface SaveEmailTemplateResponse {
  template: CloseEmailTemplate;
}

export interface SaveSmsTemplateResponse {
  template: CloseSmsTemplate;
}

export interface SaveSequenceResponse {
  sequence: CloseSequence;
  created_template_ids: string[];
}

// ─── List responses ───────────────────────────────────────────────
//
// Note: the Library tab endpoints return a ListAllResponse (auto-paginated
// server-side). The older ListResponse shape with has_more is kept for
// future cursor-based UIs but not currently consumed.

export interface ListResponse<T> {
  data: T[];
  has_more: boolean;
}

export interface ListAllResponse<T> {
  /** Every item across all pages (up to safety cap of 2000). */
  data: T[];
  /** Number of items actually returned (equal to data.length). */
  total: number;
  /** True if the safety cap was hit — list is larger than what's shown. */
  truncated: boolean;
  /** How many pages the edge function walked to get here. */
  pages_fetched: number;
}

// ─── Connection ───────────────────────────────────────────────────

export interface ConnectionStatus {
  connected: boolean;
  organization_id: string | null;
  organization_name: string | null;
  last_verified_at: string | null;
}

// ─── Generation history (audit table) ─────────────────────────────

export interface GenerationRecord {
  id: string;
  generation_type: "email" | "sms" | "sequence";
  prompt: string;
  options: Record<string, unknown>;
  output_json:
    | GeneratedEmailTemplate
    | GeneratedSmsTemplate
    | GeneratedSequence;
  model_used: string;
  input_tokens: number | null;
  output_tokens: number | null;
  close_id: string | null;
  close_child_ids: string[] | null;
  saved_at: string | null;
  created_at: string;
}

export interface GenerationsListResponse {
  generations: GenerationRecord[];
}
