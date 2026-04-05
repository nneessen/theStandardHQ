// src/features/close-kpi/components/widgets/LeadHeatListWidget.tsx
// Lead rankings with heat score badges, inline AI deep-dive.
// Uses stacked rows instead of a table — readable at any widget width.

import React, { useState, useRef } from "react";
import {
  Brain,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Flame,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  LeadHeatListResult,
  LeadHeatScoreRow,
  LeadHeatDeepDiveResult,
} from "../../types/close-kpi.types";
import { LeadHeatBadge } from "../LeadHeatBadge";
import { closeKpiService } from "../../services/closeKpiService";
import { useLeadHeatRescore } from "../../hooks/useCloseKpiDashboard";

interface LeadHeatListWidgetProps {
  data: LeadHeatListResult;
}

export const LeadHeatListWidget: React.FC<LeadHeatListWidgetProps> = ({
  data,
}) => {
  const leadHeatRescore = useLeadHeatRescore();
  const { leads, total, page, pageSize } = data;
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [deepDiveData, setDeepDiveData] = useState<
    Record<string, LeadHeatDeepDiveResult>
  >({});
  const [deepDiveErrors, setDeepDiveErrors] = useState<Record<string, string>>(
    {},
  );
  const [loadingDeepDive, setLoadingDeepDive] = useState<string | null>(null);
  const pendingRef = useRef<Set<string>>(new Set());
  const [rescoreError, setRescoreError] = useState<string | null>(null);

  const handleRescore = async () => {
    setRescoreError(null);
    try {
      await leadHeatRescore.mutateAsync();
    } catch (err) {
      setRescoreError((err as Error).message);
    }
  };

  const handleRowClick = async (lead: LeadHeatScoreRow) => {
    // If clicking the expanded lead with an error, retry instead of collapsing
    if (
      expandedLeadId === lead.closeLeadId &&
      deepDiveErrors[lead.closeLeadId]
    ) {
      // Clear error + cached data to trigger a fresh fetch below
      setDeepDiveErrors((prev) => {
        const next = { ...prev };
        delete next[lead.closeLeadId];
        return next;
      });
      setDeepDiveData((prev) => {
        const next = { ...prev };
        delete next[lead.closeLeadId];
        return next;
      });
      // Fall through to the fetch logic (don't return)
    } else if (expandedLeadId === lead.closeLeadId) {
      setExpandedLeadId(null);
      return;
    }
    setExpandedLeadId(lead.closeLeadId);

    if (lead.aiInsight) {
      const insight = lead.aiInsight;
      setDeepDiveData((prev) => ({ ...prev, [lead.closeLeadId]: insight }));
      setDeepDiveErrors((prev) => {
        const next = { ...prev };
        delete next[lead.closeLeadId];
        return next;
      });
      return;
    }

    const existing = deepDiveData[lead.closeLeadId];
    if (existing) return;

    if (pendingRef.current.has(lead.closeLeadId)) return;
    pendingRef.current.add(lead.closeLeadId);

    setLoadingDeepDive(lead.closeLeadId);
    try {
      const result = await closeKpiService.analyzeLeadDeepDive(
        lead.closeLeadId,
      );
      setDeepDiveData((prev) => ({ ...prev, [lead.closeLeadId]: result }));
      setDeepDiveErrors((prev) => {
        const next = { ...prev };
        delete next[lead.closeLeadId];
        return next;
      });
    } catch (err) {
      setDeepDiveErrors((prev) => ({
        ...prev,
        [lead.closeLeadId]: normalizeDeepDiveErrorMessage(
          (err as Error).message,
        ),
      }));
    } finally {
      setLoadingDeepDive(null);
      pendingRef.current.delete(lead.closeLeadId);
    }
  };

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <Flame className="h-5 w-5 text-muted-foreground/40" />
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">
            No leads scored yet
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            Run your first scoring analysis to see your leads ranked by heat
            score
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] gap-1.5 mt-1"
          onClick={handleRescore}
          disabled={leadHeatRescore.isPending}
        >
          {leadHeatRescore.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {leadHeatRescore.isPending ? "Scoring leads..." : "Score My Leads"}
        </Button>
        {rescoreError && (
          <p className="text-[10px] text-destructive">{rescoreError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {total} leads{" "}
          {total > pageSize && (
            <span>
              (showing {(page - 1) * pageSize + 1}-
              {Math.min(page * pageSize, total)})
            </span>
          )}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
          onClick={handleRescore}
          disabled={leadHeatRescore.isPending}
          title="Rescore all leads"
        >
          {leadHeatRescore.isPending ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
          ) : (
            <RefreshCw className="h-2.5 w-2.5" />
          )}
          {leadHeatRescore.isPending ? "Scoring..." : "Rescore"}
        </Button>
      </div>

      {/* Lead rows — stacked layout, readable at any width */}
      <div className="flex flex-col">
        {leads.map((lead) => {
          const isExpanded = expandedLeadId === lead.closeLeadId;

          return (
            <React.Fragment key={lead.closeLeadId}>
              <button
                className="flex items-center gap-2 w-full text-left px-1.5 py-1.5 rounded hover:bg-muted/30 transition-colors border-b border-border/20 last:border-b-0"
                onClick={() => handleRowClick(lead)}
              >
                {/* Score badge — fixed width */}
                <LeadHeatBadge
                  score={lead.score}
                  heatLevel={lead.heatLevel}
                  trend={lead.trend}
                  previousScore={lead.previousScore}
                />

                {/* Lead info — takes remaining space */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-foreground truncate">
                      {lead.displayName}
                    </span>
                    {lead.currentStatus && (
                      <span className="text-[9px] text-muted-foreground bg-zinc-100 dark:bg-zinc-800 rounded px-1 py-0.5 shrink-0 truncate max-w-[100px]">
                        {lead.currentStatus}
                      </span>
                    )}
                  </div>
                  {lead.topSignal && (
                    <p className="text-[9px] text-muted-foreground/70 truncate mt-0.5">
                      {lead.topSignal}
                    </p>
                  )}
                </div>

                {/* Expand indicator */}
                <div className="shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded deep-dive */}
              {isExpanded && (
                <div className="px-1 pb-1.5">
                  <DeepDivePanel
                    data={deepDiveData[lead.closeLeadId] ?? null}
                    isLoading={loadingDeepDive === lead.closeLeadId}
                    hasError={!!deepDiveErrors[lead.closeLeadId]}
                    errorMessage={deepDiveErrors[lead.closeLeadId]}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ─── Inline Deep Dive Panel ───────────────────────────────────────────

interface DeepDivePanelProps {
  data: LeadHeatDeepDiveResult | null;
  isLoading: boolean;
  hasError?: boolean;
  errorMessage?: string;
}

const DeepDivePanel: React.FC<DeepDivePanelProps> = ({
  data,
  isLoading,
  hasError,
  errorMessage,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded border border-border/50 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Analyzing lead with AI...
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex items-center gap-2 rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
        <AlertCircle className="h-3 w-3" />
        {errorMessage ?? "AI analysis failed. Click again to retry."}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 rounded border border-border/50 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        <Brain className="h-3 w-3" />
        Click to analyze this lead with AI
      </div>
    );
  }

  const probColors: Record<string, string> = {
    high: "text-emerald-600 dark:text-emerald-400",
    medium: "text-amber-600 dark:text-amber-400",
    low: "text-orange-600 dark:text-orange-400",
    very_low: "text-red-600 dark:text-red-400",
  };

  return (
    <div className="rounded border border-border/50 bg-muted/10 px-3 py-2 space-y-1.5">
      <p className="text-[11px] text-foreground leading-relaxed">
        {data.narrative}
      </p>

      <div className="flex items-start gap-2 rounded bg-primary/5 px-2 py-1.5 border border-primary/10">
        <Brain className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
        <div className="text-[11px]">
          <span className="font-semibold text-primary">
            {data.recommendedAction.action}
          </span>
          <span className="text-muted-foreground">
            {" "}
            — {data.recommendedAction.timing}
          </span>
          <p className="text-muted-foreground/80 text-[10px] mt-0.5">
            {data.recommendedAction.reasoning}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
        <span className="text-muted-foreground">
          Conversion:{" "}
          <span
            className={`font-semibold ${probColors[data.conversionProbability] ?? ""}`}
          >
            {(data.conversionProbability ?? "unknown").replace("_", " ")}
          </span>
        </span>
        <span className="text-muted-foreground">
          Confidence: {Math.round(data.confidence * 100)}%
        </span>
        {data.riskFactors.length > 0 && (
          <span className="text-destructive/80">
            Risks: {data.riskFactors.join(", ")}
          </span>
        )}
      </div>
    </div>
  );
};

function normalizeDeepDiveErrorMessage(message: string): string {
  if (message.includes("ANTHROPIC_API_KEY not configured")) {
    return "AI lead analysis is unavailable locally until ANTHROPIC_API_KEY is set.";
  }

  return message || "AI analysis failed. Click again to retry.";
}
