// src/features/billing/components/CheckoutSuccessDialog.tsx
// Checkout success confirmation dialog with plan details and activation polling
// Includes Stripe sync fallback when webhook delivery is delayed.

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  ArrowRight,
  Crown,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { subscriptionKeys, useSubscriptionPlans } from "@/hooks/subscription";
import { FEATURE_REGISTRY } from "@/constants/features";
// eslint-disable-next-line no-restricted-imports
import {
  subscriptionService,
  type SubscriptionPlan,
  type UserSubscription,
} from "@/services/subscription";

interface CheckoutSuccessDialogProps {
  planNameHint: string | null;
  billingIntervalHint: string | null;
  onClose: () => void;
}

type ActivationStatus = "polling" | "active" | "timeout";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 20000;
const SYNC_DELAY_MS = 4000; // Try sync after 4s if webhook hasn't fired

export function CheckoutSuccessDialog({
  planNameHint,
  billingIntervalHint,
  onClose,
}: CheckoutSuccessDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const { plans } = useSubscriptionPlans();
  const [activationStatus, setActivationStatus] =
    useState<ActivationStatus>("polling");
  const syncAttempted = useRef(false);

  // Use a dedicated polling query with short refetchInterval
  const { data: subscription } = useQuery({
    queryKey: [...subscriptionKeys.user(userId || ""), "checkout-poll"],
    queryFn: async (): Promise<UserSubscription | null> => {
      if (!userId) return null;
      return subscriptionService.getUserSubscription(userId);
    },
    enabled: !!userId && activationStatus === "polling",
    refetchInterval: activationStatus === "polling" ? POLL_INTERVAL_MS : false,
    staleTime: 0,
    gcTime: 0,
  });

  // Look up plan from hint
  const hintedPlan: SubscriptionPlan | null =
    plans.find((p) => p.name.toLowerCase() === planNameHint?.toLowerCase()) ??
    null;

  // Check if subscription matches purchased plan
  const subscriptionMatchesPlan =
    !!subscription &&
    subscription.plan?.name?.toLowerCase() === planNameHint?.toLowerCase();

  // Determine confirmed plan from subscription (once active)
  const confirmedPlan: SubscriptionPlan | null = subscriptionMatchesPlan
    ? (subscription?.plan ?? null)
    : null;

  // Use confirmed plan when available, fall back to hinted plan
  const displayPlan = confirmedPlan ?? hintedPlan;
  const displayName = displayPlan?.display_name ?? planNameHint ?? "Your Plan";
  const billingInterval =
    billingIntervalHint === "annual" ? "annual" : "monthly";

  // Calculate price for display
  const displayPrice = displayPlan
    ? subscriptionService.getEffectiveMonthlyPrice(displayPlan, billingInterval)
    : null;

  // Get enabled features for this plan
  const enabledFeatures: string[] = displayPlan
    ? Object.entries(displayPlan.features)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key)
        .filter((key) => FEATURE_REGISTRY[key])
    : [];

  // Transition to active when subscription matches
  useEffect(() => {
    if (subscriptionMatchesPlan && activationStatus === "polling") {
      setActivationStatus("active");
      // Invalidate main subscription cache so the rest of the app picks up the change
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    }
  }, [subscriptionMatchesPlan, activationStatus, queryClient]);

  // Stripe sync fallback: if webhook hasn't delivered after SYNC_DELAY_MS,
  // call the sync-subscription edge function to pull state from Stripe directly
  useEffect(() => {
    if (activationStatus !== "polling" || !userId) return;

    const timer = setTimeout(async () => {
      if (syncAttempted.current) return;
      syncAttempted.current = true;

      console.log("[checkout] Webhook slow — attempting Stripe sync fallback");
      const result = await subscriptionService.syncSubscriptionFromStripe();

      if (result.synced) {
        console.log("[checkout] Sync succeeded, plan:", result.plan);
        // Invalidate to trigger re-poll with fresh DB data
        queryClient.invalidateQueries({
          queryKey: [...subscriptionKeys.user(userId), "checkout-poll"],
        });
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      } else {
        console.warn("[checkout] Sync fallback failed:", result.reason);
      }
    }, SYNC_DELAY_MS);

    return () => clearTimeout(timer);
  }, [activationStatus, userId, queryClient]);

  // Timeout after POLL_TIMEOUT_MS
  useEffect(() => {
    if (activationStatus !== "polling") return;

    const timer = setTimeout(() => {
      setActivationStatus("timeout");
    }, POLL_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [activationStatus]);

  const handleGoToDashboard = () => {
    onClose();
    navigate({ to: "/" });
  };

  const handleStayOnBilling = () => {
    onClose();
  };

  const handleManualRefresh = async () => {
    // Try sync again on manual retry
    syncAttempted.current = false;
    const result = await subscriptionService.syncSubscriptionFromStripe();
    if (result.synced) {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    }
    setActivationStatus("polling");
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent size="lg" className="max-h-[85vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex-shrink-0 rounded-full p-2",
                activationStatus === "active"
                  ? "bg-success/20 dark:bg-success/40"
                  : "bg-warning/20 dark:bg-warning/40",
              )}
            >
              {activationStatus === "active" ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : activationStatus === "polling" ? (
                <Loader2 className="h-5 w-5 text-warning animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5 text-warning" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold text-foreground">
                Welcome to {displayName}!
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
                {activationStatus === "active"
                  ? "Your subscription is active and ready to go."
                  : activationStatus === "polling"
                    ? "Setting up your subscription..."
                    : "Taking longer than expected. Your subscription should activate shortly."}
              </DialogDescription>
            </div>
            {/* Status badge */}
            <span
              className={cn(
                "flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                activationStatus === "active"
                  ? "bg-success/20 text-success dark:bg-success/40 dark:text-success"
                  : "bg-warning/20 text-warning dark:bg-warning/40 dark:text-warning",
              )}
            >
              {activationStatus === "active" ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Active
                </>
              ) : activationStatus === "polling" ? (
                <>
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                  Pending
                </>
              )}
            </span>
          </div>
        </div>

        {/* Plan Details Card */}
        <div className="mx-5 rounded-v2-md border border-border bg-background dark:bg-card-dark/50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-3.5 w-3.5 text-warning" />
              <span className="text-xs font-semibold text-foreground">
                {displayName}
              </span>
            </div>
            {displayPrice !== null && (
              <div className="text-right">
                <span className="text-sm font-bold text-foreground">
                  ${(displayPrice / 100).toFixed(2)}
                </span>
                <span className="text-[10px] text-muted-foreground">/mo</span>
                {billingInterval === "annual" && (
                  <span className="ml-1.5 text-[9px] font-medium text-success">
                    billed annually
                  </span>
                )}
              </div>
            )}
          </div>
          {activationStatus === "active" &&
            subscription?.current_period_end && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Next renewal:{" "}
                {new Date(subscription.current_period_end).toLocaleDateString(
                  "en-US",
                  { month: "long", day: "numeric", year: "numeric" },
                )}
              </p>
            )}
        </div>

        {/* What's Included */}
        {enabledFeatures.length > 0 && (
          <div className="mx-5 mt-3">
            <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wide mb-2">
              What's Included
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {enabledFeatures.map((featureKey) => {
                const feature = FEATURE_REGISTRY[featureKey];
                return (
                  <div
                    key={featureKey}
                    className="flex items-center gap-1.5 py-0.5"
                  >
                    <Zap className="h-2.5 w-2.5 text-success flex-shrink-0" />
                    <span className="text-[11px] text-muted-foreground truncate">
                      {feature.displayName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* What's Next */}
        <div className="mx-5 mt-3">
          <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wide mb-2">
            What's Next
          </h3>
          <div className="space-y-2">
            <NextStep
              number={1}
              title="Explore your dashboard"
              description="Your upgraded dashboard is ready with all your new features."
            />
            <NextStep
              number={2}
              title="Set up your targets"
              description="Configure income targets and track progress toward your goals."
            />
            <NextStep
              number={3}
              title="Invite your team"
              description="If you have a Team plan, connect with your downlines for full visibility."
            />
          </div>
        </div>

        {/* Timeout fallback */}
        {activationStatus === "timeout" && (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg bg-warning/10 border border-warning/30/50 px-3 py-2">
            <RefreshCw className="h-3.5 w-3.5 text-warning flex-shrink-0" />
            <p className="text-[10px] text-warning">
              Your payment was processed successfully. If your plan doesn't
              update shortly, try refreshing the page.
            </p>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleManualRefresh}
              className="flex-shrink-0"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-3 border-t border-border/60 mt-3">
          <Button variant="ghost" size="sm" onClick={handleStayOnBilling}>
            Stay on Billing
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={handleGoToDashboard}
            className="gap-1.5"
          >
            Go to Dashboard
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NextStep({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-card-dark dark:bg-muted text-white dark:text-foreground text-[10px] font-bold">
        {number}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
