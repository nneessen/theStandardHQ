// src/hooks/legal/useTermsAcceptance.ts
//
// Data layer for the first-login Terms/Privacy acceptance gate. Owns the
// Supabase read (has this user accepted?) and write (record acceptance via the
// SECURITY DEFINER `accept_platform_terms` RPC, keyed to auth.uid()). Components
// must not touch Supabase directly, so this lives in the hooks layer.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base";
import { TERMS_VERSION } from "@/features/legal/constants";

export const termsAcceptanceKey = (userId: string) =>
  ["terms-acceptance", userId] as const;

/** Reads whether `userId` has accepted the current Terms. */
export function useTermsAcceptanceStatus(
  userId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: termsAcceptanceKey(userId ?? "anonymous"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("terms_accepted_at")
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(userId) && enabled,
    staleTime: Infinity,
  });
}

/** Records the current user's affirmative acceptance of the Terms. */
export function useAcceptTerms(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("accept_platform_terms", {
        p_version: TERMS_VERSION,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: termsAcceptanceKey(userId),
      });
    },
  });
}
