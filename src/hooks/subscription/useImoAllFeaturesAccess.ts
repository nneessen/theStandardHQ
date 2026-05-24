// src/hooks/subscription/useImoAllFeaturesAccess.ts
// Hook for checking whether the current user's IMO grants all subscription features

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/services/base/supabase";
import { subscriptionKeys } from "./useSubscription";

export interface UseImoAllFeaturesAccessResult {
  grantsAllFeatures: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Checks whether the current user's IMO grants all subscription features for free.
 * This is an IMO-scoped bypass for subscription feature gates only; admin/system
 * access remains role-gated elsewhere.
 */
export function useImoAllFeaturesAccess(): UseImoAllFeaturesAccessResult {
  const { user } = useAuth();
  const userId = user?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: [...subscriptionKeys.all, "imo-all-features", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "current_user_imo_grants_all_features",
      );

      if (error) {
        throw error;
      }

      return !!data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    grantsAllFeatures: data ?? false,
    isLoading,
    error: error as Error | null,
  };
}
