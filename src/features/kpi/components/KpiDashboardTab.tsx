// src/features/kpi/components/KpiDashboardTab.tsx
// Comprehensive inbound-call KPI dashboard. Eight Board bands:
//   1 Performance · 2 Trend          (your logged DAILY totals)
//   3 States · 4 Time-of-day · 5 Demographics · 6 Length · 7 Word-tracks · 8 Team
//                                    (from your analyzed call RECORDINGS, RLS-scoped)
// A provenance strip between the two groups makes the dual-source model legible.
// Header keeps the date-range selector, a "Log day" dialog, and the "?" guide.

import React, { useMemo, useState } from "react";
import { CalendarPlus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateForDB } from "@/lib/date";
import { ManualKpiEntryPanel } from "./ManualKpiEntryPanel";
import { KpiGuideSheet } from "./KpiGuideSheet";
import { PerformanceBand } from "./dashboard/PerformanceBand";
import { TrendPanel } from "./dashboard/TrendPanel";
import { RecordingsProvenance } from "./dashboard/RecordingsProvenance";
import { StatesPanel } from "./dashboard/StatesPanel";
import { TimeOfDayPanel } from "./dashboard/TimeOfDayPanel";
import { DemographicsPanel } from "./dashboard/DemographicsPanel";
import { LengthDistributionPanel } from "./dashboard/LengthDistributionPanel";
import { WordTrackEffectivenessPanel } from "./dashboard/WordTrackEffectivenessPanel";
import { TeamPanel } from "./dashboard/TeamPanel";
import type { DateRange } from "../types/kpi.types";

type RangePreset =
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "this_month"
  | "ytd";

const RANGE_OPTIONS: ReadonlyArray<{ value: RangePreset; label: string }> = [
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "ytd", label: "Year to date" },
];

function computeRange(preset: RangePreset): DateRange {
  const today = new Date();
  const to = formatDateForDB(today);
  const start = new Date(today);
  switch (preset) {
    case "last_7_days":
      start.setDate(start.getDate() - 6);
      break;
    case "last_30_days":
      start.setDate(start.getDate() - 29);
      break;
    case "last_90_days":
      start.setDate(start.getDate() - 89);
      break;
    case "this_month":
      start.setDate(1);
      break;
    case "ytd":
      start.setMonth(0, 1);
      break;
  }
  return { from: formatDateForDB(start), to };
}

export const KpiDashboardTab: React.FC = () => {
  const [preset, setPreset] = useState<RangePreset>("last_30_days");
  const range = useMemo(() => computeRange(preset), [preset]);

  return (
    <div className="space-y-3">
      {/* Control row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-xs text-muted-foreground">
          {range.from} → {range.to}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={preset}
            onValueChange={(v) => setPreset(v as RangePreset)}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                Log day
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Log day</DialogTitle>
                <DialogDescription>
                  Enter or edit a day's call numbers. Saving updates the
                  Performance band and Trend.
                </DialogDescription>
              </DialogHeader>
              <ManualKpiEntryPanel />
            </DialogContent>
          </Dialog>

          <KpiGuideSheet />
        </div>
      </div>

      {/* 1. Performance + 2. Trend — from logged daily totals */}
      <PerformanceBand range={range} />
      <TrendPanel range={range} />

      {/* Provenance divider — everything below is from analyzed recordings */}
      <RecordingsProvenance range={range} />

      {/* 3–6 — from analyzed call recordings */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <StatesPanel range={range} />
        <TimeOfDayPanel range={range} />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DemographicsPanel range={range} />
        <LengthDistributionPanel range={range} />
      </div>

      {/* 7. Word-tracks + 8. Team */}
      <WordTrackEffectivenessPanel range={range} />
      <TeamPanel range={range} />
    </div>
  );
};
