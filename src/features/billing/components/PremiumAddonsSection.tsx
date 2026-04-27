// src/features/billing/components/PremiumAddonsSection.tsx
// Section for purchasing premium add-ons like UW Wizard with tier selection

import { useState } from "react";
import { Sparkles, Check, Loader2, Wand2, Zap, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useAdminSubscriptionAddons,
  type SubscriptionAddon,
  type AddonTierConfig,
  type AddonTier,
} from "@/hooks/admin";
import {
  useUnderwritingFeatureFlag,
  useUWWizardUsage,
} from "@/features/underwriting";
import {
  useSubscription,
  subscriptionService,
  subscriptionKeys,
  useUserActiveAddons,
} from "@/hooks/subscription";
import { userAddonKeys } from "@/hooks/subscription";
import {
  PREMIUM_VOICE_ADDON_NAME,
  PREMIUM_VOICE_SELF_SERVE_ENABLED,
  getTierUsageAmount,
  getTierUsageUnit,
} from "@/lib/subscription/voice-addon";
import { TeamUWWizardManager } from "./TeamUWWizardManager";

interface TierWithAddon extends AddonTier {
  addonId: string;
}

function getAddonIcon(addonName: string) {
  return addonName === PREMIUM_VOICE_ADDON_NAME ? PhoneCall : Wand2;
}

function getTierAllowanceLabel(addonName: string, tier: AddonTier) {
  const usageUnit = getTierUsageUnit(addonName);
  const usageAmount = getTierUsageAmount(tier);
  return `${usageAmount.toLocaleString()} ${usageUnit}/mo`;
}

function getAddonHighlights(addon: SubscriptionAddon, tier?: AddonTier) {
  if (addon.name === PREMIUM_VOICE_ADDON_NAME) {
    const features = tier?.features || {};
    const labels = [
      features.missedAppointment ? "Missed appointments" : null,
      features.reschedule ? "Reschedules" : null,
      features.afterHoursInbound ? "After-hours inbound" : null,
      features.quotedFollowup ? "Quoted follow-up" : null,
    ].filter(Boolean) as string[];

    return labels.length > 0 ? labels : ["Month-aligned voice entitlement"];
  }

  if (addon.name === "uw_wizard") {
    return ["AI Analysis", "Carrier Matching", "Health Class Prediction"];
  }

  return [];
}

function isAddonComingSoon(addon: SubscriptionAddon, hasAccess: boolean) {
  return (
    addon.name === PREMIUM_VOICE_ADDON_NAME &&
    !PREMIUM_VOICE_SELF_SERVE_ENABLED &&
    !hasAccess
  );
}

