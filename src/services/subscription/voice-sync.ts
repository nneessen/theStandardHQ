export {
  PREMIUM_VOICE_ADDON_NAME,
  PREMIUM_VOICE_DEFAULT_PLAN_CODE,
  isPremiumVoiceAddon,
  getTierUsageAmount,
  getTierUsageUnit,
} from "../../lib/subscription/voice-addon.ts";
import {
  PREMIUM_VOICE_DEFAULT_PLAN_CODE,
  getTierUsageAmount,
} from "../../lib/subscription/voice-addon.ts";

export type VoiceEntitlementStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "canceled";

export interface VoiceFeatureFlags {
  missedAppointment: boolean;
  reschedule: boolean;
  quotedFollowup: boolean;
  afterHoursInbound: boolean;
}

export interface VoiceAddonTier {
  id: string;
  name: string;
  runs_per_month: number;
  included_minutes?: number;
  hard_limit_minutes?: number;
  plan_code?: string;
  allow_overage?: boolean;
  overage_rate_cents?: number | null;
  features?: Partial<VoiceFeatureFlags>;
  price_monthly: number;
  price_annual: number;
  stripe_price_id_monthly?: string | null;
  stripe_price_id_annual?: string | null;
}

export interface VoiceAddonTierConfig {
  tiers: VoiceAddonTier[];
  stripe_product_id?: string;
}

export interface VoiceEntitlementPayload {
  status: VoiceEntitlementStatus;
  planCode: string;
  includedMinutes: number;
  hardLimitMinutes: number;
  allowOverage: boolean;
  overageRateCents: number | null;
  cycleStartAt: string;
  cycleEndAt: string;
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  externalSubscriptionItemId?: string | null;
  effectiveAt: string;
  features: VoiceFeatureFlags;
  metadata: Record<string, unknown>;
}

export interface VoiceCancellationPayload {
  cancelAt?: string;
  reason?: string;
  externalSubscriptionId?: string | null;
}

export interface VoiceEntitlementSnapshot {
  agentId: string;
  status: VoiceEntitlementStatus;
  planCode: string;
  externalCustomerId: string | null;
  externalSubscriptionId: string | null;
  externalSubscriptionItemId: string | null;
  includedMinutes: number;
  hardLimitMinutes: number;
  allowOverage: boolean;
  overageRateCents: number | null;
  cycleStartAt: string | null;
  cycleEndAt: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  features: VoiceFeatureFlags;
  metadata: Record<string, unknown>;
  usage: {
    outboundCalls: number;
    inboundCalls: number;
    answeredCalls: number;
    usedMinutes: number;
    remainingMinutes: number;
  };
}

export interface VoiceClientResponse<TData> {
  ok: boolean;
  status: number;
  data: TData | null;
  error?: string;
  raw?: unknown;
}

export interface VoiceSyncClient {
  upsertVoiceEntitlement(
    agentId: string,
    payload: VoiceEntitlementPayload,
    idempotencyKey: string,
  ): Promise<VoiceClientResponse<VoiceEntitlementSnapshot>>;
  cancelVoiceEntitlement(
    agentId: string,
    payload: VoiceCancellationPayload,
    idempotencyKey: string,
  ): Promise<VoiceClientResponse<VoiceEntitlementSnapshot>>;
}

export interface VoiceSyncResult {
  ok: boolean;
  attempts: number;
  operation: "upsert" | "cancel";
  status: number;
  snapshot: VoiceEntitlementSnapshot | null;
  error?: string;
  raw?: unknown;
}

export const DEFAULT_VOICE_FEATURES: VoiceFeatureFlags = {
  missedAppointment: true,
  reschedule: true,
  quotedFollowup: false,
  afterHoursInbound: true,
};

export function getVoiceTierConfig(
  tierConfig: unknown,
  tierId?: string | null,
): VoiceAddonTier | null {
  if (
    !tierConfig ||
    typeof tierConfig !== "object" ||
    !("tiers" in tierConfig) ||
    !Array.isArray(tierConfig.tiers) ||
    tierConfig.tiers.length === 0
  ) {
    return null;
  }

  const tiers = tierConfig.tiers as VoiceAddonTier[];
  if (tierId) {
    return tiers.find((tier) => tier.id === tierId) ?? null;
  }

  return tiers[0] ?? null;
}

export function toUtcMonthStart(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

export function getUtcCalendarMonthCycle(referenceDate: Date) {
  const cycleStart = toUtcMonthStart(referenceDate);
  const cycleEnd = new Date(
    Date.UTC(
      cycleStart.getUTCFullYear(),
      cycleStart.getUTCMonth() + 1,
      1,
      0,
      0,
      0,
      0,
    ),
  );

  return {
    cycleStartAt: cycleStart.toISOString(),
    cycleEndAt: cycleEnd.toISOString(),
  };
}

export function mapStripeStatusToVoiceStatus(
  stripeStatus: string | null | undefined,
): VoiceEntitlementStatus {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "incomplete":
    case "unpaid":
      return "past_due";
    case "paused":
      return "suspended";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "inactive";
  }
}

