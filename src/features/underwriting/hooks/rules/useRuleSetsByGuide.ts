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

// =============================================================================
// Chunked extraction
// =============================================================================
// The edge function processes ONE chunk per invocation (one Claude call per
// invocation, sized to fit Supabase's 150s timeout). The client loops over
// chunks until hasMore=false so the FULL guide is extracted, not just a slice.

interface ExtractChunkResponse {
  success: boolean;
  guideId: string;
  chunkOffset: number;
  chunkSize: number;
  chunkIndex: number;
  totalChunks: number;
  totalChars: number;
  nextOffset: number;
  hasMore: boolean;
  conditionsExtracted: string[];
  setsCreated: number;
  rulesCreated: number;
  errors: string[];
  aiDurationMs: number;
  totalDurationMs: number;
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
}

export interface ExtractRulesProgress {
  chunkIndex: number;
  totalChunks: number;
  setsCreated: number; // cumulative across chunks
  rulesCreated: number; // cumulative across chunks
}

export interface ExtractRulesResult {
  guideId: string;
  totalChunks: number;
  totalChars: number;
  setsCreated: number; // cumulative
  rulesCreated: number; // cumulative
  errors: string[]; // cumulative
  totalAiDurationMs: number;
  totalWallClockMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  conditionsCovered: string[];
}

interface ExtractRulesArgs {
  guideId: string;
  productId?: string | null;
  /** Called after each chunk completes so the UI can render progress. */
  onProgress?: (progress: ExtractRulesProgress) => void;
}

/**
 * Trigger AI extraction across the FULL guide via chunked invocations.
 * Loops one Claude call at a time (each ~25-45s, well under Supabase's 150s
 * timeout). Passes knownConditions forward each call so we don't duplicate
 * rule_sets across chunks. Stops when hasMore=false.
 */
export function useExtractRules() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation<ExtractRulesResult, Error, ExtractRulesArgs>({
    mutationFn: async ({ guideId, productId, onProgress }) => {
      const start = Date.now();
      let offset = 0;
      const knownConditions = new Set<string>();
      let totalSets = 0;
      let totalRules = 0;
      let totalAi = 0;
      let totalIn = 0;
      let totalOut = 0;
      const allErrors: string[] = [];
      let lastChunkResp: ExtractChunkResponse | null = null;
      let safety = 0;

      while (true) {
        if (++safety > 100) {
          throw new Error(
            "Extraction loop exceeded 100 chunks — aborting (likely runaway)",
          );
        }

        const { data, error } =
          await supabase.functions.invoke<ExtractChunkResponse>(
            "extract-underwriting-rules",
            {
              body: {
                guideId,
                productId: productId ?? null,
                chunkOffset: offset,
                knownConditions: Array.from(knownConditions),
              },
            },
          );

        if (error) {
          throw new Error(`Chunk at offset ${offset} failed: ${error.message}`);
        }
        if (!data?.success) {
          throw new Error(
            `Chunk at offset ${offset} failed: ${data?.error ?? "unknown"}`,
          );
        }

        lastChunkResp = data;
        totalSets += data.setsCreated;
        totalRules += data.rulesCreated;
        totalAi += data.aiDurationMs;
        if (data.usage) {
          totalIn += data.usage.inputTokens;
          totalOut += data.usage.outputTokens;
        }
        if (data.errors?.length) allErrors.push(...data.errors);
        for (const code of data.conditionsExtracted) {
          knownConditions.add(code);
        }

        onProgress?.({
          chunkIndex: data.chunkIndex,
          totalChunks: data.totalChunks,
          setsCreated: totalSets,
          rulesCreated: totalRules,
        });

        // Refresh the review list mid-loop so the user sees candidates
        // appear as each chunk completes — feels more alive than waiting.
        queryClient.invalidateQueries({
          queryKey: guideRulesKeys.byGuide(imoId, guideId),
        });

        if (!data.hasMore) break;
        offset = data.nextOffset;
      }

      return {
        guideId,
        totalChunks: lastChunkResp?.totalChunks ?? 1,
        totalChars: lastChunkResp?.totalChars ?? 0,
        setsCreated: totalSets,
        rulesCreated: totalRules,
        errors: allErrors,
        totalAiDurationMs: totalAi,
        totalWallClockMs: Date.now() - start,
        totalInputTokens: totalIn,
        totalOutputTokens: totalOut,
        conditionsCovered: Array.from(knownConditions),
      };
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
