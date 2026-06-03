// src/hooks/leaderboard/useLeaderboard.ts
// TanStack Query hooks for fetching leaderboard data

import { useQuery } from "@tanstack/react-query";
import { leaderboardService } from "../../services/leaderboard";
import { leaderboardKeys } from "./leaderboardKeys";
import type {
  LeaderboardFilters,
  AgentLeaderboardResponse,
  AgencyLeaderboardResponse,
  TeamLeaderboardResponse,
  SubmitLeaderboardResponse,
} from "../../types/leaderboard.types";

interface UseLeaderboardOptions {
  filters: LeaderboardFilters;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
}

export const useAgentLeaderboard = (options: UseLeaderboardOptions) => {
  const {
    filters,
    enabled = true,
    staleTime = 60_000,
    gcTime = 5 * 60_000,
  } = options;

  return useQuery<AgentLeaderboardResponse, Error>({
    queryKey: leaderboardKeys.agents(filters),
    queryFn: () => leaderboardService.getAgentLeaderboard(filters),
    staleTime,
    gcTime,
    enabled,
  });
};

/**
 * Hook to fetch agency leaderboard data (agencies ranked as units)
 */
export const useAgencyLeaderboard = (options: UseLeaderboardOptions) => {
  const {
    filters,
    enabled = true,
    staleTime = 60_000,
    gcTime = 5 * 60_000,
  } = options;

  return useQuery<AgencyLeaderboardResponse, Error>({
    queryKey: leaderboardKeys.agencies(filters),
    queryFn: () => leaderboardService.getAgencyLeaderboard(filters),
    staleTime,
    gcTime,
    enabled,
  });
};

/**
 * Hook to fetch team leaderboard data (teams ranked as units)
 */
export const useTeamLeaderboard = (options: UseLeaderboardOptions) => {
  const {
    filters,
    enabled = true,
    staleTime = 60_000,
    gcTime = 5 * 60_000,
  } = options;

  return useQuery<TeamLeaderboardResponse, Error>({
    queryKey: leaderboardKeys.teams(filters),
    queryFn: () => leaderboardService.getTeamLeaderboard(filters),
    staleTime,
    gcTime,
    enabled,
  });
};

/**
 * Hook to fetch submit leaderboard data (rankings by AP for submitted policies)
 */
export const useSubmitLeaderboard = (options: UseLeaderboardOptions) => {
  const {
    filters,
    enabled = true,
    staleTime = 60_000,
    gcTime = 5 * 60_000,
  } = options;

  return useQuery<SubmitLeaderboardResponse, Error>({
    queryKey: leaderboardKeys.submit(filters),
    queryFn: () => leaderboardService.getSubmitLeaderboard(filters),
    staleTime,
    gcTime,
    enabled,
  });
};

/**
 * Combined hook that fetches the appropriate leaderboard based on scope
 * Returns a unified interface regardless of the scope type
 */
export const useLeaderboard = (options: UseLeaderboardOptions) => {
  const { filters, enabled = true, staleTime, gcTime } = options;
  const { scope } = filters;

  // Ensure only one query runs based on scope
  const agentQuery = useAgentLeaderboard({
    filters,
    enabled: enabled && scope === "all",
    staleTime,
    gcTime,
  });

  const agencyQuery = useAgencyLeaderboard({
    filters,
    enabled: enabled && scope === "agency",
    staleTime,
    gcTime,
  });

  const teamQuery = useTeamLeaderboard({
    filters,
    enabled: enabled && scope === "team",
    staleTime,
    gcTime,
  });

  const submitQuery = useSubmitLeaderboard({
    filters,
    enabled: enabled && scope === "submit",
    staleTime,
    gcTime,
  });

  // Return the active query based on scope
  if (scope === "submit") {
    return {
      ...submitQuery,
      scope: "submit" as const,
    };
  }

  if (scope === "agency") {
    return {
      ...agencyQuery,
      scope: "agency" as const,
    };
  }

  if (scope === "team") {
    return {
      ...teamQuery,
      scope: "team" as const,
    };
  }

  return {
    ...agentQuery,
    scope: "all" as const,
  };
};
