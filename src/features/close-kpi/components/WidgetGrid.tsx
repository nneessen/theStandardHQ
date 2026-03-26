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
import { VmRateSmartViewWidget } from "./widgets/VmRateSmartViewWidget";
import { StatCardConfig } from "./config-forms/StatCardConfig";
import { StatusDistributionConfig } from "./config-forms/StatusDistributionConfig";
import { SmartViewMonitorConfig } from "./config-forms/SmartViewMonitorConfig";
import { LifecycleTrackerConfig } from "./config-forms/LifecycleTrackerConfig";
import { ActivityTimelineConfig } from "./config-forms/ActivityTimelineConfig";
import { CrossReferenceConfig } from "./config-forms/CrossReferenceConfig";
import { OpportunitySummaryConfig } from "./config-forms/OpportunitySummaryConfig";
import { CallAnalyticsConfig } from "./config-forms/CallAnalyticsConfig";
import { CustomFieldBreakdownConfig } from "./config-forms/CustomFieldBreakdownConfig";
import { VmRateSmartViewConfig } from "./config-forms/VmRateSmartViewConfig";
import { useKpiWidgetData } from "../hooks/useKpiWidgetData";
import { useUpdateWidget } from "../hooks/useCloseKpiDashboard";
import type {
  CloseKpiWidget,
  GlobalDashboardConfig,
  WidgetConfig,
  StatCardResult,
  StatusDistributionResult,
  StatCardConfig as StatCardConfigType,
  StatusDistributionConfig as StatusDistConfigType,
  SmartViewMonitorConfig as SmartViewConfigType,
  LifecycleTrackerConfig as LifecycleConfigType,
  ActivityTimelineConfig as ActivityConfigType,
  CrossReferenceConfig as CrossRefConfigType,
  OpportunitySummaryConfig as OppConfigType,
  CallAnalyticsConfig as CallConfigType,
  CustomFieldBreakdownConfig as CFConfigType,
  VmRateSmartViewConfig as VmRateConfigType,
  VmRateSmartViewResult,
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
    case "smart_view_monitor":
      return (
        <SmartViewMonitorConfig
          config={config as SmartViewConfigType}
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
    case "activity_timeline":
      return (
        <ActivityTimelineConfig
          config={config as ActivityConfigType}
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
    case "custom_field_breakdown":
      return (
        <CustomFieldBreakdownConfig
          config={config as CFConfigType}
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
        <StatusDistributionWidget data={data as StatusDistributionResult} />
      );
    case "call_analytics": {
      const callData = data as Record<string, unknown>;
      const metric = (widget.config as unknown as Record<string, unknown>)
        .metric as string;
      let val = 0;
      let lbl = "Calls";
      let unit = "";
      if (callData) {
        switch (metric) {
          case "calls_total":
            val = Number(callData.total ?? 0);
            break;
          case "calls_inbound":
            val = Number(callData.inbound ?? 0);
            lbl = "Inbound";
            break;
          case "calls_outbound":
            val = Number(callData.outbound ?? 0);
            lbl = "Outbound";
            break;
          case "calls_answered":
            val = Number(callData.answered ?? 0);
            lbl = "Answered";
            break;
          case "calls_voicemail":
            val = Number(callData.voicemail ?? 0);
            lbl = "Voicemail";
            break;
          case "calls_missed":
            val = Number(callData.missed ?? 0);
            lbl = "Missed";
            break;
          case "call_connect_rate":
            val = Number(callData.connectRate ?? 0);
            lbl = "Connect Rate";
            unit = "%";
            break;
          case "call_duration_total":
            val = Number(callData.totalDurationMin ?? 0);
            lbl = "Total Minutes";
            unit = " min";
            break;
          case "call_duration_avg":
            val = Number(callData.avgDurationMin ?? 0);
            lbl = "Avg Duration";
            unit = " min";
            break;
          default:
            val = Number(callData.total ?? 0);
        }
      }
      return (
        <StatCardWidget
          data={{ value: val, label: lbl, unit: unit || undefined }}
        />
      );
    }
    case "opportunity_summary": {
      const oppData = data as Record<string, unknown>;
      const oppMetric = (widget.config as unknown as Record<string, unknown>)
        .metric as string;
      let oppVal = 0;
      let oppLbl = "Pipeline";
      let oppUnit = "";
      if (oppData) {
        switch (oppMetric) {
          case "pipeline_value":
            oppVal = Number(oppData.totalValue ?? 0);
            oppLbl = "Pipeline Value";
            oppUnit = "$";
            break;
          case "pipeline_count":
            oppVal = Number(oppData.activeCount ?? 0);
            oppLbl = "Active Opps";
            break;
          case "win_rate":
            oppVal = Number(oppData.winRate ?? 0);
            oppLbl = "Win Rate";
            oppUnit = "%";
            break;
          case "avg_deal_size":
            oppVal = Number(oppData.avgDealSize ?? 0);
            oppLbl = "Avg Deal";
            oppUnit = "$";
            break;
          case "deals_won":
            oppVal = Number(oppData.wonCount ?? 0);
            oppLbl = "Deals Won";
            break;
          case "deals_lost":
            oppVal = Number(oppData.lostCount ?? 0);
            oppLbl = "Deals Lost";
            break;
          case "deals_won_value":
            oppVal = Number(oppData.wonValue ?? 0);
            oppLbl = "Revenue Won";
            oppUnit = "$";
            break;
          case "avg_time_to_close":
            oppVal = Number(oppData.avgTimeToCloseDays ?? 0);
            oppLbl = "Avg Days to Close";
            break;
          default:
            oppVal = Number(oppData.total ?? 0);
        }
      }
      return (
        <StatCardWidget
          data={{ value: oppVal, label: oppLbl, unit: oppUnit || undefined }}
        />
      );
    }
    case "lifecycle_tracker": {
      const lcData = data as Record<string, unknown>;
      const transitions =
        (lcData?.transitions as
          | { avgDays: number; medianDays: number; sampleSize: number }[]
          | undefined) ?? [];
      const t = transitions[0];
      if (!t)
        return (
          <p className="text-[10px] text-muted-foreground">
            No transition data
          </p>
        );
      return (
        <div className="flex h-full flex-col justify-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Avg Time
          </p>
          <span className="font-mono text-2xl font-bold text-foreground">
            {t.avgDays}d
          </span>
          <p className="text-[10px] text-muted-foreground">
            Median: {t.medianDays}d · {t.sampleSize} leads
          </p>
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
    case "smart_view_monitor":
    case "activity_timeline":
    case "cross_reference":
    case "custom_field_breakdown":
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-[10px] text-muted-foreground">Coming soon</p>
        </div>
      );
    default:
      return null;
  }
};
