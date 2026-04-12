// src/features/agent-roadmap/components/admin/TeamOverviewPage.tsx
//
// Super-admin cross-roadmap team dashboard. Shows every agent in the agency
// with their progress across all published roadmaps — the "manage and check
// on all my agents" view Nick asked for.
//
// Each agent row shows: name, email, overall %, and a mini progress cell
// per roadmap. Sorted by lowest overall % first so agents who need the
// most attention float to the top.

import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  Clock,
  Circle,
  AlertTriangle,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useImo } from "@/contexts/ImoContext";
import { useRoadmapList } from "../../index";
import { useTeamCrossRoadmapOverview } from "../../hooks/useTeamCrossRoadmapOverview";
import type { RoadmapProgressSummary } from "../../types/roadmap";

const STUCK_THRESHOLD_HOURS = 72;

function displayName(row: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}): string {
  const first = row.firstName?.trim() ?? "";
  const last = row.lastName?.trim() ?? "";
  const full = [first, last].filter(Boolean).join(" ");
  return full || row.email || "Unknown";
}

export function TeamOverviewPage() {
  const navigate = useNavigate();
  const { agency } = useImo();
  const agencyId = agency?.id ?? null;

  const { data: roadmaps, isLoading: roadmapsLoading } =
    useRoadmapList(agencyId);
  const { data: overview, isLoading: overviewLoading } =
    useTeamCrossRoadmapOverview(agencyId);

  const isLoading = roadmapsLoading || overviewLoading;

  // Published roadmaps in display order (for table columns)
  const publishedRoadmaps = useMemo(
    () => (roadmaps ?? []).filter((r) => r.is_published),
    [roadmaps],
  );

  // Summary stats
  const stats = useMemo(() => {
    if (!overview || overview.length === 0) return null;
    const total = overview.length;
    const allDone = overview.filter((a) => a.overallPercent === 100).length;
    const stuck = overview.filter((a) => {
      if (!a.lastActivityAt || a.overallPercent === 100) return false;
      const hours =
        (Date.now() - new Date(a.lastActivityAt).getTime()) / (1000 * 60 * 60);
      return hours > STUCK_THRESHOLD_HOURS;
    }).length;
    const avgPercent =
      overview.reduce((sum, a) => sum + a.overallPercent, 0) / total;
    return {
      total,
      allDone,
      stuck,
      avgPercent: Math.round(avgPercent),
    };
  }, [overview]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0"
          onClick={() => navigate({ to: "/admin/agent-roadmap" })}
          aria-label="Back to roadmap list"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Team Progress Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Every agent's progress across all published roadmaps. Agents who
            need the most attention sort to the top.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      {!isLoading && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Agents"
            value={stats.total.toString()}
            icon={Users}
          />
          <StatCard
            label="Average progress"
            value={`${stats.avgPercent}%`}
            accent={stats.avgPercent >= 80 ? "success" : undefined}
          />
          <StatCard
            label="All done"
            value={stats.allDone.toString()}
            accent="success"
            icon={CheckCircle2}
          />
          <StatCard
            label={`Stuck (${STUCK_THRESHOLD_HOURS}h+ inactive)`}
            value={stats.stuck.toString()}
            accent={stats.stuck > 0 ? "warning" : undefined}
            icon={AlertTriangle}
          />
        </div>
      )}

      {/* Matrix table */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !overview || overview.length === 0 ? (
        <Empty className="py-16 border-2 border-dashed border-border rounded-xl bg-card shadow-sm">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users className="h-6 w-6 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>No agent activity yet</EmptyTitle>
            <EmptyDescription>
              Once agents start working through roadmaps, their progress will
              appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
          <TooltipProvider delayDuration={200}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] sticky left-0 bg-card z-10">
                    Agent
                  </TableHead>
                  <TableHead className="w-[120px]">Overall</TableHead>
                  {publishedRoadmaps.map((rm) => (
                    <TableHead
                      key={rm.id}
                      className="min-w-[140px] text-center"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          navigate({
                            to: "/admin/agent-roadmap/$roadmapId/team",
                            params: { roadmapId: rm.id },
                          })
                        }
                        className="text-xs font-semibold hover:underline underline-offset-2 truncate max-w-[130px] inline-block"
                      >
                        {rm.title}
                      </button>
                    </TableHead>
                  ))}
                  <TableHead>Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.map((agent) => {
                  const isStuck =
                    agent.lastActivityAt &&
                    agent.overallPercent < 100 &&
                    (Date.now() - new Date(agent.lastActivityAt).getTime()) /
                      (1000 * 60 * 60) >
                      STUCK_THRESHOLD_HOURS;

                  return (
                    <TableRow key={agent.userId}>
                      {/* Agent name */}
                      <TableCell className="sticky left-0 bg-card z-10">
                        <div className="text-sm font-semibold text-foreground truncate max-w-[180px]">
                          {displayName(agent)}
                        </div>
                        {agent.email && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                            {agent.email}
                          </div>
                        )}
                      </TableCell>

                      {/* Overall % */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={agent.overallPercent}
                            className="h-2 w-16"
                          />
                          <span className="text-xs font-bold text-foreground tabular-nums w-8 text-right">
                            {agent.overallPercent}%
                          </span>
                        </div>
                      </TableCell>

                      {/* Per-roadmap cells */}
                      {publishedRoadmaps.map((rm) => {
                        const summary = agent.roadmaps.get(rm.id);
                        return (
                          <TableCell key={rm.id} className="text-center">
                            <RoadmapCell summary={summary} />
                          </TableCell>
                        );
                      })}

                      {/* Last activity */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {agent.lastActivityAt ? (
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(
                                new Date(agent.lastActivityAt),
                                { addSuffix: true },
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">
                              Never
                            </span>
                          )}
                          {isStuck && (
                            <Badge variant="warning" size="sm">
                              Stuck
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Per-roadmap cell in the matrix
// ============================================================================

function RoadmapCell({ summary }: { summary?: RoadmapProgressSummary }) {
  if (!summary || summary.totalItems === 0) {
    return <span className="text-muted-foreground/40">—</span>;
  }

  const { percent, status, requiredDone, requiredTotal } = summary;

  const StatusIcon =
    status === "completed"
      ? CheckCircle2
      : status === "in_progress"
        ? Clock
        : Circle;

  const iconColor =
    status === "completed"
      ? "text-success"
      : status === "in_progress"
        ? "text-info"
        : "text-muted-foreground/40";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex items-center gap-1.5 cursor-default">
          <StatusIcon className={`h-3.5 w-3.5 ${iconColor}`} />
          <span
            className={`text-xs font-semibold tabular-nums ${
              status === "completed"
                ? "text-success"
                : status === "in_progress"
                  ? "text-foreground"
                  : "text-muted-foreground"
            }`}
          >
            {percent}%
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {requiredDone} of {requiredTotal} required items done
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Stat card
// ============================================================================

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "success" | "warning";
}) {
  const accentClasses = {
    success: "text-success",
    warning: "text-warning",
  };
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div
        className={`text-2xl font-bold ${
          accent ? accentClasses[accent] : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
