import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { KPISection, KPIIntensity } from "../../../types/dashboard.types";
import { GatedKPISection } from "./GatedKPISection";

/**
 * Same intensity → score mapping the heatmap used. Keeps tinting consistent
 * across the dashboard.
 */
function intensityScore(hint: KPIIntensity | undefined): number | null {
  if (!hint) return null;
  if (hint.direction === "neutral") return null;
  const { numeric, direction, target } = hint;
  if (!Number.isFinite(numeric)) return null;
  if (target != null && target > 0) {
    const ratio = numeric / target;
    const clamped = Math.max(0, Math.min(2, ratio));
    const raw = clamped - 0.5;
    const norm = Math.max(-1, Math.min(1, raw));
    return direction === "higher_better" ? norm : -norm;
  }
  const pct = Math.max(0, Math.min(100, numeric));
  const norm = (pct - 50) / 50;
  return direction === "higher_better" ? norm : -norm;
}

function intensityDotClass(score: number | null): string {
  if (score == null) return "bg-zinc-300 dark:bg-zinc-700";
  if (score >= 0.5) return "bg-emerald-500";
  if (score >= 0.15) return "bg-emerald-400";
  if (score > -0.15) return "bg-zinc-400 dark:bg-zinc-500";
  if (score > -0.5) return "bg-amber-500";
  return "bg-red-500";
}

interface DetailsSectionProps {
  sections: KPISection[];
}

const DetailsRow: React.FC<{
  section: KPISection;
}> = ({ section }) => (
  <TooltipProvider delayDuration={200}>
    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-x-6 gap-y-2 py-3 border-t border-dashed border-zinc-200 dark:border-zinc-800 first:border-t-0">
      {/* Category label — magazine-style margin label */}
      <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-500 dark:text-zinc-400 sm:pt-0.5">
        {section.category}
      </div>

      {/* KPI grid — 2-col on sm, 3-col on lg */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
        {section.kpis.map((kpi, i) => {
          const score = intensityScore(kpi.intensity);
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div className="flex items-baseline justify-between gap-3 cursor-default group">
                  <dt className="text-[12px] italic text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors truncate">
                    {kpi.label}
                  </dt>
                  <dd className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
                      {kpi.value}
                    </span>
                    {score != null && (
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          intensityDotClass(score),
                        )}
                        aria-hidden
                      />
                    )}
                  </dd>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-zinc-900 dark:bg-zinc-800 border-zinc-700 max-w-xs"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-zinc-100">
                    {kpi.label}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {section.category}
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
      </dl>
    </div>
  </TooltipProvider>
);

export const DetailsSection: React.FC<DetailsSectionProps> = ({ sections }) => {
  return (
    <section className="py-6 border-t border-zinc-200 dark:border-zinc-800">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-500 dark:text-zinc-400">
          Details
        </h2>
        <div className="flex items-center gap-3 text-[10px] italic text-zinc-400 dark:text-zinc-600">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            above target
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            watch
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            below
          </span>
        </div>
      </div>
      <div>
        {sections.map((section, i) => (
          <div key={i}>
            {section.gated ? (
              <GatedKPISection
                hasAccess={false}
                title={section.category}
                requiredTier={section.requiredTier ?? "Starter"}
              >
                <DetailsRow section={section} />
              </GatedKPISection>
            ) : (
              <DetailsRow section={section} />
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
