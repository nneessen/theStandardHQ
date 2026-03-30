// src/features/close-kpi/components/GlobalDateRange.tsx
// Compact date range dropdown for the pre-built dashboard header.

import React from "react";
import { Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DateRangePreset } from "../types/close-kpi.types";

interface GlobalDateRangeProps {
  value: DateRangePreset;
  onChange: (value: DateRangePreset) => void;
}

const DATE_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "last_90_days", label: "Last 90 Days" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
];

export const GlobalDateRange: React.FC<GlobalDateRangeProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="flex items-center gap-1.5">
      <Calendar className="h-3 w-3 text-muted-foreground" />
      <Select
        value={value}
        onValueChange={(v) => onChange(v as DateRangePreset)}
      >
        <SelectTrigger className="h-7 w-[130px] text-[10px] border-zinc-200 dark:border-zinc-700">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_RANGE_OPTIONS.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              className="text-[11px]"
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
