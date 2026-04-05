import type { LeadHeatAiInsightsResult } from "../types/close-kpi.types";

// EXCLUDED_STATUS_PATTERNS: kept in sync with server-side patterns in
// supabase/functions/close-lead-heat-score/index.ts EXCLUDED_STATUS_PATTERNS,
// the Supabase query filters in closeKpiService.ts getLeadHeatList,
// and supabase/functions/close-ai-smart-view/index.ts syncSmartViewForUser.
// Any lead with an agent-assigned status is excluded — only untouched/initial
// leads (e.g. "Potential") should appear in the AI Top 100 Hot Leads.
const EXCLUDED_STATUS_PATTERNS = [
  // Closed-won / post-sale
  "sold",
  "won",
  "policy pending",
  "policy issued",
  "issued and paid",
  "bound",
  "in force",
  "active policy",
  // Appointment-stage
  "appointment",
  // Terminal / disqualified
  "not interested",
  "do not contact",
  "dnc",
  "disqualified",
  "declined",
  // Contacted / worked
  "contacted",
  "spoke",
  "texting",
  "call back",
  "callback",
  // Negative contact outcomes
  "voicemail",
  "no answer",
  "straight to vm",
  "hung up",
  "bad number",
  "wrong number",
  "doesn't ring",
  "doesnt ring",
  "blocked",
  "not in service",
  // Dead / lost
  "dead",
  "lost",
  "no show",
  // Progressed past initial stage
  "quoted",
  "application",
  "underwriting",
];

export function isExcludedLeadHeatStatusLabel(
  statusLabel: string | null | undefined,
): boolean {
  if (!statusLabel) return false;

  const normalized = statusLabel.trim().toLowerCase();
  return EXCLUDED_STATUS_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}

/** @deprecated Use isExcludedLeadHeatStatusLabel */
export const isClosedWonLeadHeatStatusLabel = isExcludedLeadHeatStatusLabel;

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
    !hasWonOpportunity && !isExcludedLeadHeatStatusLabel(currentStatusLabel)
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
    modelVersion: weightsRow?.version ?? 1,
    sampleSize: weightsRow?.sample_size ?? 0,
    analyzedAt: analysis?.analyzed_at ?? null,
    overallAssessment:
      (typeof analysisPayload?.overall === "string"
        ? analysisPayload.overall
        : "") ?? "",
  };
}
