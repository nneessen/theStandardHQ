// src/features/close-kpi/components/widgets/LeadHeatAiInsightsWidget.tsx
// AI-powered insights panel: recommendations, anomalies, patterns, personalization progress.

import React from "react";
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Target,
  RefreshCw,
  Loader2,
  Sliders,
  ChevronDown,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LeadHeatAiInsightsResult } from "../../types/close-kpi.types";
import {
  useLeadHeatRescore,
  useApplyLeadHeatWeights,
} from "../../hooks/useCloseKpiDashboard";
import { formatTimeAgo } from "../../lib/format-time";
import { MAX_POINTS } from "../../lib/scoring-math";

interface LeadHeatAiInsightsWidgetProps {
  data: LeadHeatAiInsightsResult;
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20",
  medium:
    "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20",
  low: "border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-800/20",
};

const URGENCY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-zinc-400",
};

// Friendly labels for the 15 signals — keeps the slider panel readable without
// the user needing to know the camelCase signal keys from scoring-math.ts.
const SIGNAL_LABELS: Record<string, string> = {
  callAnswerRate: "Call Answer Rate",
  emailReplyRate: "Email Reply Rate",
  smsResponseRate: "SMS Response Rate",
  engagementRecency: "Engagement Recency",
  inboundCalls: "Inbound Calls",
  quoteRequested: "Quote Requested",
  emailEngagement: "Email Engagement",
  appointment: "Appointment",
  leadAge: "Lead Age",
  timeSinceTouch: "Time Since Touch",
  timeInStatus: "Time in Status",
  statusVelocity: "Status Velocity",
  hasOpportunity: "Has Opportunity",
  opportunityValue: "Opportunity Value",
  sourceQuality: "Source Quality",
};

const ALL_SIGNAL_KEYS = Object.keys(MAX_POINTS);

function clampMultiplier(value: number): number {
  if (!Number.isFinite(value)) return 1.0;
  return Math.max(0.3, Math.min(2.0, Math.round(value * 100) / 100));
}

export const LeadHeatAiInsightsWidget: React.FC<
  LeadHeatAiInsightsWidgetProps
