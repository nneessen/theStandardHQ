import { describe, expect, it, vi } from "vitest";
import {
  buildVoiceEntitlementPayload,
  syncVoiceEntitlementWithRetry,
  type VoiceEntitlementSnapshot,
} from "../voice-sync";

const snapshot: VoiceEntitlementSnapshot = {
  agentId: "agent-123",
  status: "active",
  planCode: "voice_pro_v1",
  externalCustomerId: "cus_123",
  externalSubscriptionId: "sub_123",
  externalSubscriptionItemId: "si_123",
  includedMinutes: 500,
  hardLimitMinutes: 500,
  allowOverage: false,
  overageRateCents: null,
  cycleStartAt: "2026-03-01T00:00:00.000Z",
  cycleEndAt: "2026-04-01T00:00:00.000Z",
  cancelAt: null,
  canceledAt: null,
  features: {
    missedAppointment: true,
    reschedule: true,
    quotedFollowup: false,
    afterHoursInbound: true,
  },
  metadata: {
    source: "commissionTracker",
  },
  usage: {
    outboundCalls: 0,
    inboundCalls: 0,
    answeredCalls: 0,
    usedMinutes: 0,
    remainingMinutes: 500,
  },
};

describe("voice-sync helpers", () => {
  it("maps arbitrary Stripe periods to UTC calendar month boundaries", () => {
    const payload = buildVoiceEntitlementPayload({
      eventId: "evt_123",
      referenceDate: new Date("2026-03-18T14:22:00.000Z"),
      stripeStatus: "active",
      externalCustomerId: "cus_123",
      externalSubscriptionId: "sub_123",
      externalSubscriptionItemId: "si_123",
      tier: {
        id: "voice_pro",
        name: "Voice Pro",
        runs_per_month: 500,
        included_minutes: 500,
        hard_limit_minutes: 500,
        plan_code: "voice_pro_v1",
        allow_overage: false,
        overage_rate_cents: null,
        features: {
          missedAppointment: true,
          reschedule: true,
          quotedFollowup: false,
          afterHoursInbound: true,
        },
        price_monthly: 14900,
        price_annual: 149000,
      },
    });

    expect(payload.cycleStartAt).toBe("2026-03-01T00:00:00.000Z");
    expect(payload.cycleEndAt).toBe("2026-04-01T00:00:00.000Z");
    expect(payload.effectiveAt).toBe("2026-03-01T00:00:00.000Z");
    expect(payload.includedMinutes).toBe(500);
    expect(payload.hardLimitMinutes).toBe(500);
    expect(payload.overageRateCents).toBeNull();
  });

  it("treats a duplicate idempotent upsert response as success", async () => {
    const upsertVoiceEntitlement = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: snapshot,
    });

    const result = await syncVoiceEntitlementWithRetry({
      client: {
        upsertVoiceEntitlement,
        cancelVoiceEntitlement: vi.fn(),
      },
      agentId: "agent-123",
      idempotencyKey: "evt_duplicate",
      action: {
        operation: "upsert",
        payload: buildVoiceEntitlementPayload({
          eventId: "evt_duplicate",
          referenceDate: new Date("2026-03-18T00:00:00.000Z"),
          stripeStatus: "active",
          tier: {
            id: "voice_pro",
            name: "Voice Pro",
            runs_per_month: 500,
            price_monthly: 14900,
            price_annual: 149000,
          },
        }),
      },
      sleep: vi.fn(),
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.snapshot).toEqual(snapshot);
    expect(upsertVoiceEntitlement).toHaveBeenCalledTimes(1);
  });

  it("retries transient voice sync failures and eventually succeeds", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const upsertVoiceEntitlement = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        data: null,
        error: "Service unavailable",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        data: snapshot,
      });

    const result = await syncVoiceEntitlementWithRetry({
      client: {
        upsertVoiceEntitlement,
        cancelVoiceEntitlement: vi.fn(),
      },
      agentId: "agent-123",
      idempotencyKey: "evt_retry",
      action: {
        operation: "upsert",
        payload: buildVoiceEntitlementPayload({
          eventId: "evt_retry",
          referenceDate: new Date("2026-03-18T00:00:00.000Z"),
          stripeStatus: "active",
          tier: {
            id: "voice_pro",
            name: "Voice Pro",
            runs_per_month: 500,
            price_monthly: 14900,
            price_annual: 149000,
          },
        }),
      },
      sleep,
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(upsertVoiceEntitlement).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-retriable sync failures", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const upsertVoiceEntitlement = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      data: null,
      error: "Unknown agent ID",
    });

    const result = await syncVoiceEntitlementWithRetry({
      client: {
        upsertVoiceEntitlement,
        cancelVoiceEntitlement: vi.fn(),
      },
      agentId: "agent-missing",
      idempotencyKey: "evt_404",
      action: {
        operation: "upsert",
        payload: buildVoiceEntitlementPayload({
          eventId: "evt_404",
          referenceDate: new Date("2026-03-18T00:00:00.000Z"),
          stripeStatus: "active",
          tier: {
            id: "voice_pro",
            name: "Voice Pro",
            runs_per_month: 500,
            price_monthly: 14900,
            price_annual: 149000,
          },
        }),
      },
      sleep,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(upsertVoiceEntitlement).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
