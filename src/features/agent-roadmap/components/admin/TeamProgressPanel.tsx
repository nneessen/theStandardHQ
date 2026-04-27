// src/features/agent-roadmap/components/admin/TeamProgressPanel.tsx
//
// Per-roadmap team progress view. Shows every agent that has touched
// this specific roadmap with their completion %, counters, and activity.

import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  Circle,
  SkipForward,
  AlertTriangle,
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
import { useRoadmapTree, useTeamProgressOverview } from "../../index";
import type { RoadmapTeamProgressRow } from "../../types/roadmap";

const STUCK_THRESHOLD_HOURS = 72;

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

  const summary = useMemo(() => {
    if (!overview || overview.length === 0) return null;
    const avg =
      overview.reduce((sum, r) => sum + r.percent, 0) / overview.length;
    const completed = overview.filter((r) => r.percent === 100).length;
    const stuck = overview.filter((r) => {
      if (!r.last_activity_at || r.percent === 100) return false;
      const hours =
        (Date.now() - new Date(r.last_activity_at).getTime()) /
        (1000 * 60 * 60);
      return hours > STUCK_THRESHOLD_HOURS;
    }).length;
    return {
      avg: Math.round(avg),
      completed,
      stuck,
      total: overview.length,
    };
  }, [overview]);

  const isLoading = treeLoading || overviewLoading;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5">
      {/* ── Header bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 bg-v2-card rounded-lg px-3 py-2 border border-v2-ring dark:border-v2-ring">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={() =>
            navigate({
              to: "/admin/agent-roadmap/$roadmapId",
              params: { roadmapId },
            })
          }
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-v2-ink dark:text-v2-ink" />
          <h1 className="text-sm font-semibold text-v2-ink dark:text-v2-ink truncate">
            {roadmap ? roadmap.title : "Team Progress"}
          </h1>
          <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle hidden sm:inline">
            per-agent progress
          </span>
        </div>

        <div className="flex-1" />

        {summary && (
          <div className="flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1">
              <span className="font-medium text-v2-ink dark:text-v2-ink">
                {summary.total}
              </span>
              <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                agents
              </span>
            </div>
            <div className="h-3 w-px bg-v2-ring dark:bg-v2-ring-strong" />
            <div className="flex items-center gap-1">
              <span className="font-medium text-v2-ink dark:text-v2-ink">
                {summary.avg}%
              </span>
              <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                avg
              </span>
            </div>
            {summary.completed > 0 && (
              <>
                <div className="h-3 w-px bg-v2-ring dark:bg-v2-ring-strong" />
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  <span className="font-medium">{summary.completed}</span>
                  <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                    done
                  </span>
                </div>
              </>
            )}
            {summary.stuck > 0 && (
              <>
                <div className="h-3 w-px bg-v2-ring dark:bg-v2-ring-strong" />
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  <span className="font-medium">{summary.stuck}</span>
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
        ) : sortedRows.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users className="h-5 w-5 text-v2-ink-subtle" />
                </EmptyMedia>
                <EmptyTitle>No agent activity yet</EmptyTitle>
                <EmptyDescription>
                  As soon as agents start this roadmap their progress will show
                  up here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div className="bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-v2-ring dark:border-v2-ring">
                  <TableHead className="w-[30%] text-[10px] uppercase tracking-wider font-bold text-v2-ink-muted dark:text-v2-ink-subtle">
                    Agent
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-v2-ink-muted dark:text-v2-ink-subtle">
                    Progress
                  </TableHead>
                  <TableHead className="text-right text-[10px] uppercase tracking-wider font-bold text-v2-ink-muted dark:text-v2-ink-subtle">
                    Done
                  </TableHead>
                  <TableHead className="text-right text-[10px] uppercase tracking-wider font-bold text-v2-ink-muted dark:text-v2-ink-subtle">
                    Active
                  </TableHead>
                  <TableHead className="text-right text-[10px] uppercase tracking-wider font-bold text-v2-ink-muted dark:text-v2-ink-subtle">
                    Skipped
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-v2-ink-muted dark:text-v2-ink-subtle">
                    Last active
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((row) => {
                  const isStuck =
                    row.last_activity_at &&
                    row.percent < 100 &&
                    (Date.now() - new Date(row.last_activity_at).getTime()) /
                      (1000 * 60 * 60) >
                      STUCK_THRESHOLD_HOURS;
                  return (
                    <TableRow
                      key={row.user_id}
                      className="border-b border-v2-ring dark:border-v2-ring/50 hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/30"
                    >
                      <TableCell>
                        <div className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
                          {displayName(row)}
                        </div>
                        {row.user_email && (
                          <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle truncate">
                            {row.user_email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <Progress
                            value={row.percent}
                            className="h-1.5 flex-1"
                          />
                          <span className="text-[11px] font-bold text-v2-ink dark:text-v2-ink tabular-nums w-8 text-right">
                            {row.percent}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span className="font-medium text-v2-ink dark:text-v2-ink">
                            {row.completed_count}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                          <Circle className="h-3 w-3" />
                          {row.in_progress_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                          <SkipForward className="h-3 w-3" />
                          {row.skipped_count}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.last_activity_at ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                              {formatDistanceToNow(
                                new Date(row.last_activity_at),
                                { addSuffix: true },
                              )}
                            </span>
                            {isStuck && (
                              <Badge variant="warning" size="sm">
                                Stuck
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-v2-ink-subtle dark:text-v2-ink-muted">
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
          <div className="mt-2 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating…
          </div>
        )}
      </div>
    </div>
  );
}
