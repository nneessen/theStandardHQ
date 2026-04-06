// src/features/close-kpi/components/team/TeamTab.tsx
//
// Container for the Close KPIs Team tab. Two sections:
//   1. Daily Calls (primary) — fetched live from Close API per agent via the
//      get-team-call-stats edge function. Date selector defaults to "Today".
//      This is what the manager actively monitors throughout the day.
//   2. Pipeline Snapshot (secondary) — aggregated from lead_heat_scores,
//      30-day rolling window. Hot leads, stale leads, opportunity value, etc.
//      Slower-changing context that complements the daily activity view.

import React, { useEffect, useState } from "react";
import { AlertTriangle, Phone, RefreshCw, Users } from "lucide-react";
import { useTeamPipelineSnapshot } from "../../hooks/useTeamPipelineSnapshot";
import { useTeamCallStats } from "../../hooks/useTeamCallStats";
import { buildTeamCallRange } from "../../lib/team-call-range";
import { TeamAgentsTable } from "./TeamAgentsTable";
import { TeamCallStatsTable } from "./TeamCallStatsTable";
import { TeamDateRangeSelector } from "./TeamDateRangeSelector";
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

// ─── Daily Calls Section (primary) ───────────────────────────────────

const DailyCallsSection: React.FC = () => {
  // Default to "today" — this is the manager's primary daily check-in.
  // Lazy initializer so buildTeamCallRange runs exactly once on mount.
  const [range, setRange] = useState(() => buildTeamCallRange("today"));

  // Midnight rollover: if the user keeps the dashboard open across midnight
  // and the preset is "today", the cached range still points at yesterday.
  // Poll once per minute and re-compute "today" if the local calendar day
  // has advanced. Only active while the preset is "today" — picking any
  // other preset stops the interval (the effect re-runs and the early
  // return cleans up).
  useEffect(() => {
    if (range.preset !== "today") return;
    const checkRollover = () => {
      const fresh = buildTeamCallRange("today");
      // The from string carries the local-tz date; if it changed, the day
      // rolled over and we need to refetch with the new bounds.
      if (fresh.from !== range.from) {
        setRange(fresh);
      }
    };
    const interval = setInterval(checkRollover, 60_000);
    return () => clearInterval(interval);
  }, [range.preset, range.from]);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useTeamCallStats({ from: range.from, to: range.to });

  const rows = data?.rows ?? [];

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground">
            Daily Calls
          </span>
          <span className="text-[10px] text-muted-foreground">
            · {range.label.toLowerCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TeamDateRangeSelector value={range} onChange={setRange} />
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1 h-7 px-2 text-[10px] font-medium rounded border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="Refresh call stats"
          >
            <RefreshCw
              className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-md border border-border bg-background overflow-hidden">
          <div className="h-8 bg-muted/40 border-b border-border" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-7 border-b border-border last:border-b-0 bg-muted/10 animate-pulse"
            />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-md border border-border bg-background p-4 flex flex-col items-center text-center">
          <AlertTriangle className="h-5 w-5 text-amber-500 mb-2" />
          <p className="text-[11px] font-medium text-foreground mb-1">
            Couldn't load call stats
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
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="rounded-md border border-border bg-background p-4 flex flex-col items-center text-center">
          <Phone className="h-5 w-5 text-muted-foreground mb-2" />
          <p className="text-[11px] font-medium text-foreground">
            No team members with Close connected yet
          </p>
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <TeamCallStatsTable rows={rows} />
      )}
    </section>
  );
};

// ─── Pipeline Snapshot Section (secondary) ───────────────────────────

const PipelineSnapshotSection: React.FC = () => {
  const { data, isLoading, isError, error, refetch } =
    useTeamPipelineSnapshot();

  if (isLoading) {
    return (
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground">
            Pipeline Snapshot
          </span>
          <span className="text-[10px] text-muted-foreground">
            · last 30 days
          </span>
        </div>
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
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-7 border-b border-border last:border-b-0 bg-muted/10 animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground">
            Pipeline Snapshot
          </span>
        </div>
        <div className="rounded-md border border-border bg-background p-4 flex flex-col items-center text-center">
          <AlertTriangle className="h-5 w-5 text-amber-500 mb-2" />
          <p className="text-[11px] font-medium text-foreground mb-1">
            Couldn't load pipeline snapshot
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
      </section>
    );
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    // Pipeline snapshot empty state — daily calls section already shows the
    // "no team connected" message, so we can stay quiet here.
    return null;
  }

  const hasAnyLeads = rows.some((r) => r.totalLeads > 0);
  const lastRun = rows
    .map((r) => r.lastScoredAt)
    .filter((x): x is string => !!x)
    .sort()
    .pop();

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium text-foreground">
          Pipeline Snapshot
        </span>
        <span
          className="text-[10px] text-muted-foreground"
          title="Lead heat scores reflect activity in the last 30 days, refreshed every 30 minutes by the lead heat scoring cron."
        >
          · last 30 days
        </span>
        {lastRun && (
          <span className="text-[10px] text-muted-foreground">
            · scored {relativeTime(lastRun)}
          </span>
        )}
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
    </section>
  );
};

// ─── Top-level Team Tab ──────────────────────────────────────────────

export const TeamTab: React.FC = () => {
  return (
    <div className="space-y-5">
      <DailyCallsSection />
      <PipelineSnapshotSection />
    </div>
  );
};
