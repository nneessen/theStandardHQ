// Derives the current user's REAL leaderboard rank for the dashboard hero's
// "Rank" panel — no mock data. Reuses the cached agent-leaderboard query and
// follows whichever period the dashboard toggle has selected.
import { useMemo } from "react";
import { useAgentLeaderboard } from "@/hooks/leaderboard/useLeaderboard";
import { useAuth } from "@/contexts/AuthContext";
import type { TimePeriod } from "@/utils/dateRange";
import type { LeaderboardTimePeriod } from "@/types/leaderboard.types";

export interface MyRank {
  rank: number | null;
  name: string | null;
  total: number;
}

// Dashboard TimePeriod → leaderboard's supported period. The leaderboard has no
// distinct "monthly" window, so both monthly and MTD map to month-to-date.
const PERIOD_TO_LEADERBOARD: Record<TimePeriod, LeaderboardTimePeriod> = {
  daily: "daily",
  weekly: "weekly",
  monthly: "mtd",
  MTD: "mtd",
  yearly: "ytd",
};

export function useMyRank(timePeriod: TimePeriod, enabled = true): MyRank {
  const { user } = useAuth();
  const { data } = useAgentLeaderboard({
    filters: { timePeriod: PERIOD_TO_LEADERBOARD[timePeriod], scope: "all" },
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
