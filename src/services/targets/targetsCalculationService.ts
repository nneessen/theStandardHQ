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
  avgPolicyPremium: number; // Average annual premium per policy (mean)
  medianPolicyPremium: number; // Median annual premium per policy
  avgPoliciesPerMonth: number; // Historical average policies written per month
  avgExpensesPerMonth: number; // Historical average monthly expenses (for monthly display)
  projectedAnnualExpenses: number; // Sum of actual expenses for the year (NOT avgExpensesPerMonth * 12)
  annualExpenseBreakdown: AnnualExpenseBreakdown;
  avgPolicyPremiumBreakdown: AvgPolicyPremiumBreakdown;
  persistency13Month: number; // As decimal
  persistency25Month: number; // As decimal
  hasData: boolean; // Whether we have enough historical data
}

/**
 * Realism knobs that turn the optimistic gross-commission math into a
 * realistic take-home plan. All defaults come from industry-typical
 * values when historical data is missing.
 */
export interface RealismOptions {
  /** Persistency rate as decimal (e.g., 0.75 = 75%). Reduces effective commission. */
  persistencyRate: number;
  /** Combined effective tax rate as decimal (default 0.30 ≈ SE tax + federal + state). */
  taxReserveRate: number;
  /** App→policy drag as decimal (e.g., 0.12 = need 12% more apps to hit policy count). */
  ntoBufferRate: number;
  /** Which premium stat to use for the divisor. Median is more robust to outliers. */
  premiumStat: "mean" | "median";
}

export const DEFAULT_REALISM_OPTIONS: RealismOptions = {
  persistencyRate: 0.75,
  taxReserveRate: 0.3,
  ntoBufferRate: 0.12,
  premiumStat: "median",
};

export interface CalculatedTargets {
  // Income breakdowns (NET — pre-tax after expenses, matches existing semantics)
  annualIncomeTarget: number;
  quarterlyIncomeTarget: number;
  monthlyIncomeTarget: number;
  weeklyIncomeTarget: number;
  dailyIncomeTarget: number;

  // Premium requirements (optimistic)
  totalPremiumNeeded: number;

  // Policy requirements (optimistic — gross commission ÷ first-year rate ÷ avg premium)
  annualPoliciesTarget: number;
  quarterlyPoliciesTarget: number;
  monthlyPoliciesTarget: number;
  weeklyPoliciesTarget: number;
  dailyPoliciesTarget: number;

  // Averages used (optimistic)
  avgCommissionRate: number; // First-year rate from comp_guide
  avgPolicyPremium: number; // Mean by default; switches to median when premiumStat='median'

  // Other metrics
  persistency13MonthTarget: number;
  persistency25MonthTarget: number;
  monthlyExpenseTarget: number;
  annualExpenses: number;
  expenseRatio: number;

  // ───────────────────────────────────────────────────────────────────────
  // Realistic mode (persistency + taxes + NTO drag, optional median premium)
  // ───────────────────────────────────────────────────────────────────────
  realism: RealismOptions;
  /** Tax reserve $ — gross-up to keep `annualIncomeTarget` as actual take-home. */
  taxReserveAmount: number;
  /** firstYearRate × persistencyRate. */
  effectiveCommissionRate: number;
  /** annualIncomeTarget + taxReserve + expenses. */
  realisticGrossCommissionNeeded: number;
  /** realisticGross ÷ effectiveCommissionRate. */
  realisticTotalPremiumNeeded: number;
  /** Issued policies needed (after persistency drag). */
  realisticAnnualPoliciesIssued: number;
  /** Apps to write (issued × (1 + ntoBufferRate)). This is the action target. */
  realisticAnnualAppsToWrite: number;
  realisticQuarterlyAppsToWrite: number;
  realisticMonthlyAppsToWrite: number;
  realisticWeeklyAppsToWrite: number;
  realisticDailyAppsToWrite: number;
  /** Difference between realistic apps and optimistic policies — useful for context. */
  realisticVsOptimisticDelta: number;

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
  /**
   * Realism knobs. When omitted, falls back to historical persistency
   * (or DEFAULT_REALISM_OPTIONS) and median premium.
   */
  realism?: Partial<RealismOptions>;
}

