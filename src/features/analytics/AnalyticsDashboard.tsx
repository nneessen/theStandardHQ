// src/features/analytics/AnalyticsDashboard.tsx
// The analytics workspace, organized into five scannable tabs (Overview ·
// Production · Team · Inbound Calls · Coaching) so each KPI group is a labeled
// destination instead of one long scroll. The standalone /kpi page was merged
// in here — its inbound-call workspace is now the Inbound + Coaching tabs.
//
// Page-level concerns (date range, CSV/PDF export, the upgrade banner) stay in
// this host; each tab owns only its panels. The active tab is mirrored to a
// ?tab= search param so it deep-links and survives refresh.

import { useState, type ElementType } from "react";
import {
  TrendingUp,
  Sparkles,
  CheckCircle2,
  FileDown,
  FileText,
  Gauge,
  LineChart,
  Users,
  PhoneIncoming,
  MessageSquareQuote,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { NEW_SUBSCRIPTIONS_ENABLED } from "@/lib/subscription/subscription-availability";
import { TimePeriodSelector } from "./components/TimePeriodSelector";
import { PillButton, SectionShell, SoftCard } from "@/components/v2";
import { Cap, T } from "@/components/board";
import { cn } from "@/lib/utils";
import { downloadCSV, printAnalyticsToPDF } from "../../utils/exportHelpers";
import {
  AnalyticsDateProvider,
  useAnalyticsDateRange,
} from "./context/AnalyticsDateContext";
import { useAnalyticsData } from "@/hooks";
import { ChunkErrorBoundary } from "@/components/shared/ChunkErrorBoundary";
import {
  useAccessibleAnalyticsSections,
  ANALYTICS_SECTION_NAMES,
} from "@/hooks/subscription";
import { OverviewTab } from "./tabs/OverviewTab";
import { ProductionTab } from "./tabs/ProductionTab";
import { TeamTab } from "./tabs/TeamTab";
import { InboundCallsTab } from "./tabs/InboundCallsTab";
import { CoachingTab } from "./tabs/CoachingTab";

export type AnalyticsTabId =
  | "overview"
  | "production"
  | "team"
  | "inbound"
  | "coaching";

const TABS: { id: AnalyticsTabId; label: string; icon: ElementType }[] = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "production", label: "Production", icon: LineChart },
  { id: "team", label: "Team", icon: Users },
  { id: "inbound", label: "Inbound Calls", icon: PhoneIncoming },
  { id: "coaching", label: "Coaching", icon: MessageSquareQuote },
];

const TAB_IDS = TABS.map((t) => t.id) as readonly AnalyticsTabId[];

function isTabId(v: string | undefined): v is AnalyticsTabId {
  return v != null && (TAB_IDS as readonly string[]).includes(v);
}

function AnalyticsDashboardContent({ initialTab }: { initialTab?: string }) {
  const navigate = useNavigate();
  const { timePeriod, setTimePeriod, customRange, setCustomRange, dateRange } =
    useAnalyticsDateRange();

  // Whole-book dataset — still loaded page-level because CSV/PDF export draws
  // from it regardless of the active tab.
  const analyticsData = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  const { accessibleSections, lockedSections } =
    useAccessibleAnalyticsSections();

  const [activeTab, setActiveTab] = useState<AnalyticsTabId>(
    isTabId(initialTab) ? initialTab : "overview",
  );

  const selectTab = (id: AnalyticsTabId) => {
    setActiveTab(id);
    navigate({ to: "/analytics", search: { tab: id }, replace: true });
  };

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
      <div className="mx-auto w-full max-w-[2400px] px-4 py-5 lg:py-8">
        {/* Header — eyebrow + ANALYTICS + subtitle | period control + export */}
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 24,
            marginBottom: 20,
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
              <TrendingUp size={15} />
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
            <p style={{ font: `500 18px ${T.data}`, color: T.mut, margin: 0 }}>
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

        {/* Tab bar — underline style, one labeled destination per KPI group */}
        <nav
          className="mb-6 flex flex-wrap items-center gap-1 border-b border-v2-ring"
          aria-label="Analytics sections"
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold transition-colors",
                  active
                    ? "border-v2-accent text-v2-ink"
                    : "border-transparent text-v2-ink-muted hover:text-v2-ink",
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Active tab — only the selected tab mounts, so unrelated data hooks
            don't all fire on load. */}
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "production" && <ProductionTab />}
        {activeTab === "team" && <TeamTab />}
        {activeTab === "inbound" && <InboundCallsTab />}
        {activeTab === "coaching" && <CoachingTab />}

        {/* Upgrade banner — page-level; only when sections are locked */}
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
      </div>
    </SectionShell>
  );
}

export function AnalyticsDashboard({ initialTab }: { initialTab?: string }) {
  return (
    <AnalyticsDateProvider>
      <ChunkErrorBoundary context="analytics dashboard">
        <AnalyticsDashboardContent initialTab={initialTab} />
      </ChunkErrorBoundary>
    </AnalyticsDateProvider>
  );
}
