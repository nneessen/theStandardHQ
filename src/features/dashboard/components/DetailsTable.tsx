import React from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { KPISection, KPIIntensity } from "../../../types/dashboard.types";
import { GatedKPISection } from "./GatedKPISection";

interface DetailsTableProps {
  sections: KPISection[];
}

/**
 * Same intensity → score mapping the prior DetailsSection used. Returns
 * a value in [-1, 1] where positive = above target / good direction.
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

function valueClass(score: number | null): string {
  if (score == null) return "text-v2-ink";
  if (score >= 0.5) return "text-success";
  if (score >= 0.15) return "text-success/80";
  if (score > -0.15) return "text-v2-ink";
  if (score > -0.5) return "text-warning";
  return "text-destructive";
}

const StatusGlyph: React.FC<{ score: number | null }> = ({ score }) => {
  if (score == null) return null;
  if (score >= 0.15)
    return <ArrowUp className="h-3 w-3 text-success shrink-0" aria-hidden />;
  if (score > -0.15)
    return (
      <Minus className="h-3 w-3 text-v2-ink-subtle shrink-0" aria-hidden />
    );
  return (
    <ArrowDown className="h-3 w-3 text-destructive shrink-0" aria-hidden />
  );
};

const DetailsColumn: React.FC<{ section: KPISection }> = ({ section }) => (
  <TooltipProvider delayDuration={200}>
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-v2-ink-muted pb-2 mb-3 border-b border-v2-ring">
        {section.category}
      </div>
      <dl className="space-y-2">
        {section.kpis.map((kpi, i) => {
          const score = intensityScore(kpi.intensity);
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div className="flex items-baseline justify-between gap-3 cursor-default group min-w-0 py-0.5">
                  <dt className="text-[12px] text-v2-ink-muted group-hover:text-v2-ink transition-colors min-w-0 truncate">
                    {kpi.label}
                  </dt>
                  <dd className="flex items-center gap-1 flex-shrink-0">
                    <span
                      className={cn(
                        "font-mono tabular-nums text-[13px] font-semibold whitespace-nowrap",
                        valueClass(score),
                      )}
                    >
                      {kpi.value}
                    </span>
                    <StatusGlyph score={score} />
                  </dd>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-card-dark border-border max-w-xs"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-background">
                    {kpi.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {section.category}
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
      </dl>
    </div>
  </TooltipProvider>
);

export const DetailsTable: React.FC<DetailsTableProps> = ({ sections }) => {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-[10px] uppercase tracking-[0.18em] font-semibold text-v2-ink-muted">
          Details
        </h2>
        <div className="flex items-center gap-3 text-[10px] text-v2-ink-subtle">
          <span className="flex items-center gap-1">
            <ArrowUp className="h-2.5 w-2.5 text-success" aria-hidden />
            ahead
          </span>
          <span className="flex items-center gap-1">
            <Minus className="h-2.5 w-2.5 text-v2-ink-subtle" aria-hidden />
            steady
          </span>
          <span className="flex items-center gap-1">
            <ArrowDown className="h-2.5 w-2.5 text-destructive" aria-hidden />
            behind
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
        {sections.map((section, i) => (
          <div key={i}>
            {section.gated ? (
              <GatedKPISection
                hasAccess={false}
                title={section.category}
                requiredTier={section.requiredTier ?? "Starter"}
              >
                <DetailsColumn section={section} />
              </GatedKPISection>
            ) : (
              <DetailsColumn section={section} />
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
