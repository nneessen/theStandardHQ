import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { LeaderboardTimePeriod } from "@/types/leaderboard.types";

/**
 * Caller-scoped production + pipeline rollup for the command-center "Production"
 * panel and its expanded detail view.
 *
 * Backed by the get_command_center_summary RPC, which scopes every metric to the
 * caller (auth.uid()) rather than the whole IMO:
 *   - "personal" -> only the caller's own book
 *   - "team"     -> the caller + their entire downline subtree (hierarchy_path)
 *
 * AP / IP / policies honor the selected period's date range; prospects (attributed
 * by recruiter_id) and leads-scored (lead_heat_scores.user_id) are current-pipeline
 * snapshots. Metrics use a flat user_id-set membership, so each policy/lead is
 * counted once (no nested-leader double-count).
 */
export type ProductionScope = "personal" | "team";

export interface CommandCenterSummary {
  totalAp: number;
  totalIp: number;
  totalPolicies: number;
  totalProspects: number;
  totalLeadsScored: number;
}

const EMPTY: CommandCenterSummary = {
  totalAp: 0,
  totalIp: 0,
  totalPolicies: 0,
  totalProspects: 0,
  totalLeadsScored: 0,
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

export function useCommandCenterSummary(
  scope: ProductionScope = "team",
  period: LeaderboardTimePeriod = "mtd",
  enabled = true,
) {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  return useQuery<CommandCenterSummary, Error>({
    queryKey: ["command-center-summary", userId, scope, period],
    enabled: enabled && !!userId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    // Hold the prior scope/period's values during the swap fetch so the tiles
    // ease to the new numbers instead of flashing 0 (an uncached key would
    // otherwise return undefined -> every Stat renders `?? 0` mid-flight).
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { start, end } = periodRange(period);
      const { data, error } = await supabase.rpc("get_command_center_summary", {
        p_start_date: start,
        p_end_date: end,
        p_scope: scope,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return EMPTY;
      return {
        totalAp: Number(row.total_ap) || 0,
        totalIp: Number(row.total_ip) || 0,
        totalPolicies: Number(row.total_policies) || 0,
        totalProspects: Number(row.total_prospects) || 0,
        totalLeadsScored: Number(row.total_leads_scored) || 0,
      };
    },
  });
}
