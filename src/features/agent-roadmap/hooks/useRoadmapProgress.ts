// src/features/agent-roadmap/hooks/useRoadmapProgress.ts
import { useQuery } from "@tanstack/react-query";
import { roadmapProgressService } from "../services/roadmapProgressService";
import { roadmapKeys } from "./queryKeys";

/**
 * Load per-user progress for a roadmap. Returns a Map<itemId, progress>
 * for O(1) lookups during render.
 */
export function useRoadmapProgress(
  userId: string | null | undefined,
  roadmapId: string | null | undefined,
) {
  return useQuery({
    queryKey:
      userId && roadmapId
        ? roadmapKeys.progress(userId, roadmapId)
        : ["agent-roadmap", "progress", "none"],
    queryFn: () => {
      if (!userId || !roadmapId) return new Map();
      return roadmapProgressService.getProgressForRoadmap(userId, roadmapId);
    },
    enabled: !!userId && !!roadmapId,
    staleTime: 1000 * 10,
  });
}
