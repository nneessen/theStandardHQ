// src/features/agent-roadmap/components/user/RoadmapRunnerPage.tsx
//
// Main agent view. Loads the roadmap tree + user progress, computes stats,
// and renders the section accordions + item cards. Auto-expands the first
// unfinished item in the first unfinished section so agents always have
// something to click on first load.

import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, MapIcon, Sparkles, Trophy } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  useRoadmapTree,
  useRoadmapProgress,
  computeRoadmapStats,
} from "../../index";
import type {
  RoadmapItemProgressRow,
  RoadmapProgressMap,
} from "../../types/roadmap";
import { RoadmapProgressHeader } from "./RoadmapProgressHeader";
import { RoadmapSectionAccordion } from "./RoadmapSectionAccordion";

// Stable empty-map reference so the Accordion's progress prop doesn't
// churn identity on every render when progress is still loading.
const EMPTY_PROGRESS: RoadmapProgressMap = new globalThis.Map<
  string,
  RoadmapItemProgressRow
>();

interface RoadmapRunnerPageProps {
  roadmapId: string;
}

export function RoadmapRunnerPage({ roadmapId }: RoadmapRunnerPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const {
    data: roadmap,
    isLoading: treeLoading,
    error: treeError,
  } = useRoadmapTree(roadmapId);
  const { data: progressMap, isLoading: progressLoading } = useRoadmapProgress(
    userId,
    roadmapId,
  );

  const stats = useMemo(
    () => computeRoadmapStats(roadmap, progressMap),
    [roadmap, progressMap],
  );

  // Find the first section that has unfinished items — we only auto-expand
  // the first item in that one section to avoid opening every item at once.
  const firstUnfinishedSectionId = useMemo(() => {
    if (!roadmap || !progressMap) return null;
    for (const section of roadmap.sections) {
      const hasUnfinished = section.items.some((item) => {
        if (!item.is_published) return false;
        const p = progressMap.get(item.id);
        return !p || p.status === "not_started" || p.status === "in_progress";
      });
      if (hasUnfinished) return section.id;
    }
    return null;
  }, [roadmap, progressMap]);

  if (treeLoading || progressLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (treeError || !roadmap) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Empty className="py-16 border-2 border-dashed border-border rounded-xl bg-card shadow-sm">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MapIcon className="h-6 w-6 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>Roadmap not found</EmptyTitle>
            <EmptyDescription>
              This roadmap may have been unpublished or deleted.
            </EmptyDescription>
          </EmptyHeader>
          <div className="mt-4">
            <Button
              onClick={() => navigate({ to: "/agent-roadmap" })}
              variant="outline"
              size="sm"
            >
              Back to roadmaps
            </Button>
          </div>
        </Empty>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Authenticating…
      </div>
    );
  }

  const visibleSections = roadmap.sections.filter((s) =>
    s.items.some((i) => i.is_published),
  );

  const allDone = stats.requiredTotal > 0 && stats.percent === 100;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5">
      {/* Constrained center column — not full width */}
      <div className="max-w-4xl mx-auto w-full flex flex-col flex-1 min-h-0 space-y-2.5">
        <RoadmapProgressHeader roadmap={roadmap} stats={stats} />

        {allDone && (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                <Trophy className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Roadmap complete
                  </span>
                  <Sparkles className="h-3 w-3 text-emerald-500" />
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  All required items done. Your progress is visible to your
                  manager.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto space-y-3">
          {visibleSections.length === 0 ? (
            <Empty className="py-16 border-2 border-dashed border-border rounded-xl bg-card shadow-sm">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MapIcon className="h-6 w-6 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle>This roadmap is still being built</EmptyTitle>
                <EmptyDescription>
                  Check back soon — content is on the way.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            visibleSections.map((section) => (
              <RoadmapSectionAccordion
                key={section.id}
                section={section}
                roadmapId={roadmap.id}
                progress={progressMap ?? EMPTY_PROGRESS}
                userId={userId}
                autoExpandInProgress={section.id === firstUnfinishedSectionId}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
