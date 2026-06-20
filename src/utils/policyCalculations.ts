// /home/nneessen/projects/commissionTracker/src/utils/policyCalculations.ts

import { PaymentFrequency } from "../types/policy.types";

/**
 * Calculate annual premium from payment amount and frequency
 */
export function calculateAnnualPremium(
  premium: number,
  frequency: PaymentFrequency,
): number {
  if (premium <= 0) return 0;

  switch (frequency) {
    case "monthly":
      return premium * 12;
    case "quarterly":
      return premium * 4;
    case "semi_annual":
      return premium * 2;
    case "annual":
      return premium;
    default:
      return premium;
  }
}

/**
 * Calculate payment amount from annual premium and frequency
 */
export function calculatePaymentAmount(
  annualPremium: number,
  frequency: PaymentFrequency,
): number {
  if (annualPremium <= 0) return 0;

  let result: number;
  switch (frequency) {
    case "monthly":
      result = annualPremium / 12;
      break;
    case "quarterly":
      result = annualPremium / 4;
      break;
    case "semi_annual":
      result = annualPremium / 2;
      break;
    case "annual":
      result = annualPremium;
      break;
    default:
      result = annualPremium;
  }
  // Round to 2 decimal places to avoid floating-point precision issues
  return Math.round(result * 100) / 100;
}

/**
 * Calculate expected commission advance (9-month advance by default)
 *
 * IMPORTANT: This is the ADVANCE amount, not annual commission.
 * Advance = upfront payment for X months of commissions.
 *
 * Formula: Monthly Premium × Advance Months × Commission Rate
 *
 * @param annualPremium - Annual premium amount (e.g., $1200)
 * @param commissionPercentage - Commission as WHOLE NUMBER percentage (e.g., 85 for 85%, NOT 0.85)
 * @param advanceMonths - Number of months advance (default 9, industry standard)
 * @returns Commission advance amount
 *
 * @example
 * // $100/month premium, 85% commission, 9-month advance
 * calculateExpectedCommission(1200, 85, 9) // Returns $765
 */
export function calculateExpectedCommission(
  annualPremium: number,
  commissionPercentage: number,
  advanceMonths: number = 9,
): number {
  if (annualPremium <= 0 || commissionPercentage <= 0) return 0;

  // Convert annual to monthly premium
  const monthlyPremium = annualPremium / 12;

  // Calculate advance: Monthly Premium × Advance Months × Commission Rate
  // Divide by 100 to convert percentage to decimal (85 -> 0.85)
  return (monthlyPremium * advanceMonths * commissionPercentage) / 100;
}

/**
 * Calculate expected commission advance from decimal commission rate
 * Use this when commission is stored as decimal in database (e.g., 0.85 for 85%)
 *
 * @param annualPremium - Annual premium amount
 * @param commissionDecimal - Commission as DECIMAL (e.g., 0.85 for 85%, NOT 85)
 * @param advanceMonths - Number of months advance (default 9)
 * @returns Commission advance amount
 *
 * @example
 * // $100/month premium, 0.85 commission rate (85%), 9-month advance
 * calculateCommissionAdvance(1200, 0.85, 9) // Returns $765
 */
export function calculateCommissionAdvance(
  annualPremium: number,
  commissionDecimal: number,
  advanceMonths: number = 9,
): number {
  if (annualPremium <= 0 || commissionDecimal <= 0) return 0;

  // Convert annual to monthly premium
  const monthlyPremium = annualPremium / 12;

  // Calculate advance: Monthly Premium × Advance Months × Commission Rate
  return monthlyPremium * advanceMonths * commissionDecimal;
}

/**
 * Validate commission percentage is within reasonable bounds
 */
export function validateCommissionPercentage(percentage: number): boolean {
  return percentage > 0 && percentage <= 200; // Allow up to 200% for first-year bonuses
}

/**
 * Validate premium amount
 */
export function validatePremium(premium: number): boolean {
  return premium > 0 && premium < 1000000; // Reasonable upper limit
}
