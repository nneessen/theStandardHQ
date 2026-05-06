// src/features/dashboard/components/OrgMetricsSection.tsx
// Dashboard widgets for IMO/Agency organizational metrics (Phase 5)

import React from "react";
import { cn } from "@/lib/utils";
import {
  Building2,
  Users,
  Trophy,
  BarChart3,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  useImoDashboardMetrics,
  useAgencyDashboardMetrics,
  useImoProductionByAgency,
  useImoOverrideSummary,
  useAgencyOverrideSummary,
} from "@/hooks/imo";
import type { ReportDateRange } from "@/types/team-reports.schemas";
import type { DateRange } from "@/utils/dateRange";

// Maximum agencies to display in production breakdown
const MAX_AGENCIES_DISPLAYED = 5;

interface MetricItemProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  subtext?: string;
}

const MetricItem: React.FC<MetricItemProps> = ({
  label,
  value,
  highlight,
  subtext,
}) => (
  <div className="flex justify-between items-center text-[11px] py-0.5">
    <span className="text-muted-foreground">{label}</span>
    <div className="text-right">
      <span
        className={cn(
          "font-mono font-semibold",
          highlight ? "text-[hsl(var(--success))]" : "text-foreground",
        )}
      >
        {value}
      </span>
      {subtext && (
        <span className="text-[9px] text-muted-foreground/70 ml-1">
          {subtext}
        </span>
      )}
    </div>
  </div>
);

/**
 * Error state component for dashboard panels
 */
const ErrorState: React.FC<{ message?: string }> = ({ message }) => (
  <div className="bg-card rounded-lg border border-destructive/30 p-3 h-full">
    <div className="flex flex-col items-center justify-center h-full text-center py-4">
      <AlertCircle className="h-6 w-6 text-destructive/70 mb-2" />
      <div className="text-[11px] text-destructive font-medium">
        Failed to load metrics
      </div>
      {message && (
        <div className="text-[10px] text-muted-foreground mt-1 max-w-[200px] truncate">
          {message}
        </div>
      )}
    </div>
  </div>
);

/**
 * Empty state component for when no data exists for selected period
 */
const EmptyState: React.FC<{ title: string }> = ({ title }) => (
  <div className="bg-card rounded-lg border border-border p-3 h-full">
    <div className="flex flex-col items-center justify-center h-full text-center py-6">
      <BarChart3 className="h-6 w-6 text-muted-foreground/50 mb-2" />
      <div className="text-[11px] text-muted-foreground font-medium">
        {title}
      </div>
      <div className="text-[10px] text-muted-foreground/70 mt-1">
        No data for this period
      </div>
    </div>
  </div>
);

/**
 * Helper to convert DateRange to ReportDateRange
 */
function toReportDateRange(dateRange: DateRange): ReportDateRange {
  return {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  };
}

interface PanelProps {
  dateRange: DateRange;
}

/**
 * IMO Metrics Panel - For IMO admins/owners
 */
