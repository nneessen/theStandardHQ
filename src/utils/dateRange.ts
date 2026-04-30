// src/utils/dateRange.ts

import { parseLocalDate } from "../lib/date";

export type TimePeriod = "daily" | "weekly" | "monthly" | "MTD" | "yearly";

export interface DateRange {
  startDate: Date;
  endDate: Date;
}
export function getDateRange(
  period: TimePeriod,
  offset: number = 0,
): DateRange {
  const now = new Date();
  let endDate: Date;
  let startDate: Date;

  const referenceDate = new Date(now);

  switch (period) {
    case "daily":
      referenceDate.setDate(referenceDate.getDate() + offset);
      startDate = new Date(
        referenceDate.getFullYear(),
        referenceDate.getMonth(),
        referenceDate.getDate(),
        0,
        0,
        0,
        0,
      );
      endDate = new Date(
        referenceDate.getFullYear(),
        referenceDate.getMonth(),
        referenceDate.getDate(),
        23,
        59,
        59,
        999,
      );
      break;

    case "weekly":
      // Adjust reference date by offset weeks
      referenceDate.setDate(referenceDate.getDate() + offset * 7);
      // Last 7 days from reference date
      startDate = new Date(referenceDate);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(referenceDate);
      endDate.setHours(23, 59, 59, 999);
      break;

    case "monthly": {
      // Build the boundary directly from year + (month + offset). Do NOT use
      // setMonth on `now`: today may be the 30th/31st, and stepping into a
      // shorter month (e.g. Feb) overflows day-of-month and silently skips
      // the target month — e.g. April 30 + setMonth(1) → "Feb 30" → March 2.
      const targetMonth = now.getMonth() + offset;
      startDate = new Date(now.getFullYear(), targetMonth, 1, 0, 0, 0, 0);
      endDate = new Date(
        now.getFullYear(),
        targetMonth + 1,
        0,
        23,
        59,
        59,
        999,
      );
      break;
    }

    case "MTD": {
      // Same setMonth-overflow trap as "monthly" — construct directly.
      const targetMonth = now.getMonth() + offset;
      startDate = new Date(now.getFullYear(), targetMonth, 1, 0, 0, 0, 0);
      if (offset === 0) {
        // Current month: end at today
        endDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        );
      } else {
        // Past/future months: return full month
        endDate = new Date(
          now.getFullYear(),
          targetMonth + 1,
          0,
          23,
          59,
          59,
          999,
        );
      }
      break;
    }

    case "yearly": {
      // Construct directly to avoid Feb-29 setFullYear rollover in leap years.
      const targetYear = now.getFullYear() + offset;
      startDate = new Date(targetYear, 0, 1, 0, 0, 0, 0);
      endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
      break;
    }

    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
  }

  return { startDate, endDate };
}

/**
 * Get a human-readable descriptor for a time period with offset
 * @param period The time period type
 * @param offset The offset from current period (0 = current, -1 = previous, etc.)
 * @param dateRange The calculated date range for formatting
 * @returns Human-readable string like "This Month", "Last Month", "2 Months Ago"
 */
