// src/features/close-kpi/components/widgets/LeadHeatAiInsightsWidget.tsx
// AI-powered insights panel: recommendations, anomalies, patterns, personalization progress.

import React from "react";
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Target,
} from "lucide-react";
import type { LeadHeatAiInsightsResult } from "../../types/close-kpi.types";

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

export const LeadHeatAiInsightsWidget: React.FC<
  LeadHeatAiInsightsWidgetProps
> = ({ data }) => {
  const {
    recommendations,
    anomalies,
    overallAssessment,
    sampleSize,
    analyzedAt,
  } = data;

  const hasData =
    recommendations.length > 0 || anomalies.length > 0 || overallAssessment;

  if (!hasData) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <Brain className="h-6 w-6 text-muted-foreground/40" />
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">
            AI insights not yet available
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            {sampleSize < 10
              ? `Score your leads first, then AI will analyze patterns (${sampleSize}/10 minimum)`
              : "Run a rescore to generate AI insights"}
          </p>
        </div>
        {/* Personalization progress */}
        <div className="w-full max-w-[180px]">
          <div className="flex justify-between text-[9px] text-muted-foreground/60 mb-0.5">
            <span>Learning</span>
            <span>{Math.min(sampleSize, 50)}/50</span>
          </div>
          <div className="h-1 rounded-full bg-muted/30">
            <div
              className="h-1 rounded-full bg-primary/40 transition-all"
              style={{ width: `${Math.min((sampleSize / 50) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-auto">
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

      {/* Personalization status */}
      <div className="mt-auto flex items-center gap-3 border-t border-border/30 pt-1.5">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Model v{data.modelVersion}
          </span>
        </div>
        <div className="flex-1">
          <div className="flex justify-between text-[9px] text-muted-foreground/60 mb-0.5">
            <span>{sampleSize >= 50 ? "Personalized" : "Learning"}</span>
            <span>{Math.min(sampleSize, 50)}/50</span>
          </div>
          <div className="h-1 rounded-full bg-muted/30">
            <div
              className={`h-1 rounded-full transition-all ${sampleSize >= 50 ? "bg-emerald-500" : "bg-primary/40"}`}
              style={{ width: `${Math.min((sampleSize / 50) * 100, 100)}%` }}
            />
          </div>
        </div>
        {analyzedAt && (
          <span className="text-[9px] text-muted-foreground/50">
            {formatTimeAgo(analyzedAt)}
          </span>
        )}
      </div>
    </div>
  );
};

function formatTimeAgo(ts: string): string {
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
