// src/services/underwriting/recommendation-utils.ts
// Utility functions for recommendation display and formatting

import type { Recommendation } from "./decision-engine.types";
import type { TobaccoClass } from "../repositories/premiumMatrixService";

// =============================================================================
// Tobacco Class Helper
// =============================================================================

/**
 * Convert boolean tobacco flag to TobaccoClass type.
 *
 * @param tobacco - Whether the client uses tobacco
 * @returns The tobacco class for premium lookup
 */
export function getTobaccoClass(tobacco: boolean): TobaccoClass {
  return tobacco ? "tobacco" : "non_tobacco";
}

// =============================================================================
// Recommendation Reason Formatting
// =============================================================================

/**
 * Format the recommendation reason for display.
 *
 * @param reason - The reason code
 * @returns Human-readable reason string
 */
export function formatRecommendationReason(
  reason: Recommendation["reason"],
): string {
  switch (reason) {
    case "cheapest":
      return "Lowest Premium";
    case "highest_coverage":
      return "Most Coverage";
    case "best_approval":
      return "Best Approval Odds";
    case "best_value":
      return "Best Overall Value";
    case null:
      return "Verification Needed";
    default:
      return reason;
  }
}

/**
 * Get the badge color classes for a recommendation reason.
 *
 * @param reason - The reason code
 * @returns Tailwind CSS classes for the badge
 */
export function getReasonBadgeColor(reason: Recommendation["reason"]): string {
  switch (reason) {
    case "cheapest":
      return "text-green-700 bg-green-50 border-green-200";
    case "highest_coverage":
      return "text-blue-700 bg-blue-50 border-blue-200";
    case "best_approval":
      return "text-purple-700 bg-purple-50 border-purple-200";
    case "best_value":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case null:
      return "text-yellow-700 bg-yellow-50 border-yellow-200"; // Unknown eligibility
    default:
      return "text-gray-700 bg-gray-50 border-gray-200";
  }
}

// =============================================================================
// Currency and Percentage Formatting
// =============================================================================

/**
 * Format a number as US currency.
 *
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "$1,234.56")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a decimal as a percentage.
 *
 * @param value - The decimal value (0-1)
 * @returns Formatted percentage string (e.g., "85%")
 */
export function formatPercentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}
