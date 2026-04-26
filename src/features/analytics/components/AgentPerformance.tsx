// src/features/analytics/components/AgentPerformance.tsx

import React from "react";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import { useAgentLeaderboard } from "@/hooks/leaderboard";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeaderboardFilters } from "@/types/leaderboard.types";

/**
 * AgentPerformance - Compact agent leaderboard for the analytics page
 * filtered by the analytics date range
 */
export function AgentPerformance() {
  const { dateRange } = useAnalyticsDateRange();

  // Map analytics date range to leaderboard filters
  const filters: LeaderboardFilters = {
    timePeriod: "custom",
    startDate: format(dateRange.startDate, "yyyy-MM-dd"),
    endDate: format(dateRange.endDate, "yyyy-MM-dd"),
    scope: "all",
  };

  const { data, isLoading } = useAgentLeaderboard({
    filters,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Agent Performance
        </div>
        <div className="p-3 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    );
  }

  const entries = data?.entries || [];

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Agent Performance
        </div>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          {entries.length} agents
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="p-3 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
          No agent data for this period
        </div>
      ) : (
        <Table className="text-[11px]">
          <TableHeader>
            <TableRow className="h-7 border-b border-zinc-200 dark:border-zinc-800">
              <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 w-8">
                #
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">
                Agent
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                Policies
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                AP
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 text-right">
                IP
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.slice(0, 10).map((entry) => (
              <TableRow
                key={entry.agentId}
                className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <TableCell className="p-1.5 font-mono text-zinc-400 dark:text-zinc-500">
                  {entry.rankOverall}
                </TableCell>
                <TableCell className="p-1.5 text-zinc-900 dark:text-zinc-100 truncate max-w-[120px]">
                  {entry.agentName}
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono text-zinc-900 dark:text-zinc-100">
                  {entry.policyCount}
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(entry.apTotal)}
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(entry.ipTotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Totals */}
      {data?.totals && entries.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
          <div className="p-1 bg-zinc-50 dark:bg-zinc-800/50 rounded text-center">
            <div className="text-zinc-400 dark:text-zinc-500">
              Total Policies
            </div>
            <div className="font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {data.totals.totalPolicies}
            </div>
          </div>
          <div className="p-1 bg-zinc-50 dark:bg-zinc-800/50 rounded text-center">
            <div className="text-zinc-400 dark:text-zinc-500">Total AP</div>
            <div className="font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {formatCurrency(data.totals.totalAp)}
            </div>
          </div>
          <div className="p-1 bg-zinc-50 dark:bg-zinc-800/50 rounded text-center">
            <div className="text-zinc-400 dark:text-zinc-500">Total IP</div>
            <div className="font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {formatCurrency(data.totals.totalIp)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
