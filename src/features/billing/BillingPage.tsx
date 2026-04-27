// src/features/billing/BillingPage.tsx
// Unified billing & subscription management page

import { useState, useEffect } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import {
  Wallet,
  ChevronRight,
  HelpCircle,
  Rocket,
  Brain,
  PhoneCall,
  Plug2,
  BarChart3,
  Sparkles,
  FlaskConical,
} from "lucide-react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useImo } from "@/contexts/ImoContext";
import { useQueryClient } from "@tanstack/react-query";
import { subscriptionKeys, type SubscriptionPlan } from "@/hooks/subscription";
import { CurrentPlanCard } from "./components/CurrentPlanCard";
import { PricingCards } from "./components/PricingCards";
import { UsageOverview } from "./components/UsageOverview";
import { PlanComparisonTable } from "./components/PlanComparisonTable";
// UW Wizard addon section hidden until Stripe integration is ready
// import { PremiumAddonsSection } from "./components/PremiumAddonsSection";
import { AddonUpsellDialog } from "./components/AddonUpsellDialog";
import { CheckoutSuccessDialog } from "./components/CheckoutSuccessDialog";
import { AdminBillingPanel } from "./components/admin/AdminBillingPanel";
import {
  PREMIUM_VOICE_COMING_SOON_MESSAGE,
  PREMIUM_VOICE_LAUNCH_PRICE_MONTHLY_CENTS,
} from "@/lib/subscription/voice-addon";

