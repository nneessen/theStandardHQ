// src/services/analytics/forecastService.ts

import { Policy, Commission } from "../../types";
import { format, addMonths, differenceInMonths } from "date-fns";
import { parseLocalDate } from "../../lib/date";
import { ANALYTICS_CONSTANTS } from "../../constants/financial";

/**
 * Forecast Service
 *
 * Provides predictive analytics:
 * - Renewal forecasts
 * - Chargeback risk scoring
 * - Growth projections
 * - Seasonality detection
 */

export interface RenewalForecast {
  month: string; // "2025-12" format
  monthLabel: string; // "Dec 2025" display
  expectedRenewals: number;
  expectedRevenue: number;
  policies: Policy[];
  confidence: "high" | "medium" | "low";
}

export interface ChargebackRiskScore {
  policyId: string;
  policyNumber: string | null;
  clientName: string;
  riskScore: number; // 0-100 (higher = more risk)
  riskLevel: "low" | "medium" | "high" | "critical";
  factors: string[]; // Contributing risk factors
  monthsPaid: number;
  unearnedAmount: number;
  recommendedAction: string;
}

export interface GrowthProjection {
  period: string; // "2025-12" format
  periodLabel: string; // "Dec 2025" display
  projectedPolicies: number;
  projectedRevenue: number;
  projectedCommission: number;
  confidence: "high" | "medium" | "low";
  growthRate: number; // % vs previous period
}

export interface SeasonalityPattern {
  month: number; // 1-12
  monthName: string;
  avgPolicies: number;
  avgRevenue: number;
  seasonalIndex: number; // 1.0 = average, >1.0 = above average, <1.0 = below
  trend: "peak" | "above_average" | "average" | "below_average" | "trough";
}

/**
 * Forecast policy renewals for the next 12 months
 */
export function forecastRenewals(policies: Policy[]): RenewalForecast[] {
  const forecasts: RenewalForecast[] = [];
  const now = new Date();

  // For each of next 12 months
  for (let i = 1; i <= 12; i++) {
    const forecastMonth = addMonths(now, i);
    const forecastMonthStr = format(forecastMonth, "yyyy-MM");
    const forecastMonthLabel = format(forecastMonth, "MMM yyyy");

    // Find policies that will be up for renewal this month
    const renewalPolicies = policies.filter((policy) => {
      if (policy.lifecycleStatus !== "active" || !policy.termLength)
        return false;

      // Calculate renewal date
      const effectiveDate = parseLocalDate(policy.effectiveDate);
      const renewalDate = addMonths(effectiveDate, policy.termLength * 12);
      const renewalMonth = format(renewalDate, "yyyy-MM");

      return renewalMonth === forecastMonthStr;
    });

    const expectedRenewals = renewalPolicies.length;

    const ESTIMATED_RENEWAL_RATE_MULTIPLIER =
      ANALYTICS_CONSTANTS.RENEWAL_RATE_MULTIPLIER;
    const expectedRevenue = renewalPolicies.reduce((sum, p) => {
      // Note: This is an ESTIMATE - actual renewal rates vary by carrier and product
      const estimatedRenewalCommission =
        (p.annualPremium || 0) *
        (p.commissionPercentage || 0) *
        ESTIMATED_RENEWAL_RATE_MULTIPLIER;
      return sum + estimatedRenewalCommission;
    }, 0);

    // Confidence based on time horizon
    const confidence: "high" | "medium" | "low" =
      i <= 3 ? "high" : i <= 6 ? "medium" : "low";

    forecasts.push({
      month: forecastMonthStr,
      monthLabel: forecastMonthLabel,
      expectedRenewals,
      expectedRevenue,
      policies: renewalPolicies,
      confidence,
    });
  }

  return forecasts;
}

/**
 * Calculate chargeback risk scores for policies
 */
