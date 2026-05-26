// src/services/commissions/CommissionLifecycleService.ts
/**
 * Commission Lifecycle Management Service
 *
 * BUSINESS LOGIC:
 * - Advances are paid upfront but earned month-by-month as client pays
 * - Formula: Advance = Monthly Premium × Advance Months × Commission Rate
 * - Each month client pays = 1/advanceMonths of advance becomes earned
 * - Chargeback = Advance - Earned (when policy lapses before fully earned)
 * - Persistency = % of policies still active at milestone (3mo, 6mo, 9mo, 12mo)
 *
 * @example
 * // Policy with $500/month premium at 102.5% commission rate
 * const advance = calculateAdvance(500, 9, 1.025); // $4,612.50
 *
 * // After 3 months of client payments
 * const earned = calculateEarned(4612.50, 9, 3); // $1,537.50
 * const unearned = calculateUnearned(4612.50, 9, 3); // $3,075.00
 *
 * // If policy lapses at month 3
 * const chargeback = calculateChargeback(4612.50, 9, 3); // $3,075.00
 */

import { logger } from "../base/logger";
import { roundCurrency } from "../../lib/currency";

/**
 * Input parameters for advance calculation
 */
export interface AdvanceCalculationParams {
  monthlyPremium: number;
  advanceMonths?: number; // Default: 9
  commissionRate: number; // As decimal: 1.025 = 102.5%
}

/**
 * Result of advance calculation
 */
export interface AdvanceCalculationResult {
  advanceAmount: number;
  monthlyEarningRate: number; // Amount earned per month paid
  advanceMonths: number;
  commissionRate: number;
}

/**
 * Input parameters for capped advance calculation
 * Extends base params with carrier advance cap
 */
export interface CappedAdvanceCalculationParams extends AdvanceCalculationParams {
  advanceCap?: number | null; // Carrier's advance cap (null = no cap)
}

/**
 * Result of capped advance calculation
 * Extends base result with cap-related fields
 */
export interface CappedAdvanceCalculationResult extends AdvanceCalculationResult {
  originalAdvance: number; // Full calculated advance before cap
  cappedAdvanceAmount: number; // Actual advance paid (min of advance, cap)
  overageAmount: number; // Amount exceeding cap (paid as-earned later)
  overageStartMonth: number | null; // Month when overage payments begin
  isCapped: boolean; // Whether cap was applied
}

/**
 * Input parameters for earned commission calculation
 */
export interface EarnedCalculationParams {
  advanceAmount: number;
  advanceMonths: number;
  monthsPaid: number;
}

/**
 * Result of earned commission calculation
 */
export interface EarnedCalculationResult {
  earnedAmount: number;
  unearnedAmount: number;
  percentageEarned: number; // 0-100
  isFullyEarned: boolean;
  monthsRemaining: number;
}

/**
 * Input parameters for chargeback calculation
 */
export interface ChargebackCalculationParams {
  advanceAmount: number;
  advanceMonths: number;
  monthsPaid: number;
  lapseDate: Date;
  effectiveDate: Date;
}

/**
 * Result of chargeback calculation
 */
export interface ChargebackCalculationResult {
  chargebackAmount: number;
  earnedAmount: number;
  monthsPaid: number;
  monthsElapsed: number;
  chargebackReason: string;
}

/**
 * Policy cohort for persistency analysis
 */
export interface PolicyCohort {
  policyId: string;
  effectiveDate: Date;
  status: "active" | "lapsed" | "cancelled";
  lapseDate?: Date;
}

/**
 * Persistency metrics at a specific milestone
 */
export interface PersistencyMilestone {
  months: number;
  activePolicies: number;
  lapsedPolicies: number;
  totalPolicies: number;
  persistencyRate: number; // Percentage
  lapsedRate: number; // Percentage
}

/**
 * Complete persistency analysis
 */
export interface PersistencyAnalysis {
  cohortStartDate: Date;
  cohortEndDate: Date;
  totalPolicies: number;
  milestones: {
    threeMonth: PersistencyMilestone;
    sixMonth: PersistencyMilestone;
    nineMonth: PersistencyMilestone;
    twelveMonth: PersistencyMilestone;
  };
  averagePersistency: number;
  predictedChargebackRate: number;
}

/**
 * Commission Lifecycle Service
 *
 * Handles all commission lifecycle calculations including:
 * - Advance calculations (upfront payment)
 * - Earned vs unearned tracking (month by month)
 * - Chargeback calculations (when policies lapse)
 * - Persistency metrics (portfolio health)
 */
