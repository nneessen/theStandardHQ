// Typed Close API helpers for email templates, SMS templates, and sequences.
// Shapes verified against live API — see ./README.md for the authoritative schema.
// All template creates hard-code is_shared: true because sequences cannot
// reference private templates (verified error:
//   "Template ... cannot be used in Workflows because it is not shared.")

import { closeDelete, closeGet, closePost, closePut } from "./client.ts";

// ─── Email Template ────────────────────────────────────────────────

export interface CloseEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_shared: boolean;
  is_archived: boolean;
  organization_id: string;
  created_by: string;
  updated_by: string;
  date_created: string;
  date_updated: string;
  attachments: unknown[];
  bcc: unknown[];
  cc: unknown[];
  last_used_at: string | null;
  last_used_by: string | null;
  last_used_type: string | null;
  unsubscribe_link_id: string | null;
}

export interface CreateEmailTemplateInput {
  name: string;
  subject: string;
  body: string;
}

/** Always creates with is_shared: true so the template can be used in sequences. */
export function createEmailTemplate(
  apiKey: string,
  input: CreateEmailTemplateInput,
): Promise<CloseEmailTemplate> {
  return closePost<CloseEmailTemplate>(apiKey, "/email_template/", {
    name: input.name,
    subject: input.subject,
    body: input.body,
    is_shared: true,
  });
}

export function getEmailTemplate(
  apiKey: string,
  id: string,
): Promise<CloseEmailTemplate> {
  return closeGet<CloseEmailTemplate>(apiKey, `/email_template/${id}/`);
}

export function listEmailTemplates(
  apiKey: string,
  params?: { limit?: number; skip?: number },
): Promise<{ data: CloseEmailTemplate[]; has_more: boolean }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("_limit", String(params.limit));
  if (params?.skip) qs.set("_skip", String(params.skip));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return closeGet(apiKey, `/email_template/${suffix}`);
}

export function updateEmailTemplate(
  apiKey: string,
  id: string,
  patch: Partial<CreateEmailTemplateInput>,
): Promise<CloseEmailTemplate> {
  return closePut<CloseEmailTemplate>(
    apiKey,
    `/email_template/${id}/`,
    patch as Record<string, unknown>,
  );
}

export function deleteEmailTemplate(apiKey: string, id: string): Promise<void> {
  return closeDelete(apiKey, `/email_template/${id}/`);
}

// ─── SMS Template ──────────────────────────────────────────────────

export interface CloseSmsTemplate {
  id: string;
  name: string;
  text: string;
  is_shared: boolean;
  status: string;
  organization_id: string;
  owned_by: string;
  created_by: string;
  updated_by: string;
  date_created: string;
  date_updated: string;
  attachments: unknown[];
  last_used_at: string | null;
  last_used_by: string | null;
  last_used_type: string | null;
}

export interface CreateSmsTemplateInput {
  name: string;
  text: string;
}

/** Always creates with is_shared: true so the template can be used in sequences. */
export function createSmsTemplate(
  apiKey: string,
  input: CreateSmsTemplateInput,
): Promise<CloseSmsTemplate> {
  return closePost<CloseSmsTemplate>(apiKey, "/sms_template/", {
    name: input.name,
    text: input.text,
    is_shared: true,
  });
}

export function getSmsTemplate(
  apiKey: string,
  id: string,
): Promise<CloseSmsTemplate> {
  return closeGet<CloseSmsTemplate>(apiKey, `/sms_template/${id}/`);
}

export function listSmsTemplates(
  apiKey: string,
  params?: { limit?: number; skip?: number },
): Promise<{ data: CloseSmsTemplate[]; has_more: boolean }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("_limit", String(params.limit));
  if (params?.skip) qs.set("_skip", String(params.skip));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return closeGet(apiKey, `/sms_template/${suffix}`);
}

export function updateSmsTemplate(
  apiKey: string,
  id: string,
  patch: Partial<CreateSmsTemplateInput>,
): Promise<CloseSmsTemplate> {
  return closePut<CloseSmsTemplate>(
    apiKey,
    `/sms_template/${id}/`,
    patch as Record<string, unknown>,
  );
}

export function deleteSmsTemplate(apiKey: string, id: string): Promise<void> {
  return closeDelete(apiKey, `/sms_template/${id}/`);
}

