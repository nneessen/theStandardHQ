// src/features/close-kpi/components/team/TeamDateRangeSelector.tsx
//
// Compact date-range selector for the Team tab daily call view.
// Presets: Today (default), Yesterday, Last 7 days, Last 30 days, Custom.
// Custom mode shows two date inputs that the user can pick from.

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  TEAM_CALL_PRESETS,
  buildTeamCallRange,
} from "../../lib/team-call-range";
import type {
  TeamCallRange,
  TeamCallRangePreset,
} from "../../types/team-call-stats.types";

interface TeamDateRangeSelectorProps {
  value: TeamCallRange;
  onChange: (next: TeamCallRange) => void;
}

function isoToInputDate(iso: string): string {
  // Pull YYYY-MM-DD out of an ISO 8601 string with offset (e.g. 2026-04-06T00:00:00-04:00)
  // Don't construct a Date here — that would re-shift across timezones.
  return iso.slice(0, 10);
}

function inputDateToLocalIso(date: string, endOfDay: boolean): string {
  // YYYY-MM-DD → local-tz Date at start or end of that day
  const [y, m, d] = date.split("-").map((x) => parseInt(x, 10));
  const out = new Date(y, m - 1, d);
  if (endOfDay) out.setHours(23, 59, 59, 999);
  else out.setHours(0, 0, 0, 0);
  // Reuse the local-iso formatter from buildTeamCallRange via a one-day custom range
  const range = buildTeamCallRange(
    "custom",
    out.toISOString(),
    out.toISOString(),
  );
  return endOfDay ? range.to : range.from;
}

export const TeamDateRangeSelector: React.FC<TeamDateRangeSelectorProps> = ({
  value,
  onChange,
}) => {
  const [customFrom, setCustomFrom] = useState<string>(
    isoToInputDate(value.from),
  );
  const [customTo, setCustomTo] = useState<string>(isoToInputDate(value.to));

  const handlePreset = (preset: TeamCallRangePreset) => {
    if (preset === "custom") {
      onChange(buildTeamCallRange("custom", value.from, value.to));
    } else {
      const next = buildTeamCallRange(preset);
      setCustomFrom(isoToInputDate(next.from));
      setCustomTo(isoToInputDate(next.to));
      onChange(next);
    }
  };

  const handleCustomFrom = (date: string) => {
    setCustomFrom(date);
    if (!date || !customTo) return;
    onChange(
      buildTeamCallRange(
        "custom",
        inputDateToLocalIso(date, false),
        inputDateToLocalIso(customTo, true),
      ),
    );
  };

  const handleCustomTo = (date: string) => {
    setCustomTo(date);
    if (!customFrom || !date) return;
    onChange(
      buildTeamCallRange(
        "custom",
        inputDateToLocalIso(customFrom, false),
        inputDateToLocalIso(date, true),
      ),
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-md p-0.5">
        {TEAM_CALL_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handlePreset(preset.id)}
            className={cn(
              "px-2.5 py-1 text-[10px] font-medium rounded transition-all whitespace-nowrap",
              value.preset === preset.id
                ? "bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300",
            )}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handlePreset("custom")}
          className={cn(
            "px-2.5 py-1 text-[10px] font-medium rounded transition-all whitespace-nowrap",
            value.preset === "custom"
              ? "bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300",
          )}
        >
          Custom
        </button>
      </div>

      {value.preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => handleCustomFrom(e.target.value)}
            className="h-7 px-2 text-[10px] rounded border border-border bg-background"
            aria-label="From date"
          />
          <span className="text-[10px] text-muted-foreground">→</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => handleCustomTo(e.target.value)}
            className="h-7 px-2 text-[10px] rounded border border-border bg-background"
            aria-label="To date"
          />
        </div>
      )}
    </div>
  );
};
