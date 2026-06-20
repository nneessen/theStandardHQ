// src/features/policies/utils/__tests__/policyInsights.test.ts

import { describe, it, expect } from "vitest";
import type { Policy } from "@/types/policy.types";
import type { Commission } from "@/types/commission.types";
import {
  computeCommissionPipeline,
  computeStatusMix,
  computeTopCarriers,
  computeMonthlyPremium,
  monthlyGrowth,
  totalPremium,
} from "../policyInsights";

function policy(overrides: Partial<Policy>): Policy {
  return {
    id: Math.random().toString(36).slice(2),
    policyNumber: "EP-00-0000",
    status: "approved",
    lifecycleStatus: "active",
    carrierId: "carrier-a",
    product: "whole_life",
    submitDate: "2026-06-10",
    effectiveDate: "2026-06-10",
    annualPremium: 1000,
    commissionPercentage: 1,
    createdAt: "2026-06-10T00:00:00Z",
    client: { name: "Jane", age: 40, state: "CA" },
    ...overrides,
  } as Policy;
}

function commission(status: string, amount: number): Commission {
  return {
    id: Math.random().toString(36).slice(2),
    policyId: "p",
    status: status as Commission["status"],
    amount,
    earnedAmount: amount,
    unearnedAmount: 0,
  } as Commission;
}

describe("computeCommissionPipeline", () => {
  it("splits by status and excludes cancelled/charged_back", () => {
    const result = computeCommissionPipeline([
      commission("paid", 100),
      commission("pending", 50),
      commission("unpaid", 30),
      commission("charged_back", 999),
    ]);
    expect(result).toEqual({ paid: 100, earned: 30, pending: 50, total: 180 });
  });

  it("handles an empty list", () => {
    expect(computeCommissionPipeline([])).toEqual({
      paid: 0,
      earned: 0,
      pending: 0,
      total: 0,
    });
  });
});

describe("computeStatusMix", () => {
  it("partitions policies so buckets sum to total", () => {
    const policies = [
      policy({ status: "approved", lifecycleStatus: "active" }),
      policy({ status: "approved", lifecycleStatus: null }), // → active
      policy({ status: "pending" }),
      policy({ status: "approved", lifecycleStatus: "lapsed" }), // → cancelled
      policy({ status: "approved", lifecycleStatus: "cancelled" }),
      policy({ status: "denied" }), // → cancelled
      policy({ status: "withdrawn" }), // → cancelled
    ];
    const mix = computeStatusMix(policies);
    expect(mix.active).toBe(2);
    expect(mix.pending).toBe(1);
    expect(mix.cancelled).toBe(4);
    expect(mix.incomplete).toBe(0);
    expect(mix.active + mix.pending + mix.cancelled + mix.incomplete).toBe(
      mix.total,
    );
    expect(mix.total).toBe(7);
  });

  it("counts unknown statuses as incomplete", () => {
    const mix = computeStatusMix([
      policy({ status: "" as Policy["status"] }),
    ]);
    expect(mix.incomplete).toBe(1);
    expect(mix.total).toBe(1);
  });
});

describe("computeTopCarriers", () => {
  it("sums premium by carrier and returns the top N", () => {
    const carriers = computeTopCarriers(
      [
        policy({ carrierId: "a", annualPremium: 100 }),
        policy({ carrierId: "a", annualPremium: 50 }),
        policy({ carrierId: "b", annualPremium: 200 }),
        policy({ carrierId: "c", annualPremium: 10 }),
      ],
      { a: "Alpha", b: "Beta", c: "Gamma" },
      2,
    );
    expect(carriers).toEqual([
      { carrierId: "b", name: "Beta", premium: 200 },
      { carrierId: "a", name: "Alpha", premium: 150 },
    ]);
  });
});

describe("computeMonthlyPremium / monthlyGrowth", () => {
  const now = new Date(2026, 5, 15); // Jun 15 2026

  it("buckets premium into the trailing 6 months, oldest first", () => {
    const trend = computeMonthlyPremium(
      [
        policy({ submitDate: "2026-06-01", annualPremium: 300 }),
        policy({ submitDate: "2026-05-20", annualPremium: 100 }),
        policy({ submitDate: "2025-12-01", annualPremium: 999 }), // out of window
      ],
      6,
      now,
    );
    expect(trend).toHaveLength(6);
    expect(trend[5].label).toBe("Jun");
    expect(trend[5].premium).toBe(300);
    expect(trend[4].label).toBe("May");
    expect(trend[4].premium).toBe(100);
    expect(trend[0].label).toBe("Jan");
    expect(trend[0].premium).toBe(0);
  });

  it("computes month-over-month growth, null when prior month is zero", () => {
    const trend = computeMonthlyPremium(
      [
        policy({ submitDate: "2026-06-01", annualPremium: 150 }),
        policy({ submitDate: "2026-05-01", annualPremium: 100 }),
      ],
      6,
      now,
    );
    expect(monthlyGrowth(trend)).toBeCloseTo(0.5);
    expect(monthlyGrowth(computeMonthlyPremium([], 6, now))).toBeNull();
  });
});

describe("totalPremium", () => {
  it("sums annual premium across the dataset", () => {
    expect(
      totalPremium([
        policy({ annualPremium: 100 }),
        policy({ annualPremium: 250 }),
      ]),
    ).toBe(350);
  });
});
