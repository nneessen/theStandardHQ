import { supabase } from "@/services/base/supabase";
import type {
  MarketingCampaign,
  CampaignStatus,
} from "../types/marketing.types";

export async function getCampaigns(): Promise<MarketingCampaign[]> {
  const { data, error } = await supabase
    .from("bulk_email_campaigns")
    .select("*, marketing_audiences(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((c: any) => ({
    ...c,
    audience: c.marketing_audiences || undefined,
  }));
}

export async function getCampaign(id: string): Promise<MarketingCampaign> {
  const { data, error } = await supabase
    .from("bulk_email_campaigns")
    .select("*, marketing_audiences(*)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return {
    ...data,
    audience: data.marketing_audiences || undefined,
  } as MarketingCampaign;
}

export async function createCampaign(campaign: {
  name: string;
  subject?: string;
  campaign_type: string;
  template_id?: string;
  audience_id?: string;
  sms_content?: string;
  brand_settings?: Record<string, unknown>;
  user_id: string;
}): Promise<MarketingCampaign> {
  const { data, error } = await supabase
    .from("bulk_email_campaigns")
    .insert({
      ...campaign,
      status: "draft",
      total_recipients: 0,
      sent_count: 0,
      opened_count: 0,
      clicked_count: 0,
      bounced_count: 0,
      failed_count: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as MarketingCampaign;
}

export async function updateCampaign(
  id: string,
  updates: Partial<
    Pick<
      MarketingCampaign,
      | "name"
      | "subject"
      | "template_id"
      | "audience_id"
      | "sms_content"
      | "brand_settings"
      | "status"
      | "scheduled_for"
    >
  >,
): Promise<MarketingCampaign> {
  const { data, error } = await supabase
    .from("bulk_email_campaigns")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as MarketingCampaign;
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from("bulk_email_campaigns")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function updateCampaignStatus(
  id: string,
  status: CampaignStatus,
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "sent") updates.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from("bulk_email_campaigns")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

export async function getCampaignRecipients(campaignId: string) {
  const { data, error } = await supabase
    .from("bulk_email_recipients")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addCampaignRecipients(
  campaignId: string,
  recipients: {
    email: string;
    first_name?: string;
    last_name?: string;
    variables?: Record<string, string>;
  }[],
): Promise<void> {
  const rows = recipients.map((r) => ({
    campaign_id: campaignId,
    email_address: r.email,
    first_name: r.first_name ?? null,
    last_name: r.last_name ?? null,
    status: "pending",
    variables: r.variables || {},
  }));

  const { error } = await supabase.from("bulk_email_recipients").insert(rows);

  if (error) throw error;

  // Update total_recipients count on campaign
  const { count } = await supabase
    .from("bulk_email_recipients")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  await supabase
    .from("bulk_email_campaigns")
    .update({ total_recipients: count || 0 })
    .eq("id", campaignId);
}

export async function processBulkCampaign(
  campaignId: string,
  subject: string,
  html: string,
): Promise<{ remaining: number }> {
  const { data, error } = await supabase.functions.invoke(
    "process-bulk-campaign",
    { body: { campaign_id: campaignId, subject, html } },
  );
  if (error) throw error;
  return { remaining: data?.remaining ?? 0 };
}
