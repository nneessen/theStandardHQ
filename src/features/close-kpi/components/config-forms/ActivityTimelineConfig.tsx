// src/features/close-kpi/components/config-forms/ActivityTimelineConfig.tsx

import React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ActivityTimelineConfig as ActivityConfigType,
  ActivityType,
} from "../../types/close-kpi.types";

interface ActivityTimelineConfigProps {
  config: ActivityConfigType;
  onChange: (config: ActivityConfigType) => void;
}

const ACTIVITY_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: "call", label: "Calls" },
  { value: "email", label: "Emails" },
  { value: "sms", label: "SMS" },
  { value: "meeting", label: "Meetings" },
  { value: "note", label: "Notes" },
];

export const ActivityTimelineConfig: React.FC<ActivityTimelineConfigProps> = ({
  config,
  onChange,
}) => {
  const toggleType = (type: ActivityType) => {
    const current = config.activityTypes;
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    if (next.length > 0) onChange({ ...config, activityTypes: next });
  };

  return (
    <div className="space-y-2">
      {/* Activity Types */}
      <div>
        <Label className="text-[10px] text-muted-foreground">
          Activity Types
        </Label>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {ACTIVITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground"
            >
              <Checkbox
                size="sm"
                checked={config.activityTypes.includes(opt.value)}
                onCheckedChange={() => toggleType(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Time Bucket */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Granularity</Label>
        <Select
          value={config.timeBucket}
          onValueChange={(v) =>
            onChange({
              ...config,
              timeBucket: v as ActivityConfigType["timeBucket"],
            })
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
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
              dateRange: v as ActivityConfigType["dateRange"],
            })
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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
