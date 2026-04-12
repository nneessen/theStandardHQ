// src/features/agent-roadmap/components/user/RoadmapLandingPage.tsx
//
// Agent-facing entry point. Shows all published roadmaps with per-roadmap
// progress, grouped by state (in-progress first, then not-started, then
// completed). Includes an onboarding guide for first-time visitors.

import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Star,
  ChevronRight,
  MapIcon,
  Loader2,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  ListChecks,
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
import { Skeleton } from "@/components/ui/skeleton";
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

  // Published roadmaps only (RLS already filters for non-super-admin,
  // but belt-and-suspenders for super-admin viewing their own list).
  const visibleRoadmaps = useMemo(
    () => (roadmaps ?? []).filter((r) => r.is_published),
    [roadmaps],
  );

  // Group by state: default first, then in-progress, then not-started,
  // then completed. Within each group, preserve sort_order.
  const grouped = useMemo(() => {
    const defaultRm = visibleRoadmaps.find((r) => r.is_default);
    const rest = visibleRoadmaps.filter((r) => !r.is_default);

    const inProgress: RoadmapTemplateRow[] = [];
    const notStarted: RoadmapTemplateRow[] = [];
    const completed: RoadmapTemplateRow[] = [];

    for (const rm of rest) {
      const summary = summaries?.get(rm.id);
      if (!summary || summary.status === "not_started") {
        notStarted.push(rm);
      } else if (summary.status === "completed") {
        completed.push(rm);
      } else {
        inProgress.push(rm);
      }
    }

    return { defaultRm, inProgress, notStarted, completed };
  }, [visibleRoadmaps, summaries]);

  // Overall stats for the hero section
  const overallStats = useMemo(() => {
    if (!summaries || summaries.size === 0)
      return { total: 0, completed: 0, inProgress: 0 };
    let total = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    for (const s of summaries.values()) {
      total += 1;
      if (s.status === "completed") completedCount += 1;
      else if (s.status === "in_progress") inProgressCount += 1;
    }
    return { total, completed: completedCount, inProgress: inProgressCount };
  }, [summaries]);

  if (!agencyId) {
    return (
      <div className="p-6 max-w-3xl mx-auto flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ================================================================
          Hero / Onboarding Guide
          ================================================================ */}
      <div className="border-b border-border bg-card shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-start gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background shadow-sm">
              <Compass className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Your Agent Roadmap
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-xl leading-relaxed">
                These are step-by-step checklists built by your manager to help
                you get set up and productive. Work through them at your own
                pace — your progress saves automatically and is visible to your
                team lead.
              </p>

              {/* Quick-start instructions */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning mt-0.5">
                    <Star className="h-3 w-3 fill-current" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      Start with ★
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-snug">
                      The starred roadmap is your first priority
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success mt-0.5">
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      Check items off
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-snug">
                      Mark each step done as you complete it
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-info/15 text-info mt-0.5">
                    <ListChecks className="h-3 w-3" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      Track progress
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-snug">
                      Your % updates in real time across all roadmaps
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Overall stats bar — only show if there's data */}
          {!isLoading && overallStats.total > 0 && (
            <div className="mt-6 flex items-center gap-6 pt-5 border-t border-border">
              <div>
                <div className="text-2xl font-bold text-foreground tabular-nums">
                  {overallStats.total}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Total roadmaps
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-success tabular-nums">
                  {overallStats.completed}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Completed
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-info tabular-nums">
                  {overallStats.inProgress}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  In progress
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-muted-foreground tabular-nums">
                  {overallStats.total -
                    overallStats.completed -
                    overallStats.inProgress}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Not started
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================
          Roadmap cards
          ================================================================ */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : visibleRoadmaps.length === 0 ? (
          <Empty className="py-16 border-2 border-dashed border-border rounded-xl bg-card shadow-sm">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MapIcon className="h-6 w-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>No roadmaps yet</EmptyTitle>
              <EmptyDescription>
                Your team's onboarding roadmap hasn't been set up yet. Check
                back soon, or ask your manager.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {/* Default (★ START HERE) — always first */}
            {grouped.defaultRm && (
              <div>
                <RoadmapCard
                  roadmap={grouped.defaultRm}
                  summary={summaries?.get(grouped.defaultRm.id)}
                  isDefault
                  onClick={() =>
                    navigate({
                      to: "/agent-roadmap/$roadmapId",
                      params: { roadmapId: grouped.defaultRm!.id },
                    })
                  }
                />
              </div>
            )}

            {/* In progress */}
            {grouped.inProgress.length > 0 && (
              <div className="space-y-3">
                <SectionLabel
                  icon={Clock}
                  label="In progress"
                  count={grouped.inProgress.length}
                />
                {grouped.inProgress.map((rm) => (
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

            {/* Not started */}
            {grouped.notStarted.length > 0 && (
              <div className="space-y-3">
                <SectionLabel
                  icon={Circle}
                  label="Not started"
                  count={grouped.notStarted.length}
                />
                {grouped.notStarted.map((rm) => (
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

            {/* Completed */}
            {grouped.completed.length > 0 && (
              <div className="space-y-3">
                <SectionLabel
                  icon={CheckCircle2}
                  label="Completed"
                  count={grouped.completed.length}
                  accent="success"
                />
                {grouped.completed.map((rm) => (
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
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Section label
// ============================================================================

function SectionLabel({
  icon: Icon,
  label,
  count,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  accent?: "success";
}) {
  return (
    <div className="flex items-center gap-2 pb-1">
      <Icon
        className={`h-4 w-4 ${accent === "success" ? "text-success" : "text-muted-foreground"}`}
      />
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-xs font-medium text-muted-foreground/60">
        {count}
      </span>
    </div>
  );
}

// ============================================================================
// Roadmap card with progress
// ============================================================================

interface RoadmapCardProps {
  roadmap: RoadmapTemplateRow;
  summary?: RoadmapProgressSummary;
  isDefault?: boolean;
  onClick: () => void;
}

function RoadmapCard({
  roadmap,
  summary,
  isDefault,
  onClick,
}: RoadmapCardProps) {
  const percent = summary?.percent ?? 0;
  const isComplete = summary?.status === "completed";
  const isInProgress = summary?.status === "in_progress";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left rounded-xl border shadow-sm transition-all hover:shadow-md active:shadow-sm ${
        isDefault
          ? "border-l-[6px] border-l-warning border-border bg-card"
          : isComplete
            ? "border-success/30 bg-success/[0.03]"
            : "border-border bg-card hover:border-ring"
      }`}
    >
      <div className="px-6 py-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* Top: badges row */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {isDefault && (
                <Badge variant="warning" size="sm" className="gap-1 font-bold">
                  <Star className="h-3 w-3 fill-current" />
                  START HERE
                </Badge>
              )}
              {isComplete && (
                <Badge variant="success" size="sm" className="gap-1 font-bold">
                  <CheckCircle2 className="h-3 w-3" />
                  Complete
                </Badge>
              )}
              {isInProgress && !isComplete && (
                <Badge variant="info" size="sm" className="gap-1 font-bold">
                  <Clock className="h-3 w-3" />
                  In progress
                </Badge>
              )}
            </div>

            {/* Title */}
            <div className="text-lg font-bold text-foreground leading-tight mb-1 group-hover:underline underline-offset-2">
              {roadmap.title}
            </div>

            {/* Description */}
            {roadmap.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                {roadmap.description}
              </p>
            )}

            {/* Progress bar + stats */}
            {summary && summary.totalItems > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Progress value={percent} className="h-2 flex-1" />
                  <span className="text-sm font-bold text-foreground tabular-nums w-10 text-right">
                    {percent}%
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    <span className="font-semibold text-foreground">
                      {summary.requiredDone}
                    </span>{" "}
                    of {summary.requiredTotal} required
                  </span>
                  {summary.optionalTotal > 0 && (
                    <span>
                      {summary.optionalDone} of {summary.optionalTotal} bonus
                    </span>
                  )}
                  {summary.totalItems > 0 && (
                    <span>{summary.totalItems} items total</span>
                  )}
                  {summary.lastActivityAt && (
                    <span className="ml-auto">
                      Last activity{" "}
                      {formatDistanceToNow(new Date(summary.lastActivityAt), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* No items yet hint */}
            {(!summary || summary.totalItems === 0) && (
              <p className="text-xs text-muted-foreground italic mt-1">
                This roadmap is still being built — check back soon.
              </p>
            )}
          </div>

          <div className="flex flex-col items-center gap-2 shrink-0 pt-1">
            {isComplete ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success">
                <Sparkles className="h-5 w-5" />
              </div>
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
