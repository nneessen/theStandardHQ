// src/features/close-kpi/components/config-forms/CallAnalyticsConfig.tsx

import React from "react";
import { Label } from "@/components/ui/label";
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
  CallAnalyticsConfig as CallConfigType,
  CallMetric,
} from "../../types/close-kpi.types";

interface CallAnalyticsConfigProps {
  config: CallConfigType;
  onChange: (config: CallConfigType) => void;
}

const CALL_METRICS = METRIC_CATALOG.filter((m) => m.category === "calls");

export const CallAnalyticsConfig: React.FC<CallAnalyticsConfigProps> = ({
  config,
  onChange,
}) => {
  return (
    <div className="space-y-2">
      {/* Call Metric */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Metric</Label>
        <Select
          value={config.metric}
          onValueChange={(v) =>
            onChange({ ...config, metric: v as CallMetric })
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Volume
              </SelectLabel>
              {CALL_METRICS.filter((m) =>
                [
                  "calls_total",
                  "calls_inbound",
                  "calls_outbound",
                  "calls_answered",
                  "calls_voicemail",
                  "calls_missed",
                ].includes(m.key),
              ).map((m) => (
                <SelectItem key={m.key} value={m.key} className="text-[11px]">
                  {m.label}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Duration
              </SelectLabel>
              {CALL_METRICS.filter((m) =>
                ["call_duration_total", "call_duration_avg"].includes(m.key),
              ).map((m) => (
                <SelectItem key={m.key} value={m.key} className="text-[11px]">
                  {m.label}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Performance
              </SelectLabel>
              {CALL_METRICS.filter((m) =>
                [
                  "call_connect_rate",
                  "calls_by_disposition",
                  "calls_by_direction",
                  "calls_over_time",
                ].includes(m.key),
              ).map((m) => (
                <SelectItem key={m.key} value={m.key} className="text-[11px]">
                  {m.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Direction filter */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Direction</Label>
        <Select
          value={config.direction ?? "all"}
          onValueChange={(v) =>
            onChange({ ...config, direction: v as CallConfigType["direction"] })
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Calls</SelectItem>
            <SelectItem value="outgoing">Outbound Only</SelectItem>
            <SelectItem value="incoming">Inbound Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date Range */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Date Range</Label>
        <Select
          value={config.dateRange}
          onValueChange={(v) =>
            onChange({ ...config, dateRange: v as CallConfigType["dateRange"] })
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
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
