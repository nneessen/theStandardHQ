// Marketing Hub types

export type CampaignType = "email" | "sms";
export type CampaignStatus =
  | "draft"
  | "sending"
  | "sent"
  | "scheduled"
  | "paused"
  | "failed";
export type AudienceType = "dynamic" | "static" | "csv_import";
export type SourcePool = "agents" | "clients" | "leads" | "external" | "mixed";
export type ContactType = "agent" | "client" | "lead" | "external";

export interface MarketingAudience {
  id: string;
  name: string;
  description: string | null;
  audience_type: AudienceType;
  source_pool: SourcePool;
  filters: Record<string, unknown>;
  contact_count: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingAudienceMember {
  id: string;
  audience_id: string;
  contact_id: string | null;
  contact_type: ContactType;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MarketingExternalContact {
  id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  tags: string[];
  source: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingBrandSettings {
  id: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  company_name: string | null;
  footer_text: string | null;
  social_links: Record<string, string>;
  created_by: string | null;
  updated_at: string;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  subject: string | null;
  campaign_type: CampaignType;
  status: CampaignStatus;
  template_id: string | null;
  audience_id: string | null;
  sms_content: string | null;
  brand_settings: Record<string, unknown>;
  total_recipients: number;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  failed_count: number;
  scheduled_for: string | null;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  user_id: string;
  // Joined
  audience?: MarketingAudience;
}

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  email_address: string;
  contact_id: string | null;
  contact_type: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  variables: Record<string, string> | null;
  email_id: string | null;
  created_at: string | null;
}

export interface CampaignWizardState {
  step: number;
  name: string;
  campaignType: CampaignType;
  audienceId: string | null;
  templateId: string | null;
  subject: string;
  bodyHtml: string;
  smsContent: string;
  scheduledFor: Date | null;
  sendRatePerMinute: number;
}

export interface AudienceFilter {
  field: string;
  operator: "eq" | "neq" | "in" | "contains";
  value: string | string[];
}

export interface CampaignMetrics {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail: string;
  blocks: import("@/types/email.types").EmailBlock[];
}
