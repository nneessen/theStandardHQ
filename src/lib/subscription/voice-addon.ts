export const PREMIUM_VOICE_ADDON_NAME = "premium_voice";
export const PREMIUM_VOICE_DEFAULT_PLAN_CODE = "voice_pro_v1";
export const PREMIUM_VOICE_SELF_SERVE_ENABLED = true;
export const PREMIUM_VOICE_LAUNCH_PRICE_MONTHLY_CENTS = 14900;
export const PREMIUM_VOICE_LAUNCH_PRICE_ANNUAL_CENTS = 149000;
export const PREMIUM_VOICE_COMING_SOON_MESSAGE =
  "Premium Voice launches at $149/month for 500 included minutes and is not yet available for self-serve purchase.";

interface VoiceAddonUsageTier {
  runs_per_month: number;
  included_minutes?: number | null;
}

export function isPremiumVoiceAddon(addonName: string | null | undefined) {
  return addonName === PREMIUM_VOICE_ADDON_NAME;
}

export function isPremiumVoiceSelfServeEnabled() {
  return PREMIUM_VOICE_SELF_SERVE_ENABLED;
}

export function getTierUsageAmount(tier: VoiceAddonUsageTier) {
  return tier.included_minutes ?? tier.runs_per_month;
}

export function getTierUsageUnit(addonName: string | null | undefined) {
  return isPremiumVoiceAddon(addonName) ? "minutes" : "runs";
}
