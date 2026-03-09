// src/services/underwriting/decision-engine.types.ts
// Type definitions for the Decision Engine
// Extracted from decisionEngine.ts for modularity

import type { Database } from "@/types/database.types.ts";
import type {
  EligibilityStatus,
  MissingFieldInfo,
  ScoreComponents,
  DraftRuleInfo,
  RuleProvenance,
  MedicationInfo,
  AcceptanceDecision,
} from "@/features/underwriting/types/underwriting.types.ts";
import type {
  GenderType,
  RateableHealthClass,
  AlternativeQuote,
  PremiumMatrix,
} from "./premium-matrix-core.ts";
import type {
  BuildTableType,
  BuildTableData,
  BmiTableData,
  BuildRatingClass,
} from "@/features/underwriting/types/build-table.types.ts";

// Re-export commonly used types for convenience
export type { GenderType, AcceptanceDecision };

// =============================================================================
// Database Types
// =============================================================================

export type ProductType = Database["public"]["Enums"]["product_type"];

// =============================================================================
// Health Class Types
// =============================================================================

export type HealthClass =
  | "preferred_plus"
  | "preferred"
  | "standard_plus"
  | "standard"
  | "table_rated"
  | "graded"
  | "modified"
  | "guaranteed_issue";

// =============================================================================
// Input Types
// =============================================================================

export interface ClientProfile {
  age: number;
  gender: GenderType;
  state?: string;
  bmi?: number;
  heightFeet?: number;
  heightInches?: number;
  weight?: number;
  tobacco: boolean;
  healthConditions: string[]; // condition codes
  medications?: MedicationInfo;
  /** Per-condition follow-up responses (for data completeness assessment) */
  conditionResponses?: Record<string, Record<string, unknown>>;
}

export interface CoverageRequest {
  faceAmount: number;
  /** User-specified face amounts for quote comparison. If provided, these are used instead of auto-generated amounts. */
  faceAmounts?: number[];
  productTypes?: ProductType[];
}

export interface DecisionEngineInput {
  client: ClientProfile;
  coverage: CoverageRequest;
  imoId: string;
  /** Optional preferred term length. If not provided, uses longest available term. */
  termYears?: number | null;
}

// =============================================================================
// Product Types
// =============================================================================

export interface ProductMetadata {
  ageTieredFaceAmounts?: {
    tiers: Array<{
      minAge: number;
      maxAge: number;
      maxFaceAmount: number;
      // Term-specific restrictions within this age tier
      termRestrictions?: Array<{
        termYears: number;
        maxFaceAmount: number;
      }>;
    }>;
  };
  knockoutConditions?: string[];
  fullUnderwritingThreshold?:
    | number
    | {
        faceAmountThreshold: number;
        ageBands?: Array<{
          minAge: number;
          maxAge: number;
          threshold: number;
        }>;
      };
  stateAvailability?: string[];
}

export interface ProductCandidate {
  productId: string;
  productName: string;
  carrierId: string;
  carrierName: string;
  productType: ProductType;
  minAge: number | null;
  maxAge: number | null;
  minFaceAmount: number | null;
  maxFaceAmount: number | null;
  metadata: ProductMetadata | null;
  buildChartId: string | null;
}

// =============================================================================
// Decision Types
// =============================================================================

export interface ConditionDecision {
  conditionCode: string;
  decision: AcceptanceDecision;
  likelihood: number;
  healthClassResult: string | null;
  /** Whether this rule is from an approved (reviewed) source */
  isApproved: boolean;
  /** Source provenance for the rule */
  provenance?: RuleProvenance;
}

// =============================================================================
// Result Types
// =============================================================================

export interface Recommendation {
  carrierId: string;
  carrierName: string;
  productId: string;
  productName: string;
  productType: ProductType;
  monthlyPremium: number | null;
  maxCoverage: number;
  approvalLikelihood: number;
  healthClassResult: string;
  /** Normalized health class requested for premium lookup */
  healthClassRequested?: RateableHealthClass;
  /** Actual health class used in premium lookup (if fallback occurred) */
  healthClassUsed?: RateableHealthClass;
  /** True if health class fallback was used (different from requested) */
  wasFallback?: boolean;
  /** Rate classes that actually exist in the product's quoteable premium matrix */
  availableRateClasses?: RateableHealthClass[];
  /** Term length in years used for premium lookup (null for permanent products) */
  termYears?: number | null;
  /** Available term lengths for this product (sorted ascending) */
  availableTerms?: number[];
  /** Alternative quotes at different face amounts (same term as primary quote) */
  alternativeQuotes?: {
    faceAmount: number;
    monthlyPremium: number;
    costPerThousand: number;
  }[];
  reason:
    | "cheapest"
    | "highest_coverage"
    | "best_approval"
    | "best_value"
    | null;
  concerns: string[];
  conditionDecisions: ConditionDecision[];
  score: number;
  /** Tri-state eligibility status for this product */
  eligibilityStatus: EligibilityStatus;
  /** Reasons for the eligibility determination */
  eligibilityReasons: string[];
  /** Fields that are missing and needed for full evaluation */
  missingFields: MissingFieldInfo[];
  /** Data completeness confidence (0-1) */
  confidence: number;
  /** Breakdown of how the score was calculated */
  scoreComponents: ScoreComponents;
  /** Draft rules shown for FYI only (not used in scoring) */
  draftRulesFyi: DraftRuleInfo[];
  /** Build chart rating class for this product (if applicable) */
  buildRating?: BuildRatingClass;
}

