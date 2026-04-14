// src/features/close-lead-drop/types/lead-drop.types.ts

export interface SmartView {
  id: string;
  name: string;
  query: unknown;
}

export interface LeadPreviewItem {
  id: string;
  display_name: string;
  status_label: string | null;
  primary_email: string | null;
  primary_phone: string | null;
}

export interface LeadPreviewResponse {
  leads: LeadPreviewItem[];
  has_more: boolean;
  cursor: string | null;
  total: number | null;
}

export interface DropRecipient {
  id: string;
  full_name: string;
  email: string;
  profile_photo_url: string | null;
  organization_name: string | null;
}

export interface RecipientSequence {
  id: string;
  name: string;
  steps_count: number;
  allow_manual_enrollment: boolean;
}

export type DropJobStatus = "pending" | "running" | "completed" | "failed";

export interface DropJob {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  smart_view_id: string;
  smart_view_name: string;
  lead_source_label: string;
  sequence_id: string | null;
  sequence_name: string | null;
  status: DropJobStatus;
  total_leads: number;
  created_leads: number;
  failed_leads: number;
  recipient_smart_view_id: string | null;
  recipient_smart_view_name: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  sender?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    profile_photo_url: string | null;
  };
  recipient?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    profile_photo_url: string | null;
  };
}

export interface DropResult {
  id: string;
  job_id: string;
  source_lead_id: string;
  source_lead_name: string | null;
  dest_lead_id: string | null;
  status: "created" | "failed" | "skipped";
  error_message: string | null;
  created_at: string;
}

// Wizard step state
export type WizardStep =
  | "smart-view"
  | "preview"
  | "configure"
  | "confirm"
  | "progress"
  | "results";

export interface WizardState {
  step: WizardStep;
  // Step 1
  smartView: SmartView | null;
  // Step 2
  allLeads: LeadPreviewItem[];
  selectedLeadIds: Set<string>;
  hasMore: boolean;
  // Step 3
  recipient: DropRecipient | null;
  leadSourceLabel: string;
  sequence: RecipientSequence | null;
  // Progress / results
  jobId: string | null;
}
