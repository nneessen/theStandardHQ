// src/hooks/subscription/useSubscription.ts
// Hook for fetching and managing user subscription data

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscriptionService,
  type UserSubscription,
} from "@/services/subscription";

export const subscriptionKeys = {
  all: ["subscription"] as const,
  user: (userId: string) => [...subscriptionKeys.all, "user", userId] as const,
  plans: () => [...subscriptionKeys.all, "plans"] as const,
  usage: (userId: string, metric: string) =>
    [...subscriptionKeys.all, "usage", userId, metric] as const,
};

export interface UseSubscriptionResult {
  subscription: UserSubscription | null;
  isLoading: boolean;
  error: Error | null;
  isActive: boolean;
  /**
   * True when the user is on a PAID tier (Pro/Team) and so has a subscription
   * to manage via the Stripe portal — regardless of status (incl. past_due).
   * Free / no-subscription users return false.
   */
  hasManageableSubscription: boolean;
  isGrandfathered: boolean;
  grandfatherDaysRemaining: number;
  tierName: string;
  refetch: () => void;
}

/**
 * Hook to fetch the current user's subscription
 */
export function useSubscription(): UseSubscriptionResult {
  const { user } = useAuth();
  const userId = user?.id;

  const {
    data: subscription,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: subscriptionKeys.user(userId || ""),
    queryFn: async () => {
      if (!userId) return null;
      return subscriptionService.getUserSubscription(userId);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const isActive = subscriptionService.isSubscriptionActive(
    subscription ?? null,
  );
  const hasManageableSubscription =
    subscriptionService.hasManageableSubscription(subscription ?? null);
  const isGrandfathered = subscriptionService.isGrandfathered(
    subscription ?? null,
  );
  const grandfatherDaysRemaining =
    subscriptionService.getGrandfatherDaysRemaining(subscription ?? null);

  return {
    subscription: subscription ?? null,
    isLoading,
    error: error as Error | null,
    isActive,
    hasManageableSubscription,
    isGrandfathered,
    grandfatherDaysRemaining,
    tierName:
      isActive || isGrandfathered
        ? subscription?.plan?.display_name || "Free"
        : "Free",
    refetch,
  };
}
