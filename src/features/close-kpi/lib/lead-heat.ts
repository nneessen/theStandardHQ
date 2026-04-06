import type { LeadHeatAiInsightsResult } from "../types/close-kpi.types";

// Lead heat status filtering is now handled DB-side via the
// `lead_heat_status_config` table (per-user, status_id-based). The previous
// label-substring helpers were removed because:
//   1. They duplicated patterns across 5 files (drift-prone)
//   2. They couldn't keep up with multi-tenant custom status names
//   3. Filtering by mutable label strings broke when users renamed statuses
//
// See supabase/functions/close-lead-heat-score/status-classification.ts for
// the canonical heuristic that auto-populates lead_heat_status_config.

interface LeadHeatPortfolioAnalysisRow {
  analysis?: Record<string, unknown> | null;
  anomalies?: unknown[] | null;
  recommendations?: unknown[] | null;
  weight_adjustments?: unknown[] | null;
  analyzed_at?: string | null;
}

interface LeadHeatWeightsRow {
  version?: number | null;
  sample_size?: number | null;
  weights?: Record<string, { multiplier?: unknown }> | null;
}

export function mapLeadHeatAiInsightsRow(
  analysis: LeadHeatPortfolioAnalysisRow | null,
  weightsRow: LeadHeatWeightsRow | null,
): LeadHeatAiInsightsResult {
  // Defensively normalize the weights JSON. The DB column is JSONB and could
  // contain anything if a future migration changes the shape — coerce each
  // entry to { multiplier: number } and drop anything that doesn't fit.
  const currentWeights: Record<string, { multiplier: number }> = {};
  if (weightsRow?.weights && typeof weightsRow.weights === "object") {
    for (const [key, value] of Object.entries(weightsRow.weights)) {
      const m = value?.multiplier;
      if (typeof m === "number" && Number.isFinite(m)) {
        currentWeights[key] = { multiplier: m };
      }
    }
  }

  const analysisPayload =
    analysis?.analysis && typeof analysis.analysis === "object"
      ? analysis.analysis
      : null;

  // Defensively validate AI response shapes — LLM output is untrusted
  const VALID_PRIORITIES = new Set(["high", "medium", "low"]);

  return {
    recommendations: ((analysis?.recommendations ?? []) as unknown[])
      .filter(
        (r): r is Record<string, unknown> => r != null && typeof r === "object",
      )
      .map((r) => ({
        text: typeof r.text === "string" ? r.text : "",
        priority: (VALID_PRIORITIES.has(r.priority as string)
          ? r.priority
          : "low") as "high" | "medium" | "low",
      })),
    anomalies: ((analysis?.anomalies ?? []) as unknown[])
      .filter(
        (a): a is Record<string, unknown> => a != null && typeof a === "object",
      )
      .map((a) => ({
        closeLeadId: typeof a.closeLeadId === "string" ? a.closeLeadId : "",
        displayName:
          typeof a.displayName === "string" ? a.displayName : "Unknown",
        type: typeof a.type === "string" ? a.type : "unknown",
        message: typeof a.message === "string" ? a.message : "",
        urgency: typeof a.urgency === "string" ? a.urgency : "low",
        score: typeof a.score === "number" ? a.score : 0,
      })),
    patterns: ((analysisPayload?.insights as unknown[]) ?? [])
      .filter(
        (p): p is Record<string, unknown> => p != null && typeof p === "object",
      )
      .map((p) => ({
        title: typeof p.title === "string" ? p.title : "",
        description: typeof p.description === "string" ? p.description : "",
      })),
    weightAdjustments: ((analysis?.weight_adjustments ?? []) as unknown[])
      .filter(
        (w): w is Record<string, unknown> => w != null && typeof w === "object",
      )
      .map((w) => ({
        signalKey: typeof w.signalKey === "string" ? w.signalKey : "",
        recommendedMultiplier:
          typeof w.recommendedMultiplier === "number"
            ? w.recommendedMultiplier
            : 1.0,
        reason: typeof w.reason === "string" ? w.reason : "",
      })),
    currentWeights,
    modelVersion: weightsRow?.version ?? 1,
    sampleSize: weightsRow?.sample_size ?? 0,
    analyzedAt: analysis?.analyzed_at ?? null,
    overallAssessment:
      (typeof analysisPayload?.overall === "string"
        ? analysisPayload.overall
        : "") ?? "",
  };
}
