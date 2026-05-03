// src/features/close-kpi/components/CustomDashboard.tsx
// User's custom dashboard with add/edit/delete widget functionality.

import React, { useState } from "react";
import {
  AlertCircle,
  Calendar,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { WidgetRenderer } from "./WidgetRenderer";
import { WidgetSkeleton } from "./skeletons/WidgetSkeleton";
import { AddWidgetDialog } from "./AddWidgetDialog";
import { WidgetConfigSheet } from "./WidgetConfigSheet";
import {
  useKpiDashboard,
  useDeleteWidget,
  useUpdateWidget,
} from "../hooks/useCloseKpiDashboard";
import { useKpiWidgetData } from "../hooks/useKpiWidgetData";
import { getAccentStyle, DATE_RANGE_LABELS } from "../lib/widget-styles";
import type {
  CloseKpiWidget,
  DateRangePreset,
  GlobalDashboardConfig,
  WidgetSize,
} from "../types/close-kpi.types";

// ─── Date Range Options (shared with GlobalDateRange) ─────────────

const DATE_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "last_90_days", label: "Last 90 Days" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
];

// ─── Per-Widget Card ──────────────────────────────────────────────

interface WidgetCardProps {
  widget: CloseKpiWidget;
  isEditMode: boolean;
  onConfigure: (widget: CloseKpiWidget) => void;
  onDelete: (widgetId: string) => void;
  isDeleting: boolean;
  globalConfig?: GlobalDashboardConfig;
}

const MIN_HEIGHT_CLASS: Record<WidgetSize, string> = {
  small: "min-h-[4rem]",
  medium: "min-h-[6rem]",
  large: "min-h-[8rem]",
};

