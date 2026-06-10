// src/services/analytics/segmentationService.ts

import { Policy } from "../../types";
import { parseLocalDate } from "../../lib/date";
import { differenceInMonths } from "date-fns";

/**
 * Client Segmentation Service
 *
 * Segments clients by value, identifies renewal opportunities,
 * and calculates lifetime value metrics.
 */

export type ClientValueTier = "high" | "medium" | "low";

export interface ClientSegment {
  clientId: string;
  clientName: string;
  tier: ClientValueTier;
  totalPolicies: number;
  totalPremium: number;
  avgPremium: number;
  states: string[];
  products: string[];
  firstPolicyDate: Date;
  latestPolicyDate: Date;
  monthsAsClient: number;
}

export interface ClientSegmentationSummary {
  highValue: ClientSegment[];
  mediumValue: ClientSegment[];
  lowValue: ClientSegment[];
  totalClients: number;
  highValueCount: number;
  mediumValueCount: number;
  lowValueCount: number;
  avgPremiumByTier: Record<ClientValueTier, number>;
  totalPremiumByTier: Record<ClientValueTier, number>;
}

export type RenewalRiskLevel = "high" | "medium" | "low";

export interface ClientLifetimeValue {
  clientId: string;
  clientName: string;
  lifetimeValue: number;
  activePolicies: number;
  totalPolicies: number;
  avgPolicyValue: number;
  retentionRate: number; // %
  estimatedFutureValue: number;
  riskScore: number; // 0-100 (higher = more risk)
}

/**
 * Segment clients by value tier
 * Uses Pareto principle: top 20% = high, next 30% = medium, rest = low
 */
export function segmentClientsByValue(
  policies: Policy[],
): ClientSegmentationSummary {
  // Group policies by client. Key on the stable clients.id so two distinct
  // clients who happen to share a name are NOT merged into one segment;
  // fall back to name only for legacy rows without an id.
  const clientMap = new Map<string, Policy[]>();

  policies.forEach((policy) => {
    const clientKey = policy.client?.id || policy.client?.name || "unknown";
    if (!clientMap.has(clientKey)) {
      clientMap.set(clientKey, []);
    }
    clientMap.get(clientKey)!.push(policy);
  });

  // Calculate client metrics
  const clientSegments: ClientSegment[] = [];

  clientMap.forEach((clientPolicies, clientId) => {
    const totalPolicies = clientPolicies.length;
    const totalPremium = clientPolicies.reduce(
      (sum, p) => sum + (p.annualPremium || 0),
      0,
    );
    const avgPremium = totalPolicies > 0 ? totalPremium / totalPolicies : 0;

    // Get unique states and products
    const states = [
      ...new Set(clientPolicies.map((p) => p.client?.state).filter(Boolean)),
    ];
    const products = [...new Set(clientPolicies.map((p) => p.product))];

    // Calculate client tenure
    const policyDates = clientPolicies.map((p) =>
      parseLocalDate(p.effectiveDate),
    );
    const firstPolicyDate = new Date(
      Math.min(...policyDates.map((d) => d.getTime())),
    );
    const latestPolicyDate = new Date(
      Math.max(...policyDates.map((d) => d.getTime())),
    );
    const monthsAsClient = differenceInMonths(new Date(), firstPolicyDate);

    const clientName = clientPolicies[0]?.client?.name || "Unknown";

    clientSegments.push({
      clientId,
      clientName,
      tier: "low", // Will be assigned later
      totalPolicies,
      totalPremium,
      avgPremium,
      states: states as string[],
      products,
      firstPolicyDate,
      latestPolicyDate,
      monthsAsClient,
    });
  });

  // Sort by total premium (descending)
  clientSegments.sort((a, b) => b.totalPremium - a.totalPremium);

  // Assign tiers using Pareto principle
  const totalClients = clientSegments.length;
  const highValueThreshold = Math.floor(totalClients * 0.2); // Top 20%
  const mediumValueThreshold = Math.floor(totalClients * 0.5); // Next 30% (20% + 30% = 50%)

  clientSegments.forEach((segment, index) => {
    if (index < highValueThreshold) {
      segment.tier = "high";
    } else if (index < mediumValueThreshold) {
      segment.tier = "medium";
    } else {
      segment.tier = "low";
    }
  });

  // Calculate summary statistics
  const highValue = clientSegments.filter((c) => c.tier === "high");
  const mediumValue = clientSegments.filter((c) => c.tier === "medium");
  const lowValue = clientSegments.filter((c) => c.tier === "low");

  const totalPremiumByTier: Record<ClientValueTier, number> = {
    high: highValue.reduce((sum, c) => sum + c.totalPremium, 0),
    medium: mediumValue.reduce((sum, c) => sum + c.totalPremium, 0),
    low: lowValue.reduce((sum, c) => sum + c.totalPremium, 0),
  };

  // Average annual premium PER CLIENT in the tier (total tier premium ÷ client
  // count). Previously this averaged each client's own per-policy average — a
  // double-average that underweighted multi-policy clients.
  const avgPremiumByTier: Record<ClientValueTier, number> = {
    high: totalPremiumByTier.high / (highValue.length || 1),
    medium: totalPremiumByTier.medium / (mediumValue.length || 1),
    low: totalPremiumByTier.low / (lowValue.length || 1),
  };

  return {
    highValue,
    mediumValue,
    lowValue,
    totalClients,
    highValueCount: highValue.length,
    mediumValueCount: mediumValue.length,
    lowValueCount: lowValue.length,
    avgPremiumByTier,
    totalPremiumByTier,
  };
}

