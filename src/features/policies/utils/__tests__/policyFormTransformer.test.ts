// src/features/policies/utils/__tests__/policyFormTransformer.test.ts

import { describe, it, expect } from "vitest";
import {
  transformFormToCreateData,
  calculateMonthlyPremium,
} from "../policyFormTransformer";
import type { NewPolicyForm } from "@/types/policy.types";

const baseForm: NewPolicyForm = {
  policyNumber: "POL-1",
  status: "pending",
  clientName: "Jane Doe",
  clientState: "TX",
  clientDOB: "1985-03-10",
  carrierId: "carrier-1",
  productId: "product-1",
  product: "whole_life",
  submitDate: "2026-06-01",
  effectiveDate: "2026-06-15",
  premium: 250,
  annualPremium: 3000,
  paymentFrequency: "monthly",
  commissionPercentage: 85,
  notes: "",
};

describe("transformFormToCreateData — manual commission entry", () => {
  it("converts the agent's whole-number comp % to a decimal", () => {
    const result = transformFormToCreateData(baseForm, "client-1", "user-1");
    // 85% → 0.85 decimal for storage on policies.commission_percentage
    expect(result.commissionPercentage).toBeCloseTo(0.85, 5);
  });

  it("passes a hand-entered flat advance through verbatim (no /100)", () => {
    const result = transformFormToCreateData(
      { ...baseForm, manualAdvanceAmount: 1900 },
      "client-1",
      "user-1",
    );
    expect(result.manualAdvanceAmount).toBe(1900);
  });

  it("nulls the flat advance when left blank or zero", () => {
    expect(
      transformFormToCreateData(
        { ...baseForm, manualAdvanceAmount: 0 },
        "client-1",
        "user-1",
      ).manualAdvanceAmount,
    ).toBeNull();

    expect(
      transformFormToCreateData(baseForm, "client-1", "user-1")
        .manualAdvanceAmount,
    ).toBeNull();
  });

  it("allows a blank (0%) commission without throwing", () => {
    const result = transformFormToCreateData(
      { ...baseForm, commissionPercentage: 0 },
      "client-1",
      "user-1",
    );
    expect(result.commissionPercentage).toBe(0);
  });
});

describe("calculateMonthlyPremium — frequency divisor", () => {
  it("derives monthly from a semi-annual annual premium (annual / 6)", () => {
    // Regression: the DB-enum form is `semi_annual`; a hyphenated value fell
    // through to the monthly default (/12), halving the displayed monthly figure.
    expect(calculateMonthlyPremium(1200, "semi_annual")).toBe(200);
  });

  it("derives monthly for the other frequencies", () => {
    expect(calculateMonthlyPremium(1200, "annual")).toBe(100);
    expect(calculateMonthlyPremium(1200, "quarterly")).toBe(400);
    expect(calculateMonthlyPremium(1200, "monthly")).toBe(100);
  });
});
