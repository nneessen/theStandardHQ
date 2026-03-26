// src/features/close-kpi/components/KpiEmptyState.tsx

import React from "react";
import { BarChart3 } from "lucide-react";
import { WIDGET_REGISTRY, WIDGET_CATEGORIES } from "../config/widget-registry";
import type { WidgetType } from "../types/close-kpi.types";

interface KpiEmptyStateProps {
  onAddWidget: (widgetType: WidgetType) => void;
}

export const KpiEmptyState: React.FC<KpiEmptyStateProps> = ({
  onAddWidget,
}) => {
  return (
    <div className="py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 w-fit rounded-full bg-muted p-3">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="mb-1 text-sm font-semibold text-foreground">
          Build your KPI dashboard
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Pick a widget type below to start tracking your Close CRM metrics.
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-4">
        {WIDGET_CATEGORIES.map((cat) => {
          const widgets = Object.values(WIDGET_REGISTRY).filter(
            (w) => w.category === cat.id && !w.comingSoon,
          );
          if (widgets.length === 0) return null;

          return (
            <div key={cat.id}>
              <h3 className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {cat.label}
              </h3>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {widgets.map((w) => (
                  <button
                    key={w.type}
                    type="button"
                    className="rounded-md border border-border bg-card px-3 py-2 text-left shadow-sm transition-colors hover:bg-accent active:bg-accent/80"
                    onClick={() => onAddWidget(w.type)}
                  >
                    <div className="text-[11px] font-medium text-card-foreground">
                      {w.label}
                    </div>
                    <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                      {w.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
