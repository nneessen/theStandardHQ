import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Accurate, org-wide month-to-date production rollup for the command-center
 * "Production · MTD" hero panel.
 *
 * Backed by the get_imo_production_summary RPC, which computes AP / IP / policy /
 * prospect totals in a single pass over `policies` scoped to the caller's IMO —
 * with NO team_members join. This avoids the double-counting the panel previously
 * suffered when it summed per-team-leader rows from get_team_leaderboard_data
 * (members under nested leaders were counted multiple times, inflating the totals).
 */
export interface ImoProductionSummary {
  totalAp: number;
  totalIp: number;
  totalPolicies: number;
  totalProspects: number;
}

const EMPTY: ImoProductionSummary = {
  totalAp: 0,
  totalIp: 0,
  totalPolicies: 0,
  totalProspects: 0,
};

export function useImoProductionSummary(enabled = true) {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  return useQuery<ImoProductionSummary, Error>({
    queryKey: ["imo-production-summary", userId],
    enabled: enabled && !!userId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      // Defaults (month-to-date) are applied server-side.
      const { data, error } = await supabase.rpc("get_imo_production_summary");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return EMPTY;
      return {
        totalAp: Number(row.total_ap) || 0,
        totalIp: Number(row.total_ip) || 0,
        totalPolicies: Number(row.total_policies) || 0,
        totalProspects: Number(row.total_prospects) || 0,
      };
    },
  });
}
