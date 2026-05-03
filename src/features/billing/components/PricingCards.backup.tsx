// src/features/billing/components/PricingCards.tsx
// Hero pricing columns driven by DB feature matrix

import { useState } from "react";
import { Check, ExternalLink, Loader2, Star, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useSubscription,
  useSubscriptionPlans,
  subscriptionService,
} from "@/hooks/subscription";
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/contexts/ImoContext";
import { FEATURE_REGISTRY } from "@/constants/features";
// eslint-disable-next-line no-restricted-imports
import type {
  SubscriptionPlan,
  SubscriptionFeatures,
} from "@/services/subscription";

/** Features hidden from pricing cards (universal to all plans) */
const EXCLUDED_FEATURES = new Set(["settings", "connect_upline"]);

/** Ordered plan names for "Everything in X, plus:" logic */
const PLAN_ORDER = ["free", "pro", "team"] as const;

/**
 * Get the human-readable features list for a plan,
 * showing only incremental features vs the previous tier.
 */
function getIncrementalFeatures(
  plan: SubscriptionPlan,
  plans: SubscriptionPlan[],
): { inherited: string | null; features: string[] } {
  const planIndex = PLAN_ORDER.indexOf(
    plan.name as (typeof PLAN_ORDER)[number],
  );
  const previousPlan =
    planIndex > 0
      ? plans.find((p) => p.name === PLAN_ORDER[planIndex - 1])
      : null;

  const features: string[] = [];
  const featureKeys = Object.keys(
    plan.features,
  ) as (keyof SubscriptionFeatures)[];

  for (const key of featureKeys) {
    if (EXCLUDED_FEATURES.has(key)) continue;
    if (!plan.features[key]) continue;

    // If previous tier already has it, skip (it's inherited)
    if (previousPlan?.features[key]) continue;

    const registry = FEATURE_REGISTRY[key];
    if (!registry) continue;

    let label = registry.displayName;

    // Add email limit annotation
    if (key === "email" && plan.email_limit > 0) {
      label = `${label} (${plan.email_limit.toLocaleString()}/mo)`;
    }

    features.push(label);
  }

  // Add analytics count
  const analyticsCount = plan.analytics_sections?.length || 0;
  const prevAnalyticsCount = previousPlan?.analytics_sections?.length || 0;
  if (analyticsCount > prevAnalyticsCount) {
    features.push(`${analyticsCount}/9 Analytics Sections`);
  }

  const inherited = previousPlan ? previousPlan.display_name : null;
  return { inherited, features };
}

interface PricingCardsProps {
  /** When provided, intercepts plan selection (for upsell dialog flow) */
  onPlanSelect?: (
    plan: SubscriptionPlan,
    billingInterval: "monthly" | "annual",
    discountCode?: string,
  ) => void;
}

