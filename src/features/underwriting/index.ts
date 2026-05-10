// src/features/underwriting/index.ts

// Page components (full-page routes, no props)
export { default as UnderwritingWizardPage } from "./components/Wizard";
export { UnderwritingAdminPage } from "./admin";
export { WizardSessionHistory } from "./components/SessionHistory";

// Hooks
export {
  useHealthConditions,
  useUnderwritingFeatureFlag,
  useCanManageUnderwriting,
  useUnderwritingAnalysis,
  useUnderwritingSession,
  useSaveUnderwritingSession,
  useUnderwritingGuides,
  useUnderwritingGuide,
  useUploadGuide,
  useUpdateGuide,
  useDeleteGuide,
  useGuideSignedUrl,
  underwritingQueryKeys,
  guideQueryKeys,
  parseFollowUpSchema,
  groupConditionsByCategory,
} from "./hooks";

// Types
export type {
  HealthCondition,
  UnderwritingGuide,
  UnderwritingSession,
  WizardFormData,
  ClientInfo,
  HealthInfo,
  MedicationInfo,
  CoverageRequest,
  AIAnalysisResult,
  AIAnalysisRequest,
  CarrierRecommendation,
  RateTableRecommendation,
  HealthTier,
  ConditionResponse,
  FollowUpQuestion,
  FollowUpSchema,
} from "./types/underwriting.types";

export {
  WIZARD_STEPS,
  CONDITION_CATEGORY_LABELS,
  calculateBMI,
  getBMICategory,
  getHealthTierLabel,
} from "./types/underwriting.types";

// Re-export US_STATES from centralized constants
export { US_STATES } from "@/constants/states";

// Utils
export {
  calculateBMI as calcBMI,
  getBMICategory as getBMICat,
  getBMIRiskLevel,
  calculateAge,
  formatHeight,
} from "./utils/shared/bmiCalculator";

export {
  getHealthTierBadgeColor,
  formatSessionDate,
  formatSessionDateLong,
  formatCurrency,
  capitalizeFirst,
  formatProductType,
  isValidHealthTier,
  safeParseJsonArray,
  safeParseJsonObject,
} from "./utils/shared/formatters";

// Build Table Types & Utilities
export type {
  BuildTableData,
  BuildTableRow,
  BuildTableWeightRanges,
  BmiTableData,
  BmiRange,
  WeightRange,
  BuildTableType,
  BuildChartDisplay,
  BuildChartOption,
  RatingClassKey,
  BuildRatingClass,
} from "./types/build-table.types";

export {
  ALL_RATING_CLASSES,
  BUILD_TABLE_TYPE_LABELS,
  BUILD_RATING_CLASS_LABELS,
  generateHeightOptions,
  createEmptyBuildTable,
  createEmptyBmiTable,
  getActiveRatingClasses,
  getActiveBmiClasses,
} from "./types/build-table.types";

export {
  parseBuildTableCsv,
  exportBuildTableToCsv,
  generateCsvTemplate,
  downloadCsv,
} from "./utils/rates/buildTableCsvParser";

export { lookupBuildRatingUnified } from "./utils/rates/buildTableLookup";

// Additional underwriting types used by services
export type {
  ExtractedCriteria,
  EligibilityStatus,
  EligibilityResult,
  MissingFieldInfo,
  ScoreComponents,
  DraftRuleInfo,
  RuleProvenance,
  AcceptanceDecision as UWAcceptanceDecision,
} from "./types/underwriting.types";

// UW Wizard Usage Hook
export {
  useUWWizardUsage,
  useRecordUWWizardRun,
  getUsageStatus,
  getDaysRemaining,
  uwWizardUsageKeys,
} from "./hooks/wizard/useUWWizardUsage";
export type { UWWizardUsage } from "./hooks/wizard/useUWWizardUsage";

// Product Constraints Types
export type {
  AgeTier,
  AgeTieredFaceAmounts,
  KnockoutConditions,
  FullUnderwritingAgeBand,
  FullUnderwritingThreshold,
  ProductUnderwritingConstraints,
  ProductWithConstraints,
  ProductEligibilityResult,
  EligibilityClientProfile,
  EligibilityFilterResult,
} from "./types/product-constraints.types";
