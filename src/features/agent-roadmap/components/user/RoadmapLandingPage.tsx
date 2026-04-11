// src/features/agent-roadmap/components/user/RoadmapLandingPage.tsx
//
// Agent-facing entry point. Shows all published roadmaps in the agent's
// agency with the default (★ START HERE) pinned at the top.
//
// Gated by RouteGuard allowedAgencyId={THE_STANDARD_AGENCY_ID} at the
// router layer, so only Standard agents land here.

import { useNavigate } from "@tanstack/react-router";
import { Star, ChevronRight, Map, Loader2 } from "lucide-react";
import { useImo } from "@/contexts/ImoContext";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoadmapList } from "../../index";

export function RoadmapLandingPage() {
  const navigate = useNavigate();
  const { agency } = useImo();

  const agencyId = agency?.id ?? null;
  const { data: roadmaps, isLoading } = useRoadmapList(agencyId);

  if (!agencyId) {
    return (
      <div className="p-6 max-w-3xl mx-auto flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  // RLS already filters to published roadmaps for non-super-admin users,
  // but belt-and-suspenders: filter client-side too in case the caller
  // is super-admin viewing their own list.
  const visibleRoadmaps = (roadmaps ?? []).filter((r) => r.is_published);
  const defaultRoadmap = visibleRoadmaps.find((r) => r.is_default);
  const otherRoadmaps = visibleRoadmaps.filter((r) => !r.is_default);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Agent Roadmap
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Work through these checklists at your own pace. Your progress saves
          automatically.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ) : visibleRoadmaps.length === 0 ? (
        <Empty className="py-16 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Map className="h-6 w-6 text-zinc-400" />
            </EmptyMedia>
            <EmptyTitle>No roadmaps yet</EmptyTitle>
            <EmptyDescription>
              Your team's onboarding roadmap hasn't been set up yet. Check back
              soon, or ask your manager.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {defaultRoadmap && (
            <RoadmapCard
              roadmap={defaultRoadmap}
              isDefault
              onClick={() =>
                navigate({
                  to: "/agent-roadmap/$roadmapId",
                  params: { roadmapId: defaultRoadmap.id },
                })
              }
            />
          )}

          {otherRoadmaps.length > 0 && (
            <>
              {defaultRoadmap && (
                <div className="pt-2 pb-1">
                  <div className="text-[10px] uppercase tracking-wide font-semibold text-zinc-500 dark:text-zinc-400">
                    Other roadmaps
                  </div>
                </div>
              )}
              {otherRoadmaps.map((roadmap) => (
                <RoadmapCard
                  key={roadmap.id}
                  roadmap={roadmap}
                  onClick={() =>
                    navigate({
                      to: "/agent-roadmap/$roadmapId",
                      params: { roadmapId: roadmap.id },
                    })
                  }
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Card component
// ============================================================================

interface RoadmapCardProps {
  roadmap: {
    id: string;
    title: string;
    description: string | null;
  };
  isDefault?: boolean;
  onClick: () => void;
}

function RoadmapCard({ roadmap, isDefault, onClick }: RoadmapCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left rounded-lg border px-5 py-4 transition-colors ${
        isDefault
          ? "border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-300 dark:hover:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40"
          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          {isDefault && (
            <Badge variant="warning" size="sm" className="gap-1 mb-1.5">
              <Star className="h-3 w-3 fill-current" />
              START HERE
            </Badge>
          )}
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-0.5">
            {roadmap.title}
          </div>
          {roadmap.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
              {roadmap.description}
            </p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-zinc-400 dark:text-zinc-500 mt-1 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors shrink-0" />
      </div>
    </button>
  );
}
