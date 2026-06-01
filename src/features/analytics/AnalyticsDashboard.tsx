// src/features/analytics/AnalyticsDashboard.tsx
//
// Analytics — "The Board" verdict-first redesign. Leads with the pace verdict
// (am I on pace?), then the supporting trend/action/detail panels. Re-skins the
// page into the shipped Board design system (charcoal surfaces, board
// primitives) used by the Dashboard; reuses every existing analytics
// hook/service for real data. Panels are lazy so Recharts stays out of the main
// bundle, and each is wrapped in its subscription gate.

import { lazy, Suspense } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  BarChart3,
  Sparkles,
  CheckCircle2,
  FileDown,
  FileText,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { NEW_SUBSCRIPTIONS_ENABLED } from "@/lib/subscription/subscription-availability";
import { TimePeriodSelector } from "./components/TimePeriodSelector";
import { PillButton, SectionShell, SoftCard } from "@/components/v2";
import { Board, Cap, T } from "@/components/board";
import { downloadCSV, printAnalyticsToPDF } from "../../utils/exportHelpers";
import {
  AnalyticsDateProvider,
  useAnalyticsDateRange,
} from "./context/AnalyticsDateContext";
import { useAnalyticsData } from "@/hooks";
import { AnalyticsSectionGate } from "@/components/subscription";
import { ChunkErrorBoundary } from "@/components/shared/ChunkErrorBoundary";
import {
  useAccessibleAnalyticsSections,
  useAnalyticsSectionAccess,
  ANALYTICS_SECTION_NAMES,
  type AnalyticsSectionKey,
} from "@/hooks/subscription";

// Lazy board panels — they share one code-split chunk (all import the same
// ./board barrel), kept out of the initial app bundle so Recharts loads with
// the route rather than up front.
const AnalyticsHero = lazy(() =>
  import("./board").then((m) => ({ default: m.AnalyticsHero })),
);
const TrendChartPanel = lazy(() =>
  import("./board").then((m) => ({ default: m.TrendChartPanel })),
);
const GrowthChartPanel = lazy(() =>
  import("./board").then((m) => ({ default: m.GrowthChartPanel })),
);
const ActionFeedPanel = lazy(() =>
  import("./board").then((m) => ({ default: m.ActionFeedPanel })),
);
const AgentTablePanel = lazy(() =>
  import("./board").then((m) => ({ default: m.AgentTablePanel })),
);
const FunnelPanel = lazy(() =>
  import("./board").then((m) => ({ default: m.FunnelPanel })),
);
const ClientSegmentsPanel = lazy(() =>
  import("./board").then((m) => ({ default: m.ClientSegmentsPanel })),
);
const PipelinePanel = lazy(() =>
  import("./board").then((m) => ({ default: m.PipelinePanel })),
);
const TrendComparisonPanel = lazy(() =>
  import("./board").then((m) => ({ default: m.TrendComparisonPanel })),
);
const ProductMixPanel = lazy(() =>
  import("./board").then((m) => ({ default: m.ProductMixPanel })),
);
const PremiumByStatePanel = lazy(() =>
  import("./board").then((m) => ({ default: m.PremiumByStatePanel })),
);
const CarriersPanel = lazy(() =>
  import("./board").then((m) => ({ default: m.CarriersPanel })),
);

/** A loading placeholder that holds a panel's footprint without layout shift. */
function PanelSkeleton({ minHeight = 200 }: { minHeight?: number }) {
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
 * (`align-items: stretch` on the parent grid + `height:100%` here) and can span
 * multiple columns. When the user lacks access (or while access loads) the cell
 * renders nothing — collapsing the grid track instead of leaving an empty hole.
 */
function Cell({
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
    <div style={{ gridColumn: `span ${span}`, minWidth: 0, height: "100%" }}>
      <Suspense fallback={<PanelSkeleton minHeight={minHeight} />}>
        {children}
      </Suspense>
    </div>
  );
}

const rowStyle = (cols: number): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  gap: 16,
  alignItems: "stretch",
  marginBottom: 16,
});

