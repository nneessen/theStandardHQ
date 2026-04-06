// supabase/functions/close-lead-heat-score/status-classification.ts
//
// Per-user Close lead status classification for AI Hot 100 filtering.
//
// Architecture: each user's Close pipeline has custom-named statuses. This
// module classifies them as "rankable" (eligible for the Hot 100 — generally
// untouched/initial leads) or "excluded" (dead, terminal, agent-touched).
// Classifications are stored in the `lead_heat_status_config` table keyed
// by the immutable Close `status_id`, NOT the mutable label string.
//
// Heuristic ordering matters:
//   1. Blacklist patterns (catch obvious "agent touched/terminal" labels)
//   2. Whitelist patterns (catch known "untouched/hot" labels)
//   3. Default DENY for unknown labels — safer cross-tenant default
//
// The blacklist runs first to handle substring collisions: "New Application"
// matches "application" (blacklist) before "new" (whitelist), correctly
// classifying it as not-rankable.
//
// ⚠️ KEEP IN SYNC ⚠️
// EXCLUDED_STATUS_PATTERNS, RANKABLE_STATUS_PATTERNS, and classifyStatusLabel
// are mirrored in src/features/close-kpi/lib/lead-heat-classifier.ts for
// Vitest unit-test coverage. Any change here MUST also be applied there.
// The Vitest tests in __tests__/lead-heat-classifier.test.ts will fail loudly
// if the patterns drift between the two files.

// ─── Heuristic Patterns ───────────────────────────────────────────────

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
];

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
];

/**
 * Classify a Close lead status label as rankable (eligible for Hot 100) or
 * excluded. Hybrid heuristic with default-deny.
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

// ─── Database Sync ────────────────────────────────────────────────────

interface StatusConfigRow {
  close_status_id: string;
  close_status_label: string;
  is_rankable: boolean;
  classification_source: "heuristic" | "user_override";
}

/**
 * Ensures every Close status_id from the user's account has a row in
 * `lead_heat_status_config`. Returns the set of status_ids classified as
 * rankable for this user (heuristic OR user_override).
 *
 * - For status_ids not yet in the config: applies the heuristic and inserts
 *   with classification_source='heuristic'
 * - For existing rows: refreshes the label snapshot if Close renamed it
 *   (preserves the existing is_rankable + classification_source)
 * - For status_ids deleted from Close: leaves the row alone (cheap, harmless)
 */
export async function ensureStatusClassifications(
  // deno-lint-ignore no-explicit-any
  dataClient: any,
  userId: string,
  statusLabels: Map<string, string>,
): Promise<Set<string>> {
  // Read existing classifications for this user.
  // NOTE: We deliberately FAIL LOUD here. If the SELECT fails (transient DB
  // error, RLS misconfig, table missing), throwing surfaces the issue in
  // lead_heat_scoring_runs.error_message and prevents silent default-deny that
  // would empty out the user's Hot 100 the next morning. Failing the run
  // loudly is the right tradeoff: an investigated cron failure is better than
  // a quietly broken Smart View.
  const { data: existingRows, error: readError } = await dataClient
    .from("lead_heat_status_config")
    .select(
      "close_status_id, close_status_label, is_rankable, classification_source",
    )
    .eq("user_id", userId);

  if (readError) {
    console.error(
      "[status-classification] Failed to read existing config (fatal):",
      readError.message,
    );
    throw new Error(
      `lead_heat_status_config SELECT failed for user ${userId}: ${readError.message}`,
    );
  }

  const existingById = new Map<string, StatusConfigRow>();
  for (const row of (existingRows ?? []) as StatusConfigRow[]) {
    existingById.set(row.close_status_id, row);
  }

  const rowsToInsert: {
    user_id: string;
    close_status_id: string;
    close_status_label: string;
    is_rankable: boolean;
    classification_source: "heuristic";
  }[] = [];

  const rowsToRelabel: {
    close_status_id: string;
    close_status_label: string;
  }[] = [];
  const rankableIds = new Set<string>();

  for (const [statusId, label] of statusLabels.entries()) {
    const existing = existingById.get(statusId);

    if (!existing) {
      // First time we've seen this status — classify and insert
      const isRankable = classifyStatusLabel(label);
      rowsToInsert.push({
        user_id: userId,
        close_status_id: statusId,
        close_status_label: label,
        is_rankable: isRankable,
        classification_source: "heuristic",
      });
      if (isRankable) rankableIds.add(statusId);
      continue;
    }

    // Existing row — preserve classification, refresh label if Close renamed it
    if (existing.close_status_label !== label) {
      rowsToRelabel.push({
        close_status_id: statusId,
        close_status_label: label,
      });
    }
    if (existing.is_rankable) rankableIds.add(statusId);
  }

  // Insert new classifications (idempotent via PK conflict)
  if (rowsToInsert.length > 0) {
    const { error: insertError } = await dataClient
      .from("lead_heat_status_config")
      .upsert(rowsToInsert, { onConflict: "user_id,close_status_id" });
    if (insertError) {
      console.error(
        "[status-classification] Failed to insert new classifications:",
        insertError.message,
      );
    } else {
      console.log(
        `[status-classification] Classified ${rowsToInsert.length} new statuses for user ${userId} (${rowsToInsert.filter((r) => r.is_rankable).length} rankable)`,
      );
    }
  }

  // Refresh stale label snapshots (best-effort, non-blocking)
  for (const relabel of rowsToRelabel) {
    const { error: updateError } = await dataClient
      .from("lead_heat_status_config")
      .update({
        close_status_label: relabel.close_status_label,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("close_status_id", relabel.close_status_id);
    if (updateError) {
      console.warn(
        `[status-classification] Failed to refresh label for ${relabel.close_status_id}:`,
        updateError.message,
      );
    }
  }

  return rankableIds;
}
