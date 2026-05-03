// src/features/reports/components/ImoPerformanceReport.tsx

import { useMemo, useCallback } from "react";
import { Loader2, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "../../../lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { TrendLineChart } from "./charts/TrendLineChart";
import {
  useImoPerformanceReport,
  useImoProductionByAgency,
  useTopPerformersReport,
  imoKeys,
} from "../../../hooks/imo/useImoQueries";
import { formatCurrency } from "../../../lib/format";
import type { ReportDateRange } from "../../../types/team-reports.schemas";
import {
  ReportErrorBoundary,
  QueryErrorAlert,
  ReportQueryError,
} from "./ReportErrorBoundary";

interface ImoPerformanceReportProps {
  dateRange?: ReportDateRange;
}

function ImoPerformanceReportContent({ dateRange }: ImoPerformanceReportProps) {
  const queryClient = useQueryClient();

  const {
    data: performanceReport,
    isLoading: isLoadingPerformance,
    error: errorPerformance,
  } = useImoPerformanceReport(dateRange);

  const {
    data: agencyProduction,
    isLoading: isLoadingAgencies,
    error: errorAgencies,
  } = useImoProductionByAgency(dateRange);

  // Calculate agency comparison summary from production data
  const agencyComparison = useMemo(() => {
    if (!agencyProduction || agencyProduction.length === 0) {
      return null;
    }

    const totalAgents = agencyProduction.reduce(
      (acc, row) => acc + row.agent_count,
      0,
    );
    const totalPremium = agencyProduction.reduce(
      (acc, row) => acc + row.new_premium,
      0,
    );
    const avgRetention =
      agencyProduction.length > 0
        ? agencyProduction.reduce((acc, row) => acc + row.retention_rate, 0) /
          agencyProduction.length
        : 0;

    return {
      agencies: agencyProduction,
      summary: {
        total_agencies: agencyProduction.length,
        total_agents: totalAgents,
        total_new_premium: totalPremium,
        avg_retention_rate: Math.round(avgRetention * 10) / 10,
      },
    };
  }, [agencyProduction]);

  const {
    data: topPerformers,
    isLoading: isLoadingTop,
    error: errorTop,
  } = useTopPerformersReport(10, dateRange);

  const isLoading = isLoadingPerformance || isLoadingAgencies || isLoadingTop;

  const hasCriticalError = errorPerformance !== null;

  const secondaryErrors = [
    { name: "Agency Comparison", error: errorAgencies },
    { name: "Top Performers", error: errorTop },
  ].filter((e) => e.error !== null);

  const handleRetry = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: imoKeys.all });
  }, [queryClient]);

  const trendData = useMemo(() => {
    if (!performanceReport?.months) return [];
    return performanceReport.months.map((month) => ({
      label: month.month_label,
      premium: month.new_premium,
      commissions: month.commissions_earned,
      policies: month.new_policies,
    }));
  }, [performanceReport]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
        <Loader2 className="w-5 h-5 animate-spin text-info" />
        <span className="ml-2 text-[11px] text-v2-ink-muted">
          Loading IMO performance data...
        </span>
      </div>
    );
  }

  if (hasCriticalError) {
    return (
      <ReportQueryError
        message={
          errorPerformance instanceof Error
            ? errorPerformance.message
            : "Failed to load performance data"
        }
        onRetry={handleRetry}
      />
    );
  }

  if (!performanceReport) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="flex flex-col items-center justify-center text-center py-4">
          <AlertCircle className="h-6 w-6 text-v2-ink-subtle mb-2" />
          <p className="text-[11px] font-medium text-v2-ink">
            IMO Performance Report Unavailable
          </p>
          <p className="text-[10px] text-v2-ink-muted mt-1 max-w-[300px]">
            This report requires database features that may not be available
            yet.
          </p>
        </div>
      </div>
    );
  }

  const { summary } = performanceReport;
  const netGrowthPositive = summary.net_growth >= 0;

  return (
    <div className="space-y-2">
      {secondaryErrors.length > 0 && (
        <QueryErrorAlert
          title="Some data failed to load"
          errors={secondaryErrors}
          onRetry={handleRetry}
        />
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Summary Stats Card */}
        <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em]">
              Performance Summary
            </div>
            <div
              className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-medium",
                netGrowthPositive
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {netGrowthPositive ? "GROWTH" : "DECLINE"}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-v2-ink-muted">New Premium</span>
              <span className="font-mono font-bold text-v2-ink">
                {formatCurrency(summary.total_new_premium)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-v2-ink-muted">Commissions</span>
              <span className="font-mono font-bold text-success">
                {formatCurrency(summary.total_commissions)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-v2-ink-muted">New Policies</span>
              <span className="font-mono font-bold text-v2-ink">
                {summary.total_new_policies.toLocaleString()}
              </span>
            </div>
            <div className="h-px bg-v2-ring my-1" />
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-v2-ink-muted">New Agents</span>
              <span className="font-mono font-bold text-v2-ink">
                {summary.total_new_agents.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-v2-ink-muted">Lapsed</span>
              <span className="font-mono font-bold text-destructive">
                {summary.total_lapsed.toLocaleString()}
              </span>
            </div>
            <div className="h-px bg-v2-ring my-1" />
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-v2-ink-muted uppercase">Net Growth</span>
              <div className="flex items-center gap-1">
                {netGrowthPositive ? (
                  <TrendingUp className="w-3 h-3 text-success" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-destructive" />
                )}
                <span
                  className={cn(
                    "font-mono font-bold",
                    netGrowthPositive ? "text-success" : "text-destructive",
                  )}
                >
                  {netGrowthPositive ? "+" : ""}
                  {formatCurrency(summary.net_growth)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Trend Chart */}
        <div className="lg:col-span-2 bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
          <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em] mb-2">
            Monthly Production Trend
          </div>
          <TrendLineChart
            data={trendData}
            lines={[
              {
                dataKey: "premium",
                name: "New Premium",
                color: "#3b82f6",
                format: "currency",
              },
              {
                dataKey: "commissions",
                name: "Commissions",
                color: "#10b981",
                format: "currency",
              },
            ]}
            height={200}
          />
        </div>
      </div>

      {/* Agency Comparison */}
      {agencyComparison && agencyComparison.agencies.length > 0 && (
        <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em]">
              Agency Comparison
            </div>
            <span className="text-[10px] text-v2-ink-subtle">
              {agencyComparison.summary.total_agencies} agencies •{" "}
              {agencyComparison.summary.total_agents} agents
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-v2-ring">
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto w-12">
                    #
                  </TableHead>
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto">
                    Agency
                  </TableHead>
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto text-right">
                    Agents
                  </TableHead>
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto text-right">
                    Policies
                  </TableHead>
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto text-right">
                    Premium
                  </TableHead>
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto text-right">
                    Retention
                  </TableHead>
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto text-right">
                    % Share
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agencyComparison.agencies.slice(0, 10).map((agency, index) => (
                  <TableRow key={agency.agency_id} className="border-v2-ring">
                    <TableCell className="text-[11px] py-1.5">
                      <div
                        className={cn(
                          "w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold",
                          index === 0
                            ? "bg-warning/20 text-warning"
                            : index === 1
                              ? "bg-v2-ring text-v2-ink-muted"
                              : index === 2
                                ? "bg-warning/20 text-warning"
                                : "bg-v2-ring text-v2-ink-muted",
                        )}
                      >
                        {agency.rank_by_premium}
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5">
                      <div>
                        <p className="font-medium text-v2-ink">
                          {agency.agency_name}
                        </p>
                        <p className="text-[9px] text-v2-ink-muted">
                          {agency.owner_name}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono text-v2-ink">
                      {agency.agent_count}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono text-v2-ink">
                      {agency.new_policies}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono font-bold text-v2-ink">
                      {formatCurrency(agency.new_premium)}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right">
                      <span
                        className={cn(
                          "font-mono",
                          agency.retention_rate >= 80
                            ? "text-success"
                            : agency.retention_rate >= 60
                              ? "text-warning"
                              : "text-destructive",
                        )}
                      >
                        {agency.retention_rate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono text-v2-ink-muted">
                      {agency.pct_of_imo_premium}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Top Performers */}
      {topPerformers && topPerformers.performers.length > 0 && (
        <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
          <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em] mb-2">
            Top Performers
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-v2-ring">
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto w-12">
                    #
                  </TableHead>
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto">
                    Agent
                  </TableHead>
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto">
                    Agency
                  </TableHead>
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto text-right">
                    Policies
                  </TableHead>
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto text-right">
                    Premium
                  </TableHead>
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto text-right">
                    Commissions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPerformers.performers.map((performer, index) => (
                  <TableRow key={performer.agent_id} className="border-v2-ring">
                    <TableCell className="text-[11px] py-1.5">
                      <div
                        className={cn(
                          "w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold",
                          index === 0
                            ? "bg-warning/20 text-warning"
                            : index === 1
                              ? "bg-v2-ring text-v2-ink-muted"
                              : index === 2
                                ? "bg-warning/20 text-warning"
                                : "bg-v2-ring text-v2-ink-muted",
                        )}
                      >
                        {performer.rank_in_imo}
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 font-medium text-v2-ink">
                      {performer.agent_name}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-v2-ink-muted">
                      {performer.agency_name}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono text-v2-ink">
                      {performer.new_policies}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono font-bold text-v2-ink">
                      {formatCurrency(performer.new_premium)}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono text-success">
                      {formatCurrency(performer.commissions_earned)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

export function ImoPerformanceReport(props: ImoPerformanceReportProps) {
  const queryClient = useQueryClient();

  const handleBoundaryRetry = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: imoKeys.all });
  }, [queryClient]);

  return (
    <ReportErrorBoundary onRetry={handleBoundaryRetry}>
      <ImoPerformanceReportContent {...props} />
    </ReportErrorBoundary>
  );
}
