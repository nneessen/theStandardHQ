// src/features/underwriting/utils/eligibilityChecker.ts

import type {
  ProductUnderwritingConstraints,
  ProductEligibilityResult,
  EligibilityClientProfile,
} from "../../types/product-constraints.types";
import type { CarrierRecommendation } from "../../types/underwriting.types";
import { formatCurrency } from "../shared/formatters";

/**
 * Checks if a client's age falls within an age tier range
 */
function isInAgeTier(age: number, minAge: number, maxAge: number): boolean {
  return age >= minAge && age <= maxAge;
}

/**
 * Gets the maximum face amount allowed for a client's age based on age-tiered limits
 * Returns null if no tier matches (meaning no age-based limit applies)
 */
function getMaxFaceAmountForAge(
  age: number,
  constraints: ProductUnderwritingConstraints,
): number | null {
  const tiers = constraints.ageTieredFaceAmounts?.tiers;
  if (!tiers || tiers.length === 0) return null;

  for (const tier of tiers) {
    if (isInAgeTier(age, tier.minAge, tier.maxAge)) {
      return tier.maxFaceAmount;
    }
  }

  // No matching tier found - no age-based limit applies
  return null;
}

/**
 * Gets the full underwriting threshold for a client's age
 * Age-specific thresholds override the base threshold
 */
function getFullUnderwritingThreshold(
  age: number,
  constraints: ProductUnderwritingConstraints,
): number | null {
  const thresholdConfig = constraints.fullUnderwritingThreshold;
  if (!thresholdConfig) return null;

  // Check for age-specific threshold first
  const ageBands = thresholdConfig.ageBands;
  if (ageBands && ageBands.length > 0) {
    for (const band of ageBands) {
      if (isInAgeTier(age, band.minAge, band.maxAge)) {
        return band.threshold;
      }
    }
  }

  // Fall back to base threshold
  return thresholdConfig.faceAmountThreshold || null;
}

/**
 * Checks if client has any knockout conditions that disqualify them from a product
 * Returns array of matching knockout condition codes (from client's conditions)
 * Matching is case-insensitive to handle inconsistent casing in condition codes
 */
function getMatchingKnockoutConditions(
  clientConditions: string[],
  constraints: ProductUnderwritingConstraints,
): string[] {
  const knockoutCodes = constraints.knockoutConditions?.conditionCodes;
  if (!knockoutCodes || knockoutCodes.length === 0) return [];

  // Use Set with lowercase for O(1) lookup and case-insensitive matching
  const normalizedKnockouts = new Set(
    knockoutCodes.map((code) => code.toLowerCase()),
  );

  return clientConditions.filter((code) =>
    normalizedKnockouts.has(code.toLowerCase()),
  );
}

/**
 * Evaluates a product's eligibility for a given client profile
 */
export function checkProductEligibility(
  productId: string,
  productName: string,
  carrierId: string,
  carrierName: string,
  productType: string,
  constraints: ProductUnderwritingConstraints | null,
  client: EligibilityClientProfile,
  conditionNames?: Map<string, string>,
): ProductEligibilityResult {
  const result: ProductEligibilityResult = {
    productId,
    productName,
    carrierId,
    carrierName,
    productType,
    isEligible: true,
    ineligibilityReasons: [],
    maxAllowedFaceAmount: null,
    requiresFullUnderwriting: false,
    fullUnderwritingThreshold: null,
  };

  // No constraints = fully eligible
  if (!constraints) {
    return result;
  }

  // Check age-tiered face amount limits
  const maxFaceAmount = getMaxFaceAmountForAge(client.age, constraints);
  if (maxFaceAmount !== null) {
    result.maxAllowedFaceAmount = maxFaceAmount;
    if (client.requestedFaceAmount > maxFaceAmount) {
      result.isEligible = false;
      result.ineligibilityReasons.push(
        `Max ${formatCurrency(maxFaceAmount)} for ages ${getAgeTierDescription(client.age, constraints)}`,
      );
    }
  }

  // Check knockout conditions
  const matchingKnockouts = getMatchingKnockoutConditions(
    client.conditionCodes,
    constraints,
  );
  if (matchingKnockouts.length > 0) {
    result.isEligible = false;
    const conditionDescriptions = matchingKnockouts.map(
      (code) => conditionNames?.get(code) || code,
    );
    result.ineligibilityReasons.push(
      `Disqualifying condition${matchingKnockouts.length > 1 ? "s" : ""}: ${conditionDescriptions.join(", ")}`,
    );
  }

  // Check full underwriting threshold
  const threshold = getFullUnderwritingThreshold(client.age, constraints);
  if (threshold !== null) {
    result.fullUnderwritingThreshold = threshold;
    if (client.requestedFaceAmount > threshold) {
      result.requiresFullUnderwriting = true;
    }
  }

  return result;
}

/**
 * Gets a human-readable description of the age tier that applies to the client
 */
function getAgeTierDescription(
  age: number,
  constraints: ProductUnderwritingConstraints,
): string {
  const tiers = constraints.ageTieredFaceAmounts?.tiers;
  if (!tiers || tiers.length === 0) return "";

  for (const tier of tiers) {
    if (isInAgeTier(age, tier.minAge, tier.maxAge)) {
      return `${tier.minAge}-${tier.maxAge}`;
    }
  }

  return "";
}

/**
 * Extended recommendation with eligibility information
 */
export interface RecommendationWithEligibility extends CarrierRecommendation {
  eligibility: ProductEligibilityResult;
}

/**
 * Applies eligibility checks to a list of recommendations
 * Returns recommendations enhanced with eligibility data
 */
export function applyEligibilityToRecommendations(
  recommendations: CarrierRecommendation[],
  client: EligibilityClientProfile,
  productConstraintsMap: Map<string, ProductUnderwritingConstraints | null>,
  conditionNames?: Map<string, string>,
): RecommendationWithEligibility[] {
  return recommendations.map((rec) => {
    const constraints = productConstraintsMap.get(rec.productId) ?? null;
    const eligibility = checkProductEligibility(
      rec.productId,
      rec.productName,
      rec.carrierId,
      rec.carrierName,
      "", // Product type not critical for display
      constraints,
      client,
      conditionNames,
    );

    return {
      ...rec,
      eligibility,
    };
  });
}

/**
 * Separates recommendations into eligible and ineligible groups
 */
export function separateByEligibility(
  recommendations: RecommendationWithEligibility[],
): {
  eligible: RecommendationWithEligibility[];
  ineligible: RecommendationWithEligibility[];
} {
  const eligible: RecommendationWithEligibility[] = [];
  const ineligible: RecommendationWithEligibility[] = [];

  for (const rec of recommendations) {
    if (rec.eligibility.isEligible) {
      eligible.push(rec);
    } else {
      ineligible.push(rec);
    }
  }

  return { eligible, ineligible };
}
