// src/hooks/targets/useActualMetrics.ts

import { useMemo } from "react";
import { useMetricsWithDateRange } from "../kpi/useMetricsWithDateRange";
import { usePolicies } from "../policies";
import { parseLocalDate } from "../../lib/date";
import type { ActualMetrics } from "../../types/targets.types";

/**
 * Per-cohort persistency: of policies sold ≥ N months ago, what fraction
 * are still active today? Returns 0 when the cohort is empty (no signal),
 * so callers can hide the metric until enough history exists.
 */
function calculateCohortPersistency(
  policies: {
    effectiveDate?: string | null;
    createdAt: string;
    lifecycleStatus?: string | null;
  }[],
  monthsAgo: number,
): number {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsAgo);

  const cohort = policies.filter((p) => {
    const policyDate = p.effectiveDate
      ? parseLocalDate(p.effectiveDate)
      : new Date(p.createdAt);
    return policyDate <= cutoff;
  });

  if (cohort.length === 0) return 0;

  const stillActive = cohort.filter(
    (p) => p.lifecycleStatus === "active",
  ).length;
  return stillActive / cohort.length;
}

/**
 * Fetch actual metrics for targets comparison
 * Returns YTD, QTD, and MTD values for income, policies, and expenses
 */
export const useActualMetrics = (): ActualMetrics => {
  // Fetch metrics for each time period
  const ytdMetrics = useMetricsWithDateRange({ timePeriod: "yearly" });
  const qtdMetrics = useMetricsWithDateRange({
    timePeriod: "monthly",
    periodOffset: 0,
  }); // Quarterly not supported, using monthly
  const mtdMetrics = useMetricsWithDateRange({ timePeriod: "monthly" });
  const { data: policies = [] } = usePolicies();

  // Per-cohort persistency: 13mo and 25mo are different cohorts and must
  // be computed independently. Previously both fell back to overall
  // retentionRate, so the page showed identical numbers.
  const persistency13Month = useMemo(
    () => calculateCohortPersistency(policies, 13),
    [policies],
  );
  const persistency25Month = useMemo(
    () => calculateCohortPersistency(policies, 25),
    [policies],
  );

  // Extract actual values - use .paid (only paid status commissions, not earned)
  return {
    // Income (paid commissions only - actual money received)
    ytdIncome: ytdMetrics.periodCommissions.paid,
    qtdIncome: qtdMetrics.periodCommissions.paid,
    mtdIncome: mtdMetrics.periodCommissions.paid,

    // Policies
    ytdPolicies: ytdMetrics.periodPolicies.newCount,
    mtdPolicies: mtdMetrics.periodPolicies.newCount,

    // Average premium (from current state)
    currentAvgPremium: ytdMetrics.periodPolicies.averagePremium,

    // Persistency (per cohort, not overall retention)
    persistency13Month,
    persistency25Month,

    // Expenses
    mtdExpenses: mtdMetrics.periodExpenses.total,
    currentExpenseRatio:
      ytdMetrics.periodCommissions.paid > 0
        ? ytdMetrics.periodExpenses.total / ytdMetrics.periodCommissions.paid
        : 0,
  };
};
