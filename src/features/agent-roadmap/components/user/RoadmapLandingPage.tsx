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
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Agent Roadmap
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
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
        <Empty className="py-16 border-2 border-dashed border-border rounded-xl bg-card shadow-sm">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Map className="h-6 w-6 text-muted-foreground" />
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
                  <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
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
      className={`group w-full text-left rounded-xl border px-6 py-5 shadow-sm transition-all ${
        isDefault
          ? "border-l-[6px] border-l-warning border-border bg-warning/[0.04] hover:bg-warning/[0.08] hover:shadow-md"
          : "border-border bg-card hover:border-ring hover:shadow-md"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          {isDefault && (
            <Badge variant="warning" size="sm" className="gap-1 mb-2 font-bold">
              <Star className="h-3 w-3 fill-current" />
              START HERE
            </Badge>
          )}
          <div className="text-lg font-bold text-foreground leading-tight mb-1">
            {roadmap.title}
          </div>
          {roadmap.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {roadmap.description}
            </p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground mt-1 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>
    </button>
  );
}
