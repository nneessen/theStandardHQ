// src/features/agent-roadmap/components/admin/TeamProgressPanel.tsx
//
// Super-admin team progress monitoring view.
// Shows per-user completion %, last activity, and counters for every agent
// that has touched the roadmap. Data comes from the getTeamOverview service
// which folds raw progress rows into per-user aggregates client-side.

import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Users,
  Clock,
  CheckCircle2,
  Circle,
  SkipForward,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoadmapTree, useTeamProgressOverview } from "../../index";
import type { RoadmapTeamProgressRow } from "../../types/roadmap";

interface TeamProgressPanelProps {
  roadmapId: string;
}

function displayName(row: RoadmapTeamProgressRow): string {
  const first = row.user_first_name?.trim() ?? "";
  const last = row.user_last_name?.trim() ?? "";
  const full = [first, last].filter(Boolean).join(" ");
  return full || row.user_email || "Unknown user";
}

export function TeamProgressPanel({ roadmapId }: TeamProgressPanelProps) {
  const navigate = useNavigate();
  const { data: roadmap, isLoading: treeLoading } = useRoadmapTree(roadmapId);
  const { data: overview, isLoading: overviewLoading } =
    useTeamProgressOverview(roadmapId);

  // Sort: highest percent first, then most recent activity
  const sortedRows = useMemo(() => {
    if (!overview) return [];
    return [...overview].sort((a, b) => {
      if (b.percent !== a.percent) return b.percent - a.percent;
      const aTime = a.last_activity_at
        ? new Date(a.last_activity_at).getTime()
        : 0;
      const bTime = b.last_activity_at
        ? new Date(b.last_activity_at).getTime()
        : 0;
      return bTime - aTime;
    });
  }, [overview]);

  // Summary card aggregates across the team
  const summary = useMemo(() => {
    if (!overview || overview.length === 0) return null;
    const avg =
      overview.reduce((sum, r) => sum + r.percent, 0) / overview.length;
    const completed = overview.filter((r) => r.percent === 100).length;
    const inProgress = overview.filter(
      (r) => r.percent > 0 && r.percent < 100,
    ).length;
    const stuck = overview.filter((r) => {
      if (!r.last_activity_at) return false;
      if (r.percent === 100) return false;
      const hoursSinceActivity =
        (Date.now() - new Date(r.last_activity_at).getTime()) /
        (1000 * 60 * 60);
      return hoursSinceActivity > 72; // no activity in 3+ days
    }).length;
    return {
      avg: Math.round(avg),
      completed,
      inProgress,
      stuck,
      total: overview.length,
    };
  }, [overview]);

  const isLoading = treeLoading || overviewLoading;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() =>
            navigate({
              to: "/admin/agent-roadmap/$roadmapId",
              params: { roadmapId },
            })
          }
          aria-label="Back to roadmap editor"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Team progress
          </h1>
          {roadmap && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
              {roadmap.title}
            </p>
          )}
        </div>
      </div>

      {/* Summary stats */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Agents tracked"
            value={summary.total.toString()}
            icon={Users}
          />
          <StatCard
            label="Average %"
            value={`${summary.avg}%`}
            accent={summary.avg >= 80 ? "success" : undefined}
          />
          <StatCard
            label="Completed"
            value={summary.completed.toString()}
            accent="success"
            icon={CheckCircle2}
          />
          <StatCard
            label="Stuck (3d+ inactive)"
            value={summary.stuck.toString()}
            accent={summary.stuck > 0 ? "warning" : undefined}
            icon={Clock}
          />
        </div>
      ) : null}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : sortedRows.length === 0 ? (
        <Empty className="py-16 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users className="h-6 w-6 text-zinc-400" />
            </EmptyMedia>
            <EmptyTitle>No agent activity yet</EmptyTitle>
            <EmptyDescription>
              As soon as agents start this roadmap their progress will show up
              here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Agent</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">In progress</TableHead>
                <TableHead className="text-right">Skipped</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => {
                const isStuck =
                  row.last_activity_at &&
                  row.percent < 100 &&
                  (Date.now() - new Date(row.last_activity_at).getTime()) /
                    (1000 * 60 * 60) >
                    72;
                return (
                  <TableRow key={row.user_id}>
                    <TableCell>
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {displayName(row)}
                      </div>
                      {row.user_email && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                          {row.user_email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[160px]">
                        <Progress
                          value={row.percent}
                          className="h-1.5 flex-1"
                        />
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 w-10 text-right">
                          {row.percent}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1 text-sm">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        {row.completed_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                        <Circle className="h-3 w-3" />
                        {row.in_progress_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-500">
                        <SkipForward className="h-3 w-3" />
                        {row.skipped_count}
                      </span>
                    </TableCell>
                    <TableCell>
                      {row.last_activity_at ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">
                            {formatDistanceToNow(
                              new Date(row.last_activity_at),
                              {
                                addSuffix: true,
                              },
                            )}
                          </span>
                          {isStuck && (
                            <Badge variant="warning" size="sm">
                              Stuck
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">
                          No activity
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {overviewLoading && overview && (
        <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Updating…
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Stat card
// ============================================================================

interface StatCardProps {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "success" | "warning";
}

function StatCard({ label, value, icon: Icon, accent }: StatCardProps) {
  const accentClasses = {
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div
        className={`text-2xl font-semibold ${
          accent ? accentClasses[accent] : "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
