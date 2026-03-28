// src/features/close-kpi/components/config-forms/DateRangeOnlyConfig.tsx
// Shared config form for widgets that only need date range + optional smart view

import React from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCloseSmartViews } from "../../hooks/useCloseKpiDashboard";
import type { BaseWidgetConfig } from "../../types/close-kpi.types";

interface DateRangeOnlyConfigProps {
  config: BaseWidgetConfig;
  onChange: (config: BaseWidgetConfig) => void;
  showSmartViewFilter?: boolean;
}

export const DateRangeOnlyConfig: React.FC<DateRangeOnlyConfigProps> = ({
  config,
  onChange,
  showSmartViewFilter = true,
}) => {
  const { data: smartViews } = useCloseSmartViews();

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-[10px] text-muted-foreground">Date Range</Label>
        <Select
          value={config.dateRange}
          onValueChange={(v) =>
            onChange({
              ...config,
              dateRange: v as BaseWidgetConfig["dateRange"],
            })
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last_7_days">Last 7 Days</SelectItem>
            <SelectItem value="last_30_days">Last 30 Days</SelectItem>
            <SelectItem value="last_90_days">Last 90 Days</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="this_quarter">This Quarter</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showSmartViewFilter && (
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Smart View (optional)
          </Label>
          <Select
            value={config.smartViewId ?? "__none__"}
            onValueChange={(v) =>
              onChange({ ...config, smartViewId: v === "__none__" ? null : v })
            }
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue placeholder="All leads" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">All leads</SelectItem>
              {(smartViews ?? []).map((sv) => (
                <SelectItem key={sv.id} value={sv.id}>
                  {sv.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};