export function calculateChargebackRisk(
  policies: Policy[],
  commissions: Commission[],
): ChargebackRiskScore[] {
  const commissionMap = new Map(commissions.map((c) => [c.policyId, c]));
  const riskScores: ChargebackRiskScore[] = [];

  policies.forEach((policy) => {
    const commission = commissionMap.get(policy.id);
    if (!commission) return;

    const factors: string[] = [];
    let riskScore = 0;

    // Factor 1: Months paid vs advance months (most important)
    const monthsPaid = commission.monthsPaid || 0;
    const advanceMonths = commission.advanceMonths || 9;
    const paymentProgress =
      advanceMonths > 0 ? (monthsPaid / advanceMonths) * 100 : 0;

    if (paymentProgress < 50) {
      riskScore += 40;
      factors.push(`Only ${monthsPaid}/${advanceMonths} months paid`);
    } else if (paymentProgress < 75) {
      riskScore += 20;
      factors.push(`${monthsPaid}/${advanceMonths} months paid`);
    }

    // Factor 2: Policy status
    if (policy.status === "pending") {
      riskScore += 30;
      factors.push("Policy still pending");
    } else if (policy.lifecycleStatus === "lapsed") {
      riskScore += 60;
      factors.push("Policy has lapsed");
    } else if (policy.lifecycleStatus === "cancelled") {
      riskScore += 80;
      factors.push("Policy cancelled");
    }

    // Factor 3: Unearned amount (higher unearned = higher risk)
    const unearnedAmount = commission.unearnedAmount || 0;
    if (unearnedAmount > 5000) {
      riskScore += 20;
      factors.push(`High unearned amount: $${unearnedAmount.toFixed(0)}`);
    } else if (unearnedAmount > 2000) {
      riskScore += 10;
      factors.push(`Moderate unearned amount: $${unearnedAmount.toFixed(0)}`);
    }

    // Factor 4: Time since last payment
    if (commission.lastPaymentDate) {
      const monthsSincePayment = differenceInMonths(
        new Date(),
        new Date(commission.lastPaymentDate),
      );

      if (monthsSincePayment > 2) {
        riskScore += 15;
        factors.push(`${monthsSincePayment} months since last payment`);
      }
    }

    // Determine risk level
    let riskLevel: ChargebackRiskScore["riskLevel"];
    if (riskScore >= 75) riskLevel = "critical";
    else if (riskScore >= 50) riskLevel = "high";
    else if (riskScore >= 25) riskLevel = "medium";
    else riskLevel = "low";

    // Recommended action
    let recommendedAction = "Monitor normally";
    if (riskLevel === "critical") {
      recommendedAction = "Urgent: Contact client immediately to prevent lapse";
    } else if (riskLevel === "high") {
      recommendedAction = "High priority: Reach out to client this week";
    } else if (riskLevel === "medium") {
      recommendedAction = "Follow up with client within 2 weeks";
    }

    riskScores.push({
      policyId: policy.id,
      policyNumber: policy.policyNumber,
      clientName: policy.client?.name || "Unknown",
      riskScore: Math.min(100, riskScore),
      riskLevel,
      factors,
      monthsPaid,
      unearnedAmount,
      recommendedAction,
    });
  });

  // Sort by risk score (highest first)
  return riskScores.sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Project growth for next 12 months based on historical trends
 */
export function projectGrowth(
  policies: Policy[],
  commissions: Commission[],
): GrowthProjection[] {
  const now = new Date();
  const projections: GrowthProjection[] = [];

  // Calculate historical monthly averages (last 12 months)
  const historicalData: {
    [month: string]: { policies: number; revenue: number; commission: number };
  } = {};

  for (let i = 12; i >= 1; i--) {
    const monthDate = addMonths(now, -i);
    const monthStr = format(monthDate, "yyyy-MM");

    const monthPolicies = policies.filter((p) => {
      const effectiveMonth = format(parseLocalDate(p.effectiveDate), "yyyy-MM");
      return effectiveMonth === monthStr;
    });

    const monthCommissions = commissions.filter((c) => {
      const commissionMonth = format(new Date(c.createdAt), "yyyy-MM");
      return commissionMonth === monthStr;
    });

    historicalData[monthStr] = {
      policies: monthPolicies.length,
      revenue: monthPolicies.reduce(
        (sum, p) => sum + (p.annualPremium || 0),
        0,
      ),
      commission: monthCommissions.reduce((sum, c) => sum + (c.amount || 0), 0),
    };
  }

  // Calculate average growth rate
  const historicalMonths = Object.values(historicalData);
  const avgPolicies =
    historicalMonths.reduce((sum, m) => sum + m.policies, 0) /
    historicalMonths.length;
  const avgRevenue =
    historicalMonths.reduce((sum, m) => sum + m.revenue, 0) /
    historicalMonths.length;
  const avgCommission =
    historicalMonths.reduce((sum, m) => sum + m.commission, 0) /
    historicalMonths.length;

  // Calculate month-over-month growth rates
  const growthRates: number[] = [];
  const months = Object.keys(historicalData).sort();

  for (let i = 1; i < months.length; i++) {
    const prevMonth = historicalData[months[i - 1]];
    const currMonth = historicalData[months[i]];

    if (prevMonth.policies > 0) {
      const growthRate =
        ((currMonth.policies - prevMonth.policies) / prevMonth.policies) * 100;
      growthRates.push(growthRate);
    }
  }

  // Use the MEDIAN month-over-month rate, not the mean — a single ramp month
  // (e.g. 18 → 190 policies) dominates the mean and inflates the entire
  // projection. The median reflects a typical month and ignores that outlier.
  const sortedRates = [...growthRates].sort((a, b) => a - b);
  const medianGrowthRate =
    sortedRates.length === 0
      ? 5 // Default when there is no usable history
      : sortedRates.length % 2 === 1
        ? sortedRates[(sortedRates.length - 1) / 2]
        : (sortedRates[sortedRates.length / 2 - 1] +
            sortedRates[sortedRates.length / 2]) /
          2;

  // Final safety net: bound the (already-robust) rate so pathological history
  // still can't compound into an absurd projection. Per-month band derived from
  // the documented annual caps (MIN −0.5 = −50%/yr, MAX 1.0 = +100%/yr) keeps
  // the 12-month compound within [0.5×, 2×]. (Caps were defined but never
  // applied before this.)
  const monthlyGrowthCap =
    (Math.pow(1 + ANALYTICS_CONSTANTS.MAX_GROWTH_RATE, 1 / 12) - 1) * 100;
  const monthlyGrowthFloor =
    (Math.pow(1 + ANALYTICS_CONSTANTS.MIN_GROWTH_RATE, 1 / 12) - 1) * 100;
  const cappedGrowthRate = Math.max(
    monthlyGrowthFloor,
    Math.min(monthlyGrowthCap, medianGrowthRate),
  );

  // Project next 12 months
  for (let i = 1; i <= 12; i++) {
    const projectionMonth = addMonths(now, i);
    const projectionMonthStr = format(projectionMonth, "yyyy-MM");
    const projectionMonthLabel = format(projectionMonth, "MMM yyyy");

    // Apply growth rate with some variance
    const growthMultiplier = 1 + cappedGrowthRate / 100;
    const compoundGrowth = Math.pow(growthMultiplier, i);

    const projectedPolicies = Math.round(avgPolicies * compoundGrowth);
    const projectedRevenue = Math.round(avgRevenue * compoundGrowth);
    const projectedCommission = Math.round(avgCommission * compoundGrowth);

    // Confidence decreases with time
    const confidence: "high" | "medium" | "low" =
      i <= 3 ? "high" : i <= 6 ? "medium" : "low";

    projections.push({
      period: projectionMonthStr,
      periodLabel: projectionMonthLabel,
      projectedPolicies,
      projectedRevenue,
      projectedCommission,
      confidence,
      growthRate: cappedGrowthRate,
    });
  }

  return projections;
}

/**
 * Detect seasonality patterns in policy sales
 */
export function detectSeasonality(policies: Policy[]): SeasonalityPattern[] {
  // Group policies by month of year (1-12)
  const monthlyData: {
    [month: number]: { policies: number[]; revenue: number[] };
  } = {};

  for (let month = 1; month <= 12; month++) {
    monthlyData[month] = { policies: [], revenue: [] };
  }

  policies.forEach((policy) => {
    const effectiveDate = parseLocalDate(policy.effectiveDate);
    const month = effectiveDate.getMonth() + 1; // 1-12

    monthlyData[month].policies.push(1);
    monthlyData[month].revenue.push(policy.annualPremium || 0);
  });

  // Calculate averages per month, accounting for multiple years of data
  const seasonalPatterns: SeasonalityPattern[] = [];
  const distinctYears =
    new Set(policies.map((p) => parseLocalDate(p.effectiveDate).getFullYear()))
      .size || 1;
  const overallAvgPolicies = policies.length / (12 * distinctYears);

  for (let month = 1; month <= 12; month++) {
    const data = monthlyData[month];
    const avgPolicies = data.policies.length / distinctYears;
    const avgRevenue =
      data.revenue.reduce((sum, r) => sum + r, 0) / distinctYears;

    // Calculate seasonal index (1.0 = average)
    const seasonalIndex =
      overallAvgPolicies > 0 ? avgPolicies / overallAvgPolicies : 1.0;

    // Determine trend
    let trend: SeasonalityPattern["trend"];
    if (seasonalIndex >= 1.3) trend = "peak";
    else if (seasonalIndex >= 1.1) trend = "above_average";
    else if (seasonalIndex >= 0.9) trend = "average";
    else if (seasonalIndex >= 0.7) trend = "below_average";
    else trend = "trough";

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    seasonalPatterns.push({
      month,
      monthName: monthNames[month - 1],
      avgPolicies,
      avgRevenue,
      seasonalIndex,
      trend,
    });
  }

  return seasonalPatterns;
}

/**
 * Get forecast summary statistics
 */
export function getForecastSummary(
  policies: Policy[],
  commissions: Commission[],
) {
  const renewals = forecastRenewals(policies);
  const risks = calculateChargebackRisk(policies, commissions);
  const growth = projectGrowth(policies, commissions);
  const seasonality = detectSeasonality(policies);

  // Next 3 months renewal summary
  const next3MonthsRenewals = renewals
    .slice(0, 3)
    .reduce((sum, r) => sum + r.expectedRenewals, 0);
  const next3MonthsRevenue = renewals
    .slice(0, 3)
    .reduce((sum, r) => sum + r.expectedRevenue, 0);

  // High risk policies count
  const highRiskPolicies = risks.filter(
    (r) => r.riskLevel === "high" || r.riskLevel === "critical",
  ).length;
  const totalUnearned = risks.reduce((sum, r) => sum + r.unearnedAmount, 0);

  // Peak season
  const peakMonth = seasonality.reduce((peak, month) =>
    month.seasonalIndex > peak.seasonalIndex ? month : peak,
  );

  // Growth outlook
  const next3MonthsGrowth = growth.slice(0, 3);
  const avgGrowthRate =
    next3MonthsGrowth.reduce((sum, g) => sum + g.growthRate, 0) /
    next3MonthsGrowth.length;

  return {
    renewals: {
      next3Months: next3MonthsRenewals,
      next3MonthsRevenue,
      total12Months: renewals.reduce((sum, r) => sum + r.expectedRenewals, 0),
    },
    risk: {
      highRiskPolicies,
      totalUnearned,
      criticalPolicies: risks.filter((r) => r.riskLevel === "critical").length,
    },
    growth: {
      avgGrowthRate,
      next3MonthsProjection: next3MonthsGrowth.reduce(
        (sum, g) => sum + g.projectedCommission,
        0,
      ),
    },
    seasonality: {
      peakMonth: peakMonth.monthName,
      peakIndex: peakMonth.seasonalIndex,
    },
  };
}
