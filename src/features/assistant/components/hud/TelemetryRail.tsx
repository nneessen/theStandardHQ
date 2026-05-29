import { BarChart3, FileCheck2, Flame, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTeamLeaderboard } from "@/hooks/leaderboard";
import { useLeadHeatScoreCount } from "@/features/close-kpi";
import { useRecruitingStats } from "@/hooks/recruiting";
import { useCountUp } from "@/features/landing";

interface Props {
  accent: string;
}

function compactCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

/**
 * Live business telemetry framing the command center — real numbers from existing
 * hooks (team production MTD, leads scored, recruiting pipeline), animated as they
 * power up. Desktop-only; the parent hides it under lg. Reuses each hook's own
 * stale time, so it adds no new polling.
 */
export function TelemetryRail({ accent }: Props) {
  const team = useTeamLeaderboard({
    filters: { timePeriod: "mtd", scope: "team" },
  });
  const heatCount = useLeadHeatScoreCount();
  const recruiting = useRecruitingStats();

  const totals = team.data?.totals;

  return (
    <div className="flex flex-col gap-3">
      <Tile
        icon={BarChart3}
        accent={accent}
        label="Team AP · MTD"
        value={totals?.totalAp ?? 0}
        format={compactCurrency}
        loading={team.isLoading}
      />
      <Tile
        icon={FileCheck2}
        accent={accent}
        label="Policies · MTD"
        value={totals?.totalPolicies ?? 0}
        loading={team.isLoading}
      />
      <Tile
        icon={Flame}
        accent={accent}
        label="Leads scored"
        value={heatCount.data ?? 0}
        loading={heatCount.isLoading}
      />
      <Tile
        icon={UserPlus}
        accent={accent}
        label="Active recruits"
        value={recruiting.data?.active ?? 0}
        loading={recruiting.isLoading}
      />
    </div>
  );
}

function Tile({
  icon: Icon,
  accent,
  label,
  value,
  format,
  loading,
}: {
  icon: LucideIcon;
  accent: string;
  label: string;
  value: number;
  format?: (n: number) => string;
  loading: boolean;
}) {
  const { value: animated } = useCountUp(value, { duration: 1600 });
  const display = format
    ? format(animated)
    : Math.round(animated).toLocaleString();

  return (
    <div
      className="relative w-40 overflow-hidden rounded-lg border bg-card/40 px-3 py-2 backdrop-blur-sm"
      style={{ borderColor: `${accent}33` }}
    >
      <div
        className="absolute inset-y-0 left-0 w-0.5"
        style={{ background: accent }}
      />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" style={{ color: accent }} />
        {label}
      </div>
      <div
        className="mt-0.5 font-mono text-lg font-semibold tabular-nums"
        style={{ color: accent }}
      >
        {loading ? (
          <span className="inline-block h-5 w-16 animate-pulse rounded bg-muted/50" />
        ) : (
          display
        )}
      </div>
    </div>
  );
}
