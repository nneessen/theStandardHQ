// src/features/leaderboard/LeaderboardPage.tsx
// Main leaderboard page - data-dense, v2 chrome

import { useState } from "react";
import {
  Trophy,
  Users,
  Building2,
  Calendar,
  TrendingUp,
  FileText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PillNav, SoftCard } from "@/components/v2";
import {
  useAgentLeaderboard,
  useAgencyLeaderboard,
  useTeamLeaderboard,
  useSubmitLeaderboard,
} from "@/hooks/leaderboard";
import { LeaderboardTable } from "./components/LeaderboardTable";
import { MetricsHelpPopover } from "./components/MetricsHelpPopover";
import { cn } from "@/lib/utils";
import { formatCompactCurrency } from "@/lib/format";
import type {
  LeaderboardFilters,
  LeaderboardTimePeriod,
  LeaderboardScope,
  TeamThreshold,
} from "@/types/leaderboard.types";

const SCOPE_ICONS: Record<LeaderboardScope, React.ElementType> = {
  submit: FileText,
  all: Users,
  agency: Building2,
  team: TrendingUp,
};

const timePeriods: { value: LeaderboardTimePeriod; label: string }[] = [
  { value: "mtd", label: "MTD" },
  { value: "ytd", label: "YTD" },
  { value: "custom", label: "Custom" },
];

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

  const scopeNavItems = scopes.map((s) => {
    const Icon = SCOPE_ICONS[s.value];
    return { label: s.label, value: s.value, icon: Icon };
  });

  return (
    <div className="flex flex-col gap-2">
      {/* Compact header — title + inline summary chips + filters in ONE row */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Trophy className="h-4 w-4 text-v2-accent-strong" />
            <h1 className="text-base font-semibold tracking-tight text-v2-ink">
              Leaderboard
            </h1>
            <MetricsHelpPopover />
          </div>
          {totals && !isLoading && (
            <div className="flex items-center gap-x-2 gap-y-0.5 text-[11px] text-v2-ink-muted flex-wrap leading-tight">
              <span>
                <span className="text-v2-ink font-semibold">
                  {totals.totalEntries.toLocaleString()}
                </span>{" "}
                {entryLabel}
              </span>
              {filters.scope !== "submit" && "totalIp" in totals && (
                <>
                  <span className="text-v2-ink-subtle">·</span>
                  <span>
                    <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                      {formatCompactCurrency(totals.totalIp)}
                    </span>{" "}
                    IP
                  </span>
                </>
              )}
              <span className="text-v2-ink-subtle">·</span>
              <span>
                <span
                  className={cn(
                    "font-mono font-semibold",
                    filters.scope === "submit"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-v2-ink",
                  )}
                >
                  {formatCompactCurrency(totals.totalAp)}
                </span>{" "}
                AP
              </span>
              <span className="text-v2-ink-subtle">·</span>
              <span>
                <span className="text-v2-ink font-semibold">
                  {totals.totalPolicies.toLocaleString()}
                </span>{" "}
                {filters.scope === "submit" ? "submitted" : "policies"}
              </span>
            </div>
          )}
          {isLoading && (
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <PillNav
            size="sm"
            activeValue={filters.scope}
            onChange={(v) => updateFilter("scope", v as LeaderboardScope)}
            items={scopeNavItems.map((s) => ({
              label: s.label,
              value: s.value,
            }))}
          />

          {filters.scope === "team" && (
            <Select
              value={String(filters.teamThreshold || 5)}
              onValueChange={(v) =>
                updateFilter("teamThreshold", Number(v) as TeamThreshold)
              }
            >
              <SelectTrigger className="h-7 w-16 text-[11px] border-v2-ring bg-v2-card rounded-v2-pill">
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

          <PillNav
            size="sm"
            activeValue={filters.timePeriod}
            onChange={(v) =>
              updateFilter("timePeriod", v as LeaderboardTimePeriod)
            }
            items={timePeriods.map((p) => ({ label: p.label, value: p.value }))}
          />

          {filters.timePeriod === "custom" && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-v2-ink-subtle" />
              <Input
                type="date"
                value={filters.startDate || ""}
                onChange={(e) => updateFilter("startDate", e.target.value)}
                className="h-7 w-28 text-[11px] px-2 bg-v2-card border-v2-ring"
              />
              <span className="text-[11px] text-v2-ink-subtle">–</span>
              <Input
                type="date"
                value={filters.endDate || ""}
                onChange={(e) => updateFilter("endDate", e.target.value)}
                className="h-7 w-28 text-[11px] px-2 bg-v2-card border-v2-ring"
              />
            </div>
          )}
        </div>
      </header>

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