export interface DecisionEngineResult {
  recommendations: Recommendation[];
  /** All eligible products (may include entries without premiums) */
  eligibleProducts: Recommendation[];
  /** Products with unknown eligibility (kept in results but ranked lower) */
  unknownEligibility: Recommendation[];
  filtered: {
    totalProducts: number;
    passedEligibility: number;
    unknownEligibility: number;
    passedAcceptance: number;
    withPremiums: number;
    ineligible: number;
  };
  processingTime: number;
}

// =============================================================================
// Internal Evaluation Types
// =============================================================================

/** Internal type for evaluated products during recommendation processing */
export interface EvaluatedProduct {
  product: ProductCandidate;
  eligibility: EligibilityResult;
  approval: ApprovalResult;
  premium: number | null;
  /** Normalized health class requested for premium lookup */
  healthClassRequested?: RateableHealthClass;
  /** Actual health class used in premium lookup (if fallback occurred) */
  healthClassUsed?: RateableHealthClass;
  /** True if health class fallback was used */
  wasFallback?: boolean;
  /** Rate classes that actually exist in the product's quoteable premium matrix */
  availableRateClasses?: RateableHealthClass[];
  /** Term length in years used for premium lookup (null for permanent products) */
  termYears?: number | null;
  /** Available term lengths for this product */
  availableTerms?: number[];
  /** Alternative quotes at different face amounts */
  alternativeQuotes?: AlternativeQuote[];
  maxCoverage: number;
  scoreComponents: ScoreComponents;
  finalScore: number;
  /** Build chart rating class (if build chart exists for product) */
  buildRating?: BuildRatingClass;
}

/** Build chart data resolved for a product */
export interface BuildChartInfo {
  tableType: BuildTableType;
  buildData: BuildTableData | null;
  bmiData: BmiTableData | null;
}

/** Context needed for evaluating a single product */
export interface ProductEvaluationContext {
  client: ClientProfile;
  coverage: CoverageRequest;
  imoId: string;
  inputTermYears?: number | null;
  criteriaMap: Map<string, ExtractedCriteria>;
  /** Pre-fetched premium matrices by productId (batch optimization) */
  premiumMatrixMap: Map<string, PremiumMatrix[]>;
  /** Pre-fetched build charts by productId (for build rating constraint) */
  buildChartMap: Map<string, BuildChartInfo>;
}

/** Result from evaluating a single product */
export interface ProductEvaluationResult {
  evaluated: EvaluatedProduct | null;
  stats: {
    passedEligibility: boolean;
    unknownEligibility: boolean;
    passedAcceptance: boolean;
    withPremium: boolean;
    ineligible: boolean;
  };
}

// =============================================================================
// Eligibility Types (re-exported for convenience)
// =============================================================================

export interface EligibilityResult {
  status: EligibilityStatus;
  reasons: string[];
  missingFields: MissingFieldInfo[];
  confidence: number;
}

// =============================================================================
// Approval Types
// =============================================================================

export interface ApprovalResult {
  likelihood: number;
  healthClass: HealthClass;
  conditionDecisions: ConditionDecision[];
  concerns: string[];
  draftRules: DraftRuleInfo[];
}

// =============================================================================
// Extracted Criteria Types (from carrier_underwriting_criteria)
// =============================================================================

export interface ExtractedCriteria {
  ageLimits?: {
    minIssueAge?: number;
    maxIssueAge?: number;
  };
  faceAmountLimits?: {
    minimum?: number;
    maximum?: number;
    ageTiers?: Array<{
      minAge: number;
      maxAge: number;
      maxFaceAmount: number;
    }>;
  };
  knockoutConditions?: {
    conditionCodes?: string[];
  };
  stateAvailability?: {
    availableStates?: string[];
    unavailableStates?: string[];
  };
}
