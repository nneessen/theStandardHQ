// src/features/dashboard/components/KPIGridNarrative.tsx

import React from "react";
import { DetailedKPIGridProps } from "../../../types/dashboard.types";
import { NarrativeInsight } from "./kpi-layouts/NarrativeInsight";

/**
 * Generate contextual insight text based on metric
 */
function generateInsight(
  label: string,
  value: string | number,
  category: string,
): string {
  const strValue = String(value);

  // Extract numeric value if possible
  const numMatch = strValue.match(/^[\d,]+\.?\d*$/);
  const percentMatch = strValue.match(/(\d+\.?\d*)%/);

  if (label.includes("Profit Margin")) {
    return percentMatch
      ? `Your profit margin is ${strValue}, ${parseFloat(percentMatch[1]) > 30 ? "exceeding" : "approaching"} industry benchmarks`
      : `Keep tracking profitability to optimize your business performance`;
  }

  if (label.includes("Policies") || label.includes("Policy")) {
    return numMatch
      ? `You've ${label.toLowerCase()} ${strValue} so far, contributing to your growth trajectory`
      : `Policy activity is a key indicator of business health`;
  }

  if (label.includes("Commission")) {
    return `Commission performance in the ${category.toLowerCase()} category is tracking well`;
  }

  if (label.includes("Target") || label.includes("Pace")) {
    return `Stay focused on ${strValue} to maintain momentum and hit your goals`;
  }

  if (label.includes("Expense")) {
    return `Monitoring expenses helps optimize profitability and cash flow`;
  }

  // Default insight
  return `This metric provides visibility into your ${category.toLowerCase()} performance`;
}

/**
 * Determine trend based on label heuristics
 * In production, this would compare against historical data
 */
function getTrend(label: string): "up" | "down" | "neutral" {
  // TODO: Replace with real historical comparison
  if (label.includes("Cancel") || label.includes("Lapsed")) {
    return "down"; // Down is good for negative metrics
  }

  if (
    label.includes("Profit") ||
    label.includes("Commission") ||
    label.includes("Policies")
  ) {
    return Math.random() > 0.5 ? "up" : "neutral";
  }

  return "neutral";
}

/**
 * Calculate mock progress percentage
 * In production, this would be actual target % achievement
 */
function getProgress(
  label: string,
  value: string | number,
): number | undefined {
  const percentMatch = String(value).match(/(\d+\.?\d*)%/);
  if (percentMatch) {
    return parseFloat(percentMatch[1]);
  }

  // For non-percentage values, generate mock progress
  // TODO: Replace with real target comparison
  if (label.includes("Target") || label.includes("Needed")) {
    return Math.random() * 100;
  }

  return undefined;
}

/**
 * Get accent color based on category
 */
function getAccentColor(category: string): string {
  const lowerCategory = category.toLowerCase();
  if (lowerCategory.includes("financial")) return "border-info";
  if (lowerCategory.includes("production")) return "border-info";
  if (lowerCategory.includes("commission") || lowerCategory.includes("metric"))
    return "border-success";
  if (lowerCategory.includes("client")) return "border-info";
  if (lowerCategory.includes("performance") || lowerCategory.includes("target"))
    return "border-warning";
  return "border-primary";
}

/**
 * KPI Grid Narrative Layout Component
 *
 * Story-driven dashboard that presents KPIs as natural language insights
 * with contextual explanations and actionable recommendations.
 *
 * Design Philosophy: Apple product pages + data storytelling
 */
export const KPIGridNarrative: React.FC<DetailedKPIGridProps> = ({
  sections,
}) => {
  // Flatten all KPIs with their category context
  const allKPIs = sections.flatMap((section) =>
    section.kpis.map((kpi) => ({
      ...kpi,
      category: section.category,
    })),
  );

  // Identify hero metric (first metric, usually most important)
  const heroKPI = allKPIs[0];
  const _supportingKPIs = allKPIs.slice(1);

  return (
    <div className="bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring">
      <div className="px-3 py-2 border-b border-v2-ring dark:border-v2-ring">
        <h3 className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider">
          Performance Story
        </h3>
      </div>
      <div className="p-3 space-y-4">
        {/* Hero Metric */}
        {heroKPI && (
          <div className="pb-4 mb-4 border-b border-v2-ring dark:border-v2-ring-strong">
            <NarrativeInsight
              label={heroKPI.label}
              value={heroKPI.value}
              insight={generateInsight(
                heroKPI.label,
                heroKPI.value,
                heroKPI.category,
              )}
              progress={getProgress(heroKPI.label, heroKPI.value)}
              trend={getTrend(heroKPI.label)}
              accentColor={getAccentColor(heroKPI.category)}
            />
          </div>
        )}

        {/* Supporting Metrics - Grouped by Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="space-y-3">
              {/* Category Header */}
              <h3 className="text-[10px] uppercase tracking-wider font-bold text-v2-ink-muted dark:text-v2-ink-subtle mb-2">
                {section.category}
              </h3>

              {/* Category KPIs */}
              {section.kpis.map((kpi, kpiIndex) => (
                <NarrativeInsight
                  key={kpiIndex}
                  label={kpi.label}
                  value={kpi.value}
                  insight={generateInsight(
                    kpi.label,
                    kpi.value,
                    section.category,
                  )}
                  progress={getProgress(kpi.label, kpi.value)}
                  trend={getTrend(kpi.label)}
                  accentColor={getAccentColor(section.category)}
                  className="py-3"
                />
              ))}
            </div>
          ))}
        </div>

        {/* Actionable Summary */}
        <div className="mt-6 pt-4 border-t border-v2-ring dark:border-v2-ring-strong">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-v2-canvas dark:bg-v2-card-tinted/50">
            <div className="text-[11px] leading-relaxed text-v2-ink-muted dark:text-v2-ink-subtle">
              <span className="font-semibold text-v2-ink dark:text-v2-ink">
                Key Takeaway:
              </span>{" "}
              Your metrics show overall positive momentum. Continue monitoring
              pace targets and expense efficiency to optimize performance this
              period.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
