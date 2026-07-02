// src/features/hierarchy/components/PaceHero.tsx
//
// Team Pace hero — the unmissable headline of the Team page. Two scope panels
// (This Month · This Year), each a pace ring + status verdict + the underlying
// Target / Actual / Projected figures. Wired entirely to real HierarchyStats.
//
// SCOPE: pace is CALENDAR-FIXED (team_fixed_monthly_ap = this month to date,
// team_ytd_ap_total = this year to date). It deliberately ignores the page's
// timeframe selector — the "THIS MONTH" / "CALENDAR YTD" labels make that clear.
//
// The ring fills toward the pace ratio (actual ÷ expected-by-now, clamped to
// 100%); the centre shows the true pace % (which can exceed 100 when ahead) plus
// the ahead/on-pace/behind verdict. RingProgress is used (not board
// RadialProgress, which self-clamps its centred % to 100 and could never show an
// "ahead" team). Ring stroke color comes from useChartColors() — concrete hexes,
// because CSS var() does not resolve in SVG presentation attributes.

import { AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Board, Cap, Num, Pill, T } from "@/components/board";
import {
  useChartColors,
  type ChartColors,
} from "@/components/board/useChartColors";
import { RingProgress } from "@/components/v2";
import { formatCurrency } from "@/lib/format";
import type { HierarchyStats } from "@/types/hierarchy.types";

type PaceStatus = "ahead" | "on_pace" | "behind";

const STATUS_WORD: Record<PaceStatus, string> = {
  ahead: "↑ Ahead",
  on_pace: "→ On Pace",
  behind: "↓ Behind",
};

const STATUS_PILL_TONE: Record<PaceStatus, "green" | "blue" | "red"> = {
  ahead: "green",
  on_pace: "blue",
  behind: "red",
};

// Shared blue-spotlight surface (matches the page's former hero band).
const HERO_STYLE: React.CSSProperties = {
  background: `radial-gradient(130% 180% at 0% 0%, rgba(91,155,255,0.12), rgba(91,155,255,0.01)), ${T.panelGradient}`,
  border: "1px solid rgba(91,155,255,0.28)",
};

interface PaceScope {
  label: string; // eyebrow, e.g. "MONTHLY PACE · THIS MONTH"
  actualLabel: string; // "MTD" | "YTD"
  goalNoun: string; // "monthly" | "yearly"
  target: number;
  actual: number; // team_fixed_monthly_ap | team_ytd_ap_total
  projected: number;
  pacePct: number; // actual ÷ expected-by-now × 100 (can exceed 100)
  status: PaceStatus;
}

