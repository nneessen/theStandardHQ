// src/features/underwriting/types/underwriting.types.ts

import type { Database } from "@/types/database.types.ts";

// ============================================================================
// Database Row Types
// ============================================================================

export type HealthCondition =
  Database["public"]["Tables"]["underwriting_health_conditions"]["Row"];
export type HealthConditionInsert =
  Database["public"]["Tables"]["underwriting_health_conditions"]["Insert"];

export type UnderwritingGuide =
  Database["public"]["Tables"]["underwriting_guides"]["Row"];
export type UnderwritingGuideInsert =
  Database["public"]["Tables"]["underwriting_guides"]["Insert"];
export type UnderwritingGuideUpdate =
  Database["public"]["Tables"]["underwriting_guides"]["Update"];

export type DecisionTree =
  Database["public"]["Tables"]["underwriting_decision_trees"]["Row"];
export type DecisionTreeInsert =
  Database["public"]["Tables"]["underwriting_decision_trees"]["Insert"];
export type DecisionTreeUpdate =
  Database["public"]["Tables"]["underwriting_decision_trees"]["Update"];

export type UnderwritingSession =
  Database["public"]["Tables"]["underwriting_sessions"]["Row"];
export type UnderwritingSessionInsert =
  Database["public"]["Tables"]["underwriting_sessions"]["Insert"];

// ============================================================================
// Follow-up Question Types
// ============================================================================

export type QuestionType =
  | "select"
  | "multiselect"
  | "number"
  | "text"
  | "date";

export interface FollowUpQuestion {
  id: string;
  type: QuestionType;
  label: string;
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export interface FollowUpSchema {
  questions: FollowUpQuestion[];
}

// ============================================================================
// Wizard Form State Types
// ============================================================================

export interface ClientInfo {
  name: string;
  dob: string | null;
  age: number;
  gender: "male" | "female" | "other" | "";
  state: string;
  heightFeet: number;
  heightInches: number;
  weight: number;
}

export interface ConditionResponse {
  conditionCode: string;
  conditionName: string;
  responses: Record<string, string | number | string[]>;
}

export interface TobaccoInfo {
  currentUse: boolean;
  type?: "cigarettes" | "cigars" | "vape" | "chewing" | "other";
  lastUseDate?: string;
  frequency?: string;
}

export type PainMedicationType =
  | "none"
  | "otc_only"
  | "prescribed_non_opioid"
  | "opioid";

export interface MedicationInfo {
  // Cardiovascular
  bpMedCount: number;
  bloodThinners: boolean;
  heartMeds: boolean; // beta blockers, nitrates, etc.

  // Cholesterol
  cholesterolMedCount: number;

  // Diabetes
  insulinUse: boolean;
  oralDiabetesMeds: boolean;

  // Mental Health
  antidepressants: boolean;
  antianxiety: boolean;
  antipsychotics: boolean;
  moodStabilizers: boolean;

  // Sleep
  sleepAids: boolean;

  // Pain
  painMedications: PainMedicationType;

  // Neurological
  seizureMeds: boolean;
  migraineMeds: boolean;

  // Respiratory
  inhalers: boolean;
  copdMeds: boolean;

  // Thyroid & Hormonal
  thyroidMeds: boolean;
  hormonalTherapy: boolean;
  steroids: boolean;

  // Immune & Autoimmune
  immunosuppressants: boolean;
  biologics: boolean;
  dmards: boolean; // Disease-modifying antirheumatic drugs

  // Specialty/High-risk
  cancerTreatment: boolean;
  antivirals: boolean; // HIV, Hepatitis
  adhdMeds: boolean;
  osteoporosisMeds: boolean;
  kidneyMeds: boolean;
  liverMeds: boolean;

