// src/features/close-kpi/components/WidgetWrapper.tsx

import React, { useState } from "react";
import {
  GripVertical,
  Settings2,
  X,
  AlertCircle,
  RefreshCw,
  Check,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { WidgetSkeleton } from "./skeletons/WidgetSkeleton";
import type { CloseKpiWidget, WidgetResult } from "../types/close-kpi.types";
import { getWidgetColSpan } from "../config/widget-registry";

const DATE_RANGE_LABELS: Record<string, string> = {
  today: "Today",
  this_week: "This Week",
  this_month: "This Month",
  last_7_days: "Last 7 Days",
  last_30_days: "Last 30 Days",
  last_90_days: "Last 90 Days",
  this_quarter: "This Quarter",
  this_year: "This Year",
  custom: "Custom",
};

interface WidgetWrapperProps {
  widget: CloseKpiWidget;
  data: WidgetResult | null;
  isLoading: boolean;
  error: Error | null;
  onRemove: (widgetId: string) => void;
  onRetry?: () => void;
  onApplyConfig?: () => void;
  isApplying?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  children: React.ReactNode;
  configPanel?: React.ReactNode;
}

export const WidgetWrapper: React.FC<WidgetWrapperProps> = ({
  widget,
  data,
  isLoading,
  error,
  onRemove,
  onRetry,
  onApplyConfig,
  isApplying,
  dragHandleProps,
  children,
  configPanel,
}) => {
  const [configOpen, setConfigOpen] = useState(false);
  const colSpan = getWidgetColSpan(widget.widget_type, widget.size);
  const heightClass =
    widget.size === "small"
      ? "h-[6rem]"
      : widget.size === "medium"
        ? "h-[12rem]"
        : "h-[16rem]";

  const handleApply = () => {
    onApplyConfig?.();
    setConfigOpen(false);
  };

  return (
    <div
      className={`rounded-lg border border-border bg-card shadow-sm ${
        colSpan === 2 ? "col-span-2" : "col-span-1"
      }`}
    >
      <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
        {/* Header */}
        <div className="flex h-7 items-center justify-between border-b border-border px-2">
          <div className="flex min-w-0 items-center gap-1">
            <div
              {...dragHandleProps}
              className="cursor-grab text-muted-foreground/50 hover:text-muted-foreground"
            >
              <GripVertical className="h-3 w-3" />
            </div>
            <span className="truncate text-[11px] font-semibold text-card-foreground">
              {widget.title}
            </span>
            <span className="flex shrink-0 items-center gap-0.5 rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
              <Calendar className="h-2.5 w-2.5" />
              {DATE_RANGE_LABELS[widget.config.dateRange] ??
                widget.config.dateRange}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            {configPanel && (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-5 w-5 p-0 ${
                    configOpen ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Settings2 className="h-3 w-3" />
                </Button>
              </CollapsibleTrigger>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(widget.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Config Panel (collapsible) */}
        {configPanel && (
          <CollapsibleContent className="border-b border-border bg-muted">
            <div className="p-2">{configPanel}</div>
            <div className="flex justify-end border-t border-border px-2 py-1.5">
              <Button
                size="sm"
                className="h-6 text-[10px]"
                onClick={handleApply}
                disabled={isApplying}
              >
                <Check className="mr-1 h-3 w-3" />
                {isApplying ? "Saving..." : "Apply"}
              </Button>
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>

      {/* Content */}
      <div className={`overflow-y-auto p-2 ${heightClass}`}>
        {isLoading && !data ? (
          <WidgetSkeleton size={widget.size} />
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