export function BillingPage() {
  const { isSuperAdmin } = useImo();
  const [faqOpen, setFaqOpen] = useState(false);

  // Upsell dialog state
  const [upsellPlan, setUpsellPlan] = useState<SubscriptionPlan | null>(null);
  const [upsellBillingInterval, setUpsellBillingInterval] = useState<
    "monthly" | "annual"
  >("monthly");
  const [upsellDiscountCode, setUpsellDiscountCode] = useState<
    string | undefined
  >();

  // Checkout success dialog state
  const [checkoutSuccess, setCheckoutSuccess] = useState<{
    planName: string | null;
    billingInterval: string | null;
  } | null>(null);

  // Check search params for post-checkout states
  const searchParams = useSearch({ strict: false }) as Record<string, string>;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let shouldClearParams = false;

    // Returning from Stripe portal — refresh subscription data
    if (searchParams?.portal_return === "1") {
      shouldClearParams = true;
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      toast.success("Subscription updated.");
    }

    if (searchParams?.checkout === "success") {
      shouldClearParams = true;

      // Invalidate subscription cache so fresh data is fetched
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });

      if (searchParams?.pending_addon_id) {
        // Pending addon flow: show toast (existing behavior)
        toast.success(
          "Plan activated! Complete your setup by adding a premium add-on below.",
          { duration: 8000 },
        );
      } else {
        // Normal checkout: open success dialog instead of toast
        setCheckoutSuccess({
          planName: searchParams?.plan_name || null,
          billingInterval: searchParams?.billing_interval || null,
        });
      }
    }
    // Clear search params to prevent re-firing on remount
    if (shouldClearParams) {
      navigate({ to: "/billing", search: {}, replace: true });
    }
  }, [
    searchParams?.portal_return,
    searchParams?.checkout,
    searchParams?.pending_addon_id,
    searchParams?.billing_interval,
    searchParams?.plan_name,
    navigate,
    queryClient,
  ]);

  const handlePlanSelect = (
    plan: SubscriptionPlan,
    billingInterval: "monthly" | "annual",
    discountCode?: string,
  ) => {
    setUpsellPlan(plan);
    setUpsellBillingInterval(billingInterval);
    setUpsellDiscountCode(discountCode);
  };

  const premiumVoiceLaunchPrice = `$${(
    PREMIUM_VOICE_LAUNCH_PRICE_MONTHLY_CENTS / 100
  ).toFixed(0)}/mo`;

  return (
    <div className="flex flex-col gap-3">
      {/* Compact header — title + inline subtitle */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Wallet className="h-4 w-4 text-v2-ink" />
          <h1 className="text-base font-semibold tracking-tight text-v2-ink">
            Billing
          </h1>
        </div>
        <p className="text-[11px] text-v2-ink-muted">
          Manage your subscription, add-ons, and usage
        </p>
      </header>

      {/* Sections */}
      <div className="flex-1 flex flex-col gap-3">
        {/* Pricing Cards — primary focus, top of page */}
        <PricingCards onPlanSelect={handlePlanSelect} />

        {/* What's Coming */}
        <div className="rounded-v2-md border border-v2-ring shadow-v2-soft bg-v2-card overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-v2-card-dark to-v2-card-dark ">
            <div className="flex items-center gap-2 mb-1">
              <FlaskConical className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[11px] font-bold text-white uppercase tracking-[0.18em]">
                What's Coming
              </span>
              <span className="text-[9px] font-medium bg-amber-400 text-v2-ink rounded-full px-2 py-0.5 ml-1">
                Team gets early access
              </span>
            </div>
            <p className="text-[11px] text-v2-ink-subtle leading-snug">
              This is just the beginning. The roadmap ahead is massive — and
              heavily AI-driven. Team subscribers get every new feature first,
              the moment it ships.
            </p>
          </div>

          {/* Feature columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-v2-ring/60">
            {/* AI Suite */}
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-1.5 mb-2">
                <Brain className="h-3.5 w-3.5 text-indigo-500" />
                <p className="text-[10px] font-bold text-v2-ink dark:text-v2-ink-subtle uppercase tracking-wide">
                  AI Suite
                </p>
              </div>
              {[
                "AI-powered policy & coverage recommendations",
                "Smart underwriting insights from health data",
                "AI-drafted recruit emails & follow-ups",
                "Automated document review & flagging",
                "Conversational AI for client objection handling",
              ].map((item) => (
                <div key={item} className="flex items-start gap-1.5">
                  <Sparkles className="h-3 w-3 text-indigo-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle leading-tight">
                    {item}
                  </p>
                </div>
              ))}
            </div>

            {/* CRM Integrations */}
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-1.5 mb-2">
                <Plug2 className="h-3.5 w-3.5 text-emerald-500" />
                <p className="text-[10px] font-bold text-v2-ink dark:text-v2-ink-subtle uppercase tracking-wide">
                  CRM Integrations
                </p>
              </div>
              {[
                "Close.io — bi-directional contact & lead sync",
                "GoHighLevel — pipeline and automation bridge",
                "Automated lead routing from either CRM",
                "Two-way activity & note sync",
                "Native dialer & SMS log import",
              ].map((item) => (
                <div key={item} className="flex items-start gap-1.5">
                  <Sparkles className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle leading-tight">
                    {item}
                  </p>
                </div>
              ))}
            </div>

            {/* Power Tools */}
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart3 className="h-3.5 w-3.5 text-amber-500" />
                <p className="text-[10px] font-bold text-v2-ink dark:text-v2-ink-subtle uppercase tracking-wide">
                  Power Tools
                </p>
              </div>
              {[
                "Advanced analytics & custom report builder",
                "AI-generated training modules from your content",
                "Predictive persistency & chargeback alerts",
                "Bulk policy import & carrier data sync",
                "Open API access for custom integrations",
              ].map((item) => (
                <div key={item} className="flex items-start gap-1.5">
                  <Sparkles className="h-3 w-3 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle leading-tight">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <div className="px-4 py-2 bg-v2-canvas border-t border-v2-ring/60">
            <p className="text-[10px] text-v2-ink-muted text-center">
              Features roll out to{" "}
              <span className="font-semibold text-violet-600 dark:text-violet-400">
                Team
              </span>{" "}
              first — then down to other tiers over time. Upgrade once, stay
              ahead always.
            </p>
          </div>
        </div>

        {/* Current Plan Status */}
        <CurrentPlanCard />

        {/* Team Early Access Strip */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/20 border border-violet-200 dark:border-violet-800">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/50 flex-shrink-0">
            <Rocket className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-violet-900 dark:text-violet-100">
              Team subscribers are first in line for every new feature
            </p>
            <p className="text-[10px] text-violet-600 dark:text-violet-400">
              Every major addition ships to Team before any other tier — no
              waiting, no extra cost.
            </p>
          </div>
        </div>

        <div className="rounded-v2-md border border-v2-ring shadow-v2-soft bg-v2-card overflow-hidden">
          <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-v2-ring/60">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white flex-shrink-0">
                <PhoneCall className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-v2-ink">
                    Premium Voice
                  </h2>
                  <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                    Coming Soon
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-v2-ink-muted max-w-2xl leading-relaxed">
                  AI-powered call follow-up for missed appointments,
                  reschedules, and after-hours inbound coverage for your
                  standard-chat-bot.
                </p>
                <p className="mt-2 text-[10px] font-medium text-v2-ink-muted">
                  Launch plan: Voice Pro at {premiumVoiceLaunchPrice} with 500
                  included minutes.
                </p>
              </div>
            </div>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              {[
                "Missed appointments",
                "Reschedules",
                "After-hours inbound",
                "Minute-based entitlement",
              ].map((label) => (
                <span
                  key={label}
                  className="rounded bg-v2-ring px-1.5 py-0.5 text-[9px] text-v2-ink-muted dark:bg-v2-ring dark:text-v2-ink-subtle"
                >
                  {label}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-v2-ink-muted">
              {PREMIUM_VOICE_COMING_SOON_MESSAGE} Team subscribers will get
              first access when rollout opens.
            </p>
          </div>
        </div>

        {/* Premium Add-ons — hidden until UW Wizard Stripe integration is ready */}
        {/* <PremiumAddonsSection /> */}

        {/* Usage Overview */}
        <UsageOverview />

        {/* Compare All Features (collapsible) */}
        <PlanComparisonTable />

        {/* FAQ (collapsible) */}
        <Collapsible.Root open={faqOpen} onOpenChange={setFaqOpen}>
          <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
            <Collapsible.Trigger asChild>
              <button className="flex items-center justify-between w-full px-3 py-2 hover:bg-v2-canvas transition-colors rounded-lg">
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-v2-ink-subtle" />
                  <span className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
                    FAQ
                  </span>
                </div>
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 text-v2-ink-subtle transition-transform duration-200",
                    faqOpen && "rotate-90",
                  )}
                />
              </button>
            </Collapsible.Trigger>

            <Collapsible.Content>
              <div className="px-3 pb-3 space-y-2 border-t border-v2-ring/60 pt-2">
                <FaqItem
                  q="What happens when grandfathered period ends?"
                  a="You'll move to Free tier unless you subscribe. All data is preserved."
                />
                <FaqItem
                  q="What if I exceed my email limit?"
                  a="You can keep sending. Overages charged at $5/500 emails on your next invoice."
                />
                <FaqItem
                  q="What's in the Team tier?"
                  a="Full downline visibility, recruiting pipeline, override tracking, and UW Wizard built-in with seat assignment for your agents. $250/mo."
                />
                <FaqItem
                  q="Do my downlines need to pay?"
                  a="Each person manages their own subscription. If you have Team tier, you see their data regardless of their tier."
                />
              </div>
            </Collapsible.Content>
          </div>
        </Collapsible.Root>

        {/* Super-admin: Admin Billing Panel */}
        {isSuperAdmin && <AdminBillingPanel />}
      </div>

      {/* Addon Upsell Dialog */}
      <AddonUpsellDialog
        plan={upsellPlan}
        billingInterval={upsellBillingInterval}
        discountCode={upsellDiscountCode}
        onClose={() => setUpsellPlan(null)}
      />

      {/* Checkout Success Dialog */}
      {checkoutSuccess && (
        <CheckoutSuccessDialog
          planNameHint={checkoutSuccess.planName}
          billingIntervalHint={checkoutSuccess.billingInterval}
          onClose={() => setCheckoutSuccess(null)}
        />
      )}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="pb-2 border-b border-v2-ring/60 last:border-0 last:pb-0">
      <p className="text-[11px] font-medium text-v2-ink-muted">{q}</p>
      <p className="text-[10px] text-v2-ink-muted mt-0.5">{a}</p>
    </div>
  );
}
