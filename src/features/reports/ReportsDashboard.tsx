// src/features/reports/ReportsDashboard.tsx

import { useState, useMemo } from "react";
import {
  Package,
  Loader2,
  ChevronDown,
  Calendar,
  FileText,
  Sheet,
  FileBarChart,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { PillButton, SoftCard } from "@/components/v2";
import {
  TimePeriodSelector,
  AdvancedTimePeriod,
  getAdvancedDateRange,
} from "../analytics/components/TimePeriodSelector";

// Types
import type {
  ReportType,
  ReportFilters,
  DrillDownContext,
} from "../../types/reports.types";

// Hooks
import { useReport } from "./hooks";

// Config
import { REPORT_CATEGORIES, getDefaultReportType } from "./config";

// Utils
import { getInitialDateRange, TIER_DESCRIPTIONS } from "./utils";

// Components
import {
  ReportDocumentHeader,
  ExecutiveSummary,
  ReportSectionCard,
  BundleExportDialog,
  DrillDownDrawer,
  ImoPerformanceReport,
  AgencyPerformanceReport,
} from "./components";
import { ScheduledReportsManager } from "./components/ScheduledReportsManager";
import {
  Collapsible,
  CollapsibleContent,
} from "../../components/ui/collapsible";

// Services
import { ReportExportService } from "../../services/reports/reportExportService";

// Get report name by type
function getReportName(type: ReportType): string {
  for (const category of Object.values(REPORT_CATEGORIES)) {
    const report = category.reports.find((r) => r.type === type);
    if (report) return report.name;
  }
  return "Report";
}

export function ReportsDashboard() {
  // State
  const [selectedType, setSelectedType] = useState<ReportType>(
    getDefaultReportType(),
  );
  const [timePeriod, setTimePeriod] = useState<AdvancedTimePeriod>("MTD");
  const [customRange, setCustomRange] = useState<{
    startDate: Date;
    endDate: Date;
  }>(getInitialDateRange);
  const [bundleDialogOpen, setBundleDialogOpen] = useState(false);
  const [drillDownContext, setDrillDownContext] =
    useState<DrillDownContext | null>(null);
  const [showScheduledReports, setShowScheduledReports] = useState(false);

  // Memoized date range
  const dateRange = useMemo(
    () => getAdvancedDateRange(timePeriod, customRange),
    [timePeriod, customRange],
  );

  // Memoized filters
  const filters: ReportFilters = useMemo(
    () => ({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    }),
    [dateRange.startDate, dateRange.endDate],
  );

  // Fetch report data
  const { data: report, isLoading, error } = useReport(selectedType, filters);

  // Drill-down handlers
  const handleAgingBucketClick = (bucket: string) => {
    setDrillDownContext({
      type: "commission-aging-bucket",
      title: `Commission Aging: ${bucket}`,
      subtitle: "At-risk commissions in this aging window",
      agingBucket: bucket,
      filters,
    });
  };

  const handleClientTierClick = (tier: string) => {
    setDrillDownContext({
      type: "client-tier",
      title: `Tier ${tier} Clients`,
      subtitle: TIER_DESCRIPTIONS[tier] || "Clients in this tier",
      clientTier: tier as "A" | "B" | "C" | "D",
      filters,
    });
  };

  // Export handlers
  const handleExportPDF = () => {
    if (!report) return;
    ReportExportService.exportReport(report, {
      format: "pdf",
      includeCharts: true,
      includeSummary: true,
      includeInsights: true,
    });
  };

  const handleExportExcel = () => {
    if (!report) return;
    ReportExportService.exportReport(report, {
      format: "excel",
      includeSummary: true,
    });
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Compact header — title dropdown + period selector + actions in ONE row */}
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <FileBarChart className="h-4 w-4 text-v2-ink" />
              <h1 className="text-base font-semibold tracking-tight text-v2-ink">
                Reports
              </h1>
            </div>
            {/* Report Type Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <PillButton
                  tone="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                >
                  {getReportName(selectedType)}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </PillButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {Object.entries(REPORT_CATEGORIES).map(([key, category]) => (
                  <div key={key}>
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.18em] text-v2-ink-subtle">
                      {category.name}
                    </DropdownMenuLabel>
                    {category.reports.map((report) => (
                      <DropdownMenuItem
                        key={report.type}
                        onClick={() => setSelectedType(report.type)}
                        className={`text-xs ${selectedType === report.type ? "bg-v2-accent-soft text-v2-ink" : ""}`}
                      >
                        <span className="mr-2">{report.icon}</span>
                        {report.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <TimePeriodSelector
              selectedPeriod={timePeriod}
              onPeriodChange={setTimePeriod}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />
            <div className="hidden sm:flex gap-1">
              <PillButton
                onClick={handleExportPDF}
                tone="ghost"
                size="sm"
                disabled={!report || isLoading}
                className="h-7 px-2.5 text-[11px]"
                title="Export to PDF"
              >
                <FileText className="h-3 w-3" />
                PDF
              </PillButton>
              <PillButton
                onClick={handleExportExcel}
                tone="ghost"
                size="sm"
                disabled={!report || isLoading}
                className="h-7 px-2.5 text-[11px]"
                title="Export to Excel"
              >
                <Sheet className="h-3 w-3" />
                Excel
              </PillButton>
              <PillButton
                onClick={() => setBundleDialogOpen(true)}
                tone="ghost"
                size="sm"
                className="h-7 px-2.5 text-[11px]"
              >
                <Package className="h-3 w-3" />
                Bundle
              </PillButton>
              <PillButton
                onClick={() => setShowScheduledReports(!showScheduledReports)}
                tone={showScheduledReports ? "black" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-[11px]"
              >
                <Calendar className="h-3 w-3" />
                Schedule
              </PillButton>
            </div>
          </div>
        </header>

        {/* Scheduled Reports Panel */}
        <Collapsible
          open={showScheduledReports}
          onOpenChange={setShowScheduledReports}
        >
          <CollapsibleContent>
            <SoftCard padding="md">
              <ScheduledReportsManager />
            </SoftCard>
          </CollapsibleContent>
        </Collapsible>

        {/* Main Content */}
        <div className="flex-1 space-y-2.5">
          {/* Loading State */}
          {isLoading && (
            <SoftCard padding="lg">
              <div className="flex flex-col items-center justify-center py-6">
                <Loader2 className="w-6 h-6 text-v2-ink-muted animate-spin mb-2" />
                <p className="text-xs text-v2-ink-muted">Generating report…</p>
              </div>
            </SoftCard>
          )}

          {/* Error State */}
          {error && (
            <SoftCard
              padding="md"
              className="border-red-300 dark:border-red-800"
            >
              <p className="text-xs text-red-600 dark:text-red-400">
                Error:{" "}
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
            </SoftCard>
          )}

          {/* Team Performance Reports (Phase 6) */}
          {selectedType === "imo-performance" && (
            <ImoPerformanceReport
              dateRange={{
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
              }}
            />
          )}

          {selectedType === "agency-performance" && (
            <AgencyPerformanceReport
              dateRange={{
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
              }}
            />
          )}

          {/* Standard Report Document */}
          {!isLoading &&
            !error &&
            report &&
            selectedType !== "imo-performance" &&
            selectedType !== "agency-performance" && (
              <SoftCard padding="none" className="overflow-hidden">
                <ReportDocumentHeader title={report.title} filters={filters} />
                <ExecutiveSummary summary={report.summary} />

                {/* Report Sections */}
                {report.sections.map((section) => (
                  <ReportSectionCard
                    key={section.id}
                    section={section}
                    onAgingBucketClick={handleAgingBucketClick}
                    onClientTierClick={handleClientTierClick}
                  />
                ))}

                {/* Report Footer */}
                <div className="px-3 py-2 bg-v2-canvas text-center border-t border-v2-ring">
                  <p className="text-[11px] text-v2-ink-subtle">
                    Report ID: {report.id} · Generated{" "}
                    {report.generatedAt.toLocaleString()}
                  </p>
                </div>
              </SoftCard>
            )}
        </div>
      </div>

      {/* Dialogs */}
      <BundleExportDialog
        open={bundleDialogOpen}
        onOpenChange={setBundleDialogOpen}
        filters={filters}
      />

      <DrillDownDrawer
        open={!!drillDownContext}
        onClose={() => setDrillDownContext(null)}
        context={drillDownContext}
      />
    </>
  );
}