export interface PolicyChargebackRisk {
  policyId: string;
  clientName: string;
  product: string;
  annualPremium: number;
  atRiskAmount: number; // Actual unearned commission amount at risk of chargeback
  effectiveDate: string;
  monthsInContestability: number;
  riskLevel: RenewalRiskLevel;
}

/**
 * Commission data structure for chargeback risk calculation
 * Uses amount and advanceMonths to calculate at-risk in real-time
 */
export interface CommissionForChargebackRisk {
  policyId: string | null;
  amount: number; // The advance amount paid upfront
  advanceMonths: number; // Typically 9 months
  status: string;
}

/**
 * Calculate at-risk amount for a single commission based on elapsed time
 *
 * Formula: At Risk = Amount × (1 - min(monthsElapsed, advanceMonths) / advanceMonths)
 *
 * @param amount - Commission advance amount
 * @param advanceMonths - Number of months in the advance (typically 9)
 * @param monthsElapsed - Months since policy effective date
 * @returns Unearned amount still at risk of chargeback
 */
function calculateUnearnedAmount(
  amount: number,
  advanceMonths: number,
  monthsElapsed: number,
): number {
  const effectiveAdvanceMonths = advanceMonths || 9;
  const monthsPaid = Math.min(monthsElapsed, effectiveAdvanceMonths);
  const monthlyRate = amount / effectiveAdvanceMonths;
  const earnedAmount = monthlyRate * monthsPaid;
  return Math.max(0, amount - earnedAmount);
}

/**
 * Calculate top chargeback risk policies
 * Returns the top N policies by actual unearned commission amount at risk
 *
 * The "At Risk" amount is calculated in REAL-TIME based on:
 * 1. Policy effective date → months elapsed
 * 2. Commission amount (the advance)
 * 3. Advance months (typically 9)
 *
 * This ensures accuracy regardless of whether database earned/unearned
 * fields have been recently updated.
 *
 * @param policies - All policies
 * @param commissions - All commissions (with amount and advanceMonths)
 * @param limit - Number of results to return (default 5)
 */
