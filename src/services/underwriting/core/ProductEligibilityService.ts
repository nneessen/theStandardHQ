// src/services/underwriting/ProductEligibilityService.ts

import type {
  ProductWithConstraints,
  ProductEligibilityResult,
  EligibilityClientProfile,
  EligibilityFilterResult,
  AgeTier,
} from "@/features/underwriting/types/product-constraints.types";

/**
 * Service for checking product eligibility based on underwriting constraints.
 * Used to pre-filter products before AI analysis.
 */
export class ProductEligibilityService {
  /**
   * Find the matching age tier for a client's age
   */
  private findAgeTier(tiers: AgeTier[], clientAge: number): AgeTier | null {
    return (
      tiers.find(
        (tier) => clientAge >= tier.minAge && clientAge <= tier.maxAge,
      ) || null
    );
  }

  /**
   * Get the maximum face amount allowed for a product given the client's age
   */
  getMaxFaceAmount(
    product: ProductWithConstraints,
    clientAge: number,
  ): number | null {
    const constraints = product.metadata;

    // Check age-tiered limits first
    if (constraints?.ageTieredFaceAmounts?.tiers) {
      const tier = this.findAgeTier(
        constraints.ageTieredFaceAmounts.tiers,
        clientAge,
      );
      if (tier) {
        return tier.maxFaceAmount;
      }
    }

    // Fall back to product-level max
    return product.max_face_amount;
  }

  /**
   * Check if the client has any knockout conditions for this product
   */
  hasKnockoutCondition(
    product: ProductWithConstraints,
    clientConditions: string[],
  ): { hasKnockout: boolean; knockoutConditions: string[] } {
    const constraints = product.metadata;

    if (!constraints?.knockoutConditions?.conditionCodes) {
      return { hasKnockout: false, knockoutConditions: [] };
    }

    const knockoutCodes = constraints.knockoutConditions.conditionCodes;
    const clientKnockouts = clientConditions.filter((code) =>
      knockoutCodes.includes(code),
    );

    return {
      hasKnockout: clientKnockouts.length > 0,
      knockoutConditions: clientKnockouts,
    };
  }

  /**
   * Get the full underwriting threshold for a product given the client's age
   */
  getFullUnderwritingThreshold(
    product: ProductWithConstraints,
    clientAge: number,
  ): number | null {
    const constraints = product.metadata;

    if (!constraints?.fullUnderwritingThreshold) {
      return null;
    }

    const threshold = constraints.fullUnderwritingThreshold;

    // Check age bands first (more specific)
    if (threshold.ageBands) {
      const band = threshold.ageBands.find(
        (b) => clientAge >= b.minAge && clientAge <= b.maxAge,
      );
      if (band) {
        return band.threshold;
      }
    }

    // Fall back to base threshold
    return threshold.faceAmountThreshold;
  }

  /**
   * Check if a single product is eligible for a client
   */
  checkProductEligibility(
    product: ProductWithConstraints,
    client: EligibilityClientProfile,
  ): ProductEligibilityResult {
    const reasons: string[] = [];
    let isEligible = true;

    // 1. Check basic age eligibility
    if (product.min_age !== null && client.age < product.min_age) {
      isEligible = false;
      reasons.push(`Client age ${client.age} below minimum ${product.min_age}`);
    }
    if (product.max_age !== null && client.age > product.max_age) {
      isEligible = false;
      reasons.push(`Client age ${client.age} above maximum ${product.max_age}`);
    }

    // 2. Check face amount against age-tiered limits
    const maxAllowedFaceAmount = this.getMaxFaceAmount(product, client.age);
    if (
      maxAllowedFaceAmount !== null &&
      client.requestedFaceAmount > maxAllowedFaceAmount
    ) {
      isEligible = false;
      reasons.push(
        `Requested $${client.requestedFaceAmount.toLocaleString()} exceeds ` +
          `max $${maxAllowedFaceAmount.toLocaleString()} for age ${client.age}`,
      );
    }

    // 3. Check knockout conditions
    const knockoutCheck = this.hasKnockoutCondition(
      product,
      client.conditionCodes,
    );
    if (knockoutCheck.hasKnockout) {
      isEligible = false;
      reasons.push(
        `Knockout conditions: ${knockoutCheck.knockoutConditions.join(", ")}`,
      );
    }

    // 4. Check full underwriting threshold (informational, not disqualifying)
    const fullUnderwritingThreshold = this.getFullUnderwritingThreshold(
      product,
      client.age,
    );
    const requiresFullUnderwriting =
      fullUnderwritingThreshold !== null &&
      client.requestedFaceAmount > fullUnderwritingThreshold;

    return {
      productId: product.id,
      productName: product.name,
      carrierId: product.carrier_id,
      carrierName: product.carrier_name,
      productType: product.product_type,
      isEligible,
      ineligibilityReasons: reasons,
      maxAllowedFaceAmount,
      requiresFullUnderwriting,
      fullUnderwritingThreshold,
    };
  }

  /**
   * Filter a list of products to only eligible ones
   */
  filterEligibleProducts(
    products: ProductWithConstraints[],
    client: EligibilityClientProfile,
  ): EligibilityFilterResult {
    const results = products.map((p) =>
      this.checkProductEligibility(p, client),
    );

    return {
      eligible: results.filter((r) => r.isEligible),
      ineligible: results.filter((r) => !r.isEligible),
    };
  }

  /**
   * Group eligible products by carrier
   */
  groupEligibleByCarrier(
    eligibleResults: ProductEligibilityResult[],
  ): Map<string, ProductEligibilityResult[]> {
    const grouped = new Map<string, ProductEligibilityResult[]>();

    for (const result of eligibleResults) {
      const existing = grouped.get(result.carrierId) || [];
      existing.push(result);
      grouped.set(result.carrierId, existing);
    }

    return grouped;
  }

  /**
   * Validate age tier configuration (for UI validation)
   */
  validateAgeTiers(tiers: AgeTier[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for empty tiers
    if (tiers.length === 0) {
      return { valid: true, errors: [] };
    }

    // Sort tiers by minAge for overlap checking
    const sortedTiers = [...tiers].sort((a, b) => a.minAge - b.minAge);

    for (let i = 0; i < sortedTiers.length; i++) {
      const tier = sortedTiers[i];

      // Validate individual tier
      if (tier.minAge < 0 || tier.minAge > 120) {
        errors.push(`Tier ${i + 1}: minAge must be between 0 and 120`);
      }
      if (tier.maxAge < 0 || tier.maxAge > 120) {
        errors.push(`Tier ${i + 1}: maxAge must be between 0 and 120`);
      }
      if (tier.minAge > tier.maxAge) {
        errors.push(`Tier ${i + 1}: minAge cannot be greater than maxAge`);
      }
      if (tier.maxFaceAmount <= 0) {
        errors.push(`Tier ${i + 1}: maxFaceAmount must be positive`);
      }

      // Check for overlaps with next tier
      if (i < sortedTiers.length - 1) {
        const nextTier = sortedTiers[i + 1];
        if (tier.maxAge >= nextTier.minAge) {
          errors.push(
            `Tiers ${i + 1} and ${i + 2} have overlapping age ranges`,
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const productEligibilityService = new ProductEligibilityService();
