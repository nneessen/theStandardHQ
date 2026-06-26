// src/types/team-reports.schemas.ts
// Zod schemas for team performance report RPC responses
// Provides runtime type validation for database responses

import { z } from "zod";
import { formatDateForDB } from "@/lib/date";

/**
 * Schema for monthly performance report row (IMO or Agency)
 */
export const MonthlyPerformanceRowSchema = z.object({
  month_start: z.string(), // ISO date string
  month_label: z.string(),
  new_policies: z.coerce.number().int().nonnegative(),
  new_premium: z.coerce.number().nonnegative(),
  commissions_earned: z.coerce.number().nonnegative(),
  new_agents: z.coerce.number().int().nonnegative(),
  policies_lapsed: z.coerce.number().int().nonnegative(),
  lapsed_premium: z.coerce.number().nonnegative(),
  net_premium_change: z.coerce.number(),
  running_total_policies: z.coerce.number().int().nonnegative(),
  running_total_premium: z.coerce.number().nonnegative(),
});

export type MonthlyPerformanceRow = z.infer<typeof MonthlyPerformanceRowSchema>;

/**
 * Schema for weekly performance report row (Agency)
 */
export const WeeklyPerformanceRowSchema = z.object({
  week_start: z.string(), // ISO date string
  week_end: z.string(), // ISO date string
  week_label: z.string(),
  new_policies: z.coerce.number().int().nonnegative(),
  new_premium: z.coerce.number().nonnegative(),
  commissions_earned: z.coerce.number().nonnegative(),
  policies_lapsed: z.coerce.number().int().nonnegative(),
  lapsed_premium: z.coerce.number().nonnegative(),
  net_premium_change: z.coerce.number(),
  running_total_policies: z.coerce.number().int().nonnegative(),
  running_total_premium: z.coerce.number().nonnegative(),
});

export type WeeklyPerformanceRow = z.infer<typeof WeeklyPerformanceRowSchema>;

/**
 * Schema for team comparison report row (agency rankings)
 */
export const TeamComparisonRowSchema = z.object({
  agency_id: z.string().uuid(),
  agency_name: z.string(),
  agency_code: z.string(),
  owner_name: z.string(),
  agent_count: z.coerce.number().int().nonnegative(),
  new_policies: z.coerce.number().int().nonnegative(),
  new_premium: z.coerce.number().nonnegative(),
  commissions_earned: z.coerce.number().nonnegative(),
  avg_premium_per_policy: z.coerce.number().nonnegative(),
  avg_premium_per_agent: z.coerce.number().nonnegative(),
  policies_lapsed: z.coerce.number().int().nonnegative(),
  retention_rate: z.coerce.number().nonnegative(),
  rank_by_premium: z.coerce.number().int().positive(),
  rank_by_policies: z.coerce.number().int().positive(),
  pct_of_imo_premium: z.coerce.number().nonnegative(),
});

export type TeamComparisonRow = z.infer<typeof TeamComparisonRowSchema>;

/**
 * Schema for top performers report row (agent rankings)
 */
export const TopPerformerRowSchema = z.object({
  agent_id: z.string().uuid(),
  agent_name: z.string(),
  agent_email: z.string().nullable(), // Email may be null if user has no email
  agency_name: z.string(),
  agency_id: z.string().uuid(),
  contract_level: z.coerce.number().int().nullable(),
  new_policies: z.coerce.number().int().nonnegative(),
  new_premium: z.coerce.number().nonnegative(),
  commissions_earned: z.coerce.number().nonnegative(),
  avg_premium_per_policy: z.coerce.number().nonnegative(),
  rank_in_imo: z.coerce.number().int().positive(),
  rank_in_agency: z.coerce.number().int().positive(),
});

export type TopPerformerRow = z.infer<typeof TopPerformerRowSchema>;

/**
 * Parse and validate IMO performance report response
 * @throws ZodError if validation fails
 */
export function parseImoPerformanceReport(
  data: unknown[],
): MonthlyPerformanceRow[] {
  return z.array(MonthlyPerformanceRowSchema).parse(data);
}

/**
 * Parse and validate Agency performance report response
 * @throws ZodError if validation fails
 */
export function parseAgencyPerformanceReport(
  data: unknown[],
): MonthlyPerformanceRow[] {
  return z.array(MonthlyPerformanceRowSchema).parse(data);
}

/**
 * Parse and validate team comparison report response
 * @throws ZodError if validation fails
 */
export function parseTeamComparisonReport(
  data: unknown[],
): TeamComparisonRow[] {
  return z.array(TeamComparisonRowSchema).parse(data);
}

/**
 * Parse and validate top performers report response
 * @throws ZodError if validation fails
 */
export function parseTopPerformersReport(data: unknown[]): TopPerformerRow[] {
  return z.array(TopPerformerRowSchema).parse(data);
}

/**
 * Parse and validate agency weekly production response
 * @throws ZodError if validation fails
 */
