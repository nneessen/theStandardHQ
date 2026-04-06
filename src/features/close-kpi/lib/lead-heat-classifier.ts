// src/features/close-kpi/lib/lead-heat-classifier.ts
//
// Pure TypeScript mirror of the Close lead status classification heuristic
// that runs inside the Supabase edge function. This file exists so the
// heuristic is unit-testable from Vitest (the Deno edge function module
// `supabase/functions/close-lead-heat-score/status-classification.ts` cannot
// be imported from the Vite/Vitest world).
//
// ⚠️ KEEP IN SYNC ⚠️
// Any change to EXCLUDED_STATUS_PATTERNS, RANKABLE_STATUS_PATTERNS, or
// classifyStatusLabel() MUST be applied to BOTH files. The Vitest tests in
// __tests__/lead-heat-classifier.test.ts encode the expected outputs and will
// fail if the patterns drift.
//
// Source of truth at runtime: the Deno module. This file mirrors it for the
// sole purpose of test coverage.

/**
 * Statuses indicating an agent has worked the lead OR the lead has reached
 * a terminal state. Substring-matched case-insensitively against status labels.
 */
export const EXCLUDED_STATUS_PATTERNS = [
  // Closed-won / post-sale
  "sold",
  "won",
  "policy pending",
  "policy issued",
  "issued and paid",
  "bound",
  "in force",
  "active policy",
  // Appointment-stage
  "appointment",
  // Terminal / disqualified
  "not interested",
  "do not contact",
  "dnc",
  "disqualified",
  "declined",
  // Contacted / worked
  "contacted",
  "spoke",
  "texting",
  "call back",
  "callback",
  // Negative contact outcomes
  "voicemail",
  "no answer",
  "straight to vm",
  "hung up",
  "bad number",
  "wrong number",
  "doesn't ring",
  "doesnt ring",
  "blocked",
  "not in service",
  // Dead / lost
  "dead",
  "lost",
  "no show",
  // Progressed past initial stage
  "quoted",
  "application",
  "underwriting",
] as const;

/**
 * Statuses indicating an untouched or freshly-hot lead. Conservative —
 * substring-collision-safe because the blacklist runs first.
 *
 * Notably absent:
 * - "interested" (collides with "Not Interested" via reverse substring)
 * - "qualified" (collides with "Disqualified")
 * - "lead" (collides with "Lead is Dead")
 * - "inbound" (DEAD CODE: every "inbound" string also contains "bound" which
 *   the blacklist catches first; included here in commentary only so future
 *   maintainers don't re-add it expecting it to work). To support inbound
 *   leads, use the "incoming" pattern OR change blacklist "bound" to "policy
 *   bound" — but the latter changes production semantics for any user with a
 *   bare "Bound" status.
 */
export const RANKABLE_STATUS_PATTERNS = [
  "new", // matches "New", "New Lead", "New Customer"
  "potential", // matches "Potential", "Potential Customer"
  "fresh", // matches "Fresh Lead"
  "hot", // matches "Hot", "Hot Lead"
  "warm", // matches "Warm Lead"
  "nurture", // matches "Nurture", "Long Term Nurture"
  "incoming", // matches "INCOMING - MISSED CALL", "Incoming Lead"
] as const;

/**
 * Classify a Close lead status label as rankable (eligible for Hot 100) or
 * excluded. Hybrid heuristic with default-deny.
 *
 * Order matters: blacklist runs FIRST so substring collisions like
 * "New Application" → matches `application` (blacklist) → excluded BEFORE
 * the whitelist gets a chance to match `new`.
 */
export function classifyStatusLabel(label: string): boolean {
  const norm = label.trim().toLowerCase();
  if (!norm) return false;

  // Step 1: known "agent-touched / terminal" patterns → NOT rankable
  if (EXCLUDED_STATUS_PATTERNS.some((p) => norm.includes(p))) return false;

  // Step 2: known "untouched / hot lead" patterns → rankable
  if (RANKABLE_STATUS_PATTERNS.some((p) => norm.includes(p))) return true;

  // Step 3: DEFAULT DENY — unknown statuses excluded for safety
  return false;
}
