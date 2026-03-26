// src/features/close-kpi/components/config-forms/LifecycleTrackerConfig.tsx

import React from "react";
import { ArrowRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCloseLeadStatuses } from "../../hooks/useCloseKpiDashboard";
import type { LifecycleTrackerConfig as LifecycleConfigType } from "../../types/close-kpi.types";

interface LifecycleTrackerConfigProps {
  config: LifecycleConfigType;
  onChange: (config: LifecycleConfigType) => void;
}

export const LifecycleTrackerConfig: React.FC<LifecycleTrackerConfigProps> = ({
  config,
  onChange,
}) => {
  const { data: statuses } = useCloseLeadStatuses();

  return (
    <div className="space-y-2">
      {/* Status Transition Path */}
      <div>
        <Label className="text-[10px] text-muted-foreground">
          Track Time Between
        </Label>
        <div className="mt-1 flex items-center gap-1.5">
          <Select
            value={config.fromStatus}
            onValueChange={(v) => onChange({ ...config, fromStatus: v })}
          >
            <SelectTrigger className="h-7 flex-1 text-[11px]">
              <SelectValue placeholder="From status" />
            </SelectTrigger>
            <SelectContent>
              {(statuses ?? []).map((s) => (
                <SelectItem key={s.id} value={s.label}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />

          <Select
            value={config.toStatus ?? "__any__"}
            onValueChange={(v) =>
              onChange({ ...config, toStatus: v === "__any__" ? null : v })
            }
          >
            <SelectTrigger className="h-7 flex-1 text-[11px]">
              <SelectValue placeholder="To status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any status change</SelectItem>
              {(statuses ?? []).map((s) => (
                <SelectItem key={s.id} value={s.label}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Date Range */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Date Range</Label>
        <Select
          value={config.dateRange}
          onValueChange={(v) =>
            onChange({
              ...config,
              dateRange: v as LifecycleConfigType["dateRange"],
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
