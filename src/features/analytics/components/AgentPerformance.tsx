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
        <div className="p-3 text-center text-[11px] text-v2-ink-muted">
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
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
            Agent Performance
          </div>
          <div className="text-xs text-v2-ink-muted mt-0.5">
            {entries.length} agents · top 10 shown
          </div>
        </div>
        {entries[0] && (
          <div className="text-right">
            <div className="text-2xl font-semibold tracking-tight text-v2-ink leading-none truncate max-w-[140px]">
              {entries[0].agentName}
            </div>
            <div className="text-[10px] text-v2-ink-subtle mt-1">
              {entries[0].policyCount} policies leads
            </div>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="p-3 text-center text-[11px] text-v2-ink-muted">
          No agent data for this period
        </div>
      ) : (
        <Table className="text-[11px]">
          <TableHeader>
            <TableRow className="h-7 border-b border-v2-ring">
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas w-8">
                #
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas">
                Agent
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                Policies
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                AP
              </TableHead>
              <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                IP
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.slice(0, 10).map((entry) => (
              <TableRow
                key={entry.agentId}
                className="border-b border-v2-ring/60 hover:bg-v2-canvas"
              >
                <TableCell className="p-1.5 font-mono text-v2-ink-subtle">
                  {entry.rankOverall}
                </TableCell>
                <TableCell className="p-1.5 text-v2-ink truncate max-w-[120px]">
                  {entry.agentName}
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono text-v2-ink">
                  {entry.policyCount}
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono text-v2-ink">
                  {formatCurrency(entry.apTotal)}
                </TableCell>
                <TableCell className="p-1.5 text-right font-mono text-v2-ink">
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
          <div className="p-1 bg-v2-canvas rounded text-center">
            <div className="text-v2-ink-subtle">Total Policies</div>
            <div className="font-bold font-mono text-v2-ink">
              {data.totals.totalPolicies}
            </div>
          </div>
          <div className="p-1 bg-v2-canvas rounded text-center">
            <div className="text-v2-ink-subtle">Total AP</div>
            <div className="font-bold font-mono text-v2-ink">
              {formatCurrency(data.totals.totalAp)}
            </div>
          </div>
          <div className="p-1 bg-v2-canvas rounded text-center">
            <div className="text-v2-ink-subtle">Total IP</div>
            <div className="font-bold font-mono text-v2-ink">
              {formatCurrency(data.totals.totalIp)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
