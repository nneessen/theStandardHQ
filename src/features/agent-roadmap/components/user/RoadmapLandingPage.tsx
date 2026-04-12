// src/features/agent-roadmap/components/user/RoadmapLandingPage.tsx
//
// Agent-facing entry point. Compact 2-column layout matching the app's
// standard page pattern (Dashboard, My Training): horizontal header bar
// with stats on the right, dense grid of cards with progress.

import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Star,
  ChevronRight,
  Compass,
  Loader2,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/contexts/ImoContext";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useRoadmapList } from "../../index";
import { useRoadmapProgressSummaries } from "../../hooks/useRoadmapProgressSummaries";
import type {
  RoadmapTemplateRow,
  RoadmapProgressSummary,
} from "../../types/roadmap";

export function RoadmapLandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { agency } = useImo();

  const agencyId = agency?.id ?? null;
  const userId = user?.id ?? null;
  const { data: roadmaps, isLoading: roadmapsLoading } =
    useRoadmapList(agencyId);
  const { data: summaries, isLoading: summariesLoading } =
    useRoadmapProgressSummaries(userId);

  const isLoading = roadmapsLoading || summariesLoading;

  const visibleRoadmaps = useMemo(
    () => (roadmaps ?? []).filter((r) => r.is_published),
    [roadmaps],
  );

  // Sort: ★ default first, then in-progress (most recent first), then
  // not-started, then completed at the bottom.
  const sortedRoadmaps = useMemo(() => {
    return [...visibleRoadmaps].sort((a, b) => {
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;

      const sa = summaries?.get(a.id);
      const sb = summaries?.get(b.id);
      const statusOrder: Record<string, number> = {
        in_progress: 0,
        not_started: 1,
        completed: 2,
      };
      const aOrder = statusOrder[sa?.status ?? "not_started"] ?? 1;
      const bOrder = statusOrder[sb?.status ?? "not_started"] ?? 1;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.sort_order - b.sort_order;
    });
  }, [visibleRoadmaps, summaries]);

  // Compact overall stats for the header bar
  const stats = useMemo(() => {
    if (!summaries || summaries.size === 0) return null;
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    for (const s of summaries.values()) {
      if (s.status === "completed") completed += 1;
      else if (s.status === "in_progress") inProgress += 1;
      else notStarted += 1;
    }
    return { completed, inProgress, notStarted };
  }, [summaries]);

  if (!agencyId) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500 dark:text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5">
      {/* ── Header bar ───────────────────��─────────────────────────── */}
      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Agent Roadmap
          </h1>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 hidden sm:inline">
            Work through these at your own pace
          </span>
        </div>

        {stats && (
          <div className="flex items-center gap-3 text-[11px]">
            {stats.completed > 0 && (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-success" />
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {stats.completed}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">done</span>
              </div>
            )}
            {stats.inProgress > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-info" />
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {stats.inProgress}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  in progress
                </span>
              </div>
            )}
            {stats.notStarted > 0 && (
              <div className="flex items-center gap-1">
                <Circle className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {stats.notStarted}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">to do</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Content grid ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-24 rounded-lg bg-card border border-border animate-pulse"
              />
            ))}
          </div>
        ) : visibleRoadmaps.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Compass className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                </EmptyMedia>
                <EmptyTitle>No roadmaps yet</EmptyTitle>
                <EmptyDescription>
                  Your onboarding roadmap hasn't been set up yet. Check back
                  soon.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-2.5">
            {sortedRoadmaps.map((rm) => (
              <RoadmapCard
                key={rm.id}
                roadmap={rm}
                summary={summaries?.get(rm.id)}
                onClick={() =>
                  navigate({
                    to: "/agent-roadmap/$roadmapId",
                    params: { roadmapId: rm.id },
                  })
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Roadmap card — compact, matches app density
// ============================================================================

interface RoadmapCardProps {
  roadmap: RoadmapTemplateRow;
  summary?: RoadmapProgressSummary;
  onClick: () => void;
}

function RoadmapCard({ roadmap, summary, onClick }: RoadmapCardProps) {
  const percent = summary?.percent ?? 0;
  const isComplete = summary?.status === "completed";
  const isInProgress = summary?.status === "in_progress";
  const hasItems = summary && summary.totalItems > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left rounded-lg border transition-all hover:border-zinc-300 dark:hover:border-zinc-600 ${
        roadmap.is_default
          ? "border-l-4 border-l-amber-400 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
          : isComplete
            ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
      }`}
    >
      <div className="px-4 py-3">
        {/* Row 1: badges + title + chevron */}
        <div className="flex items-center gap-2 mb-1">
          {roadmap.is_default && (
            <Badge variant="warning" size="sm" className="gap-0.5 text-[10px]">
              <Star className="h-2.5 w-2.5 fill-current" />
              START
            </Badge>
          )}
          {isComplete && (
            <Badge variant="success" size="sm" className="gap-0.5 text-[10px]">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Done
            </Badge>
          )}
          {isInProgress && !isComplete && (
            <Badge variant="info" size="sm" className="text-[10px]">
              In progress
            </Badge>
          )}
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate flex-1 group-hover:underline underline-offset-2">
            {roadmap.title}
          </span>
          {isComplete ? (
            <Sparkles className="h-3.5 w-3.5 text-success shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400 shrink-0 group-hover:text-zinc-900 dark:text-zinc-100 group-hover:translate-x-0.5 transition-all" />
          )}
        </div>

        {/* Row 2: description (if any) */}
        {roadmap.description && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mb-1.5">
            {roadmap.description}
          </p>
        )}

        {/* Row 3: progress bar + stats */}
        {hasItems ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Progress value={percent} className="h-1.5 flex-1" />
              <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 tabular-nums w-8 text-right">
                {percent}%
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-zinc-500 dark:text-zinc-400">
              <span>
                {summary!.requiredDone}/{summary!.requiredTotal} required
              </span>
              {summary!.optionalTotal > 0 && (
                <span>
                  {summary!.optionalDone}/{summary!.optionalTotal} bonus
                </span>
              )}
              {summary!.lastActivityAt && (
                <span className="ml-auto">
                  {formatDistanceToNow(new Date(summary!.lastActivityAt), {
                    addSuffix: true,
                  })}
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic">
            Still being built — check back soon
          </p>
        )}
      </div>
    </button>
  );
}
