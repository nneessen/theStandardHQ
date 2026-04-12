// src/features/agent-roadmap/hooks/useTeamCrossRoadmapOverview.ts
import { useQuery } from "@tanstack/react-query";
import { roadmapProgressService } from "../services/roadmapProgressService";
import { roadmapKeys } from "./queryKeys";

/**
 * Super-admin: cross-roadmap progress for every agent in the agency.
 * Powers the team owner dashboard that shows agent × roadmap matrix.
 */
export function useTeamCrossRoadmapOverview(
  agencyId: string | null | undefined,
) {
  return useQuery({
    queryKey: agencyId
      ? [...roadmapKeys.all, "team-cross", agencyId]
      : ["agent-roadmap", "team-cross", "none"],
    queryFn: () => {
      if (!agencyId) return [];
      return roadmapProgressService.getTeamCrossRoadmapOverview(agencyId);
    },
    enabled: !!agencyId,
    staleTime: 1000 * 30,
  });
}
