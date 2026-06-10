// src/features/analytics/board/inbound/utils.ts
// Non-component helpers for the Inbound Calls section (kept out of the .tsx so
// Fast Refresh stays happy — see react-refresh/only-export-components).
import type { BarTone } from "@/components/board";
import type { DateRange } from "@/features/kpi";
import { formatDateForDB } from "@/lib/date";
import { useAnalyticsDateRange } from "../../context/AnalyticsDateContext";

/** Convert the analytics date context to the kpi `{from,to}` (yyyy-mm-dd) range. */
export function useInboundCallRange(): DateRange {
  const { dateRange } = useAnalyticsDateRange();
  return {
    from: formatDateForDB(dateRange.startDate),
    to: formatDateForDB(dateRange.endDate),
  };
}

/** Closing-rate tone: green ≥ 40%, amber ≥ 20%, else red. */
export function closingTone(pct: number): BarTone {
  if (pct >= 40) return "green";
  if (pct >= 20) return "amber";
  return "red";
}