export function PricingCards({ onPlanSelect }: PricingCardsProps = {}) {
  const { user, supabaseUser } = useAuth();
  const userEmail = supabaseUser?.email || user?.email || "";
  const { isSuperAdmin } = useImo();
  const { subscription, isGrandfathered } = useSubscription();
  const { plans } = useSubscriptionPlans();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">(
    "monthly",
  );
  const [discountCode, setDiscountCode] = useState("");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  const currentPlanId = subscription?.plan?.id;

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (!user?.id || !userEmail) return;

    // If selecting Free plan, direct to portal to cancel
    if (!subscriptionService.isPaidPlan(plan)) {
      setLoadingPlanId(plan.id);
      try {
        const portalUrl = await subscriptionService.createPortalSession(
          user.id,
        );
        if (portalUrl) window.location.href = portalUrl;
      } catch {
        // portal session failed — nothing to do, error handled in service
      } finally {
        setLoadingPlanId(null);
      }
      return;
    }

    // If onPlanSelect callback provided, use it (for upsell dialog)
    if (onPlanSelect) {
      onPlanSelect(plan, billingInterval, discountCode || undefined);
      return;
    }

    setLoadingPlanId(plan.id);
    try {
      const checkoutUrl = await subscriptionService.createCheckoutSession(
        plan,
        billingInterval,
        discountCode || undefined,
      );
      if (checkoutUrl) window.open(checkoutUrl, "_blank");
    } finally {
      setLoadingPlanId(null);
    }
  };

  // Show all plans — Free tier is always visible for comparison
  const visiblePlans = plans;

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
      <div className="p-4">
        {/* Header + Billing Toggle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-v2-ink">
              Choose Your Plan
            </h2>
            {isGrandfathered && (
              <p className="text-[10px] text-warning mt-0.5">
                Subscribe before your free access expires to keep your features.
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 bg-v2-ring rounded-md p-0.5">
            <button
              onClick={() => setBillingInterval("monthly")}
              className={cn(
                "px-2.5 py-1 text-[10px] font-medium rounded transition-colors",
                billingInterval === "monthly"
                  ? "bg-white dark:bg-v2-card-dark text-v2-ink shadow-sm"
                  : "text-v2-ink-muted hover:text-v2-ink dark:hover:text-v2-ink-subtle",
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval("annual")}
              className={cn(
                "px-2.5 py-1 text-[10px] font-medium rounded transition-colors",
                billingInterval === "annual"
                  ? "bg-white dark:bg-v2-card-dark text-v2-ink shadow-sm"
                  : "text-v2-ink-muted hover:text-v2-ink dark:hover:text-v2-ink-subtle",
              )}
            >
              Annual <span className="text-success">Save 17%</span>
            </button>
          </div>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visiblePlans.map((plan) => {
            const isCurrent = !isSuperAdmin && plan.id === currentPlanId;
            const isPaid = subscriptionService.isPaidPlan(plan);
            const isPopular = plan.name === "pro";
            const isLoading = loadingPlanId === plan.id;
            const price = subscriptionService.getEffectiveMonthlyPrice(
              plan,
              billingInterval,
            );
            const { inherited, features } = getIncrementalFeatures(plan, plans);

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-lg border p-3 transition-all",
                  isCurrent
                    ? "border-success bg-success/10/50 dark:bg-success/10"
                    : isPopular
                      ? "border-v2-ink"
                      : "border-v2-ring",
                )}
              >
                {/* Popular badge */}
                {isPopular && !isCurrent && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-0.5 bg-v2-card-dark dark:bg-v2-ring text-white dark:text-v2-ink text-[9px] font-semibold px-2 py-0.5 rounded-full">
                      <Star className="h-2.5 w-2.5" />
                      Popular
                    </span>
                  </div>
                )}

                {/* Current badge */}
                {isCurrent && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-0.5 bg-success text-white text-[9px] font-semibold px-2 py-0.5 rounded-full">
                      <Check className="h-2.5 w-2.5" />
                      Current Plan
                    </span>
                  </div>
                )}

                {/* Plan header */}
                <div className="mt-1 mb-3">
                  <h3 className="text-sm font-bold text-v2-ink">
                    {plan.display_name}
                  </h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold text-v2-ink">
                      {isPaid ? subscriptionService.formatPrice(price) : "$0"}
                    </span>
                    <span className="text-[10px] text-v2-ink-muted">/mo</span>
                  </div>
                  {isPaid && billingInterval === "annual" && (
                    <p className="text-[9px] text-v2-ink-subtle mt-0.5">
                      Billed{" "}
                      {subscriptionService.formatPrice(plan.price_annual)}
                      /year
                    </p>
                  )}
                  {!isPaid && (
                    <p className="text-[9px] text-v2-ink-subtle mt-0.5">
                      Free forever
                    </p>
                  )}
                </div>

                {/* Features list */}
                <div className="flex-1 space-y-1.5 mb-3">
                  {inherited && (
                    <p className="text-[10px] font-medium text-v2-ink-muted mb-1">
                      Everything in {inherited}, plus:
                    </p>
                  )}
                  {features.map((feature) => (
                    <div key={feature} className="flex items-start gap-1.5">
                      <Check className="h-3 w-3 text-success mt-0.5 flex-shrink-0" />
                      <span className="text-[10px] text-v2-ink-muted">
                        {feature}
                      </span>
                    </div>
                  ))}

                  {/* Team size note */}
                  {plan.team_size_limit === null && plan.name === "team" && (
                    <div className="flex items-start gap-1.5">
                      <Check className="h-3 w-3 text-success mt-0.5 flex-shrink-0" />
                      <span className="text-[10px] text-v2-ink-muted">
                        Unlimited team size
                      </span>
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <Button
                  size="sm"
                  className={cn(
                    "h-7 text-[10px] w-full",
                    isCurrent
                      ? "bg-success/20 text-success dark:bg-success/30 dark:text-success hover:bg-success/20 cursor-default"
                      : isPaid
                        ? "bg-v2-card-dark hover:bg-v2-ring dark:bg-v2-ring dark:hover:bg-v2-ring dark:text-v2-ink"
                        : "bg-v2-ring text-v2-ink hover:bg-v2-ring dark:text-v2-ink-subtle dark:hover:bg-v2-card-dark",
                  )}
                  disabled={isCurrent || isLoading}
                  onClick={() => handleSelectPlan(plan)}
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isCurrent ? (
                    "Current Plan"
                  ) : isPaid ? (
                    <>
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {subscription?.stripe_subscription_id
                        ? "Change Plan"
                        : "Get Started"}
                    </>
                  ) : (
                    "Downgrade"
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Discount Code */}
        {visiblePlans.some((p) => subscriptionService.isPaidPlan(p)) && (
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-v2-ring/60">
            <Tag className="h-3 w-3 text-v2-ink-subtle" />
            <Input
              type="text"
              placeholder="Discount code"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
              className="h-7 w-32 text-[10px] px-2 uppercase"
            />
          </div>
        )}
      </div>
    </div>
  );
}
