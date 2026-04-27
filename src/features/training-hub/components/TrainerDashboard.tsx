// src/features/training-hub/components/TrainerDashboard.tsx
// Comprehensive dashboard for trainers and contracting managers
// Matches DashboardHome styling and structure

import { useState, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Users,
  Mail,
  GraduationCap,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  UserPlus,
  TrendingDown,
  FileCheck,
  Send,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow, format, subDays, startOfMonth } from "date-fns";
import { useContractStats } from "@/features/contracting";
import { cn } from "@/lib/utils";
import { hasStaffRole } from "@/constants/roles";
import { AgencyPipelineOverview } from "./AgencyPipelineOverview";

// Types
interface RecruitStats {
  total: number;
  active: number;
  completedThisMonth: number;
  completedTotal: number;
  dropped: number;
  needsAttention: number;
  byPhase: Record<string, number>;
  avgDaysToComplete: number;
  prospects: number; // Un-enrolled recruits (not yet in pipeline)
}

// RecentActivity interface reserved for future combined activity feed
// interface RecentActivity {
//   id: string;
//   type: "recruit" | "contract" | "message";
//   title: string;
//   subtitle: string;
//   status?: string;
//   timestamp: string;
// }

interface AlertItem {
  type: "info" | "warning" | "danger";
  title: string;
  message: string;
  condition: boolean;
}

// Time period type
type TimePeriod = "week" | "month" | "quarter";

