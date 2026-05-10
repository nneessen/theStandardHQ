export {
  useCarrierRuleCoverage,
  carrierRuleCoverageKeys,
  type CarrierRuleCoverageRow,
} from "../hooks/coverage/useCarrierRuleCoverage";

export {
  useUnderwritingGuides,
  useUnderwritingGuide,
  useUploadGuide,
  useUpdateGuide,
  useDeleteGuide,
  useGuideSignedUrl,
  guideQueryKeys,
} from "../hooks/guides/useUnderwritingGuides";

export {
  useParseGuide,
  isGuideParsed,
  isParsingInProgress,
  hasParsingFailed,
} from "../hooks/guides/useParseGuide";

export {
  useRuleSetsByGuide,
  useExtractRules,
  guideRulesKeys,
  type ExtractRulesProgress,
  type ExtractRulesResult,
} from "../hooks/rules/useRuleSetsByGuide";

export {
  useApproveRuleSet,
  useRejectRuleSet,
  useRevertToDraft,
  useSubmitForReview,
} from "../hooks/rules/useRuleWorkflow";

export {
  useUpdateRuleSet,
  useDeleteRuleSet,
  useCreateRuleSet,
  ruleEngineKeys,
  type RuleSetWithRules,
  type RuleReviewStatus,
  type CreateRuleSetInput,
  type HealthClass,
  type TableRating,
  type PredicateGroup,
  type RuleSetScope,
} from "../hooks/rules/useRuleSets";

export {
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  type CreateRuleInput,
} from "../hooks/rules/useRules";

export { useHealthConditions } from "../hooks/shared/useHealthConditions";

// Re-export the predicate validator. Lives in services/underwriting/core but
// admin/ is in features/ so it can't deep-import directly — go through the
// hooks barrel which is allowed to span the boundary.
export { validatePredicate } from "../hooks";