  // Other
  otherMedications?: string[];
}

export interface HealthInfo {
  conditions: ConditionResponse[];
  tobacco: TobaccoInfo;
  medications: MedicationInfo;
}

export interface CoverageRequest {
  faceAmounts: number[]; // Array of up to 3 face amounts for quote comparison
  productTypes: ProductType[];
}

export type ProductType =
  | "term_life"
  | "whole_life"
  | "universal_life"
  | "indexed_universal_life";

export interface WizardFormData {
  client: ClientInfo;
  health: HealthInfo;
  coverage: CoverageRequest;
}

// ============================================================================
// AI Analysis Types
// ============================================================================

export type HealthTier =
  | "preferred_plus"
  | "preferred"
  | "standard_plus"
  | "standard"
  | "substandard"
  | "table_rated"
  | "decline";

export interface CarrierRecommendation {
  carrierId: string;
  carrierName: string;
  productId: string;
  productName: string;
  expectedRating: string;
  confidence: number;
  keyFactors: string[];
  concerns: string[];
  priority: number;
  notes?: string;
  guideReferences?: string[]; // References to carrier guide content used in the recommendation
  // Decision tree boost info (populated when tree matches)
  treeMatchBoost?: number;
  treeMatchedRules?: string[];
}

export interface AIAnalysisResult {
  healthTier: HealthTier;
  riskFactors: string[];
  recommendations: CarrierRecommendation[];
  reasoning: string;
  processingTimeMs?: number;
  criteriaFilters?: CriteriaFilterResult; // Phase 5: Criteria evaluation results
  usage?: UWWizardUsageSummary | null;
  usageRecorded?: boolean;
}

export interface UWWizardUsageSummary {
  runs_used: number;
  runs_limit: number;
  runs_remaining: number;
  usage_percent: number;
  tier_id: string;
  tier_name: string;
  source?: "team_owner" | "team_seat" | "addon";
}

// ============================================================================
// Tri-State Eligibility Types (Phase 1)
// ============================================================================

/**
 * Product-specific eligibility status.
 * - eligible: Passes all known checks
 * - ineligible: Fails hard checks (knockout conditions, age limits, etc.)
 * - unknown: Missing data needed to determine eligibility
 */
export type EligibilityStatus = "eligible" | "ineligible" | "unknown";

/**
 * Detailed information about a missing field needed for eligibility evaluation
 */
export interface MissingFieldInfo {
  /** Field identifier, e.g., "condition.diabetes.a1c" */
  field: string;
  /** Human-readable reason why this field is needed */
  reason: string;
  /** Condition code if field is condition-specific */
  conditionCode?: string;
}

/**
 * Result of eligibility evaluation for a single product
 */
export interface EligibilityResult {
  /** Tri-state eligibility status */
  status: EligibilityStatus;
  /** Human-readable reasons for the eligibility determination */
  reasons: string[];
  /** Fields that are missing and needed for full evaluation */
  missingFields: MissingFieldInfo[];
  /** Data completeness score 0-1 (ratio of answered vs required fields) */
  confidence: number;
}

/**
 * Breakdown of how the final recommendation score was calculated
 */
export interface ScoreComponents {
  /** Approval likelihood component (0-1) */
  likelihood: number;
  /** Price score component (0-1, higher = cheaper relative to max) */
  priceScore: number;
  /** Data confidence (0-1, based on completeness) */
  dataConfidence: number;
  /** Multiplier applied based on eligibility status and confidence */
  confidenceMultiplier: number;
}

/**
 * Provenance information for a rule or decision
 */
export interface RuleProvenance {
  /** ID of the source underwriting guide */
  guideId?: string;
  /** Page numbers where the rule was found */
  pages?: number[];
  /** Relevant snippet from the guide */
  snippet?: string;
  /** AI extraction confidence (0-1) */
  confidence?: number;
  /** Review status of the rule */
  reviewStatus?: RuleReviewStatus;
}

/**
 * Review status for acceptance rules
 */
export type RuleReviewStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected";

/**
 * Decision for a specific health condition with provenance
 */
export interface ConditionDecision {
  /** Condition code */
  conditionCode: string;
  /** The acceptance decision */
  decision: AcceptanceDecision;
  /** Approval likelihood (0-1) */
  likelihood: number;
  /** Resulting health class if approved */
  healthClassResult: string | null;
  /** Whether this rule is from an approved source */
  isApproved: boolean;
  /** Source provenance for the decision */
  provenance?: RuleProvenance;
}

/**
 * Acceptance decision types
 */
export type AcceptanceDecision =
  | "approved"
  | "table_rated"
  | "case_by_case"
  | "declined";

/**
 * Draft rule shown for reference but not used in scoring
 */
export interface DraftRuleInfo {
  /** Condition code the rule applies to */
  conditionCode: string;
  /** The draft decision */
  decision: AcceptanceDecision;
  /** Current review status */
  reviewStatus: RuleReviewStatus;
  /** Source snippet if available */
  source?: string;
}

/**
 * Per-product recommendation stored in underwriting_session_recommendations
 */
export interface SessionRecommendation {
  id: string;
  sessionId: string;
  productId: string;
  carrierId: string;
  imoId: string;
  /** Tri-state eligibility */
  eligibilityStatus: EligibilityStatus;
  eligibilityReasons: string[];
  missingFields: MissingFieldInfo[];
  confidence: number;
  /** Approval details */
  approvalLikelihood: number | null;
  healthClassResult: string | null;
  conditionDecisions: ConditionDecision[];
  /** Pricing */
  monthlyPremium: number | null;
  annualPremium: number | null;
  costPerThousand: number | null;
  /** Ranking */
  score: number | null;
  scoreComponents: ScoreComponents | null;
  recommendationReason:
    | "best_value"
    | "cheapest"
    | "best_approval"
    | "highest_coverage"
    | null;
  recommendationRank: number | null;
  /** Draft rules for FYI display */
  draftRulesFyi: DraftRuleInfo[];
  createdAt: string;
}

export interface SessionRecommendationInput {
  productId: string;
  carrierId: string;
  eligibilityStatus: EligibilityStatus;
  eligibilityReasons: string[];
  missingFields: MissingFieldInfo[];
  confidence: number;
  approvalLikelihood: number | null;
  healthClassResult: string | null;
  conditionDecisions: ConditionDecision[];
  monthlyPremium: number | null;
  annualPremium: number | null;
  costPerThousand: number | null;
  score: number | null;
  scoreComponents: ScoreComponents | null;
  recommendationReason:
    | "best_value"
    | "cheapest"
    | "best_approval"
    | "highest_coverage"
    | null;
  recommendationRank: number | null;
  draftRulesFyi: DraftRuleInfo[];
}

export interface SessionEligibilitySummary {
  eligible: number;
  unknown: number;
  ineligible: number;
}

// ============================================================================
// Phase 5: Criteria Evaluation Types
// ============================================================================

/**
 * Result of evaluating extracted criteria against a client profile
 */
export interface CriteriaEvaluationResult {
  eligible: boolean;
  reasons: string[];
  buildRating?:
    | "preferred_plus"
    | "preferred"
    | "standard"
    | "table_rated"
    | "decline";
  tobaccoClass?: string;
}

/**
 * Product filtered by criteria rules
 */
export interface CriteriaFilteredProduct {
  carrierId: string;
  carrierName: string;
  productId?: string;
  productName?: string;
  rule: string;
  reason: string;
}

/**
 * Summary of criteria filtering applied during analysis
 */
export interface CriteriaFilterResult {
  /** Whether any criteria were applied */
  applied: boolean;
  /** Carrier IDs that had active criteria */
  matchedCarriers: string[];
  /** Products filtered out by criteria rules */
  filteredByCarrier: CriteriaFilteredProduct[];
  /** Per-carrier evaluation results */
  evaluationResults?: Record<string, CriteriaEvaluationResult>;
}

// ============================================================================
// Decision Tree Evaluation Types
// ============================================================================

export interface TreeRuleMatch {
  ruleName: string;
  matchScore: number;
  matchedConditions: string[];
}

export interface TreeEvaluationResult {
  matchedRules: TreeRuleMatch[];
  totalMatches: number;
  evaluationTimeMs: number;
}

export interface UnderwritingAnalysisResponse {
  success: boolean;
  analysis: AIAnalysisResult;
  filteredProducts: Array<{
    productName: string;
    carrierName: string;
    reason: string;
  }>;
  fullUnderwritingRequired: string[];
  criteriaFilters?: CriteriaFilterResult; // Phase 5: Criteria evaluation results
  treeEvaluation: TreeEvaluationResult | null;
  error?: string;
}

export interface AIAnalysisRequest {
  client: {
    age: number;
    gender: string;
    state: string;
    bmi: number;
  };
  health: {
    conditions: Array<{
      code: string;
      responses: Record<string, string | number | string[]>;
    }>;
    tobacco: TobaccoInfo;
    medications: MedicationInfo;
  };
  coverage: {
    faceAmount: number; // Primary face amount for AI analysis (edge function expects singular)
    productTypes: string[];
  };
  decisionTreeId?: string;
  imoId?: string; // For fetching relevant carrier guides
  runKey?: string;
}

// ============================================================================
// Decision Tree Types
// ============================================================================

export type ConditionField =
  | "age"
  | "gender"
  | "bmi"
  | "health_tier"
  | "tobacco"
  | "face_amount"
  | "state"
  | "condition_present"
  | "bp_med_count"
  | "cholesterol_med_count"
  | "insulin_use"
  | "oral_diabetes_meds"
  | "blood_thinners"
  | "antidepressants"
  | "antianxiety"
  | "sleep_aids"
  | "pain_medications"
  | "thyroid_meds"
  | "heart_meds"
  | "steroids";

export type ConditionOperator =
  | "=="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "in"
  | "not_in"
  | "contains";

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string | number | boolean | string[];
}

