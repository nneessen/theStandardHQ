// src/features/analytics/tabs/OverviewTab.tsx
// "Am I on pace?" at a glance — the verdict band, your own retention, and the
// headline policy trend. Deliberately sparse so the page opens scannable.

import { Suspense } from "react";
import { AnalyticsSectionGate } from "@/components/subscription";
import { BoardPersistency } from "@/features/dashboard";
import { usePersistency } from "@/hooks/policies";
import { ROW_1 } from "./grid";
import { AnalyticsHero, TrendChartPanel, Cell, PanelSkeleton } from "./panels";

export function OverviewTab() {
  // Overview is the INDIVIDUAL agent's view, so persistency here is the user's
  // OWN book (not the team). It's an all-book retention metric, not period-scoped,
  // so it sits outside the date-filtered panels. Team persistency lives on the
  // Team tab.
  const { data: persistency } = usePersistency();

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

      {/* Your persistency — own-book retention at 3/6/9/12 months. Only render
          once at least one milestone has policies (the RPC always returns 4 rows,
          so guard on real data, not array length). */}
      {persistency?.some((b) => b.issuedCount > 0) && (
        <div style={{ marginBottom: 24 }}>
          <BoardPersistency buckets={persistency} scope="me" />
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
