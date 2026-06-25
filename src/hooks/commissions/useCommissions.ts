// src/hooks/commissions/useCommissions.ts

import { useQuery } from "@tanstack/react-query";
import { commissionService } from "../../services/commissions/commissionService";
import { useAuth } from "../../contexts/AuthContext";

export interface UseCommissionsOptions {
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  /**
   * When set, only fetch commissions created on/after this date (server-side
   * `created_at >=`). Use it to bound the payload for consumers that only read
   * a recent window — but the passed date MUST be a superset of every window
   * the consumer's math reads, or money numbers will silently change. Cached
   * under a distinct query key so it never collides with the all-time fetch.
   */
  createdAfter?: Date;
}

/**
 * Fetch commissions for the current user using TanStack Query.
 *
 * SCOPE / SCALABILITY (assessed 2026-06-24): this loads the signed-in agent's
 * ENTIRE commission history (commissionService.getCommissionsByUser ->
 * repository.findByAgent). The analytics/KPI hooks that consume it
 * (useMetrics, useMetricsWithDateRange, useAnalyticsData, IncomeGoalTracker)
 * are genuinely row-level — they join each commission to its policy in JS for
 * by-carrier/by-product/by-state, segmentation, ROI, chargeback risk, YoY,
 * rolling 12-month trends, etc. — so they cannot be collapsed to a single
 * server-side aggregate the way the policies dashboard band was.
 *
 * Deliberately NOT optimized: the set is per-AGENT (not team/downline/org) and
 * bounded by one agent's lifetime production. Measured on prod: 254 total
 * commission rows across 8 agents, heaviest agent = 65 rows. At this scale a
 * server-side rewrite would only add risk to money math for no real benefit.
 *
 * TRIPWIRE — revisit (date-bound the fetch per-consumer to each metric's
 * required window, preserving all-time fallbacks; or build targeted RPCs) only
 * if a single agent's commission row count climbs into the low thousands
 * (~2,000+). Check with:
 *   SELECT user_id, count(*) FROM commissions GROUP BY user_id ORDER BY 2 DESC;
 *
 * @param options Optional configuration for the query
 * @returns TanStack Query result with commissions data
 */
export const useCommissions = (options?: UseCommissionsOptions) => {
  const { user } = useAuth();
  const createdAfter = options?.createdAfter;

  return useQuery({
    queryKey: createdAfter
      ? ["commissions", user?.id, "since", createdAfter.toISOString()]
      : ["commissions", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }
      // Filter by current user's ID to only show their commissions
      return createdAfter
        ? await commissionService.getCommissionsByUserSince(
            user.id,
            createdAfter,
          )
        : await commissionService.getCommissionsByUser(user.id);
    },
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes default
    gcTime: options?.gcTime ?? 10 * 60 * 1000, // 10 minutes garbage collection
    enabled: (options?.enabled ?? true) && !!user?.id,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
};
