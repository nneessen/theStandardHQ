// src/services/underwriting/eligibility-filter.ts
// Stage 1: Eligibility Filter
// Checks if a product is eligible for the client based on age, face amount,
// state availability, and knockout conditions.

import type {
  ProductCandidate,
  ProductMetadata,
  ClientProfile,
  CoverageRequest,
  EligibilityResult,
  ExtractedCriteria,
} from "./decision-engine.types.ts";
import type { MissingFieldInfo } from "@/features/underwriting/types/underwriting.types.ts";
import { calculateDataCompleteness } from "./conditionMatcher.ts";

// =============================================================================
// Face Amount Calculation
// =============================================================================

/**
 * Calculate the maximum face amount for a given age and term, considering:
 * 1. Product-level maxFaceAmount
 * 2. Age-tiered constraints from metadata
 * 3. Term-specific restrictions within age tiers
 *
 * @param metadata - Product metadata with age-tiered constraints
 * @param productMaxFace - Product-level max face amount (fallback)
 * @param clientAge - Client's age
 * @param termYears - Selected term (null for permanent products)
 * @returns Maximum allowed face amount
 */
export function getMaxFaceAmountForAgeTerm(
  metadata: ProductMetadata | null | undefined,
  productMaxFace: number | null | undefined,
  clientAge: number,
  termYears: number | null | undefined,
): number {
  let maxFace = productMaxFace ?? Number.MAX_SAFE_INTEGER;

  if (!metadata?.ageTieredFaceAmounts?.tiers) {
    return maxFace;
  }

  for (const tier of metadata.ageTieredFaceAmounts.tiers) {
    if (clientAge >= tier.minAge && clientAge <= tier.maxAge) {
      // Start with the tier's base max face amount
      let tierMax = tier.maxFaceAmount;

      // Check for term-specific restrictions within this tier
      if (termYears && tier.termRestrictions) {
        for (const termRestriction of tier.termRestrictions) {
          if (termRestriction.termYears === termYears) {
            // Use the more restrictive term-specific limit
            tierMax = Math.min(tierMax, termRestriction.maxFaceAmount);
          }
        }
      }

      maxFace = Math.min(maxFace, tierMax);
    }
  }

  return maxFace;
}

/**
 * Resolve the face amount above which a product requires full underwriting.
 * Supports both legacy numeric metadata and the richer age-banded object shape.
 */
export function getFullUnderwritingThreshold(
  metadata: ProductMetadata | null | undefined,
  clientAge: number,
): number | null {
  const thresholdConfig = metadata?.fullUnderwritingThreshold;
  if (thresholdConfig === undefined || thresholdConfig === null) {
    return null;
  }

  if (typeof thresholdConfig === "number") {
    return thresholdConfig > 0 ? thresholdConfig : null;
  }

  const ageBands = thresholdConfig.ageBands;
  if (ageBands && ageBands.length > 0) {
    for (const band of ageBands) {
      if (clientAge >= band.minAge && clientAge <= band.maxAge) {
        return band.threshold;
      }
    }
  }

  return thresholdConfig.faceAmountThreshold > 0
    ? thresholdConfig.faceAmountThreshold
    : null;
}

// =============================================================================
// Eligibility Checking
// =============================================================================

/**
 * Check if a product is eligible for the client.
 * Returns tri-state: eligible, ineligible, or unknown (when missing data).
 *
 * @param product - The product candidate to check
 * @param client - The client profile
 * @param coverage - The coverage request
 * @param extractedCriteria - Optional extracted criteria from carrier documents
 * @param _requiredFieldsByCondition - Optional required fields by condition (unused, for future)
 * @param termYears - Optional term years for term-specific restrictions
 * @returns Eligibility result with status, reasons, and confidence
 */
