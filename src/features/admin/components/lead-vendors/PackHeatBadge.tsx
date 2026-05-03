// src/features/admin/components/lead-vendors/PackHeatBadge.tsx

import {
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Snowflake,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { HeatScoreV2, HeatLevel } from "@/types/lead-purchase.types";
import {
  getHeatColor,
  getHeatBgColor,
  getTrendArrow,
} from "@/hooks/lead-purchases";

function HeatIcon({
  level,
  className,
}: {
  level: HeatLevel;
  className?: string;
}) {
  switch (level) {
    case "hot":
      return <Flame className={className} />;
    case "warming":
      return <TrendingUp className={className} />;
    case "neutral":
      return <Minus className={className} />;
    case "cooling":
      return <TrendingDown className={className} />;
    case "cold":
      return <Snowflake className={className} />;
  }
}

export function PackHeatBadge({ heat }: { heat?: HeatScoreV2 }) {
  if (!heat)
    return <span className="text-[10px] text-muted-foreground">&mdash;</span>;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-medium cursor-default",
              getHeatBgColor(heat.level),
              getHeatColor(heat.level),
            )}
          >
            <HeatIcon level={heat.level} className="h-2.5 w-2.5" />
            <span>{heat.score}</span>
            <span className="text-[9px]">{getTrendArrow(heat.trend)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="text-[10px] space-y-1 max-w-[220px]"
        >
          <div className="font-semibold">Heat Score: {heat.score}/100</div>
          <div className="space-y-0.5 text-muted-foreground">
            <div>Conversion: {heat.breakdown.conversionRate}/25</div>
            <div>ROI: {heat.breakdown.roi}/20</div>
            <div>Premium/Lead: {heat.breakdown.premiumPerLead}/15</div>
            <div>Recency: {heat.breakdown.recency}/15</div>
            <div>Velocity: {heat.breakdown.velocity}/15</div>
            <div>Consistency: {heat.breakdown.agentConsistency}/10</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
