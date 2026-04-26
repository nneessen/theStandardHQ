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
        <div className="p-3 text-center text-[11px] text-v2-ink-muted">
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
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-5">
      {/* Header */}
      <div className="mb-4">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Policy Status
        </div>
        <div className="text-xs text-v2-ink-muted mt-0.5">
          Active vs lapsed vs cancelled
        </div>
      </div>

      {/* Three big stat tiles */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-v2-sm p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300 font-semibold">
            Active
          </div>
          <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 leading-none">
            {statusSummary.active.count}
          </div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-v2-sm p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300 font-semibold">
            Lapsed
          </div>
          <div className="text-2xl font-semibold text-amber-600 dark:text-amber-400 mt-0.5 leading-none">
            {statusSummary.lapsed.count}
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-v2-sm p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-red-700 dark:text-red-300 font-semibold">
            Cancelled
          </div>
          <div className="text-2xl font-semibold text-red-600 dark:text-red-400 mt-0.5 leading-none">
            {statusSummary.cancelled.count}
          </div>
        </div>
      </div>

      {/* Compact Monthly Trend Chart */}
      <div className="mb-3">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em] mb-2">
          12-month trend
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
                  <TableRow className="h-7 border-b border-v2-ring">
                    <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas">
                      Product
                    </TableHead>
                    <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                      Rate
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bestPerformers.slice(0, 3).map((product, idx) => (
                    <TableRow
                      key={idx}
                      className="border-b border-v2-ring/60 hover:bg-v2-canvas"
                    >
                      <TableCell className="p-1.5 text-v2-ink">
                        {formatProductName(product.productName)}
                        <span className="text-[10px] text-v2-ink-subtle ml-1">
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
                  <TableRow className="h-7 border-b border-v2-ring">
                    <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas">
                      Product
                    </TableHead>
                    <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                      Rate
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {needsAttention.slice(0, 3).map((product, idx) => (
                    <TableRow
                      key={idx}
                      className="border-b border-v2-ring/60 hover:bg-v2-canvas"
                    >
                      <TableCell className="p-1.5 text-v2-ink">
                        {formatProductName(product.productName)}
                        <span className="text-[10px] text-v2-ink-subtle ml-1">
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
        <div className="text-center text-[11px] text-v2-ink-subtle py-2">
          Insufficient data for retention analysis
        </div>
      )}
    </div>
  );
}
