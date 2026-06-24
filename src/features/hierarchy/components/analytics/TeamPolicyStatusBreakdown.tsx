// src/features/hierarchy/components/analytics/TeamPolicyStatusBreakdown.tsx

import React from "react";
import { cn } from "@/lib/utils";
import type { TeamPolicyStatusBreakdown as TeamPolicyStatusBreakdownType } from "@/types/team-analytics.types";
import { Board, Cap } from "@/components/board";

interface TeamPolicyStatusBreakdownProps {
  data: TeamPolicyStatusBreakdownType | null;
  isLoading?: boolean;
}

/**
 * TeamPolicyStatusBreakdown - Team policy status overview
 *
 * Shows active, pending, lapsed, and cancelled policies
 * with premium breakdown and persistency rate
 */
export function TeamPolicyStatusBreakdown({
  data,
  isLoading,
}: TeamPolicyStatusBreakdownProps) {
  if (isLoading || !data) {
    return (
      <Board pad={16}>
        <Cap style={{ marginBottom: 10 }}>Team Policy Status</Cap>
        <div className="p-3 text-center text-[12px] text-v2-ink-muted">
          {isLoading ? "Loading..." : "No data available"}
        </div>
      </Board>
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

  // Status data for rendering
  const statuses = [
    {
      label: "Active",
      count: data.active.count,
      premium: data.active.premium,
      color: "emerald",
      percent:
        data.total.count > 0
          ? ((data.active.count / data.total.count) * 100).toFixed(1)
          : "0",
    },
    {
      label: "Pending",
      count: data.pending.count,
      premium: data.pending.premium,
      color: "blue",
      percent:
        data.total.count > 0
          ? ((data.pending.count / data.total.count) * 100).toFixed(1)
          : "0",
    },
    {
      label: "Lapsed",
      count: data.lapsed.count,
      premium: data.lapsed.premium,
      color: "amber",
      percent:
        data.total.count > 0
          ? ((data.lapsed.count / data.total.count) * 100).toFixed(1)
          : "0",
    },
    {
      label: "Cancelled",
      count: data.cancelled.count,
      premium: data.cancelled.premium,
      color: "red",
      percent:
        data.total.count > 0
          ? ((data.cancelled.count / data.total.count) * 100).toFixed(1)
          : "0",
    },
  ];

  const getColorClass = (color: string, type: "text" | "bg") => {
    const colors: Record<string, Record<string, string>> = {
      emerald: {
        text: "text-success",
        bg: "bg-success dark:bg-success/70",
      },
      blue: {
        text: "text-info",
        bg: "bg-info dark:bg-info/70",
      },
      amber: {
        text: "text-warning",
        bg: "bg-warning dark:bg-warning/70",
      },
      red: {
        text: "text-destructive",
        bg: "bg-destructive dark:bg-destructive/70",
      },
    };
    return colors[color]?.[type] || "";
  };

  return (
    <Board pad={16}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <Cap>Team Policy Status</Cap>
          <div className="text-[11px] text-v2-ink-subtle">
            {data.total.count} total policies · current book (all-time)
          </div>
        </div>
        <div
          className={cn(
            "px-1.5 py-0.5 rounded text-[11px] font-medium",
            data.persistencyRate >= 80
              ? "bg-success/10 text-success"
              : data.persistencyRate >= 60
                ? "bg-warning/10 text-warning"
                : "bg-destructive/10 text-destructive",
          )}
        >
          {data.persistencyRate.toFixed(1)}% Persistency
        </div>
      </div>

      {/* Status Breakdown Grid */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {statuses.map((status) => (
          <div key={status.label} className="p-2 bg-v2-canvas rounded">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-v2-ink-muted">
                {status.label}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium",
                  getColorClass(status.color, "text"),
                )}
              >
                {status.percent}%
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  "font-mono font-bold text-sm",
                  getColorClass(status.color, "text"),
                )}
              >
                {status.count}
              </span>
              <span className="text-[11px] text-v2-ink-subtle">
                {formatCurrency(status.premium)}
              </span>
            </div>
            {/* Mini progress bar */}
            <div className="h-1 bg-v2-ring rounded-full overflow-hidden mt-1">
              <div
                className={cn("h-full", getColorClass(status.color, "bg"))}
                style={{ width: `${status.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Total Summary */}
      <div className="p-2 bg-v2-ring rounded flex items-center justify-between">
        <span className="text-[11px] font-medium text-v2-ink-muted">
          Total Premium
        </span>
        <span className="font-mono font-bold text-sm text-v2-ink">
          {formatCurrency(data.total.premium)}
        </span>
      </div>
    </Board>
  );
}
