// src/hooks/policies/usePersistencyCohorts.ts

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";

/**
 * Anniversary-cohort persistency for one milestone.
 *
 * - `bucketMonths`  — the milestone (3, 6, 9 or 12).
 * - `cohortSize`    — issued policies whose tenure is in the [N, N+3) month band
 *                     (active + lapsed + cancelled; pending/expired excluded).
 * - `activeCount`   — of that cohort, how many are still active.
 * - `persistencyRate` — activeCount / cohortSize × 100, or `null` when the
 *                     cohort is empty (no policies old enough yet).
 */
export interface PersistencyCohort {
  bucketMonths: number;
  cohortSize: number;
  activeCount: number;
  persistencyRate: number | null;
}

/**
 * Per-user persistency at the 3 / 6 / 9 / 12-month anniversaries.
 *
 * Persistency is a core insurance KPI (the share of issued business that stays
 * in force). Because the data has no lapse-date, each milestone is measured as
 * an age-bounded cohort: of policies that have reached ~N months of tenure, what
 * fraction is still active. Always returns exactly four rows (3/6/9/12), even
 * when a cohort is empty, so the UI layout is stable.
 */
export const usePersistencyCohorts = () => {
  return useQuery({
    queryKey: ["persistency", "cohorts"],
    queryFn: async (): Promise<PersistencyCohort[]> => {
      const { data, error } = await supabase.rpc(
        "get_user_persistency_cohorts",
      );
      if (error) throw error;

      type CohortRow = {
        bucket_months: number | null;
        cohort_size: number | null;
        active_count: number | null;
        persistency_rate: number | null;
      };

      return ((data ?? []) as CohortRow[]).map((row) => ({
        bucketMonths: Number(row.bucket_months),
        cohortSize: Number(row.cohort_size ?? 0),
        activeCount: Number(row.active_count ?? 0),
        persistencyRate:
          row.persistency_rate == null ? null : Number(row.persistency_rate),
      }));
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};
