// src/features/reports/components/ExecutiveSummary.tsx

import { AlertTriangle } from "lucide-react";
import type {
  Report,
  ReportMetric,
  ActionableInsight,
} from "../../../types/reports.types";

interface ExecutiveSummaryProps {
  summary: Report["summary"];
}

/**
 * Executive summary section of the report.
 * Displays key metrics and priority actions/insights.
 */
export function ExecutiveSummary({ summary }: ExecutiveSummaryProps) {
  return (
    <div className="px-3 py-2 border-b border-v2-ring">
      <h2 className="text-sm font-bold text-v2-ink mb-2">Executive Summary</h2>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1.5 mb-2">
        {summary.keyMetrics.map((metric: ReportMetric, index: number) => (
          <div key={index} className="flex items-baseline gap-1.5">
            <span className="text-xs text-v2-ink-muted whitespace-nowrap">
              {metric.label}:
            </span>
            <span className="text-sm font-bold text-v2-ink font-mono">
              {metric.value}
            </span>
            {metric.trend && (
              <span
                className={`text-xs font-medium ${
                  metric.trend === "up" ? "text-success" : "text-destructive"
                }`}
              >
                {metric.trend === "up" ? "↑" : "↓"}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Priority Actions / Top Insights */}
      {summary.topInsights.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-v2-ink mb-1.5">
            Priority Actions
          </h3>
          {summary.topInsights.map((insight: ActionableInsight) => (
            <div
              key={insight.id}
              className="flex items-start gap-2 p-2 rounded-sm bg-v2-accent-soft border-l-2 border-l-v2-accent-strong"
            >
              <AlertTriangle className="w-3 h-3 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-v2-ink">
                  {insight.title}
                </h4>
                <p className="text-xs text-v2-ink-muted leading-relaxed">
                  {insight.description}
                </p>
                <div className="text-xs text-v2-ink font-medium mt-0.5">
                  Impact: {insight.impact}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