export function buildVoiceEntitlementPayload(input: {
  eventId: string;
  tier: VoiceAddonTier;
  referenceDate: Date;
  stripeStatus?: string | null;
  overrideStatus?: VoiceEntitlementStatus;
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  externalSubscriptionItemId?: string | null;
  effectiveAt?: Date;
  metadata?: Record<string, unknown>;
}): VoiceEntitlementPayload {
  const cycle = getUtcCalendarMonthCycle(input.referenceDate);
  const includedMinutes = getTierUsageAmount(input.tier);
  const hardLimitMinutes = input.tier.hard_limit_minutes ?? includedMinutes;
  const allowOverage = input.tier.allow_overage ?? false;

  return {
    status:
      input.overrideStatus ?? mapStripeStatusToVoiceStatus(input.stripeStatus),
    planCode: input.tier.plan_code ?? PREMIUM_VOICE_DEFAULT_PLAN_CODE,
    includedMinutes,
    hardLimitMinutes,
    allowOverage,
    overageRateCents: allowOverage
      ? (input.tier.overage_rate_cents ?? null)
      : null,
    cycleStartAt: cycle.cycleStartAt,
    cycleEndAt: cycle.cycleEndAt,
    externalCustomerId: input.externalCustomerId ?? null,
    externalSubscriptionId: input.externalSubscriptionId ?? null,
    externalSubscriptionItemId: input.externalSubscriptionItemId ?? null,
    effectiveAt: (
      input.effectiveAt ?? new Date(cycle.cycleStartAt)
    ).toISOString(),
    features: {
      ...DEFAULT_VOICE_FEATURES,
      ...(input.tier.features ?? {}),
    },
    metadata: {
      source: "commissionTracker",
      stripeEventId: input.eventId,
      tierId: input.tier.id,
      phoneNumberIncluded: true,
      ...(input.metadata ?? {}),
    },
  };
}

export function buildVoiceCancellationPayload(input: {
  externalSubscriptionId?: string | null;
  cancelAt?: Date | null;
  reason?: string;
}) {
  const payload: VoiceCancellationPayload = {};
  if (input.cancelAt) {
    payload.cancelAt = input.cancelAt.toISOString();
  }
  if (input.reason) {
    payload.reason = input.reason;
  }
  if (input.externalSubscriptionId !== undefined) {
    payload.externalSubscriptionId = input.externalSubscriptionId;
  }
  return payload;
}

export function isRetriableVoiceSyncFailure(status: number) {
  return status === 0 || status === 429 || status >= 500;
}

export async function syncVoiceEntitlementWithRetry(input: {
  client: VoiceSyncClient;
  agentId: string;
  idempotencyKey: string;
  action:
    | {
        operation: "upsert";
        payload: VoiceEntitlementPayload;
      }
    | {
        operation: "cancel";
        payload: VoiceCancellationPayload;
      };
  maxAttempts?: number;
  retryDelaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
}): Promise<VoiceSyncResult> {
  const {
    client,
    agentId,
    idempotencyKey,
    action,
    maxAttempts = 3,
    retryDelaysMs = [250, 750],
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = input;

  let attempt = 0;
  let lastResponse: VoiceClientResponse<VoiceEntitlementSnapshot> | null = null;
  let lastError: unknown = null;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      lastResponse =
        action.operation === "upsert"
          ? await client.upsertVoiceEntitlement(
              agentId,
              action.payload,
              idempotencyKey,
            )
          : await client.cancelVoiceEntitlement(
              agentId,
              action.payload,
              idempotencyKey,
            );

      if (lastResponse.ok) {
        return {
          ok: true,
          attempts: attempt,
          operation: action.operation,
          status: lastResponse.status,
          snapshot: lastResponse.data,
          raw: lastResponse.raw,
        };
      }

      if (
        attempt >= maxAttempts ||
        !isRetriableVoiceSyncFailure(lastResponse.status)
      ) {
        return {
          ok: false,
          attempts: attempt,
          operation: action.operation,
          status: lastResponse.status,
          snapshot: lastResponse.data,
          error: lastResponse.error ?? "Voice sync failed",
          raw: lastResponse.raw,
        };
      }
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) {
        break;
      }
    }

    const delay =
      retryDelaysMs[Math.min(attempt - 1, retryDelaysMs.length - 1)];
    await sleep(delay);
  }

  return {
    ok: false,
    attempts: attempt,
    operation: action.operation,
    status: lastResponse?.status ?? 0,
    snapshot: lastResponse?.data ?? null,
    error:
      lastResponse?.error ??
      (lastError instanceof Error ? lastError.message : "Voice sync failed"),
    raw: lastResponse?.raw ?? lastError,
  };
}
