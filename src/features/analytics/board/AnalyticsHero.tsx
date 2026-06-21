// src/features/analytics/board/AnalyticsHero.tsx
//
// Hero Verdict Band — full-width "Monthly Performance" panel for the Analytics
// redesign. Wired entirely to real data; no hardcoded sample numbers.
//
// Layout (see docs/design/board-page-template.md + the handoff Hero Verdict
// Band spec):
//   Board (blue spotlight overlay) → flex row (wraps narrow):
//     1. RadialProgress — pct of monthly goal
//     2. Verdict block — projected AP + pace sentence
//     3. Stats — 2×2 FlapTile grid
//
// Basis: always the CURRENT MONTH (written, projected, and goal all monthly), so
// the verdict reads consistently regardless of the page's period selector. Goal
// source: dashboardAvgAP * realisticMonthlyAppsToWrite (monthly AP target),
// mirroring DashboardHome.

import {
  Board,
  Cap,
  AnimatedNumber,
  FlapTile,
  Pill,
  RadialProgress,
  T,
} from "@/components/board";
import { useAnalyticsData, useTargets, useCalculatedTargets } from "@/hooks";
// Relative import: useHistoricalAverages is not in the targets barrel index.
import { useHistoricalAverages } from "../../../hooks/targets/useHistoricalAverages";
import { formatCurrency, formatCompactCurrency } from "@/lib/format";
import { resolveGoalAvgAP } from "@/lib/goal";

