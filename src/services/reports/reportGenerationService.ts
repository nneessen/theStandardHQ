// src/services/reports/reportGenerationService.ts

import {
  Report,
  ReportFilters,
  ReportType,
  ReportSection,
  ReportMetric,
} from "../../types/reports.types";
import { Database } from "../../types/database.types";
import { supabase } from "../base/supabase";
import { InsightsService } from "./insightsService";
import { ForecastingService } from "./forecastingService";
import { formatCurrency, formatPercent } from "../../lib/format";
import { logger } from "../base/logger";

// Type aliases for MV row types (used by secure RPCs)
type CommissionAgingRow =
  Database["public"]["Views"]["mv_commission_aging"]["Row"];
type ClientLtvRow = Database["public"]["Views"]["mv_client_ltv"]["Row"];
type CohortRetentionRow =
  Database["public"]["Views"]["mv_cohort_retention"]["Row"];
type ProductionVelocityRow =
  Database["public"]["Views"]["mv_production_velocity"]["Row"];
type ExpenseSummaryRow =
  Database["public"]["Views"]["mv_expense_summary"]["Row"];
type ChargebackSummaryRow =
  Database["public"]["Views"]["commission_chargeback_summary"]["Row"];

interface GenerateReportOptions {
  userId: string;
  type: ReportType;
  filters: ReportFilters;
}

/**
 * Custom error class for report data fetch failures
 * Provides context about which data source failed
 */
export class ReportDataFetchError extends Error {
  constructor(
    public readonly dataSource: string,
    public readonly originalError: unknown,
  ) {
    super(`Failed to fetch ${dataSource}: ${formatFetchError(originalError)}`);
    this.name = "ReportDataFetchError";
  }
}

/**
 * Normalize the many shapes a fetch error can take (Error, Supabase
 * PostgrestError-like { message, details, hint, code }, plain string,
 * or arbitrary object) into a human-readable string. Avoids the
 * `[object Object]` trap when callers pass a plain Supabase error object.
 */
