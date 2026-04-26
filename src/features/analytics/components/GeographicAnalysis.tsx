// src/features/analytics/components/GeographicAnalysis.tsx

import React from "react";
import { cn } from "@/lib/utils";
import { useAnalyticsData } from "../../../hooks";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StateData {
  state: string;
  policyCount: number;
  totalPremium: number;
  avgPremium: number;
  percentOfTotal: number;
}

/**
 * GeographicAnalysis - Premium by state
 * Ultra-compact display with shared components
 */
export function GeographicAnalysis() {
  const { dateRange } = useAnalyticsDateRange();
  const { raw, isLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Premium by State
        </div>
        <div className="p-3 text-center text-[10px] text-zinc-500 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    );
  }

  // Aggregate by state
  const stateMap = new Map<string, { count: number; totalPremium: number }>();

  raw.policies.forEach((policy) => {
    const state = policy.client?.state || "Unknown";
    const existing = stateMap.get(state) || { count: 0, totalPremium: 0 };
    stateMap.set(state, {
      count: existing.count + 1,
      totalPremium: existing.totalPremium + (policy.annualPremium || 0),
    });
  });

  // Calculate total premium for percentage calculations
  const totalPremium = Array.from(stateMap.values()).reduce(
    (sum, data) => sum + data.totalPremium,
    0,
  );

  // Convert to array and calculate metrics
  const stateData: StateData[] = Array.from(stateMap.entries()).map(
    ([state, data]) => ({
      state,
      policyCount: data.count,
      totalPremium: data.totalPremium,
      avgPremium: data.count > 0 ? data.totalPremium / data.count : 0,
      percentOfTotal:
        totalPremium > 0 ? (data.totalPremium / totalPremium) * 100 : 0,
    }),
  );

  // Sort by total premium (descending) and take top 10 states
  const sortedData = stateData
    .sort((a, b) => b.totalPremium - a.totalPremium)
    .slice(0, 10);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Premium by State
        </div>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          Top {sortedData.length} states
        </span>
      </div>

      {sortedData.length > 0 ? (
        <Table className="text-[11px]">
          <TableHeader>
            <TableRow className="h-7 border-b border-zinc-200 dark:border-zinc-800">
              <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">
                State
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                Policies
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                Total
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                Avg
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                % Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row, idx) => (
              <TableRow
                key={idx}
                className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <TableCell className="p-1.5 font-medium text-zinc-900 dark:text-zinc-100">
                  {row.state}
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono text-zinc-500 dark:text-zinc-400">
                  {row.policyCount}
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(row.totalPremium)}
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono text-zinc-500 dark:text-zinc-400">
                  {formatCurrency(row.avgPremium)}
                </TableCell>
                <TableCell className="p-1.5 text-right">
                  <span
                    className={cn(
                      "font-mono",
                      row.percentOfTotal >= 20
                        ? "text-emerald-600 dark:text-emerald-400"
                        : row.percentOfTotal >= 10
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-zinc-500 dark:text-zinc-400",
                    )}
                  >
                    {row.percentOfTotal.toFixed(1)}%
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="p-3 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
          No state data available
        </div>
      )}
    </div>
  );
}
