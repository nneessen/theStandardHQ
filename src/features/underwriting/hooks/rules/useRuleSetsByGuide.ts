import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/services/base/supabase";

import {
  getRuleSetsByGuide,
  type RuleSetWithRules,
} from "@/services/underwriting/repositories/ruleService";
import { ruleEngineKeys } from "./useRuleSets";

export const guideRulesKeys = {
  byGuide: (imoId: string | null | undefined, guideId: string) =>
    ["rule-engine", "by-guide", imoId || "no-imo", guideId] as const,
};

/**
 * Fetch all rule sets that originated from a specific guide
 * (regardless of review_status — UI groups by status).
 */
export function useRuleSetsByGuide(guideId: string | undefined) {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery<RuleSetWithRules[]>({
    queryKey: guideRulesKeys.byGuide(imoId, guideId || ""),
    queryFn: () => getRuleSetsByGuide(guideId!, imoId!),
    enabled: !!guideId && !!imoId,
    staleTime: 60 * 1000,
  });
}

interface ExtractRulesResponse {
  success: boolean;
  guideId: string;
  setsCreated: number;
  rulesCreated: number;
  errors: string[];
  aiDurationMs: number;
  totalDurationMs: number;
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
}

/**
 * Trigger AI extraction of v2-shaped rule candidates from a parsed guide.
 * Calls extract-underwriting-rules edge function. Candidates land in
 * underwriting_rule_sets with review_status='pending_review' so the runtime
 * engine ignores them until an admin approves.
 */
export function useExtractRules() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation<
    ExtractRulesResponse,
    Error,
    { guideId: string; productId?: string | null }
  >({
    mutationFn: async ({ guideId, productId }) => {
      const { data, error } =
        await supabase.functions.invoke<ExtractRulesResponse>(
          "extract-underwriting-rules",
          {
            body: { guideId, productId: productId ?? null },
          },
        );
      if (error) {
        throw new Error(error.message);
      }
      if (!data?.success) {
        throw new Error(data?.error ?? "Extraction failed");
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: guideRulesKeys.byGuide(imoId, data.guideId),
      });
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.needingReview(imoId),
      });
    },
  });
}
