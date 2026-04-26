// src/features/analytics/components/PolicyStatusBreakdown.tsx

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useAnalyticsData } from "@/hooks";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
// eslint-disable-next-line no-restricted-imports
import {
  getPolicyStatusSummary,
  getMonthlyTrendData,
  getProductRetentionRates,
} from "@/services/analytics/policyStatusService";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * PolicyStatusBreakdown - Clear view of policy statuses without jargon
 *
 * Replaces the confusing "cohort" terminology with simple, actionable insights:
 * - Active, Lapsed, Cancelled counts
 * - Monthly trends showing how policies change over time
 * - Best/worst performing products by retention
 */
export function PolicyStatusBreakdown() {
  const { dateRange } = useAnalyticsDateRange();
  const { raw, isLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Policy Status
        </div>
        <div className="p-3 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    );
  }

  const statusSummary = getPolicyStatusSummary(raw.policies);
  const monthlyTrend = getMonthlyTrendData(raw.policies);
  const { bestPerformers, needsAttention } = getProductRetentionRates(
    raw.policies,
  );

  // Format product names from snake_case to Title Case
  const formatProductName = (name: string): string => {
    return name
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
            Policy Status
          </div>
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Active vs Lapsed vs Cancelled
          </div>
        </div>
        {/* Status Summary */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
            {statusSummary.active.count}
          </span>
          <span className="text-amber-600 dark:text-amber-400 font-mono font-bold">
            {statusSummary.lapsed.count}
          </span>
          <span className="text-red-600 dark:text-red-400 font-mono font-bold">
            {statusSummary.cancelled.count}
          </span>
        </div>
      </div>

      {/* Compact Monthly Trend Chart */}
      <div className="mb-2">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em] mb-1">
          12-Month Trend
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrend}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#d9d5c7"
                strokeOpacity={0.6}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 9, fill: "#5e5d56" }}
                height={20}
              />
              <YAxis tick={{ fontSize: 9, fill: "#5e5d56" }} width={30} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0e0e0c",
                  border: "1px solid #ffd23b",
                  borderRadius: "12px",
                  fontSize: "10px",
                  padding: "6px 10px",
                  color: "#fff",
                }}
                labelStyle={{ color: "#ffd23b" }}
              />
              <Legend wrapperStyle={{ fontSize: "10px" }} iconSize={8} />
              <Line
                type="monotone"
                dataKey="active"
                stroke="#10b981"
                strokeWidth={1.5}
                name="Active"
                dot={{ r: 2 }}
              />
              <Line
                type="monotone"
                dataKey="lapsed"
                stroke="#ffd23b"
                strokeWidth={1.5}
                name="Lapsed"
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Compact Performance Tables */}
      {(bestPerformers.length > 0 || needsAttention.length > 0) && (
        <div className="grid grid-cols-2 gap-1.5">
          {/* Best Performers */}
          {bestPerformers.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em] mb-1">
                Best Performers
              </div>
              <Table className="text-[11px]">
                <TableHeader>
                  <TableRow className="h-7 border-b border-zinc-200 dark:border-zinc-800">
                    <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">
                      Product
                    </TableHead>
                    <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                      Rate
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bestPerformers.slice(0, 3).map((product, idx) => (
                    <TableRow
                      key={idx}
                      className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <TableCell className="p-1.5 text-zinc-900 dark:text-zinc-100">
                        {formatProductName(product.productName)}
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-1">
                          ({product.activePolicies})
                        </span>
                      </TableCell>
                      <TableCell className="p-1.5 text-right font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                        {product.retentionRate}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Needs Attention */}
          {needsAttention.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em] mb-1">
                Needs Attention
              </div>
              <Table className="text-[11px]">
                <TableHeader>
                  <TableRow className="h-7 border-b border-zinc-200 dark:border-zinc-800">
                    <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">
                      Product
                    </TableHead>
                    <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                      Rate
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {needsAttention.slice(0, 3).map((product, idx) => (
                    <TableRow
                      key={idx}
                      className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <TableCell className="p-1.5 text-zinc-900 dark:text-zinc-100">
                        {formatProductName(product.productName)}
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-1">
                          ({product.activePolicies})
                        </span>
                      </TableCell>
                      <TableCell className="p-1.5 text-right font-semibold font-mono text-amber-600 dark:text-amber-400">
                        {product.retentionRate}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {bestPerformers.length === 0 && needsAttention.length === 0 && (
        <div className="text-center text-[11px] text-zinc-400 dark:text-zinc-500 py-2">
          Insufficient data for retention analysis
        </div>
      )}
    </div>
  );
}
