// src/features/hierarchy/components/TeamMetricsCard.tsx

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/format";
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
          <div className="flex items-center justify-center gap-2 text-[11px] text-red-500 dark:text-red-400 py-4">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load team metrics.</span>
            {onRetry && (
              <button
                onClick={() => onRetry()}
                className="underline hover:text-red-700 dark:hover:text-red-300"
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
          <div className="text-[11px] text-v2-ink-muted text-center py-4">
            Loading team metrics...
          </div>
        </div>
      </div>
    );
  }

  // Calculate additional metrics
  // Use agentCount (from useMyDownlines) as source of truth for total downlines
  const directAgents = stats?.direct_downlines || 0;
  const indirectAgents = agentCount - directAgents;
  const mtdOverride = stats?.total_override_income_mtd || 0;
  const ytdOverride = stats?.total_override_income_ytd || 0;
  const qtdOverride = mtdOverride; // Would need actual QTD calculation

  // Calculate averages and growth
  const avgOverridePerAgent = directAgents > 0 ? mtdOverride / directAgents : 0;
  const lastMonthOverride = 0; // Would need historical data from previous month
  const momGrowth =
    lastMonthOverride > 0
      ? ((mtdOverride - lastMonthOverride) / lastMonthOverride) * 100
      : 0;

  // Team performance metrics from stats
  const teamAPTotal = stats?.team_ap_total || 0;
  const teamIPTotal = stats?.team_ip_total || 0;
  const teamPoliciesMTD = stats?.team_policies_count || 0;
  const avgPremiumPerAgent = stats?.avg_premium_per_agent || 0;
  const topPerformerName = stats?.top_performer_name || "No data";
  const topPerformerAmount = stats?.top_performer_ap || 0;
  const recruitmentRate = stats?.recruitment_rate || 0;
  const retentionRate = stats?.retention_rate || 0;
  const avgContractLevel = stats?.avg_contract_level || 0;
  const pendingInvitations = stats?.pending_invitations || 0;

  // Pending AP metrics
  const teamPendingAP = stats?.team_pending_ap_total || 0;
  const teamPendingCount = stats?.team_pending_policies_count || 0;

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
    <div className="bg-v2-card rounded-lg border border-v2-ring">
      <div className="p-3">
        <div className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide mb-2">
          Team Metrics
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Team Size Column */}
          <div>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Total Agents</span>
                <span className="font-mono font-bold text-v2-ink">
                  {agentCount + 1}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Direct Reports</span>
                <span className="font-mono text-v2-ink-muted">
                  {directAgents}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Indirect Reports</span>
                <span className="font-mono text-v2-ink-muted">
                  {indirectAgents}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Active {periodSuffix}</span>
                <span
                  className={cn(
                    "font-mono",
                    agentCount > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-v2-ink-muted",
                  )}
                >
                  {agentCount}
                </span>
              </div>
              <div className="h-px bg-v2-ring my-1" />
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Growth {periodSuffix}</span>
                <span
                  className={cn(
                    "font-mono font-semibold",
                    momGrowth > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : momGrowth < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-v2-ink-muted",
                  )}
                >
                  {momGrowth > 0 ? "↑" : momGrowth < 0 ? "↓" : "→"}{" "}
                  {Math.abs(momGrowth).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Override Income Column */}
          <div className="border-l border-v2-ring pl-4">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">
                  Override {periodSuffix}
                </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(mtdOverride)}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">QTD Override</span>
                <span className="font-mono text-v2-ink-muted">
                  {formatCurrency(qtdOverride)}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">YTD Override</span>
                <span className="font-mono text-v2-ink-muted">
                  {formatCurrency(ytdOverride)}
                </span>
              </div>
              <div className="h-px bg-v2-ring my-1" />
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Avg/Agent</span>
                <span className="font-mono text-v2-ink-muted">
                  {formatCurrency(avgOverridePerAgent)}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">vs Last Month</span>
                <span
                  className={cn(
                    "font-mono text-[10px]",
                    momGrowth > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : momGrowth < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-v2-ink-muted",
                  )}
                >
                  {momGrowth > 0 ? "+" : ""}
                  {momGrowth.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Team Performance Column */}
          <div className="border-l border-v2-ring pl-4">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Team Total AP</span>
                <span className="font-mono font-bold text-v2-ink">
                  {formatCurrency(teamAPTotal)}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Team IP Total</span>
                <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                  {formatCurrency(teamIPTotal)}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">
                  Policies {periodSuffix}
                </span>
                <span className="font-mono text-v2-ink-muted">
                  {teamPoliciesMTD}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Avg Premium/Agent</span>
                <span className="font-mono text-v2-ink-muted">
                  {formatCurrency(avgPremiumPerAgent)}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Pending AP</span>
                <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                  {formatCurrency(teamPendingAP)}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Pending Policies</span>
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  {teamPendingCount}
                </span>
              </div>
              <div className="h-px bg-v2-ring my-1" />
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Top Performer</span>
                <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 truncate max-w-[100px]">
                  {topPerformerName}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Top AP</span>
                <span className="font-mono font-semibold text-v2-ink">
                  {formatCurrency(topPerformerAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Hierarchy Health Column */}
          <div className="border-l border-v2-ring pl-4">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Recruitment Rate</span>
                <span
                  className={cn(
                    "font-mono font-semibold",
                    recruitmentRate > 20
                      ? "text-emerald-600 dark:text-emerald-400"
                      : recruitmentRate > 10
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400",
                  )}
                >
                  {formatPercent(recruitmentRate)}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Retention Rate</span>
                <span
                  className={cn(
                    "font-mono font-semibold",
                    retentionRate > 90
                      ? "text-emerald-600 dark:text-emerald-400"
                      : retentionRate > 80
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400",
                  )}
                >
                  {formatPercent(retentionRate)}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Avg Contract Lvl</span>
                <span className="font-mono text-v2-ink-muted">
                  {avgContractLevel.toFixed(1)}
                </span>
              </div>
              <div className="h-px bg-v2-ring my-1" />
              <div className="flex justify-between text-[11px]">
                <span className="text-v2-ink-muted">Pending Invites</span>
                <span
                  className={cn(
                    "font-mono",
                    pendingInvitations > 0
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-v2-ink-muted",
                  )}
                >
                  {pendingInvitations}
                </span>
              </div>
              <div className="text-[10px] text-v2-ink-muted">
                {retentionRate > 90
                  ? "✓ Healthy team"
                  : retentionRate > 80
                    ? "⚡ Monitor retention"
                    : "⚠️ Needs attention"}
              </div>
            </div>
          </div>
        </div>

        {/* Team Pace Section - Monthly & Yearly */}
        {(teamMonthlyAPTarget > 0 || teamYearlyAPTarget > 0) && (
          <div className="mt-3 pt-3 border-t border-v2-ring space-y-3">
            {/* Monthly Pace */}
            {teamMonthlyAPTarget > 0 && (
              <div>
                <div className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide mb-1">
                  Monthly Pace
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-4 text-[11px]">
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
                      "px-2 py-0.5 rounded text-[10px] font-semibold",
                      teamMonthlyPaceStatus === "ahead"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : teamMonthlyPaceStatus === "on_pace"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
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
                <div className="text-[9px] text-v2-ink-subtle mt-1">
                  Target = sum of each team member's (policies/yr × avg premium)
                  ÷ 12 • Projected = current submission rate extrapolated to
                  month-end
                </div>
              </div>
            )}

            {/* Yearly Pace */}
            {teamYearlyAPTarget > 0 && (
              <div>
                <div className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide mb-1">
                  Yearly Pace
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-4 text-[11px]">
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
                      "px-2 py-0.5 rounded text-[10px] font-semibold",
                      teamYearlyPaceStatus === "ahead"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : teamYearlyPaceStatus === "on_pace"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
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
                <div className="text-[9px] text-v2-ink-subtle mt-1">
                  Target = sum of each team member's (policies/yr × avg premium)
                  • Projected = current submission rate extrapolated to year-end
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
