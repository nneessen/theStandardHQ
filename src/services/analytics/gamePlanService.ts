// src/services/analytics/gamePlanService.ts

import type { Policy, Commission } from "../../types";
import type { CalculatedTargets } from "../targets/targetsCalculationService";
import { parseLocalDate } from "../../lib/date";
import { ANALYTICS_CONSTANTS } from "../../constants/financial";

export interface GamePlanData {
  // Current Status
  mtdCommissions: number; // Month-to-date commissions earned (gross, paid)
  mtdExpenses: number; // Month-to-date expenses
  monthlyIncomeTarget: number; // Target monthly NET take-home (informational)
  monthlyExpenseTarget: number; // Expected monthly expenses
  /**
   * Monthly gross commission needed to take home `monthlyIncomeTarget` after
   * persistency, tax, and NTO drag. This is what `mtdCommissions` is compared
   * against — apples to apples (both gross commission $).
   */
  grossCommissionNeeded: number;
  gap: number; // How much more commission needed
  progressPercent: number; // % progress to gross commission goal
  isOnTrack: boolean;

  // Time Context
  daysRemainingInMonth: number;
  currentMonth: string; // "November 2025"

  // Path Options (ways to hit goal)
  pathOptions: GamePlanPathOption[];

  // Smart Recommendations
  smartMoves: SmartMove[];

  // Scenarios
  scenarios: Scenario[];

  // Best Performers (for context)
  bestProduct: { name: string; avgCommission: number; count: number } | null;
  avgPolicyCommission: number;
  mtdPolicies: number;
}

export interface GamePlanPathOption {
  id: string;
  label: string;
  description: string;
  target: string; // e.g., "$300/day" or "2 policies/week"
  icon: "dollar" | "policy" | "mixed" | "trophy";
}

export interface SmartMove {
  id: string;
  title: string;
  description: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  icon: "target" | "phone" | "fire" | "trophy";
}

export interface Scenario {
  id: string;
  label: string;
  condition: string; // "Keep current pace" or "Add 1 policy/week"
  projectedEarnings: number;
  goalPercent: number;
  isRealistic: boolean;
}

export interface AnnualProgress {
  annualGoal: number; // Annual income target
  ytdCommissions: number; // Year-to-date commissions
  ytdPolicies: number; // Year-to-date policy count
  remainingNeeded: number; // How much more needed
  monthsElapsed: number; // Months completed so far
  monthsRemaining: number; // Months left in year
  avgMonthlyNeeded: number; // Average monthly commission needed
  avgCommissionPerPolicy: number; // Average commission per policy YTD
  policiesNeededPerMonth: number; // Policies needed per month to hit goal
  progressPercent: number; // % of annual goal achieved
  onTrackForYear: boolean; // Whether on track to hit annual goal
}

