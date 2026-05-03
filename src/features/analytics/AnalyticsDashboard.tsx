// src/features/analytics/AnalyticsDashboard.tsx

import { lazy, Suspense } from "react";
import {
  BarChart3,
  Sparkles,
  CheckCircle2,
  FileDown,
  FileText,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { TimePeriodSelector } from "./components/TimePeriodSelector";
import { PillButton, SoftCard } from "@/components/v2";
import { useAnalyticsData } from "@/hooks";
import { downloadCSV, printAnalyticsToPDF } from "../../utils/exportHelpers";
import {
  AnalyticsDateProvider,
  useAnalyticsDateRange,
} from "./context/AnalyticsDateContext";
import { AnalyticsSectionGate } from "@/components/subscription";
import { ChunkErrorBoundary } from "@/components/shared/ChunkErrorBoundary";
import {
  useAccessibleAnalyticsSections,
  ANALYTICS_SECTION_NAMES,
} from "@/hooks/subscription";

// Lazy load analytics components for better performance
const PaceMetrics = lazy(() =>
  import("./components").then((m) => ({ default: m.PaceMetrics })),
);
const PolicyStatusBreakdown = lazy(() =>
  import("./components").then((m) => ({ default: m.PolicyStatusBreakdown })),
);
const ClientSegmentation = lazy(() =>
  import("./components").then((m) => ({ default: m.ClientSegmentation })),
);
const ProductMatrix = lazy(() =>
  import("./components").then((m) => ({ default: m.ProductMatrix })),
);
const CarriersProductsBreakdown = lazy(() =>
  import("./components").then((m) => ({
    default: m.CarriersProductsBreakdown,
  })),
);
const GeographicAnalysis = lazy(() =>
  import("./components").then((m) => ({ default: m.GeographicAnalysis })),
);
const GamePlan = lazy(() =>
  import("./components").then((m) => ({ default: m.GamePlan })),
);
const CommissionPipeline = lazy(() =>
  import("./components/CommissionPipeline").then((m) => ({
    default: m.CommissionPipeline,
  })),
);
const PredictiveAnalytics = lazy(() =>
  import("./components").then((m) => ({ default: m.PredictiveAnalytics })),
);
const AgentPerformance = lazy(() =>
  import("./components").then((m) => ({ default: m.AgentPerformance })),
);
const TrendComparison = lazy(() =>
  import("./components").then((m) => ({ default: m.TrendComparison })),
);
const ConversionFunnel = lazy(() =>
  import("./components").then((m) => ({ default: m.ConversionFunnel })),
);

function AnalyticsDashboardContent() {
  const { timePeriod, setTimePeriod, customRange, setCustomRange, dateRange } =
    useAnalyticsDateRange();

  const analyticsData = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  // Get accessible/locked sections for upgrade banner
  const {
    accessibleSections,
    lockedSections,
    isLoading: sectionsLoading,
  } = useAccessibleAnalyticsSections();

  // React 19.1 optimizes automatically - no need for useCallback
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

  // React 19.1 optimizes automatically - no need for useCallback
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
    <div className="flex flex-col gap-5">
      {/* Hero band — large display heading + period + export pills */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-v2-ink-subtle">
            <BarChart3 className="h-3.5 w-3.5" />
            Performance
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-v2-ink leading-tight">
            Analytics
          </h1>
          <p className="text-sm text-v2-ink-muted">
            Performance metrics and insights across your book.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <TimePeriodSelector
            selectedPeriod={timePeriod}
            onPeriodChange={setTimePeriod}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
          />
          <div className="hidden sm:flex gap-2 flex-shrink-0">
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

      {/* Main Content */}
      <div className="flex-1">
        {/* Loading State */}
        {analyticsData.isLoading || sectionsLoading ? (
          <SoftCard
            padding="lg"
            className="text-center text-sm text-v2-ink-muted"
          >
            Loading analytics…
          </SoftCard>
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3 max-w-[1920px] mx-auto w-full">
              {/* Sections are rendered based on plan access - hidden if no access */}
              <AnalyticsSectionGate section="pace_metrics">
                <Suspense fallback={null}>
                  <PaceMetrics />
                </Suspense>
              </AnalyticsSectionGate>

              <AnalyticsSectionGate section="carriers_products">
                <Suspense fallback={null}>
                  <CarriersProductsBreakdown />
                </Suspense>
              </AnalyticsSectionGate>

              <AnalyticsSectionGate section="product_matrix">
                <Suspense fallback={null}>
                  <ProductMatrix />
                </Suspense>
              </AnalyticsSectionGate>

              <AnalyticsSectionGate section="policy_status_breakdown">
                <Suspense fallback={null}>
                  <PolicyStatusBreakdown />
                </Suspense>
              </AnalyticsSectionGate>

              <AnalyticsSectionGate section="geographic">
                <Suspense fallback={null}>
                  <GeographicAnalysis />
                </Suspense>
              </AnalyticsSectionGate>

              <AnalyticsSectionGate section="client_segmentation">
                <Suspense fallback={null}>
                  <ClientSegmentation />
                </Suspense>
              </AnalyticsSectionGate>

              <AnalyticsSectionGate section="game_plan">
                <Suspense fallback={null}>
                  <GamePlan />
                </Suspense>
              </AnalyticsSectionGate>

              <AnalyticsSectionGate section="commission_pipeline">
                <Suspense fallback={null}>
                  <CommissionPipeline />
                </Suspense>
              </AnalyticsSectionGate>

              <AnalyticsSectionGate section="predictive_analytics">
                <Suspense fallback={null}>
                  <PredictiveAnalytics />
                </Suspense>
              </AnalyticsSectionGate>

              <AnalyticsSectionGate section="trend_comparison">
                <Suspense fallback={null}>
                  <TrendComparison />
                </Suspense>
              </AnalyticsSectionGate>

              <AnalyticsSectionGate section="agent_performance">
                <Suspense fallback={null}>
                  <AgentPerformance />
                </Suspense>
              </AnalyticsSectionGate>

              <AnalyticsSectionGate section="conversion_funnel">
                <Suspense fallback={null}>
                  <ConversionFunnel />
                </Suspense>
              </AnalyticsSectionGate>
            </div>

            {/* Upgrade Banner - only show when there are locked sections */}
            {lockedSections.length > 0 && (
              <div className="mt-5 max-w-[1920px] mx-auto">
                <SoftCard variant="tinted" padding="lg">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-v2-pill bg-v2-accent text-v2-ink">
                          <Sparkles className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-base font-semibold tracking-tight text-v2-ink">
                          Unlock more analytics
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-8 gap-y-3">
                        {/* Available Sections */}
                        {accessibleSections.length > 0 && (
                          <div>
                            <span className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
                              Your plan includes
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {accessibleSections.map((section) => (
                                <span
                                  key={section}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-v2-pill text-[11px] bg-success/20 dark:bg-success/40 text-success"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  {ANALYTICS_SECTION_NAMES[section]}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Locked Sections */}
                        <div>
                          <span className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
                            Upgrade to unlock
                          </span>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {lockedSections.map((section) => (
                              <span
                                key={section}
                                className="inline-flex items-center px-2.5 py-1 rounded-v2-pill text-[11px] bg-v2-card border border-v2-ring text-v2-ink-muted"
                              >
                                {ANALYTICS_SECTION_NAMES[section]}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <Link to="/billing" className="flex-shrink-0">
                      <PillButton tone="black" size="md">
                        <Sparkles className="h-3.5 w-3.5" />
                        Upgrade plan
                      </PillButton>
                    </Link>
                  </div>
                </SoftCard>
              </div>
            )}
          </>
        )}

        {/* Footer note */}
        <div className="mt-4 px-2 py-1 text-[11px] text-v2-ink-subtle text-center max-w-[1920px]">
          Real-time calculations · Auto-refresh on data changes
        </div>
      </div>
    </div>
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
