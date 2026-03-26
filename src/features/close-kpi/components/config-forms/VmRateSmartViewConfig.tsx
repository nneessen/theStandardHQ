// src/features/close-kpi/components/config-forms/VmRateSmartViewConfig.tsx

import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCloseSmartViews } from "../../hooks/useCloseKpiDashboard";
import type { VmRateSmartViewConfig as VmRateConfigType } from "../../types/close-kpi.types";

interface VmRateSmartViewConfigProps {
  config: VmRateConfigType;
  onChange: (config: VmRateConfigType) => void;
}

export const VmRateSmartViewConfig: React.FC<VmRateSmartViewConfigProps> = ({
  config,
  onChange,
}) => {
  const { data: smartViews } = useCloseSmartViews();

  const toggleSmartView = (svId: string) => {
    const current = config.smartViewIds ?? [];
    const next = current.includes(svId)
      ? current.filter((id) => id !== svId)
      : [...current, svId];
    onChange({ ...config, smartViewIds: next });
  };

  return (
    <div className="space-y-2">
      {/* Smart View Selection */}
      <div>
        <Label className="mb-1 block text-[10px] text-muted-foreground">
          Smart Views to Monitor
        </Label>
        <div className="max-h-32 space-y-0.5 overflow-y-auto rounded border border-border bg-background p-1.5">
          {smartViews.length === 0 && (
            <p className="py-1 text-[10px] text-muted-foreground">
              Loading smart views...
            </p>
          )}
          {smartViews.map((sv) => (
            <label
              key={sv.id}
              className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted"
            >
              <Checkbox
                checked={config.smartViewIds.includes(sv.id)}
                onCheckedChange={() => toggleSmartView(sv.id)}
                className="h-3 w-3"
              />
              <span className="text-[11px] text-foreground">{sv.name}</span>
            </label>
          ))}
        </div>
        {config.smartViewIds.length === 0 && (
          <p className="mt-0.5 text-[10px] text-[hsl(var(--warning))]">
            Select at least one smart view
          </p>
        )}
      </div>

      {/* VM Threshold */}
      <div>
        <Label className="text-[10px] text-muted-foreground">
          VM Warning Threshold (%)
        </Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={config.vmThreshold}
          onChange={(e) =>
            onChange({
              ...config,
              vmThreshold: Math.min(100, Math.max(0, Number(e.target.value))),
            })
          }
          className="h-7 text-[11px]"
        />
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Rows above this rate show a warning indicator
        </p>
      </div>

      {/* First Call Only toggle */}
      <label className="flex cursor-pointer items-center gap-1.5">
        <Checkbox
          checked={config.firstCallOnly}
          onCheckedChange={(checked) =>
            onChange({ ...config, firstCallOnly: !!checked })
          }
          className="h-3 w-3"
        />
        <span className="text-[11px] text-muted-foreground">
          First call per lead only
        </span>
      </label>

      {/* Date Range */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Date Range</Label>
        <Select
          value={config.dateRange}
          onValueChange={(v) =>
            onChange({
              ...config,
              dateRange: v as VmRateConfigType["dateRange"],
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
            <SelectItem value="last_7_days">Last 7 Days</SelectItem>
            <SelectItem value="last_30_days">Last 30 Days</SelectItem>
            <SelectItem value="last_90_days">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