class CommissionLifecycleService {
  private static instance: CommissionLifecycleService;

  // Industry standard defaults
  private readonly DEFAULT_ADVANCE_MONTHS = 9;
  private readonly PERSISTENCY_MILESTONES = [3, 6, 9, 12]; // months

  private constructor() {}

  public static getInstance(): CommissionLifecycleService {
    if (!CommissionLifecycleService.instance) {
      CommissionLifecycleService.instance = new CommissionLifecycleService();
    }
    return CommissionLifecycleService.instance;
  }

  /**
   * Calculate commission advance amount
   *
   * BUSINESS RULE:
   * Advance = Monthly Premium × Advance Months × Commission Rate
   *
   * The advance is paid to the agent upfront but is only earned as the client
   * makes each monthly payment. This creates a receivable that must be tracked.
   *
   * @param params - Advance calculation parameters
   * @returns Advance calculation result with monthly earning rate
   *
   * @example
   * ```typescript
   * const result = service.calculateAdvance({
   *   monthlyPremium: 500,
   *   advanceMonths: 9,
   *   commissionRate: 1.025 // 102.5%
   * });
   * // result.advanceAmount = $4,612.50
   * // result.monthlyEarningRate = $512.50
   * ```
   */
  public calculateAdvance(
    params: AdvanceCalculationParams,
  ): AdvanceCalculationResult {
    const { monthlyPremium, commissionRate } = params;
    const advanceMonths = params.advanceMonths ?? this.DEFAULT_ADVANCE_MONTHS;

    // Validation
    if (monthlyPremium <= 0) {
      throw new Error(
        `Monthly premium must be positive, got ${monthlyPremium}`,
      );
    }
    if (commissionRate <= 0) {
      throw new Error(
        `Commission rate must be positive, got ${commissionRate}`,
      );
    }
    if (advanceMonths <= 0 || advanceMonths > 12) {
      throw new Error(
        `Advance months must be between 1-12, got ${advanceMonths}`,
      );
    }

    // CORE FORMULA: The ONE formula for commission calculation.
    // Round the advance to cents here so the persisted/canonical value is exact;
    // the earning rate is a derived helper (not money) and stays full-precision.
    const advanceAmount = roundCurrency(
      monthlyPremium * advanceMonths * commissionRate,
    );
    const monthlyEarningRate = advanceAmount / advanceMonths;

    logger.info(
      "Advance calculated",
      {
        monthlyPremium,
        advanceMonths,
        commissionRate,
        advanceAmount,
        monthlyEarningRate,
      },
      "CommissionLifecycle",
    );

    return {
      advanceAmount,
      monthlyEarningRate,
      advanceMonths,
      commissionRate,
    };
  }

  /**
   * Calculate commission advance with carrier cap applied
   *
   * BUSINESS RULE:
   * Some carriers have a maximum advance amount (e.g., Mutual of Omaha = $3,000).
   * When calculated advance exceeds the cap:
   *   - Agent receives the capped amount as upfront advance
   *   - Overage is paid "as earned" after the advance is recouped
   *
   * Recoupment period = advanceCap / monthlyEarningRate
   * Overage payments start at recoupment_months + 1
   *
   * @param params - Capped advance calculation parameters
   * @returns Capped advance calculation result
   *
   * @example
   * ```typescript
   * // Policy with $500/month premium at 100% commission rate, $3,000 carrier cap
   * const result = service.calculateCappedAdvance({
   *   monthlyPremium: 500,
   *   advanceMonths: 9,
   *   commissionRate: 1.0, // 100%
   *   advanceCap: 3000
   * });
   * // result.originalAdvance = $4,500 (500 × 9 × 1.0)
   * // result.cappedAdvanceAmount = $3,000 (capped)
   * // result.overageAmount = $1,500
   * // result.overageStartMonth = 7 (3000/500 = 6 months to recoup, overage starts month 7)
   * ```
   */
  public calculateCappedAdvance(
    params: CappedAdvanceCalculationParams,
  ): CappedAdvanceCalculationResult {
    // First, calculate the normal advance without cap
    const baseResult = this.calculateAdvance(params);
    const { advanceAmount, monthlyEarningRate } = baseResult;

    // If no cap or advance is under cap, return normal result
    if (
      !params.advanceCap ||
      params.advanceCap <= 0 ||
      advanceAmount <= params.advanceCap
    ) {
      return {
        ...baseResult,
        originalAdvance: advanceAmount,
        cappedAdvanceAmount: advanceAmount,
        overageAmount: 0,
        overageStartMonth: null,
        isCapped: false,
      };
    }

    // Cap is applied
    const cappedAdvanceAmount = roundCurrency(params.advanceCap);
    const overageAmount = roundCurrency(advanceAmount - cappedAdvanceAmount);

    // Calculate recoupment period
    // Recoupment months = cap / monthly_earning_rate (how many months to earn back the capped advance)
    const recoupmentMonths = Math.ceil(
      cappedAdvanceAmount / monthlyEarningRate,
    );
    const overageStartMonth = recoupmentMonths + 1;

    logger.info(
      "Capped advance calculated",
      {
        originalAdvance: advanceAmount,
        advanceCap: params.advanceCap,
        cappedAdvanceAmount,
        overageAmount,
        monthlyEarningRate,
        recoupmentMonths,
        overageStartMonth,
      },
      "CommissionLifecycle",
    );

    return {
      ...baseResult,
      advanceAmount: cappedAdvanceAmount, // Override with capped amount
      originalAdvance: advanceAmount,
      cappedAdvanceAmount,
      overageAmount,
      overageStartMonth,
      isCapped: true,
    };
  }

