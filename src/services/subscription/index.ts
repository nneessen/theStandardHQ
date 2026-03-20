// src/services/subscription/index.ts

export {
  subscriptionService,
  PRICING,
  type SubscriptionPlan,
  type SubscriptionFeatures,
  type UserSubscription,
  type UserActiveAddon,
  type UsageTracking,
  type UsageStatus,
  type SubscriptionPayment,
  type SubscriptionEvent,
  type TeamUWWizardSeat,
  type EligibleDownlineAgent,
} from "./subscriptionService";
export {
  PREMIUM_VOICE_ADDON_NAME,
  PREMIUM_VOICE_DEFAULT_PLAN_CODE,
  DEFAULT_VOICE_FEATURES,
  isPremiumVoiceAddon,
  getTierUsageAmount,
  getTierUsageUnit,
  getVoiceTierConfig,
  getUtcCalendarMonthCycle,
  mapStripeStatusToVoiceStatus,
  buildVoiceEntitlementPayload,
  buildVoiceCancellationPayload,
  syncVoiceEntitlementWithRetry,
  type VoiceAddonTier,
  type VoiceAddonTierConfig,
  type VoiceEntitlementPayload,
  type VoiceCancellationPayload,
  type VoiceEntitlementSnapshot,
  type VoiceEntitlementStatus,
  type VoiceFeatureFlags,
} from "./voice-sync";

export { SubscriptionRepository } from "./SubscriptionRepository";
export type { SubscriptionBaseEntity } from "./SubscriptionRepository";

// Admin subscription service exports
// SubscriptionPlan is now defined in SubscriptionRepository (single source of truth)
export { type SubscriptionPlan as AdminSubscriptionPlan } from "./SubscriptionRepository";
export {
  adminSubscriptionService,
  type SubscriptionAddon,
  type AddonUserSummary,
  type UserSubscriptionAddon,
  type SubscriptionPlanChange,
  type UpdatePlanFeaturesParams,
  type UpdatePlanAnalyticsParams,
  type UpdatePlanPricingParams,
  type UpdatePlanLimitsParams,
  type UpdatePlanMetadataParams,
  type CreateAddonParams,
  type UpdateAddonParams,
  type AddonTier,
  type AddonTierConfig,
} from "./adminSubscriptionService";

// Subscription settings service exports
export {
  subscriptionSettingsService,
  type TemporaryAccessConfig,
  type SubscriptionSettings,
} from "./subscriptionSettingsService";

// Spotlight service exports
export {
  spotlightService,
  type FeatureSpotlight,
  type SpotlightHighlight,
  type CreateSpotlightParams,
  type UpdateSpotlightParams,
  type UserSpotlightView,
} from "./spotlightService";
