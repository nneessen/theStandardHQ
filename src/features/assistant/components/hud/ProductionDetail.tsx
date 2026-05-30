import { useState } from "react";
import {
  useCommandCenterSummary,
  type ProductionScope,
} from "../../hooks/useCommandCenterSummary";
import { formatCompactCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LeaderboardTimePeriod } from "@/types/leaderboard.types";

const PERIODS: { value: LeaderboardTimePeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "mtd", label: "Monthly" },
  { value: "ytd", label: "Yearly" },
];

const SCOPES: { value: ProductionScope; label: string }[] = [
  { value: "personal", label: "Mine" },
  { value: "team", label: "My Team" },
];

interface Props {
  accent: string;
  scope: ProductionScope;
  onScopeChange: (s: ProductionScope) => void;
}

/**
 * Expanded production detail, scoped to the caller — "Mine" (own book) or
 * "My Team" (caller + downline) — for the selected period, from the
 * get_command_center_summary RPC. Scope is controlled by the parent so the
 * collapsed tile and this modal stay in sync; period is local to the modal.
 */
export function ProductionDetail({ accent, scope, onScopeChange }: Props) {
  const [period, setPeriod] = useState<LeaderboardTimePeriod>("mtd");
  const { data, isLoading, isError } = useCommandCenterSummary(scope, period);

  const stats: { label: string; value: string }[] = [
    {
      label: "Annual premium (AP)",
      value: formatCompactCurrency(data?.totalAp ?? 0),
    },
    {
      label: "Issued premium (IP)",
      value: formatCompactCurrency(data?.totalIp ?? 0),
    },
    { label: "Policies", value: String(data?.totalPolicies ?? 0) },
    { label: "Prospects", value: String(data?.totalProspects ?? 0) },
    { label: "Leads scored", value: String(data?.totalLeadsScored ?? 0) },
  ];

  return (
    <div className="space-y-3">
      {/* Scope: Mine vs My Team */}
      <div className="flex gap-1">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onScopeChange(s.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide transition-colors",
              scope === s.value
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            style={
              scope === s.value
                ? { background: `${accent}22`, color: accent }
                : undefined
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Period: daily / weekly / monthly / yearly */}
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

      {isError ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Couldn't load production. Try again in a moment.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-lg border p-3"
              style={{ borderColor: `${accent}1f`, background: `${accent}0a` }}
            >
              <div
                className="font-mono text-xl font-semibold tabular-nums leading-none"
                style={{ color: accent }}
              >
                {isLoading ? (
                  <span className="inline-block h-5 w-16 animate-pulse rounded bg-white/10" />
                ) : (
                  s.value
                )}
              </div>
              <div className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        {scope === "team"
          ? "You + your downline."
          : "Just your own production."}{" "}
        AP counts policies submitted in the period; IP counts approved policies
        that became effective in the period. Prospects and leads scored are
        current totals.
      </p>
    </div>
  );
}
