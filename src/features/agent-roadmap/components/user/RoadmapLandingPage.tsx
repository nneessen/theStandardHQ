// src/features/agent-roadmap/components/user/RoadmapLandingPage.tsx
//
// Agent-facing entry point. This is often the FIRST page a new agent sees
// after logging in. It must:
//   1. Welcome them and explain what this page is
//   2. Guide them on what to do (start with ★, check items off, etc.)
//   3. Show professional-looking roadmap cards with clear progress
//   4. Be self-explanatory for non-technical users

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
  BookOpen,
  ListChecks,
  Eye,
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

  // Match the admin-defined order exactly. The list query already returns
  // roadmaps in `is_default DESC, sort_order ASC, created_at ASC` — the
  // same order the admin sees in the Manage Roadmaps page. Agents should
  // see the roadmaps in the order Nick arranged them, not reshuffled by
  // completion status.
  const sortedRoadmaps = visibleRoadmaps;

  // Stats for the header
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
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5">
      {/* ── Header bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Agent Roadmap
          </h1>
        </div>
        {stats && (
          <div className="flex items-center gap-3 text-[11px]">
            {stats.completed > 0 && (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span className="font-medium">{stats.completed}</span>
                <span className="text-zinc-500 dark:text-zinc-400">done</span>
              </div>
            )}
            {stats.inProgress > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-blue-500" />
                <span className="font-medium">{stats.inProgress}</span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  in progress
                </span>
              </div>
            )}
            {stats.notStarted > 0 && (
              <div className="flex items-center gap-1">
                <Circle className="h-3 w-3 text-zinc-400" />
                <span className="font-medium">{stats.notStarted}</span>
                <span className="text-zinc-500 dark:text-zinc-400">to do</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Welcome / guide section for new agents ─────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              Welcome to your onboarding roadmap
            </h2>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed mb-2.5">
              These are step-by-step checklists built by your manager to help
              you get set up. Work through them at your own pace — your progress
              saves automatically and is visible to your team lead.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px]">
              <div className="flex items-center gap-1.5">
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
                  <Star className="h-2.5 w-2.5 fill-current" />
                </div>
                <span className="text-zinc-700 dark:text-zinc-300">
                  Start with the <strong>★ marked</strong> roadmap first
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                </div>
                <span className="text-zinc-700 dark:text-zinc-300">
                  Check off each step as you complete it
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                  <Eye className="h-2.5 w-2.5" />
                </div>
                <span className="text-zinc-700 dark:text-zinc-300">
                  Your manager can see your progress
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Roadmap cards ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-32 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : visibleRoadmaps.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ListChecks className="h-5 w-5 text-zinc-400" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {sortedRoadmaps.map((rm, idx) => (
              <RoadmapCard
                key={rm.id}
                roadmap={rm}
                summary={summaries?.get(rm.id)}
                index={idx + 1}
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
// Roadmap course card
// ============================================================================

interface RoadmapCardProps {
  roadmap: RoadmapTemplateRow;
  summary?: RoadmapProgressSummary;
  index: number;
  onClick: () => void;
}

function RoadmapCard({ roadmap, summary, index, onClick }: RoadmapCardProps) {
  const percent = summary?.percent ?? 0;
  const isComplete = summary?.status === "completed";
  const isInProgress = summary?.status === "in_progress";
  const hasItems = summary && summary.totalItems > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left rounded-lg border overflow-hidden transition-all hover:border-zinc-300 dark:hover:border-zinc-600 ${
        roadmap.is_default
          ? "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ring-1 ring-amber-200 dark:ring-amber-800"
          : isComplete
            ? "border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900"
            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
      }`}
    >
      {/* Top color strip — visual identity for each card */}
      <div
        className={`h-1.5 w-full ${
          isComplete
            ? "bg-emerald-500"
            : isInProgress
              ? "bg-blue-500"
              : roadmap.is_default
                ? "bg-amber-400"
                : "bg-zinc-200 dark:bg-zinc-700"
        }`}
      />

      <div className="px-4 py-3">
        {/* Row 1: number + badges */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
            {index}
          </span>
          {roadmap.is_default && (
            <Badge variant="warning" size="sm" className="gap-0.5 text-[10px]">
              <Star className="h-2.5 w-2.5 fill-current" />
              START HERE
            </Badge>
          )}
          {isComplete && (
            <Badge variant="success" size="sm" className="gap-0.5 text-[10px]">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Complete
            </Badge>
          )}
          {isInProgress && !isComplete && (
            <Badge variant="info" size="sm" className="text-[10px]">
              In progress
            </Badge>
          )}
        </div>

        {/* Row 2: title */}
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug mb-0.5 group-hover:underline underline-offset-2">
          {roadmap.title}
        </h3>

        {/* Row 3: description */}
        {roadmap.description && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-2">
            {roadmap.description}
          </p>
        )}

        {/* Row 4: progress */}
        {hasItems ? (
          <div className="space-y-1.5">
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
              <span>{summary!.totalItems} items</span>
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
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">
            Coming soon
          </p>
        )}
      </div>

      {/* Bottom action hint */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800">
        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
          {isComplete
            ? "Review completed items"
            : isInProgress
              ? "Continue where you left off"
              : "Click to get started"}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  );
}
