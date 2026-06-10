import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { projectGrowth, forecastRenewals } from "../forecastService";
import { ANALYTICS_CONSTANTS } from "@/constants/financial";
import type { Policy } from "@/types";

function policyEffective(dateISO: string): Policy {
  return {
    id: "p",
    effectiveDate: dateISO,
    submitDate: dateISO,
    annualPremium: 1000,
    lifecycleStatus: "active",
    status: "approved",
  } as unknown as Policy;
}

// Per-month band derived from the documented annual caps (±100% / −50% per yr).
const MONTHLY_CAP = (Math.pow(2, 1 / 12) - 1) * 100; // ≈ +5.95%/mo
const MONTHLY_FLOOR = (Math.pow(0.5, 1 / 12) - 1) * 100; // ≈ −5.61%/mo

describe("forecastService.projectGrowth growth caps", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15)); // Jun 15, 2026
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("caps an explosive ramp (1 → 100 policies MoM) instead of compounding it", () => {
    const policies = [
      policyEffective("2025-06-10"),
      ...Array.from({ length: 100 }, () => policyEffective("2025-07-10")),
    ];
    const result = projectGrowth(policies, []);
    expect(result).toHaveLength(12);
    // Without the cap this would be ~+4900%/mo → 4900^12 explosion.
    expect(result.every((r) => r.growthRate <= MONTHLY_CAP + 1e-6)).toBe(true);
  });

  it("floors a steep decline at the documented minimum", () => {
    const policies = [
      ...Array.from({ length: 100 }, () => policyEffective("2025-06-10")),
      policyEffective("2025-07-10"),
    ];
    const result = projectGrowth(policies, []);
    expect(result.every((r) => r.growthRate >= MONTHLY_FLOOR - 1e-6)).toBe(
      true,
    );
  });

  it("uses the MEDIAN MoM rate (robust to a single ramp), not the mean", () => {
    const flatMonths = [
      "2025-06",
      "2025-07",
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
    ];
    const policies: Policy[] = [];
    for (const m of flatMonths) {
      policies.push(policyEffective(`${m}-10`), policyEffective(`${m}-12`)); // 2/mo
    }
    for (let k = 0; k < 20; k++) policies.push(policyEffective("2026-05-10")); // ramp
    const result = projectGrowth(policies, []);
    // Median MoM is 0% (most months flat) → far below the +5.95%/mo cap. The
    // mean would be ~82% and pin at the cap; assert we are NOT pinned.
    expect(result[0].growthRate).toBeLessThan(MONTHLY_CAP - 1);
    expect(Math.abs(result[0].growthRate)).toBeLessThan(1);
  });
});

describe("forecastService.forecastRenewals (annual-anniversary model)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15)); // Jun 15, 2026
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function activePolicy(
    over: Partial<Policy> & { effectiveDate: string },
  ): Policy {
    return {
      id: "p",
      lifecycleStatus: "active",
      status: "approved",
      annualPremium: 2000,
      commissionPercentage: 0.9,
      ...over,
    } as unknown as Policy;
  }

  it("returns 12 forward monthly buckets", () => {
    expect(forecastRenewals([])).toHaveLength(12);
  });

  it("buckets an active policy by its annual anniversary, NOT term expiration", () => {
    // Effective Aug 20 (any year) → next anniversary Aug 20, 2026 ≈ 2 months out.
    const result = forecastRenewals([
      activePolicy({ effectiveDate: "2023-08-20" }),
    ]);
    const aug = result.find((r) => r.month === "2026-08");
    expect(aug?.expectedRenewals).toBe(1);
    // Every other month is empty (the policy renews once in the window).
    const total = result.reduce((s, r) => s + r.expectedRenewals, 0);
    expect(total).toBe(1);
  });

  it("INCLUDES policies with no termLength (the whole-life book fix)", () => {
    // No termLength field at all — previously excluded → forecast was always 0.
    const result = forecastRenewals([
      activePolicy({ effectiveDate: "2022-09-10" }),
    ]);
    expect(result.reduce((s, r) => s + r.expectedRenewals, 0)).toBe(1);
  });

  it("estimates revenue as premium × comp% × renewal multiplier", () => {
    const result = forecastRenewals([
      activePolicy({
        effectiveDate: "2023-08-20",
        annualPremium: 2000,
        commissionPercentage: 0.9,
      }),
    ]);
    const aug = result.find((r) => r.month === "2026-08");
    expect(aug?.expectedRevenue).toBeCloseTo(
      2000 * 0.9 * ANALYTICS_CONSTANTS.RENEWAL_RATE_MULTIPLIER,
    );
  });

  it("excludes non-active policies", () => {
    const result = forecastRenewals([
      activePolicy({ effectiveDate: "2023-08-20", lifecycleStatus: "lapsed" }),
    ]);
    expect(result.reduce((s, r) => s + r.expectedRenewals, 0)).toBe(0);
  });
});
