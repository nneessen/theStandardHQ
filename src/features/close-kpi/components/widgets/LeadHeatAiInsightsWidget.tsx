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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LeadHeatAiInsightsResult } from "../../types/close-kpi.types";
import { useLeadHeatRescore } from "../../hooks/useCloseKpiDashboard";
import { formatTimeAgo } from "../../lib/format-time";
import { ManageWeightsPanel } from "../ManageWeightsPanel";

interface LeadHeatAiInsightsWidgetProps {
  data: LeadHeatAiInsightsResult;
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20",
  medium:
    "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20",
  low: "border-v2-ring bg-v2-canvas/50  dark:bg-v2-ring/20",
};

const URGENCY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-v2-ring-strong",
};

export const LeadHeatAiInsightsWidget: React.FC<
  LeadHeatAiInsightsWidgetProps
> = ({ data }) => {
  const leadHeatRescore = useLeadHeatRescore();
  const { recommendations, anomalies, overallAssessment, analyzedAt } = data;

  const handleRescore = async () => {
    try {
      await leadHeatRescore.mutateAsync();
    } catch {
      // Widget will show updated data on next query refetch
    }
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

      <ManageWeightsPanel data={data} variant="compact" />

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
