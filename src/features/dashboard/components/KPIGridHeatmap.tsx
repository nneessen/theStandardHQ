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
  if (score == null) return "bg-muted";
  if (score >= 0.5) return "bg-success";
  if (score >= 0.15) return "bg-success/70";
  if (score > -0.15) return "bg-foreground-subtle";
  if (score > -0.5) return "bg-warning";
  return "bg-destructive";
}

/** Cell background tint, applied behind the value column only. */
function cellTintClass(score: number | null): string {
  if (score == null) return "";
  if (score >= 0.5) return "bg-success/15";
  if (score >= 0.15) return "bg-success/8";
  if (score > -0.15) return "";
  if (score > -0.5) return "bg-warning/15";
  return "bg-destructive/15";
}

const SectionContent: React.FC<{
  section: KPISection;
  sectionIndex: number;
}> = ({ section, sectionIndex }) => (
  <>
    <div className="text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wide mb-2">
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
                <span className="text-muted-foreground dark:text-muted-foreground truncate">
                  {kpi.label}
                </span>
                <span className="font-mono tabular-nums font-semibold text-foreground dark:text-foreground">
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
              className="max-w-xs bg-foreground dark:bg-card-tinted border-border"
            >
              <div className="space-y-1">
                <div className="text-xs font-semibold text-background">
                  {kpi.label}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Category: {section.category}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Value:{" "}
                  <span className="font-mono tabular-nums text-background">
                    {kpi.value}
                  </span>
                </div>
                {kpi.intensity?.target != null && (
                  <div className="text-[10px] text-muted-foreground">
                    Target:{" "}
                    <span className="font-mono tabular-nums text-background">
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
        <div className="text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
          {title}
        </div>
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground dark:text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span>Above target</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            <span>Watch</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
            <span>Below</span>
          </div>
        </div>
      </div>
      <TooltipProvider delayDuration={200}>
        <div className="rounded-lg border border-border dark:border-border bg-card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border dark:divide-border">
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
