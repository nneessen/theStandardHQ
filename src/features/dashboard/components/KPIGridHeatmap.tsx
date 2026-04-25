// src/features/dashboard/components/KPIGridHeatmap.tsx

import React from "react";
import {
  DetailedKPIGridProps,
  KPISection,
  KPIIntensity,
} from "../../../types/dashboard.types";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GatedKPISection } from "./GatedKPISection";

/**
 * Map a KPIIntensity hint to a normalized score in [-1, 1] where +1 = best,
 * -1 = worst, 0 = neutral. Drives the cell background tint and the score
 * dot color in the heatmap.
 */
function intensityScore(hint: KPIIntensity | undefined): number | null {
  if (!hint) return null;
  if (hint.direction === "neutral") return null;
  const { numeric, direction, target } = hint;
  if (!Number.isFinite(numeric)) return null;

  // With an explicit target, score = (value / target) mapped onto [-1..1].
  // value at target → 0.5 (mildly good). Above target → 1. Half target → 0.
  if (target != null && target > 0) {
    const ratio = numeric / target;
    const clamped = Math.max(0, Math.min(2, ratio));
    const raw = clamped - 0.5; // [-0.5..1.5] → shift so target is 0.5 → 1
    const norm = Math.max(-1, Math.min(1, raw));
    return direction === "higher_better" ? norm : -norm;
  }

  // No target — assume the value is already a percentage in [0..100].
  // Map 50 → 0 (neutral), 80 → +0.6, 20 → -0.6.
  const pct = Math.max(0, Math.min(100, numeric));
  const norm = (pct - 50) / 50; // -1..1
  return direction === "higher_better" ? norm : -norm;
}

/** Small dot rendered after the value, color-coded by intensity score. */
function intensityDotClass(score: number | null): string {
  if (score == null) return "bg-zinc-300 dark:bg-zinc-700";
  if (score >= 0.5) return "bg-emerald-500";
  if (score >= 0.15) return "bg-emerald-400";
  if (score > -0.15) return "bg-zinc-400 dark:bg-zinc-500";
  if (score > -0.5) return "bg-amber-500";
  return "bg-red-500";
}

/** Cell background tint, applied behind the value column only. */
function cellTintClass(score: number | null): string {
  if (score == null) return "";
  if (score >= 0.5) return "bg-emerald-50/80 dark:bg-emerald-950/30";
  if (score >= 0.15) return "bg-emerald-50/40 dark:bg-emerald-950/15";
  if (score > -0.15) return "";
  if (score > -0.5) return "bg-amber-50/60 dark:bg-amber-950/20";
  return "bg-red-50/70 dark:bg-red-950/25";
}

const SectionContent: React.FC<{
  section: KPISection;
  sectionIndex: number;
}> = ({ section, sectionIndex }) => (
  <>
    <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
      {section.category}
    </div>
    <div className="space-y-0.5">
      {section.kpis.map((kpi, kpiIndex) => {
        const score = intensityScore(kpi.intensity);
        return (
          <Tooltip key={`${sectionIndex}-${kpiIndex}`}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "grid grid-cols-[1fr_auto_auto] items-center gap-2 text-[11px] cursor-help rounded px-1 -mx-1 py-0.5 transition-colors",
                  cellTintClass(score),
                  "hover:brightness-95 dark:hover:brightness-110",
                )}
              >
                <span className="text-zinc-600 dark:text-zinc-400 truncate">
                  {kpi.label}
                </span>
                <span className="font-mono tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                  {kpi.value}
                </span>
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    intensityDotClass(score),
                  )}
                  aria-hidden
                />
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-xs bg-zinc-900 dark:bg-zinc-800 border-zinc-700"
            >
              <div className="space-y-1">
                <div className="text-xs font-semibold text-zinc-100">
                  {kpi.label}
                </div>
                <div className="text-[10px] text-zinc-400">
                  Category: {section.category}
                </div>
                <div className="text-[10px] text-zinc-400">
                  Value:{" "}
                  <span className="font-mono tabular-nums text-zinc-200">
                    {kpi.value}
                  </span>
                </div>
                {kpi.intensity?.target != null && (
                  <div className="text-[10px] text-zinc-400">
                    Target:{" "}
                    <span className="font-mono tabular-nums text-zinc-200">
                      {kpi.intensity.target}
                      {kpi.intensity.direction === "lower_better" ? "↓" : "↑"}
                    </span>
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  </>
);

interface KPIGridHeatmapProps extends DetailedKPIGridProps {
  title?: string;
}

export const KPIGridHeatmap: React.FC<KPIGridHeatmapProps> = ({
  sections,
  title = "Detailed KPI Breakdown",
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {title}
        </div>
        <div className="flex items-center gap-2 text-[9px] text-zinc-400 dark:text-zinc-500">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Above target</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>Watch</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            <span>Below</span>
          </div>
        </div>
      </div>
      <TooltipProvider delayDuration={200}>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 dark:divide-zinc-800">
          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="p-3 min-w-0">
              {section.gated ? (
                <GatedKPISection
                  hasAccess={false}
                  title={section.category}
                  requiredTier={section.requiredTier || "Starter"}
                >
                  <SectionContent
                    section={section}
                    sectionIndex={sectionIndex}
                  />
                </GatedKPISection>
              ) : (
                <SectionContent section={section} sectionIndex={sectionIndex} />
              )}
            </div>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
};
