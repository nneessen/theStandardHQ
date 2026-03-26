// src/features/close-kpi/components/config-forms/CrossReferenceConfig.tsx

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
import type { CrossReferenceConfig as CrossRefConfigType } from "../../types/close-kpi.types";

interface CrossReferenceConfigProps {
  config: CrossRefConfigType;
  onChange: (config: CrossRefConfigType) => void;
}

export const CrossReferenceConfig: React.FC<CrossReferenceConfigProps> = ({
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
      {/* Rows = Smart Views */}
      <div>
        <Label className="mb-1 block text-[10px] text-muted-foreground">
          Rows (Smart Views)
        </Label>
        <MultiSelectFilter
          label="Smart Views"
          options={smartViewOptions}
          selectedIds={config.smartViewIds}
          onChange={(ids) => onChange({ ...config, smartViewIds: ids })}
          placeholder="Search smart views..."
        />
      </div>

      {/* Columns = Statuses */}
      <div>
        <Label className="mb-1 block text-[10px] text-muted-foreground">
          Columns (Statuses)
        </Label>
        <MultiSelectFilter
          label="Statuses"
          options={statusOptions}
          selectedIds={config.statusIds}
          onChange={(ids) => onChange({ ...config, statusIds: ids })}
          placeholder="Search statuses..."
        />
      </div>

      {/* Date Range */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Date Range</Label>
        <Select
          value={config.dateRange}
          onValueChange={(v) =>
            onChange({
              ...config,
              dateRange: v as CrossRefConfigType["dateRange"],
            })
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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