  /**
   * Calculate earned and unearned commission amounts
   *
   * BUSINESS RULE:
   * Each month the client pays their premium, 1/advanceMonths of the advance becomes earned.
   *
   * Earned = (Advance / Advance Months) × Months Paid
   * Unearned = Advance - Earned
   *
   * @param params - Earned calculation parameters
   * @returns Earned commission breakdown
   *
   * @example
   * ```typescript
   * // After 3 months of client payments on a $4,612.50 advance
   * const result = service.calculateEarned({
   *   advanceAmount: 4612.50,
   *   advanceMonths: 9,
   *   monthsPaid: 3
   * });
   * // result.earnedAmount = $1,537.50
   * // result.unearnedAmount = $3,075.00
   * // result.percentageEarned = 33.33%
   * ```
   */
  public calculateEarned(
    params: EarnedCalculationParams,
  ): EarnedCalculationResult {
    const { advanceAmount, advanceMonths, monthsPaid } = params;

    // Validation
    if (advanceAmount < 0) {
      throw new Error(
        `Advance amount cannot be negative, got ${advanceAmount}`,
      );
    }
    if (monthsPaid < 0) {
      throw new Error(`Months paid cannot be negative, got ${monthsPaid}`);
    }
    // Guard divide-by-zero: advanceMonths is the divisor for the earning rate.
    // A 0 (from a malformed record) would yield Infinity/NaN earned amounts that
    // silently corrupt stored money and every downstream rollup.
    if (advanceMonths <= 0) {
      throw new Error(`Advance months must be positive, got ${advanceMonths}`);
    }

    // Cap months paid at advance months (can't earn more than advance)
    const effectiveMonthsPaid = Math.min(monthsPaid, advanceMonths);

    const monthlyEarningRate = advanceAmount / advanceMonths;
    // Round earned, then derive unearned from the rounded earned so the two always
    // reconcile to the input advance (earned + unearned === advanceAmount).
    const earnedAmount = roundCurrency(
      monthlyEarningRate * effectiveMonthsPaid,
    );
    const unearnedAmount = roundCurrency(advanceAmount - earnedAmount);
    const percentageEarned = (effectiveMonthsPaid / advanceMonths) * 100;
    const isFullyEarned = effectiveMonthsPaid >= advanceMonths;
    const monthsRemaining = Math.max(0, advanceMonths - effectiveMonthsPaid);

    return {
      earnedAmount,
      unearnedAmount,
      percentageEarned,
      isFullyEarned,
      monthsRemaining,
    };
  }

  /**
   * Calculate unearned commission amount (convenience method)
   *
   * @param advanceAmount - Total advance paid
   * @param advanceMonths - Number of months in advance period
   * @param monthsPaid - Number of months client has paid
   * @returns Unearned amount remaining
   */
  public calculateUnearned(
    advanceAmount: number,
    advanceMonths: number,
    monthsPaid: number,
  ): number {
    const result = this.calculateEarned({
      advanceAmount,
      advanceMonths,
      monthsPaid,
    });
    return result.unearnedAmount;
  }

