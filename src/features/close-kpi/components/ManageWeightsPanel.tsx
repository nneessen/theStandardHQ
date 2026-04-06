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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
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

// Plain-English help content for each scoring signal. Designed for users
// who don't know what "multiplier" or "weight" means — every entry tells
// them what the signal LOOKS AT in their CRM and what dragging the slider
// LEFT or RIGHT will actually DO to their lead list.
//
// Source of truth: src/features/close-kpi/lib/scoring-math.ts
//
// Style rules: no jargon, no point-cap numbers, no percentages. Talk about
// leads and behaviors, not signals and ratios.
interface SignalInfo {
  /** One-sentence description of what data this signal looks at */
  measures: string;
  /** What happens to the lead ranking if user drags the slider RIGHT */
  slideRight: string;
  /** What happens if user drags the slider LEFT */
  slideLeft: string;
  /** Optional: when/why a typical user would adjust this */
  whenToTune?: string;
}

const SIGNAL_INFO: Record<string, SignalInfo> = {
  callAnswerRate: {
    measures:
      "How often a lead actually answers when you call them. Reachable leads vs. ones that never pick up.",
    slideRight:
      "Leads who answer your calls will rank higher in your Hot 100. Good if dialing reachable people is your bread and butter.",
    slideLeft:
      "Hard-to-reach leads won't be penalized as much. Good if you're patient with leaving voicemails and trying again later.",
    whenToTune:
      "Lean right if you live on the dialer. Lean left if you do mostly email/SMS.",
  },
  emailReplyRate: {
    measures:
      "How often a lead writes back when you email them. Strong sign they're paying attention and interested.",
    slideRight:
      "Leads who reply to your emails will jump up the rankings. People who write back are usually closer to buying.",
    slideLeft:
      "Email replies will count for less. Useful if you barely use email and don't want to be misled by a one-off reply.",
    whenToTune:
      "Lean right if email is part of your sales flow. Most agents should be at 1.0x or higher.",
  },
  smsResponseRate: {
    measures:
      "How often a lead replies when you text them. Texts get read fast, so a response is a strong intent signal.",
    slideRight:
      "Leads who text you back will rank higher. Best if you actually run SMS sequences.",
    slideLeft:
      "SMS replies won't move the needle. Set this near 0.3x if you don't text leads at all.",
  },
  engagementRecency: {
    measures:
      "How recently the lead did anything — opened an email, took a call, sent a text, anything.",
    slideRight:
      "Leads who interacted in the last few hours or days will dominate your Hot 100. Classic 'speed wins' approach.",
    slideLeft:
      "You don't mind working leads that have been quiet for a while. Useful if you nurture slowly.",
    whenToTune:
      "Lean right hard if 'speed to lead' is your edge. Most insurance agents benefit from 1.2x – 1.5x.",
  },
  inboundCalls: {
    measures:
      "How many times the LEAD called YOU. In insurance, when someone calls in, they're usually ready to buy.",
    slideRight:
      "Leads who've called you will absolutely dominate the top of your list. This is the strongest buying signal that exists.",
    slideLeft:
      "Inbound calls will count for less. Almost never the right move — these are your hottest leads.",
    whenToTune:
      "DON'T decrease this. If anything, lean right. Already weighted high by default.",
  },
  quoteRequested: {
    measures:
      "Whether the lead has reached a 'Quoted' status or moved forward through your pipeline statuses positively.",
    slideRight:
      "Leads who've been quoted or who are progressing through your pipeline will rank higher. Late-stage focus.",
    slideLeft:
      "Quote stage matters less. Useful if your 'quoted' status in Close gets set automatically and isn't reliable.",
  },
  emailEngagement: {
    measures:
      "How many emails the lead has received from you (whether or not they replied). Tracks who's in your email rotation.",
    slideRight:
      "Leads in your active email cadence will rank higher. Useful if you believe email volume keeps leads warm.",
    slideLeft:
      "Just being in an email sequence won't help a lead's score. Useful if you blast emails and don't want false positives.",
  },
  appointment: {
    measures:
      "Whether the lead has a scheduled callback or appointment booked.",
    slideRight:
      "Leads with appointments on the books will rank higher. Good if you have tight booking discipline.",
    slideLeft:
      "Appointments won't matter much. Useful if your 'callback' status gets set sloppily and rarely converts.",
  },
  leadAge: {
    measures:
      "How long ago the lead was created in Close. Fresh leads vs. aged inventory.",
    slideRight:
      "Brand-new leads will dominate your Hot 100. Best if you're a 'first call wins' agent.",
    slideLeft:
      "Older leads stop being penalized as much. ESSENTIAL if you work aged leads (like aged GOAT Mortgage) — otherwise the system will tell you to ignore your entire book.",
    whenToTune:
      "If you buy aged leads, slide LEFT (try 0.5x). If you buy fresh leads, slide RIGHT.",
  },
  timeSinceTouch: {
    measures:
      "How many days since YOU last contacted the lead. Tracks whether you're staying on top of your pipeline.",
    slideRight:
      "Leads you've recently touched will rank higher. Rewards staying engaged with your pipeline.",
    slideLeft:
      "Leads you haven't touched in a while will still rank high — useful if you want the system to surface forgotten leads for follow-up.",
  },
  timeInStatus: {
    measures:
      "How long the lead has been stuck in their current status. Long time stuck = bad sign.",
    slideRight:
      "Leads moving quickly through your pipeline will rank higher. Rewards momentum.",
    slideLeft:
      "Stuck leads won't be penalized as harshly. Useful if your sales cycle is naturally slow.",
  },
  statusVelocity: {
    measures:
      "Whether the lead has been moving FORWARD in your pipeline (positive status changes) or backward over the last month.",
    slideRight:
      "Leads gaining momentum (status improving) will rank higher. Best when your status structure is clean.",
    slideLeft:
      "Status changes won't matter much. Useful if your statuses are noisy and don't reflect real progress.",
  },
  hasOpportunity: {
    measures:
      "Whether you've created an Opportunity record in Close for this lead — meaning you actually expect to make money off them.",
    slideRight:
      "Leads with opportunities will rank highest. Best if your team is disciplined about creating opps.",
    slideLeft:
      "Opportunity records won't matter. Useful if you don't use the Opportunities feature in Close at all.",
  },
  opportunityValue: {
    measures: "The dollar value on the opportunity record. Tracks deal size.",
    slideRight:
      "Big-deal leads will dominate your Hot 100 — even if they're slower to close. Good for high-value-only focus.",
    slideLeft:
      "Treats all opportunities as equal regardless of size. Good if your products are similarly priced.",
  },
  sourceQuality: {
    measures:
      "How well the lead's source (the lead list it came from) has historically converted for you.",
    slideRight:
      "Leads from your best-performing sources (e.g., GOAT Aged Mortgage if it converts well) will rank higher. Rewards proven lead sources.",
    slideLeft:
      "Historical source performance won't matter. Useful if you've recently switched lead sources and old data is stale.",
    whenToTune:
      "Now that retired sources are filtered out (April 2026 fix), this should reliably reward your active winners. Default 1.0x is fine for most.",
  },
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
  // Defensive defaults — older cached query data may not have these fields
  // populated yet (the type was added after the cache was warmed). Without
  // the defaults, currentWeights[signalKey] would crash on first render.
  const weightAdjustments = data.weightAdjustments ?? [];
  const currentWeights = data.currentWeights ?? {};

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
    <TooltipProvider delayDuration={200}>
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
            {/* Help banner — written for non-technical users. No jargon. */}
            <div className="rounded border border-violet-200/40 dark:border-violet-800/30 bg-violet-50/30 dark:bg-violet-950/20 px-2 py-1.5 text-[10px] text-foreground/80 leading-relaxed">
              <span className="font-semibold text-violet-700 dark:text-violet-300">
                How this works:
              </span>{" "}
              Each row below is a behavior the system uses to decide which of
              your leads are hot. <strong>Drag a slider RIGHT</strong> to make
              that behavior matter MORE in the ranking.{" "}
              <strong>Drag LEFT</strong> to make it matter less.{" "}
              <span className="text-violet-700 dark:text-violet-300 font-medium">
                Hover any signal name for a full explanation
              </span>{" "}
              of what it does and when to adjust it. Click <em>Save</em> when
              you&apos;re done — your Hot 100 list will reshuffle with the new
              settings within about a minute.
            </div>

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
                    {/* Label + AI badge — wrapped in a Tooltip so non-technical
                      users can hover to see what the signal actually does
                      and what dragging the slider will accomplish. */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger asChild>
                            <span className="text-[10px] text-foreground truncate cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
                              {SIGNAL_LABELS[signalKey] ?? signalKey}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side="left"
                            className="max-w-[320px] p-0 overflow-hidden"
                          >
                            {(() => {
                              const info = SIGNAL_INFO[signalKey];
                              if (!info) {
                                return (
                                  <div className="px-3 py-2 text-[11px]">
                                    {SIGNAL_LABELS[signalKey] ?? signalKey}
                                  </div>
                                );
                              }
                              return (
                                <div className="text-[11px] leading-snug">
                                  {/* Header */}
                                  <div className="px-3 py-2 bg-violet-50 dark:bg-violet-950/40 border-b border-border/50">
                                    <div className="font-bold text-foreground">
                                      {SIGNAL_LABELS[signalKey] ?? signalKey}
                                    </div>
                                    <div className="text-muted-foreground mt-0.5 text-[10px]">
                                      {info.measures}
                                    </div>
                                  </div>
                                  {/* Slide directions */}
                                  <div className="px-3 py-2 space-y-1.5">
                                    <div>
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        → Slide RIGHT:
                                      </span>{" "}
                                      <span className="text-foreground">
                                        {info.slideRight}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="font-bold text-amber-600 dark:text-amber-400">
                                        ← Slide LEFT:
                                      </span>{" "}
                                      <span className="text-foreground">
                                        {info.slideLeft}
                                      </span>
                                    </div>
                                    {info.whenToTune && (
                                      <div className="pt-1 mt-1 border-t border-border/40 text-muted-foreground italic">
                                        💡 {info.whenToTune}
                                      </div>
                                    )}
                                  </div>
                                  {/* AI suggestion if present */}
                                  {aiRec?.reason && (
                                    <div className="px-3 py-2 bg-violet-100/60 dark:bg-violet-950/60 border-t border-violet-200 dark:border-violet-800">
                                      <div className="font-bold text-violet-700 dark:text-violet-300 text-[10px] uppercase tracking-wider mb-0.5">
                                        AI Suggestion (
                                        {aiRec.multiplier.toFixed(2)}x)
                                      </div>
                                      <div className="text-foreground">
                                        {aiRec.reason}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </TooltipContent>
                        </Tooltip>
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
    </TooltipProvider>
  );
};
