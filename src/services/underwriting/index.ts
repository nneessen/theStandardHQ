// src/services/underwriting/index.ts
// Barrel file for underwriting services

export { guideStorageService } from "./repositories";
export {
  transformConditionResponses,
  type TransformedConditionResponses,
} from "./core";
export {
  getRecommendations,
  formatRecommendationReason,
  getReasonBadgeColor,
  formatCurrency as formatDECurrency,
  formatPercentage,
  type DecisionEngineInput,
  type DecisionEngineResult,
  type Recommendation,
  type GenderType,
} from "./workflows";
export {
  deleteRuleSet,
  type RuleSetWithRules,
  type HealthClass,
  type TableRating,
  type RuleReviewStatus,
} from "./repositories";
export {
  parsePredicate,
  validatePredicate,
  isFieldCondition,
  type PredicateGroup,
  type FieldCondition,
  type RuleSetScope,
} from "./core";
