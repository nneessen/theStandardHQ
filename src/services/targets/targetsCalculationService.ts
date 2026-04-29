// src/services/targets/targetsCalculationService.ts

export interface AnnualExpenseRecurringContribution {
  groupId: string;
  name: string;
  frequency: string;
  latestAmount: number;
  occurrences: number;
  total: number;
  endDate: string | null;
}

export interface AnnualExpenseOneTimeContribution {
  id: string;
  name: string;
  amount: number;
  date: string;
}

export interface AnnualExpenseBreakdown {
  recurring: AnnualExpenseRecurringContribution[];
  oneTime: AnnualExpenseOneTimeContribution[];
  recurringTotal: number;
  oneTimeTotal: number;
  total: number;
}

export interface AvgPolicyPremiumPolicy {
  id: string;
  clientName: string;
  productName: string;
  annualPremium: number;
  effectiveDate: string;
}

export interface AvgPolicyPremiumBreakdown {
  source:
    | "current-year"
    | "active-policies-fallback"
    | "all-policies-fallback"
    | "no-data";
  policyCount: number;
  totalPremium: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  policies: AvgPolicyPremiumPolicy[]; // sorted desc by premium
}

export interface HistoricalAverages {
  avgCommissionRate: number; // As decimal (e.g., 0.50 for 50%)
  avgPolicyPremium: number; // Average annual premium per policy
  avgPoliciesPerMonth: number; // Historical average policies written per month
  avgExpensesPerMonth: number; // Historical average monthly expenses (for monthly display)
  projectedAnnualExpenses: number; // Sum of actual expenses for the year (NOT avgExpensesPerMonth * 12)
  annualExpenseBreakdown: AnnualExpenseBreakdown;
  avgPolicyPremiumBreakdown: AvgPolicyPremiumBreakdown;
  persistency13Month: number; // As decimal
  persistency25Month: number; // As decimal
  hasData: boolean; // Whether we have enough historical data
}

export interface CalculatedTargets {
  // Income breakdowns
  annualIncomeTarget: number;
  quarterlyIncomeTarget: number;
  monthlyIncomeTarget: number;
  weeklyIncomeTarget: number;
  dailyIncomeTarget: number;

  // Premium requirements
  totalPremiumNeeded: number;

  // Policy requirements
  annualPoliciesTarget: number;
  quarterlyPoliciesTarget: number;
  monthlyPoliciesTarget: number;
  weeklyPoliciesTarget: number;
  dailyPoliciesTarget: number;

  // Averages used
  avgCommissionRate: number;
  avgPolicyPremium: number;

  // Other metrics
  persistency13MonthTarget: number;
  persistency25MonthTarget: number;
  monthlyExpenseTarget: number;
  annualExpenses: number; // Actual projected annual expenses (NOT monthlyExpenseTarget * 12)
  expenseRatio: number;

  // Calculation metadata
  calculationMethod: "historical" | "default";
  confidence: "high" | "medium" | "low";
  dataPoints: number;
}

export interface TargetCalculationOptions {
  annualIncomeTarget: number;
  historicalAverages?: HistoricalAverages;
  overrides?: {
    avgCommissionRate?: number;
    avgPolicyPremium?: number;
    monthlyExpenseTarget?: number;
    projectedAnnualExpenses?: number;
  };
}