export function checkEligibility(
  product: ProductCandidate,
  client: ClientProfile,
  coverage: CoverageRequest,
  extractedCriteria?: ExtractedCriteria,
  _requiredFieldsByCondition?: Record<string, string[]>,
  termYears?: number | null,
): EligibilityResult {
  const ineligibleReasons: string[] = [];
  const unknownReasons: string[] = [];
  const missingFields: MissingFieldInfo[] = [];

  // Check basic product constraints (from products table)
  const minAge = product.minAge ?? 0;
  const maxAge = product.maxAge ?? 100;

  if (client.age < minAge) {
    ineligibleReasons.push(`Client age ${client.age} below minimum ${minAge}`);
  }
  if (client.age > maxAge) {
    ineligibleReasons.push(`Client age ${client.age} above maximum ${maxAge}`);
  }

  const minFace = product.minFaceAmount ?? 0;
  // Use helper function that considers age tier AND term restrictions
  const maxFace = getMaxFaceAmountForAgeTerm(
    product.metadata,
    product.maxFaceAmount,
    client.age,
    termYears,
  );

  if (coverage.faceAmount < minFace) {
    ineligibleReasons.push(
      `Requested $${coverage.faceAmount.toLocaleString()} below minimum`,
    );
  }
  if (coverage.faceAmount > maxFace && maxFace < Number.MAX_SAFE_INTEGER) {
    const termInfo = termYears ? ` for ${termYears}yr term` : "";
    ineligibleReasons.push(
      `Requested $${coverage.faceAmount.toLocaleString()} exceeds max $${maxFace.toLocaleString()} for age ${client.age}${termInfo}`,
    );
  }

  // Product metadata knockout conditions
  if (product.metadata?.knockoutConditions?.length) {
    const normalizedKnockouts = new Set(
      product.metadata.knockoutConditions.map((code) => code.toLowerCase()),
    );
    const matchingKnockouts = client.healthConditions.filter((conditionCode) =>
      normalizedKnockouts.has(conditionCode.toLowerCase()),
    );

    if (matchingKnockouts.length > 0) {
      ineligibleReasons.push(
        `Product knockout condition: ${matchingKnockouts.join(", ")}`,
      );
    }
  }

  const fullUnderwritingThreshold = getFullUnderwritingThreshold(
    product.metadata,
    client.age,
  );
  if (
    fullUnderwritingThreshold !== null &&
    coverage.faceAmount > fullUnderwritingThreshold
  ) {
    unknownReasons.push(
      `Requested $${coverage.faceAmount.toLocaleString()} exceeds simplified issue threshold $${fullUnderwritingThreshold.toLocaleString()} and may require full underwriting`,
    );
  }

  // Check extracted criteria if available (more sophisticated)
  if (extractedCriteria) {
    // Age limits from extracted criteria
    if (extractedCriteria.ageLimits) {
      const { minIssueAge, maxIssueAge } = extractedCriteria.ageLimits;
      if (minIssueAge !== undefined && client.age < minIssueAge) {
        if (!ineligibleReasons.some((r) => r.includes("below minimum"))) {
          ineligibleReasons.push(
            `Age ${client.age} below issue age ${minIssueAge}`,
          );
        }
      }
      if (maxIssueAge !== undefined && client.age > maxIssueAge) {
        if (!ineligibleReasons.some((r) => r.includes("above maximum"))) {
          ineligibleReasons.push(
            `Age ${client.age} above issue age ${maxIssueAge}`,
          );
        }
      }
    }

    // Face amount with age tiers (key feature)
    if (extractedCriteria.faceAmountLimits) {
      const { minimum, maximum, ageTiers } = extractedCriteria.faceAmountLimits;

      if (minimum !== undefined && coverage.faceAmount < minimum) {
        if (!ineligibleReasons.some((r) => r.includes("below minimum"))) {
          ineligibleReasons.push(
            `Amount below minimum $${minimum.toLocaleString()}`,
          );
        }
      }

      // Check age-specific face amount limits
      let ageSpecificMax = maximum ?? Number.MAX_SAFE_INTEGER;
      if (ageTiers && ageTiers.length > 0) {
        for (const tier of ageTiers) {
          if (client.age >= tier.minAge && client.age <= tier.maxAge) {
            ageSpecificMax = Math.min(ageSpecificMax, tier.maxFaceAmount);
          }
        }
      }

      if (
        coverage.faceAmount > ageSpecificMax &&
        ageSpecificMax < Number.MAX_SAFE_INTEGER
      ) {
        ineligibleReasons.push(
          `$${coverage.faceAmount.toLocaleString()} exceeds age-based max $${ageSpecificMax.toLocaleString()}`,
        );
      }
    }

    // Knockout conditions
    if (extractedCriteria.knockoutConditions?.conditionCodes) {
      const knockouts = client.healthConditions.filter((c) =>
        extractedCriteria.knockoutConditions!.conditionCodes!.includes(c),
      );
      if (knockouts.length > 0) {
        ineligibleReasons.push(`Knockout condition: ${knockouts.join(", ")}`);
      }
    }

    // State availability
    if (
      client.state &&
      extractedCriteria.stateAvailability?.unavailableStates
    ) {
      if (
        extractedCriteria.stateAvailability.unavailableStates.includes(
          client.state,
        )
      ) {
        ineligibleReasons.push(`Not available in ${client.state}`);
      }
    }

    if (
      client.state &&
      extractedCriteria.stateAvailability?.availableStates?.length
    ) {
      if (
        !extractedCriteria.stateAvailability.availableStates.includes(
          client.state,
        )
      ) {
        ineligibleReasons.push(`Not available in ${client.state}`);
      }
    }
  }

  // Check data completeness for conditions
  // Collect required fields across all conditions
  const allRequiredFields: string[] = [];
  const allResponses: Record<string, unknown> = {};

  for (const conditionCode of client.healthConditions) {
    const responses = client.conditionResponses?.[conditionCode] || {};
    Object.entries(responses).forEach(([key, value]) => {
      allResponses[`${conditionCode}.${key}`] = value;
    });
    // Note: In a full implementation, we'd look up required fields from
    // carrier_condition_acceptance.required_fields for this carrier/condition
    // For now, we mark as unknown if there are conditions but no responses
    if (
      client.conditionResponses &&
      Object.keys(client.conditionResponses[conditionCode] || {}).length === 0
    ) {
      missingFields.push({
        field: `${conditionCode}.follow_up`,
        reason: `Missing follow-up details for ${conditionCode}`,
        conditionCode,
      });
    }
  }

  // Calculate data completeness
  const completeness = calculateDataCompleteness(
    allResponses,
    allRequiredFields,
  );

  // Determine final eligibility status
  if (ineligibleReasons.length > 0) {
    return {
      status: "ineligible",
      reasons: ineligibleReasons,
      missingFields: [],
      confidence: 1, // We're confident about ineligibility
    };
  }

  if (unknownReasons.length > 0 || missingFields.length > 0) {
    return {
      status: "unknown",
      reasons:
        missingFields.length > 0
          ? [...unknownReasons, "Missing required follow-up information"]
          : unknownReasons,
      missingFields,
      confidence: missingFields.length > 0 ? completeness.confidence : 1,
    };
  }

  return {
    status: "eligible",
    reasons: [],
    missingFields: [],
    confidence: 1,
  };
}
