// src/features/close-kpi/components/CustomDashboard.tsx
// User's custom dashboard with add/edit/delete widget functionality.

import React, { useState } from "react";
import {
  AlertCircle,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WidgetRenderer } from "./WidgetRenderer";
import { WidgetSkeleton } from "./skeletons/WidgetSkeleton";
import { AddWidgetDialog } from "./AddWidgetDialog";
import { WidgetConfigSheet } from "./WidgetConfigSheet";
import {
  useKpiDashboard,
  useDeleteWidget,
} from "../hooks/useCloseKpiDashboard";
import { useKpiWidgetData } from "../hooks/useKpiWidgetData";
import type {
  CloseKpiWidget,
  GlobalDashboardConfig,
  WidgetSize,
} from "../types/close-kpi.types";

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

  const minHeightClass =
    MIN_HEIGHT_CLASS[widget.size] ?? MIN_HEIGHT_CLASS.medium;

  return (
    <div
      className={cn(
        "bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm",
        isEditMode && "ring-1 ring-zinc-300 dark:ring-zinc-700",
      )}
    >
      {/* Header */}
      <div className="flex h-7 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-2">
        <span className="truncate text-[11px] font-semibold text-foreground">
          {widget.title}
        </span>
        {isEditMode && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => onConfigure(widget)}
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Configure"
            >
              <Settings className="h-3 w-3 text-muted-foreground" />
            </button>
            <button
              onClick={() => onDelete(widget.id)}
              disabled={isDeleting}
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title="Remove widget"
            >
              {isDeleting ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`p-2 ${isLoading && !data ? minHeightClass : ""}`}>
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
          <WidgetRenderer type={widget.widget_type} data={data} />
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

        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 py-12">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 mb-3">
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
