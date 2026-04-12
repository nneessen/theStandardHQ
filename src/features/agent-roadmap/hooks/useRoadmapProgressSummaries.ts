// src/features/agent-roadmap/hooks/useRoadmapProgressSummaries.ts
import { useQuery } from "@tanstack/react-query";
import { roadmapProgressService } from "../services/roadmapProgressService";
import { roadmapKeys } from "./queryKeys";

/**
 * Per-roadmap progress summaries for the current user. Returns a
 * Map<roadmapId, RoadmapProgressSummary> for the landing page to
 * render progress bars and status badges on each card.
 *
 * This is a single query (2 DB round-trips internally) regardless of
 * how many roadmaps exist in the agency. RLS handles agency scoping.
 */
export function useRoadmapProgressSummaries(userId: string | null | undefined) {
  return useQuery({
    queryKey: userId
      ? [...roadmapKeys.all, "summaries", userId]
      : ["agent-roadmap", "summaries", "none"],
    queryFn: () => {
      if (!userId) return new Map();
      return roadmapProgressService.getProgressSummaries(userId);
    },
    enabled: !!userId,
    staleTime: 1000 * 15, // 15s — progress changes frequently but not per-keystroke
  });
}
