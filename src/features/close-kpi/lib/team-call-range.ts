// src/features/close-kpi/lib/team-call-range.ts
//
// Compute timezone-aware ISO 8601 date bounds for the Team tab's daily call
// view. The frontend does the timezone math (not the edge function) because:
//
// 1. The user's IANA timezone lives in the browser (`Intl.DateTimeFormat()`)
//    and isn't carried into the edge function reliably.
// 2. Computing "midnight to 23:59:59 in America/New_York" via raw Date math
//    in Deno would require shipping a tz database; in the browser, the
//    JavaScript engine already has one and respects the system tz.
// 3. Sending fully-qualified ISO timestamps with offsets (e.g.
//    `2026-04-06T00:00:00-04:00`) means the edge function only has to pass
//    the strings through to Close API as `date_created__gte/lte`. No tz
//    interpretation in the edge function = no tz bugs in the edge function.

import type {
  TeamCallRange,
  TeamCallRangePreset,
} from "../types/team-call-stats.types";

const PRESET_LABELS: Record<TeamCallRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last_7_days: "Last 7 days",
  last_30_days: "Last 30 days",
  custom: "Custom range",
};

/**
 * Returns a Date set to 00:00:00.000 of the given day in the user's local
 * timezone (whatever the browser is set to). Mutates a copy of the input.
 */
function startOfLocalDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/**
 * Returns a Date set to 23:59:59.999 of the given day in the user's local tz.
 */
function endOfLocalDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

/**
 * Format a Date as a local-timezone ISO 8601 string with offset, e.g.
 * `2026-04-06T00:00:00-04:00`. Standard `.toISOString()` returns UTC, which
 * is wrong for "today in user's tz" because it'd shift the boundary.
 *
 * Exported so other helpers (e.g. TeamDateRangeSelector's custom-date input
 * handlers) can format Dates without going through buildTeamCallRange.
 */
export function toLocalIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());

  // Timezone offset: getTimezoneOffset returns minutes WEST of UTC, so a
  // positive value means we're behind UTC. Sign is inverted from ISO.
  const tzMin = -d.getTimezoneOffset();
  const tzSign = tzMin >= 0 ? "+" : "-";
  const tzAbs = Math.abs(tzMin);
  const tzHh = pad(Math.floor(tzAbs / 60));
  const tzMm = pad(tzAbs % 60);

  return `${year}-${month}-${day}T${hh}:${mm}:${ss}${tzSign}${tzHh}:${tzMm}`;
}

/**
 * Convert a preset (or custom from/to) into the canonical TeamCallRange shape
 * the hooks + edge function expect. `now` is injectable for testing.
 */
export function buildTeamCallRange(
  preset: TeamCallRangePreset,
  customFromIso?: string,
  customToIso?: string,
  now: Date = new Date(),
): TeamCallRange {
  let fromDate: Date;
  let toDate: Date;

  switch (preset) {
    case "today":
      fromDate = startOfLocalDay(now);
      toDate = endOfLocalDay(now);
      break;
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      fromDate = startOfLocalDay(y);
      toDate = endOfLocalDay(y);
      break;
    }
    case "last_7_days": {
      // Inclusive 7-day window ending TODAY (so today + 6 prior days)
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      fromDate = startOfLocalDay(start);
      toDate = endOfLocalDay(now);
      break;
    }
    case "last_30_days": {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      fromDate = startOfLocalDay(start);
      toDate = endOfLocalDay(now);
      break;
    }
    case "custom": {
      if (!customFromIso || !customToIso) {
        // Fall back to today rather than throwing — caller can clamp via UI.
        fromDate = startOfLocalDay(now);
        toDate = endOfLocalDay(now);
      } else {
        fromDate = new Date(customFromIso);
        toDate = new Date(customToIso);
      }
      break;
    }
  }

  return {
    preset,
    from: toLocalIso(fromDate),
    to: toLocalIso(toDate),
    label: PRESET_LABELS[preset],
  };
}

export const TEAM_CALL_PRESETS: { id: TeamCallRangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7_days", label: "Last 7 days" },
  { id: "last_30_days", label: "Last 30 days" },
];
