// Shared helpers for the read-only Close tools. Kept esm-free (only imports the
// pure Close client types/guards) so the tools stay offline-testable with a fake
// CloseProvider.
//
// PII discipline (mirrors getClientSnapshot): we surface NAMES and structured
// signals (status, value, dates, counts, activity types, durations) but NEVER raw
// emails, phone numbers, addresses, dates of birth, note/email/SMS bodies, or lead
// descriptions. Helpers here make that drop the default.

import { isCloseApiError } from "../../_shared/close/client.ts";
import type { AssistantToolContext, CloseReadClient } from "./types.ts";

export interface CloseSection {
  available: boolean;
  reason?: string;
  data?: unknown;
}

/** Shape of a Close v1 list endpoint response (leads, opportunities, …). */
export interface CloseListResponse {
  data?: Array<Record<string, unknown>>;
  /** Close returns the true total for the query (independent of the page limit). */
  total_results?: number | null;
}

/**
 * Resolve the user's Close client and run `fn`, mapping every failure mode to a
 * grounded `available:false` section (never throws). `fn` returns the full section
 * it wants (so a tool can say e.g. reason:"lead_not_found"); client-resolution and
 * Close API errors are handled here.
 */
export async function withClose(
  ctx: AssistantToolContext,
  fn: (client: CloseReadClient) => Promise<CloseSection>,
): Promise<CloseSection> {
  let client: CloseReadClient | null;
  try {
    client = await ctx.close.getClient();
  } catch {
    return { available: false, reason: "close_unavailable" };
  }
  if (!client) return { available: false, reason: "close_not_connected" };
  try {
    return await fn(client);
  } catch (e) {
    if (isCloseApiError(e)) {
      if (e.code === "CLOSE_AUTH_ERROR") {
        return { available: false, reason: "close_auth_failed" };
      }
      if (e.code === "CLOSE_RATE_LIMIT") {
        return { available: false, reason: "close_rate_limited" };
      }
    }
    return { available: false, reason: "close_error" };
  }
}

/** Clamp a model-supplied limit to a sane window. */
export function clampLimit(input: unknown, def: number, max: number): number {
  const n =
    typeof input === "number" && Number.isFinite(input)
      ? Math.trunc(input)
      : def;
  return Math.max(1, Math.min(max, n));
}

/** Encode a free-text Close search query into the legacy `query=` param. */
export function leadSearchPath(query: string, limit: number): string {
  const fields = "id,display_name,status_label,date_created,date_updated";
  return `/lead/?query=${encodeURIComponent(query)}&_limit=${limit}&_fields=${fields}`;
}

/** Whole-number days between an ISO timestamp and now (>= 0). */
export function daysSince(iso: unknown): number | null {
  if (typeof iso !== "string" || !iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v : null;
const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** A lead's contact channels as PRESENCE COUNTS only — never the values. */
export function contactChannelSummary(contacts: unknown): {
  contactCount: number;
  withEmail: number;
  withPhone: number;
} {
  const list = Array.isArray(contacts) ? contacts : [];
  let withEmail = 0;
  let withPhone = 0;
  for (const c of list) {
    const rec = (c ?? {}) as Record<string, unknown>;
    if (Array.isArray(rec.emails) && rec.emails.length > 0) withEmail++;
    if (Array.isArray(rec.phones) && rec.phones.length > 0) withPhone++;
  }
  return { contactCount: list.length, withEmail, withPhone };
}

/** Lean opportunity summary (name-level + money + status + age). No PII. */
export function summarizeOpportunity(o: unknown): Record<string, unknown> {
  const r = (o ?? {}) as Record<string, unknown>;
  // Close stores opportunity value in CENTS — convert to dollars (matches
  // close-kpi-data). `value_formatted` is Close's own display string and is kept
  // as the authoritative label.
  const cents = numOrNull(r.value);
  return {
    leadName: str(r.lead_name),
    status: str(r.status_label),
    statusType: str(r.status_type),
    value: cents === null ? null : cents / 100,
    valuePeriod: str(r.value_period),
    valueFormatted: str(r.value_formatted),
    confidence: numOrNull(r.confidence),
    ageDays: daysSince(r.date_created),
    daysSinceUpdate: daysSince(r.date_updated),
  };
}

/**
 * Lean activity summary: type + date + direction/duration/status only. Bodies,
 * subjects, addresses, phone numbers, and recording URLs are deliberately dropped.
 */
export function summarizeActivity(a: unknown): Record<string, unknown> {
  const r = (a ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {
    type: str(r._type),
    date: str(r.date_created),
  };
  const direction = str(r.direction);
  if (direction) out.direction = direction;
  const status = str(r.status);
  if (status) out.status = status;
  const duration = numOrNull(r.duration);
  if (duration !== null) out.durationSec = duration;
  return out;
}
