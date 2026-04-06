// src/features/close-kpi/hooks/useTeamCallStats.ts
//
// TanStack Query hook for the daily call monitoring view. Keyed by
// (userId, from, to) so changing the date selector triggers a fresh fetch.
// Gated on useCanViewTeamTab so non-uplines never issue the request.

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { closeKpiKeys } from "./useCloseKpiDashboard";
import { useCanViewTeamTab } from "./useTeamPipelineSnapshot";
import { fetchTeamCallStats } from "../services/teamCallStatsService";

export function useTeamCallStats(params: { from: string; to: string }) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { data: canView } = useCanViewTeamTab();

  return useQuery({
    queryKey: closeKpiKeys.teamCallStats(userId, params.from, params.to),
    queryFn: () => fetchTeamCallStats(params),
    enabled: !!userId && !!canView && !!params.from && !!params.to,
    // Calls in Close take a few seconds to propagate. 60s staleTime keeps the
    // dashboard from hammering Close API on every navigation but still feels
    // fresh when the user explicitly clicks Refresh.
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}
