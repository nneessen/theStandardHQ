// src/hooks/analytics/useAnalyticsData.ts

// React 19.1 optimizes automatically - useMemo removed
import { usePolicies } from "../policies";
import { useCommissions } from "../commissions";
import { useExpenses } from "../expenses";
import { useCarriers } from "../carriers";
import {
  getCohortRetention,
  getChargebacksByCohort,
  getEarningProgressByCohort,
  getCohortSummary,
  segmentClientsByValue,
  calculatePolicyChargebackRisk,
  getClientLifetimeValue,
  forecastRenewals,
  calculateChargebackRisk,
  projectGrowth,
  detectSeasonality,
  calculateContribution,
  getProductMixEvolution,
  calculateCarrierROI,
  getTopMovers,
} from "../../services/analytics";
import { parseLocalDate } from "../../lib/date";

export interface UseAnalyticsDataOptions {
  startDate?: Date;
  endDate?: Date;
}

/**
 * Centralized analytics data aggregation hook
 *
 * Combines all analytics services with TanStack Query data fetching.
 * All calculations are memoized for performance.
 *
 * @param options - Optional date range filter
 * @returns Comprehensive analytics data object
 */
export function useAnalyticsData(options?: UseAnalyticsDataOptions) {
  const { startDate, endDate } = options || {};

  // Fetch all required data from Supabase
  const { data: allPolicies = [], isLoading: policiesLoading } = usePolicies();
  const { data: allCommissions = [], isLoading: commissionsLoading } =
    useCommissions();
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses();
  const { data: carriers = [], isLoading: carriersLoading } = useCarriers();

  // Filter data by date range if provided (React 19.1 optimizes automatically)
  const policies =
    !startDate || !endDate
      ? allPolicies
      : allPolicies.filter((p) => {
          const date = parseLocalDate(p.submitDate || p.effectiveDate);
          return date >= startDate && date <= endDate;
        });

  const commissions =
    !startDate || !endDate
      ? allCommissions
      : allCommissions.filter((c) => {
          // Use paymentDate for paid commissions, createdAt as fallback
          // paymentDate can be string (DATE) or Date; createdAt is always Date
          const date =
            c.status === "paid" && c.paymentDate
              ? typeof c.paymentDate === "string"
                ? parseLocalDate(c.paymentDate)
                : c.paymentDate
              : c.createdAt;
          return date >= startDate && date <= endDate;
        });

  // Calculate loading state
  const isLoading =
    policiesLoading || commissionsLoading || expensesLoading || carriersLoading;

  // Cohort Analysis - all cohort-related metrics (React 19.1 optimizes automatically)
  const cohortData = {
    retention: getCohortRetention(policies),
    chargebacks: getChargebacksByCohort(policies, commissions),
    earningProgress: getEarningProgressByCohort(policies, commissions),
    summary: getCohortSummary(policies, commissions),
  };

  // Client Segmentation - client value and chargeback risk (React 19.1 optimizes automatically)
  // Map commissions to the minimal shape needed for real-time at-risk calculation
  // Uses amount and advanceMonths to calculate unearned in real-time based on policy effective date
  const commissionsForRisk = commissions.map((c) => ({
    policyId: c.policyId ?? null,
    amount: c.amount ?? 0, // The advance amount paid
    advanceMonths: c.advanceMonths ?? 9, // Typically 9 months
    status: c.status,
  }));

  const segmentationData = {
    segments: segmentClientsByValue(policies),
    chargebackRisk: calculatePolicyChargebackRisk(
      policies,
      commissionsForRisk,
      5,
    ), // Top 5 highest at-risk (calculated real-time from policy effective date)
    ltv: getClientLifetimeValue(policies),
  };

  // Predictive Analytics - forecasting and risk (React 19.1 optimizes automatically)
  const forecastData = {
    renewals: forecastRenewals(policies),
    chargebackRisk: calculateChargebackRisk(policies, commissions),
    growth: projectGrowth(policies, commissions),
    seasonality: detectSeasonality(policies),
  };

  // Performance Attribution - decomposition analysis
  // Derive current/previous period from the selected date range
  const rangeStart =
    startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const rangeEnd = endDate || new Date();
  const rangeLengthMs = rangeEnd.getTime() - rangeStart.getTime();
  const prevPeriodStart = new Date(rangeStart.getTime() - rangeLengthMs);
  const prevPeriodEnd = new Date(rangeStart.getTime() - 1);

  // Current period = the filtered data (already bounded by startDate/endDate)
  const currentPolicies = policies;
  const currentCommissions = commissions;

  // Previous period = same-length window before the selected range
  const previousPolicies = allPolicies.filter((p) => {
    const date = parseLocalDate(p.submitDate || p.effectiveDate);
    return date >= prevPeriodStart && date <= prevPeriodEnd;
  });

  const previousCommissions = allCommissions.filter((c) => {
    const date = new Date(c.createdAt);
    return date >= prevPeriodStart && date <= prevPeriodEnd;
  });

  // React 19.1 optimizes automatically - no need for useMemo
  const attributionData = {
    contribution: calculateContribution(
      currentPolicies,
      currentCommissions,
      previousPolicies,
      previousCommissions,
    ),
    productMix: getProductMixEvolution(policies),
    carrierROI: calculateCarrierROI(policies, commissions, carriers),
    topMovers: getTopMovers(
      currentPolicies,
      currentCommissions,
      previousPolicies,
      previousCommissions,
      carriers,
    ),
  };

  return {
    isLoading,
    cohort: cohortData,
    segmentation: segmentationData,
    forecast: forecastData,
    attribution: attributionData,
    // Raw data for custom calculations
    raw: {
      policies,
      commissions,
      expenses,
      carriers,
    },
  };
}
