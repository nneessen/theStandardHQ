// src/features/hierarchy/components/TeamMetricsCard.tsx

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Board, Cap, FlapTile } from "@/components/board";
import type { HierarchyStats } from "@/types/hierarchy.types";
import type { TimePeriod } from "@/utils/dateRange";

// Helper to get short period suffix for labels
function getPeriodSuffix(period: TimePeriod): string {
  switch (period) {
    case "daily":
      return "(D)";
    case "weekly":
      return "(W)";
    case "MTD":
      return "(MTD)";
    case "monthly":
      return "(M)";
    case "yearly":
      return "(Y)";
    default:
      return "(M)";
  }
}

interface TeamMetricsCardProps {
  stats: HierarchyStats | null | undefined;
  agentCount: number;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  timePeriod?: TimePeriod;
}

export function TeamMetricsCard({
  stats,
  agentCount,
  isLoading,
  isError,
  onRetry,
  timePeriod = "monthly",
}: TeamMetricsCardProps) {
  const periodSuffix = getPeriodSuffix(timePeriod);
  if (isError) {
    return (
      <div className="bg-v2-card rounded-lg border border-v2-ring">
        <div className="p-3">
          <div className="flex items-center justify-center gap-2 text-[12px] text-destructive py-4">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load team metrics.</span>
            {onRetry && (
              <button
                onClick={() => onRetry()}
                className="underline hover:text-destructive dark:hover:text-destructive"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-lg border border-v2-ring">
        <div className="p-3">
          <div className="text-[12px] text-v2-ink-muted text-center py-4">
            Loading team metrics...
          </div>
        </div>
      </div>
    );
  }

  // Calculate additional metrics
  // Use agentCount (from useMyDownlines) as source of truth for total downlines
  const directAgents = stats?.direct_downlines || 0;
  const _indirectAgents = agentCount - directAgents;
  const mtdOverride = stats?.total_override_income_mtd || 0;
  const _ytdOverride = stats?.total_override_income_ytd || 0;
  const qtdOverride = mtdOverride; // Would need actual QTD calculation

  // Calculate averages and growth
  const _avgOverridePerAgent =
    directAgents > 0 ? mtdOverride / directAgents : 0;
  const lastMonthOverride = 0; // Would need historical data from previous month
  const _momGrowth =
    lastMonthOverride > 0
      ? ((mtdOverride - lastMonthOverride) / lastMonthOverride) * 100
      : 0;

  // Team performance metrics from stats
  const teamAPTotal = stats?.team_ap_total || 0;
  const teamIPTotal = stats?.team_ip_total || 0;
  const teamPoliciesMTD = stats?.team_policies_count || 0;
  const avgPremiumPerAgent = stats?.avg_premium_per_agent || 0;
  const _topPerformerName = stats?.top_performer_name || "No data";
  const topPerformerAmount = stats?.top_performer_ap || 0;
  const recruitmentRate = stats?.recruitment_rate || 0;
  const retentionRate = stats?.retention_rate || 0;
  const _avgContractLevel = stats?.avg_contract_level || 0;
  const _pendingInvitations = stats?.pending_invitations || 0;

  // Pending AP metrics
  const teamPendingAP = stats?.team_pending_ap_total || 0;
  const _teamPendingCount = stats?.team_pending_policies_count || 0;

  // Team Pace metrics (AP-based)
  // Monthly
  const teamMonthlyAPTarget = stats?.team_monthly_ap_target || 0;
  const teamFixedMonthlyAP = stats?.team_fixed_monthly_ap || 0; // MTD AP capped at today
  const teamMonthlyPacePercentage = stats?.team_monthly_pace_percentage || 0;
  const teamMonthlyPaceStatus = stats?.team_monthly_pace_status || "on_pace";
  const teamMonthlyProjected = stats?.team_monthly_projected || 0;

  // Yearly
  const teamYearlyAPTarget = stats?.team_yearly_ap_target || 0;
  const teamYTDAPTotal = stats?.team_ytd_ap_total || 0;
  const teamYearlyPacePercentage = stats?.team_yearly_pace_percentage || 0;
  const teamYearlyPaceStatus = stats?.team_yearly_pace_status || "on_pace";
  const teamYearlyProjected = stats?.team_yearly_projected || 0;

  return (
    <Board pad={20}>
      <Cap style={{ marginBottom: 14 }}>Team Metrics</Cap>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
          gap: 10,
        }}
      >
        <FlapTile
          label={`Team AP ${periodSuffix}`}
          value={formatCurrency(teamAPTotal)}
          tone="blue"
        />
        <FlapTile
          label="Team IP"
          value={formatCurrency(teamIPTotal)}
          tone="blue"
        />
        <FlapTile
          label={`Policies ${periodSuffix}`}
          value={String(teamPoliciesMTD)}
        />
        <FlapTile
          label="Avg Premium/Agent"
          value={formatCurrency(avgPremiumPerAgent)}
        />
        <FlapTile
          label="Pending AP"
          value={formatCurrency(teamPendingAP)}
          tone="amber"
        />
        <FlapTile label="QTD Override" value={formatCurrency(qtdOverride)} />
        <FlapTile
          label="Retention"
          value={formatPercent(retentionRate)}
          tone={
            retentionRate > 90 ? "green" : retentionRate > 80 ? "amber" : "red"
          }
        />
        <FlapTile
          label="Recruitment"
          value={formatPercent(recruitmentRate)}
          tone={
            recruitmentRate > 20
              ? "green"
              : recruitmentRate > 10
                ? "amber"
                : "red"
          }
        />
        <FlapTile
          label="Top Performer AP"
          value={formatCurrency(topPerformerAmount)}
          tone="green"
        />
        <FlapTile label="Active Agents" value={String(agentCount)} />
      </div>

      {/* Team Pace Section - Monthly & Yearly */}
      {(teamMonthlyAPTarget > 0 || teamYearlyAPTarget > 0) && (
        <div className="mt-3 pt-3 border-t border-v2-ring space-y-3">
          {/* Monthly Pace */}
          {teamMonthlyAPTarget > 0 && (
            <div>
              <div className="text-[12px] font-medium text-v2-ink-muted uppercase tracking-wide mb-1">
                Monthly Pace
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-4 text-[12px]">
                  <div title="Sum of all team members' monthly AP targets (yearly target ÷ 12)">
                    <span className="text-v2-ink-muted">Target: </span>
                    <span className="font-mono font-semibold text-v2-ink">
                      {formatCurrency(teamMonthlyAPTarget)}
                    </span>
                  </div>
                  <div title="All submissions this month with submit date up to today (any status)">
                    <span className="text-v2-ink-muted">MTD: </span>
                    <span className="font-mono font-semibold text-v2-ink">
                      {formatCurrency(teamFixedMonthlyAP)}
                    </span>
                  </div>
                  <div title="Total AP MTD ÷ day of month × days in month">
                    <span className="text-v2-ink-muted">Projected: </span>
                    <span className="font-mono font-semibold text-v2-ink">
                      {formatCurrency(teamMonthlyProjected)}
                    </span>
                  </div>
                </div>
                <div
                  className={cn(
                    "px-2 py-0.5 rounded text-[12px] font-semibold",
                    teamMonthlyPaceStatus === "ahead"
                      ? "bg-success/20 text-success dark:bg-success/30 dark:text-success"
                      : teamMonthlyPaceStatus === "on_pace"
                        ? "bg-info/20 text-info dark:bg-info/30 dark:text-info"
                        : "bg-destructive/20 text-destructive dark:bg-destructive/30 dark:text-destructive",
                  )}
                >
                  {teamMonthlyPaceStatus === "ahead"
                    ? "↑ Ahead"
                    : teamMonthlyPaceStatus === "on_pace"
                      ? "→ On Pace"
                      : "↓ Behind"}{" "}
                  ({teamMonthlyPacePercentage.toFixed(0)}%)
                </div>
              </div>
              <div className="text-[11px] text-v2-ink-subtle mt-1">
                Target = sum of each team member's (policies/yr × avg premium) ÷
                12 • Projected = current submission rate extrapolated to
                month-end
              </div>
            </div>
          )}

          {/* Yearly Pace */}
          {teamYearlyAPTarget > 0 && (
            <div>
              <div className="text-[12px] font-medium text-v2-ink-muted uppercase tracking-wide mb-1">
                Yearly Pace
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-4 text-[12px]">
                  <div title="Sum of all team members' yearly AP targets (policies/yr × avg premium)">
                    <span className="text-v2-ink-muted">Target: </span>
                    <span className="font-mono font-semibold text-v2-ink">
                      {formatCurrency(teamYearlyAPTarget)}
                    </span>
                  </div>
                  <div title="All submissions year-to-date (any status)">
                    <span className="text-v2-ink-muted">YTD: </span>
                    <span className="font-mono font-semibold text-v2-ink">
                      {formatCurrency(teamYTDAPTotal)}
                    </span>
                  </div>
                  <div title="Total AP YTD ÷ day of year × 365">
                    <span className="text-v2-ink-muted">Projected: </span>
                    <span className="font-mono font-semibold text-v2-ink">
                      {formatCurrency(teamYearlyProjected)}
                    </span>
                  </div>
                </div>
                <div
                  className={cn(
                    "px-2 py-0.5 rounded text-[12px] font-semibold",
                    teamYearlyPaceStatus === "ahead"
                      ? "bg-success/20 text-success dark:bg-success/30 dark:text-success"
                      : teamYearlyPaceStatus === "on_pace"
                        ? "bg-info/20 text-info dark:bg-info/30 dark:text-info"
                        : "bg-destructive/20 text-destructive dark:bg-destructive/30 dark:text-destructive",
                  )}
                >
                  {teamYearlyPaceStatus === "ahead"
                    ? "↑ Ahead"
                    : teamYearlyPaceStatus === "on_pace"
                      ? "→ On Pace"
                      : "↓ Behind"}{" "}
                  ({teamYearlyPacePercentage.toFixed(0)}%)
                </div>
              </div>
              <div className="text-[11px] text-v2-ink-subtle mt-1">
                Target = sum of each team member's (policies/yr × avg premium) •
                Projected = current submission rate extrapolated to year-end
              </div>
            </div>
          )}
        </div>
      )}
    </Board>
  );
}
