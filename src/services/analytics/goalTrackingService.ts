import type { Commission } from "../../types/commission.types";
import {
  startOfYear,
  endOfYear,
  differenceInDays,
  differenceInMonths,
  subDays,
  startOfDay,
} from "date-fns";

export interface GoalTrackingData {
  // Core metrics
  annualGoal: number;
  ytdEarned: number;
  ytdExpected: number;
  goalProgress: number; // Percentage (0-100)

  // Status
  isAhead: boolean;
  isOnTrack: boolean;
  isBehind: boolean;
  aheadBehindAmount: number; // Positive = ahead, negative = behind

  // Projections
  projectedYearEnd: number;
  projectedShortfall: number; // 0 if on track to exceed goal

  // Targets
  daysRemaining: number;
  weeksRemaining: number;
  monthsRemaining: number;
  neededPerDay: number;
  neededPerWeek: number;
  neededPerMonth: number;

  // Pace analysis
  currentDailyAverage: number;
  currentWeeklyAverage: number;
  currentMonthlyAverage: number;
  isAccelerating: boolean; // Based on last 30 days vs previous 30 days
}

interface CalculateGoalTrackingParams {
  commissions: Commission[];
  annualGoal: number;
  referenceDate?: Date; // Defaults to today
}

/**
 * The earliest `createdAt` that {@link calculateGoalTracking} can read, given a
 * reference date. It only ever looks at three windows — YTD `[startOfYear, now]`,
 * last-30 `[now-30, now]` and previous-30 `[now-60, now-30)` — so every row it
 * uses has `createdAt >= min(startOfYear, now-60d)`. We day-floor and subtract a
 * 2-day skew buffer so the bound is a safe superset regardless of timezone.
 *
 * Callers that want to bound a server-side commission fetch (so they don't load
 * an agent's whole history) should fetch `created_at >=` this value and pass the
 * result straight into calculateGoalTracking. Keep this in lockstep with the
 * windows above: if a wider window is ever added to calculateGoalTracking, widen
 * this bound too, or the fetch will silently under-read and skew money numbers.
 */
export function goalTrackingFetchWindowStart(
  referenceDate: Date = new Date(),
): Date {
  const yearStart = startOfYear(referenceDate);
  const sixtyDaysAgo = subDays(referenceDate, 60);
  return startOfDay(
    subDays(yearStart < sixtyDaysAgo ? yearStart : sixtyDaysAgo, 2),
  );
}

/**
 * Calculate comprehensive goal tracking metrics for income targets
 */
export function calculateGoalTracking({
  commissions,
  annualGoal,
  referenceDate = new Date(),
}: CalculateGoalTrackingParams): GoalTrackingData {
  const now = referenceDate;
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  // Calculate days in year and days elapsed
  const totalDaysInYear = differenceInDays(yearEnd, yearStart) + 1; // +1 to include last day
  const daysElapsed = differenceInDays(now, yearStart) + 1;
  const daysRemaining = Math.max(0, differenceInDays(yearEnd, now));
  const weeksRemaining = Math.max(0, Math.ceil(daysRemaining / 7));
  const monthsRemaining = Math.max(0, differenceInMonths(yearEnd, now) + 1);

  // Calculate YTD earned from commissions
  const ytdCommissions = commissions.filter((commission) => {
    const commissionDate = new Date(commission.createdAt);
    return commissionDate >= yearStart && commissionDate <= now;
  });

  const ytdEarned = ytdCommissions.reduce(
    (sum, c) => sum + (Number(c.earnedAmount) || 0),
    0,
  );

  // Calculate expected YTD based on time elapsed
  const ytdExpected = (annualGoal / totalDaysInYear) * daysElapsed;

  // Calculate ahead/behind
  const aheadBehindAmount = ytdEarned - ytdExpected;
  const toleranceThreshold = annualGoal * 0.05; // 5% tolerance for "on track"

  const isAhead = aheadBehindAmount > toleranceThreshold;
  const isBehind = aheadBehindAmount < -toleranceThreshold;
  const isOnTrack = !isAhead && !isBehind;

  // Calculate goal progress percentage
  const goalProgress = Math.min(100, (ytdEarned / annualGoal) * 100);

  // Project year-end based on current daily pace
  const currentDailyAverage = daysElapsed > 0 ? ytdEarned / daysElapsed : 0;
  const projectedYearEnd = currentDailyAverage * totalDaysInYear;
  const projectedShortfall = Math.max(0, annualGoal - projectedYearEnd);

  // Calculate what's needed per period to hit goal
  const amountRemaining = Math.max(0, annualGoal - ytdEarned);
  const neededPerDay = daysRemaining > 0 ? amountRemaining / daysRemaining : 0;
  const neededPerWeek =
    weeksRemaining > 0 ? amountRemaining / weeksRemaining : 0;
  const neededPerMonth =
    monthsRemaining > 0 ? amountRemaining / monthsRemaining : 0;

  // Calculate current averages
  const weeksElapsed = Math.max(1, Math.ceil(daysElapsed / 7));
  const monthsElapsed = Math.max(1, differenceInMonths(now, yearStart) + 1);
  const currentWeeklyAverage = ytdEarned / weeksElapsed;
  const currentMonthlyAverage = ytdEarned / monthsElapsed;

  // Determine if accelerating (compare last 30 days to previous 30 days)
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const last30DaysCommissions = commissions.filter((c) => {
    const date = new Date(c.createdAt);
    return date >= thirtyDaysAgo && date <= now;
  });

  const previous30DaysCommissions = commissions.filter((c) => {
    const date = new Date(c.createdAt);
    return date >= sixtyDaysAgo && date < thirtyDaysAgo;
  });

  const last30DaysTotal = last30DaysCommissions.reduce(
    (sum, c) => sum + (Number(c.earnedAmount) || 0),
    0,
  );
  const previous30DaysTotal = previous30DaysCommissions.reduce(
    (sum, c) => sum + (Number(c.earnedAmount) || 0),
    0,
  );

  const isAccelerating = last30DaysTotal > previous30DaysTotal;

  return {
    annualGoal,
    ytdEarned,
    ytdExpected,
    goalProgress,
    isAhead,
    isOnTrack,
    isBehind,
    aheadBehindAmount,
    projectedYearEnd,
    projectedShortfall,
    daysRemaining,
    weeksRemaining,
    monthsRemaining,
    neededPerDay,
    neededPerWeek,
    neededPerMonth,
    currentDailyAverage,
    currentWeeklyAverage,
    currentMonthlyAverage,
    isAccelerating,
  };
}

/**
 * Get status color based on goal tracking status
 */
export function getGoalStatusColor(data: GoalTrackingData): string {
  if (data.isAhead) return "text-green-600 dark:text-green-400";
  if (data.isBehind) return "text-red-600 dark:text-red-400";
  return "text-yellow-600 dark:text-yellow-400";
}

/**
 * Get status badge color
 */
export function getGoalStatusBadgeColor(data: GoalTrackingData): string {
  if (data.isAhead)
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (data.isBehind)
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
}

/**
 * Get status label
 */
export function getGoalStatusLabel(data: GoalTrackingData): string {
  if (data.isAhead) return "Ahead of Pace";
  if (data.isBehind) return "Behind Pace";
  return "On Track";
}
