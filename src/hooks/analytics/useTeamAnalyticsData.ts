// src/hooks/analytics/useTeamAnalyticsData.ts

import { useQuery } from "@tanstack/react-query";
import { useMyDownlines } from "../hierarchy/useMyDownlines";
import { useCurrentUserProfile } from "../admin";
import { teamAnalyticsService } from "../../services/analytics/teamAnalyticsService";
import type {
  TeamAnalyticsRawData,
  AgentPerformanceData,
  AgentSegmentationSummary,
  TeamPaceMetrics,
  TeamPolicyStatusBreakdown,
  TeamGeographicBreakdown,
  TeamCarrierBreakdown,
  UseTeamAnalyticsDataOptions,
} from "../../types/team-analytics.types";

/**
 * Query key factory for team analytics
 */
export const teamAnalyticsKeys = {
  all: ["team-analytics"] as const,
  data: (userIds: string[], startDate?: string, endDate?: string) =>
    [
      ...teamAnalyticsKeys.all,
      "data",
      userIds.sort().join(","),
      startDate,
      endDate,
    ] as const,
};

/**
 * Hook result interface
 */
export interface UseTeamAnalyticsDataResult {
  // Loading states
  isLoading: boolean;
  isError: boolean;
  error: Error | null;

  // Raw data
  rawData: TeamAnalyticsRawData | undefined;

  // Computed metrics
  agentMetrics: AgentPerformanceData[];
  agentSegmentation: AgentSegmentationSummary | null;
  teamPace: TeamPaceMetrics | null;
  policyStatus: TeamPolicyStatusBreakdown | null;
  geographicBreakdown: TeamGeographicBreakdown[];
  carrierBreakdown: TeamCarrierBreakdown[];

  // Team user IDs (useful for debugging)
  teamUserIds: string[];
}

/**
 * Centralized team analytics data hook
 *
 * Fetches and computes all team analytics metrics from a single RPC call.
 * Uses TanStack Query for caching and automatic refetching.
 *
 * @param options - Date range and enabled state
 * @returns Comprehensive team analytics data object
 */
export function useTeamAnalyticsData(
  options?: UseTeamAnalyticsDataOptions,
): UseTeamAnalyticsDataResult {
  const {
    startDate: startDateOption,
    endDate: endDateOption,
    enabled = true,
    teamUserIds: providedTeamUserIds,
  } = options || {};

  // Get current user and their downlines (only if teamUserIds not provided)
  const { data: currentUser, isLoading: userLoading } = useCurrentUserProfile();
  const { data: downlines = [], isLoading: downlinesLoading } = useMyDownlines({
    enabled: !providedTeamUserIds, // Skip if teamUserIds provided externally
  });

  // Build team user IDs array (use provided IDs or build from current user + downlines)
  const teamUserIds = (() => {
    // If teamUserIds provided externally, use them directly
    if (providedTeamUserIds && providedTeamUserIds.length > 0) {
      return providedTeamUserIds;
    }
    // Otherwise build from current user + downlines
    if (!currentUser) return [];
    const ids = [currentUser.id];
    downlines.forEach((d) => {
      if (!ids.includes(d.id)) {
        ids.push(d.id);
      }
    });
    return ids;
  })();

  // Default date range if not provided (current month)
  const now = new Date();
  const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultEndDate = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  const startDate = startDateOption || defaultStartDate;
  const endDate = endDateOption || defaultEndDate;

  // Query for raw team analytics data
  const {
    data: rawData,
    isLoading: dataLoading,
    isError,
    error,
  } = useQuery({
    queryKey: teamAnalyticsKeys.data(
      teamUserIds,
      startDate.toISOString(),
      endDate.toISOString(),
    ),
    queryFn: () =>
      teamAnalyticsService.getTeamAnalyticsData(
        teamUserIds,
        startDate,
        endDate,
      ),
    enabled:
      enabled &&
      teamUserIds.length > 0 &&
      (providedTeamUserIds ? true : !userLoading && !downlinesLoading),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 20 * 60 * 1000, // 20 minutes garbage collection
  });

  // Calculate derived metrics
  const agentMetrics = rawData
    ? teamAnalyticsService.calculateAgentPerformance(rawData)
    : [];

  const agentSegmentation = rawData
    ? teamAnalyticsService.segmentAgents(agentMetrics)
    : null;

  // Determine time period label
  const getTimePeriodLabel = () => {
    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (daysDiff <= 31) return "monthly";
    if (daysDiff <= 92) return "quarterly";
    return "yearly";
  };

  const teamPace = rawData
    ? teamAnalyticsService.calculateTeamPace(
        rawData,
        startDate,
        endDate,
        getTimePeriodLabel(),
      )
    : null;

  const policyStatus = rawData
    ? teamAnalyticsService.calculatePolicyStatusBreakdown(rawData)
    : null;

  const geographicBreakdown = rawData
    ? teamAnalyticsService.calculateGeographicBreakdown(rawData)
    : [];

  const carrierBreakdown = rawData
    ? teamAnalyticsService.calculateCarrierBreakdown(rawData)
    : [];

  // Loading state: skip downlinesLoading if we have providedTeamUserIds
  const isLoading = providedTeamUserIds
    ? dataLoading
    : userLoading || downlinesLoading || dataLoading;

  return {
    isLoading,
    isError,
    error: error as Error | null,
    rawData,
    agentMetrics,
    agentSegmentation,
    teamPace,
    policyStatus,
    geographicBreakdown,
    carrierBreakdown,
    teamUserIds,
  };
}

export type { UseTeamAnalyticsDataOptions };
