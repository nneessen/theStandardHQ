// src/features/close-kpi/components/config-forms/StatCardConfig.tsx

import React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCloseLeadStatuses,
  useCloseSmartViews,
} from "../../hooks/useCloseKpiDashboard";
import {
  METRIC_CATALOG,
  WIDGET_CATEGORIES,
} from "../../config/widget-registry";
import type {
  StatCardConfig as StatCardConfigType,
  Metric,
} from "../../types/close-kpi.types";

interface StatCardConfigProps {
  config: StatCardConfigType;
  onChange: (config: StatCardConfigType) => void;
}

// Only show metrics that produce a single value (no group_by metrics)
const STAT_METRICS = METRIC_CATALOG.filter(
  (m) => !m.groupByField || m.aggregationType === "computed",
);

export const StatCardConfig: React.FC<StatCardConfigProps> = ({
  config,
  onChange,
}) => {
  const { data: statuses } = useCloseLeadStatuses();
  const { data: smartViews } = useCloseSmartViews();

  // Group metrics by category for the dropdown
  const metricsByCategory = WIDGET_CATEGORIES.map((cat) => ({
    ...cat,
    metrics: STAT_METRICS.filter((m) => m.category === cat.id),
  })).filter((cat) => cat.metrics.length > 0);

  const selectedMetric = METRIC_CATALOG.find((m) => m.key === config.metric);

  return (
    <div className="space-y-2">
      {/* Metric — the core selection */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Metric</Label>
        <Select
          value={config.metric}
          onValueChange={(v) => onChange({ ...config, metric: v as Metric })}
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {metricsByCategory.map((cat) => (
              <SelectGroup key={cat.id}>
                <SelectLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {cat.label}
                </SelectLabel>
                {cat.metrics.map((m) => (
                  <SelectItem key={m.key} value={m.key} className="text-[11px]">
                    <div>
                      <span>{m.label}</span>
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        — {m.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        {selectedMetric?.unit && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Returns:{" "}
            {selectedMetric.unit === "currency"
              ? "dollar amount"
              : selectedMetric.unit === "percent"
                ? "percentage"
                : selectedMetric.unit === "duration_days"
                  ? "days"
                  : selectedMetric.unit === "minutes"
                    ? "minutes"
                    : "count"}
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
              dateRange: v as StatCardConfigType["dateRange"],
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
            <SelectItem value="this_quarter">This Quarter</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Smart View Filter — only for lead-related metrics */}
      {selectedMetric?.objectType === "lead" && (
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

      {/* Lead Status Filter — only for lead metrics */}
      {selectedMetric?.objectType === "lead" && (
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Lead Status (optional)
          </Label>
          <Select
            value={config.leadStatusId ?? "__none__"}
            onValueChange={(v) =>
              onChange({ ...config, leadStatusId: v === "__none__" ? null : v })
            }
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="max-h-[250px]">
              <SelectItem value="__none__">All statuses</SelectItem>
              {(statuses ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Comparison Toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground">
          Compare vs previous period
        </Label>
        <Switch
          size="sm"
          checked={config.comparison === "previous_period"}
          onCheckedChange={(checked) =>
            onChange({
              ...config,
              comparison: checked ? "previous_period" : "none",
            })
          }
        />
      </div>
    </div>
  );
};