export function TrainerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("month");
  const [periodOffset, setPeriodOffset] = useState(0);

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    if (timePeriod === "week") {
      start = subDays(now, 7 * (periodOffset + 1));
      end = subDays(now, 7 * periodOffset);
    } else if (timePeriod === "month") {
      const targetMonth = new Date(
        now.getFullYear(),
        now.getMonth() - periodOffset,
        1,
      );
      start = startOfMonth(targetMonth);
      end =
        periodOffset === 0
          ? now
          : new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    } else {
      start = subDays(now, 90 * (periodOffset + 1));
      end = subDays(now, 90 * periodOffset);
    }

    return { start, end };
  }, [timePeriod, periodOffset]);

  // Fetch recruit statistics
  // IMPORTANT: Only count recruits actively enrolled in a pipeline, NOT prospects
  const { data: recruitStats, isLoading: statsLoading } =
    useQuery<RecruitStats>({
      queryKey: ["trainer-dashboard-stats", timePeriod, periodOffset],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("user_profiles")
          .select(
            "id, onboarding_status, current_onboarding_phase, updated_at, created_at, onboarding_started_at, roles, is_admin",
          )
          .contains("roles", ["recruit"]);

        if (error) throw error;

        const now = new Date();
        const sevenDaysAgo = subDays(now, 7);
        const monthStart = startOfMonth(now);

        // First filter to actual recruits - exclude users who also have agent/admin/staff roles
        // This matches RecruitRepository.filterRecruitIds logic
        const actualRecruits = (data || []).filter((r) => {
          const roles = r.roles as string[] | null;
          const hasAgentRole =
            roles?.includes("agent") || roles?.includes("active_agent");
          const hasAdminRole = roles?.includes("admin");
          const isAdmin = r.is_admin === true;
          if (hasAgentRole || hasAdminRole || isAdmin || hasStaffRole(roles)) {
            return false;
          }
          return true;
        });

        // Separate enrolled recruits from prospects
        // A recruit is enrolled if they have onboarding_status (not 'prospect') OR onboarding_started_at
        const enrolledRecruits = actualRecruits.filter((r) => {
          // Exclude if status is 'prospect'
          if (r.onboarding_status === "prospect") {
            return false;
          }
          // Exclude if not yet enrolled (onboarding_started_at is null and status is null/empty)
          if (!r.onboarding_started_at && !r.onboarding_status) {
            return false;
          }
          return true;
        });

        // Count prospects (not yet enrolled in pipeline)
        const prospects = actualRecruits.filter((r) => {
          return (
            r.onboarding_status === "prospect" ||
            (!r.onboarding_started_at && !r.onboarding_status)
          );
        });

        // Phase breakdown - only for enrolled recruits
        const byPhase: Record<string, number> = {};
        let totalDaysToComplete = 0;
        let completedCount = 0;

        enrolledRecruits.forEach((r) => {
          const phase =
            r.current_onboarding_phase || r.onboarding_status || "not_started";
          byPhase[phase] = (byPhase[phase] || 0) + 1;

          // Calculate avg time to complete
          if (
            r.onboarding_status === "completed" &&
            r.created_at &&
            r.updated_at
          ) {
            const created = new Date(r.created_at);
            const completed = new Date(r.updated_at);
            totalDaysToComplete += Math.ceil(
              (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
            );
            completedCount++;
          }
        });

        const stats: RecruitStats = {
          total: enrolledRecruits.length,
          active: enrolledRecruits.filter(
            (r) =>
              r.onboarding_status &&
              !["completed", "dropped"].includes(r.onboarding_status),
          ).length,
          completedThisMonth: enrolledRecruits.filter(
            (r) =>
              r.onboarding_status === "completed" &&
              r.updated_at &&
              new Date(r.updated_at) >= monthStart,
          ).length,
          completedTotal: enrolledRecruits.filter(
            (r) => r.onboarding_status === "completed",
          ).length,
          dropped: enrolledRecruits.filter(
            (r) => r.onboarding_status === "dropped",
          ).length,
          needsAttention: enrolledRecruits.filter((r) => {
            if (r.updated_at && new Date(r.updated_at) < sevenDaysAgo) {
              if (
                r.onboarding_status &&
                !["completed", "dropped"].includes(r.onboarding_status)
              ) {
                return true;
              }
            }
            return false;
          }).length,
          byPhase,
          avgDaysToComplete:
            completedCount > 0
              ? Math.round(totalDaysToComplete / completedCount)
              : 0,
          prospects: prospects.length,
        };

        return stats;
      },
    });

  // Fetch contract stats
  const { data: contractStats, isLoading: contractsLoading } =
    useContractStats();

  // Fetch recent recruits (only those actively enrolled in a pipeline, not prospects)
  const { data: recentRecruits, isLoading: recruitsLoading } = useQuery({
    queryKey: ["trainer-dashboard-recent-recruits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select(
          "id, first_name, last_name, email, onboarding_status, current_onboarding_phase, updated_at",
        )
        .contains("roles", ["recruit"])
        // Exclude prospects
        .neq("onboarding_status", "prospect")
        // Must be enrolled (has onboarding_status or onboarding_started_at)
        .or("onboarding_status.not.is.null,onboarding_started_at.not.is.null")
        .order("updated_at", { ascending: false })
        .limit(8);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch recent contracts
  const { data: recentContracts, isLoading: contractsListLoading } = useQuery({
    queryKey: ["trainer-dashboard-recent-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carrier_contracts")
        .select(
          `
          id, status, writing_number, updated_at, requested_date,
          agent:user_profiles!carrier_contracts_agent_id_fkey(first_name, last_name, email),
          carrier:carriers!carrier_contracts_carrier_id_fkey(name)
        `,
        )
        .order("updated_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
  });

  // Message stats - placeholder until email_messages table is implemented
  // TODO: Implement email_messages table for tracking unread messages
  const messageStats = { unread: 0 };

  // Calculate derived metrics
  const conversionRate = useMemo(() => {
    if (!recruitStats || recruitStats.total === 0) return 0;
    return Math.round((recruitStats.completedTotal / recruitStats.total) * 100);
  }, [recruitStats]);

  const contractApprovalRate = useMemo(() => {
    if (!contractStats) return 0;
    const total = (contractStats.approved || 0) + (contractStats.rejected || 0);
    if (total === 0) return 0;
    return Math.round(((contractStats.approved || 0) / total) * 100);
  }, [contractStats]);

  // Generate alerts
  const alerts: AlertItem[] = useMemo(() => {
    const items: AlertItem[] = [];

    if (recruitStats?.needsAttention && recruitStats.needsAttention > 0) {
      items.push({
        type: "warning",
        title: "Recruits Need Attention",
        message: `${recruitStats.needsAttention} recruit${recruitStats.needsAttention > 1 ? "s" : ""} with no activity in 7+ days`,
        condition: true,
      });
    }

    if (contractStats?.pending && contractStats.pending > 5) {
      items.push({
        type: "warning",
        title: "High Pending Contracts",
        message: `${contractStats.pending} contracts waiting to be submitted`,
        condition: true,
      });
    }

    if (contractStats?.submitted && contractStats.submitted > 10) {
      items.push({
        type: "info",
        title: "Contracts Awaiting Review",
        message: `${contractStats.submitted} contracts submitted and pending approval`,
        condition: true,
      });
    }

    if (conversionRate < 50 && recruitStats && recruitStats.total > 5) {
      items.push({
        type: "danger",
        title: "Low Conversion Rate",
        message: `Only ${conversionRate}% of recruits completing onboarding`,
        condition: true,
      });
    }

    return items.filter((a) => a.condition);
  }, [recruitStats, contractStats, conversionRate]);

  // Status badge helper
  const getStatusBadgeClass = (status: string | null): string => {
    if (!status)
      return "bg-v2-card-tinted dark:bg-v2-card-tinted text-v2-ink-muted dark:text-v2-ink-subtle";
    switch (status.toLowerCase()) {
      case "completed":
      case "approved":
        return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400";
      case "dropped":
      case "rejected":
      case "terminated":
        return "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
      case "submitted":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
      case "pending":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400";
      default:
        return "bg-v2-card-tinted dark:bg-v2-card-tinted text-v2-ink-muted dark:text-v2-ink-muted";
    }
  };

  const getAlertIcon = (type: AlertItem["type"]) => {
    switch (type) {
      case "info":
        return (
          <AlertCircle className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        );
      case "warning":
        return (
          <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        );
      case "danger":
        return (
          <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400 flex-shrink-0" />
        );
    }
  };

  const getAlertTextColor = (type: AlertItem["type"]) => {
    switch (type) {
      case "info":
        return "text-blue-600 dark:text-blue-400";
      case "warning":
        return "text-amber-600 dark:text-amber-400";
      case "danger":
        return "text-red-600 dark:text-red-400";
    }
  };

  const userName = user?.first_name || "Trainer";

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-v2-card rounded-lg px-2 sm:px-3 py-2 border border-v2-ring dark:border-v2-ring">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-v2-ink dark:text-v2-ink" />
          <div>
            <h1 className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
              Welcome back, {userName}
            </h1>
            <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Training & Contracting Overview
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {/* Time Period Switcher */}
          <div className="flex items-center bg-v2-card-tinted dark:bg-v2-card-tinted rounded-md p-0.5">
            {(["week", "month", "quarter"] as TimePeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => {
                  setTimePeriod(period);
                  setPeriodOffset(0);
                }}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-medium rounded transition-colors",
                  timePeriod === period
                    ? "bg-white dark:bg-v2-ring-strong text-v2-ink dark:text-v2-ink shadow-sm"
                    : "text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-ink-subtle",
                )}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>

          {/* Period Navigator */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setPeriodOffset((p) => p + 1)}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-v2-card-tinted dark:bg-v2-card-tinted rounded text-[10px] text-v2-ink-muted dark:text-v2-ink-muted">
              <Calendar className="h-3 w-3" />
              <span>
                {format(dateRange.start, "MMM d")} -{" "}
                {format(dateRange.end, "MMM d")}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setPeriodOffset((p) => Math.max(0, p - 1))}
              disabled={periodOffset === 0}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div>
        <div className="space-y-2">
          {/* Main 3-column layout */}
          <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-[280px_1fr_280px]">
            {/* Left Column - Key Metrics */}
            <div className="bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring p-3">
              <div className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider mb-2">
                Key Metrics
              </div>
              <div className="space-y-0.5">
                {/* Recruiting Metrics */}
                <StatRow
                  label="Total Enrolled"
                  value={recruitStats?.total || 0}
                  loading={statsLoading}
                  icon={<Users className="h-3 w-3" />}
                />
                <StatRow
                  label="Active in Pipeline"
                  value={recruitStats?.active || 0}
                  loading={statsLoading}
                  icon={<Clock className="h-3 w-3" />}
                  color="text-blue-600 dark:text-blue-400"
                />
                <StatRow
                  label="Completed (MTD)"
                  value={recruitStats?.completedThisMonth || 0}
                  loading={statsLoading}
                  icon={<CheckCircle2 className="h-3 w-3" />}
                  color="text-emerald-600 dark:text-emerald-400"
                />
                <StatRow
                  label="Dropped"
                  value={recruitStats?.dropped || 0}
                  loading={statsLoading}
                  icon={<TrendingDown className="h-3 w-3" />}
                  color="text-red-600 dark:text-red-400"
                />
                <StatRow
                  label="Prospects (Not Enrolled)"
                  value={recruitStats?.prospects || 0}
                  loading={statsLoading}
                  icon={<UserPlus className="h-3 w-3" />}
                  color="text-v2-ink-muted dark:text-v2-ink-subtle"
                />

                <div className="my-2 border-t border-v2-ring dark:border-v2-ring" />

                {/* Contracting Metrics */}
                <StatRow
                  label="Contracts Pending"
                  value={contractStats?.pending || 0}
                  loading={contractsLoading}
                  icon={<Clock className="h-3 w-3" />}
                />
                <StatRow
                  label="Contracts Submitted"
                  value={contractStats?.submitted || 0}
                  loading={contractsLoading}
                  icon={<Send className="h-3 w-3" />}
                  color="text-blue-600 dark:text-blue-400"
                />
                <StatRow
                  label="Contracts Approved"
                  value={contractStats?.approved || 0}
                  loading={contractsLoading}
                  icon={<CheckCircle2 className="h-3 w-3" />}
                  color="text-emerald-600 dark:text-emerald-400"
                />
                <StatRow
                  label="Contracts Rejected"
                  value={contractStats?.rejected || 0}
                  loading={contractsLoading}
                  icon={<XCircle className="h-3 w-3" />}
                  color="text-red-600 dark:text-red-400"
                />
              </div>
            </div>

            {/* Center Column - Performance Overview */}
            <div className="bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring p-3">
              <div className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider mb-2">
                Performance Overview
              </div>

              {/* Status Banner */}
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-v2-ring dark:border-v2-ring">
                {conversionRate >= 60 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                )}
                <div className="flex-1">
                  <div
                    className={cn(
                      "text-[11px] font-semibold",
                      conversionRate >= 60
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {conversionRate >= 60
                      ? "Pipeline Healthy"
                      : "Pipeline Needs Attention"}
                  </div>
                  <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    {conversionRate}% conversion rate |{" "}
                    {recruitStats?.avgDaysToComplete || 0} avg days to complete
                  </div>
                </div>
              </div>

              {/* Performance Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-v2-ring dark:border-v2-ring">
                      <th className="text-left py-1.5 text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase">
                        Metric
                      </th>
                      <th className="text-right py-1.5 text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase">
                        Current
                      </th>
                      <th className="text-right py-1.5 text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase">
                        Target
                      </th>
                      <th className="text-center py-1.5 text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase w-8">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <PerformanceRow
                      metric="Conversion Rate"
                      current={`${conversionRate}%`}
                      target="60%"
                      status={
                        conversionRate >= 60
                          ? "hit"
                          : conversionRate >= 40
                            ? "fair"
                            : "poor"
                      }
                      loading={statsLoading}
                    />
                    <PerformanceRow
                      metric="Contract Approval"
                      current={`${contractApprovalRate}%`}
                      target="80%"
                      status={
                        contractApprovalRate >= 80
                          ? "hit"
                          : contractApprovalRate >= 60
                            ? "fair"
                            : "poor"
                      }
                      loading={contractsLoading}
                    />
                    <PerformanceRow
                      metric="Avg Days to Complete"
                      current={`${recruitStats?.avgDaysToComplete || 0}`}
                      target="30"
                      status={
                        (recruitStats?.avgDaysToComplete || 0) <= 30
                          ? "hit"
                          : (recruitStats?.avgDaysToComplete || 0) <= 45
                            ? "fair"
                            : "poor"
                      }
                      loading={statsLoading}
                    />
                    <PerformanceRow
                      metric="Needs Attention"
                      current={`${recruitStats?.needsAttention || 0}`}
                      target="0"
                      status={
                        (recruitStats?.needsAttention || 0) === 0
                          ? "hit"
                          : (recruitStats?.needsAttention || 0) <= 3
                            ? "fair"
                            : "poor"
                      }
                      loading={statsLoading}
                    />
                    <PerformanceRow
                      metric="Active Recruits"
                      current={`${recruitStats?.active || 0}`}
                      target="—"
                      status="neutral"
                      loading={statsLoading}
                    />
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column - Alerts + Quick Actions */}
            <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-1">
              {/* Alerts Panel */}
              {alerts.length > 0 && (
                <div className="bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring p-3">
                  <div className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider mb-2">
                    Alerts
                  </div>
                  <div className="space-y-2">
                    {alerts.map((alert, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 pb-2 border-b border-v2-ring dark:border-v2-ring/50 last:border-b-0 last:pb-0"
                      >
                        {getAlertIcon(alert.type)}
                        <div className="flex-1 min-w-0">
                          <div
                            className={cn(
                              "text-[11px] font-semibold",
                              getAlertTextColor(alert.type),
                            )}
                          >
                            {alert.title}
                          </div>
                          <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                            {alert.message}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions Panel */}
              <div className="bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring p-3">
                <div className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider mb-2">
                  Quick Actions
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] font-medium justify-start w-full border-v2-ring dark:border-v2-ring-strong hover:bg-v2-canvas dark:hover:bg-v2-card-tinted"
                    onClick={() => navigate({ to: "/recruiting" })}
                  >
                    <UserPlus className="h-3 w-3 mr-1.5" />
                    View Recruiting Pipeline
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] font-medium justify-start w-full border-v2-ring dark:border-v2-ring-strong hover:bg-v2-canvas dark:hover:bg-v2-card-tinted"
                    onClick={() => navigate({ to: "/contracting" })}
                  >
                    <FileCheck className="h-3 w-3 mr-1.5" />
                    Manage Contracts
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] font-medium justify-start w-full border-v2-ring dark:border-v2-ring-strong hover:bg-v2-canvas dark:hover:bg-v2-card-tinted"
                    onClick={() => navigate({ to: "/messages" })}
                  >
                    <Mail className="h-3 w-3 mr-1.5" />
                    Messages
                    {messageStats?.unread ? (
                      <Badge className="ml-auto h-4 px-1 text-[9px] bg-red-500 text-white">
                        {messageStats.unread}
                      </Badge>
                    ) : null}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] font-medium justify-start w-full border-v2-ring dark:border-v2-ring-strong hover:bg-v2-canvas dark:hover:bg-v2-card-tinted"
                    onClick={() => navigate({ to: "/training-hub" })}
                  >
                    <GraduationCap className="h-3 w-3 mr-1.5" />
                    Training Hub
                  </Button>
                </div>
              </div>

              {/* Conversion Rate Card */}
              {recruitStats && recruitStats.total > 0 && (
                <div
                  className={cn(
                    "rounded-lg p-3 text-white",
                    conversionRate >= 60
                      ? "bg-emerald-500 dark:bg-emerald-600"
                      : "bg-amber-500 dark:bg-amber-600",
                  )}
                >
                  <p className="text-[10px] font-medium opacity-80 uppercase tracking-wide">
                    Pipeline Conversion
                  </p>
                  <p className="text-2xl font-bold mt-0.5">{conversionRate}%</p>
                  <p className="text-[10px] opacity-70 mt-0.5">
                    {recruitStats.completedTotal} of {recruitStats.total}{" "}
                    recruits completed
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* KPI Grid */}
          <div className="bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring p-3">
            <div className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider mb-2">
              Detailed KPI Breakdown
            </div>
            <TooltipProvider delayDuration={200}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Recruiting Section */}
                <div>
                  <div className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide mb-2">
                    Recruiting Pipeline
                  </div>
                  <div className="space-y-1">
                    <KPIRow
                      label="Total Enrolled"
                      value={recruitStats?.total?.toString() || "0"}
                      loading={statsLoading}
                    />
                    <KPIRow
                      label="Active"
                      value={recruitStats?.active?.toString() || "0"}
                      loading={statsLoading}
                    />
                    <KPIRow
                      label="Completed (Total)"
                      value={recruitStats?.completedTotal?.toString() || "0"}
                      loading={statsLoading}
                    />
                    <KPIRow
                      label="Completed (MTD)"
                      value={
                        recruitStats?.completedThisMonth?.toString() || "0"
                      }
                      loading={statsLoading}
                    />
                    <KPIRow
                      label="Dropped"
                      value={recruitStats?.dropped?.toString() || "0"}
                      loading={statsLoading}
                    />
                    <KPIRow
                      label="Prospects"
                      value={recruitStats?.prospects?.toString() || "0"}
                      loading={statsLoading}
                    />
                    <KPIRow
                      label="Conversion Rate"
                      value={`${conversionRate}%`}
                      loading={statsLoading}
                    />
                  </div>
                </div>

                {/* Contracting Section */}
                <div className="lg:border-l lg:border-v2-ring lg:dark:border-v2-ring-strong lg:pl-4 border-t border-v2-ring dark:border-v2-ring-strong pt-4 sm:border-t-0 sm:pt-0">
                  <div className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide mb-2">
                    Carrier Contracts
                  </div>
                  <div className="space-y-1">
                    <KPIRow
                      label="Total Contracts"
                      value={contractStats?.total?.toString() || "0"}
                      loading={contractsLoading}
                    />
                    <KPIRow
                      label="Pending"
                      value={contractStats?.pending?.toString() || "0"}
                      loading={contractsLoading}
                    />
                    <KPIRow
                      label="Submitted"
                      value={contractStats?.submitted?.toString() || "0"}
                      loading={contractsLoading}
                    />
                    <KPIRow
                      label="Approved"
                      value={contractStats?.approved?.toString() || "0"}
                      loading={contractsLoading}
                    />
                    <KPIRow
                      label="Rejected"
                      value={contractStats?.rejected?.toString() || "0"}
                      loading={contractsLoading}
                    />
                    <KPIRow
                      label="Approval Rate"
                      value={`${contractApprovalRate}%`}
                      loading={contractsLoading}
                    />
                  </div>
                </div>

                {/* Activity Section */}
                <div className="lg:border-l lg:border-v2-ring lg:dark:border-v2-ring-strong lg:pl-4 border-t border-v2-ring dark:border-v2-ring-strong pt-4 lg:border-t-0 lg:pt-0 sm:col-span-2 lg:col-span-1">
                  <div className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wide mb-2">
                    Activity & Engagement
                  </div>
                  <div className="space-y-1">
                    <KPIRow
                      label="Needs Attention"
                      value={recruitStats?.needsAttention?.toString() || "0"}
                      loading={statsLoading}
                    />
                    <KPIRow
                      label="Avg Days to Complete"
                      value={recruitStats?.avgDaysToComplete?.toString() || "0"}
                      loading={statsLoading}
                    />
                    <KPIRow
                      label="Unread Messages"
                      value={messageStats?.unread?.toString() || "0"}
                      loading={false}
                    />
                    <KPIRow
                      label="Recent Updates"
                      value={recentRecruits?.length?.toString() || "0"}
                      loading={recruitsLoading}
                    />
                  </div>
                </div>
              </div>
            </TooltipProvider>
          </div>

          {/* Agency Pipeline Breakdown - Shows recruiting metrics by agency/pipeline owner */}
          <AgencyPipelineOverview />

          {/* Recent Activity Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Recent Recruits */}
            <div className="bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring">
              <div className="flex items-center justify-between px-3 py-2 border-b border-v2-ring dark:border-v2-ring">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-v2-ink-muted dark:text-v2-ink-subtle" />
                  <h2 className="text-xs font-semibold text-v2-ink dark:text-v2-ink">
                    Recent Recruits
                  </h2>
                </div>
                <Link to="/recruiting">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-canvas"
                  >
                    View All
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="divide-y divide-v2-ring dark:divide-v2-ring">
                {recruitsLoading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="px-3 py-2">
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ))
                ) : recentRecruits && recentRecruits.length > 0 ? (
                  recentRecruits.slice(0, 5).map((recruit) => {
                    const name =
                      recruit.first_name && recruit.last_name
                        ? `${recruit.first_name} ${recruit.last_name}`
                        : recruit.email;
                    const phase =
                      recruit.current_onboarding_phase ||
                      recruit.onboarding_status ||
                      "Not Started";

                    return (
                      <div
                        key={recruit.id}
                        onClick={() =>
                          navigate({
                            to: "/recruiting",
                            search: { recruitId: recruit.id },
                          })
                        }
                        className="flex items-center justify-between px-3 py-2 hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-v2-card-tinted dark:bg-v2-card-tinted flex items-center justify-center text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-v2-ink dark:text-v2-ink truncate max-w-[140px]">
                              {name}
                            </p>
                            <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle truncate max-w-[140px]">
                              {recruit.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[9px] h-5 px-1.5",
                              getStatusBadgeClass(phase),
                            )}
                          >
                            {phase.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-[9px] text-v2-ink-subtle dark:text-v2-ink-muted whitespace-nowrap">
                            {recruit.updated_at
                              ? formatDistanceToNow(
                                  new Date(recruit.updated_at),
                                  { addSuffix: true },
                                )
                              : "-"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-6 text-center">
                    <UserPlus className="h-6 w-6 text-v2-ink-subtle dark:text-v2-ink-muted mx-auto mb-1" />
                    <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                      No recruits in pipeline yet
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Contracts */}
            <div className="bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring">
              <div className="flex items-center justify-between px-3 py-2 border-b border-v2-ring dark:border-v2-ring">
                <div className="flex items-center gap-1.5">
                  <FileCheck className="h-3.5 w-3.5 text-v2-ink-muted dark:text-v2-ink-subtle" />
                  <h2 className="text-xs font-semibold text-v2-ink dark:text-v2-ink">
                    Recent Contracts
                  </h2>
                </div>
                <Link to="/contracting">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-canvas"
                  >
                    View All
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="divide-y divide-v2-ring dark:divide-v2-ring">
                {contractsListLoading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="px-3 py-2">
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ))
                ) : recentContracts && recentContracts.length > 0 ? (
                  recentContracts.map((contract) => {
                    // Supabase returns single relations, but TypeScript infers array
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const agent = contract.agent as any;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const carrier = contract.carrier as any;
                    const agentName =
                      agent?.first_name && agent?.last_name
                        ? `${agent.first_name} ${agent.last_name}`
                        : agent?.email || "Unknown";

                    return (
                      <Link
                        key={contract.id}
                        to="/contracting"
                        className="flex items-center justify-between px-3 py-2 hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-v2-card-tinted dark:bg-v2-card-tinted flex items-center justify-center text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted">
                            {agentName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-v2-ink dark:text-v2-ink truncate max-w-[140px]">
                              {agentName}
                            </p>
                            <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle truncate max-w-[140px]">
                              {carrier?.name || "Unknown Carrier"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[9px] h-5 px-1.5",
                              getStatusBadgeClass(contract.status),
                            )}
                          >
                            {contract.status}
                          </Badge>
                          <span className="text-[9px] text-v2-ink-subtle dark:text-v2-ink-muted whitespace-nowrap">
                            {contract.updated_at
                              ? formatDistanceToNow(
                                  new Date(contract.updated_at),
                                  { addSuffix: true },
                                )
                              : "-"}
                          </span>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="px-3 py-6 text-center">
                    <FileCheck className="h-6 w-6 text-v2-ink-subtle dark:text-v2-ink-muted mx-auto mb-1" />
                    <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                      No contracts yet
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components

interface StatRowProps {
  label: string;
  value: number;
  loading: boolean;
  icon: React.ReactNode;
  color?: string;
}

function StatRow({ label, value, loading, icon, color }: StatRowProps) {
  return (
    <div className="flex justify-between items-center text-[11px] hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50 rounded px-1 -mx-1 py-0.5">
      <div className="flex items-center gap-1.5 text-v2-ink-muted dark:text-v2-ink-subtle">
        {icon}
        <span>{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-4 w-8" />
      ) : (
        <span
          className={cn(
            "font-mono font-semibold",
            color || "text-v2-ink dark:text-v2-ink",
          )}
        >
          {value}
        </span>
      )}
    </div>
  );
}

interface PerformanceRowProps {
  metric: string;
  current: string;
  target: string;
  status: "hit" | "good" | "fair" | "poor" | "neutral";
  loading: boolean;
}

function PerformanceRow({
  metric,
  current,
  target,
  status,
  loading,
}: PerformanceRowProps) {
  const statusDotClass = {
    hit: "bg-emerald-500",
    good: "bg-blue-500",
    fair: "bg-amber-500",
    poor: "bg-red-500",
    neutral: "bg-zinc-400 dark:bg-zinc-500",
  }[status];

  return (
    <tr className="hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50">
      <td className="py-1.5 text-[11px] text-v2-ink dark:text-v2-ink">
        {metric}
      </td>
      <td className="py-1.5 text-right text-[11px] font-mono font-semibold text-v2-ink dark:text-v2-ink">
        {loading ? <Skeleton className="h-4 w-8 ml-auto" /> : current}
      </td>
      <td className="py-1.5 text-right text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle font-mono">
        {target}
      </td>
      <td className="py-1.5 text-center">
        <span
          className={cn(
            "inline-block w-1.5 h-1.5 rounded-full",
            statusDotClass,
          )}
        />
      </td>
    </tr>
  );
}

interface KPIRowProps {
  label: string;
  value: string;
  loading: boolean;
}

function KPIRow({ label, value, loading }: KPIRowProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex justify-between items-center text-[11px] cursor-help hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50 rounded px-1 -mx-1 py-0.5">
          <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
            {label}
          </span>
          {loading ? (
            <Skeleton className="h-4 w-8" />
          ) : (
            <span className="font-mono font-semibold text-v2-ink dark:text-v2-ink">
              {value}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs bg-zinc-900 dark:bg-v2-card-tinted border-v2-ring-strong"
      >
        <div className="space-y-1">
          <div className="text-xs font-semibold text-v2-canvas">{label}</div>
          <div className="text-[10px] text-v2-ink-subtle">
            Value: <span className="font-mono text-v2-canvas">{value}</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default TrainerDashboard;