function AnalyticsDashboardContent() {
  const { timePeriod, setTimePeriod, customRange, setCustomRange, dateRange } =
    useAnalyticsDateRange();

  const analyticsData = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  const {
    accessibleSections,
    lockedSections,
    isLoading: sectionsLoading,
  } = useAccessibleAnalyticsSections();

  const handleExportCSV = () => {
    if (analyticsData.raw.policies.length > 0) {
      downloadCSV(
        analyticsData.raw.policies.map((p) => ({
          policyNumber: p.policyNumber,
          product: p.product,
          status: p.status,
          annualPremium: p.annualPremium,
          effectiveDate: p.effectiveDate,
        })),
        "analytics_policies",
      );
    }
  };

  const handlePrintPDF = () => {
    printAnalyticsToPDF("Analytics Report", [
      {
        title: "Overview",
        content: `<p>Analytics report for ${timePeriod} period</p>`,
      },
      {
        title: "Data Summary",
        content: `
          <div class="metric">
            <div class="metric-label">Total Policies</div>
            <div class="metric-value">${analyticsData.raw.policies.length}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Total Commissions</div>
            <div class="metric-value">${analyticsData.raw.commissions.length}</div>
          </div>
        `,
      },
    ]);
  };

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[1820px] px-4 py-5 sm:px-8 lg:px-12 lg:py-8">
        {/* Header — eyebrow + ANALYTICS + subtitle | period control + export */}
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Cap
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                letterSpacing: "0.22em",
              }}
            >
              <BarChart3 size={13} />
              Performance
            </Cap>
            <h1
              style={{
                font: `800 clamp(38px, 5vw, 60px) ${T.disp}`,
                lineHeight: 0.95,
                letterSpacing: "-0.01em",
                textTransform: "uppercase",
                color: T.ink,
                margin: 0,
              }}
            >
              Analytics
            </h1>
            <p style={{ font: `500 14px ${T.data}`, color: T.mut, margin: 0 }}>
              Performance metrics and insights across your book.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <TimePeriodSelector
              selectedPeriod={timePeriod}
              onPeriodChange={setTimePeriod}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />
            <div className="hidden flex-shrink-0 gap-2 sm:flex">
              <PillButton
                onClick={handleExportCSV}
                tone="ghost"
                size="sm"
                title="Export data to CSV"
              >
                <FileDown className="h-3.5 w-3.5" />
                CSV
              </PillButton>
              <PillButton
                onClick={handlePrintPDF}
                tone="ghost"
                size="sm"
                title="Print report to PDF"
              >
                <FileText className="h-3.5 w-3.5" />
                PDF
              </PillButton>
            </div>
          </div>
        </header>

        {sectionsLoading ? (
          <PanelSkeleton minHeight={260} />
        ) : (
          <>
            {/* Hero verdict band — am I on pace? */}
            <div style={{ marginBottom: 16 }}>
              <AnalyticsSectionGate section="pace_metrics">
                <Suspense fallback={<PanelSkeleton minHeight={260} />}>
                  <AnalyticsHero />
                </Suspense>
              </AnalyticsSectionGate>
            </div>

            {/* Trend | Growth */}
            <div style={rowStyle(2)}>
              <Cell section="policy_status_breakdown" minHeight={360}>
                <TrendChartPanel />
              </Cell>
              <Cell section="predictive_analytics" minHeight={360}>
                <GrowthChartPanel />
              </Cell>
            </div>

            {/* Action feed | Agent table (2-wide) */}
            <div style={rowStyle(3)}>
              <Cell section="game_plan" minHeight={420}>
                <ActionFeedPanel />
              </Cell>
              <Cell section="agent_performance" span={2} minHeight={420}>
                <AgentTablePanel />
              </Cell>
            </div>

            {/* Funnel | Segments | Pipeline */}
            <div style={rowStyle(3)}>
              <Cell section="conversion_funnel" minHeight={300}>
                <FunnelPanel />
              </Cell>
              <Cell section="client_segmentation" minHeight={300}>
                <ClientSegmentsPanel />
              </Cell>
              <Cell section="commission_pipeline" minHeight={300}>
                <PipelinePanel />
              </Cell>
            </div>

            {/* Trend comparison (2-wide) | stack(Product mix + Premium by state) */}
            <div style={rowStyle(3)}>
              <Cell section="trend_comparison" span={2} minHeight={340}>
                <TrendComparisonPanel />
              </Cell>
              <div
                style={{
                  display: "grid",
                  gap: 16,
                  alignContent: "start",
                  minWidth: 0,
                }}
              >
                <AnalyticsSectionGate section="product_matrix">
                  <Suspense fallback={<PanelSkeleton minHeight={160} />}>
                    <ProductMixPanel />
                  </Suspense>
                </AnalyticsSectionGate>
                <AnalyticsSectionGate section="geographic">
                  <Suspense fallback={<PanelSkeleton minHeight={160} />}>
                    <PremiumByStatePanel />
                  </Suspense>
                </AnalyticsSectionGate>
              </div>
            </div>

            {/* Carriers (full width) */}
            <div style={rowStyle(1)}>
              <Cell section="carriers_products" minHeight={240}>
                <CarriersPanel />
              </Cell>
            </div>

            {/* Upgrade banner — only when sections are locked */}
            {lockedSections.length > 0 && (
              <SoftCard variant="tinted" padding="lg" className="mt-1">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="bg-v2-accent text-v2-ink inline-flex h-7 w-7 items-center justify-center rounded-v2-pill">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-v2-ink text-base font-semibold tracking-tight">
                        Unlock more analytics
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-8 gap-y-3">
                      {accessibleSections.length > 0 && (
                        <div>
                          <span className="text-v2-ink-subtle text-[10px] font-semibold uppercase tracking-[0.18em]">
                            Your plan includes
                          </span>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {accessibleSections.map((section) => (
                              <span
                                key={section}
                                className="bg-success/20 dark:bg-success/40 text-success inline-flex items-center gap-1 rounded-v2-pill px-2.5 py-1 text-[11px]"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                {ANALYTICS_SECTION_NAMES[section]}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <span className="text-v2-ink-subtle text-[10px] font-semibold uppercase tracking-[0.18em]">
                          {NEW_SUBSCRIPTIONS_ENABLED
                            ? "Upgrade to unlock"
                            : "Not included in your plan"}
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {lockedSections.map((section) => (
                            <span
                              key={section}
                              className="bg-v2-card border-v2-ring text-v2-ink-muted inline-flex items-center rounded-v2-pill border px-2.5 py-1 text-[11px]"
                            >
                              {ANALYTICS_SECTION_NAMES[section]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  {NEW_SUBSCRIPTIONS_ENABLED && (
                    <Link to="/billing" className="flex-shrink-0">
                      <PillButton tone="black" size="md">
                        <Sparkles className="h-3.5 w-3.5" />
                        Upgrade plan
                      </PillButton>
                    </Link>
                  )}
                </div>
              </SoftCard>
            )}

            {/* Footer note */}
            <div
              style={{
                marginTop: 16,
                textAlign: "center",
                font: `700 11px ${T.mono}`,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: T.mut2,
              }}
            >
              Real-time calculations · Auto-refresh on data changes
            </div>
          </>
        )}
      </div>
    </SectionShell>
  );
}

export function AnalyticsDashboard() {
  return (
    <AnalyticsDateProvider>
      <ChunkErrorBoundary context="analytics dashboard">
        <AnalyticsDashboardContent />
      </ChunkErrorBoundary>
    </AnalyticsDateProvider>
  );
}
