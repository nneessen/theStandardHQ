// src/features/close-kpi/components/widgets/LeadHeatListWidget.tsx
// Sortable lead table with heat score badges, filtering, and inline AI deep-dive.

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

interface LeadHeatListWidgetProps {
  data: LeadHeatListResult;
}

// Sentinel value for failed deep dives
const DEEP_DIVE_ERROR = Symbol("error");
type DeepDiveEntry = LeadHeatDeepDiveResult | typeof DEEP_DIVE_ERROR;

export const LeadHeatListWidget: React.FC<LeadHeatListWidgetProps> = ({
  data,
}) => {
  const { leads, total, page, pageSize } = data;
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [deepDiveData, setDeepDiveData] = useState<
    Record<string, DeepDiveEntry>
  >({});
  const [loadingDeepDive, setLoadingDeepDive] = useState<string | null>(null);
  const pendingRef = useRef<Set<string>>(new Set());
  const [rescoring, setRescoring] = useState(false);
  const [rescoreError, setRescoreError] = useState<string | null>(null);

  const handleRescore = async () => {
    setRescoring(true);
    setRescoreError(null);
    try {
      await closeKpiService.triggerRescore();
      // Data will refresh via TanStack Query staleTime
    } catch (err) {
      setRescoreError((err as Error).message);
    } finally {
      setRescoring(false);
    }
  };

  const handleRowClick = async (lead: LeadHeatScoreRow) => {
    if (expandedLeadId === lead.closeLeadId) {
      setExpandedLeadId(null);
      return;
    }
    setExpandedLeadId(lead.closeLeadId);

    if (lead.aiInsight) {
      const insight = lead.aiInsight;
      setDeepDiveData((prev) => ({ ...prev, [lead.closeLeadId]: insight }));
      return;
    }

    const existing = deepDiveData[lead.closeLeadId];
    if (existing && existing !== DEEP_DIVE_ERROR) return;

    if (pendingRef.current.has(lead.closeLeadId)) return;
    pendingRef.current.add(lead.closeLeadId);

    setLoadingDeepDive(lead.closeLeadId);
    try {
      const result = await closeKpiService.analyzeLeadDeepDive(
        lead.closeLeadId,
      );
      setDeepDiveData((prev) => ({ ...prev, [lead.closeLeadId]: result }));
    } catch {
      setDeepDiveData((prev) => ({
        ...prev,
        [lead.closeLeadId]: DEEP_DIVE_ERROR,
      }));
    } finally {
      setLoadingDeepDive(null);
      pendingRef.current.delete(lead.closeLeadId);
    }
  };

  if (leads.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
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
          disabled={rescoring}
        >
          {rescoring ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {rescoring ? "Scoring leads..." : "Score My Leads"}
        </Button>
        {rescoreError && (
          <p className="text-[10px] text-destructive">{rescoreError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-1">
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
          disabled={rescoring}
          title="Rescore all leads"
        >
          {rescoring ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
          ) : (
            <RefreshCw className="h-2.5 w-2.5" />
          )}
          {rescoring ? "Scoring..." : "Rescore"}
        </Button>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50 text-[10px] uppercase text-muted-foreground">
              <th className="pb-1 text-left font-medium">Lead</th>
              <th className="pb-1 text-center font-medium">Score</th>
              <th className="pb-1 text-left font-medium">Status</th>
              <th className="pb-1 text-left font-medium">Top Signal</th>
              <th className="pb-1 text-center font-medium w-6">AI</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <React.Fragment key={lead.closeLeadId}>
                <tr
                  className="cursor-pointer border-b border-border/30 hover:bg-muted/30 transition-colors"
                  onClick={() => handleRowClick(lead)}
                >
                  <td className="py-1.5 pr-2">
                    <span className="font-medium text-foreground">
                      {lead.displayName}
                    </span>
                  </td>
                  <td className="py-1.5 text-center">
                    <LeadHeatBadge
                      score={lead.score}
                      heatLevel={lead.heatLevel}
                      trend={lead.trend}
                      previousScore={lead.previousScore}
                    />
                  </td>
                  <td className="py-1.5 pr-2 text-muted-foreground">
                    {lead.currentStatus}
                  </td>
                  <td className="py-1.5 pr-2 text-muted-foreground">
                    {lead.topSignal}
                  </td>
                  <td className="py-1.5 text-center">
                    {expandedLeadId === lead.closeLeadId ? (
                      <ChevronUp className="mx-auto h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="mx-auto h-3 w-3 text-muted-foreground" />
                    )}
                  </td>
                </tr>

                {expandedLeadId === lead.closeLeadId && (
                  <tr>
                    <td colSpan={5} className="pb-2">
                      <DeepDivePanel
                        data={
                          deepDiveData[lead.closeLeadId] === DEEP_DIVE_ERROR
                            ? null
                            : ((deepDiveData[
                                lead.closeLeadId
                              ] as LeadHeatDeepDiveResult) ?? null)
                        }
                        isLoading={loadingDeepDive === lead.closeLeadId}
                        hasError={
                          deepDiveData[lead.closeLeadId] === DEEP_DIVE_ERROR
                        }
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Inline Deep Dive Panel ───────────────────────────────────────────

interface DeepDivePanelProps {
  data: LeadHeatDeepDiveResult | null;
  isLoading: boolean;
  hasError?: boolean;
}

const DeepDivePanel: React.FC<DeepDivePanelProps> = ({
  data,
  isLoading,
  hasError,
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
        AI analysis failed. Click again to retry.
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

      <div className="flex items-center gap-3 text-[10px]">
        <span className="text-muted-foreground">
          Conversion:{" "}
          <span
            className={`font-semibold ${probColors[data.conversionProbability] ?? ""}`}
          >
            {data.conversionProbability.replace("_", " ")}
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
