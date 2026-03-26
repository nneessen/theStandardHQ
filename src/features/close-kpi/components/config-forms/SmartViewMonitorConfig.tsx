// src/features/close-kpi/components/config-forms/SmartViewMonitorConfig.tsx

import React from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// eslint-disable-next-line no-restricted-imports
import { MultiSelectFilter } from "@/features/reports/components/filters/MultiSelectFilter";
import {
  useCloseLeadStatuses,
  useCloseSmartViews,
} from "../../hooks/useCloseKpiDashboard";
import type { SmartViewMonitorConfig as SmartViewConfigType } from "../../types/close-kpi.types";

interface SmartViewMonitorConfigProps {
  config: SmartViewConfigType;
  onChange: (config: SmartViewConfigType) => void;
}

export const SmartViewMonitorConfig: React.FC<SmartViewMonitorConfigProps> = ({
  config,
  onChange,
}) => {
  const { data: smartViews } = useCloseSmartViews();
  const { data: statuses } = useCloseLeadStatuses();

  const smartViewOptions = (smartViews ?? []).map((sv) => ({
    id: sv.id,
    name: sv.name,
  }));
  const statusOptions = (statuses ?? []).map((s) => ({
    id: s.id,
    name: s.label,
  }));

  return (
    <div className="space-y-2">
      {/* Smart Views to track */}
      <div>
        <Label className="mb-1 block text-[10px] text-muted-foreground">
          Smart Views to Monitor
        </Label>
        <MultiSelectFilter
          label="Smart Views"
          options={smartViewOptions}
          selectedIds={config.smartViewIds}
          onChange={(ids) => onChange({ ...config, smartViewIds: ids })}
          placeholder="Search smart views..."
        />
        {config.smartViewIds.length === 0 && (
          <p className="mt-0.5 text-[10px] text-[hsl(var(--warning))]">
            Select at least one smart view
          </p>
        )}
      </div>

      {/* Status columns */}
      <div>
        <Label className="mb-1 block text-[10px] text-muted-foreground">
          Status Columns
        </Label>
        <MultiSelectFilter
          label="Statuses"
          options={statusOptions}
          selectedIds={config.statusIds}
          onChange={(ids) => onChange({ ...config, statusIds: ids })}
          placeholder="Search statuses..."
        />
        {config.statusIds.length === 0 && (
          <p className="mt-0.5 text-[10px] text-[hsl(var(--warning))]">
            Select at least one status
          </p>
        )}
      </div>

      {/* Date Range */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Date Range</Label>
        <Select
          value={config.dateRange}
          onValueChange={(v) =>
            onChange({
              ...config,
              dateRange: v as SmartViewConfigType["dateRange"],
            })
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_30_days">Last 30 Days</SelectItem>
            <SelectItem value="last_90_days">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
