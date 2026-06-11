// src/features/recruiting/hooks/useProspects.ts
// React Query hooks for the "Prospects" follow-up list.

import { useQuery } from "@tanstack/react-query";
import { prospectService } from "@/services/prospects";
import type { ProspectFilters } from "@/types/prospect.types";

export const PROSPECTS_QUERY_KEYS = {
  all: ["prospects"] as const,
  lists: () => [...PROSPECTS_QUERY_KEYS.all, "list"] as const,
  list: (filters?: ProspectFilters) =>
    [...PROSPECTS_QUERY_KEYS.lists(), { filters }] as const,
};

/**
 * List the current agent's prospects, optionally filtered.
 * Stats for the header band are derived from this list in ProspectsView.
 */
export function useProspects(filters?: ProspectFilters) {
  return useQuery({
    queryKey: PROSPECTS_QUERY_KEYS.list(filters),
    queryFn: () => prospectService.getMyProspects(filters),
  });
}
