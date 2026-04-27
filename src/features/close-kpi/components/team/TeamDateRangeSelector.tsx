// src/features/close-kpi/components/team/TeamDateRangeSelector.tsx
//
// Compact date-range selector for the Team tab daily call view.
// Presets: Today (default), Yesterday, Last 7 days, Last 30 days, Custom.
// Custom mode shows two date inputs that the user can pick from.

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  TEAM_CALL_PRESETS,
  buildTeamCallRange,
  toLocalIso,
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
  // YYYY-MM-DD (from <input type="date">) → local-tz Date at start or end of day
  const [y, m, d] = date.split("-").map((x) => parseInt(x, 10));
  const out = new Date(y, m - 1, d);
  if (endOfDay) out.setHours(23, 59, 59, 999);
  else out.setHours(0, 0, 0, 0);
  return toLocalIso(out);
}

export const TeamDateRangeSelector: React.FC<TeamDateRangeSelectorProps> = ({
  value,
  onChange,
}) => {
  // Local state for the <input type="date"> elements. Initialized from the
  // current value prop, then resynced via useEffect when the parent passes
  // a new value (e.g. midnight rollover bumps `today` to the next calendar
  // day, or a future feature loads the range from a URL query param). Without
  // the resync, useState's initializer-runs-once behavior would leave the
  // inputs showing yesterday's date forever after a rollover.
  const [customFrom, setCustomFrom] = useState<string>(
    isoToInputDate(value.from),
  );
  const [customTo, setCustomTo] = useState<string>(isoToInputDate(value.to));

  useEffect(() => {
    setCustomFrom(isoToInputDate(value.from));
    setCustomTo(isoToInputDate(value.to));
  }, [value.from, value.to]);

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
      <div className="flex items-center gap-0.5 bg-v2-canvas rounded-md p-0.5">
        {TEAM_CALL_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handlePreset(preset.id)}
            className={cn(
              "px-2.5 py-1 text-[10px] font-medium rounded transition-all whitespace-nowrap",
              value.preset === preset.id
                ? "bg-v2-card shadow-sm text-v2-ink"
                : "text-v2-ink-muted hover:text-v2-ink dark:hover:text-v2-ink-subtle",
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
              ? "bg-v2-card shadow-sm text-v2-ink"
              : "text-v2-ink-muted hover:text-v2-ink dark:hover:text-v2-ink-subtle",
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
