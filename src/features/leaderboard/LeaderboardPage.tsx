// src/features/leaderboard/LeaderboardPage.tsx
// Main leaderboard page — "The Board" departure-board chrome.

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PillNav, SoftCard } from "@/components/v2";
import { BoardPageHeader, Board, Cap, Num, T } from "@/components/board";
import {
  useAgentLeaderboard,
  useAgencyLeaderboard,
  useTeamLeaderboard,
  useSubmitLeaderboard,
} from "@/hooks/leaderboard";
import { LeaderboardTable } from "./components/LeaderboardTable";
import { LeaderboardCustomRange } from "./components/LeaderboardCustomRange";
import { MetricsHelpPopover } from "./components/MetricsHelpPopover";
import { formatCompactCurrency } from "@/lib/format";
import type {
  LeaderboardFilters,
  LeaderboardTimePeriod,
  LeaderboardScope,
  TeamThreshold,
} from "@/types/leaderboard.types";

// Board period segmented control ↔ leaderboard timePeriod.
const BOARD_PERIODS = ["MTD", "YTD", "CUSTOM"] as const;
const LABEL_TO_PERIOD: Record<string, LeaderboardTimePeriod> = {
  MTD: "mtd",
  YTD: "ytd",
  CUSTOM: "custom",
};

const scopes: { value: LeaderboardScope; label: string }[] = [
  { value: "submit", label: "Submit" },
  { value: "all", label: "Agents" },
  { value: "agency", label: "Agencies" },
  { value: "team", label: "Teams" },
];

const thresholds: { value: TeamThreshold; label: string }[] = [
  { value: 3, label: "3+" },
  { value: 5, label: "5+" },
  { value: 10, label: "10+" },
];

export function LeaderboardPage() {
  const [filters, setFilters] = useState<LeaderboardFilters>({
    timePeriod: "mtd",
    scope: "all",
    teamThreshold: 5,
  });

  // Determine which query to run based on scope
  const queryEnabled =
    filters.timePeriod !== "custom" ||
    (!!filters.startDate && !!filters.endDate);

  const agentQuery = useAgentLeaderboard({
    filters,
    enabled: queryEnabled && filters.scope === "all",
  });

  const agencyQuery = useAgencyLeaderboard({
    filters,
    enabled: queryEnabled && filters.scope === "agency",
  });

  const teamQuery = useTeamLeaderboard({
    filters,
    enabled: queryEnabled && filters.scope === "team",
  });

  const submitQuery = useSubmitLeaderboard({
    filters,
    enabled: queryEnabled && filters.scope === "submit",
  });

  // Get the active query data
  const activeQuery =
    filters.scope === "submit"
      ? submitQuery
      : filters.scope === "agency"
        ? agencyQuery
        : filters.scope === "team"
          ? teamQuery
          : agentQuery;

  const { data, isLoading, error } = activeQuery;
  const totals = data?.totals;

  // Update a filter value
  const updateFilter = <K extends keyof LeaderboardFilters>(
    key: K,
    value: LeaderboardFilters[K],
  ) => {
    const newFilters = { ...filters, [key]: value };

    if (key === "timePeriod" && value !== "custom") {
      newFilters.startDate = undefined;
      newFilters.endDate = undefined;
    }

    setFilters(newFilters);
  };

  // Determine label based on scope
  const entryLabel =
    filters.scope === "submit"
      ? "agents"
      : filters.scope === "agency"
        ? "agencies"
        : filters.scope === "team"
          ? "teams"
          : "agents";

  // Totals rendered as departure-board stat panels (real, scope-aware).
  const statCells: { label: string; value: string; tone?: string }[] = totals
    ? [
        { label: entryLabel, value: totals.totalEntries.toLocaleString() },
        ...(filters.scope !== "submit" && "totalIp" in totals
          ? [
              {
                label: "IP",
                value: formatCompactCurrency(totals.totalIp),
                tone: T.amber,
              },
            ]
          : []),
        {
          label: "AP",
          value: formatCompactCurrency(totals.totalAp),
          tone: filters.scope === "submit" ? T.amber : undefined,
        },
        {
          label: filters.scope === "submit" ? "Submitted" : "Policies",
          value: totals.totalPolicies.toLocaleString(),
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-3">
      <BoardPageHeader
        title="LEADERBOARD"
        meta={
          totals && !isLoading
            ? `${totals.totalEntries.toLocaleString()} ${entryLabel}`
            : undefined
        }
        periods={[...BOARD_PERIODS]}
        period={filters.timePeriod.toUpperCase()}
        onPeriodChange={(label) =>
          updateFilter("timePeriod", LABEL_TO_PERIOD[label])
        }
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <PillNav
              size="sm"
              activeValue={filters.scope}
              onChange={(v) => updateFilter("scope", v as LeaderboardScope)}
              items={scopes.map((s) => ({ label: s.label, value: s.value }))}
            />

            {filters.scope === "team" && (
              <Select
                value={String(filters.teamThreshold || 5)}
                onValueChange={(v) =>
                  updateFilter("teamThreshold", Number(v) as TeamThreshold)
                }
              >
                <SelectTrigger className="h-7 w-16 text-[11px] border-border bg-card rounded-v2-pill">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {thresholds.map((t) => (
                    <SelectItem key={t.value} value={String(t.value)}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {filters.timePeriod === "custom" && (
              <LeaderboardCustomRange
                startDate={filters.startDate}
                endDate={filters.endDate}
                onChange={(start, end) => {
                  setFilters((prev) => ({
                    ...prev,
                    startDate: start,
                    endDate: end,
                  }));
                }}
              />
            )}

            <MetricsHelpPopover />
          </div>
        }
      />

      {/* Real, scope-aware totals as riveted board panels. */}
      {statCells.length > 0 && (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${statCells.length}, minmax(0,1fr))`,
          }}
        >
          {statCells.map((c) => (
            <Board key={c.label} pad={16}>
              <Cap>{c.label}</Cap>
              <div className="mt-2">
                <Num text={c.value} size="md" color={c.tone} />
              </div>
            </Board>
          ))}
        </div>
      )}

      {/* Main table */}
      <SoftCard padding="none" className="overflow-hidden flex flex-col">
        <LeaderboardTable
          scope={filters.scope}
          entries={data?.entries || []}
          isLoading={isLoading}
          error={error}
        />
      </SoftCard>
    </div>
  );
}
