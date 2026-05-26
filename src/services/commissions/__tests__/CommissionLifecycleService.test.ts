// src/services/commissions/__tests__/CommissionLifecycleService.test.ts
//
// Unit coverage for the pure commission math core. This service had ZERO tests
// before 2026-05-26 despite being the single source of truth for advances,
// earned/unearned splits, and chargebacks. Includes regression guards for the
// 2026-05 hardening pass: divide-by-zero on advanceMonths (gap F) and UTC month
// arithmetic (gap G).

import { describe, it, expect, vi } from "vitest";
import { CommissionLifecycleService } from "../CommissionLifecycleService";

// Silence the logger; the math methods log on every call.
vi.mock("../../base/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const service = CommissionLifecycleService.getInstance();

describe("CommissionLifecycleService", () => {
  describe("calculateAdvance", () => {
    it("applies the core formula: premium x months x rate", () => {
      const result = service.calculateAdvance({
        monthlyPremium: 500,
        advanceMonths: 9,
        commissionRate: 1.025,
      });
      expect(result.advanceAmount).toBeCloseTo(4612.5, 2);
      expect(result.monthlyEarningRate).toBeCloseTo(512.5, 2);
      expect(result.advanceMonths).toBe(9);
    });

    it("defaults to a 9-month advance period", () => {
      const result = service.calculateAdvance({
        monthlyPremium: 100,
        commissionRate: 1,
      });
      expect(result.advanceMonths).toBe(9);
      expect(result.advanceAmount).toBeCloseTo(900, 2);
    });

    it("rejects non-positive premium, rate, and out-of-range months", () => {
      expect(() =>
        service.calculateAdvance({ monthlyPremium: 0, commissionRate: 1 }),
      ).toThrow(/premium must be positive/i);
      expect(() =>
        service.calculateAdvance({ monthlyPremium: 100, commissionRate: 0 }),
      ).toThrow(/rate must be positive/i);
      expect(() =>
        service.calculateAdvance({
          monthlyPremium: 100,
          commissionRate: 1,
          advanceMonths: 13,
        }),
      ).toThrow(/between 1-12/i);
    });
  });

  describe("calculateEarned", () => {
    it("earns 1/advanceMonths of the advance per month paid", () => {
      const result = service.calculateEarned({
        advanceAmount: 4612.5,
        advanceMonths: 9,
        monthsPaid: 3,
      });
      expect(result.earnedAmount).toBeCloseTo(1537.5, 2);
      expect(result.unearnedAmount).toBeCloseTo(3075.0, 2);
      expect(result.percentageEarned).toBeCloseTo(33.33, 1);
      expect(result.isFullyEarned).toBe(false);
    });

    it("caps months paid at advance months (cannot over-earn)", () => {
      const result = service.calculateEarned({
        advanceAmount: 4612.5,
        advanceMonths: 9,
        monthsPaid: 15,
      });
      expect(result.earnedAmount).toBeCloseTo(4612.5, 2);
      expect(result.unearnedAmount).toBeCloseTo(0, 2);
      expect(result.isFullyEarned).toBe(true);
      expect(result.monthsRemaining).toBe(0);
    });

    // Gap F regression: a malformed record with advanceMonths = 0 must throw,
    // not silently produce Infinity/NaN earned amounts.
    it("throws when advanceMonths is zero (divide-by-zero guard)", () => {
      expect(() =>
        service.calculateEarned({
          advanceAmount: 1000,
          advanceMonths: 0,
          monthsPaid: 3,
        }),
      ).toThrow(/advance months must be positive/i);
    });

    it("throws when advanceMonths is negative", () => {
      expect(() =>
        service.calculateEarned({
          advanceAmount: 1000,
          advanceMonths: -9,
          monthsPaid: 3,
        }),
      ).toThrow(/advance months must be positive/i);
    });

    it("rejects negative advance and negative months paid", () => {
      expect(() =>
        service.calculateEarned({
          advanceAmount: -1,
          advanceMonths: 9,
          monthsPaid: 3,
        }),
      ).toThrow(/advance amount cannot be negative/i);
      expect(() =>
        service.calculateEarned({
          advanceAmount: 1000,
          advanceMonths: 9,
          monthsPaid: -1,
        }),
      ).toThrow(/months paid cannot be negative/i);
    });
  });

  describe("calculateChargeback", () => {
    it("charges back the unearned portion on an early lapse", () => {
      const result = service.calculateChargeback({
        advanceAmount: 4612.5,
        advanceMonths: 9,
        monthsPaid: 3,
        lapseDate: new Date("2024-04-01T00:00:00Z"),
        effectiveDate: new Date("2024-01-01T00:00:00Z"),
      });
      expect(result.chargebackAmount).toBeCloseTo(3075.0, 2);
      expect(result.earnedAmount).toBeCloseTo(1537.5, 2);
    });

    it("flags a full chargeback when no payments were made", () => {
      const result = service.calculateChargeback({
        advanceAmount: 4612.5,
        advanceMonths: 9,
        monthsPaid: 0,
        lapseDate: new Date("2024-02-01T00:00:00Z"),
        effectiveDate: new Date("2024-01-01T00:00:00Z"),
      });
      expect(result.chargebackAmount).toBeCloseTo(4612.5, 2);
      expect(result.chargebackReason).toMatch(/no payments/i);
    });
  });

  describe("calculateCappedAdvance", () => {
    it("passes through unchanged when advance is under the cap", () => {
      const result = service.calculateCappedAdvance({
        monthlyPremium: 100,
        advanceMonths: 9,
        commissionRate: 1,
        advanceCap: 5000,
      });
      expect(result.isCapped).toBe(false);
      expect(result.advanceAmount).toBeCloseTo(900, 2);
      expect(result.overageAmount).toBe(0);
      expect(result.overageStartMonth).toBeNull();
    });

    it("caps the advance and defers the overage to after recoupment", () => {
      // 500 x 9 x 1.0 = 4500, capped at 3000 -> 1500 overage.
      // monthlyEarn = 4500/9 = 500; recoupment = ceil(3000/500) = 6; overage starts month 7.
      const result = service.calculateCappedAdvance({
        monthlyPremium: 500,
        advanceMonths: 9,
        commissionRate: 1.0,
        advanceCap: 3000,
      });
      expect(result.isCapped).toBe(true);
      expect(result.originalAdvance).toBeCloseTo(4500, 2);
      expect(result.advanceAmount).toBeCloseTo(3000, 2);
      expect(result.overageAmount).toBeCloseTo(1500, 2);
      expect(result.overageStartMonth).toBe(7);
    });
  });

  describe("calculateMonthsElapsed", () => {
    it("counts whole calendar months between two dates", () => {
      const months = service.calculateMonthsElapsed(
        new Date("2024-01-15T00:00:00Z"),
        new Date("2024-04-15T00:00:00Z"),
      );
      expect(months).toBe(3);
    });

    it("spans year boundaries", () => {
      const months = service.calculateMonthsElapsed(
        new Date("2023-11-01T00:00:00Z"),
        new Date("2024-02-01T00:00:00Z"),
      );
      expect(months).toBe(3);
    });

    // Gap G regression: month math must use UTC accessors. A timestamp just after
    // UTC midnight on the 1st belongs to the new month in UTC; local accessors in
    // a west-of-UTC zone would read the prior month and under-count by one.
    it("uses UTC month boundaries (does not drift by timezone)", () => {
      const months = service.calculateMonthsElapsed(
        new Date("2024-01-01T00:00:00Z"),
        new Date("2024-02-01T00:30:00Z"),
      );
      expect(months).toBe(1);
    });
  });

  describe("getChargebackRisk", () => {
    it("escalates risk as months paid decreases", () => {
      expect(service.getChargebackRisk(0, 9).level).toBe("high");
      expect(service.getChargebackRisk(2, 9).level).toBe("high");
      expect(service.getChargebackRisk(4, 9).level).toBe("medium");
      expect(service.getChargebackRisk(7, 9).level).toBe("low");
      expect(service.getChargebackRisk(9, 9).level).toBe("none");
    });
  });

  // Gap A: every money output is rounded to cents and the earned/unearned split
  // reconciles to the advance to the penny across awkward-rounding inputs.
  describe("rounding & reconciliation (Gap A)", () => {
    it("rounds the advance to cents", () => {
      // 333.33 x 9 x 1.025 = 3074.972... -> 3074.97
      const r = service.calculateAdvance({
        monthlyPremium: 333.33,
        advanceMonths: 9,
        commissionRate: 1.025,
      });
      expect(hasAtMostTwoDecimals(r.advanceAmount)).toBe(true);
      expect(r.advanceAmount).toBeCloseTo(3074.97, 2);
    });

    it("earned + unearned always reconciles to the advance (matrix)", () => {
      const premiums = [333.33, 500, 217.49, 1000.01];
      const rates = [0.95, 1.025, 1.1, 0.875];
      const months = [9, 12, 6];
      const paid = [0, 1, 3, 5, 7, 9, 15];

      for (const monthlyPremium of premiums) {
        for (const commissionRate of rates) {
          for (const advanceMonths of months) {
            const advance = service.calculateAdvance({
              monthlyPremium,
              advanceMonths,
              commissionRate,
            }).advanceAmount;
            for (const monthsPaid of paid) {
              const e = service.calculateEarned({
                advanceAmount: advance,
                advanceMonths,
                monthsPaid,
              });
              expect(hasAtMostTwoDecimals(e.earnedAmount)).toBe(true);
              expect(hasAtMostTwoDecimals(e.unearnedAmount)).toBe(true);
              expect(e.earnedAmount + e.unearnedAmount).toBeCloseTo(advance, 2);
            }
          }
        }
      }
    });

    it("rounds capped advance, original advance, and overage", () => {
      // 217.49 x 9 x 1.0 = 1957.41, cap 1500 -> overage 457.41
      const r = service.calculateCappedAdvance({
        monthlyPremium: 217.49,
        advanceMonths: 9,
        commissionRate: 1.0,
        advanceCap: 1500,
      });
      expect(r.isCapped).toBe(true);
      expect(hasAtMostTwoDecimals(r.originalAdvance)).toBe(true);
      expect(hasAtMostTwoDecimals(r.advanceAmount)).toBe(true);
      expect(hasAtMostTwoDecimals(r.overageAmount)).toBe(true);
      expect(r.advanceAmount + r.overageAmount).toBeCloseTo(
        r.originalAdvance,
        2,
      );
    });
  });
});

function hasAtMostTwoDecimals(n: number): boolean {
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-9;
}