function formatFetchError(err: unknown): string {
  if (err == null) return "Unknown error";
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const e = err as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const parts: string[] = [];
    if (typeof e.message === "string" && e.message) parts.push(e.message);
    if (typeof e.details === "string" && e.details) parts.push(e.details);
    if (typeof e.hint === "string" && e.hint) parts.push(`hint: ${e.hint}`);
    if (typeof e.code === "string" && e.code) parts.push(`code ${e.code}`);
    if (parts.length > 0) return parts.join(" · ");
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

/**
 * Report Generation Service - Creates comprehensive, actionable reports
 */
export class ReportGenerationService {
  /**
   * Generate a report based on type and filters
   */
  static async generateReport(options: GenerateReportOptions): Promise<Report> {
    const { userId, type, filters } = options;

    switch (type) {
      case "executive-dashboard":
        return this.generateExecutiveDashboard(userId, filters);
      case "commission-performance":
        return this.generateCommissionReport(userId, filters);
      case "policy-performance":
        return this.generatePolicyReport(userId, filters);
      case "client-relationship":
        return this.generateClientReport(userId, filters);
      case "financial-health":
        return this.generateFinancialReport(userId, filters);
      case "predictive-analytics":
        return this.generatePredictiveReport(userId, filters);
      default:
        throw new Error(`Unknown report type: ${type}`);
    }
  }

  /**
   * Generate Executive Dashboard Report
   * HIGH-LEVEL SNAPSHOT ONLY - no detailed tables
   * Designed to give quick overview and drive to detailed reports
   */
  private static async generateExecutiveDashboard(
    userId: string,
    filters: ReportFilters,
  ): Promise<Report> {
    // Fetch core data in parallel - minimal queries for snapshot
    const [commissions, expenses, policies, insights] = await Promise.all([
      this.fetchCommissionData(userId, filters),
      this.fetchExpenseData(userId, filters),
      this.fetchPolicyData(userId, filters),
      InsightsService.generateInsights({
        userId,
        startDate: filters.startDate,
        endDate: filters.endDate,
      }),
    ]);

    // Calculate key metrics
    const totalCommissionPaid = commissions
      .filter((c) => c.status === "paid")
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netIncome = totalCommissionPaid - totalExpenses;

    // Use lifecycle_status for active policy counting (issued, in-force policies)
    const activePolicies = policies.filter(
      (p) => p.lifecycle_status === "active",
    ).length;
    const totalPolicies = policies.length;
    const totalPremium = policies.reduce(
      (sum, p) => sum + (p.annual_premium || 0),
      0,
    );
    const retentionRate =
      totalPolicies > 0 ? activePolicies / totalPolicies : 0;

    const healthScore = this.calculateHealthScore({
      netIncome,
      activePolicies,
      totalPolicies,
      insights,
    });

    // Executive summary - 6 key numbers only
    const keyMetrics: ReportMetric[] = [
      {
        label: "Net Income",
        value: formatCurrency(netIncome),
        trend: netIncome >= 0 ? "up" : "down",
      },
      { label: "Commission Paid", value: formatCurrency(totalCommissionPaid) },
      { label: "Expenses", value: formatCurrency(totalExpenses) },
      { label: "Active Policies", value: activePolicies },
      { label: "Total Premium", value: formatCurrency(totalPremium) },
      { label: "Retention", value: formatPercent(retentionRate * 100) },
    ];

    // Single section with top insights - no redundant tables
    const sections: ReportSection[] = [
      {
        id: "key-insights",
        title: "Action Items",
        description: "Top priorities requiring attention",
        insights: insights.slice(0, 3),
      },
    ];

    return {
      id: `exec-${Date.now()}`,
      type: "executive-dashboard",
      title: "Executive Summary",
      subtitle: `${filters.startDate.toLocaleDateString()} - ${filters.endDate.toLocaleDateString()}`,
      generatedAt: new Date(),
      filters,
      summary: {
        healthScore,
        keyMetrics,
        topInsights: insights.slice(0, 3),
      },
      sections,
    };
  }

  /**
   * Generate Commission Performance Report
   * DEEP DIVE: Commission risk, carrier profitability, chargebacks
   * NOT for basic totals (see Executive Dashboard)
   */
  private static async generateCommissionReport(
    userId: string,
    filters: ReportFilters,
  ): Promise<Report> {
    // First check if user has any actual policies to avoid showing stale MV data
    const { count: policyCount } = await supabase
      .from("policies")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const hasNoPolicies = (policyCount ?? 0) === 0;

    // Fetch MVs for deep analysis (using secure RPCs that enforce auth.uid())
    const [chargebackSummaryResult, carrierPerformance, commissionAging] =
      await Promise.all([
        supabase.rpc("get_user_commission_chargeback_summary"),
        // Only fetch carrier performance if user has policies
        hasNoPolicies
          ? Promise.resolve([])
          : this.fetchCarrierPerformance(userId, filters),
        // Only fetch commission aging if user has policies
        hasNoPolicies ? Promise.resolve([]) : this.fetchCommissionAging(),
      ]);

    if (chargebackSummaryResult.error) {
      throw new Error(
        `Failed to fetch chargeback summary: ${chargebackSummaryResult.error.message}`,
      );
    }

    // Default to zeros if user has no commissions yet
    const chargebackSummary: ChargebackSummaryRow =
      (chargebackSummaryResult.data as ChargebackSummaryRow) || {
        total_chargebacks: 0,
        total_chargeback_amount: 0,
        total_advances: 0,
        total_earned: 0,
        chargeback_rate_percentage: 0,
        charged_back_count: 0,
        high_risk_count: 0,
        at_risk_amount: 0,
        user_id: null,
      };

    // Risk metrics from aging MV
    const totalAtRisk = commissionAging.reduce(
      (sum, bucket) => sum + (bucket.total_at_risk || 0),
      0,
    );
    const totalEarned = commissionAging.reduce(
      (sum, bucket) => sum + (bucket.total_earned || 0),
      0,
    );
    const criticalRisk = commissionAging.find(
      (b) => b.risk_level === "Critical",
    );
    const _highRisk = commissionAging.find((b) => b.risk_level === "High");

    // Carrier profitability table
    const carrierTableRows = carrierPerformance
      .sort(
        (a, b) =>
          (b.total_commission_amount || 0) - (a.total_commission_amount || 0),
      )
      .map((carrier) => [
        carrier.carrier_name || "Unknown",
        formatCurrency(carrier.total_commission_amount || 0),
        formatPercent(carrier.avg_commission_rate_pct || 0),
        formatPercent(carrier.persistency_rate || 0),
        carrier.total_policies || 0,
      ]);

    // Aging risk table
    const agingTableRows = commissionAging.map((bucket) => [
      bucket.aging_bucket || "Unknown",
      bucket.commission_count || 0,
      formatCurrency(bucket.total_at_risk || 0),
      bucket.risk_level || "Unknown",
    ]);

    // Build sections conditionally based on available data
    const sections: ReportSection[] = [];

    // Risk summary section - always show but with empty state message if no data
    if (hasNoPolicies) {
      sections.push({
        id: "no-data",
        title: "No Data Available",
        description:
          "You have no policies in the system. Add policies to see commission risk analysis.",
        metrics: [],
      });
    } else {
      sections.push({
        id: "risk-summary",
        title: "Chargeback Risk Summary",
        metrics: [
          { label: "Total At-Risk", value: formatCurrency(totalAtRisk) },
          { label: "Total Earned (Safe)", value: formatCurrency(totalEarned) },
          {
            label: "Critical Risk",
            value: formatCurrency(criticalRisk?.total_at_risk || 0),
            description: "Policies < 3 months",
          },
          {
            label: "Chargeback Rate",
            value: formatPercent(
              chargebackSummary?.chargeback_rate_percentage || 0,
            ),
          },
        ],
      });

      // Only add aging and profitability sections if there's data
      if (agingTableRows.length > 0) {
        sections.push({
          id: "commission-aging",
          title: "Risk by Policy Age",
          description: "Younger policies = higher chargeback risk",
          tableData: {
            headers: ["Age Bucket", "Count", "At-Risk Amount", "Risk Level"],
            rows: agingTableRows,
          },
        });
      }

      if (carrierTableRows.length > 0) {
        sections.push({
          id: "carrier-profitability",
          title: "Carrier Profitability",
          description: "Commission rates and persistency by carrier",
          tableData: {
            headers: [
              "Carrier",
              "Commission",
              "Comm Rate",
              "Persistency",
              "Policies",
            ],
            rows: carrierTableRows,
          },
        });
      }
    }

    const insights = await InsightsService.generateInsights({
      userId,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    // Calculate totals from MV data
    const totalPolicies = carrierPerformance.reduce(
      (sum, c) => sum + (c.total_policies || 0),
      0,
    );
    const activePolicies = carrierPerformance.reduce(
      (sum, c) => sum + (c.active_policies || 0),
      0,
    );

    const healthScore = this.calculateHealthScore({
      netIncome: 0,
      activePolicies,
      totalPolicies,
      insights,
    });

    return {
      id: `comm-${Date.now()}`,
      type: "commission-performance",
      title: "Commission Risk Analysis",
      subtitle: `${filters.startDate.toLocaleDateString()} - ${filters.endDate.toLocaleDateString()}`,
      generatedAt: new Date(),
      filters,
      summary: {
        healthScore,
        keyMetrics: sections[0].metrics || [],
        topInsights: insights
          .filter((i) => i.category === "chargeback")
          .slice(0, 2),
      },
      sections,
    };
  }

  /**
   * Generate Policy Performance Report
   * DEEP DIVE: Cohort retention, persistency trends, lapse analysis
   * NOT for basic policy counts (see Executive Dashboard)
   */
  private static async generatePolicyReport(
    userId: string,
    filters: ReportFilters,
  ): Promise<Report> {
    // First check if user has any actual policies to avoid showing stale MV data
    const { count: policyCount } = await supabase
      .from("policies")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const hasNoPolicies = (policyCount ?? 0) === 0;

    // Fetch cohort retention MV + carrier performance for persistency breakdown
    const [cohortRetention, carrierPerformance, insights] = await Promise.all([
      hasNoPolicies ? Promise.resolve([]) : this.fetchCohortRetention(),
      hasNoPolicies
        ? Promise.resolve([])
        : this.fetchCarrierPerformance(userId, filters),
      InsightsService.generateInsights({
        userId,
        startDate: filters.startDate,
        endDate: filters.endDate,
      }),
    ]);

    // Calculate 13-month persistency from mature cohorts
    const matureCohorts = cohortRetention.filter(
      (c) => (c.months_since_issue || 0) >= 13,
    );
    const avgPersistency13Month =
      matureCohorts.length > 0
        ? matureCohorts.reduce((sum, c) => sum + (c.retention_rate || 0), 0) /
          matureCohorts.length
        : 0;

    // Get unique cohort months for retention table
    const uniqueCohorts = [
      ...new Map(cohortRetention.map((c) => [c.cohort_month, c])).values(),
    ].slice(0, 6);

    // Cohort retention table
    const cohortTableRows = uniqueCohorts.map((cohort) => {
      const cohortDate = cohort.cohort_month
        ? new Date(cohort.cohort_month)
        : new Date();
      return [
        cohortDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
        }),
        cohort.cohort_size || 0,
        cohort.still_active || 0,
        formatPercent(cohort.retention_rate || 0),
      ];
    });

    // Persistency by carrier table
    const persistencyByCarrier = carrierPerformance
      .filter((c) => (c.total_policies || 0) > 0)
      .sort((a, b) => (b.persistency_rate || 0) - (a.persistency_rate || 0))
      .map((carrier) => [
        carrier.carrier_name || "Unknown",
        formatPercent(carrier.persistency_rate || 0),
        carrier.active_policies || 0,
        carrier.lapsed_policies || 0,
      ]);

    // Build sections conditionally based on available data
    const sections: ReportSection[] = [];

    if (hasNoPolicies) {
      sections.push({
        id: "no-data",
        title: "No Data Available",
        description:
          "You have no policies in the system. Add policies to see persistency analysis.",
        metrics: [],
      });
    } else {
      sections.push({
        id: "persistency-summary",
        title: "Persistency Overview",
        metrics: [
          {
            label: "13-Month Persistency",
            value: formatPercent(avgPersistency13Month || 0),
          },
          { label: "Total Cohorts Tracked", value: uniqueCohorts.length },
        ],
      });

      if (cohortTableRows.length > 0) {
        sections.push({
          id: "cohort-retention",
          title: "Cohort Retention",
          description: "How each month's policies retain over time",
          tableData: {
            headers: ["Cohort Month", "Initial", "Active", "Retention"],
            rows: cohortTableRows,
          },
        });
      }

      if (persistencyByCarrier.length > 0) {
        sections.push({
          id: "persistency-by-carrier",
          title: "Persistency by Carrier",
          description: "Which carriers have the best retention",
          tableData: {
            headers: ["Carrier", "Persistency", "Active", "Lapsed"],
            rows: persistencyByCarrier,
          },
        });
      }
    }

    const totalPolicies = carrierPerformance.reduce(
      (sum, c) => sum + (c.total_policies || 0),
      0,
    );
    const activePolicies = carrierPerformance.reduce(
      (sum, c) => sum + (c.active_policies || 0),
      0,
    );

    const healthScore = this.calculateHealthScore({
      netIncome: 0,
      activePolicies,
      totalPolicies,
      insights,
    });

    return {
      id: `policy-${Date.now()}`,
      type: "policy-performance",
      title: "Persistency Analysis",
      subtitle: `${filters.startDate.toLocaleDateString()} - ${filters.endDate.toLocaleDateString()}`,
      generatedAt: new Date(),
      filters,
      summary: {
        healthScore,
        keyMetrics: sections[0].metrics || [],
        topInsights: insights
          .filter((i) => i.category === "retention")
          .slice(0, 2),
      },
      sections,
    };
  }

  /**
   * Generate Client Relationship Report
   * DEEP DIVE: Client segmentation, cross-sell opportunities, top clients
   * NOT for basic counts (see Executive Dashboard)
   */
  private static async generateClientReport(
    userId: string,
    filters: ReportFilters,
  ): Promise<Report> {
    // First check if user has any clients to avoid showing stale MV data
    const { count: clientCount } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const hasNoClients = (clientCount ?? 0) === 0;

    // Fetch client LTV from MV (uses secure RPC with auth.uid())
    const [clientLTV, insights] = await Promise.all([
      hasNoClients ? Promise.resolve([]) : this.fetchClientLTV(),
      InsightsService.generateInsights({
        userId,
        startDate: filters.startDate,
        endDate: filters.endDate,
      }),
    ]);

    const totalClients = clientLTV.length;
    const activePolicies = clientLTV.reduce(
      (sum, c) => sum + (c.active_policies || 0),
      0,
    );
    const avgPoliciesPerClient =
      totalClients > 0 ? activePolicies / totalClients : 0;
    const crossSellOpportunities = clientLTV.filter(
      (c) => c.cross_sell_opportunity,
    ).length;

    // Client tiers
    const tierCounts = clientLTV.reduce(
      (acc, c) => {
        const tier = c.client_tier || "D";
        acc[tier] = (acc[tier] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const tierTableRows = [
      ["A - High Value", tierCounts["A"] || 0, "$5,000+"],
      ["B - Medium", tierCounts["B"] || 0, "$2,000-$4,999"],
      ["C - Standard", tierCounts["C"] || 0, "$500-$1,999"],
      ["D - Low", tierCounts["D"] || 0, "<$500"],
    ];

    // Top 5 clients only
    const topClientsRows = clientLTV
      .sort((a, b) => (b.active_premium || 0) - (a.active_premium || 0))
      .slice(0, 5)
      .map((client) => [
        client.client_name || "Unknown",
        formatCurrency(client.active_premium || 0),
        client.active_policies || 0,
        client.client_tier || "D",
      ]);

    // Cross-sell opportunities list
    const crossSellClients = clientLTV
      .filter((c) => c.cross_sell_opportunity)
      .sort((a, b) => (b.active_premium || 0) - (a.active_premium || 0))
      .slice(0, 5)
      .map((client) => [
        client.client_name || "Unknown",
        formatCurrency(client.active_premium || 0),
        "Single policy",
      ]);

    // Build sections conditionally based on available data
    const sections: ReportSection[] = [];

    if (hasNoClients) {
      sections.push({
        id: "no-data",
        title: "No Data Available",
        description:
          "You have no clients in the system. Add clients to see client analysis.",
        metrics: [],
      });
    } else {
      sections.push({
        id: "client-overview",
        title: "Client Overview",
        metrics: [
          { label: "Total Clients", value: totalClients },
          {
            label: "Avg Policies/Client",
            value: avgPoliciesPerClient.toFixed(1),
          },
          { label: "Cross-Sell Opportunities", value: crossSellOpportunities },
        ],
      });

      if (tierTableRows.some((row) => (row[1] as number) > 0)) {
        sections.push({
          id: "client-tiers",
          title: "Client Segmentation",
          tableData: {
            headers: ["Tier", "Count", "Premium Range"],
            rows: tierTableRows,
          },
        });
      }

      if (topClientsRows.length > 0) {
        sections.push({
          id: "top-clients",
          title: "Top Clients",
          tableData: {
            headers: ["Client", "Premium", "Policies", "Tier"],
            rows: topClientsRows,
          },
        });
      }

      if (crossSellClients.length > 0) {
        sections.push({
          id: "cross-sell",
          title: "Cross-Sell Targets",
          description: "High-value clients with only one policy",
          tableData: {
            headers: ["Client", "Premium", "Status"],
            rows: crossSellClients,
          },
        });
      }
    }

    const totalPolicies = clientLTV.reduce(
      (sum, c) => sum + (c.total_policies || 0),
      0,
    );
    const healthScore = this.calculateHealthScore({
      netIncome: 0,
      activePolicies,
      totalPolicies,
      insights,
    });

    return {
      id: `client-${Date.now()}`,
      type: "client-relationship",
      title: "Client Analysis",
      subtitle: `${filters.startDate.toLocaleDateString()} - ${filters.endDate.toLocaleDateString()}`,
      generatedAt: new Date(),
      filters,
      summary: {
        healthScore,
        keyMetrics: sections[0].metrics || [],
        topInsights: insights
          .filter((i) => i.category === "opportunity")
          .slice(0, 2),
      },
      sections,
    };
  }

  /**
   * Generate Financial Health Report
   * DEEP DIVE: Expense breakdown, category analysis, profitability
   * NOT for basic totals (see Executive Dashboard)
   */
  private static async generateFinancialReport(
    userId: string,
    filters: ReportFilters,
  ): Promise<Report> {
    // Fetch expense summary MV + raw expense data for breakdown
    const [_expenseSummary, expenses, commissions, insights] =
      await Promise.all([
        this.fetchExpenseSummary(),
        this.fetchExpenseData(userId, filters),
        this.fetchCommissionData(userId, filters),
        InsightsService.generateInsights({
          userId,
          startDate: filters.startDate,
          endDate: filters.endDate,
        }),
      ]);

    const totalCommission = commissions
      .filter((c) => c.status === "paid")
      .reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const expenseRatio =
      totalCommission > 0 ? (totalExpenses / totalCommission) * 100 : 0;

    // Aggregate expenses by category
    const byCategory = expenses.reduce(
      (acc, e) => {
        const cat = e.category || "Other";
        acc[cat] = (acc[cat] || 0) + (e.amount || 0);
        return acc;
      },
      {} as Record<string, number>,
    );

    const categoryTableRows = Object.entries(byCategory)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(([category, amount]) => [
        category,
        formatCurrency(amount as number),
        formatPercent(
          totalExpenses > 0 ? ((amount as number) / totalExpenses) * 100 : 0,
        ),
      ]);

    // Recurring vs one-time
    const recurringExpenses = expenses
      .filter((e) => e.is_recurring)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const oneTimeExpenses = totalExpenses - recurringExpenses;

    const sections: ReportSection[] = [
      {
        id: "expense-overview",
        title: "Expense Overview",
        metrics: [
          { label: "Total Expenses", value: formatCurrency(totalExpenses) },
          {
            label: "Expense Ratio",
            value: formatPercent(expenseRatio),
            description: "Expenses as % of commission",
          },
          { label: "Recurring", value: formatCurrency(recurringExpenses) },
          { label: "One-Time", value: formatCurrency(oneTimeExpenses) },
        ],
      },
      {
        id: "expense-breakdown",
        title: "Expenses by Category",
        tableData: {
          headers: ["Category", "Amount", "% of Total"],
          rows: categoryTableRows,
        },
      },
    ];

    return {
      id: `financial-${Date.now()}`,
      type: "financial-health",
      title: "Expense Analysis",
      subtitle: `${filters.startDate.toLocaleDateString()} - ${filters.endDate.toLocaleDateString()}`,
      generatedAt: new Date(),
      filters,
      summary: {
        healthScore: expenseRatio < 30 ? 85 : expenseRatio < 50 ? 65 : 40,
        keyMetrics: sections[0].metrics || [],
        topInsights: insights
          .filter((i) => i.category === "expense")
          .slice(0, 2),
      },
      sections,
    };
  }

  /**
   * Generate Predictive Analytics Report
   * UNIQUE: Future projections, trends, forecasting
   */
  private static async generatePredictiveReport(
    userId: string,
    filters: ReportFilters,
  ): Promise<Report> {
    const forecast = await ForecastingService.forecastCommission(userId);

    const sections: ReportSection[] = [
      {
        id: "forecast",
        title: "Commission Forecast",
        metrics: [
          {
            label: "Next Month",
            value: formatCurrency(forecast.nextMonth),
            trend: forecast.trend === "stable" ? "neutral" : forecast.trend,
          },
          {
            label: "3-Month Total",
            value: formatCurrency(forecast.threeMonth),
          },
          {
            label: "Confidence",
            value: formatPercent(forecast.confidence * 100),
          },
          {
            label: "Trend",
            value:
              forecast.trend === "up"
                ? "Growing"
                : forecast.trend === "down"
                  ? "Declining"
                  : "Stable",
          },
        ],
      },
    ];

    // Add warnings if any
    if (forecast.warnings.length > 0) {
      sections.push({
        id: "forecast-notes",
        title: "Notes",
        insights: forecast.warnings.map((warning, i) => ({
          id: `note-${i}`,
          severity: "info" as const,
          category: "performance" as const,
          title: "Forecast Note",
          description: warning,
          impact: "",
          recommendedActions: [],
          priority: 3,
        })),
      });
    }

    return {
      id: `predictive-${Date.now()}`,
      type: "predictive-analytics",
      title: "Revenue Forecast",
      subtitle: `Based on ${forecast.historicalMonths} months of data`,
      generatedAt: new Date(),
      filters,
      summary: {
        healthScore: Math.round(forecast.confidence * 100),
        keyMetrics: sections[0].metrics || [],
        topInsights: [],
      },
      sections,
    };
  }

  // Helper methods

  private static async fetchCommissionData(
    userId: string,
    filters: ReportFilters,
  ) {
    // Fetch all commissions for user - filter by date in JS
    // because payment_date may be NULL and we need fallback to created_at
    const { data } = await supabase
      .from("commissions")
      .select("*")
      .eq("user_id", userId);

    if (!data) return [];

    // Filter by date range using correct date field
    // For paid commissions: use payment_date (when money was received)
    // For others: use created_at as fallback
    return data.filter((c) => {
      const dateToCheck =
        c.status === "paid" && c.payment_date
          ? new Date(c.payment_date)
          : new Date(c.created_at);
      return dateToCheck >= filters.startDate && dateToCheck <= filters.endDate;
    });
  }

  private static async fetchExpenseData(
    userId: string,
    filters: ReportFilters,
  ) {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .gte("date", filters.startDate.toISOString())
      .lte("date", filters.endDate.toISOString());

    return data || [];
  }

  private static async fetchPolicyData(userId: string, filters: ReportFilters) {
    const { data } = await supabase
      .from("policies")
      .select("*")
      .eq("user_id", userId)
      .gte("effective_date", filters.startDate.toISOString())
      .lte("effective_date", filters.endDate.toISOString());

    return data || [];
  }

  // ============================================================================
  // Materialized View Fetch Methods - Pre-aggregated data for faster reports
  // ============================================================================

  /**
   * Fetch carrier performance metrics by aggregating actual commission data
   * Uses date filtering to show only relevant data for the report period
   */
  private static async fetchCarrierPerformance(
    userId: string,
    filters: ReportFilters,
  ) {
    // Fetch commissions with policy and carrier data
    const { data: commissions, error } = await supabase
      .from("commissions")
      .select(
        `
        *,
        policy:policies!policy_id (
          carrier_id,
          status,
          commission_percentage,
          carrier:carriers!carrier_id (
            name
          )
        )
      `,
      )
      .eq("user_id", userId)
      .eq("status", "paid");

    if (error) {
      logger.error(
        "Error fetching carrier performance",
        error,
        "ReportGenerationService",
      );
      throw new ReportDataFetchError("carrier performance", error);
    }

    if (!commissions) return [];

    // Filter by date range using correct date field
    const filteredCommissions = commissions.filter((c) => {
      const dateToCheck = c.payment_date
        ? new Date(c.payment_date)
        : new Date(c.created_at);
      return dateToCheck >= filters.startDate && dateToCheck <= filters.endDate;
    });

    // Aggregate by carrier, deduplicating policies
    const carrierMap = new Map<
      string,
      {
        carrier_name: string;
        total_commission_amount: number;
        policyIds: Set<string>;
        activePolicyIds: Set<string>;
        lapsedPolicyIds: Set<string>;
        commissionRateSum: number;
        commissionRateCount: number;
      }
    >();

    for (const commission of filteredCommissions) {
      const policy = commission.policy as {
        carrier_id: string;
        status: string;
        lifecycle_status: string | null;
        commission_percentage: number | null;
        carrier: { name: string } | null;
      } | null;
      if (!policy?.carrier || !policy.carrier_id) continue;

      const carrierId = policy.carrier_id;
      const carrierName = policy.carrier.name || "Unknown";
      const existing = carrierMap.get(carrierId) || {
        carrier_name: carrierName,
        total_commission_amount: 0,
        policyIds: new Set<string>(),
        activePolicyIds: new Set<string>(),
        lapsedPolicyIds: new Set<string>(),
        commissionRateSum: 0,
        commissionRateCount: 0,
      };

      existing.total_commission_amount += commission.amount || 0;

      const policyId = commission.policy_id;
      if (policyId && !existing.policyIds.has(policyId)) {
        existing.policyIds.add(policyId);
        // Use lifecycle_status for active/lapsed (issued policy lifecycle)
        if (policy.lifecycle_status === "active") {
          existing.activePolicyIds.add(policyId);
        } else if (policy.lifecycle_status === "lapsed") {
          existing.lapsedPolicyIds.add(policyId);
        }
        if (policy.commission_percentage !== null) {
          existing.commissionRateSum += policy.commission_percentage;
          existing.commissionRateCount += 1;
        }
      }

      carrierMap.set(carrierId, existing);
    }

    // Convert to array and calculate derived metrics
    return Array.from(carrierMap.values()).map((carrier) => {
      const totalPolicies = carrier.policyIds.size;
      const activePolicies = carrier.activePolicyIds.size;
      const lapsedPolicies = carrier.lapsedPolicyIds.size;
      const avgCommissionRate =
        carrier.commissionRateCount > 0
          ? carrier.commissionRateSum / carrier.commissionRateCount
          : 0;

      return {
        carrier_name: carrier.carrier_name,
        total_commission_amount: carrier.total_commission_amount,
        total_policies: totalPolicies,
        active_policies: activePolicies,
        lapsed_policies: lapsedPolicies,
        avg_commission_rate_pct: avgCommissionRate,
        persistency_rate:
          totalPolicies > 0 ? (activePolicies / totalPolicies) * 100 : 0,
      };
    });
  }

  /**
   * Fetch commission aging data via secure RPC (auth.uid() enforced server-side)
   * Pre-computed: risk buckets (0-3mo, 3-6mo, etc.), at-risk amounts
   */
  private static async fetchCommissionAging(): Promise<CommissionAgingRow[]> {
    const { data, error } = await supabase.rpc("get_user_commission_aging");

    if (error) {
      logger.error(
        "Error fetching commission aging",
        error,
        "ReportGenerationService",
      );
      throw new ReportDataFetchError(
        "commission aging (get_user_commission_aging RPC)",
        error,
      );
    }
    return (data as CommissionAgingRow[]) || [];
  }

  /**
   * Fetch client lifetime value metrics via secure RPC (auth.uid() enforced server-side)
   * Pre-computed: client tiers (A/B/C/D), cross-sell opportunities, LTV
   */
  private static async fetchClientLTV(): Promise<ClientLtvRow[]> {
    const { data, error } = await supabase.rpc("get_user_client_ltv");

    if (error) {
      logger.error(
        "Error fetching client LTV",
        error,
        "ReportGenerationService",
      );
      throw new ReportDataFetchError(
        "client LTV (get_user_client_ltv RPC)",
        error,
      );
    }
    return (data as ClientLtvRow[]) || [];
  }

  /**
   * Fetch cohort retention data via secure RPC (auth.uid() enforced server-side)
   * Pre-computed: retention rates by cohort month
   */
  private static async fetchCohortRetention(): Promise<CohortRetentionRow[]> {
    const { data, error } = await supabase.rpc("get_user_cohort_retention");

    if (error) {
      logger.error(
        "Error fetching cohort retention",
        error,
        "ReportGenerationService",
      );
      throw new ReportDataFetchError(
        "cohort retention (get_user_cohort_retention RPC)",
        error,
      );
    }
    return (data as CohortRetentionRow[]) || [];
  }

  /**
   * Fetch production velocity metrics via secure RPC (auth.uid() enforced server-side)
   * Pre-computed: weekly/monthly policies and premium
   */
  private static async fetchProductionVelocity(): Promise<
    ProductionVelocityRow[]
  > {
    const { data, error } = await supabase.rpc("get_user_production_velocity", {
      p_limit: 12, // Last 12 weeks
    });

    if (error) {
      logger.error(
        "Error fetching production velocity",
        error,
        "ReportGenerationService",
      );
      throw new ReportDataFetchError(
        "production velocity (get_user_production_velocity RPC)",
        error,
      );
    }
    return (data as ProductionVelocityRow[]) || [];
  }

  /**
   * Fetch expense summary via secure RPC (auth.uid() enforced server-side)
   * Pre-computed: expenses by category and month
   */
  private static async fetchExpenseSummary(): Promise<ExpenseSummaryRow[]> {
    const { data, error } = await supabase.rpc("get_user_expense_summary");

    if (error) {
      logger.error(
        "Error fetching expense summary",
        error,
        "ReportGenerationService",
      );
      throw new ReportDataFetchError(
        "expense summary (get_user_expense_summary RPC)",
        error,
      );
    }
    return (data as ExpenseSummaryRow[]) || [];
  }

  private static calculateHealthScore(params: {
    netIncome: number;
    activePolicies: number;
    totalPolicies: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- report data has dynamic shape
    insights: any[];
  }): number {
    let score = 50; // Base score

    // Net income positive (+20)
    if (params.netIncome > 0) score += 20;

    // Good retention (+15)
    const retentionRate =
      params.totalPolicies > 0
        ? params.activePolicies / params.totalPolicies
        : 0;
    if (retentionRate > 0.8) score += 15;
    else if (retentionRate > 0.7) score += 10;

    // Few critical insights (+15)
    const criticalInsights = params.insights.filter(
      (i) => i.severity === "critical",
    ).length;
    if (criticalInsights === 0) score += 15;
    else if (criticalInsights <= 2) score += 8;

    return Math.min(100, Math.max(0, score));
  }
}
