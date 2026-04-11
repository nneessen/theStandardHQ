// src/features/agent-roadmap/hooks/useRoadmapList.ts
import { useQuery } from "@tanstack/react-query";
import { roadmapService } from "../services/roadmapService";
import { roadmapKeys } from "./queryKeys";

/**
 * List all roadmaps visible to the current user in the given agency.
 * RLS handles visibility — agents see only published roadmaps, super-admin
 * sees everything.
 */
export function useRoadmapList(agencyId: string | null | undefined) {
  return useQuery({
    queryKey: agencyId
      ? roadmapKeys.listByAgency(agencyId)
      : ["agent-roadmap", "list", "none"],
    queryFn: () => {
      if (!agencyId) return [];
      return roadmapService.listRoadmaps(agencyId);
    },
    enabled: !!agencyId,
    staleTime: 1000 * 30,
  });
}
