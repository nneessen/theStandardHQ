// src/features/underwriting/hooks/useUnderwritingAnalysis.ts

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import type {
  AIAnalysisRequest,
  AIAnalysisResult,
  CriteriaFilterResult,
  CriteriaFilteredProduct,
  CriteriaEvaluationResult,
  UWWizardUsageSummary,
} from "../../types/underwriting.types";

export class UWAnalysisError extends Error {
  constructor(
    message: string,
    public code: string | null,
    public status: number | null,
    public runsRemaining: number | null = null,
    public tierId: string | null = null,
  ) {
    super(message);
    this.name = "UWAnalysisError";
  }
}

async function analyzeClient(
  request: AIAnalysisRequest,
): Promise<AIAnalysisResult> {
  const startTime = Date.now();

  const { data, error } = await supabase.functions.invoke(
    "underwriting-ai-analyze",
    {
      body: request,
    },
  );

  if (error) {
    console.error("Underwriting analysis failed:", error);

    let status: number | null = null;
    let body: Record<string, unknown> | null = null;

    try {
      const ctx = (error as { context?: Response }).context;
      status = ctx?.status ?? null;
      if (ctx && typeof ctx.json === "function") {
        body = await ctx.json();
      }
    } catch {
      // body already consumed or not JSON
    }

    const code = (body?.code as string) ?? null;
    const msg = (body?.error as string) ?? error.message ?? "Analysis failed";
    const runsRemaining = (body?.runs_remaining as number) ?? null;
    const tierId = (body?.tier_id as string) ?? null;

    throw new UWAnalysisError(msg, code, status, runsRemaining, tierId);
  }

  if (!data || !data.success) {
    const code = (data?.code as string) ?? null;
    throw new UWAnalysisError(
      data?.error || "Analysis failed. Please check your inputs and try again.",
      code,
      null,
    );
  }

  // Phase 5: Map criteria filters if present
  let criteriaFilters: CriteriaFilterResult | undefined;
  if (data.criteriaFilters) {
    // Map filtered products using typed interface
    const mappedFilteredProducts: CriteriaFilteredProduct[] = (
      data.criteriaFilters.filteredByCarrier ?? []
    ).map((fp: CriteriaFilteredProduct) => ({
      carrierId: fp.carrierId,
      carrierName: fp.carrierName,
      productId: fp.productId,
      productName: fp.productName,
      rule: fp.rule,
      reason: fp.reason,
    }));

    // Map evaluation results using typed interface
    const mappedEvaluationResults:
      | Record<string, CriteriaEvaluationResult>
      | undefined = data.criteriaFilters.evaluationResults;

    criteriaFilters = {
      applied: data.criteriaFilters.applied ?? false,
      matchedCarriers: data.criteriaFilters.matchedCarriers ?? [],
      filteredByCarrier: mappedFilteredProducts,
      evaluationResults: mappedEvaluationResults,
    };
  }

  const result: AIAnalysisResult = {
    healthTier: data.analysis.health_tier,
    riskFactors: data.analysis.risk_factors || [],
    recommendations: (data.analysis.recommendations || []).map(
      (rec: {
        carrier_id: string;
        carrier_name: string;
        product_id: string;
        product_name: string;
        expected_rating: string;
        confidence: number;
        key_factors: string[];
        concerns: string[];
        priority: number;
        notes?: string;
        guide_references?: string[];
      }) => ({
        carrierId: rec.carrier_id,
        carrierName: rec.carrier_name,
        productId: rec.product_id,
        productName: rec.product_name,
        expectedRating: rec.expected_rating,
        confidence: rec.confidence,
        keyFactors: rec.key_factors || [],
        concerns: rec.concerns || [],
        priority: rec.priority,
        notes: rec.notes,
        guideReferences: rec.guide_references || [],
      }),
    ),
    reasoning: data.analysis.reasoning || "",
    processingTimeMs: Date.now() - startTime,
    criteriaFilters, // Phase 5: Include criteria filters
    usage: (data.usage as UWWizardUsageSummary | null | undefined) ?? null,
    usageRecorded:
      (data.usageRecorded as boolean | undefined) ?? Boolean(data.usage),
  };

  return result;
}

/**
 * Hook to analyze a client using the AI underwriting system
 */
export function useUnderwritingAnalysis() {
  return useMutation<AIAnalysisResult, UWAnalysisError, AIAnalysisRequest>({
    mutationFn: analyzeClient,
    onError: (error) => {
      console.error("Underwriting analysis error:", error);
    },
  });
}
