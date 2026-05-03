// src/features/hierarchy/components/analytics/TeamGeographicAnalysis.tsx

import React from "react";
import { cn } from "@/lib/utils";
import type { TeamGeographicBreakdown } from "@/types/team-analytics.types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TeamGeographicAnalysisProps {
  data: TeamGeographicBreakdown[];
  isLoading?: boolean;
}

/**
 * TeamGeographicAnalysis - Team premium distribution by state
 */
export function TeamGeographicAnalysis({
  data,
  isLoading,
}: TeamGeographicAnalysisProps) {
  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em]">
          Team Premium by State
        </div>
        <div className="p-3 text-center text-[10px] text-v2-ink-muted">
          Loading...
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate totals
  const totalPolicies = data.reduce((sum, d) => sum + d.policyCount, 0);
  const totalPremium = data.reduce((sum, d) => sum + d.totalPremium, 0);

  // Take top 10 states
  const topStates = data.slice(0, 10);

  // Calculate average premium per state for comparison (prefixed as unused)
  const _avgPremiumPerState = data.length > 0 ? totalPremium / data.length : 0;

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em]">
          Team Premium by State
        </div>
        <span className="text-[10px] text-v2-ink-subtle">
          {data.length} states • Top 10
        </span>
      </div>

      {topStates.length > 0 ? (
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
            {topStates.map((row, idx) => {
              const avgPerPolicy =
                row.policyCount > 0 ? row.totalPremium / row.policyCount : 0;
              return (
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
                    {formatCurrency(avgPerPolicy)}
                  </TableCell>
                  <TableCell className="p-1.5 text-right">
                    <span
                      className={cn(
                        "font-mono",
                        row.percentage >= 20
                          ? "text-success font-bold"
                          : row.percentage >= 10
                            ? "text-warning"
                            : "text-v2-ink-muted",
                      )}
                    >
                      {row.percentage.toFixed(1)}%
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="p-3 text-center text-[11px] text-v2-ink-subtle">
          No geographic data available
        </div>
      )}

      {/* Summary footer */}
      {topStates.length > 0 && (
        <div className="mt-2 p-2 bg-v2-canvas rounded flex items-center justify-between text-[10px]">
          <span className="text-v2-ink-muted">
            {totalPolicies} policies across {data.length} states
          </span>
          <span className="font-mono font-bold text-v2-ink">
            {formatCurrency(totalPremium)}
          </span>
        </div>
      )}
    </div>
  );
}
