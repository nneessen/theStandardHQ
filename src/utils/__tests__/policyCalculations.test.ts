// /home/nneessen/projects/commissionTracker/src/utils/__tests__/policyCalculations.test.ts

import {
  calculateAnnualPremium,
  calculatePaymentAmount,
  calculateExpectedCommission,
  validateCommissionPercentage,
  validatePremium,
} from "../policyCalculations";

describe("Policy Calculations", () => {
  describe("calculateAnnualPremium", () => {
    it("should calculate annual premium for monthly payments", () => {
      expect(calculateAnnualPremium(100, "monthly")).toBe(1200);
    });

    it("should calculate annual premium for quarterly payments", () => {
      expect(calculateAnnualPremium(300, "quarterly")).toBe(1200);
    });

    it("should calculate annual premium for semi-annual payments", () => {
      // Regression: the DB-enum form is `semi_annual` (underscore). A hyphenated
      // value never matched the case and fell through to ×1 (saved $600 as $600/yr).
      expect(calculateAnnualPremium(600, "semi_annual")).toBe(1200);
    });

    it("should calculate annual premium for annual payments", () => {
      expect(calculateAnnualPremium(1200, "annual")).toBe(1200);
    });

    it("should return 0 for zero or negative premiums", () => {
      expect(calculateAnnualPremium(0, "monthly")).toBe(0);
      expect(calculateAnnualPremium(-100, "monthly")).toBe(0);
    });

    it("should handle decimal premiums correctly", () => {
      expect(calculateAnnualPremium(99.99, "monthly")).toBeCloseTo(1199.88, 2);
    });
  });

  describe("calculatePaymentAmount", () => {
    it("should calculate monthly payment from annual premium", () => {
      expect(calculatePaymentAmount(1200, "monthly")).toBe(100);
    });

    it("should calculate quarterly payment from annual premium", () => {
      expect(calculatePaymentAmount(1200, "quarterly")).toBe(300);
    });

    it("should calculate semi-annual payment from annual premium", () => {
      expect(calculatePaymentAmount(1200, "semi_annual")).toBe(600);
    });

    it("should return annual premium for annual frequency", () => {
      expect(calculatePaymentAmount(1200, "annual")).toBe(1200);
    });

    it("should return 0 for zero or negative annual premiums", () => {
      expect(calculatePaymentAmount(0, "monthly")).toBe(0);
      expect(calculatePaymentAmount(-1200, "monthly")).toBe(0);
    });

    it("should handle decimal amounts correctly", () => {
      expect(calculatePaymentAmount(1199.88, "monthly")).toBeCloseTo(99.99, 2);
    });
  });

  describe("calculateExpectedCommission", () => {
    // calculateExpectedCommission returns the 9-MONTH ADVANCE, not annual
    // commission:  (annualPremium / 12) * 9 * (pct / 100) == annual * pct% * 0.75.
    // toBeCloseTo because annualPremium / 12 introduces floating-point dust.
    it("should calculate the 9-month commission advance", () => {
      expect(calculateExpectedCommission(1000, 50)).toBeCloseTo(375, 2); // 1000*0.50*0.75
      expect(calculateExpectedCommission(1200, 75)).toBeCloseTo(675, 2); // 1200*0.75*0.75
      expect(calculateExpectedCommission(5000, 100)).toBeCloseTo(3750, 2); // 5000*1.00*0.75
    });

    it("should handle decimal percentages", () => {
      expect(calculateExpectedCommission(1000, 12.5)).toBeCloseTo(93.75, 2);
      expect(calculateExpectedCommission(1000, 0.5)).toBeCloseTo(3.75, 2);
    });

    it("should return 0 for zero or negative values", () => {
      expect(calculateExpectedCommission(0, 50)).toBe(0);
      expect(calculateExpectedCommission(1000, 0)).toBe(0);
      expect(calculateExpectedCommission(-1000, 50)).toBe(0);
      expect(calculateExpectedCommission(1000, -50)).toBe(0);
    });

    it("should handle high commission percentages (first-year bonuses)", () => {
      expect(calculateExpectedCommission(1000, 150)).toBeCloseTo(1125, 2); // 1000*1.50*0.75
      expect(calculateExpectedCommission(1000, 200)).toBeCloseTo(1500, 2); // 1000*2.00*0.75
    });
  });

  describe("validateCommissionPercentage", () => {
    it("should accept valid percentages", () => {
      expect(validateCommissionPercentage(50)).toBe(true);
      expect(validateCommissionPercentage(100)).toBe(true);
      expect(validateCommissionPercentage(0.1)).toBe(true);
      expect(validateCommissionPercentage(200)).toBe(true);
    });

    it("should reject invalid percentages", () => {
      expect(validateCommissionPercentage(0)).toBe(false);
      expect(validateCommissionPercentage(-10)).toBe(false);
      expect(validateCommissionPercentage(201)).toBe(false);
      expect(validateCommissionPercentage(1000)).toBe(false);
    });
  });

  describe("validatePremium", () => {
    it("should accept valid premiums", () => {
      expect(validatePremium(100)).toBe(true);
      expect(validatePremium(0.01)).toBe(true);
      expect(validatePremium(999999)).toBe(true);
    });

    it("should reject invalid premiums", () => {
      expect(validatePremium(0)).toBe(false);
      expect(validatePremium(-100)).toBe(false);
      expect(validatePremium(1000000)).toBe(false);
      expect(validatePremium(10000000)).toBe(false);
    });
  });
});