export function PremiumAddonsSection() {
  const { user } = useAuth();
  const [selectedTierIds, setSelectedTierIds] = useState<
    Record<string, string>
  >({});
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const queryClient = useQueryClient();

  // Get available add-ons (only show active ones)
  const { data: allAddons, isLoading: addonsLoading } =
    useAdminSubscriptionAddons();
  const addons = allAddons?.filter((a) => a.is_active);

  // Check UW Wizard access and usage
  const { isEnabled: hasUwWizard, accessSource } = useUnderwritingFeatureFlag();
  const { data: uwUsage } = useUWWizardUsage();
  const { activeAddons } = useUserActiveAddons();

  // Check if user is on Team plan
  const { subscription } = useSubscription();
  const isTeamPlan =
    subscription?.plan?.name === "team" &&
    ["active", "trialing"].includes(subscription?.status || "");
  const hasActiveSubscription =
    subscription && ["active", "trialing"].includes(subscription?.status || "");

  const formatPrice = (cents: number) => {
    if (cents === 0) return "Free";
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getTierConfig = (addon: SubscriptionAddon): AddonTierConfig | null => {
    const raw = (addon as { tier_config?: AddonTierConfig | null }).tier_config;
    if (!raw || !raw.tiers || raw.tiers.length === 0) return null;
    return raw;
  };

  const invalidateCaches = () => {
    queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    if (user?.id) {
      queryClient.invalidateQueries({
        queryKey: userAddonKeys.activeAddons(user.id),
      });
    }
  };

  const setSelectedTierForAddon = (addonId: string, tierId: string) => {
    setSelectedTierIds((current) => ({
      ...current,
      [addonId]: tierId,
    }));
  };

  const handlePurchaseTier = async (tier: TierWithAddon) => {
    if (!user?.id || purchaseLoading) return;

    if (!hasActiveSubscription) {
      toast.error("Please subscribe to a plan before adding add-ons.");
      return;
    }

    setPurchaseLoading(true);
    try {
      const result = await subscriptionService.addSubscriptionAddon(
        tier.addonId,
        tier.id,
      );

      if (result.success) {
        // If checkout is required (no existing Stripe subscription), redirect
        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }
        toast.success("Add-on activated successfully!");
        invalidateCaches();
      } else {
        toast.error(result.error || "Failed to add addon");
      }
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handlePurchaseAddon = async (addon: SubscriptionAddon) => {
    if (!user?.id || purchaseLoading) return;

    if (!hasActiveSubscription) {
      toast.error("Please subscribe to a plan before adding add-ons.");
      return;
    }

    setPurchaseLoading(true);
    try {
      const result = await subscriptionService.addSubscriptionAddon(addon.id);

      if (result.success) {
        // If checkout is required (no existing Stripe subscription), redirect
        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }
        toast.success("Add-on activated successfully!");
        invalidateCaches();
      } else {
        toast.error(result.error || "Failed to add addon");
      }
    } finally {
      setPurchaseLoading(false);
    }
  };

  if (addonsLoading) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-v2-ring/60">
          <Sparkles className="h-3.5 w-3.5 text-purple-500" />
          <span className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
            Premium Add-ons
          </span>
        </div>
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
        </div>
      </div>
    );
  }

  if (!addons || addons.length === 0) {
    return null;
  }

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-v2-ring/60">
        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
        <span className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
          Premium Add-ons
        </span>
      </div>
      <div className="p-3">
        <p className="text-[10px] text-v2-ink-muted mb-3">
          {isTeamPlan
            ? "Your Team plan includes UW Wizard with seat assignment for your agents."
            : "Enhance your experience with premium features that work alongside any subscription plan."}
        </p>

        <div className="space-y-4">
          {/* Team plan users: show TeamUWWizardManager instead of standalone addon UI */}
          {isTeamPlan ? (
            <div className="relative p-3 rounded-lg border border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-950/20">
              <div className="absolute -top-2 right-3">
                <Badge className="bg-purple-500 text-white text-[9px] px-1.5">
                  <Check className="h-2.5 w-2.5 mr-0.5" />
                  Included in Team
                </Badge>
              </div>
              <TeamUWWizardManager />
            </div>
          ) : (
            /* Non-team users: show standalone addon tiers (Starter + Professional only) */
            addons.map((addon) => {
              const isUwWizard = addon.name === "uw_wizard";
              const activeAddon = activeAddons.find(
                (userAddon) => userAddon.addon_id === addon.id,
              );
              const hasAccess = isUwWizard ? hasUwWizard : !!activeAddon;
              const tierConfig = getTierConfig(addon);
              const hasTiers = tierConfig && tierConfig.tiers.length > 0;
              const AddonIcon = getAddonIcon(addon.name);
              const comingSoon = isAddonComingSoon(addon, hasAccess);

              // For tiered addons with access, show current usage
              if (hasAccess && isUwWizard) {
                return (
                  <div
                    key={addon.id}
                    className="relative p-3 rounded-lg border border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-950/20"
                  >
                    <div className="absolute -top-2 right-3">
                      <Badge className="bg-purple-500 text-white text-[9px] px-1.5">
                        <Check className="h-2.5 w-2.5 mr-0.5" />
                        {accessSource === "super_admin"
                          ? "Admin Access"
                          : accessSource === "manual_grant"
                            ? "Granted"
                            : accessSource === "team_seat"
                              ? "Team Seat"
                              : "Active"}
                      </Badge>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                        <Wand2 className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-v2-ink">
                          {addon.display_name}
                        </h3>
                        <p className="text-[11px] text-v2-ink-muted mt-0.5">
                          {addon.description}
                        </p>

                        {/* Usage Display */}
                        {uwUsage && (
                          <div className="mt-3 p-2 bg-white dark:bg-v2-ring rounded border border-purple-200 dark:border-purple-800">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-medium text-v2-ink-muted">
                                {uwUsage.tier_name}
                              </span>
                              <span className="text-[10px] text-v2-ink-muted">
                                {uwUsage.runs_used} / {uwUsage.runs_limit} runs
                              </span>
                            </div>
                            <div className="h-1.5 bg-v2-ring rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  uwUsage.usage_percent >= 90
                                    ? "bg-red-500"
                                    : uwUsage.usage_percent >= 75
                                      ? "bg-amber-500"
                                      : "bg-purple-500",
                                )}
                                style={{
                                  width: `${Math.min(uwUsage.usage_percent, 100)}%`,
                                }}
                              />
                            </div>
                            <p className="text-[9px] text-v2-ink-subtle mt-1">
                              {uwUsage.runs_remaining} runs remaining this month
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              if (hasTiers) {
                const availableTiers = isUwWizard
                  ? tierConfig.tiers.filter((tier) => tier.id !== "agency")
                  : tierConfig.tiers;

                const activeTierId = activeAddon?.tier_id || null;
                const selectedTierId =
                  selectedTierIds[addon.id] ||
                  activeTierId ||
                  availableTiers[availableTiers.length - 1]?.id;
                const selectedTier =
                  availableTiers.find((tier) => tier.id === selectedTierId) ||
                  availableTiers[availableTiers.length - 1];

                if (!selectedTier) {
                  return null;
                }

                const selectedTierWithAddon: TierWithAddon = {
                  ...selectedTier,
                  addonId: addon.id,
                };
                const currentTier =
                  availableTiers.find((tier) => tier.id === activeTierId) ||
                  selectedTier;
                const hasVariantIds =
                  selectedTier.stripe_price_id_monthly ||
                  selectedTier.stripe_price_id_annual;
                const highlights = getAddonHighlights(addon, selectedTier);

                if (hasAccess && !isUwWizard) {
                  return (
                    <div
                      key={addon.id}
                      className="relative rounded-lg border border-purple-300 bg-purple-50/50 p-3 dark:border-purple-700 dark:bg-purple-950/20"
                    >
                      <div className="absolute -top-2 right-3">
                        <Badge className="bg-purple-500 px-1.5 text-[9px] text-white">
                          <Check className="mr-0.5 h-2.5 w-2.5" />
                          Active
                        </Badge>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
                          <AddonIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-v2-ink">
                            {addon.display_name}
                          </h3>
                          <p className="mt-0.5 text-[11px] text-v2-ink-muted">
                            {addon.description}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {getAddonHighlights(addon, currentTier).map(
                              (label) => (
                                <span
                                  key={label}
                                  className="rounded bg-v2-ring px-1.5 py-0.5 text-[9px] text-v2-ink-muted dark:bg-v2-ring dark:text-v2-ink-subtle"
                                >
                                  {label}
                                </span>
                              ),
                            )}
                            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-medium text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                              {getTierAllowanceLabel(addon.name, currentTier)}
                            </span>
                          </div>
                          <p className="mt-2 text-[10px] text-v2-ink-muted">
                            Current tier: {currentTier.name}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={addon.id}
                    className={cn(
                      "rounded-lg border p-3",
                      comingSoon
                        ? "border-amber-200 bg-amber-50/60 dark:border-amber-800/70 dark:bg-amber-950/10"
                        : "border-v2-ring",
                    )}
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
                        <AddonIcon className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-v2-ink">
                            {addon.display_name}
                          </h3>
                          {comingSoon && (
                            <Badge variant="outline" className="text-[9px]">
                              Coming Soon
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-v2-ink-muted">
                          {addon.description ||
                            "Enhance your subscription with a premium add-on tier."}
                        </p>
                        {comingSoon && (
                          <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-300">
                            Self-serve access opens soon. Team subscribers will
                            get first access.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-amber-500" />
                        <span className="text-[10px] font-medium text-v2-ink-muted">
                          Choose Your Plan
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {availableTiers.map((tier) => {
                          const isSelected = selectedTier.id === tier.id;

                          return (
                            <button
                              key={tier.id}
                              onClick={() =>
                                setSelectedTierForAddon(addon.id, tier.id)
                              }
                              className={cn(
                                "rounded-lg border p-2 text-left transition-all",
                                isSelected
                                  ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                                  : "border-v2-ring hover:border-v2-ring  ",
                              )}
                            >
                              <div className="text-[11px] font-semibold text-v2-ink">
                                {tier.name}
                              </div>
                              <div className="text-lg font-bold text-v2-ink">
                                {formatPrice(tier.price_monthly)}
                                <span className="text-[9px] font-normal text-v2-ink-muted">
                                  /mo
                                </span>
                              </div>
                              <div className="text-[9px] text-v2-ink-muted">
                                {getTierAllowanceLabel(addon.name, tier)}
                              </div>
                              {isSelected && (
                                <div className="mt-1">
                                  <Badge className="bg-purple-500 text-[8px] text-white">
                                    Selected
                                  </Badge>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {highlights.map((label) => (
                        <span
                          key={label}
                          className="rounded bg-v2-ring px-1.5 py-0.5 text-[9px] text-v2-ink-muted dark:bg-v2-ring dark:text-v2-ink-subtle"
                        >
                          {label}
                        </span>
                      ))}
                      <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-medium text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                        {getTierAllowanceLabel(addon.name, selectedTier)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-v2-ring/60 pt-3 ">
                      <p className="text-[9px] text-v2-ink-subtle">
                        Billed with your plan
                      </p>

                      {hasVariantIds && !comingSoon ? (
                        <Button
                          size="sm"
                          className="h-7 bg-purple-600 text-[10px] hover:bg-purple-700"
                          disabled={purchaseLoading || !hasActiveSubscription}
                          onClick={() =>
                            handlePurchaseTier(selectedTierWithAddon)
                          }
                        >
                          {purchaseLoading ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : null}
                          {hasActiveSubscription
                            ? `Add ${selectedTier.name}`
                            : "Subscribe to a plan first"}
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-[9px]">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              }

              // For non-tiered addons, show original simple display
              const hasVariantIds =
                addon.stripe_price_id_monthly || addon.stripe_price_id_annual;

              return (
                <div
                  key={addon.id}
                  className={cn(
                    "relative p-3 rounded-lg border",
                    hasAccess
                      ? "border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-950/20"
                      : "border-v2-ring",
                  )}
                >
                  {hasAccess && (
                    <div className="absolute -top-2 right-3">
                      <Badge className="bg-purple-500 text-white text-[9px] px-1.5">
                        <Check className="h-2.5 w-2.5 mr-0.5" />
                        Active
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                      <Wand2 className="h-5 w-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-v2-ink">
                        {addon.display_name}
                      </h3>
                      <p className="text-[11px] text-v2-ink-muted mt-0.5">
                        {addon.description}
                      </p>
                    </div>

                    {!hasAccess && (
                      <div className="flex-shrink-0 text-right">
                        <div className="text-lg font-bold text-v2-ink">
                          {formatPrice(addon.price_monthly)}
                        </div>
                        <div className="text-[10px] text-v2-ink-muted">
                          /month
                        </div>
                      </div>
                    )}
                  </div>

                  {!hasAccess && (
                    <div className="mt-3 pt-3 border-t border-v2-ring/60 flex items-center justify-between">
                      <p className="text-[9px] text-v2-ink-subtle">
                        Billed with your plan
                      </p>

                      {hasVariantIds ? (
                        <Button
                          size="sm"
                          className="h-7 text-[10px] bg-purple-600 hover:bg-purple-700"
                          disabled={purchaseLoading || !hasActiveSubscription}
                          onClick={() => handlePurchaseAddon(addon)}
                        >
                          {purchaseLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : null}
                          {hasActiveSubscription
                            ? "Add to Subscription"
                            : "Subscribe to a plan first"}
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-[9px]">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