  /**
   * Calculate chargeback amount when policy lapses
   *
   * BUSINESS RULE:
   * When a policy cancels or lapses before the advance is fully earned,
   * the agent must pay back the unearned portion.
   *
   * Chargeback = Advance - Earned
   * Chargeback = Advance - ((Advance / Advance Months) × Months Paid)
   *
   * @param params - Chargeback calculation parameters
   * @returns Chargeback calculation result
   *
   * @example
   * ```typescript
   * // Policy lapses after 3 months on a 9-month advance
   * const result = service.calculateChargeback({
   *   advanceAmount: 4612.50,
   *   advanceMonths: 9,
   *   monthsPaid: 3,
   *   lapseDate: new Date('2024-04-01'),
   *   effectiveDate: new Date('2024-01-01')
   * });
   * // result.chargebackAmount = $3,075.00
   * // result.earnedAmount = $1,537.50
   * ```
   */
  public calculateChargeback(
    params: ChargebackCalculationParams,
  ): ChargebackCalculationResult {
    const {
      advanceAmount,
      advanceMonths,
      monthsPaid,
      lapseDate,
      effectiveDate,
    } = params;

    // Calculate earned portion
    const earnedResult = this.calculateEarned({
      advanceAmount,
      advanceMonths,
      monthsPaid,
    });

    // Chargeback is the unearned amount
    const chargebackAmount = earnedResult.unearnedAmount;

    // Calculate months elapsed (for reporting)
    const monthsElapsed = this.calculateMonthsElapsed(effectiveDate, lapseDate);

    // Determine chargeback reason
    let chargebackReason = "Policy lapsed before advance fully earned";
    if (monthsPaid === 0) {
      chargebackReason = "Policy cancelled with no payments - full chargeback";
    } else if (monthsPaid < 3) {
      chargebackReason = `Policy lapsed early (${monthsPaid} months) - high chargeback`;
    } else if (earnedResult.isFullyEarned) {
      chargebackReason = "No chargeback - advance fully earned";
    }

    logger.info(
      "Chargeback calculated",
      {
        advanceAmount,
        monthsPaid,
        earnedAmount: earnedResult.earnedAmount,
        chargebackAmount,
        reason: chargebackReason,
      },
      "CommissionLifecycle",
    );

    return {
      chargebackAmount,
      earnedAmount: earnedResult.earnedAmount,
      monthsPaid,
      monthsElapsed,
      chargebackReason,
    };
  }

  /**
   * Calculate months elapsed between two dates
   *
   * @param startDate - Start date (policy effective date)
   * @param endDate - End date (lapse date or current date)
   * @returns Number of months elapsed (rounded down)
   */
  public calculateMonthsElapsed(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Use UTC accessors. Date-only strings (e.g. "2024-01-31") parse as UTC
    // midnight; reading them back with local getMonth()/getFullYear() shifts the
    // result by a month for users west of UTC, mis-counting persistency and
    // months-paid milestones. UTC keeps the month boundary stable everywhere.
    const yearDiff = end.getUTCFullYear() - start.getUTCFullYear();
    const monthDiff = end.getUTCMonth() - start.getUTCMonth();

    return yearDiff * 12 + monthDiff;
  }

  /**
   * Calculate months paid based on policy effective date
   *
   * This determines how many months the client has actually paid by comparing
   * the effective date to the current date (or lapse date).
   *
   * @param effectiveDate - Policy effective date
   * @param asOfDate - Date to calculate as of (default: today)
   * @param status - Policy status ('active' | 'lapsed' | 'cancelled')
   * @returns Number of months paid (capped at advance months)
   */
  public calculateMonthsPaid(
    effectiveDate: Date,
    asOfDate: Date = new Date(),
    status: "active" | "lapsed" | "cancelled" = "active",
  ): number {
    // If cancelled immediately, 0 months paid
    if (status === "cancelled") {
      return 0;
    }

    // Calculate months elapsed
    const monthsElapsed = this.calculateMonthsElapsed(effectiveDate, asOfDate);

    // Assume client paid up to the lapse date or current month
    // (In production, this should come from actual payment records)
    return Math.max(0, monthsElapsed);
  }