const WidgetCard: React.FC<WidgetCardProps> = ({
  widget,
  isEditMode,
  onConfigure,
  onDelete,
  isDeleting,
  globalConfig,
}) => {
  const { data, isLoading, error, refetch } = useKpiWidgetData(
    widget,
    globalConfig,
  );
  const updateWidget = useUpdateWidget();

  const accent = getAccentStyle(widget.config.accentColor);
  const effectiveDateRange =
    widget.config.dateRange || globalConfig?.dateRange || "this_month";
  const dateLabel = DATE_RANGE_LABELS[effectiveDateRange] ?? effectiveDateRange;

  const minHeightClass =
    MIN_HEIGHT_CLASS[widget.size] ?? MIN_HEIGHT_CLASS.medium;

  const handleDateRangeChange = (newRange: DateRangePreset) => {
    updateWidget.mutate({
      widgetId: widget.id,
      updates: {
        config: { ...widget.config, dateRange: newRange },
      },
    });
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border/80  shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border-l-[3px]",
        accent.border,
        isEditMode && "ring-1 ring-border",
      )}
    >
      {/* Header — tinted background */}
      <div
        className={cn(
          "flex items-center justify-between px-2.5 py-1.5 border-b border-border/60 /60",
          accent.headerBg,
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="truncate text-[11px] font-semibold text-foreground">
            {widget.title}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Date range — dropdown in edit mode, badge in view mode */}
          {isEditMode ? (
            <Select
              value={effectiveDateRange}
              onValueChange={(v) => handleDateRangeChange(v as DateRangePreset)}
            >
              <SelectTrigger className="h-5 w-[90px] text-[9px] border-none bg-transparent shadow-none px-1 gap-0.5">
                <Calendar className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-[10px]"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground bg-muted/60 dark:bg-muted/40 rounded px-1.5 py-0.5">
              <Calendar className="h-2.5 w-2.5" />
              {dateLabel}
            </span>
          )}

          {isEditMode && (
            <>
              <button
                onClick={() => onConfigure(widget)}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted/60 dark:hover:bg-card-dark/60 transition-colors"
                title="Configure"
              >
                <Settings className="h-3 w-3 text-muted-foreground" />
              </button>
              <button
                onClick={() => onDelete(widget.id)}
                disabled={isDeleting}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-destructive/20/60 dark:hover:bg-destructive/15 transition-colors"
                title="Remove widget"
              >
                {isDeleting ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : (
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        className={cn(
          "p-2.5",
          isLoading && !data ? minHeightClass : "",
          "bg-card",
        )}
      >
        {isLoading && !data ? (
          <WidgetSkeleton size={widget.size} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center text-center py-3">
            <AlertCircle className="mb-1 h-4 w-4 text-destructive" />
            <p className="text-[10px] font-medium text-destructive">
              Failed to load
            </p>
            <p className="mt-0.5 max-w-[200px] text-[9px] text-muted-foreground">
              {error.message}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-5 text-[10px]"
              onClick={() => refetch()}
            >
              <RefreshCw className="mr-1 h-2.5 w-2.5" />
              Retry
            </Button>
          </div>
        ) : (
          <WidgetRenderer
            type={widget.widget_type}
            data={data}
            config={widget.config}
          />
        )}
      </div>
    </div>
  );
};

// ─── Main Custom Dashboard ────────────────────────────────────────

export const CustomDashboard: React.FC = () => {
  const { data: dashboardData, isLoading: isDashboardLoading } =
    useKpiDashboard();
  const deleteWidget = useDeleteWidget();

  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [configWidget, setConfigWidget] = useState<CloseKpiWidget | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const dashboard = dashboardData?.dashboard ?? null;
  const widgets = dashboardData?.widgets ?? [];

  const handleDelete = async (widgetId: string) => {
    setDeletingId(widgetId);
    try {
      await deleteWidget.mutateAsync(widgetId);
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Loading State ──────────────────────────────────────────
  if (isDashboardLoading) {
    return (
      <div className="space-y-3 pb-4">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-[11px] text-muted-foreground">
            Loading your dashboard...
          </span>
        </div>
      </div>
    );
  }

  // ─── Empty State ────────────────────────────────────────────
  if (widgets.length === 0 && dashboard) {
    return (
      <div className="space-y-3 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-foreground">My Dashboard</h2>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border  bg-background/50 dark:bg-card-dark/50 py-12">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-[11px] font-medium text-foreground mb-1">
            Add your first widget
          </p>
          <p className="text-[10px] text-muted-foreground mb-3 max-w-xs text-center">
            Build a custom dashboard by adding KPI widgets. Each widget pulls
            real-time data from your Close CRM.
          </p>
          <Button
            size="sm"
            className="h-7 text-[10px] gap-1"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-3 w-3" />
            Add Widget
          </Button>
        </div>

        <AddWidgetDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          dashboardId={dashboard.id}
        />
      </div>
    );
  }

  if (!dashboard) return null;

  // ─── Populated Dashboard ────────────────────────────────────
  return (
    <div className="space-y-3 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-foreground">My Dashboard</h2>
        <div className="flex items-center gap-1.5">
          {isEditMode && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] gap-1"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="h-3 w-3" />
              Add Widget
            </Button>
          )}
          <Button
            variant={isEditMode ? "default" : "ghost"}
            size="sm"
            className="h-7 text-[10px] gap-1"
            onClick={() => setIsEditMode((prev) => !prev)}
          >
            <Pencil className="h-3 w-3" />
            {isEditMode ? "Done" : "Edit"}
          </Button>
        </div>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {widgets.map((widget) => (
          <WidgetCard
            key={widget.id}
            widget={widget}
            isEditMode={isEditMode}
            onConfigure={setConfigWidget}
            onDelete={handleDelete}
            isDeleting={deletingId === widget.id}
            globalConfig={dashboard.global_config}
          />
        ))}
      </div>

      {/* Add Widget Dialog */}
      <AddWidgetDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        dashboardId={dashboard.id}
      />

      {/* Config Sheet */}
      <WidgetConfigSheet
        open={!!configWidget}
        onOpenChange={(open) => {
          if (!open) setConfigWidget(null);
        }}
        widget={configWidget}
      />
    </div>
  );
};
