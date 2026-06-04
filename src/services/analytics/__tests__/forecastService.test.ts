import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { projectGrowth } from "../forecastService";
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
