import { describe, it, expect } from "vitest";
import {
  segmentClientsByValue,
  calculatePolicyChargebackRisk,
  type CommissionForChargebackRisk,
} from "../segmentationService";
import type { Policy } from "@/types";

function policy(p: {
  id?: string;
  name?: string;
  premium?: number;
  effectiveDate?: string;
}): Policy {
  return {
    id: p.id ?? "p1",
    status: "approved",
    effectiveDate: p.effectiveDate ?? "2025-01-15",
    annualPremium: p.premium ?? 1000,
    product: "term_life",
    client: { id: p.id, name: p.name ?? "Client", state: "TX", age: 40 },
  } as unknown as Policy;
}

describe("segmentClientsByValue", () => {
  it("keys clients by id — two distinct clients sharing a name are NOT merged", () => {
    const result = segmentClientsByValue([
      policy({ id: "c1", name: "John Smith", premium: 1000 }),
      policy({ id: "c2", name: "John Smith", premium: 2000 }),
    ]);
    expect(result.totalClients).toBe(2);
  });

  it("falls back to name when client.id is absent (legacy rows)", () => {
    const noId = (name: string, premium: number) =>
      ({
        id: "p",
        status: "approved",
        effectiveDate: "2025-01-15",
        annualPremium: premium,
        product: "term_life",
        client: { name, state: "TX", age: 40 },
      }) as unknown as Policy;
    const result = segmentClientsByValue([
      noId("Jane Doe", 1000),
      noId("Jane Doe", 2000),
    ]);
    expect(result.totalClients).toBe(1); // same name, no id → merged
  });

  it("avgPremiumByTier is premium-per-client (total ÷ clients), not avg-of-avgs", () => {
    // One client, two policies totalling $4,000 of annual premium → lands in
    // the 'low' tier when it's the only client.
    const result = segmentClientsByValue([
      policy({ id: "c1", name: "Solo", premium: 1000 }),
      policy({ id: "c1", name: "Solo", premium: 3000 }),
    ]);
    expect(result.totalClients).toBe(1);
    expect(result.totalPremiumByTier.low).toBe(4000);
    // Per-client average = 4000 / 1 = 4000 (the old double-average gave 2000:
    // the client's own per-policy average of (1000+3000)/2).
    expect(result.avgPremiumByTier.low).toBe(4000);
  });
});

describe("calculatePolicyChargebackRisk — terminal commissions are not at-risk", () => {
  // A recently-effective active policy, well inside the contestability window,
  // with unearned commission still outstanding.
  const recentEffectiveDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const activePolicy = {
    id: "pol-1",
    status: "approved",
    lifecycleStatus: "active",
    effectiveDate: recentEffectiveDate,
    annualPremium: 1200,
    product: "term_life",
    client: { id: "c1", name: "Risk Client", state: "TX", age: 45 },
  } as unknown as Policy;

  const commission = (status: string): CommissionForChargebackRisk => ({
    policyId: "pol-1",
    amount: 900,
    advanceMonths: 9,
    status,
  });

  it("includes a policy whose commission is collectible (paid)", () => {
    const risk = calculatePolicyChargebackRisk(
      [activePolicy],
      [commission("paid")],
    );
    expect(risk.map((r) => r.policyId)).toContain("pol-1");
  });

  it("excludes a policy whose only commission is terminal (clawback)", () => {
    const risk = calculatePolicyChargebackRisk(
      [activePolicy],
      [commission("clawback")],
    );
    // clawback is terminal → not collectible → not chargeback-risk. The old
    // denylist (status !== 'charged_back' && !== 'cancelled') leaked it in.
    expect(risk).toHaveLength(0);
  });

  it("excludes reversed and disputed commissions too", () => {
    expect(
      calculatePolicyChargebackRisk([activePolicy], [commission("reversed")]),
    ).toHaveLength(0);
    expect(
      calculatePolicyChargebackRisk([activePolicy], [commission("disputed")]),
    ).toHaveLength(0);
  });
});
