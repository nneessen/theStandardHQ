// src/features/agent-roadmap/hooks/useRoadmapTree.ts
import { useQuery } from "@tanstack/react-query";
import { roadmapService } from "../services/roadmapService";
import { roadmapKeys } from "./queryKeys";

/**
 * Load a full roadmap tree (template + sections + items).
 * This is the primary query for the admin editor and the agent runner.
 */
export function useRoadmapTree(roadmapId: string | null | undefined) {
  return useQuery({
    queryKey: roadmapId
      ? roadmapKeys.tree(roadmapId)
      : ["agent-roadmap", "tree", "none"],
    queryFn: () => {
      if (!roadmapId) return null;
      return roadmapService.getRoadmapTree(roadmapId);
    },
    enabled: !!roadmapId,
    staleTime: 1000 * 30,
  });
}
