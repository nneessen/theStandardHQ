// src/services/underwriting/premium-calculator.ts
// Stage 3: Premium Calculation
// Gets premium from premium_matrix with interpolation and health class fallback.

import {
  getPremiumMatrixForProduct,
  interpolatePremium,
  type GenderType,
  type TobaccoClass,
  type TermYears,
  type PremiumLookupResult,
  type PremiumMatrix,
} from "../repositories/premiumMatrixService";

// =============================================================================
// Premium Lookup
// =============================================================================

/**
 * Get premium from premium_matrix with interpolation and health class fallback.
 * Returns the premium result with metadata about the health class used.
 *
 * @param productId - The product ID
 * @param age - Client's age
 * @param gender - Client's gender
 * @param tobacco - Whether client uses tobacco
 * @param healthClass - Raw health class from Stage 2 (will be normalized)
 * @param faceAmount - Requested face amount
 * @param imoId - IMO ID for rate lookup
 * @param termYears - Optional term years (null for permanent products)
 * @param prefetchedMatrix - Optional pre-fetched matrix to avoid duplicate DB query
 * @returns Premium lookup result with premium amount and metadata
 */
export async function getPremium(
  productId: string,
  age: number,
  gender: GenderType,
  tobacco: boolean,
  healthClass: string, // Raw health class from Stage 2 (will be normalized)
  faceAmount: number,
  imoId: string,
  termYears?: number | null,
  /** Optional pre-fetched matrix to avoid duplicate DB query */
  prefetchedMatrix?: PremiumMatrix[],
): Promise<PremiumLookupResult> {
  try {
    // Use pre-fetched matrix if provided, otherwise fetch (backward compatibility)
    const matrix =
      prefetchedMatrix ?? (await getPremiumMatrixForProduct(productId, imoId));

    if (!matrix || matrix.length === 0) {
      return { premium: null, reason: "NO_MATRIX" };
    }

    const tobaccoClass: TobaccoClass = tobacco ? "tobacco" : "non_tobacco";

    // If termYears not specified, try to find matching term from available data
    let effectiveTermYears: TermYears | null | undefined = termYears as
      | TermYears
      | null
      | undefined;
    if (effectiveTermYears === undefined) {
      // Check what term years are available in the matrix
      const availableTerms = [...new Set(matrix.map((m) => m.term_years))];
      if (availableTerms.length === 1 && availableTerms[0] === null) {
        // All rows have null term_years - this is a permanent product
        effectiveTermYears = null;
      } else if (!availableTerms.includes(null)) {
        // No null term_years - this is a term product, use default 20 years
        // or the most common available term
        const preferredTerms: TermYears[] = [20, 10, 15, 25, 30];
        const matchedTerm = preferredTerms.find((t) =>
          availableTerms.includes(t),
        );
        effectiveTermYears =
          matchedTerm ||
          (availableTerms.filter((t): t is TermYears => t !== null)[0] as
            | TermYears
            | undefined) ||
          20;
      }
    }

    return interpolatePremium(
      matrix,
      age,
      faceAmount,
      gender,
      tobaccoClass,
      healthClass,
      effectiveTermYears,
    );
  } catch (error) {
    console.error("Error getting premium:", error);
    return { premium: null, reason: "NO_MATCHING_RATES" };
  }
}