  /**
   * Calculate persistency rate for a cohort of policies at specific milestones
   *
   * Persistency = % of policies still active at milestone
   *
   * This helps predict future chargebacks and assess portfolio quality.
   *
   * @param cohort - Array of policies to analyze
   * @param cohortStartDate - Start of cohort period
   * @param cohortEndDate - End of cohort period
   * @returns Complete persistency analysis
   *
   * @example
   * ```typescript
   * // Analyze policies from January 2024
   * const analysis = service.calculatePersistencyMetrics(
   *   policies,
   *   new Date('2024-01-01'),
   *   new Date('2024-01-31')
   * );
   * // analysis.milestones.threeMonth.persistencyRate = 95%
   * // analysis.milestones.sixMonth.persistencyRate = 88%
   * ```
   */
  public calculatePersistencyMetrics(
    cohort: PolicyCohort[],
    cohortStartDate: Date,
    cohortEndDate: Date,
  ): PersistencyAnalysis {
    const totalPolicies = cohort.length;

    if (totalPolicies === 0) {
      throw new Error("Cannot calculate persistency for empty cohort");
    }

    // Calculate milestone metrics
    const milestones = {
      threeMonth: this.calculateMilestonePersistency(
        cohort,
        cohortStartDate,
        3,
      ),
      sixMonth: this.calculateMilestonePersistency(cohort, cohortStartDate, 6),
      nineMonth: this.calculateMilestonePersistency(cohort, cohortStartDate, 9),
      twelveMonth: this.calculateMilestonePersistency(
        cohort,
        cohortStartDate,
        12,
      ),
    };

    // Calculate average persistency
    const averagePersistency =
      (milestones.threeMonth.persistencyRate +
        milestones.sixMonth.persistencyRate +
        milestones.nineMonth.persistencyRate +
        milestones.twelveMonth.persistencyRate) /
      4;

    // Predict chargeback rate based on lapse patterns
    // Policies that lapse before 9 months create chargebacks
    const predictedChargebackRate = 100 - milestones.nineMonth.persistencyRate;

    return {
      cohortStartDate,
      cohortEndDate,
      totalPolicies,
      milestones,
      averagePersistency,
      predictedChargebackRate,
    };
  }

  /**
   * Calculate persistency at a specific milestone
   *
   * @param cohort - Policies to analyze
   * @param cohortStartDate - Start of cohort
   * @param months - Milestone in months (3, 6, 9, 12)
   * @returns Persistency metrics at milestone
   */
  private calculateMilestonePersistency(
    cohort: PolicyCohort[],
    cohortStartDate: Date,
    months: number,
  ): PersistencyMilestone {
    const milestoneDate = new Date(cohortStartDate);
    milestoneDate.setMonth(milestoneDate.getMonth() + months);

    let activePolicies = 0;
    let lapsedPolicies = 0;

    for (const policy of cohort) {
      // Check if policy is still active at milestone
      if (policy.status === "active") {
        activePolicies++;
      } else if (policy.lapseDate) {
        // If lapsed, check if it lapsed before or after milestone
        if (policy.lapseDate <= milestoneDate) {
          lapsedPolicies++;
        } else {
          // Lapsed after milestone, so it was active at milestone
          activePolicies++;
        }
      } else {
        // Status is lapsed/cancelled but no lapse date, assume lapsed
        lapsedPolicies++;
      }
    }

    const totalPolicies = cohort.length;
    const persistencyRate = (activePolicies / totalPolicies) * 100;
    const lapsedRate = (lapsedPolicies / totalPolicies) * 100;

    return {
      months,
      activePolicies,
      lapsedPolicies,
      totalPolicies,
      persistencyRate,
      lapsedRate,
    };
  }

  /**
   * Validate if commission is fully earned
   *
   * @param advanceMonths - Number of months in advance
   * @param monthsPaid - Number of months paid
   * @returns True if fully earned
   */
  public isFullyEarned(advanceMonths: number, monthsPaid: number): boolean {
    return monthsPaid >= advanceMonths;
  }

  /**
   * Get risk assessment for a commission based on months paid
   *
   * @param monthsPaid - Number of months client has paid
   * @param advanceMonths - Number of months in advance period
   * @returns Risk level and description
   */
  public getChargebackRisk(
    monthsPaid: number,
    advanceMonths: number = this.DEFAULT_ADVANCE_MONTHS,
  ): { level: "high" | "medium" | "low" | "none"; description: string } {
    if (monthsPaid === 0) {
      return {
        level: "high",
        description: "No payments received - 100% chargeback risk",
      };
    }

    if (monthsPaid < 3) {
      return {
        level: "high",
        description: `Only ${monthsPaid} months paid - significant chargeback risk`,
      };
    }

    if (monthsPaid < 6) {
      return {
        level: "medium",
        description: `${monthsPaid} months paid - moderate chargeback risk`,
      };
    }

    if (monthsPaid < advanceMonths) {
      return {
        level: "low",
        description: `${monthsPaid}/${advanceMonths} months paid - low chargeback risk`,
      };
    }

    return {
      level: "none",
      description: "Advance fully earned - no chargeback risk",
    };
  }
}

// Export singleton instance
export const commissionLifecycleService =
  CommissionLifecycleService.getInstance();

// Export class for testing
export { CommissionLifecycleService };
