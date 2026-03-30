import type { LeadHeatAiInsightsResult } from "../types/close-kpi.types";

const CLOSED_WON_STATUS_PATTERNS = [
  "sold",
  "won",
  "policy pending",
  "policy issued",
  "issued",
  "bound",
  "in force",
  "active policy",
];

export function isClosedWonLeadHeatStatusLabel(
  statusLabel: string | null | undefined,
): boolean {
  if (!statusLabel) return false;

  const normalized = statusLabel.trim().toLowerCase();
  return CLOSED_WON_STATUS_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}

export function isRankableLeadHeatSignals(
  signals: Record<string, unknown> | null | undefined,
): boolean {
  if (!signals) return true;

  const hasWonOpportunity = signals.hasWonOpportunity === true;
  const currentStatusLabel =
    typeof signals.currentStatusLabel === "string"
      ? signals.currentStatusLabel
      : null;

  return (
    !hasWonOpportunity && !isClosedWonLeadHeatStatusLabel(currentStatusLabel)
  );
}

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
}

export function mapLeadHeatAiInsightsRow(
  analysis: LeadHeatPortfolioAnalysisRow | null,
  weightsRow: LeadHeatWeightsRow | null,
): LeadHeatAiInsightsResult {
  const analysisPayload =
    analysis?.analysis && typeof analysis.analysis === "object"
      ? analysis.analysis
      : null;

  return {
    recommendations: (analysis?.recommendations ?? []) as {
      text: string;
      priority: "high" | "medium" | "low";
    }[],
    anomalies: (analysis?.anomalies ?? []) as {
      closeLeadId: string;
      displayName: string;
      type: string;
      message: string;
      urgency: string;
      score: number;
    }[],
    patterns: ((analysisPayload?.insights as unknown[]) ?? []) as {
      title: string;
      description: string;
    }[],
    weightAdjustments: (analysis?.weight_adjustments ?? []) as {
      signalKey: string;
      recommendedMultiplier: number;
      reason: string;
    }[],
    modelVersion: weightsRow?.version ?? 1,
    sampleSize: weightsRow?.sample_size ?? 0,
    analyzedAt: analysis?.analyzed_at ?? null,
    overallAssessment:
      (typeof analysisPayload?.overall === "string"
        ? analysisPayload.overall
        : "") ?? "",
  };
}
