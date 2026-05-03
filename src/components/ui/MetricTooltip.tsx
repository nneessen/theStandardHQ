// src/components/ui/MetricTooltip.tsx

import * as React from "react";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface MetricTooltipProps {
  title: string;
  description: string;
  formula?: string;
  note?: string;
}

/**
 * MetricTooltip Component
 *
 * Displays contextual help for dashboard metrics using Radix UI tooltips.
 * Automatically handles positioning, collision detection, and theme styling.
 *
 * @param title - Bold header text
 * @param description - Main explanatory text
 * @param formula - Optional formula in monospace (for technical details)
 * @param note - Optional warning/tip (shown with warning icon)
 */
export const MetricTooltip: React.FC<MetricTooltipProps> = ({
  title,
  description,
  formula,
  note,
}) => {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="ml-1.5 inline-flex items-center justify-center"
            aria-label={`More information about ${title}`}
          >
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors cursor-help" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          align="start"
          className="max-w-sm p-3 space-y-2"
          collisionPadding={8}
          sideOffset={8}
        >
          <div className="font-semibold text-primary">{title}</div>
          <div className="text-sm leading-relaxed">{description}</div>
          {formula && (
            <div className="bg-muted px-2 py-1.5 rounded text-xs font-mono border border-border">
              {formula}
            </div>
          )}
          {note && (
            <div className="text-xs text-warning border-t border-border pt-2 mt-2">
              <span className="mr-1">⚠️</span>
              {note}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
