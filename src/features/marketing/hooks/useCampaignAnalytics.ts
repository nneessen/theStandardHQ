import { useQuery } from "@tanstack/react-query";
import {
  getOverallMetrics,
  getCampaignMetrics,
  getRecentCampaigns,
} from "../services/marketingAnalyticsService";

export function useOverallMetrics() {
  return useQuery({
    queryKey: ["marketing-analytics", "overall"],
    queryFn: getOverallMetrics,
  });
}

export function useCampaignMetrics(campaignId: string | null) {
  return useQuery({
    queryKey: ["marketing-analytics", "campaign", campaignId],
    queryFn: () => getCampaignMetrics(campaignId!),
    enabled: !!campaignId,
  });
}

export function useRecentCampaigns(limit = 10) {
  return useQuery({
    queryKey: ["marketing-analytics", "recent", limit],
    queryFn: () => getRecentCampaigns(limit),
  });
}
