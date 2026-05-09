// src/hooks/targets/useAgencyPremiumStats.ts

import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../services/base/supabase";
import { useAuth } from "../../contexts/AuthContext";

export type AgencyPremiumSource =
  | "current-year"
  | "active-policies-fallback"
  | "all-policies-fallback"
  | "no-data";

export interface AgencyPremiumStats {
  /** Cohort fallback level used for the agency aggregates. */
  source: AgencyPremiumSource;
  /** Mean annual premium across the user's IMO. */
  meanPremium: number;
  /** Median annual premium across the user's IMO. */
  medianPremium: number;
  /** Number of policies that contributed to the agency aggregates. */
  policyCount: number;

  /** Personal aggregates — same fallback chain, scoped to the caller. */
  personalSource: AgencyPremiumSource;
  personalMeanPremium: number;
  personalMedianPremium: number;
  personalPolicyCount: number;
}

const DEFAULT_STATS: AgencyPremiumStats = {
  source: "no-data",
  meanPremium: 0,
  medianPremium: 0,
  policyCount: 0,
  personalSource: "no-data",
  personalMeanPremium: 0,
  personalMedianPremium: 0,
  personalPolicyCount: 0,
};

/**
 * Agency-wide policy-premium aggregates for the realistic plan calculation.
 *
 * Replaces the per-user avg-premium read so new agents and agents with
 * skewed personal books get a stable baseline from `targetsCalculationService`.
 * Personal aggregates are returned alongside for popover/comparison context.
 *
 * Cached for 1 hour — agency-level aggregates don't change minute-to-minute.
 */
export function useAgencyPremiumStats() {
  const { user } = useAuth();

  return useQuery<AgencyPremiumStats>({
    queryKey: ["agency-premium-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return DEFAULT_STATS;

      const { data, error } = await supabase.rpc("get_agency_premium_stats", {
        p_user_id: user.id,
      });

      if (error) throw error;
      const row = data?.[0];
      if (!row) return DEFAULT_STATS;

      return {
        source: row.source as AgencyPremiumSource,
        meanPremium: Number(row.mean_premium) || 0,
        medianPremium: Number(row.median_premium) || 0,
        policyCount: Number(row.policy_count) || 0,
        personalSource: row.personal_source as AgencyPremiumSource,
        personalMeanPremium: Number(row.personal_mean_premium) || 0,
        personalMedianPremium: Number(row.personal_median_premium) || 0,
        personalPolicyCount: Number(row.personal_policy_count) || 0,
      };
    },
    enabled: !!user?.id,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}
