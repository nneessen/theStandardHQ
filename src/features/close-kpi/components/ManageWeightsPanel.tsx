// src/features/close-kpi/components/ManageWeightsPanel.tsx
// Inline expandable panel for managing lead-heat scoring signal weights.
// Used by both AiHeroSection (the prebuilt Close KPI page) and the legacy
// LeadHeatAiInsightsWidget (custom dashboards). Extracted into a shared
// component so the slider/draft state machine and apply mutation flow exist
// in exactly one place — duplicating ~150 lines of state across two render
// surfaces would drift quickly.

import React from "react";
import { Sliders, ChevronDown, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LeadHeatAiInsightsResult } from "../types/close-kpi.types";
import { useApplyLeadHeatWeights } from "../hooks/useCloseKpiDashboard";
import { MAX_POINTS } from "../lib/scoring-math";

// Friendly labels for the 15 signals — keeps the slider panel readable
// without the user needing to know the camelCase signal keys from
// scoring-math.ts.
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

interface ManageWeightsPanelProps {
  data: LeadHeatAiInsightsResult;
  /**
   * Visual variant. "compact" suits the legacy widget (small text, minimal
   * borders); "hero" suits AiHeroSection (slightly more breathing room and
   * a violet accent that matches the surrounding hero card). Both render
   * identical functional UI — only spacing/colors differ.
   */
  variant?: "compact" | "hero";
}

export const ManageWeightsPanel: React.FC<ManageWeightsPanelProps> = ({
  data,
  variant = "compact",
}) => {
  const applyWeights = useApplyLeadHeatWeights();
  const { weightAdjustments, currentWeights } = data;

  // Map signalKey → AI recommended multiplier for fast lookup
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

  // Reset draft whenever fresh data arrives (e.g. after Save invalidates the
  // query and the new currentWeights come back). Without this, sliders
  // would still show the user's old draft after a successful save, looking
  // like nothing happened.
  React.useEffect(() => {
    setDraft(new Map());
  }, [currentWeights]);

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

  const isHero = variant === "hero";

  return (
    <div
      className={
        isHero
          ? "border-t border-violet-200/40 dark:border-violet-800/40 pt-2 mt-2"
          : "border-t border-border/30 pt-1.5"
      }
    >
      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        className={
          isHero
            ? "flex w-full items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
            : "flex w-full items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground hover:text-foreground transition-colors"
        }
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
          <div
            className={
              isHero
                ? "rounded border border-violet-200/40 dark:border-violet-800/30 bg-violet-50/20 dark:bg-violet-950/10 p-1.5 max-h-[280px] overflow-y-auto overscroll-contain"
                : "rounded border border-border/50 bg-muted/5 p-1.5 max-h-[260px] overflow-y-auto overscroll-contain"
            }
          >
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
                  {/* Label + AI badge */}
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
  );
};
