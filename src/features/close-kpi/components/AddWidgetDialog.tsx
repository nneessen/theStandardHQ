// src/features/close-kpi/components/AddWidgetDialog.tsx
// Dialog for selecting a widget type to add to the custom dashboard.

import React, { useState } from "react";
import {
  Hash,
  BarChart3,
  Phone,
  TrendingUp,
  Timer,
  PhoneOff,
  Clock,
  Grid3X3,
  Zap,
  Repeat,
  PhoneCall,
  Flame,
  ThermometerSun,
  Brain,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  WIDGET_REGISTRY,
  WIDGET_CATEGORIES,
  type WidgetRegistryEntry,
} from "../config/widget-registry";
import { useAddWidget } from "../hooks/useCloseKpiDashboard";
import type { WidgetType, MetricCategory } from "../types/close-kpi.types";

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: string;
}

// ─── Icon Lookup ──────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Hash,
  BarChart3,
  Phone,
  TrendingUp,
  Timer,
  PhoneOff,
  Clock,
  Grid3X3,
  Zap,
  Repeat,
  PhoneCall,
  Flame,
  ThermometerSun,
  Brain,
};

function getIcon(name: string): React.ElementType {
  return ICON_MAP[name] ?? Hash;
}

// ─── Component ────────────────────────────────────────────────────

export const AddWidgetDialog: React.FC<AddWidgetDialogProps> = ({
  open,
  onOpenChange,
  dashboardId,
}) => {
  const addWidget = useAddWidget();
  const [addingType, setAddingType] = useState<WidgetType | null>(null);
  const [activeCategory, setActiveCategory] = useState<MetricCategory | "all">(
    "all",
  );

  const entries = Object.values(WIDGET_REGISTRY).filter((e) => !e.comingSoon);

  const filtered =
    activeCategory === "all"
      ? entries
      : entries.filter((e) => e.category === activeCategory);

  const handleAdd = async (entry: WidgetRegistryEntry) => {
    setAddingType(entry.type);
    try {
      await addWidget.mutateAsync({
        dashboardId,
        widgetType: entry.type,
        title: entry.label,
        size: entry.defaultSize,
        config: entry.defaultConfig,
      });
      onOpenChange(false);
    } finally {
      setAddingType(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Add Widget</DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Choose a widget type. You can configure it after adding.
          </DialogDescription>
        </DialogHeader>

        {/* Category Filter */}
        <div className="flex items-center gap-0.5 bg-v2-canvas rounded-md p-0.5">
          <button
            onClick={() => setActiveCategory("all")}
            className={cn(
              "px-2 py-1 text-[10px] font-medium rounded transition-all",
              activeCategory === "all"
                ? "bg-v2-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {WIDGET_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-2 py-1 text-[10px] font-medium rounded transition-all",
                activeCategory === cat.id
                  ? "bg-v2-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Widget Grid */}
        <div className="grid grid-cols-2 gap-1.5 max-h-[340px] overflow-y-auto pr-0.5">
          {filtered.map((entry) => {
            const Icon = getIcon(entry.icon);
            const isAdding = addingType === entry.type;

            return (
              <button
                key={entry.type}
                onClick={() => handleAdd(entry)}
                disabled={!!addingType}
                className={cn(
                  "flex items-start gap-2 rounded-md border border-v2-ring p-2 text-left transition-all",
                  "hover:border-v2-ring-strong dark:hover:border-v2-ring hover:bg-v2-canvas",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                )}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-v2-ring">
                  {isAdding ? (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  ) : (
                    <Icon className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate">
                    {entry.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                    {entry.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
