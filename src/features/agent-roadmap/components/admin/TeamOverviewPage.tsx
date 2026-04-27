// src/features/agent-roadmap/components/admin/TeamOverviewPage.tsx
//
// Cross-roadmap team dashboard — shows every agent's progress across
// all published roadmaps. Agents who need the most help sort to the top.

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

  const publishedRoadmaps = useMemo(
    () => (roadmaps ?? []).filter((r) => r.is_published),
    [roadmaps],
  );

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
    return { total, allDone, stuck, avgPercent: Math.round(avgPercent) };
  }, [overview]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5">
      {/* ── Header bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 bg-v2-card rounded-lg px-3 py-2 border border-v2-ring dark:border-v2-ring">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={() => navigate({ to: "/agent-roadmap" })}
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-v2-ink dark:text-v2-ink" />
          <h1 className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
            Team Progress
          </h1>
          <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle hidden sm:inline">
            All agents across all roadmaps
          </span>
        </div>

        <div className="flex-1" />

        {stats && (
          <div className="flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1">
              <span className="font-medium text-v2-ink dark:text-v2-ink">
                {stats.total}
              </span>
              <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                agents
              </span>
            </div>
            <div className="h-3 w-px bg-v2-ring dark:bg-v2-ring-strong" />
            <div className="flex items-center gap-1">
              <span className="font-medium text-v2-ink dark:text-v2-ink">
                {stats.avgPercent}%
              </span>
              <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                avg
              </span>
            </div>
            {stats.allDone > 0 && (
              <>
                <div className="h-3 w-px bg-v2-ring dark:bg-v2-ring-strong" />
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  <span className="font-medium">{stats.allDone}</span>
                  <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                    done
                  </span>
                </div>
              </>
            )}
            {stats.stuck > 0 && (
              <>
                <div className="h-3 w-px bg-v2-ring dark:bg-v2-ring-strong" />
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  <span className="font-medium">{stats.stuck}</span>
                  <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                    stuck
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-1.5">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-14 rounded-lg bg-v2-card border border-v2-ring dark:border-v2-ring animate-pulse"
              />
            ))}
          </div>
        ) : !overview || overview.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users className="h-5 w-5 text-v2-ink-subtle" />
                </EmptyMedia>
                <EmptyTitle>No agent activity yet</EmptyTitle>
                <EmptyDescription>
                  Once agents start working through roadmaps, their progress
                  will appear here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div className="bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring overflow-x-auto">
            <TooltipProvider delayDuration={200}>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-v2-ring dark:border-v2-ring">
                    <TableHead className="w-[200px] sticky left-0 bg-v2-card z-10 text-[10px] uppercase tracking-wider font-bold text-v2-ink-muted dark:text-v2-ink-subtle">
                      Agent
                    </TableHead>
                    <TableHead className="w-[120px] text-[10px] uppercase tracking-wider font-bold text-v2-ink-muted dark:text-v2-ink-subtle">
                      Overall
                    </TableHead>
                    {publishedRoadmaps.map((rm) => (
                      <TableHead
                        key={rm.id}
                        className="min-w-[130px] text-center"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            navigate({
                              to: "/admin/agent-roadmap/$roadmapId/team",
                              params: { roadmapId: rm.id },
                            })
                          }
                          className="text-[10px] uppercase tracking-wider font-bold text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-canvas hover:underline underline-offset-2 truncate max-w-[120px] inline-block"
                        >
                          {rm.title}
                        </button>
                      </TableHead>
                    ))}
                    <TableHead className="text-[10px] uppercase tracking-wider font-bold text-v2-ink-muted dark:text-v2-ink-subtle">
                      Last active
                    </TableHead>
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
                      <TableRow
                        key={agent.userId}
                        className="border-b border-v2-ring dark:border-v2-ring/50 hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/30"
                      >
                        <TableCell className="sticky left-0 bg-v2-card z-10">
                          <div className="text-sm font-semibold text-v2-ink dark:text-v2-ink truncate max-w-[180px]">
                            {displayName(agent)}
                          </div>
                          {agent.email && (
                            <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle truncate max-w-[180px]">
                              {agent.email}
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={agent.overallPercent}
                              className="h-1.5 w-14"
                            />
                            <span className="text-[11px] font-bold text-v2-ink dark:text-v2-ink tabular-nums w-8 text-right">
                              {agent.overallPercent}%
                            </span>
                          </div>
                        </TableCell>

                        {publishedRoadmaps.map((rm) => (
                          <TableCell key={rm.id} className="text-center">
                            <RoadmapCell summary={agent.roadmaps.get(rm.id)} />
                          </TableCell>
                        ))}

                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {agent.lastActivityAt ? (
                              <span className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                                {formatDistanceToNow(
                                  new Date(agent.lastActivityAt),
                                  { addSuffix: true },
                                )}
                              </span>
                            ) : (
                              <span className="text-[11px] text-v2-ink-subtle dark:text-v2-ink-muted">
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
    </div>
  );
}

// ============================================================================
// Per-roadmap cell
// ============================================================================

function RoadmapCell({ summary }: { summary?: RoadmapProgressSummary }) {
  if (!summary || summary.totalItems === 0) {
    return <span className="text-v2-ink-subtle dark:text-v2-ink">—</span>;
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
      ? "text-emerald-500"
      : status === "in_progress"
        ? "text-blue-500"
        : "text-v2-ink-subtle dark:text-v2-ink-muted";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex items-center gap-1.5 cursor-default">
          <StatusIcon className={`h-3.5 w-3.5 ${iconColor}`} />
          <span
            className={`text-[11px] font-semibold tabular-nums ${
              status === "completed"
                ? "text-emerald-600 dark:text-emerald-400"
                : status === "in_progress"
                  ? "text-v2-ink dark:text-v2-ink"
                  : "text-v2-ink-subtle dark:text-v2-ink-muted"
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
