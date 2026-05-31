// Derives the current user's REAL leaderboard rank for the dashboard hero's
// "Season Rank" panel — no mock data. Reuses the cached agent-leaderboard query.
import { useMemo } from "react";
import { useAgentLeaderboard } from "@/hooks/leaderboard/useLeaderboard";
import { useAuth } from "@/contexts/AuthContext";

export interface MyRank {
  rank: number | null;
  name: string | null;
  total: number;
}

export function useMyRank(enabled = true): MyRank {
  const { user } = useAuth();
  const { data } = useAgentLeaderboard({
    filters: { timePeriod: "mtd", scope: "all" },
    enabled,
  });

  return useMemo<MyRank>(() => {
    if (!data || !user?.id) return { rank: null, name: null, total: 0 };
    const me = data.entries.find((e) => e.agentId === user.id);
    return {
      rank: me?.rankOverall ?? null,
      name: me?.agentName ?? null,
      total: data.totals.totalEntries,
    };
  }, [data, user?.id]);
}
