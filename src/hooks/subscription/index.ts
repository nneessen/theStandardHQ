// src/hooks/subscription/index.ts

export { useSubscription, subscriptionKeys } from "./useSubscription";
export { useSubscriptionPlans } from "./useSubscriptionPlans";
export { useFeatureSpotlight, spotlightKeys } from "./useFeatureSpotlight";
export type {
  FeatureSpotlight,
  SpotlightHighlight,
} from "@/services/subscription";
export { useUsageTracking } from "./useUsageTracking";
export {
  useFeatureAccess,
  useAnyFeatureAccess,
  useAllFeaturesAccess,
  getRequiredPlanForFeature,
  FEATURE_DISPLAY_NAMES,
  type FeatureKey,
} from "./useFeatureAccess";
export { useTeamSizeLimit, type TeamSizeLimitStatus } from "./useTeamSizeLimit";
export {
  useAnalyticsSectionAccess,
  useAccessibleAnalyticsSections,
  ANALYTICS_SECTION_NAMES,
  ANALYTICS_SECTION_TIERS,
  type AnalyticsSectionKey,
} from "./useAnalyticsSectionAccess";
export {
  useOwnerDownlineAccess,
  isOwnerDownlineGrantedFeature,
  OWNER_EMAILS,
  OWNER_DOWNLINE_GRANTED_FEATURES,
  THE_STANDARD_AGENCY_ID,
  type OwnerDownlineGrantedFeature,
} from "./useOwnerDownlineAccess";
export {
  useSubscriptionSettings,
  useTemporaryAccessConfig,
  useUpdateTemporaryAccessSettings,
  useTemporaryAccessCheck,
  subscriptionSettingsKeys,
  type TemporaryAccessConfig,
  type SubscriptionSettings,
} from "./useSubscriptionSettings";

export { useUserActiveAddons, userAddonKeys } from "./useUserActiveAddons";

export {
  useTeamUWWizardSeats,
  useTeamSeatLimit,
  useEligibleDownlines,
  useGrantTeamUWSeat,
  useRevokeTeamUWSeat,
  teamSeatKeys,
} from "./useTeamUWWizardSeats";

// Re-export billing utilities for UI components
export {
  subscriptionService,
  type SubscriptionPlan,
} from "@/services/subscription";
