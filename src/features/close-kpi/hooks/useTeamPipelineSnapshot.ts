// src/features/close-kpi/hooks/useTeamPipelineSnapshot.ts
// TanStack Query hooks for the Close KPIs Team tab.
// Two hooks: visibility check + snapshot data fetch.

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { closeKpiKeys } from "./useCloseKpiDashboard";
import {
  fetchCanViewTeamTab,
  fetchTeamPipelineSnapshot,
} from "../services/teamPipelineService";

/**
 * Whether the current user can see the Team tab.
 * Returns true for super-admins OR users with at least one downline.
 * The RPC enforces this server-side; this hook only drives UI visibility.
 */
export function useCanViewTeamTab() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  return useQuery({
    queryKey: closeKpiKeys.teamVisibility(userId),
    queryFn: fetchCanViewTeamTab,
    enabled: !!userId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

/**
 * Aggregated pipeline snapshot for caller + downlines.
 * Gated on useCanViewTeamTab so we don't issue the larger query for users
 * who can't see the tab anyway.
 */
export function useTeamPipelineSnapshot(opts?: { targetUserIds?: string[] }) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { data: canView } = useCanViewTeamTab();
  const scope = opts?.targetUserIds ?? null;

  return useQuery({
    queryKey: closeKpiKeys.teamSnapshot(userId, scope),
    queryFn: () => fetchTeamPipelineSnapshot(opts?.targetUserIds),
    enabled: !!userId && !!canView,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}
