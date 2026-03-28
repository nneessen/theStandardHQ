// src/features/close-kpi/components/WidgetGrid.tsx

import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WidgetWrapper } from "./WidgetWrapper";
import { StatCardWidget } from "./widgets/StatCardWidget";
import { StatusDistributionWidget } from "./widgets/StatusDistributionWidget";
import { CallAnalyticsWidget } from "./widgets/CallAnalyticsWidget";
import { OpportunitySummaryWidget } from "./widgets/OpportunitySummaryWidget";
import { VmRateSmartViewWidget } from "./widgets/VmRateSmartViewWidget";
import { BestCallTimesWidget } from "./widgets/BestCallTimesWidget";
import { CrossReferenceWidget } from "./widgets/CrossReferenceWidget";
import { SpeedToLeadWidget } from "./widgets/SpeedToLeadWidget";
import { ContactCadenceWidget } from "./widgets/ContactCadenceWidget";
import { DialAttemptsWidget } from "./widgets/DialAttemptsWidget";
import { StatCardConfig } from "./config-forms/StatCardConfig";
import { StatusDistributionConfig } from "./config-forms/StatusDistributionConfig";
import { LifecycleTrackerConfig } from "./config-forms/LifecycleTrackerConfig";
import { OpportunitySummaryConfig } from "./config-forms/OpportunitySummaryConfig";
import { CallAnalyticsConfig } from "./config-forms/CallAnalyticsConfig";
import { VmRateSmartViewConfig } from "./config-forms/VmRateSmartViewConfig";
import { CrossReferenceConfig } from "./config-forms/CrossReferenceConfig";
import { DateRangeOnlyConfig } from "./config-forms/DateRangeOnlyConfig";
import { useKpiWidgetData } from "../hooks/useKpiWidgetData";
import { useUpdateWidget } from "../hooks/useCloseKpiDashboard";
import type {
  CloseKpiWidget,
  GlobalDashboardConfig,
  WidgetConfig,
  StatCardResult,
  StatusDistributionResult,
  OpportunitySummaryResult,
  CallAnalyticsResult,
  LifecycleTrackerResult,
  StatCardConfig as StatCardConfigType,
  StatusDistributionConfig as StatusDistConfigType,
  LifecycleTrackerConfig as LifecycleConfigType,
  OpportunitySummaryConfig as OppConfigType,
  CallAnalyticsConfig as CallConfigType,
  VmRateSmartViewConfig as VmRateConfigType,
  VmRateSmartViewResult,
  BestCallTimesResult,
  CrossReferenceResult,
  CrossReferenceConfig as CrossRefConfigType,
  SpeedToLeadResult,
  ContactCadenceResult,
  DialAttemptsResult,
} from "../types/close-kpi.types";

interface WidgetGridProps {
  widgets: CloseKpiWidget[];
  globalConfig?: GlobalDashboardConfig;
  onRemoveWidget: (widgetId: string) => void;
  onReorder: (widgets: { id: string; position_order: number }[]) => void;
}

export const WidgetGrid: React.FC<WidgetGridProps> = ({
  widgets,
  globalConfig,
  onRemoveWidget,
  onReorder,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = widgets.findIndex((w) => w.id === active.id);
    const newIndex = widgets.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...widgets];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    onReorder(reordered.map((w, i) => ({ id: w.id, position_order: i })));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={widgets.map((w) => w.id)}
        strategy={rectSortingStrategy}
      >
        <div className="grid auto-rows-auto grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {widgets.map((widget) => (
            <SortableWidgetItem
              key={widget.id}
              widget={widget}
              globalConfig={globalConfig}
              onRemove={onRemoveWidget}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

// ─── Sortable Widget Item ──────────────────────────────────────────

interface SortableWidgetItemProps {
  widget: CloseKpiWidget;
  globalConfig?: GlobalDashboardConfig;
  onRemove: (widgetId: string) => void;
}

const SortableWidgetItem: React.FC<SortableWidgetItemProps> = ({
  widget,
  globalConfig,
  onRemove,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: widget.id,
    });
  const { data, isLoading, error, refetch } = useKpiWidgetData(
    widget,
    globalConfig,
  );
  const updateWidget = useUpdateWidget();
  const [draftConfig, setDraftConfig] = useState<WidgetConfig>(widget.config);

  // Reset draft when widget config changes (e.g. after save)
  const configKey = JSON.stringify(widget.config);
  const [lastConfigKey, setLastConfigKey] = useState(configKey);
  if (configKey !== lastConfigKey) {
    setDraftConfig(widget.config);
    setLastConfigKey(configKey);
  }

  const handleApplyConfig = () => {
    updateWidget.mutate({
      widgetId: widget.id,
      updates: { config: draftConfig },
    });
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <WidgetWrapper
        widget={widget}
        data={data ?? null}
        isLoading={isLoading}
        error={error}
        onRemove={onRemove}
        onRetry={() => refetch()}
        dragHandleProps={listeners}
        onApplyConfig={handleApplyConfig}
        isApplying={updateWidget.isPending}
        configPanel={
          <WidgetConfigForm
            widgetType={widget.widget_type}
            config={draftConfig}
            onChange={setDraftConfig}
          />
        }
      >
        <WidgetContent widget={widget} data={data ?? null} />
      </WidgetWrapper>
    </div>
  );
};

