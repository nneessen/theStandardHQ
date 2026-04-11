// src/features/agent-roadmap/components/user/RoadmapRunnerPage.tsx
//
// Main agent view. Loads the roadmap tree + user progress, computes stats,
// and renders the section accordions + item cards. Auto-expands the first
// unfinished item in the first unfinished section so agents always have
// something to click on first load.

import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, MapIcon } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-muted/30">
      <RoadmapProgressHeader roadmap={roadmap} stats={stats} />

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6 pb-16">
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
  );
}