const ImoMetricsPanel: React.FC<PanelProps> = ({ dateRange }) => {
  const reportDateRange = toReportDateRange(dateRange);
  const {
    data: metrics,
    isLoading,
    error,
  } = useImoDashboardMetrics(reportDateRange);

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border p-3 h-full animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-3" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-3 bg-muted/50 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
      />
    );
  }

  if (!metrics) {
    return <EmptyState title="IMO Overview" />;
  }

  return (
    <div className="bg-card rounded-lg border border-border p-3 h-full">
      <div className="flex items-center gap-1.5 mb-2">
        <Building2 className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          IMO Overview
        </span>
        <span className="text-[9px] text-muted-foreground/70 ml-auto truncate max-w-[100px]">
          {metrics.imo_name}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="text-center p-2 bg-muted rounded">
          <div className="text-lg font-bold text-foreground">
            {formatNumber(metrics.agency_count)}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">
            Agencies
          </div>
        </div>
        <div className="text-center p-2 bg-muted rounded">
          <div className="text-lg font-bold text-foreground">
            {formatNumber(metrics.agent_count)}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">
            Agents
          </div>
        </div>
      </div>

      <div className="space-y-0.5">
        <MetricItem
          label="Active Policies"
          value={formatNumber(metrics.total_active_policies)}
        />
        <MetricItem
          label="Annual Premium"
          value={formatCurrency(metrics.total_annual_premium)}
          highlight={metrics.total_annual_premium > 0}
        />
        <div className="border-t border-border my-1.5" />
        <MetricItem
          label="Commissions"
          value={formatCurrency(metrics.total_commissions_ytd)}
          highlight={metrics.total_commissions_ytd > 0}
        />
        <MetricItem
          label="Earned"
          value={formatCurrency(metrics.total_earned_ytd)}
        />
        <MetricItem
          label="Unearned"
          value={formatCurrency(metrics.total_unearned)}
        />
        <div className="border-t border-border my-1.5" />
        <MetricItem
          label="Avg/Agent"
          value={formatCurrency(metrics.avg_production_per_agent)}
          subtext="premium"
        />
      </div>
    </div>
  );
};

/**
 * Agency Metrics Panel - For agency owners
 */
