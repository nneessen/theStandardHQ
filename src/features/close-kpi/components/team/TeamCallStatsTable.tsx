// src/features/close-kpi/components/team/TeamCallStatsTable.tsx
//
// Per-agent daily call stats table. Primary view of the Team tab.
// One row per agent: Agent | Dials | Connects | Conn% | Talk Time | VM | Last Call
// Self pinned to top. Sortable by every numeric column.

import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeamCallStatsRow } from "../../types/team-call-stats.types";

interface TeamCallStatsTableProps {
  rows: TeamCallStatsRow[];
}

type SortKey =
  | "name"
  | "dials"
  | "connects"
  | "connectRate"
  | "talkTimeSeconds"
  | "voicemails"
  | "lastCallAt";

type SortDir = "asc" | "desc";

function displayName(r: TeamCallStatsRow): string {
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

function formatTalkTime(seconds: number): string {
  if (seconds <= 0) return "—";
  const totalMin = Math.floor(seconds / 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh > 0) return `${hh}h ${mm}m`;
  return `${mm}m`;
}

function compareRows(
  a: TeamCallStatsRow,
  b: TeamCallStatsRow,
  key: SortKey,
): number {
  switch (key) {
    case "name":
      return displayName(a).localeCompare(displayName(b));
    case "lastCallAt": {
      const ax = a.lastCallAt ? new Date(a.lastCallAt).getTime() : 0;
      const bx = b.lastCallAt ? new Date(b.lastCallAt).getTime() : 0;
      return ax - bx;
    }
    case "connectRate": {
      const ax = a.connectRate ?? -1;
      const bx = b.connectRate ?? -1;
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
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
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

export const TeamCallStatsTable: React.FC<TeamCallStatsTableProps> = ({
  rows,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>("dials");
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
              label="Dials"
              sortKey="dials"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="Connects"
              sortKey="connects"
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
              label="Talk Time"
              sortKey="talkTimeSeconds"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="VM"
              sortKey="voicemails"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="Last Call"
              sortKey="lastCallAt"
              currentKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const hasError = !!r.error;
            return (
              <tr
                key={r.userId}
                className={cn(
                  "border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors",
                  hasError && "opacity-60",
                )}
              >
                {/* Agent */}
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.profilePhotoUrl ? (
                      <img
                        src={r.profilePhotoUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-5 w-5 rounded-full object-cover flex-shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
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
                    <span className="font-medium text-foreground truncate">
                      {displayName(r)}
                    </span>
                    {r.isSelf && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-1 py-0.5 rounded flex-shrink-0">
                        You
                      </span>
                    )}
                    {hasError && (
                      <span
                        className="inline-flex items-center"
                        title={r.error ?? ""}
                      >
                        <AlertCircle className="h-3 w-3 text-amber-500" />
                      </span>
                    )}
                  </div>
                </td>

                {/* Dials */}
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground">
                  {hasError ? "—" : r.dials.toLocaleString()}
                </td>

                {/* Connects */}
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground">
                  {hasError ? "—" : r.connects.toLocaleString()}
                </td>

                {/* Connect rate */}
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground">
                  {r.connectRate != null
                    ? `${(r.connectRate * 100).toFixed(1)}%`
                    : "—"}
                </td>

                {/* Talk time */}
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground">
                  {formatTalkTime(r.talkTimeSeconds)}
                </td>

                {/* Voicemails */}
                <td
                  className={cn(
                    "px-2 py-1.5 text-right font-mono tabular-nums",
                    r.voicemails > 0
                      ? "text-amber-600 dark:text-amber-500"
                      : "text-muted-foreground",
                  )}
                >
                  {hasError ? "—" : r.voicemails.toLocaleString()}
                </td>

                {/* Last Call */}
                <td className="px-2 py-1.5 text-right text-[10px] text-muted-foreground">
                  {relativeTime(r.lastCallAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