class GamePlanService {
  /**
   * Calculate the game plan for hitting targets
   *
   * @param policies - All policies for filtering MTD
   * @param commissions - All commissions for calculating MTD earnings
   * @param calculated - Pre-computed CalculatedTargets (use `useCalculatedTargets`).
   *   Provides realistic monthly gross commission needed (with persistency,
   *   tax, NTO drag baked in), which is the right comparator for MTD
   *   commissions earned. Pass `null` to fall back to safe defaults.
   * @param mtdExpenses - Month-to-date expenses
   * @returns GamePlanData with all calculations
   */
  calculateGamePlan(
    policies: Policy[],
    commissions: Commission[],
    calculated: CalculatedTargets | null,
    mtdExpenses: number,
  ): GamePlanData {
    // Get current month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Calculate days remaining in CURRENT month
    const daysRemainingInMonth = Math.max(
      1,
      Math.ceil((monthEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    );

    // Format current month for display
    const currentMonth = now.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    // Pull monthly targets from the realistic plan. Fallbacks only fire when
    // no targets are set yet (calculated === null).
    const monthlyIncomeTarget = calculated?.monthlyIncomeTarget ?? 10000;
    const monthlyExpenseTarget = calculated?.monthlyExpenseTarget ?? 5000;

    // GROSS commission needed = realistic monthly gross commission to take
    // home the NET goal after persistency × first-year rate, plus tax reserve
    // and expenses. Falls back to NET + expenses (the old, broken math) only
    // when no targets are configured.
    const grossCommissionNeeded =
      calculated && calculated.realisticGrossCommissionNeeded > 0
        ? calculated.realisticGrossCommissionNeeded / 12
        : monthlyIncomeTarget + monthlyExpenseTarget;

    // Filter to MTD policies (current month only)
    const mtdPolicies = policies.filter((p) => {
      const effectiveDate = parseLocalDate(p.effectiveDate);
      return effectiveDate >= monthStart && effectiveDate <= monthEnd;
    });

    // Filter to MTD commissions (current month only, paid status)
    // Use paymentDate for paid commissions (when money was received), createdAt as fallback
    const mtdCommissionsData = commissions.filter((c) => {
      if (c.status !== "paid") return false;
      const dateToCheck = c.paymentDate
        ? new Date(c.paymentDate)
        : new Date(c.createdAt);
      return dateToCheck >= monthStart && dateToCheck <= monthEnd;
    });

    // Calculate MTD commissions earned
    const mtdCommissions = mtdCommissionsData.reduce(
      (sum, c) => sum + (c.amount || 0),
      0,
    );

    // Calculate gap (how much more commission needed)
    const gap = Math.max(0, grossCommissionNeeded - mtdCommissions);

    // Calculate progress percentage
    const progressPercent =
      grossCommissionNeeded > 0
        ? (mtdCommissions / grossCommissionNeeded) * 100
        : 0;

    // Determine if on track (>=75% with >=75% of month elapsed)
    const daysElapsed = now.getDate();
    const totalDaysInMonth = monthEnd.getDate();
    const monthProgressPercent = (daysElapsed / totalDaysInMonth) * 100;
    const isOnTrack = progressPercent >= monthProgressPercent * 0.75;

    // Calculate average commission per policy
    const avgPolicyCommission =
      mtdPolicies.length > 0
        ? mtdCommissions / mtdPolicies.length
        : ANALYTICS_CONSTANTS.DEFAULT_AVG_COMMISSION_FALLBACK;

    // Calculate current pace (policies per week)
    const daysIntoMonth = now.getDate();
    const weeksIntoMonth = Math.max(0.1, daysIntoMonth / 7);
    const currentPoliciesPerWeek = mtdPolicies.length / weeksIntoMonth;

    // Generate path options
    const pathOptions = this.generatePathOptions(
      gap,
      daysRemainingInMonth,
      avgPolicyCommission,
    );

    // Generate smart moves
    const smartMoves = this.generateSmartMoves(
      policies,
      mtdPolicies,
      avgPolicyCommission,
      gap,
      isOnTrack,
    );

    // Generate scenarios
    const scenarios = this.generateScenarios(
      mtdCommissions,
      grossCommissionNeeded,
      avgPolicyCommission,
      currentPoliciesPerWeek,
      daysRemainingInMonth,
    );

    // Find best product
    const bestProduct = this.findBestProduct(mtdPolicies, mtdCommissionsData);

    return {
      mtdCommissions,
      mtdExpenses,
      monthlyIncomeTarget,
      monthlyExpenseTarget,
      grossCommissionNeeded,
      gap,
      progressPercent,
      isOnTrack,
      daysRemainingInMonth,
      currentMonth,
      pathOptions,
      smartMoves,
      scenarios,
      bestProduct,
      avgPolicyCommission,
      mtdPolicies: mtdPolicies.length,
    };
  }

  /**
   * Generate multiple path options to hit the goal
   */
  private generatePathOptions(
    gap: number,
    daysRemaining: number,
    avgCommission: number,
  ): GamePlanPathOption[] {
    if (gap <= 0) {
      return [
        {
          id: "maintain",
          label: "Goal Achieved!",
          description: "Keep up the great work",
          target: "🎉 You did it!",
          icon: "trophy" as const,
        },
      ];
    }

    const dailyRate = Math.ceil(gap / daysRemaining);
    const policiesNeeded = Math.ceil(gap / avgCommission);
    const weeksRemaining = Math.max(0.5, daysRemaining / 7);
    const policiesPerWeek = Math.ceil(policiesNeeded / weeksRemaining);

    return [
      {
        id: "daily",
        label: "Earn Daily",
        description: "Steady daily commission goal",
        target: `$${dailyRate.toLocaleString()}/day`,
        icon: "dollar" as const,
      },
      {
        id: "weekly",
        label: "Weekly Policies",
        description: `Total: ${policiesNeeded} policies needed`,
        target: `${policiesPerWeek} policies/week`,
        icon: "policy" as const,
      },
      {
        id: "mixed",
        label: "Mixed Strategy",
        description: "Combine different approaches",
        target: `${Math.ceil(policiesNeeded / 2)} large + ${Math.ceil(policiesNeeded / 2)} small`,
        icon: "mixed" as const,
      },
    ];
  }

  /**
   * Generate smart action recommendations
   */
  private generateSmartMoves(
    allPolicies: Policy[],
    mtdPolicies: Policy[],
    avgCommission: number,
    gap: number,
    isOnTrack: boolean,
  ): SmartMove[] {
    const moves: SmartMove[] = [];

    // Find best product from MTD policies
    const productCounts = mtdPolicies.reduce(
      (acc, p) => {
        const product = p.product || "Unknown";
        acc[product] = (acc[product] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const bestProduct = Object.entries(productCounts).sort(
      ([, a], [, b]) => b - a,
    )[0];

    if (bestProduct && bestProduct[1] > 0) {
      moves.push({
        id: "focus-product",
        title: `Focus on ${bestProduct[0]}`,
        description: `Your best performer this month`,
        reason: `Sold ${bestProduct[1]} - avg $${Math.round(avgCommission).toLocaleString()}/sale`,
        urgency: "high" as const,
        icon: "trophy" as const,
      });
    }

    // Check for upcoming renewals (policies with effective dates approaching anniversary in next 30 days)
    const now = new Date();
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const upcomingRenewals = allPolicies.filter((p) => {
      if (!p.effectiveDate || p.lifecycleStatus !== "active") return false;
      // Calculate anniversary date (same month/day as effective date, but this year)
      const effective = parseLocalDate(p.effectiveDate);
      const anniversary = new Date(
        now.getFullYear(),
        effective.getMonth(),
        effective.getDate(),
      );
      // If anniversary already passed this year, use next year
      if (anniversary < now) {
        anniversary.setFullYear(anniversary.getFullYear() + 1);
      }
      return anniversary >= now && anniversary <= next30Days;
    });

    if (upcomingRenewals.length > 0) {
      moves.push({
        id: "renewals",
        title: `Contact ${upcomingRenewals.length} Renewal Clients`,
        description: "Quick wins from existing relationships",
        reason: "Renewals have high close rates",
        urgency: "high" as const,
        icon: "phone" as const,
      });
    }

    // If behind, add urgency move
    if (!isOnTrack && gap > 0) {
      const policiesNeeded = Math.ceil(gap / avgCommission);
      moves.push({
        id: "push-hard",
        title: "Time to Push",
        description: `Need ${policiesNeeded} more policies`,
        reason: "Behind pace - every sale counts",
        urgency: "high" as const,
        icon: "fire" as const,
      });
    }

    return moves;
  }

  /**
   * Generate what-if scenarios
   */
  private generateScenarios(
    mtdCommissions: number,
    grossCommissionNeeded: number,
    avgCommission: number,
    currentPoliciesPerWeek: number,
    daysRemaining: number,
  ): Scenario[] {
    const weeksRemaining = Math.max(0.5, daysRemaining / 7);

    // Scenario 1: Keep current pace
    const projectedFromCurrentPace =
      currentPoliciesPerWeek * weeksRemaining * avgCommission;
    const currentPaceTotal = mtdCommissions + projectedFromCurrentPace;

    // Scenario 2: Add 1 policy per week
    const projectedPlus1 =
      (currentPoliciesPerWeek + 1) * weeksRemaining * avgCommission;
    const plus1Total = mtdCommissions + projectedPlus1;

    // Scenario 3: Add 2 policies per week
    const projectedPlus2 =
      (currentPoliciesPerWeek + 2) * weeksRemaining * avgCommission;
    const plus2Total = mtdCommissions + projectedPlus2;

    return [
      {
        id: "current",
        label: "Current Pace",
        condition: "Keep current pace",
        projectedEarnings: currentPaceTotal,
        goalPercent: (currentPaceTotal / grossCommissionNeeded) * 100,
        isRealistic: true,
      },
      {
        id: "plus1",
        label: "Add 1/Week",
        condition: "Add 1 policy/week",
        projectedEarnings: plus1Total,
        goalPercent: (plus1Total / grossCommissionNeeded) * 100,
        isRealistic: true,
      },
      {
        id: "plus2",
        label: "Add 2/Week",
        condition: "Add 2 policies/week",
        projectedEarnings: plus2Total,
        goalPercent: (plus2Total / grossCommissionNeeded) * 100,
        isRealistic: currentPoliciesPerWeek >= 2, // Only realistic if already writing policies
      },
    ];
  }

  /**
   * Find the best performing product from MTD data
   */
  private findBestProduct(
    mtdPolicies: Policy[],
    mtdCommissions: Commission[],
  ): { name: string; avgCommission: number; count: number } | null {
    if (mtdPolicies.length === 0) return null;

    // Group by product
    const productData = mtdPolicies.reduce(
      (acc, p) => {
        const product = p.product || "Unknown";
        if (!acc[product]) {
          acc[product] = { count: 0 };
        }
        acc[product].count++;
        return acc;
      },
      {} as Record<string, { count: number }>,
    );

    // Calculate average commission
    const totalCommission = mtdCommissions.reduce(
      (sum, c) => sum + (c.amount || 0),
      0,
    );
    const avgCommission =
      mtdPolicies.length > 0 ? totalCommission / mtdPolicies.length : 0;

    // Find product with most sales
    const best = Object.entries(productData).sort(
      ([, a], [, b]) => b.count - a.count,
    )[0];

    if (!best) return null;

    return {
      name: best[0],
      avgCommission,
      count: best[1].count,
    };
  }

  /**
   * Calculate annual progress and dynamic policies needed
   *
   * @param policies - All policies
   * @param commissions - All commissions
   * @param calculated - Pre-computed CalculatedTargets. Annual goal is the
   *   realistic gross commission needed (apples-to-apples comparison with
   *   YTD paid commissions). Pass `null` for safe defaults.
   * @returns AnnualProgress with year-to-date metrics
   */
  calculateAnnualProgress(
    policies: Policy[],
    commissions: Commission[],
    calculated: CalculatedTargets | null,
  ): AnnualProgress {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const _yearEnd = new Date(now.getFullYear(), 11, 31);

    // Calculate months elapsed and remaining
    const monthsElapsed = now.getMonth() + 1; // JavaScript months are 0-indexed
    const monthsRemaining = 12 - monthsElapsed;

    // Annual goal = realistic gross commission needed for the year (matches
    // the unit of YTD paid commissions). Falls back to NET annual target only
    // when no plan exists yet.
    const annualGoal =
      calculated && calculated.realisticGrossCommissionNeeded > 0
        ? calculated.realisticGrossCommissionNeeded
        : (calculated?.annualIncomeTarget ?? 120000);

    // Filter YTD policies
    const ytdPolicies = policies.filter((p) => {
      const effectiveDate = parseLocalDate(p.effectiveDate);
      return effectiveDate >= yearStart && effectiveDate <= now;
    });

    // Filter YTD commissions (paid only)
    // Use paymentDate for paid commissions (when money was received), createdAt as fallback
    const ytdCommissionsData = commissions.filter((c) => {
      if (c.status !== "paid") return false;
      const dateToCheck = c.paymentDate
        ? new Date(c.paymentDate)
        : new Date(c.createdAt);
      return dateToCheck >= yearStart && dateToCheck <= now;
    });

    // Calculate YTD totals
    const ytdCommissions = ytdCommissionsData.reduce(
      (sum, c) => sum + (c.amount || 0),
      0,
    );

    // Calculate remaining needed
    const remainingNeeded = Math.max(0, annualGoal - ytdCommissions);

    // Calculate average monthly commission needed for remainder of year
    const avgMonthlyNeeded =
      monthsRemaining > 0 ? remainingNeeded / monthsRemaining : 0;

    // Calculate average commission per policy YTD
    const avgCommissionPerPolicy =
      ytdPolicies.length > 0
        ? ytdCommissions / ytdPolicies.length
        : ANALYTICS_CONSTANTS.DEFAULT_AVG_COMMISSION_FALLBACK;

    // Calculate policies needed per month to hit annual goal
    const policiesNeededPerMonth =
      avgCommissionPerPolicy > 0
        ? Math.ceil(avgMonthlyNeeded / avgCommissionPerPolicy)
        : 0;

    // Calculate progress percentage
    const progressPercent =
      annualGoal > 0 ? (ytdCommissions / annualGoal) * 100 : 0;

    // Determine if on track (>=75% of expected progress)
    const expectedProgress = (monthsElapsed / 12) * 100;
    const onTrackForYear = progressPercent >= expectedProgress * 0.75;

    return {
      annualGoal,
      ytdCommissions,
      ytdPolicies: ytdPolicies.length,
      remainingNeeded,
      monthsElapsed,
      monthsRemaining,
      avgMonthlyNeeded,
      avgCommissionPerPolicy,
      policiesNeededPerMonth,
      progressPercent,
      onTrackForYear,
    };
  }
}

export const gamePlanService = new GamePlanService();