export function parseAgencyWeeklyProduction(
  data: unknown[],
): WeeklyPerformanceRow[] {
  return z.array(WeeklyPerformanceRowSchema).parse(data);
}

/**
 * TypeScript interfaces for service layer return types
 */
export interface ImoPerformanceReport {
  months: MonthlyPerformanceRow[];
  summary: {
    total_new_policies: number;
    total_new_premium: number;
    total_commissions: number;
    total_new_agents: number;
    total_lapsed: number;
    net_growth: number;
  };
}

export interface AgencyPerformanceReport {
  agency_id: string;
  months: MonthlyPerformanceRow[];
  summary: {
    total_new_policies: number;
    total_new_premium: number;
    total_commissions: number;
    total_new_agents: number;
    total_lapsed: number;
    net_growth: number;
  };
}

export interface AgencyWeeklyReport {
  agency_id: string;
  weeks: WeeklyPerformanceRow[];
  summary: {
    total_new_policies: number;
    total_new_premium: number;
    total_commissions: number;
    total_lapsed: number;
    net_growth: number;
  };
}

export interface TeamComparisonReport {
  agencies: TeamComparisonRow[];
  summary: {
    total_agencies: number;
    total_agents: number;
    total_new_premium: number;
    avg_retention_rate: number;
  };
}

export interface TopPerformersReport {
  performers: TopPerformerRow[];
  date_range: {
    start_date: string;
    end_date: string;
  };
}

/**
 * Date range parameters for report queries
 */
export interface ReportDateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Maximum allowed date range in months for performance reports.
 * Prevents abuse by limiting the number of monthly aggregations.
 */
export const MAX_REPORT_DATE_RANGE_MONTHS = 24;

/**
 * Error thrown when date range validation fails
 */
export class DateRangeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DateRangeValidationError";
  }
}

/**
 * Validates a date range for report queries.
 * @throws DateRangeValidationError if validation fails
 */
export function validateReportDateRange(dateRange?: ReportDateRange): void {
  if (!dateRange) return; // Optional, will use defaults

  const { startDate, endDate } = dateRange;

  // Check dates are valid
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new DateRangeValidationError("Invalid start date");
  }
  if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new DateRangeValidationError("Invalid end date");
  }

  // Check start is before end
  if (startDate > endDate) {
    throw new DateRangeValidationError("Start date must be before end date");
  }

  // Check range doesn't exceed maximum
  const monthsDiff = getMonthsDifference(startDate, endDate);
  if (monthsDiff > MAX_REPORT_DATE_RANGE_MONTHS) {
    throw new DateRangeValidationError(
      `Date range exceeds maximum of ${MAX_REPORT_DATE_RANGE_MONTHS} months (requested: ${monthsDiff} months)`,
    );
  }

  // Check dates are not in the future (beyond current month)
  const now = new Date();
  const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  if (startDate > endOfCurrentMonth) {
    throw new DateRangeValidationError("Start date cannot be in the future");
  }
}

/**
 * Calculate the number of months between two dates (inclusive)
 */
export function getMonthsDifference(startDate: Date, endDate: Date): number {
  const yearDiff = endDate.getFullYear() - startDate.getFullYear();
  const monthDiff = endDate.getMonth() - startDate.getMonth();
  return yearDiff * 12 + monthDiff + 1; // +1 for inclusive
}

/**
 * Clamp a date range to the maximum allowed range.
 * If the range exceeds the limit, adjusts startDate to be within limit of endDate.
 */
export function clampDateRange(dateRange: ReportDateRange): ReportDateRange {
  const { startDate, endDate } = dateRange;
  const monthsDiff = getMonthsDifference(startDate, endDate);

  if (monthsDiff <= MAX_REPORT_DATE_RANGE_MONTHS) {
    return dateRange;
  }

  // Clamp start date to be MAX_REPORT_DATE_RANGE_MONTHS before end date
  const clampedStart = new Date(endDate);
  clampedStart.setMonth(
    clampedStart.getMonth() - MAX_REPORT_DATE_RANGE_MONTHS + 1,
  );
  clampedStart.setDate(1); // First of month

  return {
    startDate: clampedStart,
    endDate,
  };
}

/**
 * Format date for PostgreSQL query parameters
 */
export function formatDateForQuery(date: Date): string {
  return formatDateForDB(date);
}

/**
 * Build RPC date range parameters with YTD defaults.
 * Centralizes the common pattern of defaulting to YTD when no date range provided.
 * @param dateRange - Optional date range; if not provided, defaults to YTD
 * @returns Object with p_start_date and p_end_date formatted for PostgreSQL
 */
export function buildDateRangeParams(dateRange?: ReportDateRange): {
  p_start_date: string;
  p_end_date: string;
} {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  return {
    p_start_date: dateRange
      ? formatDateForQuery(dateRange.startDate)
      : formatDateForQuery(yearStart),
    p_end_date: dateRange
      ? formatDateForQuery(dateRange.endDate)
      : formatDateForQuery(now),
  };
}
