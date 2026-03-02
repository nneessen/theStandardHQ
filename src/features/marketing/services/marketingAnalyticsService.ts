import { supabase } from "@/services/base/supabase";
import type { CampaignMetrics } from "../types/marketing.types";

export async function getOverallMetrics(): Promise<CampaignMetrics> {
  const { data, error } = await supabase
    .from("bulk_email_campaigns")
    .select(
      "sent_count, opened_count, clicked_count, bounced_count, failed_count",
    )
    .in("status", ["sent", "sending"]);

  if (error) throw error;

  const totals = (data || []).reduce(
    (
      acc: {
        totalSent: number;
        totalOpened: number;
        totalClicked: number;
        totalBounced: number;
      },
      c: {
        sent_count: number | null;
        opened_count: number | null;
        clicked_count: number | null;
        bounced_count: number | null;
        failed_count: number | null;
      },
    ) => ({
      totalSent: acc.totalSent + (c.sent_count || 0),
      totalOpened: acc.totalOpened + (c.opened_count || 0),
      totalClicked: acc.totalClicked + (c.clicked_count || 0),
      totalBounced: acc.totalBounced + (c.bounced_count || 0),
    }),
    { totalSent: 0, totalOpened: 0, totalClicked: 0, totalBounced: 0 },
  );

  return {
    ...totals,
    openRate:
      totals.totalSent > 0 ? (totals.totalOpened / totals.totalSent) * 100 : 0,
    clickRate:
      totals.totalSent > 0 ? (totals.totalClicked / totals.totalSent) * 100 : 0,
    bounceRate:
      totals.totalSent > 0 ? (totals.totalBounced / totals.totalSent) * 100 : 0,
  };
}

export async function getCampaignMetrics(
  campaignId: string,
): Promise<CampaignMetrics> {
  const { data, error } = await supabase
    .from("bulk_email_campaigns")
    .select(
      "sent_count, opened_count, clicked_count, bounced_count, failed_count",
    )
    .eq("id", campaignId)
    .single();

  if (error) throw error;

  const sent = data.sent_count || 0;
  const opened = data.opened_count || 0;
  const clicked = data.clicked_count || 0;
  const bounced = data.bounced_count || 0;

  return {
    totalSent: sent,
    totalOpened: opened,
    totalClicked: clicked,
    totalBounced: bounced,
    openRate: sent > 0 ? (opened / sent) * 100 : 0,
    clickRate: sent > 0 ? (clicked / sent) * 100 : 0,
    bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
  };
}

export async function getRecentCampaigns(limit = 10) {
  const { data, error } = await supabase
    .from("bulk_email_campaigns")
    .select(
      "id, name, status, campaign_type, sent_count, opened_count, clicked_count, bounced_count, created_at, completed_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
