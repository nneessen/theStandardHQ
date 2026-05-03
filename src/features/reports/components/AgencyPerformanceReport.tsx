// src/features/reports/components/AgencyPerformanceReport.tsx

import { useMemo, useCallback, useState } from "react";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Users,
  DollarSign,
  FileText,
  Calendar,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "../../../lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  useAgencyPerformanceReport,
  useAgencyProductionByAgent,
  useAgencyDashboardMetrics,
  useAgencyWeeklyProduction,
  agencyKeys,
} from "../../../hooks/imo/useImoQueries";
import { formatCurrency } from "../../../lib/format";
import type { ReportDateRange } from "../../../types/team-reports.schemas";
import {
  ReportErrorBoundary,
  QueryErrorAlert,
  ReportQueryError,
} from "./ReportErrorBoundary";

interface AgencyPerformanceReportProps {
  agencyId?: string;
  dateRange?: ReportDateRange;
}

type ViewMode = "monthly" | "weekly";

function AgencyPerformanceReportContent({
  agencyId,
  dateRange,
}: AgencyPerformanceReportProps) {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");

  const {
    data: performanceReport,
    isLoading: isLoadingPerformance,
    error: errorPerformance,
  } = useAgencyPerformanceReport(agencyId, dateRange);

  const {
    data: weeklyReport,
    isLoading: isLoadingWeekly,
    error: errorWeekly,
  } = useAgencyWeeklyProduction(agencyId, dateRange);

  const {
    data: agentProduction,
    isLoading: isLoadingAgents,
    error: errorAgents,
  } = useAgencyProductionByAgent(agencyId);

  const {
    data: dashboardMetrics,
    isLoading: isLoadingDashboard,
    error: errorDashboard,
  } = useAgencyDashboardMetrics(agencyId, dateRange);

  const isLoading =
    isLoadingPerformance ||
    isLoadingAgents ||
    isLoadingDashboard ||
    isLoadingWeekly;

  const hasCriticalError = errorPerformance !== null;

  const secondaryErrors = [
    { name: "Agent Production", error: errorAgents },
    { name: "Dashboard Metrics", error: errorDashboard },
    { name: "Weekly Data", error: errorWeekly },
  ].filter((e) => e.error !== null);

  const handleRetry = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: agencyKeys.all });
  }, [queryClient]);

  // Format chart data for monthly view
  const monthlyChartData = useMemo(() => {
    if (!performanceReport?.months) return [];
    return performanceReport.months.map((month) => ({
      label: month.month_label,
      newPremium: month.new_premium,
      lapsedPremium: month.lapsed_premium,
      netChange: month.net_premium_change,
      policies: month.new_policies,
      lapsed: month.policies_lapsed,
      runningPremium: month.running_total_premium,
    }));
  }, [performanceReport]);

  // Format chart data for weekly view
  const weeklyChartData = useMemo(() => {
    if (!weeklyReport?.weeks) return [];
    return weeklyReport.weeks.map((week) => ({
      label: week.week_label,
      newPremium: week.new_premium,
      lapsedPremium: week.lapsed_premium,
      netChange: week.net_premium_change,
      policies: week.new_policies,
      lapsed: week.policies_lapsed,
      runningPremium: week.running_total_premium,
    }));
  }, [weeklyReport]);

  const chartData = viewMode === "monthly" ? monthlyChartData : weeklyChartData;

  // Custom tooltip for charts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bg-v2-card border border-v2-ring rounded-lg shadow-lg p-3 text-[11px]">
        <p className="font-semibold text-v2-ink mb-2">{label}</p>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-v2-ink-muted">{entry.name}:</span>
            </span>
            <span className="font-mono font-medium text-v2-ink">
              {typeof entry.value === "number"
                ? formatCurrency(entry.value)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
        <Loader2 className="w-5 h-5 animate-spin text-info" />
        <span className="ml-2 text-[11px] text-v2-ink-muted">
          Loading agency performance data...
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
            Agency Performance Report Unavailable
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
    <div className="space-y-3">
      {secondaryErrors.length > 0 && (
        <QueryErrorAlert
          title="Some data failed to load"
          errors={secondaryErrors}
          onRetry={handleRetry}
        />
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* Active Policies */}
        <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-3.5 h-3.5 text-info" />
            <span className="text-[9px] font-medium text-v2-ink-muted uppercase tracking-[0.18em]">
              Active Policies
            </span>
          </div>
          <p className="text-xl font-bold font-mono text-v2-ink">
            {dashboardMetrics?.active_policies?.toLocaleString() || 0}
          </p>
        </div>

        {/* Total Premium */}
        <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-success" />
            <span className="text-[9px] font-medium text-v2-ink-muted uppercase tracking-[0.18em]">
              Total Premium
            </span>
          </div>
          <p className="text-xl font-bold font-mono text-v2-ink">
            {formatCurrency(dashboardMetrics?.total_annual_premium || 0)}
          </p>
        </div>

        {/* Total AP (YTD) */}
        <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-success" />
            <span className="text-[9px] font-medium text-v2-ink-muted uppercase tracking-[0.18em]">
              Total AP (YTD)
            </span>
          </div>
          <p className="text-xl font-bold font-mono text-success">
            {formatCurrency(dashboardMetrics?.total_commissions_ytd || 0)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] text-info">
              Earned: {formatCurrency(dashboardMetrics?.total_earned_ytd || 0)}
            </span>
            <span className="text-[9px] text-warning">
              Pending: {formatCurrency(dashboardMetrics?.total_unearned || 0)}
            </span>
          </div>
        </div>

        {/* Agents */}
        <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-3.5 h-3.5 text-info" />
            <span className="text-[9px] font-medium text-v2-ink-muted uppercase tracking-[0.18em]">
              Agents
            </span>
          </div>
          <p className="text-xl font-bold font-mono text-v2-ink">
            {dashboardMetrics?.agent_count || 0}
          </p>
          <p className="text-[9px] text-v2-ink-muted mt-1">
            Avg:{" "}
            {formatCurrency(dashboardMetrics?.avg_production_per_agent || 0)}
            /agent
          </p>
        </div>
      </div>

      {/* Premium Growth Chart */}
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-v2-ink-subtle" />
            <span className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em]">
              Premium Activity
            </span>
          </div>
          <div className="flex items-center gap-1 bg-v2-ring rounded-md p-0.5">
            <button
              onClick={() => setViewMode("monthly")}
              className={cn(
                "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                viewMode === "monthly"
                  ? "bg-v2-card text-v2-ink shadow-sm"
                  : "text-v2-ink-muted hover:text-v2-ink",
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewMode("weekly")}
              className={cn(
                "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                viewMode === "weekly"
                  ? "bg-v2-card text-v2-ink shadow-sm"
                  : "text-v2-ink-muted hover:text-v2-ink",
              )}
            >
              Weekly
            </button>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="colorNewPremium"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient
                    id="colorLapsedPremium"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e5e7eb"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  stroke="#e5e7eb"
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  stroke="#e5e7eb"
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                  tickFormatter={(value) => {
                    if (value >= 1000000)
                      return `$${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                    return `$${value}`;
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
                  iconType="circle"
                  iconSize={8}
                />
                <Area
                  type="monotone"
                  dataKey="newPremium"
                  name="New Premium"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#colorNewPremium)"
                />
                <Area
                  type="monotone"
                  dataKey="lapsedPremium"
                  name="Lapsed Premium"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#colorLapsedPremium)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[220px] flex items-center justify-center border border-dashed border-v2-ring rounded-lg">
            <p className="text-[11px] text-v2-ink-subtle">No data available</p>
          </div>
        )}
      </div>

      {/* Period Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Period Stats */}
        <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em]">
              Period Performance
            </span>
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-v2-ink-muted">New Premium</span>
              <span className="font-mono font-bold text-v2-ink">
                {formatCurrency(summary.total_new_premium)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-v2-ink-muted">New Policies</span>
              <span className="font-mono font-bold text-v2-ink">
                {summary.total_new_policies.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-v2-ink-muted">Commissions</span>
              <span className="font-mono font-bold text-success">
                {formatCurrency(summary.total_commissions)}
              </span>
            </div>
            <div className="h-px bg-v2-ring" />
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-v2-ink-muted">Net Growth</span>
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

        {/* Policy Activity Bar Chart */}
        <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
          <span className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em]">
            Policy Activity ({viewMode === "monthly" ? "Monthly" : "Weekly"})
          </span>
          {chartData.length > 0 ? (
            <div className="h-[120px] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    opacity={0.5}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#71717a", fontSize: 9 }}
                    stroke="#e5e7eb"
                    tickLine={false}
                    interval={viewMode === "weekly" ? 1 : 0}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 9 }}
                    stroke="#e5e7eb"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      fontSize: "10px",
                    }}
                  />
                  <Bar
                    dataKey="policies"
                    name="New"
                    fill="#3b82f6"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="lapsed"
                    name="Lapsed"
                    fill="#ef4444"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[120px] flex items-center justify-center">
              <p className="text-[11px] text-v2-ink-subtle">No data</p>
            </div>
          )}
        </div>
      </div>

      {/* Agent Production Table */}
      {agentProduction && agentProduction.length > 0 && (
        <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em]">
              Agent Production & AP Breakdown
            </span>
            <span className="text-[10px] text-v2-ink-subtle">
              {agentProduction.length} agents
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-v2-ring">
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto w-10">
                    #
                  </TableHead>
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto">
                    Agent
                  </TableHead>
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto text-right">
                    Policies
                  </TableHead>
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto text-right">
                    Premium
                  </TableHead>
                  <TableHead className="text-[10px] py-1.5 h-auto text-right">
                    <span className="text-success">Total AP</span>
                  </TableHead>
                  <TableHead className="text-[10px] py-1.5 h-auto text-right">
                    <span className="text-info">Earned</span>
                  </TableHead>
                  <TableHead className="text-[10px] py-1.5 h-auto text-right">
                    <span className="text-warning">Pending</span>
                  </TableHead>
                  <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto text-right">
                    Share
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentProduction.slice(0, 10).map((agent, index) => (
                  <TableRow key={agent.agent_id} className="border-v2-ring">
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
                        {index + 1}
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5">
                      <div>
                        <p className="font-medium text-v2-ink">
                          {agent.agent_name}
                        </p>
                        <p className="text-[9px] text-v2-ink-muted">
                          {agent.agent_email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono text-v2-ink">
                      {agent.active_policies}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono font-bold text-v2-ink">
                      {formatCurrency(agent.total_annual_premium)}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono font-bold text-success">
                      {formatCurrency(agent.commissions_ytd)}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono text-info">
                      {formatCurrency(agent.earned_ytd)}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono text-warning">
                      {formatCurrency(agent.unearned_amount)}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono text-v2-ink-muted">
                      {agent.pct_of_agency_production}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Detailed Breakdown Table */}
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <span className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em]">
          {viewMode === "monthly" ? "Monthly" : "Weekly"} Breakdown
        </span>

        <div className="overflow-x-auto mt-2">
          <Table>
            <TableHeader>
              <TableRow className="border-v2-ring">
                <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto">
                  {viewMode === "monthly" ? "Month" : "Week"}
                </TableHead>
                <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto text-right">
                  Policies
                </TableHead>
                <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto text-right">
                  Premium
                </TableHead>
                <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto text-right">
                  Lapsed
                </TableHead>
                <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto text-right">
                  Net Change
                </TableHead>
                <TableHead className="text-[10px] text-v2-ink-muted py-1.5 h-auto text-right">
                  Running Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(viewMode === "monthly"
                ? performanceReport.months
                : weeklyReport?.weeks || []
              ).map((row) => {
                const label =
                  viewMode === "monthly"
                    ? (row as (typeof performanceReport.months)[0]).month_label
                    : (row as NonNullable<typeof weeklyReport>["weeks"][0])
                        .week_label;
                const key =
                  viewMode === "monthly"
                    ? (row as (typeof performanceReport.months)[0]).month_start
                    : (row as NonNullable<typeof weeklyReport>["weeks"][0])
                        .week_start;
                return (
                  <TableRow key={key} className="border-v2-ring">
                    <TableCell className="text-[11px] py-1.5 font-medium text-v2-ink">
                      {label}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono text-v2-ink">
                      {row.new_policies}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono text-v2-ink">
                      {formatCurrency(row.new_premium)}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono text-destructive">
                      {row.policies_lapsed}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono">
                      <span
                        className={cn(
                          row.net_premium_change >= 0
                            ? "text-success"
                            : "text-destructive",
                        )}
                      >
                        {row.net_premium_change >= 0 ? "+" : ""}
                        {formatCurrency(row.net_premium_change)}
                      </span>
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right font-mono font-bold text-v2-ink">
                      {formatCurrency(row.running_total_premium)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export function AgencyPerformanceReport(props: AgencyPerformanceReportProps) {
  const queryClient = useQueryClient();

  const handleBoundaryRetry = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: agencyKeys.all });
  }, [queryClient]);

  return (
    <ReportErrorBoundary onRetry={handleBoundaryRetry}>
      <AgencyPerformanceReportContent {...props} />
    </ReportErrorBoundary>
  );
}
