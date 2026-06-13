// src/hooks/policies/usePersistency.ts

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";

/**
 * Persistency at one milestone (an age-bounded bucket).
 *
 * - `bucketMonths`  — the milestone (3, 6, 9 or 12).
 * - `issuedCount`   — issued policies whose tenure is in the [N, N+3) month band
 *                     (active + lapsed + cancelled; pending/expired excluded).
 * - `activeCount`   — of those, how many are still active.
 * - `persistencyRate` — activeCount / issuedCount × 100, or `null` when the
 *                     bucket is empty (no policies old enough yet).
 */
export interface PersistencyBucket {
  bucketMonths: number;
  issuedCount: number;
  activeCount: number;
  persistencyRate: number | null;
}

type BucketRow = {
  bucket_months: number | null;
  issued_count: number | null;
  active_count: number | null;
  persistency_rate: number | null;
};

function mapBuckets(data: unknown): PersistencyBucket[] {
  return ((data ?? []) as BucketRow[]).map((row) => ({
    bucketMonths: Number(row.bucket_months),
    issuedCount: Number(row.issued_count ?? 0),
    activeCount: Number(row.active_count ?? 0),
    persistencyRate:
      row.persistency_rate == null ? null : Number(row.persistency_rate),
  }));
}

/**
 * Per-user persistency at the 3 / 6 / 9 / 12-month anniversaries.
 *
 * Persistency is a core insurance KPI (the share of issued business that stays
 * in force). Because the data has no lapse-date, each milestone is measured as
 * an age-bounded bucket: of policies that have reached ~N months of tenure, what
 * fraction is still active. Always returns exactly four rows (3/6/9/12), even
 * when a bucket is empty, so the UI layout is stable.
 */
export const usePersistency = () => {
  return useQuery({
    queryKey: ["persistency", "buckets", "me"],
    queryFn: async (): Promise<PersistencyBucket[]> => {
      const { data, error } = await supabase.rpc(
        "get_user_persistency_buckets",
      );
      if (error) throw error;
      return mapBuckets(data);
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

/**
 * Team-wide persistency — the caller's own book PLUS their downline.
 *
 * Powers the Analytics page (a manager wants the whole team's retention). The
 * backing RPC `get_team_persistency_buckets()` is SECURITY INVOKER, so the
 * existing `policies` row-level security (own + downline + IMO) decides exactly
 * which policies are counted — there is no separate team-membership logic here.
 * For a solo agent with no downline this returns the same numbers as
 * {@link usePersistency}.
 */
export const useTeamPersistency = () => {
  return useQuery({
    queryKey: ["persistency", "buckets", "team"],
    queryFn: async (): Promise<PersistencyBucket[]> => {
      const { data, error } = await supabase.rpc(
        "get_team_persistency_buckets",
      );
      if (error) throw error;
      return mapBuckets(data);
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};
