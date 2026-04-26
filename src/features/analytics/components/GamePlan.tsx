// src/features/analytics/components/GamePlan.tsx

import React from "react";
import { useAnalyticsData } from "../../../hooks";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import { useUserTargets } from "../../../hooks/targets/useUserTargets";
import { useExpenses } from "../../../hooks/expenses/useExpenses";
import { gamePlanService } from "../../../services/analytics/gamePlanService";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Target, TrendingUp, AlertCircle } from "lucide-react";

/**
 * GamePlan - Shows what you need to do to hit your target
 *
 * Actionable, easy-to-understand game plan with:
 * - Progress to goal (using REAL user targets from database)
 * - Multiple path options
 * - Smart recommendations
 * - What-if scenarios
 * - Proper MTD (month-to-date) calculations
 */
export function GamePlan() {
  const { dateRange } = useAnalyticsDateRange();

  // Fetch policies and commissions filtered by the selected date range
  const { raw, isLoading: isAnalyticsLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  // Fetch user's actual targets from database
  const { data: userTargets, isLoading: isTargetsLoading } = useUserTargets();

  // Fetch expenses for MTD calculation
  const { data: allExpenses, isLoading: isExpensesLoading } = useExpenses();

  const isLoading = isAnalyticsLoading || isTargetsLoading || isExpensesLoading;

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Game Plan
        </div>
        <div className="p-3 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    );
  }

  // Calculate expenses within the selected date range
  const periodExpenses = (allExpenses || [])
    .filter((e) => {
      const expenseDate = new Date(e.date);
      return (
        expenseDate >= dateRange.startDate && expenseDate <= dateRange.endDate
      );
    })
    .reduce((sum, e) => sum + e.amount, 0);

  // Calculate game plan using REAL data
  const gamePlan = gamePlanService.calculateGamePlan(
    raw.policies,
    raw.commissions,
    userTargets || null,
    periodExpenses,
  );

  // Calculate annual progress
  const annualProgress = gamePlanService.calculateAnnualProgress(
    raw.policies,
    raw.commissions,
    userTargets || null,
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Helper functions for Smart Moves
  const getMoveIcon = (icon: string) => {
    switch (icon) {
      case "target":
        return <Target className="h-3 w-3" />;
      case "trending":
        return <TrendingUp className="h-3 w-3" />;
      case "alert":
        return <AlertCircle className="h-3 w-3" />;
      default:
        return <CheckCircle2 className="h-3 w-3" />;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "high":
        return "text-red-600 dark:text-red-400";
      case "medium":
        return "text-amber-600 dark:text-amber-400";
      default:
        return "text-emerald-600 dark:text-emerald-400";
    }
  };

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Game Plan
        </div>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          {gamePlan.currentMonth} • {gamePlan.daysRemainingInMonth}d left
        </span>
      </div>

      {/* Monthly Progress Bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Monthly Goal Progress
          </span>
          <span className="text-[11px] font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {Math.round(gamePlan.progressPercent)}%
          </span>
        </div>
        <div className="h-2 bg-v2-ring rounded-v2-pill overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-300",
              gamePlan.progressPercent >= 100
                ? "bg-emerald-600 dark:bg-emerald-400"
                : gamePlan.progressPercent >= 75
                  ? "bg-amber-600 dark:bg-amber-400"
                  : "bg-red-600 dark:bg-red-400",
            )}
            style={{ width: `${Math.min(100, gamePlan.progressPercent)}%` }}
          />
        </div>
      </div>

      {/* Compact Monthly Stats Grid */}
      <div className="grid grid-cols-4 gap-1 mb-2 text-[11px]">
        <div className="p-2 bg-v2-canvas border border-v2-ring rounded-v2-sm text-center">
          <div className="text-zinc-400 dark:text-zinc-500">MTD</div>
          <div className="font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {formatCurrency(gamePlan.mtdCommissions)}
          </div>
        </div>
        <div className="p-2 bg-v2-canvas border border-v2-ring rounded-v2-sm text-center">
          <div className="text-zinc-400 dark:text-zinc-500">Goal</div>
          <div className="font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {formatCurrency(gamePlan.grossCommissionNeeded)}
          </div>
        </div>
        <div className="p-2 bg-v2-canvas border border-v2-ring rounded-v2-sm text-center">
          <div className="text-zinc-400 dark:text-zinc-500">Gap</div>
          <div
            className={cn(
              "font-bold font-mono",
              gamePlan.gap > 0
                ? "text-red-600 dark:text-red-400"
                : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {formatCurrency(Math.abs(gamePlan.gap))}
          </div>
        </div>
        <div className="p-2 bg-v2-canvas border border-v2-ring rounded-v2-sm text-center">
          <div className="text-zinc-400 dark:text-zinc-500">Days</div>
          <div className="font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {gamePlan.daysRemainingInMonth}
          </div>
        </div>
      </div>

      {/* Annual Progress Bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Annual Goal Progress
          </span>
          <span className="text-[11px] font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {Math.round(annualProgress.progressPercent)}%
          </span>
        </div>
        <div className="h-2 bg-v2-ring rounded-v2-pill overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-300",
              annualProgress.onTrackForYear
                ? "bg-emerald-600 dark:bg-emerald-400"
                : "bg-amber-600 dark:bg-amber-400",
            )}
            style={{
              width: `${Math.min(100, annualProgress.progressPercent)}%`,
            }}
          />
        </div>
      </div>

      {/* Compact Annual Stats */}
      <div className="grid grid-cols-4 gap-1 mb-2 text-[11px]">
        <div className="p-2 bg-v2-canvas border border-v2-ring rounded-v2-sm text-center">
          <div className="text-zinc-400 dark:text-zinc-500">YTD</div>
          <div className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {formatCurrency(annualProgress.ytdCommissions)}
          </div>
        </div>
        <div className="p-2 bg-v2-canvas border border-v2-ring rounded-v2-sm text-center">
          <div className="text-zinc-400 dark:text-zinc-500">Annual</div>
          <div className="font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {formatCurrency(annualProgress.annualGoal)}
          </div>
        </div>
        <div className="p-2 bg-v2-canvas border border-v2-ring rounded-v2-sm text-center">
          <div className="text-zinc-400 dark:text-zinc-500">Need</div>
          <div className="font-bold font-mono text-red-600 dark:text-red-400">
            {formatCurrency(annualProgress.remainingNeeded)}
          </div>
        </div>
        <div className="p-2 bg-v2-canvas border border-v2-ring rounded-v2-sm text-center">
          <div className="text-zinc-400 dark:text-zinc-500">Months</div>
          <div className="font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {annualProgress.monthsRemaining}
          </div>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 gap-1 p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded mb-2">
        <div className="text-center">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Monthly Avg Needed
          </div>
          <div className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">
            {formatCurrency(annualProgress.avgMonthlyNeeded)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Policies/Month
          </div>
          <div className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">
            ~{annualProgress.policiesNeededPerMonth}
          </div>
        </div>
      </div>

      {/* Smart Moves Section */}
      {gamePlan.smartMoves && gamePlan.smartMoves.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em] mb-1 mt-2">
            Smart Moves
          </div>
          <Table className="text-[11px] mb-2">
            <TableHeader>
              <TableRow className="h-7 border-b border-zinc-200 dark:border-zinc-800">
                <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 w-6"></TableHead>
                <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">
                  Action
                </TableHead>
                <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">
                  Details
                </TableHead>
                <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                  Priority
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- smart moves data type */}
              {gamePlan.smartMoves.slice(0, 3).map((row: any, idx: number) => (
                <TableRow
                  key={idx}
                  className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <TableCell className="p-1.5 w-6">
                    <div className={getUrgencyColor(row.urgency)}>
                      {getMoveIcon(row.icon)}
                    </div>
                  </TableCell>
                  <TableCell className="p-1.5">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {row.title}
                    </span>
                  </TableCell>
                  <TableCell className="p-1.5">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {row.description}
                    </span>
                  </TableCell>
                  <TableCell className="p-1.5 text-right">
                    <span
                      className={cn(
                        "text-[10px] font-medium uppercase",
                        getUrgencyColor(row.urgency),
                      )}
                    >
                      {row.urgency}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {/* What-If Scenarios */}
      {gamePlan.scenarios && gamePlan.scenarios.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em] mb-1 mt-2">
            What If Scenarios
          </div>
          <Table className="text-[11px] mb-2">
            <TableHeader>
              <TableRow className="h-7 border-b border-zinc-200 dark:border-zinc-800">
                <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">
                  Scenario
                </TableHead>
                <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                  Projected
                </TableHead>
                <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                  Goal %
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- scenario data type */}
              {gamePlan.scenarios.slice(0, 4).map((row: any, idx: number) => {
                const isGood = row.goalPercent >= 100;
                const isClose = row.goalPercent >= 90;
                return (
                  <TableRow
                    key={idx}
                    className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <TableCell className="p-1.5">
                      <span className="text-[11px] text-zinc-900 dark:text-zinc-100">
                        {row.condition}
                      </span>
                    </TableCell>
                    <TableCell className="p-1.5 text-right font-mono text-[11px] text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(row.projectedEarnings)}
                    </TableCell>
                    <TableCell className="p-1.5 text-right">
                      <span
                        className={cn(
                          "font-mono font-bold text-[11px]",
                          isGood
                            ? "text-emerald-600 dark:text-emerald-400"
                            : isClose
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400",
                        )}
                      >
                        {Math.round(row.goalPercent)}%
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}

      {/* Status Footer */}
      <div
        className={cn(
          "p-1.5 rounded text-center text-[11px] font-medium",
          gamePlan.gap > 0
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        )}
      >
        {gamePlan.gap > 0
          ? `Need ${formatCurrency(gamePlan.gap)} more to hit goal`
          : "Goal Achieved! Keep going!"}
      </div>
    </div>
  );
}
