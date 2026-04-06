// src/features/close-kpi/components/team/TeamTab.tsx
// Container for the Close KPIs Team tab.
// Owns loading / empty / error / partial-empty states.

import React from "react";
import { AlertTriangle, RefreshCw, Users } from "lucide-react";
import { useTeamPipelineSnapshot } from "../../hooks/useTeamPipelineSnapshot";
import { TeamAgentsTable } from "./TeamAgentsTable";
import { TeamSummaryCards } from "./TeamSummaryCards";

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export const TeamTab: React.FC = () => {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useTeamPipelineSnapshot();

  // ─── Loading skeleton ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[60px] rounded-md border border-border bg-muted/30 animate-pulse"
            />
          ))}
        </div>
        <div className="rounded-md border border-border bg-background overflow-hidden">
          <div className="h-8 bg-muted/40 border-b border-border" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-7 border-b border-border last:border-b-0 bg-muted/10 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="rounded-md border border-border bg-background p-6 flex flex-col items-center text-center">
        <AlertTriangle className="h-6 w-6 text-amber-500 mb-2" />
        <p className="text-[12px] font-medium text-foreground mb-1">
          Couldn't load team snapshot
        </p>
        <p className="text-[10px] text-muted-foreground mb-3 max-w-md">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[10px] font-medium rounded border border-border bg-background hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  const rows = data ?? [];

  // ─── Empty state ─────────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-border bg-background p-6 flex flex-col items-center text-center">
        <Users className="h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-[12px] font-medium text-foreground mb-1">
          No team members with Close connected yet
        </p>
        <p className="text-[10px] text-muted-foreground max-w-md">
          Agents appear here once they connect Close and complete their first
          scoring run.
        </p>
      </div>
    );
  }

  // ─── Partial empty: rows exist but everyone has 0 leads ──────────
  const hasAnyLeads = rows.some((r) => r.totalLeads > 0);
  const lastRun = rows
    .map((r) => r.lastScoredAt)
    .filter((x): x is string => !!x)
    .sort()
    .pop();

  // ─── Header bar ──────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground">
            Team Pipeline ({rows.length}{" "}
            {rows.length === 1 ? "agent" : "agents"})
          </span>
          <span
            className="text-[10px] text-muted-foreground"
            title="Call & engagement signals reflect activity in the last 30 days, refreshed every 30 minutes by the lead heat scoring cron."
          >
            · last 30 days
          </span>
          {lastRun && (
            <span className="text-[10px] text-muted-foreground">
              · scored {relativeTime(lastRun)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1 h-7 px-2 text-[10px] font-medium rounded border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {!hasAnyLeads && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <p className="text-[11px] text-muted-foreground">
            No leads scored yet for any team member. Last cron run:{" "}
            {relativeTime(lastRun ?? null)}.
          </p>
        </div>
      )}

      <TeamSummaryCards rows={rows} />
      <TeamAgentsTable rows={rows} />
    </div>
  );
};
