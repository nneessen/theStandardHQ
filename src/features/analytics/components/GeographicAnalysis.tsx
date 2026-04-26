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
        <div className="p-3 text-center text-[10px] text-v2-ink-muted">
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
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
            Premium by State
          </div>
          <div className="text-xs text-v2-ink-muted mt-0.5">
            Top {sortedData.length} states by AP
          </div>
        </div>
        {sortedData[0] && (
          <div className="text-right">
            <div className="text-2xl font-semibold tracking-tight text-v2-ink leading-none">
              {sortedData[0].state}
            </div>
            <div className="text-[10px] text-v2-ink-subtle mt-1">
              {sortedData[0].percentOfTotal.toFixed(1)}% of book
            </div>
          </div>
        )}
      </div>

      {sortedData.length > 0 ? (
        <Table className="text-[11px]">
          <TableHeader>
            <TableRow className="h-7 border-b border-v2-ring">
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas">
                State
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                Policies
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                Total
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                Avg
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                % Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row, idx) => (
              <TableRow
                key={idx}
                className="border-b border-v2-ring/60 hover:bg-v2-canvas"
              >
                <TableCell className="p-1.5 font-medium text-v2-ink">
                  {row.state}
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono text-v2-ink-muted">
                  {row.policyCount}
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono font-semibold text-v2-ink">
                  {formatCurrency(row.totalPremium)}
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono text-v2-ink-muted">
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
                          : "text-v2-ink-muted",
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
        <div className="p-3 text-center text-[11px] text-v2-ink-subtle">
          No state data available
        </div>
      )}
    </div>
  );
}
