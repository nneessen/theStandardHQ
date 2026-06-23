// src/features/analytics/tabs/panels.tsx
// Lazy board panels + the gated grid-cell wrappers, shared across the analytics
// tabs. Every export here is a component, so Fast Refresh is happy. The panels
// share one code-split chunk (all import the same ../board barrel), kept out of
// the initial app bundle so Recharts loads with the route rather than up front.

import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { Board, T } from "@/components/board";
import {
  useAnalyticsSectionAccess,
  useAiAccess,
  type AnalyticsSectionKey,
} from "@/hooks/subscription";

// ─── Production / commission panels ──────────────────────────────────────────
export const AnalyticsHero = lazy(() =>
  import("../board").then((m) => ({ default: m.AnalyticsHero })),
);
export const TrendChartPanel = lazy(() =>
  import("../board").then((m) => ({ default: m.TrendChartPanel })),
);
export const GrowthChartPanel = lazy(() =>
  import("../board").then((m) => ({ default: m.GrowthChartPanel })),
);
export const ActionFeedPanel = lazy(() =>
  import("../board").then((m) => ({ default: m.ActionFeedPanel })),
);
export const AgentTablePanel = lazy(() =>
  import("../board").then((m) => ({ default: m.AgentTablePanel })),
);
export const FunnelPanel = lazy(() =>
  import("../board").then((m) => ({ default: m.FunnelPanel })),
);
export const ClientSegmentsPanel = lazy(() =>
  import("../board").then((m) => ({ default: m.ClientSegmentsPanel })),
);
export const PipelinePanel = lazy(() =>
  import("../board").then((m) => ({ default: m.PipelinePanel })),
);
export const TrendComparisonPanel = lazy(() =>
  import("../board").then((m) => ({ default: m.TrendComparisonPanel })),
);
export const ProductMixPanel = lazy(() =>
  import("../board").then((m) => ({ default: m.ProductMixPanel })),
);
export const PremiumByStatePanel = lazy(() =>
  import("../board").then((m) => ({ default: m.PremiumByStatePanel })),
);
export const CarriersPanel = lazy(() =>
  import("../board").then((m) => ({ default: m.CarriersPanel })),
);

// ─── Inbound Calls panels (reuse the kpi call-analytics layer) ───────────────
export const InboundCallsOverviewPanel = lazy(() =>
  import("../board").then((m) => ({ default: m.InboundCallsOverviewPanel })),
);
export const CallTimingPanel = lazy(() =>
  import("../board").then((m) => ({ default: m.CallTimingPanel })),
);
export const CallLengthPanel = lazy(() =>
  import("../board").then((m) => ({ default: m.CallLengthPanel })),
);
export const CallDemographicsPanel = lazy(() =>
  import("../board").then((m) => ({ default: m.CallDemographicsPanel })),
);
export const CallGeographyPanel = lazy(() =>
  import("../board").then((m) => ({ default: m.CallGeographyPanel })),
);
export const CallAgentLeaderboardPanel = lazy(() =>
  import("../board").then((m) => ({ default: m.CallAgentLeaderboardPanel })),
);
export const WordTrackEffectivenessPanel = lazy(() =>
  import("../board").then((m) => ({ default: m.WordTrackEffectivenessPanel })),
);

/** A loading placeholder that holds a panel's footprint without layout shift. */
export function PanelSkeleton({ minHeight = 200 }: { minHeight?: number }) {
  return (
    <Board pad={26} style={{ height: "100%", minHeight }}>
      <div
        style={{
          height: 14,
          width: "40%",
          borderRadius: 4,
          background: T.tile,
          marginBottom: 16,
        }}
      />
      <div
        style={{
          height: 40,
          borderRadius: 6,
          background: T.tile,
          opacity: 0.6,
        }}
      />
    </Board>
  );
}

/**
 * One grid cell: subscription-gated → suspense → panel. Stretches to row height
 * and can span multiple columns. When the user lacks access (or while access
 * loads) the cell renders nothing — collapsing the grid track instead of leaving
 * an empty hole.
 */
export function Cell({
  section,
  span = 1,
  minHeight,
  children,
}: {
  section: AnalyticsSectionKey;
  span?: number;
  minHeight?: number;
  children: ReactNode;
}) {
  const { hasAccess, isLoading } = useAnalyticsSectionAccess(section);
  if (isLoading || !hasAccess) return null;
  return (
    <div
      className={span === 2 ? "min-w-0 h-full xl:col-span-2" : "min-w-0 h-full"}
    >
      <Suspense fallback={<PanelSkeleton minHeight={minHeight} />}>
        {children}
      </Suspense>
    </div>
  );
}

/**
 * AI-gated grid cell. Mirrors `Cell` but gates on the AI entitlement (team-free
 * via super-admin/free_all_features, or the ai_assistant add-on) instead of the
 * plan's analytics_sections — used for Predictive Analytics, which is no longer
 * a base-plan section.
 */
export function AiCell({
  span = 1,
  minHeight,
  children,
}: {
  span?: number;
  minHeight?: number;
  children: ReactNode;
}) {
  const { hasAiAccess, isLoading } = useAiAccess();
  if (isLoading || !hasAiAccess) return null;
  return (
    <div
      className={span === 2 ? "min-w-0 h-full xl:col-span-2" : "min-w-0 h-full"}
    >
      <Suspense fallback={<PanelSkeleton minHeight={minHeight} />}>
        {children}
      </Suspense>
    </div>
  );
}

/**
 * Ungated grid cell for always-visible sections (e.g. Inbound Calls). Mirrors
 * `Cell` (Suspense + min-width:0 + responsive span) but skips the subscription
 * section-access check.
 */
export function PlainCell({
  span = 1,
  minHeight,
  children,
}: {
  span?: number;
  minHeight?: number;
  children: ReactNode;
}) {
  return (
    <div
      className={span === 2 ? "min-w-0 h-full xl:col-span-2" : "min-w-0 h-full"}
    >
      <Suspense fallback={<PanelSkeleton minHeight={minHeight} />}>
        {children}
      </Suspense>
    </div>
  );
}