export function calculatePolicyChargebackRisk(
  policies: Policy[],
  commissions: CommissionForChargebackRisk[] = [],
  limit: number = 5,
): PolicyChargebackRisk[] {
  const now = new Date();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const CONTESTABILITY_MONTHS = 24;

  // Group commissions by policy ID for efficient lookup
  const policyCommissionsMap = new Map<string, CommissionForChargebackRisk[]>();
  commissions.forEach((commission) => {
    if (
      commission.policyId &&
      commission.status !== "charged_back" &&
      commission.status !== "cancelled"
    ) {
      const existing = policyCommissionsMap.get(commission.policyId) || [];
      existing.push(commission);
      policyCommissionsMap.set(commission.policyId, existing);
    }
  });

  const atRiskPolicies: PolicyChargebackRisk[] = [];

  policies.forEach((policy) => {
    // Only active policies in contestability period
    if (policy.lifecycleStatus !== "active") return;

    const effectiveDate = parseLocalDate(policy.effectiveDate);
    const monthsSinceEffective = Math.floor(
      (now.getTime() - effectiveDate.getTime()) / (DAY_MS * 30),
    );

    // Skip if outside contestability period
    if (monthsSinceEffective >= CONTESTABILITY_MONTHS) return;

    // Get all commissions for this policy
    const policyCommissions = policyCommissionsMap.get(policy.id) || [];

    // Skip policies with no commissions
    if (policyCommissions.length === 0) return;

    // Calculate total at-risk amount in REAL-TIME
    // Sum unearned amounts across all commissions for this policy
    let totalAtRisk = 0;
    policyCommissions.forEach((commission) => {
      totalAtRisk += calculateUnearnedAmount(
        commission.amount,
        commission.advanceMonths,
        monthsSinceEffective,
      );
    });

    // Skip policies with no unearned commission at risk (fully earned)
    if (totalAtRisk <= 0) return;

    let riskLevel: RenewalRiskLevel = "low";
    if (monthsSinceEffective < 6) {
      riskLevel = "high";
    } else if (monthsSinceEffective < 12) {
      riskLevel = "medium";
    }

    atRiskPolicies.push({
      policyId: policy.id,
      clientName: policy.client?.name || "Unknown",
      product: policy.product,
      annualPremium: policy.annualPremium || 0,
      atRiskAmount: totalAtRisk,
      effectiveDate: policy.effectiveDate,
      monthsInContestability: monthsSinceEffective,
      riskLevel,
    });
  });

  // Sort by actual at-risk amount descending (highest financial exposure first)
  return atRiskPolicies
    .sort((a, b) => b.atRiskAmount - a.atRiskAmount)
    .slice(0, limit);
}

/**
 * Calculate client lifetime value
 */
export function getClientLifetimeValue(
  policies: Policy[],
): ClientLifetimeValue[] {
  // Group policies by client
  const clientMap = new Map<string, Policy[]>();

  policies.forEach((policy) => {
    const clientKey = policy.client?.name || "unknown";
    if (!clientMap.has(clientKey)) {
      clientMap.set(clientKey, []);
    }
    clientMap.get(clientKey)!.push(policy);
  });

  const lifetimeValues: ClientLifetimeValue[] = [];

  clientMap.forEach((clientPolicies, clientId) => {
    const totalPolicies = clientPolicies.length;
    const activePolicies = clientPolicies.filter(
      (p) => p.lifecycleStatus === "active",
    ).length;
    const lifetimeValue = clientPolicies.reduce(
      (sum, p) => sum + (p.annualPremium || 0),
      0,
    );
    const avgPolicyValue =
      totalPolicies > 0 ? lifetimeValue / totalPolicies : 0;
    const retentionRate =
      totalPolicies > 0 ? (activePolicies / totalPolicies) * 100 : 0;

    // Estimate future value based on retention and average policy value
    // Assumes client will maintain current retention rate and add 1 policy per year
    const estimatedFutureValue =
      retentionRate > 50
        ? lifetimeValue + avgPolicyValue * (retentionRate / 100) * 3 // 3 years projection
        : lifetimeValue * 0.5; // Conservative if low retention

    // Calculate risk score (0-100, higher = more risk)
    const lapsedPolicies = clientPolicies.filter(
      (p) => p.lifecycleStatus === "lapsed",
    ).length;
    const cancelledPolicies = clientPolicies.filter(
      (p) => p.lifecycleStatus === "cancelled",
    ).length;
    const riskScore =
      totalPolicies > 0
        ? Math.round(
            ((lapsedPolicies + cancelledPolicies) / totalPolicies) * 100,
          )
        : 0;

    const clientName = clientPolicies[0]?.client?.name || "Unknown";

    lifetimeValues.push({
      clientId,
      clientName,
      lifetimeValue,
      activePolicies,
      totalPolicies,
      avgPolicyValue,
      retentionRate,
      estimatedFutureValue,
      riskScore,
    });
  });

  // Sort by lifetime value (descending)
  return lifetimeValues.sort((a, b) => b.lifetimeValue - a.lifetimeValue);
}