// ─── Widget Config Form Router ─────────────────────────────────────

const WidgetConfigForm: React.FC<{
  widgetType: string;
  config: WidgetConfig;
  onChange: (config: WidgetConfig) => void;
}> = ({ widgetType, config, onChange }) => {
  switch (widgetType) {
    case "stat_card":
      return (
        <StatCardConfig
          config={config as StatCardConfigType}
          onChange={onChange}
        />
      );
    case "status_distribution":
      return (
        <StatusDistributionConfig
          config={config as StatusDistConfigType}
          onChange={onChange}
        />
      );
    case "lifecycle_tracker":
      return (
        <LifecycleTrackerConfig
          config={config as LifecycleConfigType}
          onChange={onChange}
        />
      );
    case "opportunity_summary":
      return (
        <OpportunitySummaryConfig
          config={config as OppConfigType}
          onChange={onChange}
        />
      );
    case "call_analytics":
      return (
        <CallAnalyticsConfig
          config={config as CallConfigType}
          onChange={onChange}
        />
      );
    case "vm_rate_smart_view":
      return (
        <VmRateSmartViewConfig
          config={config as VmRateConfigType}
          onChange={onChange}
        />
      );
    case "cross_reference":
      return (
        <CrossReferenceConfig
          config={config as CrossRefConfigType}
          onChange={onChange}
        />
      );
    case "best_call_times":
    case "speed_to_lead":
    case "contact_cadence":
    case "dial_attempts":
      return (
        <DateRangeOnlyConfig
          config={config}
          onChange={onChange}
          showSmartViewFilter={widgetType !== "best_call_times"}
        />
      );
    default:
      return (
        <p className="text-[10px] text-muted-foreground">
          No configuration available
        </p>
      );
  }
};

// ─── Widget Content Router ─────────────────────────────────────────

const WidgetContent: React.FC<{
  widget: CloseKpiWidget;
  data: unknown;
}> = ({ widget, data }) => {
  if (!data) return null;

  switch (widget.widget_type) {
    case "stat_card":
      return <StatCardWidget data={data as StatCardResult} />;
    case "status_distribution":
      return (
        <StatusDistributionWidget
          data={data as StatusDistributionResult}
          label={widget.title}
        />
      );
    case "call_analytics":
      return <CallAnalyticsWidget data={data as CallAnalyticsResult} />;
    case "opportunity_summary":
      return (
        <OpportunitySummaryWidget data={data as OpportunitySummaryResult} />
      );
    case "lifecycle_tracker": {
      const lcData = data as LifecycleTrackerResult;
      const lcConfig = widget.config as LifecycleConfigType;
      const t = lcData.transitions?.[0];
      const fromLabel = lcConfig.fromStatus || "Any";
      const toLabel = lcConfig.toStatus || "Next Status";
      if (!t || t.sampleSize === 0)
        return (
          <div className="flex h-full flex-col justify-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {fromLabel} → {toLabel}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              No leads transitioned between these statuses in this period. Try a
              wider date range (Last 30 Days or Last 90 Days).
            </p>
          </div>
        );
      return (
        <div className="flex h-full flex-col justify-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {fromLabel} → {toLabel}
          </p>
          <span className="font-mono text-2xl font-bold text-foreground">
            {t.avgDays} days
          </span>
          <div className="mt-1 space-y-0.5">
            <p className="text-[10px] text-muted-foreground">
              Median: {t.medianDays}d · Range: {t.minDays}d – {t.maxDays}d
            </p>
            <p className="text-[10px] text-muted-foreground">
              Sample: {t.sampleSize} leads
            </p>
          </div>
        </div>
      );
    }
    case "vm_rate_smart_view": {
      const vmData = data as VmRateSmartViewResult;
      const vmConfig = widget.config as VmRateConfigType;
      return (
        <VmRateSmartViewWidget
          data={vmData}
          vmThreshold={vmConfig.vmThreshold ?? 40}
        />
      );
    }
    case "best_call_times":
      return <BestCallTimesWidget data={data as BestCallTimesResult} />;
    case "cross_reference":
      return <CrossReferenceWidget data={data as CrossReferenceResult} />;
    case "speed_to_lead":
      return <SpeedToLeadWidget data={data as SpeedToLeadResult} />;
    case "contact_cadence":
      return <ContactCadenceWidget data={data as ContactCadenceResult} />;
    case "dial_attempts":
      return <DialAttemptsWidget data={data as DialAttemptsResult} />;
    default:
      return null;
  }
};
