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
  if (score == null) return "bg-v2-ring";
  if (score >= 0.5) return "bg-emerald-500";
  if (score >= 0.15) return "bg-emerald-400";
  if (score > -0.15) return "bg-v2-ring-strong";
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
    <div className="grid grid-cols-1 lg:grid-cols-[100px_1fr] gap-x-4 gap-y-2 py-3 border-t border-dashed border-v2-ring first:border-t-0">
      {/* Category label — magazine-style margin label */}
      <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-v2-ink-subtle lg:pt-0.5">
        {section.category}
      </div>

      {/* KPI grid — 1-col by default; 2-col only at xl, 3-col at 2xl,
          so the section stays readable when nested inside a half-width
          SoftCard (e.g. the dashboard's Alerts + Details split). */}
      <dl className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-x-4 gap-y-1.5 min-w-0">
        {section.kpis.map((kpi, i) => {
          const score = intensityScore(kpi.intensity);
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div className="flex items-baseline justify-between gap-2 cursor-default group min-w-0">
                  <dt className="text-[12px] italic text-v2-ink-muted group-hover:text-v2-ink transition-colors min-w-0 break-words">
                    {kpi.label}
                  </dt>
                  <dd className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="font-mono tabular-nums text-[12px] font-medium text-v2-ink whitespace-nowrap">
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
                className="bg-v2-card-dark border-v2-ring max-w-xs"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-v2-canvas">
                    {kpi.label}
                  </div>
                  <div className="text-[10px] text-v2-ink-subtle">
                    {section.category}
                  </div>
                  {kpi.intensity?.target != null && (
                    <div className="text-[10px] text-v2-ink-subtle">
                      Target:{" "}
                      <span className="font-mono tabular-nums text-v2-canvas">
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
    <section className="py-6 border-t border-v2-ring">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-[10px] uppercase tracking-[0.18em] font-semibold text-v2-ink-muted">
          Details
        </h2>
        <div className="flex items-center gap-3 text-[10px] italic text-v2-ink-subtle">
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