export interface RuleConditionGroup {
  all?: RuleCondition[];
  any?: RuleCondition[];
}

export interface RuleRecommendation {
  carrierId: string;
  productIds: string[];
  priority: number;
  notes?: string;
}

export interface DecisionTreeRule {
  id: string;
  name: string;
  conditions: RuleConditionGroup;
  recommendations: RuleRecommendation[];
  isActive?: boolean;
}

export interface DecisionTreeRules {
  rules: DecisionTreeRule[];
}

// ============================================================================
// Wizard Step Types
// ============================================================================

export type WizardStep =
  | "client"
  | "health"
  | "medications"
  | "coverage"
  | "review"
  | "results";

export interface WizardStepConfig {
  id: WizardStep;
  label: string;
  description?: string;
}

export const WIZARD_STEPS: WizardStepConfig[] = [
  { id: "client", label: "Client Info", description: "Basic demographics" },
  { id: "health", label: "Conditions", description: "Health conditions" },
  { id: "medications", label: "Medications", description: "Current meds" },
  { id: "coverage", label: "Coverage", description: "Policy details" },
  { id: "review", label: "Review", description: "Confirm details" },
  { id: "results", label: "Results", description: "Recommendations" },
];

// ============================================================================
// Session Types
// ============================================================================

/** Simplified rate table recommendation stored in session */
export interface RateTableRecommendation {
  carrierName: string;
  productName: string;
  termYears: number | null;
  healthClass: string;
  quotedHealthClass?: string;
  underwritingHealthClass?: string | null;
  quoteClassNote?: string;
  monthlyPremium: number | null;
  faceAmount: number;
  reason: string;
}

