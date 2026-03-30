// src/features/close-kpi/components/PrebuiltWidget.tsx
// Simplified widget card for the pre-built dashboard layout.
// No drag, no delete, no config panel — just title, tooltip, and content.

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { WidgetSkeleton } from "./skeletons/WidgetSkeleton";
import { WIDGET_TOOLTIPS } from "../config/prebuilt-layout";
import type { WidgetSize } from "../types/close-kpi.types";

interface PrebuiltWidgetProps {
  title: string;
  tooltipKey: string;
  size: WidgetSize | "full";
  colSpan?: string;
  data: unknown;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  children: React.ReactNode;
}

const HEIGHT_CLASS: Record<string, string> = {
  small: "h-[6rem]",
  medium: "h-[12rem]",
  large: "h-[16rem]",
  full: "h-[20rem]",
};

export const PrebuiltWidget: React.FC<PrebuiltWidgetProps> = ({
  title,
  tooltipKey,
  size,
  colSpan,
  data,
  isLoading,
  error,
  onRetry,
  children,
}) => {
  const tooltip = WIDGET_TOOLTIPS[tooltipKey];
  const heightClass = HEIGHT_CLASS[size] ?? HEIGHT_CLASS.medium;

  return (
    <div
      className={`bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm ${colSpan ?? ""}`}
    >
      {/* Header */}
      <div className="flex h-7 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-2">
        <div className="flex items-center gap-1 min-w-0">
          <span className="truncate text-[11px] font-semibold text-foreground">
            {title}
          </span>
        </div>
        {tooltip && (
          <MetricTooltip
            title={tooltip.title}
            description={tooltip.description}
            formula={tooltip.formula}
            note={tooltip.note}
          />
        )}
      </div>

      {/* Content */}
      <div className={`overflow-y-auto p-2 ${heightClass}`}>
        {isLoading && !data ? (
          <WidgetSkeleton size={size === "full" ? "large" : size} />
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <AlertCircle className="mb-1 h-4 w-4 text-destructive" />
            <p className="text-[10px] font-medium text-destructive">
              Failed to load
            </p>
            <p className="mt-0.5 max-w-[200px] text-[9px] text-muted-foreground">
              {error.message}
            </p>
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-5 text-[10px]"
                onClick={onRetry}
              >
                <RefreshCw className="mr-1 h-2.5 w-2.5" />
                Retry
              </Button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};