const AgencyMetricsPanel: React.FC<PanelProps> = ({ dateRange }) => {
  const reportDateRange = toReportDateRange(dateRange);
  const {
    data: metrics,
    isLoading,
    error,
  } = useAgencyDashboardMetrics(undefined, reportDateRange);

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border p-3 h-full animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-3" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-3 bg-muted/50 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
      />
    );
  }

  if (!metrics) {
    return <EmptyState title="Agency Overview" />;
  }

  return (
    <div className="bg-card rounded-lg border border-border p-3 h-full">
      <div className="flex items-center gap-1.5 mb-2">
        <Users className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Agency Overview
        </span>
        <span className="text-[9px] text-muted-foreground/70 ml-auto truncate max-w-[100px]">
          {metrics.agency_name}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="text-center p-2 bg-muted rounded">
          <div className="text-lg font-bold text-foreground">
            {formatNumber(metrics.agent_count)}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">
            Agents
          </div>
        </div>
        <div className="text-center p-2 bg-[hsl(var(--success))]/10 rounded">
          <div className="text-lg font-bold text-[hsl(var(--success))]">
            {formatNumber(metrics.active_policies)}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">
            Policies
          </div>
        </div>
      </div>

      <div className="space-y-0.5">
        <MetricItem
          label="Annual Premium"
          value={formatCurrency(metrics.total_annual_premium)}
          highlight={metrics.total_annual_premium > 0}
        />
        <MetricItem
          label="Commissions"
          value={formatCurrency(metrics.total_commissions_ytd)}
          highlight={metrics.total_commissions_ytd > 0}
        />
        <MetricItem
          label="Earned"
          value={formatCurrency(metrics.total_earned_ytd)}
        />
        <MetricItem
          label="Unearned"
          value={formatCurrency(metrics.total_unearned)}
        />
        <div className="border-t border-border my-1.5" />
        <MetricItem
          label="Avg/Agent"
          value={formatCurrency(metrics.avg_production_per_agent)}
          subtext="premium"
        />
      </div>

      {/* Top Producer */}
      {metrics.top_producer_name && (
        <div className="mt-3 p-2 bg-[hsl(var(--warning))]/10 rounded border border-[hsl(var(--warning))]/30">
          <div className="flex items-center gap-1 mb-1">
            <Trophy className="h-3 w-3 text-[hsl(var(--warning))]" />
            <span className="text-[9px] text-[hsl(var(--warning))] uppercase font-semibold">
              Top Producer
            </span>
          </div>
          <div className="text-[11px] font-medium text-foreground truncate">
            {metrics.top_producer_name}
          </div>
          <div className="text-[10px] text-[hsl(var(--warning))] font-mono">
            {formatCurrency(metrics.top_producer_premium)}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * IMO Override Summary Panel - For IMO admins
 */
const ImoOverrideSummaryPanel: React.FC<PanelProps> = ({ dateRange }) => {
  const reportDateRange = toReportDateRange(dateRange);
  const {
    data: summary,
    isLoading,
    error,
  } = useImoOverrideSummary(reportDateRange);

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border p-3 h-full animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-3" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 bg-muted/50 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
      />
    );
  }

  if (!summary) {
    return <EmptyState title="Override Commissions" />;
  }

  return (
    <div className="bg-card rounded-lg border border-border p-3 h-full">
      <div className="flex items-center gap-1.5 mb-2">
        <ArrowUpRight className="h-3 w-3 text-[hsl(var(--warning))]" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Override Commissions
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="text-center p-2 bg-muted rounded">
          <div className="text-lg font-bold text-foreground">
            {formatNumber(summary.total_override_count)}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">
            Overrides
          </div>
        </div>
        <div className="text-center p-2 bg-[hsl(var(--success))]/10 rounded">
          <div className="text-lg font-bold text-[hsl(var(--success))]">
            {formatCurrency(summary.total_override_amount)}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">
            Total
          </div>
        </div>
      </div>

      <div className="space-y-0.5">
        <MetricItem
          label="Pending"
          value={formatCurrency(summary.pending_amount)}
        />
        <MetricItem
          label="Earned"
          value={formatCurrency(summary.earned_amount)}
          highlight={summary.earned_amount > 0}
        />
        <MetricItem label="Paid" value={formatCurrency(summary.paid_amount)} />
        {summary.chargeback_amount > 0 && (
          <MetricItem
            label="Chargebacks"
            value={formatCurrency(summary.chargeback_amount)}
          />
        )}
        <div className="border-t border-border my-1.5" />
        <MetricItem
          label="Uplines"
          value={formatNumber(summary.unique_uplines)}
          subtext="receiving"
        />
        <MetricItem
          label="Downlines"
          value={formatNumber(summary.unique_downlines)}
          subtext="generating"
        />
        <MetricItem
          label="Avg/Policy"
          value={formatCurrency(summary.avg_override_per_policy)}
        />
      </div>
    </div>
  );
};

/**
 * Agency Override Summary Panel - For agency owners
 */
const AgencyOverrideSummaryPanel: React.FC<PanelProps> = ({ dateRange }) => {
  const reportDateRange = toReportDateRange(dateRange);
  const {
    data: summary,
    isLoading,
    error,
  } = useAgencyOverrideSummary(undefined, reportDateRange);

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border p-3 h-full animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-3" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 bg-muted/50 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
      />
    );
  }

  if (!summary) {
    return <EmptyState title="Override Commissions" />;
  }

  return (
    <div className="bg-card rounded-lg border border-border p-3 h-full">
      <div className="flex items-center gap-1.5 mb-2">
        <ArrowUpRight className="h-3 w-3 text-[hsl(var(--warning))]" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Override Commissions
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="text-center p-2 bg-muted rounded">
          <div className="text-lg font-bold text-foreground">
            {formatNumber(summary.total_override_count)}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">
            Overrides
          </div>
        </div>
        <div className="text-center p-2 bg-[hsl(var(--success))]/10 rounded">
          <div className="text-lg font-bold text-[hsl(var(--success))]">
            {formatCurrency(summary.total_override_amount)}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">
            Total
          </div>
        </div>
      </div>

      <div className="space-y-0.5">
        <MetricItem
          label="Pending"
          value={formatCurrency(summary.pending_amount)}
        />
        <MetricItem
          label="Earned"
          value={formatCurrency(summary.earned_amount)}
          highlight={summary.earned_amount > 0}
        />
        <MetricItem label="Paid" value={formatCurrency(summary.paid_amount)} />
        <MetricItem
          label="Avg/Policy"
          value={formatCurrency(summary.avg_override_per_policy)}
        />
      </div>

      {/* Top Earner */}
      {summary.top_earner_name && (
        <div className="mt-3 p-2 bg-[hsl(var(--warning))]/10 rounded border border-[hsl(var(--warning))]/30">
          <div className="flex items-center gap-1 mb-1">
            <Trophy className="h-3 w-3 text-[hsl(var(--warning))]" />
            <span className="text-[9px] text-[hsl(var(--warning))] uppercase font-semibold">
              Top Override Earner
            </span>
          </div>
          <div className="text-[11px] font-medium text-foreground truncate">
            {summary.top_earner_name}
          </div>
          <div className="text-[10px] text-[hsl(var(--warning))] font-mono">
            {formatCurrency(summary.top_earner_amount)}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Production Breakdown Panel - For IMO admins (by agency)
 */
const ProductionBreakdownPanel: React.FC<PanelProps> = ({ dateRange }) => {
  const reportDateRange = toReportDateRange(dateRange);
  const {
    data: agencies,
    isLoading,
    error,
  } = useImoProductionByAgency(reportDateRange);

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border p-3 h-full animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-3" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 bg-muted/50 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
      />
    );
  }

  if (!agencies || agencies.length === 0) {
    return <EmptyState title="Production by Agency" />;
  }

  // Take top agencies by production (using named constant)
  const topAgencies = agencies.slice(0, MAX_AGENCIES_DISPLAYED);

  return (
    <div className="bg-card rounded-lg border border-border p-3 h-full">
      <div className="flex items-center gap-1.5 mb-3">
        <BarChart3 className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Production by Agency
        </span>
        <span className="text-[9px] text-muted-foreground/70 ml-auto">
          Top 5
        </span>
      </div>

      <div className="space-y-2">
        {topAgencies.map((agency, index) => (
          <div
            key={agency.agency_id}
            className="flex items-center gap-2 p-1.5 bg-muted/50 rounded"
          >
            <div
              className={cn(
                "w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold",
                index === 0
                  ? "bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]"
                  : index === 1
                    ? "bg-muted text-muted-foreground"
                    : index === 2
                      ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]/80"
                      : "bg-muted/50 text-muted-foreground/70",
              )}
            >
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-foreground truncate">
                {agency.agency_name}
              </div>
              <div className="text-[9px] text-muted-foreground truncate">
                {agency.owner_name} &bull; {agency.agent_count} agents
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-mono font-semibold text-foreground">
                {formatCurrency(agency.new_premium)}
              </div>
              <div className="text-[9px] text-muted-foreground/70">
                {agency.pct_of_imo_premium.toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>

      {agencies.length > MAX_AGENCIES_DISPLAYED && (
        <div className="mt-2 text-center">
          <span className="text-[9px] text-muted-foreground/70">
            +{agencies.length - MAX_AGENCIES_DISPLAYED} more agencies
          </span>
        </div>
      )}
    </div>
  );
};

interface OrgMetricsSectionProps {
  isImoAdmin: boolean;
  isAgencyOwner: boolean;
  dateRange: DateRange;
}

/**
 * Org Metrics Section - Shows IMO metrics for IMO admins, Agency metrics for agency owners
 */
export const OrgMetricsSection: React.FC<OrgMetricsSectionProps> = ({
  isImoAdmin,
  isAgencyOwner,
  dateRange,
}) => {
  // Don't render if user has no org role
  if (!isImoAdmin && !isAgencyOwner) {
    return null;
  }

  if (isImoAdmin) {
    return (
      <div className="grid gap-2 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
        <ImoMetricsPanel dateRange={dateRange} />
        <ImoOverrideSummaryPanel dateRange={dateRange} />
        <ProductionBreakdownPanel dateRange={dateRange} />
      </div>
    );
  }

  if (isAgencyOwner) {
    return (
      <div className="grid gap-2 grid-cols-1 md:grid-cols-2 [&>*]:min-w-0">
        <AgencyMetricsPanel dateRange={dateRange} />
        <AgencyOverrideSummaryPanel dateRange={dateRange} />
      </div>
    );
  }

  return null;
};
