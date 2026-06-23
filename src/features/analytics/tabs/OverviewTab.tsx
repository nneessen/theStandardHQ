// src/features/analytics/tabs/OverviewTab.tsx
// "Am I on pace?" at a glance — the verdict band, team retention, and the
// headline policy trend. Deliberately sparse so the page opens scannable.

import { Suspense } from "react";
import { AnalyticsSectionGate } from "@/components/subscription";
import { BoardPersistency } from "@/features/dashboard";
import { useTeamPersistency } from "@/hooks/policies";
import { ROW_1 } from "./grid";
import { AnalyticsHero, TrendChartPanel, Cell, PanelSkeleton } from "./panels";

export function OverviewTab() {
  // Persistency is an all-book retention metric (not period-scoped), so it sits
  // outside the date-filtered panels. Team scope: own + downline (policies RLS).
  const { data: persistency } = useTeamPersistency();

  return (
    <>
      {/* Hero verdict band — am I on pace? */}
      <div style={{ marginBottom: 24 }}>
        <AnalyticsSectionGate section="pace_metrics">
          <Suspense fallback={<PanelSkeleton minHeight={260} />}>
            <AnalyticsHero />
          </Suspense>
        </AnalyticsSectionGate>
      </div>

      {/* Team persistency — own + downline retention at 3/6/9/12 months. Only
          render once at least one milestone has policies (the RPC always returns
          4 rows, so guard on real data, not array length). */}
      {persistency?.some((b) => b.issuedCount > 0) && (
        <div style={{ marginBottom: 24 }}>
          <BoardPersistency buckets={persistency} scope="team" />
        </div>
      )}

      {/* Headline policy trend */}
      <div className={ROW_1}>
        <Cell section="policy_status_breakdown" minHeight={360}>
          <TrendChartPanel />
        </Cell>
      </div>
    </>
  );
}
