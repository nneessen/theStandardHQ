// src/hooks/commissions/useCommissionsByPolicyIds.ts
//
// Fetch commissions for a SPECIFIC set of policies (e.g. the visible policies
// page), instead of every commission the agent owns. Scales with page size, not
// total book size. The query factory is exported so non-reactive callers (the
// CSV/Excel export) can `queryClient.fetchQuery(...)` the same cache entry.

import { useQuery, queryOptions } from "@tanstack/react-query";
import { commissionService } from "../../services/commissions/commissionService";

/**
 * Stable query options for "commissions for these policy ids". The key sorts the
 * ids so render-order changes don't thrash the cache, and is prefixed with
 * "commissions" so the broad `["commissions"]` invalidation (used by commission
 * mutations) still matches it.
 */
export const commissionsByPolicyIdsQuery = (policyIds: string[]) =>
  queryOptions({
    queryKey: ["commissions", "by-policy-ids", [...policyIds].sort()] as const,
    queryFn: () => commissionService.getByPolicyIds(policyIds),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

export const useCommissionsByPolicyIds = (policyIds: string[]) =>
  useQuery({
    ...commissionsByPolicyIdsQuery(policyIds),
    enabled: policyIds.length > 0,
  });
