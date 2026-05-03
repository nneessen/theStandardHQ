// src/features/agent-roadmap/components/user/RoadmapLandingPage.tsx
//
// Agent-facing entry. Often the FIRST page a new agent sees after login.
// Redesigned for clarity:
//   1. Hero with overall progress at a glance
//   2. Welcome guide that auto-collapses once they've started
//   3. Featured (start-here) roadmap gets its own prominent treatment
//   4. Remaining roadmaps as a clean stacked list (not a cramped grid)

import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Star,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Clock,
  ListChecks,
  Eye,
  Sparkles,
  ArrowRight,
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

  // Overall progress aggregate.
  const overall = useMemo(() => {
    if (!summaries || summaries.size === 0 || visibleRoadmaps.length === 0) {
      return {
        completed: 0,
        inProgress: 0,
        notStarted: visibleRoadmaps.length,
        total: visibleRoadmaps.length,
        percent: 0,
      };
    }
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let totalPct = 0;
    for (const r of visibleRoadmaps) {
      const s = summaries.get(r.id);
      if (s?.status === "completed") completed += 1;
      else if (s?.status === "in_progress") inProgress += 1;
      else notStarted += 1;
      totalPct += s?.percent ?? 0;
    }
    const total = visibleRoadmaps.length;
    return {
      completed,
      inProgress,
      notStarted,
      total,
      percent: total > 0 ? Math.round(totalPct / total) : 0,
    };
  }, [summaries, visibleRoadmaps]);

  // Default/featured roadmap gets pulled out for prominent treatment.
  const featured = useMemo(
    () => visibleRoadmaps.find((r) => r.is_default) ?? null,
    [visibleRoadmaps],
  );
  const others = useMemo(
    () =>
      featured
        ? visibleRoadmaps.filter((r) => r.id !== featured.id)
        : visibleRoadmaps,
    [visibleRoadmaps, featured],
  );

  // Show welcome message only if the agent hasn't really started.
  const isNewAgent = overall.completed === 0 && overall.inProgress === 0;

  if (!agencyId) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-v2-canvas">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <header className="space-y-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-eyebrow">Onboarding</span>
            {overall.total > 0 && (
              <span className="text-eyebrow text-foreground/50">
                · {overall.completed} of {overall.total} complete
              </span>
            )}
          </div>
          <h1
            className="text-page-title text-3xl sm:text-4xl text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Your Roadmap
          </h1>
          {overall.total > 0 && (
            <div className="space-y-1.5 max-w-md">
              <Progress value={overall.percent} className="h-2" />
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono tabular-nums font-semibold text-foreground">
                  {overall.percent}%
                </span>
                <div className="flex items-center gap-3 text-muted-foreground">
                  {overall.inProgress > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-info" />
                      {overall.inProgress} active
                    </span>
                  )}
                  {overall.completed > 0 && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-success" />
                      {overall.completed} done
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </header>

        {/* ── Welcome guide (only for first-timers) ───────────────── */}
        {isNewAgent && !isLoading && visibleRoadmaps.length > 0 && (
          <section className="bg-card border border-border border-l-4 border-l-accent-strong rounded-md p-4 sm:p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-1">
                    Welcome — start here
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    These step-by-step guides were built by your team to help
                    you get set up. Work at your own pace — your progress saves
                    automatically and your manager can see how you're doing.
                  </p>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                  <li className="flex items-center gap-1.5">
                    <Star className="h-3 w-3 fill-warning text-warning shrink-0" />
                    <span className="text-foreground/80">
                      Begin with the <strong>marked</strong> roadmap
                    </span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                    <span className="text-foreground/80">
                      Check items off as you finish
                    </span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Eye className="h-3 w-3 text-info shrink-0" />
                    <span className="text-foreground/80">
                      Your manager sees progress
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* ── Loading state ────────────────────────────────────────── */}
        {isLoading && (
          <div className="space-y-3">
            <div className="h-44 rounded-md bg-card border border-border animate-pulse" />
            <div className="h-24 rounded-md bg-card border border-border animate-pulse" />
            <div className="h-24 rounded-md bg-card border border-border animate-pulse" />
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────── */}
        {!isLoading && visibleRoadmaps.length === 0 && (
          <div className="bg-card border border-border rounded-md py-16">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ListChecks className="h-5 w-5 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle>No roadmaps yet</EmptyTitle>
                <EmptyDescription>
                  Your onboarding roadmap hasn't been set up yet. Check back
                  soon.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}

        {/* ── Featured (start-here) roadmap ───────────────────────── */}
        {!isLoading && featured && (
          <FeaturedRoadmapCard
            roadmap={featured}
            summary={summaries?.get(featured.id)}
            onClick={() =>
              navigate({
                to: "/agent-roadmap/$roadmapId",
                params: { roadmapId: featured.id },
              })
            }
          />
        )}

        {/* ── Remaining roadmaps as a stacked list ────────────────── */}
        {!isLoading && others.length > 0 && (
          <section className="space-y-2">
            {featured && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-eyebrow">Continue exploring</span>
                <span className="flex-1 h-px bg-border" />
              </div>
            )}
            <ol className="space-y-2">
              {others.map((rm, idx) => (
                <RoadmapListItem
                  key={rm.id}
                  roadmap={rm}
                  summary={summaries?.get(rm.id)}
                  index={featured ? idx + 2 : idx + 1}
                  onClick={() =>
                    navigate({
                      to: "/agent-roadmap/$roadmapId",
                      params: { roadmapId: rm.id },
                    })
                  }
                />
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Featured (start-here / default) roadmap — large prominent card
// ============================================================================

interface FeaturedRoadmapCardProps {
  roadmap: RoadmapTemplateRow;
  summary?: RoadmapProgressSummary;
  onClick: () => void;
}

function FeaturedRoadmapCard({
  roadmap,
  summary,
  onClick,
}: FeaturedRoadmapCardProps) {
  const percent = summary?.percent ?? 0;
  const isComplete = summary?.status === "completed";
  const isInProgress = summary?.status === "in_progress";
  const hasItems = summary && summary.totalItems > 0;
  const hasStarted = isComplete || isInProgress;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group block w-full text-left bg-card border border-border rounded-md shadow-sm hover:shadow-md hover:border-foreground/20 transition-all overflow-hidden"
    >
      {/* Top accent strip — adventure yellow signals "start here" */}
      <div className="h-1 w-full bg-accent" />

      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground shadow-sm">
            <Star className="h-5 w-5 fill-current" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-eyebrow">Start here</span>
              {isComplete && (
                <Badge
                  variant="success"
                  size="sm"
                  className="gap-1 text-[10px]"
                >
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Complete
                </Badge>
              )}
              {isInProgress && (
                <Badge variant="info" size="sm" className="text-[10px]">
                  In progress
                </Badge>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight tracking-tight">
              {roadmap.title}
            </h2>
            {roadmap.description && (
              <p className="text-sm text-muted-foreground leading-relaxed mt-1.5 max-w-2xl">
                {roadmap.description}
              </p>
            )}
          </div>
        </div>

        {hasItems ? (
          <div className="space-y-3">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Progress value={percent} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    <span className="font-mono tabular-nums font-semibold text-foreground">
                      {summary!.requiredDone}
                    </span>{" "}
                    of {summary!.requiredTotal} required
                  </span>
                  <span className="font-mono tabular-nums">
                    {summary!.totalItems} items total
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono tabular-nums text-2xl font-bold text-foreground leading-none">
                  {percent}%
                </div>
              </div>
            </div>
            {summary!.lastActivityAt && (
              <div className="text-xs text-muted-foreground">
                Last activity{" "}
                {formatDistanceToNow(new Date(summary!.lastActivityAt), {
                  addSuffix: true,
                })}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Coming soon</p>
        )}

        <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            {isComplete
              ? "Review your completed checklist"
              : hasStarted
                ? "Continue where you left off"
                : "Open this roadmap to get started"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground group-hover:gap-2 transition-all">
            {hasStarted ? "Continue" : "Begin"}
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Other roadmaps — compact list rows (1-column, scannable)
// ============================================================================

interface RoadmapListItemProps {
  roadmap: RoadmapTemplateRow;
  summary?: RoadmapProgressSummary;
  index: number;
  onClick: () => void;
}

function RoadmapListItem({
  roadmap,
  summary,
  index,
  onClick,
}: RoadmapListItemProps) {
  const percent = summary?.percent ?? 0;
  const isComplete = summary?.status === "completed";
  const isInProgress = summary?.status === "in_progress";
  const hasItems = summary && summary.totalItems > 0;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group block w-full text-left bg-card border border-border rounded-md hover:border-foreground/20 hover:shadow-sm transition-all"
      >
        <div className="flex items-stretch">
          {/* Index column with status indicator strip */}
          <div className="flex flex-col items-center justify-center w-12 sm:w-14 shrink-0 border-r border-border bg-muted/30">
            <span className="font-mono tabular-nums text-base font-bold text-foreground/70">
              {String(index).padStart(2, "0")}
            </span>
            {isComplete && (
              <CheckCircle2 className="h-3 w-3 text-success mt-1" />
            )}
            {isInProgress && <Clock className="h-3 w-3 text-info mt-1" />}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:underline underline-offset-2">
                    {roadmap.title}
                  </h3>
                  {isComplete && (
                    <Badge
                      variant="success"
                      size="sm"
                      className="gap-1 text-[10px]"
                    >
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
                {roadmap.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                    {roadmap.description}
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 group-hover:text-foreground transition-all mt-0.5" />
            </div>

            {/* Progress row */}
            {hasItems ? (
              <div className="flex items-center gap-3 mt-2.5">
                <Progress value={percent} className="h-1 flex-1" />
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0">
                  <span className="font-mono tabular-nums font-semibold text-foreground/80 w-9 text-right">
                    {percent}%
                  </span>
                  <span className="hidden sm:inline">
                    {summary!.requiredDone}/{summary!.requiredTotal}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic mt-2">
                Coming soon
              </p>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}
