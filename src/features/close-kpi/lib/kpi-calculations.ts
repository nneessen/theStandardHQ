// src/features/close-kpi/lib/kpi-calculations.ts
// Derived metric calculations: trends, deltas, lifecycle velocity

/**
 * Calculate percentage change between two values.
 * Returns null if previous value is 0 (can't compute % change from zero).
 */
export function calculateChangePercent(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Format a day count into a human-readable duration.
 */
export function formatDuration(days: number): string {
  if (days < 1) {
    const hours = Math.round(days * 24 * 10) / 10;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const rounded = Math.round(days * 10) / 10;
  return rounded === 1 ? "1 day" : `${rounded} days`;
}

/**
 * Get the date range boundaries for a preset.
 */
export function getDateRangeBounds(
  preset: string,
  customFrom?: string,
  customTo?: string,
): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "this_week": {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      return { from: start.toISOString().split("T")[0], to: today };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString().split("T")[0], to: today };
    }
    case "last_7_days": {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      return { from: start.toISOString().split("T")[0], to: today };
    }
    case "last_30_days": {
      const start = new Date(now);
      start.setDate(now.getDate() - 30);
      return { from: start.toISOString().split("T")[0], to: today };
    }
    case "last_90_days": {
      const start = new Date(now);
      start.setDate(now.getDate() - 90);
      return { from: start.toISOString().split("T")[0], to: today };
    }
    case "this_quarter": {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), quarterMonth, 1);
      return { from: start.toISOString().split("T")[0], to: today };
    }
    case "this_year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: start.toISOString().split("T")[0], to: today };
    }
    case "custom":
      return { from: customFrom ?? today, to: customTo ?? today };
    default:
      return { from: today, to: today };
  }
}

/**
 * Get the comparison period boundaries for a given current period.
 */
export function getComparisonBounds(
  currentFrom: string,
  currentTo: string,
): { from: string; to: string } {
  const fromDate = new Date(currentFrom);
  const toDate = new Date(currentTo);
  const durationMs = toDate.getTime() - fromDate.getTime();

  const compTo = new Date(fromDate.getTime() - 1);
  const compFrom = new Date(compTo.getTime() - durationMs);

  return {
    from: compFrom.toISOString().split("T")[0],
    to: compTo.toISOString().split("T")[0],
  };
}

/**
 * Compute median from a sorted array of numbers.
 */
export function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
