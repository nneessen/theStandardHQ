import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { LeaderboardTimePeriod } from "@/types/leaderboard.types";

/**
 * Accurate, org-wide production rollup for the command-center "Production" panel
 * and its expanded detail view.
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

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Map a time period to a [start, end] date range (period-to-date), mirroring the
 * leaderboard's calculateDateRange so the two surfaces agree.
 */
function periodRange(period: LeaderboardTimePeriod): {
  start: string;
  end: string;
} {
  const now = new Date();
  const today = iso(now);
  switch (period) {
    case "daily":
      return { start: today, end: today };
    case "weekly": {
      const daysSinceMonday = (now.getDay() + 6) % 7;
      const monday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - daysSinceMonday,
      );
      return { start: iso(monday), end: today };
    }
    case "ytd":
      return { start: iso(new Date(now.getFullYear(), 0, 1)), end: today };
    case "mtd":
    default:
      return {
        start: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: today,
      };
  }
}

export function useImoProductionSummary(
  period: LeaderboardTimePeriod = "mtd",
  enabled = true,
) {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  return useQuery<ImoProductionSummary, Error>({
    queryKey: ["imo-production-summary", userId, period],
    enabled: enabled && !!userId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      const { start, end } = periodRange(period);
      const { data, error } = await supabase.rpc("get_imo_production_summary", {
        p_start_date: start,
        p_end_date: end,
      });
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
