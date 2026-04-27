// src/features/dashboard/components/KPIGridMatrix.tsx

import React from "react";
import { DetailedKPIGridProps } from "../../../types/dashboard.types";
import { cn } from "@/lib/utils";
import { CircularGauge } from "./kpi-layouts/CircularGauge";

/**
 * Assign quadrant based on category
 */
function getQuadrant(category: string): number {
  const lowerCategory = category.toLowerCase();
  if (lowerCategory.includes("financial")) return 1; // Top-left
  if (lowerCategory.includes("production")) return 2; // Top-right
  if (lowerCategory.includes("commission") || lowerCategory.includes("metric"))
    return 3; // Bottom-left
  if (lowerCategory.includes("client")) return 3; // Bottom-left (share with metrics)
  if (lowerCategory.includes("target") || lowerCategory.includes("performance"))
    return 4; // Bottom-right
  return 4; // Default to bottom-right
}

/**
 * Get status indicator based on metric
 */
function getStatus(
  label: string,
  value: string | number,
): "good" | "warning" | "critical" {
  const strValue = String(value);
  const percentMatch = strValue.match(/(\d+\.?\d*)%/);

  if (percentMatch) {
    const numValue = parseFloat(percentMatch[1]);
    if (numValue >= 90) return "good";
    if (numValue >= 70) return "warning";
    return "critical";
  }

  // For cancel/lapsed metrics, inverse logic
  if (label.includes("Cancel") || label.includes("Lapsed")) {
    return "warning"; // Always show as warning to draw attention
  }

  return "good"; // Default
}

/**
 * Extract percentage value for gauge
 */
function getGaugeValue(label: string, value: string | number): number | null {
  const strValue = String(value);
  const percentMatch = strValue.match(/(\d+\.?\d*)%/);

  if (percentMatch) {
    return parseFloat(percentMatch[1]);
  }

  // For target/pace metrics, generate mock progress
  if (
    label.includes("Target") ||
    label.includes("Pace") ||
    label.includes("Margin")
  ) {
    return Math.random() * 100;
  }

  return null;
}

/**
 * KPI Grid Matrix Layout Component - Compact zinc-styled quadrant layout
 */
export const KPIGridMatrix: React.FC<DetailedKPIGridProps> = ({ sections }) => {
  // Organize KPIs by quadrant
  const quadrants = [
    {
      id: 1,
      title: "FINANCIAL",
      kpis: [] as Array<{
        label: string;
        value: string | number;
        category: string;
      }>,
    },
    {
      id: 2,
      title: "PRODUCTION",
      kpis: [] as Array<{
        label: string;
        value: string | number;
        category: string;
      }>,
    },
    {
      id: 3,
      title: "PERFORMANCE",
      kpis: [] as Array<{
        label: string;
        value: string | number;
        category: string;
      }>,
    },
    {
      id: 4,
      title: "TARGETS",
      kpis: [] as Array<{
        label: string;
        value: string | number;
        category: string;
      }>,
    },
  ];

  sections.forEach((section) => {
    const quadrantId = getQuadrant(section.category);
    const quadrant = quadrants.find((q) => q.id === quadrantId);
    if (quadrant) {
      section.kpis.forEach((kpi) => {
        quadrant.kpis.push({ ...kpi, category: section.category });
      });
    }
  });

  return (
    <div className="bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring">
      <div className="px-3 py-2 border-b border-v2-ring dark:border-v2-ring">
        <h3 className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider font-mono">
          Command Center Matrix
        </h3>
      </div>
      <div className="p-3">
        {/* Quadrant Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
          {quadrants.map((quadrant) => (
            <div
              key={quadrant.id}
              className="relative rounded-lg border border-v2-ring dark:border-v2-ring-strong bg-v2-canvas dark:bg-v2-card-tinted/50 p-3 space-y-2"
            >
              {/* Quadrant Header */}
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-v2-ring dark:border-v2-ring-strong">
                <h3 className="text-[10px] uppercase tracking-widest font-bold font-mono text-v2-ink-muted dark:text-v2-ink-subtle">
                  {quadrant.title}
                </h3>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                </div>
              </div>

              {/* Quadrant Metrics */}
              <div className="space-y-1.5">
                {quadrant.kpis.length > 0 ? (
                  quadrant.kpis.map((kpi, index) => {
                    const status = getStatus(kpi.label, kpi.value);
                    const gaugeValue = getGaugeValue(kpi.label, kpi.value);
                    const statusColor =
                      status === "good"
                        ? "bg-emerald-500"
                        : status === "warning"
                          ? "bg-amber-500"
                          : "bg-red-500";

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between gap-3 p-2 rounded bg-v2-card border border-v2-ring dark:border-v2-ring hover:border-v2-ring dark:hover:border-v2-ring-strong transition-colors"
                      >
                        {/* Status dot */}
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full flex-shrink-0",
                            statusColor,
                            status === "critical" && "animate-pulse",
                          )}
                        />

                        {/* Label and Value */}
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle truncate">
                            {kpi.label}
                          </div>
                          <div className="text-sm font-bold font-mono text-v2-ink dark:text-v2-ink">
                            {kpi.value}
                          </div>
                        </div>

                        {/* Circular Gauge (if applicable) */}
                        {gaugeValue !== null && (
                          <CircularGauge
                            value={gaugeValue}
                            size={36}
                            strokeWidth={3}
                            showValue={false}
                            color={
                              gaugeValue >= 90
                                ? "hsl(142, 76%, 45%)"
                                : gaugeValue >= 70
                                  ? "hsl(38, 92%, 50%)"
                                  : "hsl(0, 84%, 60%)"
                            }
                          />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle text-center py-4">
                    No metrics in this quadrant
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* System Status Footer */}
        <div className="mt-3 pt-2 border-t border-v2-ring dark:border-v2-ring-strong flex items-center justify-between text-[10px] font-mono text-v2-ink-muted dark:text-v2-ink-subtle">
          <div>SYSTEM: ACTIVE</div>
          <div className="flex items-center gap-2">
            <span>REFRESH: LIVE</span>
            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};
