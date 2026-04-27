// src/features/close-kpi/components/config-forms/OpportunitySummaryConfig.tsx

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
import { METRIC_CATALOG } from "../../config/widget-registry";
import type {
  OpportunitySummaryConfig as OppConfigType,
  OpportunityMetric,
} from "../../types/close-kpi.types";

interface OpportunitySummaryConfigProps {
  config: OppConfigType;
  onChange: (config: OppConfigType) => void;
}

const OPP_METRICS = METRIC_CATALOG.filter(
  (m) => m.category === "opportunities",
);

export const OpportunitySummaryConfig: React.FC<
  OpportunitySummaryConfigProps
> = ({ config, onChange }) => {
  return (
    <div className="space-y-2">
      {/* Metric */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Metric</Label>
        <Select
          value={config.metric}
          onValueChange={(v) =>
            onChange({ ...config, metric: v as OpportunityMetric })
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Pipeline
              </SelectLabel>
              {OPP_METRICS.filter((m) =>
                [
                  "pipeline_value",
                  "pipeline_count",
                  "opps_by_status",
                  "opps_stalled",
                  "opps_by_value_bucket",
                ].includes(m.key),
              ).map((m) => (
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
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Performance
              </SelectLabel>
              {OPP_METRICS.filter((m) =>
                [
                  "win_rate",
                  "avg_deal_size",
                  "sales_velocity",
                  "avg_time_to_close",
                ].includes(m.key),
              ).map((m) => (
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
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Closed Deals
              </SelectLabel>
              {OPP_METRICS.filter((m) =>
                ["deals_won", "deals_lost", "deals_won_value"].includes(m.key),
              ).map((m) => (
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
          </SelectContent>
        </Select>
      </div>

      {/* Pipeline/Status Filter */}
      <div>
        <Label className="text-[10px] text-muted-foreground">
          Show Opportunities
        </Label>
        <Select
          value={config.statusType}
          onValueChange={(v) =>
            onChange({
              ...config,
              statusType: v as OppConfigType["statusType"],
            })
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active Pipeline</SelectItem>
            <SelectItem value="won">Won Deals</SelectItem>
            <SelectItem value="lost">Lost Deals</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date Range */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Date Range</Label>
        <Select
          value={config.dateRange}
          onValueChange={(v) =>
            onChange({ ...config, dateRange: v as OppConfigType["dateRange"] })
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
            <SelectItem value="this_quarter">This Quarter</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Comparison */}
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