// ─── Sequence (Workflow in Close UI) ───────────────────────────────

export type SequenceStepType = "email" | "sms";

export interface CloseSequenceStep {
  id?: string;
  step_type: SequenceStepType;
  /** Seconds SINCE THE PREVIOUS STEP (NOT from sequence start). Verified live. */
  delay: number;
  email_template_id: string | null;
  sms_template_id: string | null;
  /** "new_thread" | "old_thread" — email steps only, null on SMS. */
  threading: "new_thread" | "old_thread" | null;
  required?: boolean;
  step_allowed_delay?: number | null;
}

/**
 * Fixed business-hour schedule for ALL generated sequences:
 *   Mon-Sat 08:00-20:00 America/New_York (8am-8pm EST/EDT)
 *   Sunday: off (weekday omitted from ranges)
 *
 * Verified live with Close API on 2026-04-07: weekdays 1-6 with start/end
 * "HH:MM" values are accepted and echoed back as "HH:MM:SS". No Sundays.
 *
 * Why hardcoded: product requirement — this is Nick's team's operating
 * window and should apply to every workflow they generate. Avoids per-user
 * misconfiguration. If that changes, this constant is the single source.
 */
export const FIXED_SEQUENCE_SCHEDULE = {
  ranges: [
    { weekday: 1, start: "08:00", end: "20:00" }, // Monday
    { weekday: 2, start: "08:00", end: "20:00" }, // Tuesday
    { weekday: 3, start: "08:00", end: "20:00" }, // Wednesday
    { weekday: 4, start: "08:00", end: "20:00" }, // Thursday
    { weekday: 5, start: "08:00", end: "20:00" }, // Friday
    { weekday: 6, start: "08:00", end: "20:00" }, // Saturday
    // weekday 7 (Sunday) intentionally omitted → sequence stops on Sundays
  ],
} as const;

export const FIXED_SEQUENCE_TIMEZONE = "America/New_York";

export interface CloseSequence {
  id: string;
  name: string;
  timezone: string;
  status: string;
  schedule: unknown | null;
  schedule_id: string | null;
  trigger_query: string | null;
  allow_manual_enrollment: boolean;
  organization_id: string;
  owner_id: string;
  created_by_id: string;
  updated_by_id: string;
  date_created: string;
  date_updated: string;
  steps: CloseSequenceStep[];
}

export interface CreateSequenceInput {
  name: string;
  steps: CloseSequenceStep[];
  /**
   * IANA timezone. Ignored — we always force FIXED_SEQUENCE_TIMEZONE so
   * every generated workflow runs on the same operating window. Kept on the
   * input shape only to match Close's required field for future flexibility.
   */
  timezone?: string;
}

export function createSequence(
  apiKey: string,
  input: CreateSequenceInput,
): Promise<CloseSequence> {
  // Normalize steps: strip undefined and scrub SMS-step fields that Close nulls anyway.
  const cleanSteps = input.steps.map((s) => {
    if (s.step_type === "email") {
      return {
        step_type: "email" as const,
        delay: s.delay,
        email_template_id: s.email_template_id,
        threading: s.threading ?? "new_thread",
      };
    }
    return {
      step_type: "sms" as const,
      delay: s.delay,
      sms_template_id: s.sms_template_id,
    };
  });

  return closePost<CloseSequence>(apiKey, "/sequence/", {
    name: input.name,
    // Hardcoded: always use the fixed team operating window. See FIXED_*
    // constants above for rationale.
    timezone: FIXED_SEQUENCE_TIMEZONE,
    schedule: FIXED_SEQUENCE_SCHEDULE,
    steps: cleanSteps,
  });
}

export function getSequence(
  apiKey: string,
  id: string,
): Promise<CloseSequence> {
  return closeGet<CloseSequence>(apiKey, `/sequence/${id}/`);
}

export function listSequences(
  apiKey: string,
  params?: { limit?: number; skip?: number },
): Promise<{ data: CloseSequence[]; has_more: boolean }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("_limit", String(params.limit));
  if (params?.skip) qs.set("_skip", String(params.skip));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return closeGet(apiKey, `/sequence/${suffix}`);
}

export function deleteSequence(apiKey: string, id: string): Promise<void> {
  return closeDelete(apiKey, `/sequence/${id}/`);
}
