import { useMemo, useState } from "react";
import { useAgentLeaderboard } from "@/hooks/leaderboard";
import { formatCompactCurrency } from "@/lib/format";
import { getInitials } from "@/lib/string";
import { cn } from "@/lib/utils";
import type { LeaderboardTimePeriod } from "@/types/leaderboard.types";

type SortMetric = "ap" | "ip";

const PERIODS: { value: LeaderboardTimePeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "mtd", label: "Monthly" },
  { value: "ytd", label: "Yearly" },
];

interface Props {
  accent: string;
}

/**
 * Individual-agent AP/IP leaderboard, org-wide (scope "all"), with daily / weekly /
 * monthly / yearly filtering and AP-vs-IP sort. Sort + rank are applied client-side
 * over the entries the RPC already returns (each agent appears once, so no
 * double-counting); the SQL ranks by IP, so the displayed rank reflects the chosen
 * metric here.
 */
export function AgentLeaderboardDetail({ accent }: Props) {
  const [period, setPeriod] = useState<LeaderboardTimePeriod>("mtd");
  const [sortBy, setSortBy] = useState<SortMetric>("ip");

  const { data, isLoading, isError } = useAgentLeaderboard({
    filters: { timePeriod: period, scope: "all" },
  });

  const rows = useMemo(() => {
    const entries = data?.entries ?? [];
    return [...entries].sort((a, b) =>
      sortBy === "ap" ? b.apTotal - a.apTotal : b.ipTotal - a.ipTotal,
    );
  }, [data, sortBy]);

  const totals = data?.totals;

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide transition-colors",
                period === p.value
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              style={
                period === p.value
                  ? { background: `${accent}22`, color: accent }
                  : undefined
              }
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Sort
          </span>
          {(["ip", "ap"] as SortMetric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSortBy(m)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                sortBy === m
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              style={
                sortBy === m
                  ? { background: `${accent}22`, color: accent }
                  : undefined
              }
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Column header */}
      <div
        className="grid grid-cols-[2rem_1fr_5rem_5rem] items-center gap-2 border-b pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"
        style={{ borderColor: `${accent}1f` }}
      >
        <span>#</span>
        <span>Agent</span>
        <span
          className={cn("text-right", sortBy === "ip" && "text-foreground")}
        >
          IP
        </span>
        <span
          className={cn("text-right", sortBy === "ap" && "text-foreground")}
        >
          AP
        </span>
      </div>

      {/* Rows */}
      <div
        className="h-[360px] space-y-0.5 overflow-y-auto overscroll-contain pr-1"
        onWheel={(e) => e.stopPropagation()}
      >
        {isLoading ? (
          <div className="space-y-1.5 pt-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-white/5" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Couldn't load the leaderboard. Try again in a moment.
          </p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No agent production for this period yet.
          </p>
        ) : (
          rows.map((e, i) => {
            const apActive = sortBy === "ap";
            const ipActive = sortBy === "ip";
            return (
              <div
                key={e.agentId}
                className="grid grid-cols-[2rem_1fr_5rem_5rem] items-center gap-2 rounded-md px-1 py-1.5 text-xs hover:bg-white/5"
              >
                <span
                  className="font-mono tabular-nums"
                  style={{ color: accent }}
                >
                  {i + 1}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-semibold"
                    style={{ background: `${accent}1f`, color: accent }}
                  >
                    {getInitials(e.agentName)}
                  </span>
                  <span className="truncate text-foreground">
                    {e.agentName}
                  </span>
                </span>
                <span
                  className={cn(
                    "text-right font-mono tabular-nums",
                    ipActive ? "font-semibold" : "text-muted-foreground",
                  )}
                  style={ipActive ? { color: accent } : undefined}
                >
                  {formatCompactCurrency(e.ipTotal)}
                </span>
                <span
                  className={cn(
                    "text-right font-mono tabular-nums",
                    apActive ? "font-semibold" : "text-muted-foreground",
                  )}
                  style={apActive ? { color: accent } : undefined}
                >
                  {formatCompactCurrency(e.apTotal)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Totals footer */}
      {totals && rows.length > 0 && (
        <div
          className="grid grid-cols-[2rem_1fr_5rem_5rem] items-center gap-2 border-t pt-2 text-xs"
          style={{ borderColor: `${accent}1f` }}
        >
          <span />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {rows.length} agents · totals
          </span>
          <span className="text-right font-mono font-semibold tabular-nums text-foreground">
            {formatCompactCurrency(totals.totalIp)}
          </span>
          <span className="text-right font-mono font-semibold tabular-nums text-foreground">
            {formatCompactCurrency(totals.totalAp)}
          </span>
        </div>
      )}
    </div>
  );
}
