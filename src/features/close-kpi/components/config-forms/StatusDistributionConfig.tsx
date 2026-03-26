// src/features/close-kpi/components/config-forms/StatusDistributionConfig.tsx

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
import type { StatusDistributionConfig as StatusDistConfigType } from "../../types/close-kpi.types";

interface StatusDistributionConfigProps {
  config: StatusDistConfigType;
  onChange: (config: StatusDistConfigType) => void;
}

export const StatusDistributionConfig: React.FC<
  StatusDistributionConfigProps
> = ({ config, onChange }) => {
  const { data: smartViews } = useCloseSmartViews();

  return (
    <div className="space-y-2">
      {/* Group By */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Group By</Label>
        <Select
          value={config.groupBy}
          onValueChange={(v) =>
            onChange({ ...config, groupBy: v as "status" | "source" })
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">Lead Status</SelectItem>
            <SelectItem value="source">Lead Source</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date Range */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Date Range</Label>
        <Select
          value={config.dateRange}
          onValueChange={(v) =>
            onChange({
              ...config,
              dateRange: v as StatusDistConfigType["dateRange"],
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

      {/* Smart View Filter */}
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

      {/* Sort Order */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Sort</Label>
        <Select
          value={config.sortOrder ?? "count_desc"}
          onValueChange={(v) =>
            onChange({
              ...config,
              sortOrder: v as StatusDistConfigType["sortOrder"],
            })
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count_desc">Highest First</SelectItem>
            <SelectItem value="count_asc">Lowest First</SelectItem>
            <SelectItem value="alpha">Alphabetical</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