export interface SessionHealthSnapshot {
  version: 2;
  conditionsByCode: Record<string, ConditionResponse>;
  medications?: MedicationInfo;
}

export interface SessionSaveInput {
  clientName?: string;
  clientDob?: string | null;
  clientAge: number;
  clientGender: string;
  clientState: string;
  clientHeightInches: number;
  clientWeightLbs: number;
  healthResponses: Record<string, ConditionResponse> | SessionHealthSnapshot;
  conditionsReported: string[];
  tobaccoUse: boolean;
  tobaccoDetails?: TobaccoInfo;
  requestedFaceAmounts: number[]; // Array of face amounts
  requestedProductTypes: string[];
  decisionTreeId?: string;
  sessionDurationSeconds?: number;
  notes?: string;
  selectedTermYears?: number | null;
  runKey?: string | null;
}

// ============================================================================
// Category Types
// ============================================================================

export type ConditionCategory =
  | "cardiovascular"
  | "metabolic"
  | "cancer"
  | "respiratory"
  | "mental_health"
  | "gastrointestinal"
  | "neurological"
  | "autoimmune"
  | "renal"
  | "substance"
  | "endocrine"
  | "infectious";

export const CONDITION_CATEGORY_LABELS: Record<ConditionCategory, string> = {
  cardiovascular: "Cardiovascular",
  metabolic: "Metabolic",
  cancer: "Cancer",
  respiratory: "Respiratory",
  mental_health: "Mental Health",
  gastrointestinal: "Gastrointestinal",
  neurological: "Neurological",
  autoimmune: "Autoimmune",
  renal: "Kidney",
  substance: "Substance Use",
  endocrine: "Endocrine",
  infectious: "Infectious Disease",
};

// ============================================================================
// Carrier Underwriting Criteria Types (AI Extraction)
// SYNC: ExtractedCriteria must match supabase/functions/underwriting-ai-analyze/criteria-evaluator.ts
// When updating ExtractedCriteria, update both locations.
// ============================================================================

export type CarrierUnderwritingCriteria =
  Database["public"]["Tables"]["carrier_underwriting_criteria"]["Row"];
export type CarrierUnderwritingCriteriaInsert =
  Database["public"]["Tables"]["carrier_underwriting_criteria"]["Insert"];
export type CarrierUnderwritingCriteriaUpdate =
  Database["public"]["Tables"]["carrier_underwriting_criteria"]["Update"];

