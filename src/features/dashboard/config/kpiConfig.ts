// src/features/dashboard/config/kpiConfig.ts

/**
 * KPI Configuration for DetailedKPIGrid
 *
 * Generates the configuration array for detailed KPI breakdown sections.
 * Previously inline in DashboardHome.tsx (lines 1246-1414).
 */

import { TimePeriod } from "../../../utils/dateRange";
import { KPISection } from "../../../types/dashboard.types";
import { formatCurrency, formatPercent } from "../../../lib/format";
import type { DashboardFeatures } from "../../../hooks/dashboard";

interface KPIConfigParams {
  timePeriod: TimePeriod;
  features?: DashboardFeatures;
  periodCommissions: {
    earned: number;
    count: number;
    averageAmount: number;
    averageRate: number;
  };
  periodExpenses: {
    total: number;
    count: number;
    recurring: number;
    oneTime: number;
    taxDeductible: number;
  };
  periodPolicies: {
    newCount: number;
    cancelled: number;
    lapsed: number;
    premiumWritten: number;
    averagePremium: number;
    commissionableValue: number;
  };
  periodClients: {
    newCount: number;
    totalValue: number;
    averageAge: number;
  };
  periodAnalytics: {
    netIncome: number;
    profitMargin: number;
    paceMetrics: {
      dailyTarget: number;
      weeklyTarget: number;
      monthlyTarget: number;
    };
    policiesNeeded: number;
  };
  currentState: {
    activePolicies: number;
    totalPolicies: number;
    totalClients: number;
    pendingPipeline: number;
    retentionRate: number;
  };
  derivedMetrics: {
    lapsedRate: number;
    cancellationRate: number;
    avgClientValue: number;
  };
  breakevenDisplay: number;
  policiesNeededDisplay: number;
}

/**
 * Generate KPI sections configuration for the DetailedKPIGrid
 */
export function generateKPIConfig(params: KPIConfigParams): KPISection[] {
  const {
    periodExpenses,
    periodPolicies,
    currentState,
    derivedMetrics,
    periodAnalytics,
    features,
  } = params;

  // Determine if Financial Details section should be gated (requires expenses feature)
  const canViewExpenses = features?.canViewExpenses ?? true;

  // KPI Breakdown: Detailed metrics not shown elsewhere
  return [
    {
      category: "Financial Details",
      kpis: [
        {
          label: "Profit Margin",
          value: formatPercent(periodAnalytics.profitMargin),
          intensity: {
            numeric: periodAnalytics.profitMargin,
            direction: "higher_better",
            target: 30,
          },
        },
        {
          label: "Recurring Expenses",
          value: formatCurrency(periodExpenses.recurring),
        },
        {
          label: "One-Time Expenses",
          value: formatCurrency(periodExpenses.oneTime),
        },
        {
          label: "Tax Deductible",
          value: formatCurrency(periodExpenses.taxDeductible),
        },
      ],
      gated: !canViewExpenses,
      requiredTier: "Starter",
    },
    {
      category: "Policy Health",
      kpis: [
        { label: "Active Policies", value: currentState.activePolicies },
        {
          label: "Retention Rate",
          value: formatPercent(currentState.retentionRate),
          intensity: {
            numeric: currentState.retentionRate,
            direction: "higher_better",
            target: 90,
          },
        },
        { label: "Cancelled", value: periodPolicies.cancelled },
        { label: "Lapsed", value: periodPolicies.lapsed },
        {
          label: "Lapse Rate",
          value: formatPercent(derivedMetrics.lapsedRate),
          intensity: {
            numeric: derivedMetrics.lapsedRate,
            direction: "lower_better",
            target: 5,
          },
        },
      ],
    },
    {
      category: "Client Details",
      kpis: [
        { label: "Total Clients", value: currentState.totalClients },
        {
          label: "Policies/Client",
          value:
            currentState.totalClients > 0
              ? (
                  currentState.totalPolicies / currentState.totalClients
                ).toFixed(2)
              : "0",
          intensity:
            currentState.totalClients > 0
              ? {
                  numeric:
                    currentState.totalPolicies / currentState.totalClients,
                  direction: "higher_better",
                  target: 1.5,
                }
              : undefined,
        },
        {
          label: "Avg Client Value",
          value: formatCurrency(derivedMetrics.avgClientValue),
        },
      ],
    },
  ];
}