interface PaceHeroProps {
  stats: HierarchyStats | null | undefined;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function statusColor(status: PaceStatus, colors: ChartColors): string {
  if (status === "ahead") return colors.green;
  if (status === "behind") return colors.red;
  return colors.blue;
}

function PaceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span style={{ font: `500 12px ${T.data}`, color: T.mut }}>{label}</span>
      <span
        style={{
          font: `600 13px ${T.data}`,
          color: T.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function PaceScopePanel({
  scope,
  colors,
}: {
  scope: PaceScope;
  colors: ChartColors;
}) {
  const hasTarget = scope.target > 0;
  const ringFill = hasTarget ? Math.min(scope.pacePct / 100, 1) : 0;
  const goalPct =
    hasTarget && scope.target > 0
      ? Math.round((scope.actual / scope.target) * 100)
      : 0;
  const color = statusColor(scope.status, colors);

  return (
    <div className="flex flex-col gap-3">
      <Cap>{scope.label}</Cap>

      {hasTarget ? (
        <div className="flex flex-wrap items-center gap-5">
          {/* Pace ring — fills toward the run-rate, centre shows true pace % */}
          <RingProgress
            value={ringFill}
            size={128}
            thickness={12}
            fillColor={color}
            trackColor={colors.grid}
            centerLabel={
              <div className="flex flex-col items-center gap-0.5">
                <Num text={`${scope.pacePct.toFixed(0)}%`} size="lg" />
                <span
                  style={{
                    font: `700 9px ${T.mono}`,
                    letterSpacing: "0.16em",
                    color: T.mut,
                    textTransform: "uppercase",
                  }}
                >
                  Pace
                </span>
              </div>
            }
          />

          {/* Verdict + underlying figures */}
          <div className="flex min-w-[180px] flex-1 flex-col gap-2">
            <div>
              <Pill tone={STATUS_PILL_TONE[scope.status]} dot>
                {STATUS_WORD[scope.status]}
              </Pill>
            </div>
            <div className="flex flex-col gap-1">
              <PaceRow label="Target" value={formatCurrency(scope.target)} />
              <PaceRow
                label={scope.actualLabel}
                value={formatCurrency(scope.actual)}
              />
              <PaceRow
                label="Projected"
                value={formatCurrency(scope.projected)}
              />
            </div>
            <span style={{ font: `500 11px ${T.data}`, color: T.mut }}>
              {goalPct}% of {scope.goalNoun} goal so far
            </span>
          </div>
        </div>
      ) : (
        // No target set for this scope → show raw production + a path to set goals.
        <div className="flex flex-col gap-1.5">
          <Num text={formatCurrency(scope.actual)} size="lg" lit />
          <span style={{ font: `500 12px ${T.data}`, color: T.mut }}>
            {scope.actualLabel} submitted · no target set
          </span>
          <Link
            to="/targets"
            className="text-[12px] font-semibold text-v2-accent hover:underline"
          >
            Set production goals →
          </Link>
        </div>
      )}
    </div>
  );
}

export function PaceHero({
  stats,
  isLoading,
  isError,
  onRetry,
}: PaceHeroProps) {
  const colors = useChartColors();

  if (isError) {
    return (
      <Board pad={20} rivets style={HERO_STYLE}>
        <div className="flex items-center justify-center gap-2 py-6 text-[13px] text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Failed to load team pace.</span>
          {onRetry && (
            <button onClick={() => onRetry()} className="underline">
              Retry
            </button>
          )}
        </div>
      </Board>
    );
  }

  if (isLoading) {
    return (
      <Board pad={20} rivets style={HERO_STYLE}>
        <div className="py-10 text-center text-[13px] text-v2-ink-muted">
          Loading team pace…
        </div>
      </Board>
    );
  }

  const monthly: PaceScope = {
    label: "MONTHLY PACE · THIS MONTH",
    actualLabel: "MTD",
    goalNoun: "monthly",
    target: stats?.team_monthly_ap_target ?? 0,
    actual: stats?.team_fixed_monthly_ap ?? 0,
    projected: stats?.team_monthly_projected ?? 0,
    pacePct: stats?.team_monthly_pace_percentage ?? 0,
    status: stats?.team_monthly_pace_status ?? "on_pace",
  };

  const yearly: PaceScope = {
    label: "YEARLY PACE · CALENDAR YTD",
    actualLabel: "YTD",
    goalNoun: "yearly",
    target: stats?.team_yearly_ap_target ?? 0,
    actual: stats?.team_ytd_ap_total ?? 0,
    projected: stats?.team_yearly_projected ?? 0,
    pacePct: stats?.team_yearly_pace_percentage ?? 0,
    status: stats?.team_yearly_pace_status ?? "on_pace",
  };

  return (
    <Board pad={20} rivets style={HERO_STYLE}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Cap>Team Pace</Cap>
          <span style={{ font: `500 11px ${T.data}`, color: T.mut }}>
            Calendar month &amp; year to date · independent of the timeframe
            below
          </span>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PaceScopePanel scope={monthly} colors={colors} />
          <PaceScopePanel scope={yearly} colors={colors} />
        </div>
      </div>
    </Board>
  );
}
