// src/services/targets/targetsCalculationService.test.ts
// Unit tests for the avg-premium override precedence in target calculations.
//
// The IMO-wide `avgAP` constant (Settings → Constants) is passed as
// overrides.avgPolicyPremium. When set (> 0) it MUST win over the Mean/Median
// cohort selection (the historical bug: it was silently ignored whenever
// premiumStat === "median"). When 0/undefined, the computed agency cohort is
// used exactly as before.

import { describe, it, expect } from "vitest";
import {
  targetsCalculationService,
  type HistoricalAverages,
} from "./targetsCalculationService";

/** Minimal but complete HistoricalAverages with distinct mean/median so we can
 *  tell which value the calc picked. */
function makeAverages(
  overrides: Partial<HistoricalAverages> = {},
): HistoricalAverages {
  const base: HistoricalAverages = {
    avgCommissionRate: 0.8, // 80% first-year rate
    avgPolicyPremium: 2000, // agency MEAN
    medianPolicyPremium: 1000, // agency MEDIAN (distinct from mean)
    personalAvgPolicyPremium: 3000,
    personalMedianPolicyPremium: 2500,
    avgPoliciesPerMonth: 5,
    avgExpensesPerMonth: 0,
    projectedAnnualExpenses: 0,
    annualExpenseBreakdown: {
      recurring: [],
      oneTime: [],
      recurringTotal: 0,
      oneTimeTotal: 0,
      total: 0,
    },
    avgPolicyPremiumBreakdown: {
      source: "current-year",
      policyCount: 10,
      totalPremium: 20000,
      mean: 2000,
      median: 1000,
      min: 500,
      max: 5000,
      policies: [],
    },
    agencyAvgPolicyPremiumBreakdown: {
      source: "current-year",
      policyCount: 10,
      mean: 2000,
      median: 1000,
    },
    persistency13Month: 0.9,
    persistency25Month: 0.8,
    hasData: true,
  };
  return { ...base, ...overrides };
}

describe("targetsCalculationService — avgPolicyPremium override precedence", () => {
  const annualIncomeTarget = 100_000;

  it("override beats median (the exact precedence bug being fixed)", () => {
    const result = targetsCalculationService.calculateTargets({
      annualIncomeTarget,
      historicalAverages: makeAverages(),
      overrides: { avgPolicyPremium: 4242 },
      realism: { premiumStat: "median" },
    });

    expect(result.avgPolicyPremium).toBe(4242);
    expect(result.avgPolicyPremiumIsOverride).toBe(true);
  });

  it("override beats mean", () => {
    const result = targetsCalculationService.calculateTargets({
      annualIncomeTarget,
      historicalAverages: makeAverages(),
      overrides: { avgPolicyPremium: 4242 },
      realism: { premiumStat: "mean" },
    });

    expect(result.avgPolicyPremium).toBe(4242);
    expect(result.avgPolicyPremiumIsOverride).toBe(true);
  });

  it("no override → falls back to computed agency MEDIAN when premiumStat='median'", () => {
    const result = targetsCalculationService.calculateTargets({
      annualIncomeTarget,
      historicalAverages: makeAverages(),
      overrides: { avgPolicyPremium: undefined },
      realism: { premiumStat: "median" },
    });

    expect(result.avgPolicyPremium).toBe(1000); // median
    expect(result.avgPolicyPremiumIsOverride).toBe(false);
  });

  it("no override → falls back to computed agency MEAN when premiumStat='mean'", () => {
    const result = targetsCalculationService.calculateTargets({
      annualIncomeTarget,
      historicalAverages: makeAverages(),
      realism: { premiumStat: "mean" },
    });

    expect(result.avgPolicyPremium).toBe(2000); // mean
    expect(result.avgPolicyPremiumIsOverride).toBe(false);
  });

  it("override of 0 is treated as 'not set' (no leak, falls back to cohort)", () => {
    const result = targetsCalculationService.calculateTargets({
      annualIncomeTarget,
      historicalAverages: makeAverages(),
      overrides: { avgPolicyPremium: 0 },
      realism: { premiumStat: "median" },
    });

    expect(result.avgPolicyPremium).toBe(1000); // median, not 0
    expect(result.avgPolicyPremiumIsOverride).toBe(false);
  });

  it("override changes both optimistic and realistic policy counts", () => {
    const withOverride = targetsCalculationService.calculateTargets({
      annualIncomeTarget,
      historicalAverages: makeAverages(),
      overrides: { avgPolicyPremium: 4242 },
      realism: { premiumStat: "median" },
    });
    const withoutOverride = targetsCalculationService.calculateTargets({
      annualIncomeTarget,
      historicalAverages: makeAverages(),
      realism: { premiumStat: "median" },
    });

    // A larger avg premium → fewer policies needed.
    expect(withOverride.annualPoliciesTarget).toBeLessThan(
      withoutOverride.annualPoliciesTarget,
    );
    expect(withOverride.realisticAnnualPoliciesIssued).toBeLessThan(
      withoutOverride.realisticAnnualPoliciesIssued,
    );
  });
});
