// src/lib/date.ts

/**
 * Global date utilities to prevent timezone issues across the app
 *
 * PROBLEM: When storing dates in PostgreSQL DATE columns, we need consistent handling:
 * - Database stores dates as DATE (no timezone, just YYYY-MM-DD)
 * - JavaScript Date objects have timezones which cause off-by-one errors
 * - new Date("2024-10-01") = Oct 1 00:00 UTC, which becomes Sept 30 in US timezones!
 *
 * SOLUTION: Always use these utilities for consistent local-timezone date handling
 */

/**
 * Parse a date string (YYYY-MM-DD) into a Date object in LOCAL timezone
 * Prevents timezone shifting issues when creating Date objects from database strings
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object set to midnight in LOCAL timezone (not UTC)
 *
 * @example
 * // User in US Eastern (UTC-5)
 * new Date("2024-10-01") // Oct 1 00:00 UTC = Sept 30 19:00 local ❌
 * parseLocalDate("2024-10-01") // Oct 1 00:00 local ✅
 */
export function parseLocalDate(dateString: string): Date {
  if (!dateString) {
    return new Date(0); // Epoch — won't match any modern date range filter
  }

  // Handle ISO timestamp format (YYYY-MM-DDTHH:MM:SS.sssZ) by extracting date part
  let datePart = dateString;
  if (dateString.includes("T")) {
    datePart = dateString.split("T")[0];
  }

  // Split the date string to avoid timezone interpretation
  const [year, month, day] = datePart.split("-").map(Number);

  // Validate the parsed values
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    console.warn("Invalid date string format:", dateString);
    return new Date(); // Return current date as fallback
  }

  // Create date in local timezone (month is 0-indexed)
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Normalize a date value from Supabase to ensure it's always a YYYY-MM-DD string
 * Handles both Date objects (which may have timezone issues) and strings
 *
 * @param date - Date object or string from database
 * @returns Normalized date string in YYYY-MM-DD format
 *
 * @example
 * normalizeDatabaseDate(new Date("2024-10-01T00:00:00Z")) // "2024-10-01"
 * normalizeDatabaseDate("2024-10-01") // "2024-10-01"
 */
export function normalizeDatabaseDate(
  date: Date | string | null | undefined,
): string {
  if (!date) return "";

  // If it's already a string in YYYY-MM-DD format, return as-is
  if (typeof date === "string") {
    // Check if it's already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    // If it has time component, parse and format
    return formatDateForDB(parseLocalDate(date.split("T")[0]));
  }

  // For Date objects, format to YYYY-MM-DD in local timezone
  return formatDateForDB(date);
}

/**
 * Format a Date object to YYYY-MM-DD string in LOCAL timezone
 * Use this when sending dates to the database or displaying in date inputs
 *
 * @param date - Date object or date string
 * @returns Date string in YYYY-MM-DD format
 *
 * @example
 * formatDateForDB(new Date(2024, 9, 1)) // "2024-10-01"
 * formatDateForDB("2024-10-01") // "2024-10-01"
 */
export function formatDateForDB(date: Date | string): string {
  if (typeof date === "string") {
    // If already a string, validate format and return
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    // Try to parse it as a date
    date = parseLocalDate(date);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as YYYY-MM-DD string in local timezone
 * Use this for default date values in forms
 *
 * @returns Today's date in YYYY-MM-DD format
 *
 * @example
 * getTodayString() // "2024-10-15"
 */
export function getTodayString(): string {
  return formatDateForDB(new Date());
}

/**
 * Check if two dates (strings or Date objects) represent the same day
 * Useful for filtering and comparisons
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if dates are the same day
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === "string" ? parseLocalDate(date1) : date1;
  const d2 = typeof date2 === "string" ? parseLocalDate(date2) : date2;

  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Check if two dates represent the same month
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if dates are in the same month
 */
export function isSameMonth(
  date1: Date | string,
  date2: Date | string,
): boolean {
  const d1 = typeof date1 === "string" ? parseLocalDate(date1) : date1;
  const d2 = typeof date2 === "string" ? parseLocalDate(date2) : date2;

  return (
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()
  );
}

/**
 * Check if two dates represent the same year
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if dates are in the same year
 */
export function isSameYear(
  date1: Date | string,
  date2: Date | string,
): boolean {
  const d1 = typeof date1 === "string" ? parseLocalDate(date1) : date1;
  const d2 = typeof date2 === "string" ? parseLocalDate(date2) : date2;

  return d1.getFullYear() === d2.getFullYear();
}

/**
 * Add days to a date string and return new date string
 *
 * @param dateString - Starting date in YYYY-MM-DD format
 * @param days - Number of days to add (can be negative)
 * @returns New date string in YYYY-MM-DD format
 */
export function addDays(dateString: string, days: number): string {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + days);
  return formatDateForDB(date);
}

/**
 * Add months to a date string and return new date string
 *
 * @param dateString - Starting date in YYYY-MM-DD format
 * @param months - Number of months to add (can be negative)
 * @returns New date string in YYYY-MM-DD format
 */
export function addMonths(dateString: string, months: number): string {
  const date = parseLocalDate(dateString);
  date.setMonth(date.getMonth() + months);
  return formatDateForDB(date);
}

/**
 * Add years to a date string and return new date string
 *
 * @param dateString - Starting date in YYYY-MM-DD format
 * @param years - Number of years to add (can be negative)
 * @returns New date string in YYYY-MM-DD format
 */
export function addYears(dateString: string, years: number): string {
  const date = parseLocalDate(dateString);
  date.setFullYear(date.getFullYear() + years);
  return formatDateForDB(date);
}

/**
 * Format date for display (e.g., "Oct 1, 2024")
 *
 * @param date - Date string or Date object
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDateForDisplay(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? parseLocalDate(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: undefined, // Use browser's local timezone
  };

  return d.toLocaleDateString("en-US", { ...defaultOptions, ...options });
}
