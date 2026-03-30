// src/features/close-kpi/components/widgets/LeadHeatSummaryWidget.tsx
// Donut chart showing score distribution by heat level + summary stats.

import React from "react";
import { Flame, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  LeadHeatSummaryResult,
  LeadHeatLevel,
} from "../../types/close-kpi.types";
import { useLeadHeatRescore } from "../../hooks/useCloseKpiDashboard";

interface LeadHeatSummaryWidgetProps {
  data: LeadHeatSummaryResult;
}

const LEVEL_COLORS: Record<LeadHeatLevel, { fill: string; label: string }> = {
  hot: { fill: "#ef4444", label: "Hot" },
  warming: { fill: "#f97316", label: "Warming" },
  neutral: { fill: "#a1a1aa", label: "Neutral" },
  cooling: { fill: "#60a5fa", label: "Cooling" },
  cold: { fill: "#2563eb", label: "Cold" },
};

export const LeadHeatSummaryWidget: React.FC<LeadHeatSummaryWidgetProps> = ({
  data,
}) => {
  const leadHeatRescore = useLeadHeatRescore();
  const {
    distribution,
    totalScored,
    avgScore,
    lastScoredAt,
    isPersonalized,
    sampleSize,
  } = data;

  const handleRescore = async () => {
    try {
      await leadHeatRescore.mutateAsync();
    } catch {
      // Widget will show updated data on next query refetch
    }
  };

  // Empty state
  if (totalScored === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
        <Flame className="h-4 w-4 text-muted-foreground/40" />
        <p className="text-[10px] text-muted-foreground">No leads scored yet</p>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] gap-1"
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
      </div>
    );
  }

  // Build donut segments
  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  let cumulativePct = 0;
  const segments = distribution
    .filter((d) => d.count > 0)
    .map((d) => {
      const pct = total > 0 ? (d.count / total) * 100 : 0;
      const start = cumulativePct;
      cumulativePct += pct;
      return { ...d, pct, start };
    });

  // SVG donut
  const size = 80;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-3">
        {/* Donut */}
        <div className="relative flex-shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-muted/20"
            />
            {segments.map((seg) => {
              const offset = circumference * (1 - seg.pct / 100);
              const rotation = (seg.start / 100) * 360 - 90;
              return (
                <circle
                  key={seg.level}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={LEVEL_COLORS[seg.level].fill}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={offset}
                  transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
                  strokeLinecap={segments.length > 1 ? "round" : undefined}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-lg font-bold">{avgScore}</span>
            <span className="text-[8px] uppercase text-muted-foreground">
              avg
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <Flame className="h-3 w-3 text-red-500" />
            <span className="text-xs font-semibold">
              {totalScored} leads scored
            </span>
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {distribution
              .filter((d) => d.count > 0)
              .map((d) => (
                <span
                  key={d.level}
                  className="text-[10px] text-muted-foreground"
                >
                  <span
                    className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: LEVEL_COLORS[d.level].fill }}
                  />
                  {LEVEL_COLORS[d.level].label} {d.count}
                </span>
              ))}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {formatTimeAgo(lastScoredAt)}
            {isPersonalized && (
              <span className="ml-1 rounded bg-emerald-100 px-1 py-px text-[9px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Personalized
              </span>
            )}
            {!isPersonalized && sampleSize > 0 && (
              <span className="ml-1 text-[9px] text-muted-foreground/60">
                {sampleSize}/50 outcomes
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

function formatTimeAgo(ts: string | null): string {
  if (!ts) return "Not scored yet";
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