> = ({ data }) => {
  const leadHeatRescore = useLeadHeatRescore();
  const applyWeights = useApplyLeadHeatWeights();
  const {
    recommendations,
    anomalies,
    overallAssessment,
    analyzedAt,
    weightAdjustments,
    currentWeights,
  } = data;

  // Map signalKey → AI recommended multiplier for fast lookup in the panel
  const aiRecMap = React.useMemo(() => {
    const m = new Map<string, { multiplier: number; reason: string }>();
    for (const wa of weightAdjustments) {
      if (wa.signalKey) {
        m.set(wa.signalKey, {
          multiplier: wa.recommendedMultiplier,
          reason: wa.reason,
        });
      }
    }
    return m;
  }, [weightAdjustments]);

  const [panelOpen, setPanelOpen] = React.useState(false);
  // Local draft state for slider edits — only flushed to the server on Save.
  // Empty Map = no pending edits. Keys are signal names, values are the
  // multiplier the user is currently dragging to.
  const [draft, setDraft] = React.useState<Map<string, number>>(new Map());

  // Reset draft whenever the widget receives fresh data (e.g. after Save
  // invalidates the query and the new currentWeights come back). Without
  // this, sliders would still show the user's old draft after a successful
  // save, looking like nothing happened.
  React.useEffect(() => {
    setDraft(new Map());
  }, [currentWeights]);

  const handleRescore = async () => {
    try {
      await leadHeatRescore.mutateAsync();
    } catch {
      // Widget will show updated data on next query refetch
    }
  };

  /** Apply a single weight (used by AI rec inline buttons) */
  const handleApplySingle = async (signalKey: string, multiplier: number) => {
    try {
      await applyWeights.mutateAsync({
        [signalKey]: { multiplier: clampMultiplier(multiplier) },
      });
    } catch {
      // toast already shown by hook onError
    }
  };

  /** Save all manual draft slider edits in one batch */
  const handleSaveDraft = async () => {
    if (draft.size === 0) return;
    const partial: Record<string, { multiplier: number }> = {};
    for (const [key, mult] of draft) {
      partial[key] = { multiplier: clampMultiplier(mult) };
    }
    try {
      await applyWeights.mutateAsync(partial);
      setDraft(new Map());
    } catch {
      // toast already shown by hook onError
    }
  };

  const getCurrentMultiplier = (signalKey: string): number => {
    return currentWeights[signalKey]?.multiplier ?? 1.0;
  };

  const getDisplayMultiplier = (signalKey: string): number => {
    return draft.get(signalKey) ?? getCurrentMultiplier(signalKey);
  };

  const hasData =
    recommendations.length > 0 || anomalies.length > 0 || overallAssessment;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <Brain className="h-6 w-6 text-muted-foreground/40" />
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">
            AI insights not yet available
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            Score your leads first, then AI will analyze patterns automatically
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] gap-1 mt-1"
          onClick={handleRescore}
          disabled={leadHeatRescore.isPending}
        >
          {leadHeatRescore.isPending ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
          ) : (
            <RefreshCw className="h-2.5 w-2.5" />
          )}
          {leadHeatRescore.isPending ? "Scoring..." : "Score Leads"}
        </Button>
        <span className="text-[9px] text-muted-foreground/60 mt-1">
          Score your leads to see AI-generated insights
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Overall Assessment */}
      {overallAssessment && (
        <div className="flex items-start gap-2 rounded border border-primary/20 bg-primary/5 px-2 py-1.5">
          <Brain className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
          <p className="text-[11px] text-foreground leading-relaxed">
            {overallAssessment}
          </p>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
            <Lightbulb className="h-3 w-3" />
            Recommendations
          </div>
          {recommendations.slice(0, 5).map((rec, i) => (
            <div
              key={i}
              className={`rounded border px-2 py-1 text-[11px] ${PRIORITY_STYLES[rec.priority] ?? PRIORITY_STYLES.low}`}
            >
              <div className="flex items-start gap-1.5">
                <Target className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <span className="text-foreground">{rec.text}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            Anomalies
          </div>
          {anomalies.map((anomaly, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded border border-border/50 bg-muted/10 px-2 py-1 text-[11px]"
            >
              <span
                className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${URGENCY_DOT[anomaly.urgency] ?? URGENCY_DOT.low}`}
              />
              <div>
                <span className="font-medium text-foreground">
                  {anomaly.displayName}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  — {anomaly.message}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manage Weights — inline expandable panel */}
      <div className="border-t border-border/30 pt-1.5">
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="flex w-full items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground hover:text-foreground transition-colors"
        >
          <Sliders className="h-3 w-3" />
          <span>Manage Signal Weights</span>
          {aiRecMap.size > 0 && (
            <span className="rounded-sm bg-violet-500/20 px-1 text-[9px] font-bold text-violet-600 dark:text-violet-400">
              {aiRecMap.size} AI suggestion{aiRecMap.size === 1 ? "" : "s"}
            </span>
          )}
          <ChevronDown
            className={`ml-auto h-3 w-3 transition-transform ${panelOpen ? "rotate-180" : ""}`}
          />
        </button>

        {panelOpen && (
          <div className="mt-1.5 space-y-1">
            {/* Signal table */}
            <div className="rounded border border-border/50 bg-muted/5 p-1.5 max-h-[260px] overflow-y-auto overscroll-contain">
              {ALL_SIGNAL_KEYS.map((signalKey) => {
                const current = getCurrentMultiplier(signalKey);
                const displayValue = getDisplayMultiplier(signalKey);
                const aiRec = aiRecMap.get(signalKey);
                const hasDraftEdit = draft.has(signalKey);
                const isUnderweight = displayValue < 0.95;
                const isOverweight = displayValue > 1.05;

                return (
                  <div
                    key={signalKey}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-1.5 py-0.5 border-b border-border/20 last:border-0"
                  >
                    {/* Label + AI reason on hover */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span
                          className="text-[10px] text-foreground truncate"
                          title={
                            aiRec?.reason
                              ? `AI: ${aiRec.reason}`
                              : (SIGNAL_LABELS[signalKey] ?? signalKey)
                          }
                        >
                          {SIGNAL_LABELS[signalKey] ?? signalKey}
                        </span>
                        {aiRec && (
                          <span
                            className="rounded-sm bg-violet-500/15 px-1 text-[9px] font-semibold text-violet-600 dark:text-violet-400"
                            title={aiRec.reason}
                          >
                            AI {aiRec.multiplier.toFixed(2)}x
                          </span>
                        )}
                      </div>
                      {/* Slider — drives draft state */}
                      <input
                        type="range"
                        min="0.3"
                        max="2.0"
                        step="0.05"
                        value={displayValue}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setDraft((prev) => {
                            const next = new Map(prev);
                            // If user drags back to current value, clear the
                            // draft so the diff stays minimal on Save.
                            if (Math.abs(v - current) < 0.001) {
                              next.delete(signalKey);
                            } else {
                              next.set(signalKey, v);
                            }
                            return next;
                          });
                        }}
                        className="w-full h-1 mt-0.5 accent-violet-500"
                        disabled={applyWeights.isPending}
                      />
                    </div>

                    {/* Current/draft multiplier readout */}
                    <span
                      className={`text-[10px] font-mono tabular-nums w-9 text-right ${
                        hasDraftEdit
                          ? "text-violet-600 dark:text-violet-400 font-semibold"
                          : isUnderweight
                            ? "text-amber-600 dark:text-amber-400"
                            : isOverweight
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                      }`}
                    >
                      {displayValue.toFixed(2)}x
                    </span>

                    {/* Apply AI rec button (only if AI suggested AND not
                        already at the suggested value AND no pending draft
                        edit conflicts) */}
                    {aiRec &&
                    Math.abs(current - aiRec.multiplier) > 0.001 &&
                    !hasDraftEdit ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-5 px-1.5 text-[9px] font-semibold gap-0.5 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                        onClick={() =>
                          handleApplySingle(signalKey, aiRec.multiplier)
                        }
                        disabled={applyWeights.isPending}
                      >
                        Apply
                      </Button>
                    ) : (
                      <span className="w-12" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Save / cancel draft controls */}
            {draft.size > 0 && (
              <div className="flex items-center justify-between gap-2 px-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {draft.size} unsaved change
                  {draft.size === 1 ? "" : "s"}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setDraft(new Map())}
                    disabled={applyWeights.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1 bg-violet-600 hover:bg-violet-700 text-white"
                    onClick={handleSaveDraft}
                    disabled={applyWeights.isPending}
                  >
                    {applyWeights.isPending ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <Check className="h-2.5 w-2.5" />
                    )}
                    Save & rescore
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI status footer */}
      <div className="mt-auto flex items-center gap-3 border-t border-border/30 pt-1.5">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            AI-assisted &middot; weights v{data.modelVersion}
          </span>
        </div>
        {analyzedAt && (
          <span className="text-[9px] text-muted-foreground/50 ml-auto">
            {formatTimeAgo(analyzedAt)}
          </span>
        )}
      </div>
    </div>
  );
};
