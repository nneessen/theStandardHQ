// src/features/close-kpi/components/team/TeamAgentsTable.tsx
// Dense sortable table — one row per agent, all key engagement metrics.
// CLAUDE.md "Prefer tables over cards for lists" — zinc palette, no rainbow colors.

import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeamPipelineRow } from "../../types/team-kpi.types";

interface TeamAgentsTableProps {
  rows: TeamPipelineRow[];
}

type SortKey =
  | "name"
  | "totalLeads"
  | "hotCount"
  | "warmingCount"
  | "avgScore"
  | "totalDials"
  | "connectRate"
  | "staleLeadsCount"
  | "untouchedActive"
  | "noAnswerStreak"
  | "activeOppsCount"
  | "openOppValueUsd"
  | "lastScoredAt";

type SortDir = "asc" | "desc";

const ACTIVE_THRESHOLD_MS = 90 * 60 * 1000;

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function displayName(r: TeamPipelineRow): string {
  const full = [r.firstName, r.lastName].filter(Boolean).join(" ").trim();
  return full || r.email;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
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

function isStale(iso: string | null): boolean {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > ACTIVE_THRESHOLD_MS;
}

function compareRows(
  a: TeamPipelineRow,
  b: TeamPipelineRow,
  key: SortKey,
): number {
  switch (key) {
    case "name":
      return displayName(a).localeCompare(displayName(b));
    case "lastScoredAt": {
      const ax = a.lastScoredAt ? new Date(a.lastScoredAt).getTime() : 0;
      const bx = b.lastScoredAt ? new Date(b.lastScoredAt).getTime() : 0;
      return ax - bx;
    }
    case "avgScore":
    case "connectRate": {
      const ax = a[key] ?? -1;
      const bx = b[key] ?? -1;
      return ax - bx;
    }
    default:
      return (a[key] as number) - (b[key] as number);
  }
}

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  direction: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}

const SortableHeader: React.FC<SortableHeaderProps> = ({
  label,
  sortKey,
  currentKey,
  direction,
  onSort,
  align = "right",
}) => {
  const active = currentKey === sortKey;
  const Icon = !active
    ? ArrowUpDown
    : direction === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <th
      className={cn(
        "px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground select-none",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          align === "right" && "flex-row-reverse",
          active && "text-foreground",
        )}
      >
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </button>
    </th>
  );
};

export const TeamAgentsTable: React.FC<TeamAgentsTableProps> = ({ rows }) => {
  const [sortKey, setSortKey] = useState<SortKey>("totalLeads");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      // Self always pinned to top regardless of sort
      if (a.isSelf && !b.isSelf) return -1;
      if (!a.isSelf && b.isSelf) return 1;
      const cmp = compareRows(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-background">
      <table className="w-full text-[11px]">
        <thead className="bg-muted/40 border-b border-border sticky top-0">
          <tr>
            <SortableHeader
              label="Agent"
              sortKey="name"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
              align="left"
            />
            <SortableHeader
              label="Leads"
              sortKey="totalLeads"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="Hot"
              sortKey="hotCount"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="Warm"
              sortKey="warmingCount"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="Avg"
              sortKey="avgScore"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="Dials"
              sortKey="totalDials"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="Conn%"
              sortKey="connectRate"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="Stale"
              sortKey="staleLeadsCount"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="Untouched"
              sortKey="untouchedActive"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="NA Streak"
              sortKey="noAnswerStreak"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="Opps"
              sortKey="activeOppsCount"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="Open $"
              sortKey="openOppValueUsd"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="Last Run"
              sortKey="lastScoredAt"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const stale = isStale(r.lastScoredAt);
            return (
              <tr
                key={r.userId}
                className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                {/* Agent */}
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.profilePhotoUrl ? (
                      <img
                        src={r.profilePhotoUrl}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-muted-foreground">
                          {(
                            r.firstName?.[0] ??
                            r.email[0] ??
                            "?"
                          ).toUpperCase()}
                        </span>
                      </div>
                    )}
                    {stale && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0"
                        title={`Last scored ${relativeTime(r.lastScoredAt)}`}
                      />
                    )}
                    <span className="font-medium text-foreground truncate">
                      {displayName(r)}
                    </span>
                    {r.isSelf && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-1 py-0.5 rounded flex-shrink-0">
                        You
                      </span>
                    )}
                  </div>
                </td>

                {/* Leads */}
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground">
                  {r.totalLeads.toLocaleString()}
                </td>

                {/* Hot */}
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground">
                  {r.hotCount.toLocaleString()}
                </td>

                {/* Warm */}
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                  {r.warmingCount.toLocaleString()}
                </td>

                {/* Avg score */}
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground">
                  {r.avgScore != null ? r.avgScore.toFixed(1) : "—"}
                </td>

                {/* Dials */}
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground">
                  {r.totalDials.toLocaleString()}
                </td>

                {/* Connect rate */}
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground">
                  {r.connectRate != null
                    ? `${(r.connectRate * 100).toFixed(1)}%`
                    : "—"}
                </td>

                {/* Stale */}
                <td
                  className={cn(
                    "px-2 py-1.5 text-right font-mono tabular-nums",
                    r.staleLeadsCount > 0
                      ? "text-amber-600 dark:text-amber-500"
                      : "text-muted-foreground",
                  )}
                >
                  {r.staleLeadsCount.toLocaleString()}
                </td>

                {/* Untouched active */}
                <td
                  className={cn(
                    "px-2 py-1.5 text-right font-mono tabular-nums",
                    r.untouchedActive > 0
                      ? "text-amber-600 dark:text-amber-500"
                      : "text-muted-foreground",
                  )}
                >
                  {r.untouchedActive.toLocaleString()}
                </td>

                {/* NA streak */}
                <td
                  className={cn(
                    "px-2 py-1.5 text-right font-mono tabular-nums",
                    r.noAnswerStreak > 0
                      ? "text-amber-600 dark:text-amber-500"
                      : "text-muted-foreground",
                  )}
                >
                  {r.noAnswerStreak.toLocaleString()}
                </td>

                {/* Active opps */}
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground">
                  {r.activeOppsCount.toLocaleString()}
                </td>

                {/* Open $ */}
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground">
                  {currency.format(r.openOppValueUsd)}
                </td>

                {/* Last Run */}
                <td
                  className={cn(
                    "px-2 py-1.5 text-right text-[10px]",
                    stale
                      ? "text-amber-600 dark:text-amber-500"
                      : "text-muted-foreground",
                  )}
                >
                  {relativeTime(r.lastScoredAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