class TargetsCalculationService {
  /**
   * Calculate all targets from a single annual income target
   */
  calculateTargets(options: TargetCalculationOptions): CalculatedTargets {
    const { annualIncomeTarget, historicalAverages, overrides } = options;

    // CRITICAL: NO hardcoded defaults - only use actual data
    // Determine which values to use (overrides > historical > zero)
    const avgCommissionRate =
      overrides?.avgCommissionRate ??
      historicalAverages?.avgCommissionRate ??
      0;

    const avgPolicyPremium =
      overrides?.avgPolicyPremium ?? historicalAverages?.avgPolicyPremium ?? 0;

    const monthlyExpenseTarget =
      overrides?.monthlyExpenseTarget ??
      historicalAverages?.avgExpensesPerMonth ??
      0;

    // CRITICAL: Use projected annual expenses (sum of actual expenses), NOT monthlyExpenseTarget * 12
    // This correctly handles one-time vs recurring expenses:
    // - One-time expenses are counted once (not multiplied by 12)
    // - Recurring expenses are stored as individual records per occurrence, so summing gives correct annual total
    const annualExpenses =
      overrides?.projectedAnnualExpenses ??
      historicalAverages?.projectedAnnualExpenses ??
      0;

    // CRITICAL: annualIncomeTarget is NET income (after expenses)
    // We need to calculate GROSS commission income needed (before expenses)
    const grossCommissionNeeded = annualIncomeTarget + annualExpenses;

    // Income breakdowns (based on NET income target)
    const quarterlyIncomeTarget = annualIncomeTarget / 4;
    const monthlyIncomeTarget = annualIncomeTarget / 12;
    const weeklyIncomeTarget = annualIncomeTarget / 52;
    const dailyIncomeTarget = annualIncomeTarget / 365;

    // Calculate total premium needed (using GROSS commission needed, not net)
    // Formula: Gross Commission Needed / Average Commission Rate = Total Premium Needed
    const totalPremiumNeeded =
      avgCommissionRate > 0 ? grossCommissionNeeded / avgCommissionRate : 0;

    // Calculate policies needed
    // Formula: Total Premium Needed / Average Policy Premium = Policies Needed
    const annualPoliciesTarget =
      avgPolicyPremium > 0
        ? Math.ceil(totalPremiumNeeded / avgPolicyPremium)
        : 0;

    // Break down policies by time period.
    // Use Math.round (not Math.ceil) so 12 × monthlyTarget ≈ annualTarget
    // instead of overshooting by up to 11 policies. Daily floor keeps the
    // "at least 1/day" guard so the dashboard doesn't show 0.
    const quarterlyPoliciesTarget = Math.round(annualPoliciesTarget / 4);
    const monthlyPoliciesTarget = Math.round(annualPoliciesTarget / 12);
    const weeklyPoliciesTarget = Math.round(annualPoliciesTarget / 52);
    const dailyPoliciesTarget =
      annualPoliciesTarget > 0
        ? Math.max(1, Math.round(annualPoliciesTarget / 365))
        : 0;

    // Calculate expense ratio (expenses as % of GROSS commission income)
    const expenseRatio =
      grossCommissionNeeded > 0 ? annualExpenses / grossCommissionNeeded : 0;

    // Use historical persistency or zero
    const persistency13MonthTarget =
      historicalAverages?.persistency13Month ?? 0;

    const persistency25MonthTarget =
      historicalAverages?.persistency25Month ?? 0;

    // Determine calculation confidence
    let confidence: "high" | "medium" | "low" = "low";
    let dataPoints = 0;

    if (historicalAverages?.hasData) {
      // Count how many months of data we have
      dataPoints = historicalAverages.avgPoliciesPerMonth > 0 ? 12 : 0; // Simplified

      if (dataPoints >= 12) {
        confidence = "high";
      } else if (dataPoints >= 6) {
        confidence = "medium";
      }
    }

    return {
      // Income targets
      annualIncomeTarget,
      quarterlyIncomeTarget,
      monthlyIncomeTarget,
      weeklyIncomeTarget,
      dailyIncomeTarget,

      // Premium requirement
      totalPremiumNeeded,

      // Policy targets
      annualPoliciesTarget,
      quarterlyPoliciesTarget,
      monthlyPoliciesTarget,
      weeklyPoliciesTarget,
      dailyPoliciesTarget,

      // Averages used in calculations
      avgCommissionRate,
      avgPolicyPremium,

      // Other metrics
      persistency13MonthTarget,
      persistency25MonthTarget,
      monthlyExpenseTarget,
      annualExpenses,
      expenseRatio,

      // Metadata
      calculationMethod: historicalAverages?.hasData ? "historical" : "default",
      confidence,
      dataPoints,
    };
  }

  /**
   * Format the calculation breakdown for display
   */
  getCalculationBreakdown(targets: CalculatedTargets): string[] {
    const breakdown: string[] = [];
    const commissionPercent = (targets.avgCommissionRate * 100).toFixed(1);
    // Use actual projected annual expenses (not monthlyExpenseTarget * 12)
    const grossCommissionNeeded =
      targets.annualIncomeTarget + targets.annualExpenses;

    breakdown.push(
      `NET Income Target (after expenses): $${targets.annualIncomeTarget.toLocaleString()}`,
      `+ Annual Business Expenses: $${targets.annualExpenses.toLocaleString()}`,
      `= GROSS Commission Needed: $${grossCommissionNeeded.toLocaleString()}`,
      "",
      `Gross Commission Needed: $${grossCommissionNeeded.toLocaleString()}`,
      `÷ Average Commission Rate: ${commissionPercent}%`,
      `= Total Premium Needed: $${targets.totalPremiumNeeded.toLocaleString()}`,
      "",
      `Total Premium Needed: $${targets.totalPremiumNeeded.toLocaleString()}`,
      `÷ Average Policy Premium: $${targets.avgPolicyPremium.toLocaleString()}`,
      `= Policies Needed: ${targets.annualPoliciesTarget} per year`,
      "",
      `${targets.annualPoliciesTarget} policies ÷ 12 months = ${targets.monthlyPoliciesTarget} per month`,
      `${targets.annualPoliciesTarget} policies ÷ 52 weeks = ${targets.weeklyPoliciesTarget} per week`,
      `${targets.annualPoliciesTarget} policies ÷ 365 days = ${targets.dailyPoliciesTarget} per day`,
    );

    return breakdown;
  }

  /**
   * Validate if the targets are achievable based on historical performance
   */
  validateTargets(
    targets: CalculatedTargets,
    historicalAverages?: HistoricalAverages,
  ): {
    isAchievable: boolean;
    warnings: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (!historicalAverages?.hasData) {
      warnings.push(
        "No historical data available. Using default values for calculations.",
      );
      recommendations.push(
        "Start tracking policies to get more accurate target calculations.",
      );
      return { isAchievable: true, warnings, recommendations };
    }

    // Check if monthly policy target is more than 2x historical average
    if (
      targets.monthlyPoliciesTarget >
      historicalAverages.avgPoliciesPerMonth * 2
    ) {
      warnings.push(
        `Target requires ${targets.monthlyPoliciesTarget} policies/month, ` +
          `but your historical average is ${historicalAverages.avgPoliciesPerMonth.toFixed(1)}.`,
      );
      recommendations.push(
        "Consider adjusting your income target or improving your average policy size.",
      );
    }

    // Check expense ratio
    if (targets.expenseRatio > 0.5) {
      warnings.push(
        `Expenses are ${(targets.expenseRatio * 100).toFixed(1)}% of income target.`,
      );
      recommendations.push(
        "Consider reducing expenses or increasing income target for better margins.",
      );
    }

    const isAchievable = warnings.length === 0;

    return { isAchievable, warnings, recommendations };
  }
}

export const targetsCalculationService = new TargetsCalculationService();
