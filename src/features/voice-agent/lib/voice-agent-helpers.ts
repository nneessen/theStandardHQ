import type { VoiceEntitlementSnapshotView } from "../types";

export type VoiceNextActionKey =
  | "activate_trial"
  | "resolve_billing"
  | "resolve_suspension"
  | "replenish_minutes"
  | "reactivate_voice"
  | "activate_voice"
  | "connect_close"
  | "create_agent"
  | "wait_for_provisioning"
  | "repair_agent"
  | "publish_agent"
  | "connect_calendar"
  | "review_guardrails"
  | "unknown";

const KNOWN_NEXT_ACTION_KEYS = new Set<VoiceNextActionKey>([
  "activate_trial",
  "resolve_billing",
  "resolve_suspension",
  "replenish_minutes",
  "reactivate_voice",
  "activate_voice",
  "connect_close",
  "create_agent",
  "wait_for_provisioning",
  "repair_agent",
  "publish_agent",
  "connect_calendar",
  "review_guardrails",
  "unknown",
]);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function sanitizeUsageField(v: unknown): number {
  return isFiniteNumber(v) ? v : 0;
}

export function parseVoiceSnapshot(
  value: unknown,
): VoiceEntitlementSnapshotView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  // Validate expected top-level shape before trusting the cast.
  if (raw.status !== undefined && typeof raw.status !== "string") return null;
  if (
    raw.includedMinutes !== undefined &&
    typeof raw.includedMinutes !== "number"
  )
    return null;
  if (
    raw.usage !== undefined &&
    (typeof raw.usage !== "object" || Array.isArray(raw.usage))
  )
    return null;

  // Sanitize usage sub-fields to prevent NaN in downstream math.
  // The JSONB column can contain arbitrary shapes after manual edits.
  if (raw.usage && typeof raw.usage === "object" && !Array.isArray(raw.usage)) {
    const u = raw.usage as Record<string, unknown>;
    raw.usage = {
      outboundCalls: sanitizeUsageField(u.outboundCalls),
      inboundCalls: sanitizeUsageField(u.inboundCalls),
      answeredCalls: sanitizeUsageField(u.answeredCalls),
      usedMinutes: sanitizeUsageField(u.usedMinutes),
      remainingMinutes: sanitizeUsageField(u.remainingMinutes),
    };
  }

  return raw as VoiceEntitlementSnapshotView;
}

export function normalizeNextActionKey(
  value: string | null | undefined,
): VoiceNextActionKey {
  if (!value) return "unknown";

  const candidate = value.trim().toLowerCase();
  if (!candidate) return "unknown";

  return KNOWN_NEXT_ACTION_KEYS.has(candidate as VoiceNextActionKey)
    ? (candidate as VoiceNextActionKey)
    : "unknown";
}
