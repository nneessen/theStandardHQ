// supabase/functions/_shared/templateVariables.ts
// Server-side template variable utilities for Deno edge functions.
// Mirrors src/lib/templateVariables.ts — kept in sync manually since
// edge functions cannot import from the src/ directory.

/** All valid template variable keys (must stay in sync with src/lib/templateVariables.ts) */
export const TEMPLATE_VARIABLE_KEYS: readonly string[] = [
  // Recruit Basic
  "recruit_name",
  "recruit_first_name",
  "recruit_last_name",
  "recruit_email",
  "recruit_phone",
  "recruit_status",
  // Recruit Location
  "recruit_city",
  "recruit_state",
  "recruit_zip",
  "recruit_address",
  // Recruit Professional
  "recruit_contract_level",
  "recruit_npn",
  "recruit_license_number",
  "recruit_license_expiration",
  "recruit_license_state",
  "recruit_referral_source",
  "contract_level",
  // Recruit Social
  "recruit_facebook",
  "recruit_instagram",
  "recruit_website",
  // Organization
  "company_name",
  "agency_name",
  "imo_name",
  // User/Owner
  "user_name",
  "user_first_name",
  "user_last_name",
  "user_email",
  // Agent (affected agent of an agent.* lifecycle event)
  "agent_name",
  "agent_first_name",
  "agent_email",
  "agent_contract_level",
  "agent_license_number",
  "agent_npn",
  "agent_status",
  // Upline
  "upline_name",
  "upline_first_name",
  "upline_email",
  "upline_phone",
  // Pipeline
  "phase_name",
  "phase_description",
  "template_name",
  "item_name",
  "checklist_items",
  // Sender
  "sender_name",
  "recruiter_name",
  // Dates
  "current_date",
  "date_today",
  "date_tomorrow",
  "date_next_week",
  "date_current_month",
  "date_current_year",
  "deadline_date",
  // Calculated
  "days_in_phase",
  "days_since_signup",
  // Links
  "portal_link",
  "app_url",
  // Workflow
  "workflow_name",
  "workflow_run_id",
];

/**
 * Returns a Record<string, string> with every known variable key set to "".
 * Use as a starting point to prevent raw {{tags}} in output.
 */
export function initEmptyVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of TEMPLATE_VARIABLE_KEYS) {
    vars[key] = "";
  }
  return vars;
}

/** Output context for substitution — controls how injected values are sanitized. */
export type TemplateRenderMode = "html" | "text" | "subject";

/** HTML-entity-encode a value so DB-sourced data can't inject markup/script into body_html. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Remove CR / LF / TAB to prevent email-header (CRLF) injection in subjects.
 * Spaces, hyphens and other printable punctuation are preserved.
 */
function sanitizeHeaderValue(value: string): string {
  return value
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

function sanitizeValue(value: string, mode: TemplateRenderMode): string {
  if (mode === "html") return escapeHtml(value);
  if (mode === "subject") return sanitizeHeaderValue(value);
  return value;
}

/**
 * Standardized template variable replacement for edge functions.
 * - Case-insensitive, whitespace-tolerant: matches {{ key }}, {{key}}, etc.
 * - Also supports single-brace {key} for backward compatibility.
 * - `mode` controls sanitization of the injected values (NOT the template itself):
 *   "html" HTML-escapes values (XSS-safe body_html); "subject" strips CRLF
 *   (header-injection-safe); "text" leaves values as-is (default; plain text).
 */
export function replaceTemplateVariables(
  text: string,
  variables: Record<string, string>,
  mode: TemplateRenderMode = "text",
): string {
  let result = text;

  for (const [key, rawValue] of Object.entries(variables)) {
    const value = sanitizeValue(rawValue ?? "", mode);
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Use a replacement FUNCTION (not the raw string) so "$&", "$`", "$'", "$$"
    // sequences in DB-sourced values are inserted literally rather than being
    // interpreted as String.replace special patterns (which would mangle output
    // or splice in surrounding text).
    const replaceWithValue = () => value;

    // Double-brace {{variable}} — primary format
    const doubleBrace = new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, "gi");
    result = result.replace(doubleBrace, replaceWithValue);

    // Single-brace {variable} — backward compat
    const singleBrace = new RegExp(`\\{\\s*${escaped}\\s*\\}`, "gi");
    result = result.replace(singleBrace, replaceWithValue);
  }

  // Final guard for subjects: collapse any residual newlines from the template body.
  return mode === "subject" ? sanitizeHeaderValue(result) : result;
}