class TargetsCalculationService {
  /**
   * Calculate all targets from a single annual income target.
   *
   * Returns BOTH the optimistic view (the original math — no chargebacks,
   * no taxes, no NTO drag) and a realistic view that bakes in those drags.
   * Callers can show either or both.
   */
  calculateTargets(options: TargetCalculationOptions): CalculatedTargets {
    const { annualIncomeTarget, historicalAverages, overrides } = options;

    // CRITICAL: NO hardcoded defaults — only use actual data
    // Determine which values to use (overrides > historical > zero)
    const avgCommissionRate =
      overrides?.avgCommissionRate ??
      historicalAverages?.avgCommissionRate ??
      0;

    // Resolve realism knobs: explicit > historical persistency > defaults.
    const realism: RealismOptions = {
      persistencyRate:
        options.realism?.persistencyRate ??
        (historicalAverages?.persistency13Month &&
        historicalAverages.persistency13Month > 0
          ? historicalAverages.persistency13Month
          : DEFAULT_REALISM_OPTIONS.persistencyRate),
      taxReserveRate:
        options.realism?.taxReserveRate ??
        DEFAULT_REALISM_OPTIONS.taxReserveRate,
      ntoBufferRate:
        options.realism?.ntoBufferRate ?? DEFAULT_REALISM_OPTIONS.ntoBufferRate,
      premiumStat:
        options.realism?.premiumStat ?? DEFAULT_REALISM_OPTIONS.premiumStat,
    };

    // Pick the premium stat for the divisor. Median is more robust against
    // a single large case skewing the picture.
    const meanPremium =
      overrides?.avgPolicyPremium ?? historicalAverages?.avgPolicyPremium ?? 0;
    const medianPremium = historicalAverages?.medianPolicyPremium ?? 0;
    const avgPolicyPremium =
      realism.premiumStat === "median" && medianPremium > 0
        ? medianPremium
        : meanPremium;

    const monthlyExpenseTarget =
      overrides?.monthlyExpenseTarget ??
      historicalAverages?.avgExpensesPerMonth ??
      0;

    // Projected annual expenses = sum of one-time + recurring rows for the year.
    // Do NOT use monthlyExpenseTarget * 12 — that double-counts one-time items.
    const annualExpenses =
      overrides?.projectedAnnualExpenses ??
      historicalAverages?.projectedAnnualExpenses ??
      0;

    // ─── Optimistic view (existing math — kept verbatim for back-compat) ──
    // annualIncomeTarget is NET (after expenses); add expenses to get GROSS.
    const grossCommissionNeeded = annualIncomeTarget + annualExpenses;

    const quarterlyIncomeTarget = annualIncomeTarget / 4;
    const monthlyIncomeTarget = annualIncomeTarget / 12;
    const weeklyIncomeTarget = annualIncomeTarget / 52;
    const dailyIncomeTarget = annualIncomeTarget / 365;

    const totalPremiumNeeded =
      avgCommissionRate > 0 ? grossCommissionNeeded / avgCommissionRate : 0;

    const annualPoliciesTarget =
      avgPolicyPremium > 0
        ? Math.ceil(totalPremiumNeeded / avgPolicyPremium)
        : 0;

    // Math.round so 12 × monthly ≈ annual instead of overshooting by 11.
    const quarterlyPoliciesTarget = Math.round(annualPoliciesTarget / 4);
    const monthlyPoliciesTarget = Math.round(annualPoliciesTarget / 12);
    const weeklyPoliciesTarget = Math.round(annualPoliciesTarget / 52);
    const dailyPoliciesTarget =
      annualPoliciesTarget > 0
        ? Math.max(1, Math.round(annualPoliciesTarget / 365))
        : 0;

    const expenseRatio =
      grossCommissionNeeded > 0 ? annualExpenses / grossCommissionNeeded : 0;

    // ─── Realistic view ──────────────────────────────────────────────────
    // Tax gross-up: if you want $X take-home, you need $X / (1 - taxRate).
    // The delta is the tax reserve.
    const taxableIncomeNeeded =
      realism.taxReserveRate > 0 && realism.taxReserveRate < 1
        ? annualIncomeTarget / (1 - realism.taxReserveRate)
        : annualIncomeTarget;
    const taxReserveAmount = taxableIncomeNeeded - annualIncomeTarget;

    const realisticGrossCommissionNeeded = taxableIncomeNeeded + annualExpenses;

    // Effective rate = first-year × persistency. A policy that charges back
    // contributes 0 to durable income, so effective comp is the rate × the
    // share of policies that actually stick.
    const effectiveCommissionRate = avgCommissionRate * realism.persistencyRate;

    const realisticTotalPremiumNeeded =
      effectiveCommissionRate > 0
        ? realisticGrossCommissionNeeded / effectiveCommissionRate
        : 0;

    const realisticAnnualPoliciesIssued =
      avgPolicyPremium > 0
        ? Math.ceil(realisticTotalPremiumNeeded / avgPolicyPremium)
        : 0;

    // Apps to write = issued × (1 + NTO drag). This is the activity target —
    // what you actually need to do to net the take-home goal.
    const realisticAnnualAppsToWrite = Math.ceil(
      realisticAnnualPoliciesIssued * (1 + realism.ntoBufferRate),
    );

    const realisticQuarterlyAppsToWrite = Math.round(
      realisticAnnualAppsToWrite / 4,
    );
    const realisticMonthlyAppsToWrite = Math.round(
      realisticAnnualAppsToWrite / 12,
    );
    const realisticWeeklyAppsToWrite = Math.round(
      realisticAnnualAppsToWrite / 52,
    );
    const realisticDailyAppsToWrite =
      realisticAnnualAppsToWrite > 0
        ? Math.max(1, Math.round(realisticAnnualAppsToWrite / 365))
        : 0;

    const realisticVsOptimisticDelta =
      realisticAnnualAppsToWrite - annualPoliciesTarget;

    // Use historical persistency or zero
    const persistency13MonthTarget =
      historicalAverages?.persistency13Month ?? 0;

    const persistency25MonthTarget =
      historicalAverages?.persistency25Month ?? 0;

    // Determine calculation confidence
    let confidence: "high" | "medium" | "low" = "low";
    let dataPoints = 0;

    if (historicalAverages?.hasData) {
      dataPoints = historicalAverages.avgPoliciesPerMonth > 0 ? 12 : 0;

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

      // Premium requirement (optimistic)
      totalPremiumNeeded,

      // Policy targets (optimistic)
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

      // Realistic view
      realism,
      taxReserveAmount,
      effectiveCommissionRate,
      realisticGrossCommissionNeeded,
      realisticTotalPremiumNeeded,
      realisticAnnualPoliciesIssued,
      realisticAnnualAppsToWrite,
      realisticQuarterlyAppsToWrite,
      realisticMonthlyAppsToWrite,
      realisticWeeklyAppsToWrite,
      realisticDailyAppsToWrite,
      realisticVsOptimisticDelta,

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

    // Compare REALISTIC apps-to-write against historical pace — that's the
    // real activity ask, not the optimistic policy count.
    if (
      targets.realisticMonthlyAppsToWrite >
      historicalAverages.avgPoliciesPerMonth * 2
    ) {
      warnings.push(
        `Realistic plan requires ${targets.realisticMonthlyAppsToWrite} apps/month, ` +
          `but your historical average is ${historicalAverages.avgPoliciesPerMonth.toFixed(1)} policies.`,
      );
      recommendations.push(
        "Consider adjusting your income target or improving your average policy size.",
      );
    }

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
