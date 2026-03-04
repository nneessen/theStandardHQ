// src/hooks/subscription/useFeatureSpotlight.ts
// Hook for displaying the next relevant feature spotlight to the user

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  spotlightService,
  type FeatureSpotlight,
} from "@/services/subscription";
import { useSubscription } from "./useSubscription";
import { useUserActiveAddons } from "./useUserActiveAddons";

export const spotlightKeys = {
  all: ["spotlights"] as const,
  active: () => [...spotlightKeys.all, "active"] as const,
  userViews: (userId: string) =>
    [...spotlightKeys.all, "views", userId] as const,
};

interface UseFeatureSpotlightResult {
  spotlight: FeatureSpotlight | null;
  dismiss: () => void;
}

/**
 * Determines the next spotlight to show the user based on:
 * 1. Active spotlights filtered by audience targeting
 * 2. Daily frequency cap (one per day)
 * 3. Round-robin: picks highest-priority unviewed, resets when all viewed
 */
export function useFeatureSpotlight(): UseFeatureSpotlightResult {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const { subscription } = useSubscription();
  const { activeAddons } = useUserActiveAddons();
  const [dismissed, setDismissed] = useState(false);

  const planName = subscription?.plan?.name || "free";
  const addonNames = useMemo(
    () => activeAddons.map((a) => a.addon?.name).filter(Boolean) as string[],
    [activeAddons],
  );

  // Fetch active spotlights
  const { data: spotlights } = useQuery({
    queryKey: spotlightKeys.active(),
    queryFn: () => spotlightService.getActiveSpotlights(),
    staleTime: 30 * 60 * 1000,
    enabled: !!userId,
  });

  // Fetch user's views
  const { data: views } = useQuery({
    queryKey: spotlightKeys.userViews(userId || ""),
    queryFn: () => spotlightService.getUserViews(userId!),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
  });

  // Record view mutation
  const recordViewMutation = useMutation({
    mutationFn: (spotlightId: string) =>
      spotlightService.recordView(userId!, spotlightId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: spotlightKeys.userViews(userId || ""),
      });
    },
  });

  // Reset views mutation
  const resetViewsMutation = useMutation({
    mutationFn: () => spotlightService.resetUserViews(userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: spotlightKeys.userViews(userId || ""),
      });
    },
  });

  // Compute the next spotlight to show
  const computedSpotlight = useMemo((): FeatureSpotlight | null => {
    if (!userId || !spotlights?.length || !views) return null;

    // Filter by audience targeting
    const matched = spotlights.filter((s) => {
      const audience = s.target_audience;
      if (audience === "all") return true;
      if (audience.startsWith("plan:")) {
        return planName === audience.slice(5);
      }
      if (audience.startsWith("missing_addon:")) {
        const addonName = audience.slice(14);
        return !addonNames.includes(addonName);
      }
      return false;
    });

    if (matched.length === 0) return null;

    // Daily frequency cap: check if most recent view was today
    if (views.length > 0) {
      const mostRecentView = views.reduce((latest, v) =>
        new Date(v.viewed_at) > new Date(latest.viewed_at) ? v : latest,
      );
      const viewDate = new Date(mostRecentView.viewed_at);
      const now = new Date();
      const isSameDay =
        viewDate.getFullYear() === now.getFullYear() &&
        viewDate.getMonth() === now.getMonth() &&
        viewDate.getDate() === now.getDate();
      if (isSameDay) return null;
    }

    // Find highest-priority unviewed spotlight
    const viewedIds = new Set(views.map((v) => v.spotlight_id));
    const unviewed = matched.filter((s) => !viewedIds.has(s.id));

    if (unviewed.length > 0) {
      // Already sorted by priority DESC from service
      return unviewed[0];
    }

    // All viewed — reset and show highest-priority again
    // We trigger the reset but return the top spotlight immediately
    resetViewsMutation.mutate();
    return matched[0];
  }, [userId, spotlights, views, planName, addonNames, resetViewsMutation]);

  const dismiss = useCallback(() => {
    if (computedSpotlight && userId) {
      recordViewMutation.mutate(computedSpotlight.id);
    }
    setDismissed(true);
  }, [computedSpotlight, userId, recordViewMutation]);

  return {
    spotlight: dismissed ? null : computedSpotlight,
    dismiss,
  };
}
