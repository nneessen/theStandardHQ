// src/features/underwriting/hooks/index.ts

export {
  useHealthConditions,
  parseFollowUpSchema,
  groupConditionsByCategory,
} from "./shared/useHealthConditions";
export { underwritingQueryKeys } from "./shared/query-keys";

export {
  useUnderwritingFeatureFlag,
  useCanManageUnderwriting,
} from "./wizard/useUnderwritingFeatureFlag";

export {
  useUnderwritingAnalysis,
  UWAnalysisError,
} from "./wizard/useUnderwritingAnalysis";

export {
  useUnderwritingSession,
  useSaveUnderwritingSession,
  useAgencySessionsPaginated,
  useUserSessionsPaginated,
} from "./sessions/useUnderwritingSessions";
export type { PaginatedSessionsResult } from "./sessions/useUnderwritingSessions";

export {
  useCarriersWithProducts,
  carriersWithProductsQueryKeys,
} from "./coverage/useCarriersWithProducts";

export {
  useCoverageStats,
  coverageStatsKeys,
  getCoverageKey,
  getProductCoverage,
  getCarrierAggregateCoverage,
} from "./coverage/useCoverageStats";

export {
  useCoverageAudit,
  coverageAuditKeys,
} from "./coverage/useCoverageAudit";

export {
  useProductConstraints,
  productConstraintsQueryKeys,
} from "./coverage/useProductConstraints";

export {
  useUnderwritingGuides,
  useUnderwritingGuide,
  useUploadGuide,
  useUpdateGuide,
  useDeleteGuide,
  useGuideSignedUrl,
  guideQueryKeys,
} from "./guides/useUnderwritingGuides";

export {
  useParseGuide,
  isGuideParsed,
  isParsingInProgress,
  hasParsingFailed,
} from "./guides/useParseGuide";

export {
  useCriteriaList,
  useCriteriaByGuide,
  criteriaQueryKeys,
} from "./criteria/useCriteria";

export {
  useExtractCriteria,
  useUpdateCriteriaReview,
  useDeleteCriteria,
  useUpdateCriteriaContent,
} from "./criteria/useExtractCriteria";

export {
  useDecisionEngineRecommendations,
  buildAuthoritativeUnderwritingRunInput,
  buildAuthoritativeSessionSaveInput,
} from "./wizard/useDecisionEngineRecommendations";

// Build chart hooks are now in features/settings/carriers/hooks/
// Export key names for re-export convenience
export { buildChartKeys } from "@/features/settings/carriers/hooks/useCarrierBuildCharts";
export { useCarrierBuildCharts } from "@/features/settings/carriers/hooks/useCarrierBuildCharts";
export { useBuildChartOptions } from "@/features/settings/carriers/hooks/useBuildChartOptions";
export { useCreateBuildChart } from "@/features/settings/carriers/hooks/useCreateBuildChart";
export { useUpdateBuildChart } from "@/features/settings/carriers/hooks/useUpdateBuildChart";
export { useDeleteBuildChart } from "@/features/settings/carriers/hooks/useDeleteBuildChart";
export { useSetDefaultBuildChart } from "@/features/settings/carriers/hooks/useSetDefaultBuildChart";
export { useDefaultBuildCharts } from "@/features/settings/carriers/hooks/useDefaultBuildCharts";

export {
  useQuotesForCoverage,
  useQuotesForBudget,
  useQuotes,
  useQuoteMutation,
  useTopQuotes,
  useAllPremiumMatrices,
  quoteKeys,
  type QuoteInput,
  type QuoteResult,
  type QuoteMode,
  type EligibilityStatus,
  presetKeys,
  useQuickQuotePresets,
  useUpdatePresets,
} from "./quotes/useQuickQuote";

export {
  useUWWizardUsage,
  useRecordUWWizardRun,
  getUsageStatus,
  getDaysRemaining,
  uwWizardUsageKeys,
  type UWWizardUsage,
} from "./wizard/useUWWizardUsage";

export {
  acceptanceKeys,
  useCarrierAcceptance,
  useConditionAcceptance,
  useAllAcceptanceRules,
  useAcceptanceLookup,
  useCarriersWithAcceptanceRules,
  useUpsertAcceptanceRule,
  useBulkUpsertAcceptanceRules,
  useDeleteAcceptanceRule,
  useDeleteCarrierAcceptance,
} from "./rules/useAcceptance";

export {
  ruleEngineKeys,
  useRuleSets,
  useRuleSet,
  useRulesNeedingReview,
  useCreateRuleSet,
  useUpdateRuleSet,
  useDeleteRuleSet,
  parsePredicate,
  deleteRuleSet,
} from "./rules/useRuleSets";
export type {
  RuleSetWithRules,
  CreateRuleSetInput,
  RuleReviewStatus,
  HealthClass,
  TableRating,
  PredicateGroup,
  RuleSetScope,
} from "./rules/useRuleSets";

export {
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useReorderRules,
} from "./rules/useRules";
export type { CreateRuleInput } from "./rules/useRules";

export {
  useSubmitForReview,
  useApproveRuleSet,
  useRejectRuleSet,
  useRevertToDraft,
} from "./rules/useRuleWorkflow";

export {
  generateRulesKeys,
  useKnockoutCodes,
  useGenerateKnockoutRules,
  useGenerateAgeRules,
  useGenerateGuaranteedIssueRules,
} from "./rules/useGenerateRules";
export type {
  GenerationStrategy,
  KnockoutCondition,
  GenerationResult,
} from "./rules/useGenerateRules";

export {
  rateKeys,
  useProductRates,
  useCarrierRates,
  useRateLookup,
  useProductsWithRates,
  useUpsertRate,
  useBulkUpsertRates,
  useDeleteRate,
  useDeleteProductRates,
} from "./rates/useRates";

export {
  premiumMatrixKeys,
  usePremiumMatrix,
  usePremiumMatrixForClassification,
  useProductsWithPremiumMatrix,
  useTermYearsForProduct,
  useBulkUpsertPremiumMatrix,
  useDeletePremiumMatrixEntry,
  useDeleteProductPremiumMatrix,
  useDeleteTermPremiumMatrix,
  useEstimatePremium,
} from "./rates/usePremiumMatrix";
