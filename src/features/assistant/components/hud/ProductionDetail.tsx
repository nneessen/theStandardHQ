import { useState } from "react";
import { useImoProductionSummary } from "../../hooks/useImoProductionSummary";
import { formatCompactCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LeaderboardTimePeriod } from "@/types/leaderboard.types";

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
 * Expanded org-wide production detail: AP / IP / policies / prospects for the
 * selected period, from the deduplicated get_imo_production_summary RPC (readable
 * by any authenticated user in the IMO — unlike the admin-gated per-agency RPCs).
 */
export function ProductionDetail({ accent }: Props) {
  const [period, setPeriod] = useState<LeaderboardTimePeriod>("mtd");
  const { data, isLoading, isError } = useImoProductionSummary(period);

  const stats: { label: string; value: string }[] = [
    {
      label: "Annualized premium",
      value: formatCompactCurrency(data?.totalAp ?? 0),
    },
    {
      label: "Issued premium",
      value: formatCompactCurrency(data?.totalIp ?? 0),
    },
    { label: "Policies", value: String(data?.totalPolicies ?? 0) },
    { label: "Prospects", value: String(data?.totalProspects ?? 0) },
  ];

  return (
    <div className="space-y-3">
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
        Organization-wide, deduplicated. AP counts policies submitted in the
        period; IP counts approved policies that became effective in the period.
      </p>
    </div>
  );
}
