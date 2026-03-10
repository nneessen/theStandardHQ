// src/features/underwriting/hooks/useCriteria.ts
// Query hooks for fetching underwriting criteria

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { criteriaService } from "@/services/underwriting/repositories/criteriaService";
import type { CriteriaWithRelations } from "../../types/underwriting.types";

export const criteriaQueryKeys = {
  all: ["underwriting-criteria"] as const,
  list: (imoId: string) => [...criteriaQueryKeys.all, "list", imoId] as const,
  byGuide: (guideId: string) =>
    [...criteriaQueryKeys.all, "guide", guideId] as const,
  detail: (id: string) => [...criteriaQueryKeys.all, "detail", id] as const,
};

/**
 * Fetch all criteria for the current IMO
 */
export function useCriteriaList() {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: criteriaQueryKeys.list(imoId || ""),
    queryFn: async (): Promise<CriteriaWithRelations[]> => {
      if (!imoId) throw new Error("No IMO ID available");
      return criteriaService.getCriteriaList(imoId);
    },
    enabled: !!imoId,
  });
}

/**
 * Fetch criteria for a specific guide (most recent extraction)
 */
export function useCriteriaByGuide(guideId: string | null) {
  return useQuery({
    queryKey: criteriaQueryKeys.byGuide(guideId || ""),
    queryFn: async (): Promise<CriteriaWithRelations | null> => {
      if (!guideId) return null;
      return criteriaService.getCriteriaByGuide(guideId);
    },
    enabled: !!guideId,
    // Poll while extraction is processing
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.extraction_status === "processing") {
        return 3000; // Poll every 3 seconds while processing
      }
      return false;
    },
  });
}
