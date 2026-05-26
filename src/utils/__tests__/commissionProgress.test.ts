import {
  calculateCommissionProgress,
  calculateCompletedPolicyMonths,
} from "../commissionProgress";

describe("commissionProgress", () => {
  describe("calculateCompletedPolicyMonths", () => {
    it("does not count a month until the effective-date anniversary", () => {
      const effectiveDate = new Date(2026, 0, 28);

      expect(
        calculateCompletedPolicyMonths(effectiveDate, new Date(2026, 1, 27)),
      ).toBe(0);
      expect(
        calculateCompletedPolicyMonths(effectiveDate, new Date(2026, 1, 28)),
      ).toBe(1);
    });

    it("returns zero for end dates before the effective date", () => {
      expect(
        calculateCompletedPolicyMonths(
          new Date(2026, 2, 10),
          new Date(2026, 1, 10),
        ),
      ).toBe(0);
    });
  });

  describe("calculateCommissionProgress", () => {
    it("earns the advance month by month from the effective date", () => {
      const result = calculateCommissionProgress({
        amount: 900,
        advanceMonths: 9,
        effectiveDate: "2026-01-15",
        lifecycleStatus: "active",
        asOfDate: new Date(2026, 3, 15),
      });

      expect(result).toEqual({
        monthsPaid: 3,
        earnedAmount: 300,
        unearnedAmount: 600,
      });
    });

    it("caps earned progress at the advance period", () => {
      const result = calculateCommissionProgress({
        amount: 900,
        advanceMonths: 9,
        effectiveDate: "2025-01-15",
        lifecycleStatus: "active",
        asOfDate: new Date(2026, 3, 15),
      });

      expect(result).toEqual({
        monthsPaid: 9,
        earnedAmount: 900,
        unearnedAmount: 0,
      });
    });

    it("stops earning when the policy is cancelled or lapsed", () => {
      const result = calculateCommissionProgress({
        amount: 900,
        advanceMonths: 9,
        effectiveDate: "2026-01-15",
        lifecycleStatus: "cancelled",
        cancellationDate: "2026-04-10",
        asOfDate: new Date(2026, 7, 1),
      });

      expect(result).toEqual({
        monthsPaid: 2,
        earnedAmount: 200,
        unearnedAmount: 700,
      });
    });

    it("falls back to stored months when there is no effective date", () => {
      const result = calculateCommissionProgress({
        amount: 900,
        advanceMonths: 9,
        fallbackMonthsPaid: 4,
      });

      expect(result).toEqual({
        monthsPaid: 4,
        earnedAmount: 400,
        unearnedAmount: 500,
      });
    });

    it("falls back to stored months for closed policies missing a cancellation date", () => {
      const result = calculateCommissionProgress({
        amount: 900,
        advanceMonths: 9,
        fallbackMonthsPaid: 3,
        effectiveDate: "2026-01-15",
        lifecycleStatus: "lapsed",
      });

      expect(result).toEqual({
        monthsPaid: 3,
        earnedAmount: 300,
        unearnedAmount: 600,
      });
    });

    // Gap A: rounding + reconciliation invariant across awkward-rounding inputs.
    // Every output must be <= 2 decimals and earned + unearned === amount to the cent.
    it("always reconciles earned + unearned to amount (matrix)", () => {
      const amounts = [4612.5, 3333.33, 1000.01, 9999.99, 250.0, 7777.77];
      const months = [9, 12, 6];
      const paid = [0, 1, 2, 5, 7, 11, 9];

      for (const amount of amounts) {
        for (const advanceMonths of months) {
          for (const fallbackMonthsPaid of paid) {
            const r = calculateCommissionProgress({
              amount,
              advanceMonths,
              fallbackMonthsPaid,
            });
            expect(hasAtMostTwoDecimals(r.earnedAmount)).toBe(true);
            expect(hasAtMostTwoDecimals(r.unearnedAmount)).toBe(true);
            expect(r.earnedAmount + r.unearnedAmount).toBeCloseTo(amount, 2);
          }
        }
      }
    });
  });
});

function hasAtMostTwoDecimals(n: number): boolean {
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-9;
}