export function getPeriodDescriptor(
  period: TimePeriod,
  offset: number,
  dateRange: DateRange,
): string {
  // Format month/year from date range
  const monthYear = dateRange.startDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const year = dateRange.startDate.getFullYear();

  switch (period) {
    case "daily":
      if (offset === 0) return "Today";
      if (offset === -1) return "Yesterday";
      if (offset === 1) return "Tomorrow";
      if (offset < 0)
        return `${Math.abs(offset)} Days Ago - ${dateRange.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      return `In ${offset} Days - ${dateRange.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    case "weekly":
      if (offset === 0) return "This Week";
      if (offset === -1) return "Last Week";
      if (offset === 1) return "Next Week";
      if (offset < 0)
        return `${Math.abs(offset)} Weeks Ago - ${dateRange.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${dateRange.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      return `In ${offset} Weeks - ${dateRange.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${dateRange.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    case "monthly":
      if (offset === 0) return `This Month - ${monthYear}`;
      if (offset === -1) return `Last Month - ${monthYear}`;
      if (offset === 1) return `Next Month - ${monthYear}`;
      if (offset < 0) return `${Math.abs(offset)} Months Ago - ${monthYear}`;
      return `In ${offset} Months - ${monthYear}`;

    case "MTD":
      if (offset === 0) return `MTD - ${monthYear}`;
      if (offset === -1) return `Last Month - ${monthYear}`;
      if (offset === 1) return `Next Month - ${monthYear}`;
      if (offset < 0) return `${Math.abs(offset)} Months Ago - ${monthYear}`;
      return `In ${offset} Months - ${monthYear}`;

    case "yearly":
      if (offset === 0) return `This Year - ${year}`;
      if (offset === -1) return `Last Year - ${year}`;
      if (offset === 1) return `Next Year - ${year}`;
      if (offset < 0) return `${Math.abs(offset)} Years Ago - ${year}`;
      return `In ${offset} Years - ${year}`;

    default:
      return monthYear;
  }
}

/**
 * Check if a date falls within a date range
 * @param date The date to check
 * @param range The date range to check against (can have startDate/endDate or start/end)
 * @returns boolean indicating if date is in range
 *
 * IMPORTANT: Uses parseLocalDate to avoid UTC timezone shifting bugs
 * (e.g., "2025-10-01" stays as Oct 1, not becoming Sept 30)
 */
export function isInDateRange(
  date: Date | string | null,
  range: DateRange | { start: string | null; end: string | null },
): boolean {
  if (!date) return false;

  const checkDate = typeof date === "string" ? parseLocalDate(date) : date;

  // Handle both formats - DateRange with Date objects or range with string dates
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if ("startDate" in range && "endDate" in range) {
    // Original DateRange format
    startDate = range.startDate;
    endDate = range.endDate;
  } else if ("start" in range && "end" in range) {
    // String format from useMetricsWithDateRange
    startDate = range.start ? parseLocalDate(range.start) : null;
    endDate = range.end ? parseLocalDate(range.end) : null;
  }

  if (startDate && checkDate < startDate) return false;
  if (endDate && checkDate > endDate) return false;

  return true;
}

/**
 * Get the number of days in a time period
 * @param period The time period
 * @returns Number of days in the period
 */
export function getDaysInPeriod(period: TimePeriod): number {
  const range = getDateRange(period);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil(
    (range.endDate.getTime() - range.startDate.getTime()) / msPerDay,
  );
}

/**
 * Get the time remaining in a period
 * @param period The time period
 * @returns Object with days and hours remaining
 */
export function getTimeRemaining(period: TimePeriod): {
  days: number;
  hours: number;
} {
  const now = new Date();
  let endOfPeriod: Date;

  switch (period) {
    case "daily":
      // End of today
      endOfPeriod = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      );
      break;

    case "weekly":
      {
        // 7 days from start of period
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        endOfPeriod = new Date(weekStart);
        endOfPeriod.setDate(endOfPeriod.getDate() + 7);
      }
      break;

    case "monthly":
    case "MTD":
      // End of current month
      endOfPeriod = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      break;

    case "yearly":
      // End of current year
      endOfPeriod = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;

    default:
      endOfPeriod = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
  }

  const msRemaining = endOfPeriod.getTime() - now.getTime();
  const daysRemaining = Math.floor(msRemaining / (24 * 60 * 60 * 1000));
  const hoursRemaining = Math.floor(
    (msRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
  );

  return {
    days: Math.max(0, daysRemaining),
    hours: Math.max(0, hoursRemaining),
  };
}

/**
 * Get a human-readable label for the time period
 * @param period The time period
 * @returns Formatted label string
 */
export function getPeriodLabel(period: TimePeriod): string {
  switch (period) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "MTD":
      return "Month to Date";
    case "yearly":
      return "Yearly";
    default:
      return "Monthly";
  }
}

/**
 * Format a date range for display
 * @param range The date range to format
 * @returns Formatted string representation
 */
export function formatDateRange(range: DateRange): string {
  const formatOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  const start = range.startDate.toLocaleDateString("en-US", formatOptions);
  const end = range.endDate.toLocaleDateString("en-US", formatOptions);

  // If same day, just show one date
  if (start === end) {
    return start;
  }

  // If same year, don't repeat the year
  if (range.startDate.getFullYear() === range.endDate.getFullYear()) {
    const startNoYear = range.startDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${startNoYear} - ${end}`;
  }

  return `${start} - ${end}`;
}

/**
 * Average number of days in each time period
 * Used for scaling metrics across different time periods
 */
export const DAYS_PER_PERIOD: Record<TimePeriod, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30.44, // Average month length (365.25 / 12)
  MTD: 30.44, // Same as monthly for scaling purposes
  yearly: 365.25, // Account for leap years
};

/**
 * Scale a metric value from one time period to another
 * @param value The value to scale
 * @param fromPeriod The original time period
 * @param toPeriod The target time period
 * @returns Scaled value
 */
export function scaleMetricByPeriod(
  value: number,
  fromPeriod: TimePeriod,
  toPeriod: TimePeriod,
): number {
  const fromDays = DAYS_PER_PERIOD[fromPeriod];
  const toDays = DAYS_PER_PERIOD[toPeriod];
  return (value / fromDays) * toDays;
}

/**
 * Get the average value per display period based on actual data in a date range
 * This is the KEY function for fixing the time period scaling bug.
 *
 * Example: If you have $4,000 in expenses over 30 days and want to show "Weekly":
 * - Daily average = $4,000 / 30 = $133.33/day
 * - Weekly average = $133.33 * 7 = $933.33/week
 *
 * @param totalValue The total value across the entire date range
 * @param dateRange The date range the total covers
 * @param displayPeriod The time period to display the average for
 * @returns Average value per display period
 */
export function getAveragePeriodValue(
  totalValue: number,
  dateRange: DateRange,
  displayPeriod: TimePeriod,
): number {
  // Calculate number of days in the actual date range
  const msPerDay = 24 * 60 * 60 * 1000;
  const rangeDays = Math.max(
    1,
    Math.ceil(
      (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / msPerDay,
    ),
  );

  // Calculate daily average from the total
  const dailyAverage = totalValue / rangeDays;

  // Scale to the display period
  const periodDays = DAYS_PER_PERIOD[displayPeriod];

  return dailyAverage * periodDays;
}
