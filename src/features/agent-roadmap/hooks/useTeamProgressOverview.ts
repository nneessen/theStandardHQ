// src/features/agent-roadmap/hooks/useTeamProgressOverview.ts
import { useQuery } from "@tanstack/react-query";
import { roadmapProgressService } from "../services/roadmapProgressService";
import { roadmapKeys } from "./queryKeys";

/**
 * Super-admin: aggregated team progress for a roadmap.
 * RLS ensures only super-admin can read foreign users' progress rows.
 */
export function useTeamProgressOverview(roadmapId: string | null | undefined) {
  return useQuery({
    queryKey: roadmapId
      ? roadmapKeys.teamOverview(roadmapId)
      : ["agent-roadmap", "team", "none"],
    queryFn: () => {
      if (!roadmapId) return [];
      return roadmapProgressService.getTeamOverview(roadmapId);
    },
    enabled: !!roadmapId,
    staleTime: 1000 * 30,
  });
}