export type ExtractionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";
export type ReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "needs_revision";

export interface ExtractedCriteria {
  ageLimits?: {
    minIssueAge: number;
    maxIssueAge: number;
  };
  faceAmountLimits?: {
    minimum: number;
    maximum: number;
    ageTiers?: Array<{
      minAge: number;
      maxAge: number;
      maxFaceAmount: number;
    }>;
  };
  knockoutConditions?: {
    conditionCodes: string[];
    descriptions: Array<{
      code: string;
      name: string;
      severity: string;
    }>;
  };
  buildRequirements?: {
    type: "height_weight" | "bmi";
    preferredPlusBmiMax?: number;
    preferredBmiMax?: number;
    standardBmiMax?: number;
  };
  tobaccoRules?: {
    smokingClassifications: Array<{
      classification: string;
      requiresCleanMonths: number;
    }>;
    nicotineTestRequired: boolean;
  };
  medicationRestrictions?: {
    // Cardiovascular
    insulin?: { allowed: boolean; ratingImpact?: string };
    bloodThinners?: { allowed: boolean };
    bpMedications?: { maxCount: number };
    heartMeds?: { allowed: boolean };

    // Cholesterol
    cholesterolMedications?: { maxCount: number };

    // Diabetes
    oralDiabetesMeds?: { allowed: boolean };

    // Mental Health
    antidepressants?: { allowed: boolean };
    antianxiety?: { allowed: boolean };
    antipsychotics?: { allowed: boolean };
    moodStabilizers?: { allowed: boolean };

    // Sleep
    sleepAids?: { allowed: boolean };

    // Pain
    opioids?: { allowed: boolean; timeSinceUse?: number };

    // Neurological
    seizureMeds?: { allowed: boolean };
    migraineMeds?: { allowed: boolean };

    // Respiratory
    inhalers?: { allowed: boolean };
    copdMeds?: { allowed: boolean };

    // Thyroid & Hormonal
    thyroidMeds?: { allowed: boolean };
    hormonalTherapy?: { allowed: boolean };
    steroids?: { allowed: boolean };

    // Immune & Autoimmune
    immunosuppressants?: { allowed: boolean };
    biologics?: { allowed: boolean };
    dmards?: { allowed: boolean };

    // Specialty/High-risk
    cancerTreatment?: { allowed: boolean };
    antivirals?: { allowed: boolean };
    adhdMeds?: { allowed: boolean };
    osteoporosisMeds?: { allowed: boolean };
    kidneyMeds?: { allowed: boolean };
    liverMeds?: { allowed: boolean };
  };
  stateAvailability?: {
    availableStates: string[];
    unavailableStates: string[];
  };
}

export interface SourceExcerpt {
  field: string;
  excerpt: string;
  pageNumber?: number;
}

export interface CriteriaWithRelations extends CarrierUnderwritingCriteria {
  carrier?: { id: string; name: string };
  guide?: { id: string; name: string };
  product?: { id: string; name: string };
  reviewer?: { id: string; full_name: string | null };
}

export interface ExtractionResponse {
  success: boolean;
  criteriaId?: string;
  guideId?: string;
  confidence?: number;
  chunksProcessed?: number;
  totalChunks?: number;
  elapsed?: number;
  error?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export function calculateBMI(
  heightFeet: number,
  heightInches: number,
  weightLbs: number,
): number {
  const totalInches = heightFeet * 12 + heightInches;
  if (totalInches <= 0 || weightLbs <= 0) return 0;
  // BMI formula: (weight in lbs * 703) / (height in inches)^2
  return (
    Math.round(((weightLbs * 703) / (totalInches * totalInches)) * 10) / 10
  );
}

export function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  if (bmi < 35) return "Obese Class I";
  if (bmi < 40) return "Obese Class II";
  return "Obese Class III";
}

export function getHealthTierLabel(tier: HealthTier): string {
  const labels: Record<HealthTier, string> = {
    preferred_plus: "Preferred Plus",
    preferred: "Preferred",
    standard_plus: "Standard Plus",
    standard: "Standard",
    substandard: "Substandard",
    table_rated: "Table Rated",
    decline: "Decline",
  };
  return labels[tier] || tier;
}

// ============================================================================
// Carrier Types (for Decision Tree Editor)
// ============================================================================

export interface CarrierWithProducts {
  id: string;
  name: string;
  products: Array<{
    id: string;
    name: string;
    product_type: string;
  }>;
}
