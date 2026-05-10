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
  useDecisionEngineRecommendations,
  buildAuthoritativeUnderwritingRunInput,
  buildAuthoritativeSessionSaveInput,
} from "./wizard/useDecisionEngineRecommendations";

// Build chart hooks live in features/settings/carriers/hooks/ — re-exported here
// for convenience because the wizard's product-evaluation flow consumes them.
export { buildChartKeys } from "@/features/settings/carriers/hooks/useCarrierBuildCharts";
export { useCarrierBuildCharts } from "@/features/settings/carriers/hooks/useCarrierBuildCharts";
export { useBuildChartOptions } from "@/features/settings/carriers/hooks/useBuildChartOptions";
export { useCreateBuildChart } from "@/features/settings/carriers/hooks/useCreateBuildChart";
export { useUpdateBuildChart } from "@/features/settings/carriers/hooks/useUpdateBuildChart";
export { useDeleteBuildChart } from "@/features/settings/carriers/hooks/useDeleteBuildChart";
export { useSetDefaultBuildChart } from "@/features/settings/carriers/hooks/useSetDefaultBuildChart";
export { useDefaultBuildCharts } from "@/features/settings/carriers/hooks/useDefaultBuildCharts";

export {
  useUWWizardUsage,
  useRecordUWWizardRun,
  getUsageStatus,
  getDaysRemaining,
  uwWizardUsageKeys,
  type UWWizardUsage,
} from "./wizard/useUWWizardUsage";

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

// validatePredicate lives in services/underwriting/core/ruleEngineDSL alongside
// parsePredicate. Re-exporting here so admin/ (which can't deep-import from
// services) has a single barrel entry-point for both.
export { validatePredicate } from "@/services/underwriting/core/ruleEngineDSL";
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