// ─────────────────────────────────────────────────────────────────────────────
// Skeletons
// ─────────────────────────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <Board
      pad={26}
      rivets
      style={{
        background: `radial-gradient(130% 180% at 0% 0%, rgba(91,155,255,0.12), rgba(91,155,255,0.01)), ${T.panelGradient}`,
        border: "1px solid rgba(91,155,255,0.28)",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 180,
      }}
    >
      <span style={{ font: `500 13px ${T.data}`, color: T.mut }}>Loading…</span>
    </Board>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function AnalyticsHero() {
  // The verdict band always reflects the CURRENT MONTH's pace — per the
  // "MONTHLY PERFORMANCE · <month>" / "OF MONTHLY GOAL" framing. It is deliberately
  // independent of the page's period selector (which drives the other panels),
  // so the written/projected/goal numbers always share a single monthly basis.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // — Data hooks —
  const { raw, isLoading: analyticsLoading } = useAnalyticsData({
    startDate: monthStart,
    endDate: monthEnd,
  });
  const { data: targets } = useTargets();
  const { calculated: calculatedTargets, isLoading: targetsLoading } =
    useCalculatedTargets();
  const { averages: historicalAverages, isLoading: averagesLoading } =
    useHistoricalAverages();

  const isLoading = analyticsLoading || targetsLoading || averagesLoading;

  if (isLoading) return <HeroSkeleton />;

  // — Premium written (AP sum for period) —
  const premiumWritten = raw.policies.reduce(
    (sum, p) => sum + (p.annualPremium ?? 0),
    0,
  );

  // — Day counters (calendar month) —
  const daysTotal = monthEnd.getDate();
  const daysElapsed = Math.min(now.getDate(), daysTotal);
  const daysLeft = Math.max(0, daysTotal - daysElapsed);

  // — Projected AP —
  const projectedAP =
    daysElapsed > 0 ? (premiumWritten / daysElapsed) * daysTotal : 0;

  // — Monthly AP goal —
  // Single, stable average premium (shared with DashboardHome via
  // resolveGoalAvgAP) rather than the old aspirational MAX-of-5 that biased the
  // goal high.
  const avgAP = resolveGoalAvgAP(
    targets?.avgPremiumOverride ?? undefined,
    historicalAverages,
  );
  const policyTarget =
    calculatedTargets && calculatedTargets.realisticMonthlyAppsToWrite > 0
      ? calculatedTargets.realisticMonthlyAppsToWrite
      : 0;
  const goal = avgAP > 0 && policyTarget > 0 ? avgAP * policyTarget : 0;

  // — Derived pace metrics —
  const noGoal = goal <= 0;
  const pctMonth = noGoal ? 0 : Math.min(premiumWritten / goal, 1);
  const pctProjected = noGoal ? 0 : projectedAP / goal;
  // Actual remaining requirement — drives the stat tiles.
  const gap = noGoal ? 0 : Math.max(0, goal - premiumWritten);
  const needDay = !noGoal && daysLeft > 0 ? gap / daysLeft : 0;
  const isBehind = !noGoal && gap > 0;
  // Projected month-end pace — drives the ring + verdict: at the current daily
  // rate, are we on track to CLEAR the goal by close?
  const projectedShort = noGoal ? 0 : Math.max(0, goal - projectedAP);
  const willMiss = !noGoal && projectedShort > 0;

  // Display strings
  const pctProjectedRounded = Math.round(pctProjected * 100);
  const ringTone =
    pctProjected >= 1 ? "green" : pctProjected >= 0.8 ? "blue" : "amber";

  // Month label for eyebrow, e.g. "JUNE 2026"
  const monthLabel = now
    .toLocaleDateString("en-US", { month: "long", year: "numeric" })
    .toUpperCase();

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Board
      pad={26}
      rivets
      style={{
        background: `radial-gradient(130% 180% at 0% 0%, rgba(91,155,255,0.12), rgba(91,155,255,0.01)), ${T.panelGradient}`,
        border: "1px solid rgba(91,155,255,0.28)",
        height: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 40,
          alignItems: "center",
        }}
      >
        {/* ── 1. Radial ring ── */}
        <div style={{ flexShrink: 0 }}>
          <RadialProgress
            pct={pctMonth}
            size={208}
            thickness={18}
            tone={ringTone}
            caption="OF MONTHLY GOAL"
          />
        </div>

        {/* ── 2. Verdict block ── */}
        <div style={{ flex: "1 1 280px", minWidth: 300 }}>
          <Cap style={{ marginBottom: 10 }}>
            DEPARTURE STATUS · {monthLabel}
          </Cap>

          {/* Huge lit projected AP */}
          <AnimatedNumber
            value={projectedAP}
            prefix="$"
            size="xl"
            lit
            style={{ display: "block", marginBottom: 8 }}
          />

          {/* Projected pill — only show % when goal exists */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <Pill tone="amber" dot>
              {noGoal ? "PROJECTED" : `PROJECTED · ${pctProjectedRounded}%`}
            </Pill>
          </div>

          <div
            style={{
              font: `500 13px ${T.data}`,
              color: T.mut,
              marginBottom: 10,
            }}
          >
            Projected AP at current pace
          </div>

          {/* Pace verdict sentence */}
          {noGoal ? (
            <p
              style={{
                font: `500 14px ${T.data}`,
                color: T.mut,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Set a monthly target to pace against — push to get started.
            </p>
          ) : willMiss ? (
            <p
              style={{
                font: `500 14px ${T.data}`,
                color: T.mut,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Behind the board&apos;s pace —{" "}
              <b style={{ color: T.red }}>
                {formatCurrency(projectedShort)} short
              </b>{" "}
              of the{" "}
              <b style={{ color: T.cream }}>{formatCompactCurrency(goal)}</b>{" "}
              target at close. <b style={{ color: T.cream }}>{daysLeft} days</b>{" "}
              left to make it up.
            </p>
          ) : (
            <p
              style={{
                font: `500 14px ${T.data}`,
                color: T.mut,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              On track to clear the{" "}
              <b style={{ color: T.cream }}>{formatCompactCurrency(goal)}</b>{" "}
              target — projected{" "}
              <b style={{ color: T.green }}>
                {formatCompactCurrency(projectedAP)}
              </b>{" "}
              at close. <b style={{ color: T.cream }}>{daysLeft} days</b>{" "}
              remaining.
            </p>
          )}
        </div>

        {/* ── 3. Stats grid ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            // Fluid: grow/shrink and wrap below the verdict on narrow screens
            // instead of forcing a hard 340px width that overflows the card.
            flex: "1 1 330px",
            maxWidth: 340,
            minWidth: 330,
          }}
        >
          {/* MTD Written — always real */}
          <FlapTile
            label="MTD Written"
            value={formatCurrency(premiumWritten)}
            tone="default"
          />

          {/* Monthly Goal — muted when no goal */}
          {noGoal ? (
            <FlapTile
              label="Monthly Goal"
              value="No goal set"
              tone="default"
              style={{ opacity: 0.45 }}
            />
          ) : (
            <FlapTile
              label="Monthly Goal"
              value={formatCurrency(goal)}
              tone="default"
            />
          )}

          {/* Gap to Goal — only meaningful when goal exists */}
          {noGoal ? (
            <FlapTile
              label="Gap to Goal"
              value="—"
              tone="default"
              style={{ opacity: 0.45 }}
            />
          ) : (
            <FlapTile
              label="Gap to Goal"
              value={isBehind ? formatCurrency(gap) : "$0"}
              tone={isBehind ? "red" : "green"}
            />
          )}

          {/* Need / Day — only meaningful when goal exists and days remain */}
          {noGoal ? (
            <FlapTile
              label="Need / Day"
              value="—"
              tone="default"
              style={{ opacity: 0.45 }}
            />
          ) : (
            <FlapTile
              label="Need / Day"
              value={isBehind && daysLeft > 0 ? formatCurrency(needDay) : "$0"}
              tone={isBehind && daysLeft > 0 ? "blue" : "default"}
            />
          )}
        </div>
      </div>
    </Board>
  );
}
