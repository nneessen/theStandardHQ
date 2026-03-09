// src/features/underwriting/hooks/index.ts

export {
  useHealthConditions,
  underwritingQueryKeys,
  parseFollowUpSchema,
  groupConditionsByCategory,
} from "./useHealthConditions";

export {
  useUnderwritingFeatureFlag,
  useCanManageUnderwriting,
} from "./useUnderwritingFeatureFlag";

export {
  useUnderwritingAnalysis,
  UWAnalysisError,
} from "./useUnderwritingAnalysis";

export {
  useUnderwritingSessions,
  useUnderwritingSession,
  useSaveUnderwritingSession,
  useAgencySessions,
  useAgencySessionsPaginated,
  useUserSessionsPaginated,
} from "./useUnderwritingSessions";
export type { PaginatedSessionsResult } from "./useUnderwritingSessions";

export {
  useCarriersWithProducts,
  carriersWithProductsQueryKeys,
} from "./useCarriersWithProducts";

export {
  useUnderwritingGuides,
  useUnderwritingGuide,
  useUploadGuide,
  useUpdateGuide,
  useDeleteGuide,
  useGuideSignedUrl,
  guideQueryKeys,
} from "./useUnderwritingGuides";

export {
  useParseGuide,
  isGuideParsed,
  isParsingInProgress,
  hasParsingFailed,
} from "./useParseGuide";

export {
  useDecisionEngineRecommendations,
  buildAuthoritativeUnderwritingRunInput,
} from "./useDecisionEngineRecommendations";

export {
  useProductConstraints,
  productConstraintsQueryKeys,
} from "./useProductConstraints";

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
} from "./useQuickQuote";

export {
  useUWWizardUsage,
  useRecordUWWizardRun,
  getUsageStatus,
  getDaysRemaining,
  uwWizardUsageKeys,
  type UWWizardUsage,
} from "./useUWWizardUsage";

export {
  useCoverageStats,
  coverageStatsKeys,
  getCoverageKey,
  getProductCoverage,
  getCarrierAggregateCoverage,
} from "./useCoverageStats";

export { useCoverageAudit, coverageAuditKeys } from "./useCoverageAudit";
