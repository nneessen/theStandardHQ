// src/features/analytics/components/IncomeGoalTracker.tsx

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CircularProgressGauge } from "../visualizations/CircularProgressGauge";
import { useCommissions, useCalculatedTargets } from "@/hooks";
// eslint-disable-next-line no-restricted-imports
import {
  calculateGoalTracking,
  getGoalStatusLabel,
  getGoalStatusBadgeColor,
} from "@/services/analytics/goalTrackingService";
import { formatCurrency } from "@/utils/formatters";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  DollarSign,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

export function IncomeGoalTracker() {
  const { calculated, isLoading: targetsLoading } = useCalculatedTargets();
  const { data: commissions = [], isLoading: commissionsLoading } =
    useCommissions();

  const isLoading = targetsLoading || commissionsLoading;

  // Annual goal = realistic gross commission needed for the year. This is the
  // pre-tax/pre-expense commission income that, after persistency × first-year
  // rate, NTO drag, and tax reserve, lands the user at their NET take-home
  // target. YTD `goalData.ytdEarned` is gross paid commissions, so the units
  // line up.
  const annualGoal =
    calculated && calculated.realisticGrossCommissionNeeded > 0
      ? calculated.realisticGrossCommissionNeeded
      : 120000;
  // Display the user's NET take-home goal alongside, since that's what they
  // actually care about hitting.
  const netTakeHomeGoal = calculated?.annualIncomeTarget ?? 0;

  // Calculate goal tracking data
  const goalData = calculateGoalTracking({
    commissions,
    annualGoal,
  });

  // Determine gauge color based on status
  const gaugeColor = goalData.isAhead
    ? "green"
    : goalData.isBehind
      ? "red"
      : "yellow";

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Income Goal Tracker</CardTitle>
          <CardDescription>Loading your goal progress...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">
            Calculating...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Income Goal Tracker</CardTitle>
            <CardDescription>
              Gross Commission Target: {formatCurrency(annualGoal)}
              {netTakeHomeGoal > 0 && (
                <span className="text-muted-foreground/70">
                  {" "}
                  → {formatCurrency(netTakeHomeGoal)} take-home
                </span>
              )}
            </CardDescription>
          </div>
          <Link
            to="/settings"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Edit Goal
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Gauge and Status */}
        <div className="flex flex-col items-center gap-4">
          <CircularProgressGauge
            percentage={goalData.goalProgress}
            size={180}
            strokeWidth={14}
            color={gaugeColor}
            label="Complete"
          />

          <div className="text-center space-y-1">
            <div
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
                getGoalStatusBadgeColor(goalData),
              )}
            >
              {goalData.isAhead ? (
                <TrendingUp className="h-4 w-4" />
              ) : goalData.isBehind ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
              {getGoalStatusLabel(goalData)}
            </div>

            {goalData.aheadBehindAmount !== 0 && (
              <p className="text-sm text-muted-foreground">
                {goalData.isAhead ? "+" : ""}
                {formatCurrency(goalData.aheadBehindAmount)}{" "}
                {goalData.isAhead ? "ahead" : "behind"} pace
              </p>
            )}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* YTD Earned */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              YTD Earned
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(goalData.ytdEarned)}
            </div>
            <div className="text-xs text-muted-foreground">
              Expected: {formatCurrency(goalData.ytdExpected)}
            </div>
          </div>

          {/* Projected Year-End */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Projected Year-End
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(goalData.projectedYearEnd)}
            </div>
            {goalData.projectedShortfall > 0 ? (
              <div className="text-xs text-destructive">
                {formatCurrency(goalData.projectedShortfall)} short
              </div>
            ) : (
              <div className="text-xs text-success">
                On track to exceed goal
              </div>
            )}
          </div>
        </div>

        {/* Targets to Hit Goal */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4" />
            To Hit Goal, You Need:
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">
                Per Month
              </div>
              <div className="text-lg font-semibold">
                {formatCurrency(goalData.neededPerMonth, {
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>

            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Per Week</div>
              <div className="text-lg font-semibold">
                {formatCurrency(goalData.neededPerWeek, {
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>

            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Per Day</div>
              <div className="text-lg font-semibold">
                {formatCurrency(goalData.neededPerDay, {
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Time Remaining */}
        <div className="flex items-center justify-between text-sm pt-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Time Remaining
          </div>
          <div className="font-medium">
            {goalData.monthsRemaining} months, {goalData.weeksRemaining % 4}{" "}
            weeks ({goalData.daysRemaining} days)
          </div>
        </div>

        {/* Pace Indicator */}
        {goalData.isAccelerating && (
          <div className="flex items-center justify-center gap-2 text-sm text-success bg-success/10 dark:bg-success/10 p-2 rounded-lg">
            <TrendingUp className="h-4 w-4" />
            Your pace is accelerating! Last 30 days outperformed previous 30.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
