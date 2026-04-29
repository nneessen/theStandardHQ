// src/hooks/targets/useHistoricalAverages.ts

import { useMemo } from "react";
import { usePolicies } from "../policies";
import { useExpenses } from "../expenses/useExpenses";
import { useUserCommissionProfile } from "../commissions/useUserCommissionProfile";
import {
  AnnualExpenseBreakdown,
  AnnualExpenseOneTimeContribution,
  AnnualExpenseRecurringContribution,
  HistoricalAverages,
} from "../../services/targets/targetsCalculationService";
import { currentMonthMetricsService } from "../../services/targets/currentMonthMetricsService";
import { parseLocalDate } from "../../lib/date";

/**
 * Hook to calculate historical averages from user's actual data
 * Used for intelligent target calculations
 *
 * CRITICAL:
 * - Uses REAL commission rates from comp_guide table based on user's contract level
 * - Calculates avgPolicyPremium from CURRENT YEAR's policies for year-to-date accuracy
 * - Falls back to all active/all policies if current year has no data
 */
export function useHistoricalAverages(): {
  averages: HistoricalAverages;
  isLoading: boolean;
  error: Error | null;
} {
  const { data: policies = [], isLoading: policiesLoading } = usePolicies();
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses();
  const {
    data: commissionProfile,
    isLoading: profileLoading,
    error: profileError,
  } = useUserCommissionProfile();

  const isLoading = policiesLoading || expensesLoading || profileLoading;

  // Calculate averages from historical data - MEMOIZED to prevent infinite loops
  // FORCE RECALCULATION when policies change by including policies.length in deps
  const averages: HistoricalAverages = useMemo(() => {
    // CRITICAL: No arbitrary fallbacks! If no commission data, show error
    if (!commissionProfile) {
      return {
        avgCommissionRate: 0,
        avgPolicyPremium: 0,
        avgPoliciesPerMonth: 0,
        avgExpensesPerMonth: 0,
        projectedAnnualExpenses: 0,
        annualExpenseBreakdown: {
          recurring: [],
          oneTime: [],
          recurringTotal: 0,
          oneTimeTotal: 0,
          total: 0,
        },
        persistency13Month: 0,
        persistency25Month: 0,
        hasData: false,
      };
    }

    // Use REAL commission rate from comp_guide (not historical guesses!)
    // This is premium-weighted based on user's actual product mix
    const avgCommissionRate = commissionProfile.recommendedRate;

    // CRITICAL: Calculate average premium from CURRENT YEAR's policies (year-to-date)
    // This provides stable, meaningful target calculations throughout the year
    // Falls back to all active/all policies if current year has no data
    const currentYearMetrics =
      currentMonthMetricsService.calculateCurrentYearAvgPremium(policies);
    const avgPolicyPremium =
      currentYearMetrics.avgPolicyPremium ||
      // Fallback: calculate from all active policies if current year has no data
      (() => {
        const activePolicies = policies.filter(
          (p) => p.lifecycleStatus === "active",
        );
        if (activePolicies.length > 0) {
          return (
            activePolicies.reduce((sum, p) => sum + (p.annualPremium || 0), 0) /
            activePolicies.length
          );
        }
        if (policies.length > 0) {
          return (
            policies.reduce((sum, p) => sum + (p.annualPremium || 0), 0) /
            policies.length
          );
        }
        return 0; // NO defaults - show zero if no policies
      })();

    // Calculate average policies per month
    // Look at the last 12 months of data
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(now.getMonth() - 12);

    const monthlyPolicyCounts: number[] = [];
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthPolicies = policies.filter((p) => {
        const policyDate = new Date(p.createdAt);
        return policyDate >= monthStart && policyDate <= monthEnd;
      });

      if (monthPolicies.length > 0) {
        monthlyPolicyCounts.push(monthPolicies.length);
      }
    }

    const avgPoliciesPerMonth =
      monthlyPolicyCounts.length > 0
        ? monthlyPolicyCounts.reduce((sum, count) => sum + count, 0) /
          monthlyPolicyCounts.length
        : 0; // NO defaults - show zero if no data

    // Calculate average monthly expenses (for monthly display context)
    const monthlyExpenseTotals: number[] = [];
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthExpenses = expenses.filter((e) => {
        const expenseDate = e.date ? new Date(e.date) : new Date(e.created_at);
        return expenseDate >= monthStart && expenseDate <= monthEnd;
      });

      if (monthExpenses.length > 0) {
        const monthTotal = monthExpenses.reduce(
          (sum, e) => sum + (e.amount || 0),
          0,
        );
        monthlyExpenseTotals.push(monthTotal);
      }
    }

    const avgExpensesPerMonth =
      monthlyExpenseTotals.length > 0
        ? monthlyExpenseTotals.reduce((sum, total) => sum + total, 0) /
          monthlyExpenseTotals.length
        : 0; // NO defaults - show zero if no expense data

    // Projected annual expenses for the current calendar year.
    //
    // Why we project from the recurring DEFINITION instead of summing
    // materialized rows: RecurringExpenseService only generates 12 future
    // occurrences at creation, and only extends when the user navigates an
    // expense list past those dates — the Targets page never triggers
    // extension. Summing rows therefore severely undercounts when a recurring
    // is older than its materialization window (e.g. a monthly recurring set
    // up 2 years ago has only Jan of this year materialized).
    //
    // Algorithm:
    //   - One-time expenses dated in current year → face value
    //   - Recurring groups → representative amount (latest in group) ×
    //     occurrence count in current year, respecting recurring_end_date
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);

    type RecurringGroup = {
      startDate: Date;
      latestDate: Date;
      latestAmount: number;
      latestName: string;
      frequency: NonNullable<(typeof expenses)[number]["recurring_frequency"]>;
      endDate: Date | null;
    };
    const recurringGroups = new Map<string, RecurringGroup>();
    let oneTimeYearTotal = 0;
    const oneTimeContributions: AnnualExpenseOneTimeContribution[] = [];

    for (const e of expenses) {
      const eDate = e.date ? parseLocalDate(e.date) : new Date(e.created_at);

      if (e.is_recurring && e.recurring_group_id && e.recurring_frequency) {
        const existing = recurringGroups.get(e.recurring_group_id);
        if (!existing) {
          recurringGroups.set(e.recurring_group_id, {
            startDate: eDate,
            latestDate: eDate,
            latestAmount: e.amount || 0,
            latestName: e.name || "Recurring expense",
            frequency: e.recurring_frequency,
            endDate: e.recurring_end_date
              ? parseLocalDate(e.recurring_end_date)
              : null,
          });
        } else {
          if (eDate < existing.startDate) existing.startDate = eDate;
          if (eDate >= existing.latestDate) {
            existing.latestDate = eDate;
            existing.latestAmount = e.amount || 0;
            existing.latestName = e.name || existing.latestName;
            // Take endDate from the latest-dated row so updates to the
            // recurring's end date take effect even if older rows still hold
            // a stale value.
            existing.endDate = e.recurring_end_date
              ? parseLocalDate(e.recurring_end_date)
              : null;
          }
        }
        continue;
      }

      if (eDate >= yearStart && eDate < nextYearStart) {
        oneTimeYearTotal += e.amount || 0;
        oneTimeContributions.push({
          id: e.id,
          name: e.name || "Untitled expense",
          amount: e.amount || 0,
          date: e.date,
        });
      }
    }

    const advanceByFrequency = (
      cursor: Date,
      frequency: RecurringGroup["frequency"],
      anchorDay: number,
    ): Date => {
      const next = new Date(cursor);
      switch (frequency) {
        case "daily":
          next.setDate(next.getDate() + 1);
          break;
        case "weekly":
          next.setDate(next.getDate() + 7);
          break;
        case "biweekly":
          next.setDate(next.getDate() + 14);
          break;
        case "monthly": {
          next.setMonth(next.getMonth() + 1);
          const lastDay = new Date(
            next.getFullYear(),
            next.getMonth() + 1,
            0,
          ).getDate();
          next.setDate(Math.min(anchorDay, lastDay));
          break;
        }
        case "quarterly": {
          next.setMonth(next.getMonth() + 3);
          const lastDay = new Date(
            next.getFullYear(),
            next.getMonth() + 1,
            0,
          ).getDate();
          next.setDate(Math.min(anchorDay, lastDay));
          break;
        }
        case "semiannually": {
          next.setMonth(next.getMonth() + 6);
          const lastDay = new Date(
            next.getFullYear(),
            next.getMonth() + 1,
            0,
          ).getDate();
          next.setDate(Math.min(anchorDay, lastDay));
          break;
        }
        case "annually":
          next.setFullYear(next.getFullYear() + 1);
          break;
      }
      return next;
    };

    let recurringYearTotal = 0;
    const recurringContributions: AnnualExpenseRecurringContribution[] = [];
    const MAX_ITER = 4000;
    for (const [groupId, group] of recurringGroups.entries()) {
      const upperBound =
        group.endDate && group.endDate < nextYearStart
          ? group.endDate
          : nextYearStart;
      const anchorDay = group.startDate.getDate();

      let cursor = new Date(group.startDate);
      let occurrences = 0;
      let iter = 0;
      while (cursor < upperBound && iter < MAX_ITER) {
        if (cursor >= yearStart) occurrences++;
        cursor = advanceByFrequency(cursor, group.frequency, anchorDay);
        iter++;
      }

      const groupTotal = group.latestAmount * occurrences;
      recurringYearTotal += groupTotal;
      recurringContributions.push({
        groupId,
        name: group.latestName,
        frequency: group.frequency,
        latestAmount: group.latestAmount,
        occurrences,
        total: groupTotal,
        endDate: group.endDate
          ? group.endDate.toISOString().slice(0, 10)
          : null,
      });
    }

    recurringContributions.sort((a, b) => b.total - a.total);
    oneTimeContributions.sort((a, b) => b.amount - a.amount);

    const projectedAnnualExpenses = oneTimeYearTotal + recurringYearTotal;
    const annualExpenseBreakdown: AnnualExpenseBreakdown = {
      recurring: recurringContributions,
      oneTime: oneTimeContributions,
      recurringTotal: recurringYearTotal,
      oneTimeTotal: oneTimeYearTotal,
      total: projectedAnnualExpenses,
    };

    // Calculate persistency rates
    // 13-month persistency: policies still active after 13 months
    const thirteenMonthsAgo = new Date();
    thirteenMonthsAgo.setMonth(now.getMonth() - 13);

    const policiesFrom13MonthsAgo = policies.filter((p) => {
      const policyDate = p.effectiveDate
        ? parseLocalDate(p.effectiveDate)
        : new Date(p.createdAt);
      return policyDate <= thirteenMonthsAgo;
    });

    const still_active_13Month = policiesFrom13MonthsAgo.filter(
      (p) => p.lifecycleStatus === "active",
    ).length;
    const persistency13Month =
      policiesFrom13MonthsAgo.length > 0
        ? still_active_13Month / policiesFrom13MonthsAgo.length
        : 0; // NO defaults - show zero if no data

    // 25-month persistency
    const twentyFiveMonthsAgo = new Date();
    twentyFiveMonthsAgo.setMonth(now.getMonth() - 25);

    const policiesFrom25MonthsAgo = policies.filter((p) => {
      const policyDate = p.effectiveDate
        ? parseLocalDate(p.effectiveDate)
        : new Date(p.createdAt);
      return policyDate <= twentyFiveMonthsAgo;
    });

    const stillActive25Month = policiesFrom25MonthsAgo.filter(
      (p) => p.lifecycleStatus === "active",
    ).length;
    const persistency25Month =
      policiesFrom25MonthsAgo.length > 0
        ? stillActive25Month / policiesFrom25MonthsAgo.length
        : 0; // NO defaults - show zero if no data

    return {
      avgCommissionRate,
      avgPolicyPremium,
      avgPoliciesPerMonth,
      avgExpensesPerMonth,
      projectedAnnualExpenses,
      annualExpenseBreakdown,
      persistency13Month,
      persistency25Month,
      hasData: true,
    };
  }, [commissionProfile, policies, expenses]);

  return {
    averages,
    isLoading,
    error: profileError,
  };
}
