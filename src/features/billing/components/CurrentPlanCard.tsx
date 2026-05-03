// src/features/billing/components/CurrentPlanCard.tsx
// Compact plan status bar showing current plan, status, and manage button

import { useState } from "react";
import {
  Crown,
  CheckCircle2,
  AlertTriangle,
  Gift,
  Calendar,
  Loader2,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useSubscription,
  useUserActiveAddons,
  subscriptionService,
} from "@/hooks/subscription";
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/contexts/ImoContext";
import { cn } from "@/lib/utils";

export function CurrentPlanCard() {
  const { user } = useAuth();
  const { isSuperAdmin } = useImo();
  const {
    subscription,
    isLoading,
    isActive,
    isGrandfathered,
    grandfatherDaysRemaining,
    tierName,
  } = useSubscription();
  const { totalAddonMonthlyCost } = useUserActiveAddons();
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  const hasActivePayment =
    subscription?.stripe_subscription_id && !isGrandfathered;

  const handleManageSubscription = async () => {
    if (!user?.id) return;
    setIsLoadingPortal(true);
    try {
      const portalUrl = await subscriptionService.createPortalSession(user.id);
      if (portalUrl) window.location.href = portalUrl;
    } finally {
      setIsLoadingPortal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft px-3 py-2">
        <div className="animate-pulse flex items-center gap-3">
          <div className="h-4 bg-v2-ring rounded w-24" />
          <div className="h-4 bg-v2-ring rounded w-16" />
        </div>
      </div>
    );
  }

  const basePlanPrice = subscription?.plan?.price_monthly || 0;
  const billingInterval = subscription?.billing_interval || "monthly";
  const totalPrice = basePlanPrice + totalAddonMonthlyCost;
  const displayTierName = isSuperAdmin ? "Super Admin" : tierName;

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
      {/* Main status row */}
      <div className="flex items-center justify-between px-3 py-2 gap-3 flex-wrap">
        {/* Left: Plan info */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Crown className="h-3.5 w-3.5 text-v2-ink-subtle" />
            <span className="text-[12px] font-bold text-v2-ink">
              {displayTierName}
            </span>
          </div>

          <span className="text-[10px] text-v2-ink-subtle">
            {isSuperAdmin
              ? "Full Access"
              : totalPrice === 0
                ? "Free"
                : `${subscriptionService.formatPrice(totalPrice)}/${billingInterval === "annual" ? "yr" : "mo"}`}
          </span>

          {/* Status badge */}
          <div
            className={cn(
              "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium",
              isActive
                ? "bg-success/20 text-success dark:bg-success/30 dark:text-success"
                : "bg-destructive/20 text-destructive dark:bg-destructive/30 dark:text-destructive",
            )}
          >
            {isActive ? (
              <>
                <CheckCircle2 className="h-2.5 w-2.5" />
                Active
              </>
            ) : (
              <>
                <AlertTriangle className="h-2.5 w-2.5" />
                Inactive
              </>
            )}
          </div>

          {/* Renewal / Expiry date */}
          {subscription?.current_period_end && !isGrandfathered && (
            <div className="flex items-center gap-1 text-[10px] text-v2-ink-muted">
              <Calendar className="h-2.5 w-2.5" />
              <span>
                {subscription.cancel_at_period_end ? "Expires" : "Renews"}{" "}
                {new Date(subscription.current_period_end).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", year: "numeric" },
                )}
              </span>
            </div>
          )}
        </div>

        {/* Right: Manage button */}
        {hasActivePayment && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px]"
            onClick={handleManageSubscription}
            disabled={isLoadingPortal}
          >
            {isLoadingPortal ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Receipt className="h-3 w-3 mr-1" />
            )}
            Manage Subscription
          </Button>
        )}
      </div>

      {/* Grandfathered notice */}
      {isGrandfathered && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-warning/10 border-t border-warning/30/50">
          <Gift className="h-3 w-3 text-warning flex-shrink-0" />
          <p className="text-[10px] text-warning">
            Grandfathered {displayTierName} access —{" "}
            <span className="font-semibold">
              {grandfatherDaysRemaining} days remaining
            </span>
            . Subscribe before expiration to keep features.
          </p>
        </div>
      )}
    </div>
  );
}
