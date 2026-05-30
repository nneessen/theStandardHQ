// src/types/recruiting.types.ts

import type { Database } from "./database.types";
import type { DocumentStatus as DocStatus } from "./documents.types";
import type { ChecklistMetadata } from "./checklist-metadata.types";

// Re-export document types from dedicated module
export type {
  DocumentCategory,
  InsuranceDocumentType,
  DocumentStatus,
} from "./documents.types";

// Local alias for use within this file
type DocumentStatus = DocStatus;
export {
  DOCUMENT_CATEGORIES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_EXPIRATION_DEFAULTS,
  DOCUMENT_CATEGORY_ORDER,
  getCategoryForDocumentType,
  getAllDocumentTypes,
  getDocumentTypesForCategory,
  getSuggestedExpirationDate,
  isValidDocumentType,
  isValidDocumentCategory,
} from "./documents.types";

// Legacy alias for backward compatibility
export type { InsuranceDocumentType as DocumentType } from "./documents.types";

export type AgentStatus = Database["public"]["Enums"]["agent_status"];

export interface LicensingInfo {
  licenseNumber?: string;
  npn?: string; // National Producer Number
  licenseExpirationDate?: string;
  licenseState?: string;
  licenseType?: string;
  yearsLicensed?: number;
  previousCarriers?: string[];
  specializations?: string[];
}

export interface CreateRecruitInput {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  /**
   * Direct upline/manager for this recruit (canonical field).
   */
  upline_id?: string;
  /**
   * @deprecated Use upline_id instead. Kept for backward compatibility.
   */
  recruiter_id?: string;
  referral_source?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip?: string;
  date_of_birth?: string;
  // New fields for licensing status
  agent_status?: AgentStatus;
  licensing_info?: LicensingInfo;
  pipeline_template_id?: string;
  // Skip pipeline for certain roles
  skip_pipeline?: boolean;
  // Optional role override for admin/non-agent users
  roles?: string[];
  is_admin?: boolean;
  // IMO to assign recruit to (from caller's context)
  imo_id?: string;
  // Agency to assign recruit to (from caller's context)
  agency_id?: string;
  // Recruit's resident state (e.g. "CA", "TX")
  resident_state?: string;
  // Starting comp / contract level (percentage, e.g. 50, 55, 60)
  contract_level?: number;
}

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface PipelinePhase {
  id: string;
  template_id: string;
  phase_name: string;
  phase_description: string | null;
  phase_order: number;
  estimated_days: number | null;
  auto_advance: boolean;
  required_approver_role: string | null;
  is_active: boolean;
  visible_to_recruit: boolean;
}

export interface PhaseChecklistItem {
  id: string;
  phase_id: string;
  item_name: string;
  item_description: string | null;
  item_type: string;
  item_order: number;
  is_required: boolean;
  can_be_completed_by: string;
  requires_verification: boolean;
  verification_by: string | null;
  document_type?: string | null;
  external_link?: string | null;
  metadata?: ChecklistMetadata;
  is_active: boolean;
  visible_to_recruit: boolean;
}

export interface RecruitPhaseProgress {
  id: string;
  user_id: string;
  phase_id: string;
  template_id: string;
  status: "not_started" | "in_progress" | "completed" | "blocked" | "skipped";
  started_at: string | null;
  completed_at: string | null;
  blocked_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecruitChecklistProgress {
  id: string;
  user_id: string;
  checklist_item_id: string;
  status:
    | "not_started"
    | "pending"
    | "in_progress"
    | "completed"
    | "verified"
    | "approved"
    | "rejected"
    | "needs_resubmission";
  completed_at: string | null;
  completed_by: string | null;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  notes: string | null;
  document_id?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic metadata shape
  metadata?: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic response shape
  response_data?: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic completion details shape
  completion_details?: Record<string, any> | null;
}

// Type guards
export function isLicensedAgent(
  status: AgentStatus | null | undefined,
): boolean {
  return status === "licensed";
}

export function requiresPipeline(
  status: AgentStatus | null | undefined,
): boolean {
  return status === "unlicensed" || status === "licensed";
}

export function shouldSkipPipeline(
  status: AgentStatus | null | undefined,
): boolean {
  return status === "not_applicable";
}

// Terminal status colors - for completed/dropped/withdrawn states (not pipeline phases)
export const TERMINAL_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  completed: "bg-emerald-100 text-emerald-800",
  dropped: "bg-red-100 text-red-800",
  withdrawn: "bg-gray-100 text-gray-800",
  blocked: "bg-red-100 text-red-800",
  invited: "bg-amber-100 text-amber-800",
};

export const CHECKLIST_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  pending: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  verified: "bg-emerald-100 text-emerald-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  needs_resubmission: "bg-amber-100 text-amber-800",
};

// =============================================================================
// Additional Types (migrated from recruiting.ts)
// =============================================================================

// NOTE: OnboardingStatus and PhaseName are NO LONGER hardcoded types.
// Statuses come from pipeline_phases table based on the recruit's pipeline_template_id.
// Use string type and validate against the actual phases from the database.

// Terminal states that exist outside of pipeline phases
export type TerminalStatus = "active" | "completed" | "dropped" | "withdrawn";

export type PhaseStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "blocked";
export type PhaseProgressStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "blocked"
  | "skipped";
export type ChecklistItemStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "approved"
  | "rejected"
  | "needs_resubmission";
export type ChecklistItemType =
  | "document_upload"
  | "task_completion"
  | "training_module"
  | "manual_approval"
  | "automated_check"
  | "signature_required"
  | "scheduling_booking"
  | "video_embed"
  // Interactive types
  | "boolean_question"
  | "acknowledgment"
  | "text_response"
  | "multiple_choice"
  | "file_download"
  | "external_link"
  | "quiz"
  | "carrier_contracting";
export type CompletedBy = "recruit" | "upline" | "system";
export type RequiredApproverRole = "upline" | "admin" | "system";

// DocumentType and DocumentStatus are now imported from documents.types.ts
// and re-exported at the top of this file for backward compatibility
export type EmailStatus =
  | "draft"
  | "sending"
  | "sent"
  | "delivered"
  | "opened"
  | "failed";

export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "phase_changed"
  | "document_uploaded"
  | "document_approved"
  | "document_rejected"
  | "email_sent"
  | "status_changed"
  | "note_added"
  | "other";

// Entity interfaces
export interface OnboardingPhase {
  id: string;
  user_id: string;
  phase_name: string; // Dynamic - comes from pipeline_phases table
  phase_order: number;
  status: PhaseStatus;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  blocked_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserDocument {
  id: string;
  user_id: string;
  document_type: string; // Uses InsuranceDocumentType values but stored as string in DB
  document_name: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  storage_path: string;
  uploaded_by: string | null;
  uploaded_at: string;
  status: DocumentStatus;
  required: boolean;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserEmail {
  id: string;
  user_id: string;
  sender_id: string | null;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  status: EmailStatus;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  failed_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  attachments?: UserEmailAttachment[];
}

export interface UserEmailAttachment {
  id: string;
  email_id: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  storage_path: string;
  created_at: string;
}

export interface UserActivityLog {
  id: string;
  user_id: string;
  performed_by: string | null;
  action_type: ActivityAction;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface RecruitFilters {
  onboarding_status?: string[]; // Dynamic - phase names from pipeline_phases
  current_phase?: string[]; // Dynamic - phase names from pipeline_phases
  /**
   * @deprecated Use assigned_upline_id instead.
   */
  recruiter_id?: string;
  /**
   * Filter by assigned upline/manager (canonical field).
   */
  assigned_upline_id?: string;
  /**
   * Filter by IMO - for staff roles (trainer, contracting_manager)
   * to see all recruits in their IMO.
   */
  imo_id?: string;
  /**
   * Filter to show recruits where the user is either the recruiter OR the upline.
   * Uses OR logic: recruiter_id = user_id OR upline_id = user_id
   */
  my_recruits_user_id?: string;
  /**
   * Exclude prospects (recruits not enrolled in a pipeline).
   * When true, excludes users with onboarding_status = 'prospect'
   * OR onboarding_started_at = NULL.
   */
  exclude_prospects?: boolean;
  search?: string;
  date_range?: {
    start: string;
    end: string;
  };
}

export interface UpdateRecruitInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  profile_photo_url?: string;
  instagram_username?: string;
  instagram_url?: string;
  upline_id?: string;
  referral_source?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip?: string;
  date_of_birth?: string;
  resident_state?: string;
  license_number?: string;
  npn?: string | null;
  license_expiration?: string;
  onboarding_status?: string; // Dynamic - phase name from pipeline_phases
  agent_status?: AgentStatus;
  contract_level?: number;
}

export interface UpdatePhaseInput {
  phase_name?: string;
  phase_description?: string;
  phase_order?: number;
  estimated_days?: number;
  auto_advance?: boolean;
  required_approver_role?: RequiredApproverRole;
  is_active?: boolean;
  visible_to_recruit?: boolean;
}

// Pipeline CRUD types
export interface CreateTemplateInput {
  name: string;
  description?: string;
  is_active?: boolean;
  is_default?: boolean;
  created_by?: string | null;
  imo_id?: string | null;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  is_active?: boolean;
  is_default?: boolean;
}

export interface CreatePhaseInput {
  phase_name: string;
  phase_description?: string;
  phase_order?: number;
  estimated_days?: number;
  auto_advance?: boolean;
  required_approver_role?: RequiredApproverRole;
  is_active?: boolean;
  visible_to_recruit?: boolean;
}

export interface CreateChecklistItemInput {
  item_type: ChecklistItemType;
  item_name: string;
  item_description?: string;
  item_order?: number;
  is_required?: boolean;
  is_active?: boolean;
  visible_to_recruit?: boolean;
  can_be_completed_by?: CompletedBy;
  requires_verification?: boolean;
  verification_by?: "upline" | "system";
  external_link?: string;
  document_type?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic metadata shape
  metadata?: Record<string, any>;
}

export interface UpdateChecklistItemInput {
  item_type?: ChecklistItemType;
  item_name?: string;
  item_description?: string;
  item_order?: number;
  is_required?: boolean;
  is_active?: boolean;
  visible_to_recruit?: boolean;
  can_be_completed_by?: CompletedBy;
  requires_verification?: boolean;
  verification_by?: "upline" | "system";
  external_link?: string;
  document_type?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic metadata shape
  metadata?: Record<string, any>;
}

export interface UpdateChecklistItemStatusInput {
  status: ChecklistItemStatus;
  completed_by?: string;
  verified_by?: string;
  rejection_reason?: string;
  document_id?: string;
  notes?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic metadata shape
  metadata?: Record<string, any>;
}

// NOTE: PHASE_DISPLAY_NAMES removed - phase names come from pipeline_phases table
// Use phase.phase_name directly from the database

export const CHECKLIST_ITEM_TYPE_DISPLAY_NAMES: Record<
  ChecklistItemType,
  string
> = {
  document_upload: "Document Upload",
  task_completion: "Task Completion",
  training_module: "Training Module",
  manual_approval: "Manual Approval",
  automated_check: "Automated Check",
  signature_required: "Signature Required",
  scheduling_booking: "Schedule Booking",
  video_embed: "Video Embed",
  boolean_question: "Yes/No Question",
  acknowledgment: "Acknowledgment",
  text_response: "Text Response",
  multiple_choice: "Multiple Choice",
  file_download: "File Download",
  external_link: "External Link",
  quiz: "Quiz",
  carrier_contracting: "Carrier Contracting",
};

// Status icons
export const PHASE_PROGRESS_ICONS: Record<PhaseProgressStatus, string> = {
  not_started: "⚪",
  in_progress: "🟡",
  completed: "✅",
  blocked: "🔴",
  skipped: "⏭️",
};

export const PHASE_PROGRESS_COLORS: Record<PhaseProgressStatus, string> = {
  not_started: "text-muted-foreground bg-muted",
  in_progress:
    "text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-950",
  completed:
    "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-950",
  blocked: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950",
  skipped: "text-gray-700 bg-gray-100 dark:text-gray-400 dark:bg-gray-950",
};

// =============================================================================
// Pipeline Automation Types
// =============================================================================

export type AutomationTriggerType =
  | "phase_enter"
  | "phase_complete"
  | "phase_stall"
  | "item_complete"
  | "item_approval_needed"
  | "item_deadline_approaching"
  | "password_not_set_24h"
  | "password_not_set_12h";

export type AutomationRecipientType =
  | "recruit"
  | "upline"
  | "trainer"
  | "contracting_manager"
  | "custom_email";

export type AutomationCommunicationType =
  | "email"
  | "notification"
  | "sms"
  | "both"
  | "all";

export type AutomationSenderType =
  | "system"
  | "upline"
  | "trainer"
  | "contracting_manager"
  | "custom";

export interface RecipientConfig {
  type: AutomationRecipientType;
  emails?: string[]; // Only for custom_email type
}

export interface PipelineAutomation {
  id: string;
  phase_id: string | null;
  checklist_item_id: string | null;
  imo_id: string | null; // Required for system automations, null for phase/item automations
  trigger_type: AutomationTriggerType;
  communication_type: AutomationCommunicationType;
  delay_days: number | null;
  recipients: RecipientConfig[];
  email_template_id: string | null;
  email_subject: string | null;
  email_body_html: string | null;
  notification_title: string | null;
  notification_message: string | null;
  sms_message: string | null;
  sender_type: AutomationSenderType | null;
  sender_email: string | null;
  sender_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineAutomationLog {
  id: string;
  automation_id: string;
  recruit_id: string;
  triggered_at: string;
  status: "pending" | "sent" | "failed" | "skipped";
  error_message: string | null;
  metadata: Record<string, unknown> | null;
}

export interface CreateAutomationInput {
  phase_id?: string;
  checklist_item_id?: string;
  imo_id?: string; // Required for system automations (password_not_set_*)
  trigger_type: AutomationTriggerType;
  communication_type?: AutomationCommunicationType;
  delay_days?: number;
  recipients: RecipientConfig[];
  email_template_id?: string;
  email_subject?: string;
  email_body_html?: string;
  notification_title?: string;
  notification_message?: string;
  sms_message?: string;
  sender_type?: AutomationSenderType;
  sender_email?: string;
  sender_name?: string;
}

export interface UpdateAutomationInput extends Partial<CreateAutomationInput> {
  is_active?: boolean;
}

// Display labels for automation triggers
export const AUTOMATION_TRIGGER_LABELS: Record<AutomationTriggerType, string> =
  {
    phase_enter: "On Phase Enter",
    phase_complete: "On Phase Complete",
    phase_stall: "Phase Stall Reminder",
    item_complete: "On Item Complete",
    item_approval_needed: "Approval Request",
    item_deadline_approaching: "Deadline Reminder",
    password_not_set_24h: "Password Reminder (24h before expiry)",
    password_not_set_12h: "Password Reminder (12h before expiry)",
  };

export const AUTOMATION_RECIPIENT_LABELS: Record<
  AutomationRecipientType,
  string
> = {
  recruit: "Recruit",
  upline: "Upline/Recruiter",
  trainer: "Trainer",
  contracting_manager: "Contracting Manager",
  custom_email: "Custom Email",
};

export const AUTOMATION_COMMUNICATION_LABELS: Record<
  AutomationCommunicationType,
  string
> = {
  email: "Email Only",
  notification: "In-App Notification",
  sms: "SMS Only",
  both: "Email + Notification",
  all: "Email + SMS + Notification",
};

// Helper to check if trigger is phase-level
export function isPhaseAutomation(trigger: AutomationTriggerType): boolean {
  return ["phase_enter", "phase_complete", "phase_stall"].includes(trigger);
}

// Helper to check if trigger is item-level
export function isItemAutomation(trigger: AutomationTriggerType): boolean {
  return [
    "item_complete",
    "item_approval_needed",
    "item_deadline_approaching",
  ].includes(trigger);
}

// Helper to check if trigger is system-level (not tied to phase or item)
export function isSystemAutomation(trigger: AutomationTriggerType): boolean {
  return ["password_not_set_24h", "password_not_set_12h"].includes(trigger);
}

// Short trigger labels for compact UI display
export const PHASE_TRIGGER_SHORT_LABELS: Record<string, string> = {
  phase_enter: "On Enter",
  phase_complete: "On Complete",
  phase_stall: "Stall Reminder",
};

export const ITEM_TRIGGER_SHORT_LABELS: Record<string, string> = {
  item_complete: "On Complete",
  item_approval_needed: "Approval Request",
  item_deadline_approaching: "Deadline Reminder",
};

export const SYSTEM_TRIGGER_SHORT_LABELS: Record<string, string> = {
  password_not_set_24h: "24h Warning",
  password_not_set_12h: "12h Warning",
};

// Combined short labels for all triggers
export const TRIGGER_SHORT_LABELS: Record<string, string> = {
  ...PHASE_TRIGGER_SHORT_LABELS,
  ...ITEM_TRIGGER_SHORT_LABELS,
  ...SYSTEM_TRIGGER_SHORT_LABELS,
};

// =============================================================================
// Video Embed Types
// =============================================================================

export type VideoPlatform = "youtube" | "vimeo" | "loom";

export interface VideoEmbedMetadata {
  platform: VideoPlatform;
  video_url: string; // Original URL provided by admin
  video_id: string; // Extracted video ID
  title?: string; // Optional video title
  duration?: number; // Optional duration in seconds
  require_full_watch?: boolean; // If true, recruit must watch entire video
  auto_complete?: boolean; // Auto-mark complete when video ends
}

// Display labels
export const VIDEO_PLATFORM_LABELS: Record<VideoPlatform, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  loom: "Loom",
};

export const VIDEO_PLATFORM_DESCRIPTIONS: Record<VideoPlatform, string> = {
  youtube: "Embed YouTube videos for training",
  vimeo: "Embed Vimeo videos for training",
  loom: "Embed Loom screen recordings",
};

export const VIDEO_PLATFORM_PLACEHOLDERS: Record<VideoPlatform, string> = {
  youtube: "https://www.youtube.com/watch?v=...",
  vimeo: "https://vimeo.com/...",
  loom: "https://www.loom.com/share/...",
};

// =============================================================================
// Interactive Checklist Item Types - Metadata Interfaces
// =============================================================================

/**
 * Boolean Question Metadata
 * For Yes/No, True/False, Accept/Decline questions
 */
export type BooleanQuestionStyle =
  | "yes_no"
  | "true_false"
  | "accept_decline"
  | "agree_disagree"
  | "custom";

export interface BooleanQuestionMetadata {
  question_text: string;
  question_style: BooleanQuestionStyle;
  positive_label?: string; // Default based on style (e.g., "Yes", "True", "Accept")
  negative_label?: string; // Default based on style (e.g., "No", "False", "Decline")
  require_positive?: boolean; // If true, must select positive option to complete
  explanation_required?: boolean; // Require text explanation with answer
  explanation_prompt?: string; // Prompt shown when explanation required
}

export const BOOLEAN_QUESTION_STYLE_LABELS: Record<
  BooleanQuestionStyle,
  string
> = {
  yes_no: "Yes / No",
  true_false: "True / False",
  accept_decline: "Accept / Decline",
  agree_disagree: "Agree / Disagree",
  custom: "Custom Labels",
};

export const BOOLEAN_QUESTION_DEFAULT_LABELS: Record<
  BooleanQuestionStyle,
  { positive: string; negative: string }
> = {
  yes_no: { positive: "Yes", negative: "No" },
  true_false: { positive: "True", negative: "False" },
  accept_decline: { positive: "Accept", negative: "Decline" },
  agree_disagree: { positive: "Agree", negative: "Disagree" },
  custom: { positive: "Yes", negative: "No" },
};

/**
 * Acknowledgment Metadata
 * For read-and-confirm disclosures, policies, terms
 */
export type AcknowledgmentContentType =
  | "inline_text"
  | "document_url"
  | "terms_reference";

export interface AcknowledgmentMetadata {
  content_type: AcknowledgmentContentType;
  content: string; // HTML/markdown content, URL, or reference ID
  acknowledgment_text: string; // Checkbox text (e.g., "I have read and understand...")
  document_title?: string; // Title for document references
  require_scroll?: boolean; // Must scroll to bottom before acknowledging
}

export const ACKNOWLEDGMENT_CONTENT_TYPE_LABELS: Record<
  AcknowledgmentContentType,
  string
> = {
  inline_text: "Inline Text Content",
  document_url: "Link to Document",
  terms_reference: "Reference to Terms/Policy",
};

/**
 * Text Response Metadata
 * For short answer or long-form text input
 */
export type TextResponseType = "short" | "long";

export interface TextResponseMetadata {
  prompt: string; // Question or prompt to display
  response_type: TextResponseType;
  min_length?: number; // Minimum character count
  max_length?: number; // Maximum character count
  placeholder?: string; // Helper text in input
  validation_pattern?: string; // Regex pattern for validation
  required_keywords?: string[]; // Must include certain words
}

export const TEXT_RESPONSE_TYPE_LABELS: Record<TextResponseType, string> = {
  short: "Short Answer (single line)",
  long: "Long Answer (multi-line)",
};

/**
 * Multiple Choice Metadata
 * For selecting from predefined options
 */
export type MultipleChoiceSelectionType = "single" | "multiple";

export interface MultipleChoiceOption {
  id: string;
  label: string;
  description?: string;
  is_correct?: boolean; // For quiz-style validation
  is_disqualifying?: boolean; // Auto-fail/flag if selected
}

export interface MultipleChoiceMetadata {
  question_text: string;
  selection_type: MultipleChoiceSelectionType;
  options: MultipleChoiceOption[];
  min_selections?: number; // For multiple selection
  max_selections?: number;
  randomize_order?: boolean;
  require_correct?: boolean; // Must select correct option(s) to complete
}

export const MULTIPLE_CHOICE_SELECTION_TYPE_LABELS: Record<
  MultipleChoiceSelectionType,
  string
> = {
  single: "Single Selection (radio buttons)",
  multiple: "Multiple Selection (checkboxes)",
};

/**
 * File Download Metadata
 * For downloading and reviewing documents
 */
export type FileDownloadType = "pdf" | "docx" | "xlsx" | "image" | "other";

export interface FileDownloadMetadata {
  file_url: string; // URL to download
  file_name: string; // Display name
  file_type: FileDownloadType;
  file_size_bytes?: number;
  require_download?: boolean; // Track download event before completion
  minimum_review_time_seconds?: number; // Must wait before completing
  acknowledgment_text?: string; // Optional confirmation checkbox text
}

export const FILE_DOWNLOAD_TYPE_LABELS: Record<FileDownloadType, string> = {
  pdf: "PDF Document",
  docx: "Word Document",
  xlsx: "Excel Spreadsheet",
  image: "Image File",
  other: "Other File",
};

/**
 * External Link Metadata
 * For completing actions at external URLs
 */
export type ExternalLinkCompletionMethod = "manual" | "webhook" | "return_url";

export interface ExternalLinkMetadata {
  url: string; // Destination URL
  link_text: string; // Button/link display text
  description?: string; // Instructions for the recruit
  open_in_new_tab: boolean;
  completion_method: ExternalLinkCompletionMethod;
  expected_duration_minutes?: number; // Set expectations
  verification_instructions?: string; // How admin verifies completion
}

export const EXTERNAL_LINK_COMPLETION_LABELS: Record<
  ExternalLinkCompletionMethod,
  string
> = {
  manual: "Manual Verification (recruit marks complete)",
  webhook: "Automatic (via webhook callback)",
  return_url: "Automatic (when recruit returns)",
};

/**
 * Quiz Metadata
 * For knowledge verification with multiple questions
 */
export type QuizQuestionType = "single" | "multiple" | "true_false";

export interface QuizQuestionOption {
  id: string;
  label: string;
  is_correct: boolean;
}

export interface QuizQuestion {
  id: string;
  question_text: string;
  question_type: QuizQuestionType;
  options: QuizQuestionOption[];
  points?: number; // Weight for scoring (default 1)
  explanation?: string; // Shown after answering
}

export interface QuizMetadata {
  title: string;
  description?: string;
  questions: QuizQuestion[];
  passing_score_percent: number; // Minimum % to pass
  allow_retries: boolean;
  max_retries?: number; // Only if allow_retries is true
  show_correct_answers: boolean; // Show corrections after completion
  time_limit_minutes?: number;
  randomize_questions?: boolean;
  randomize_options?: boolean;
}

export const QUIZ_QUESTION_TYPE_LABELS: Record<QuizQuestionType, string> = {
  single: "Single Answer",
  multiple: "Multiple Answers",
  true_false: "True/False",
};

// =============================================================================
// Carrier Contracting Types
// =============================================================================

/**
 * Carrier Contracting Metadata
 * For dynamically displaying carrier contract requests from the contracting tab
 */
export interface CarrierContractingMetadata {
  allow_recruit_edit_writing_number: boolean;
  completion_criteria: "all" | "count";
  required_count?: number;
  general_instructions?: string;
}

// =============================================================================
// Response Data Types - Stored in recruit_checklist_progress.response_data
// =============================================================================

export interface BooleanQuestionResponse {
  answer: boolean;
  explanation?: string;
  answered_at: string;
}

export interface AcknowledgmentResponse {
  acknowledged: boolean;
  acknowledged_at: string;
  scroll_completed?: boolean;
}

export interface TextResponseData {
  text: string;
  submitted_at: string;
  character_count: number;
}

export interface MultipleChoiceResponse {
  selected_option_ids: string[];
  submitted_at: string;
}

export interface FileDownloadResponse {
  downloaded: boolean;
  downloaded_at: string;
  acknowledged?: boolean;
  acknowledged_at?: string;
}

export interface ExternalLinkResponse {
  clicked: boolean;
  clicked_at: string;
  returned?: boolean;
  returned_at?: string;
}

export interface QuizAttempt {
  attempt_number: number;
  started_at: string;
  completed_at: string;
  answers: Record<string, string[]>; // question_id -> selected_option_ids
  score_percent: number;
  correct_count: number;
  total_questions: number;
  passed: boolean;
}

export interface QuizResponse {
  attempts: QuizAttempt[];
  best_score_percent: number;
  total_attempts: number;
  passed: boolean;
}

export interface VideoEmbedResponse {
  watched: boolean;
  watched_at: string;
  watch_duration_seconds?: number;
  watch_percentage?: number;
  fully_watched?: boolean;
}

export interface SignatureResponse {
  submission_id: string;
  submission_status:
    | "pending"
    | "in_progress"
    | "completed"
    | "declined"
    | "expired"
    | "voided";
  initiated_at: string;
  completed_at?: string;
  signers_completed: number;
  signers_total: number;
}

export interface CarrierContractingResponse {
  carriers_completed: number;
  carriers_total: number;
  completed_at: string;
  completed: boolean;
}

// =============================================================================
// Completion Details - Stored in recruit_checklist_progress.completion_details
// =============================================================================

export interface QuizCompletionDetails {
  final_score_percent: number;
  total_attempts: number;
  passed: boolean;
  completed_at: string;
}

export interface FileDownloadCompletionDetails {
  downloaded_at: string;
  review_time_seconds?: number;
}

// =============================================================================
// Display Labels for All Checklist Item Types
// =============================================================================

export const CHECKLIST_ITEM_TYPE_LABELS: Record<ChecklistItemType, string> = {
  document_upload: "Document Upload",
  task_completion: "Task Completion",
  training_module: "Training Module",
  manual_approval: "Manual Approval",
  automated_check: "Automated Check",
  signature_required: "Signature Required",
  scheduling_booking: "Schedule Meeting",
  video_embed: "Watch Video",
  boolean_question: "Yes/No Question",
  acknowledgment: "Acknowledgment",
  text_response: "Text Response",
  multiple_choice: "Multiple Choice",
  file_download: "File Download",
  external_link: "External Link",
  quiz: "Quiz",
  carrier_contracting: "Carrier Contracting",
};

export const CHECKLIST_ITEM_TYPE_DESCRIPTIONS: Record<
  ChecklistItemType,
  string
> = {
  document_upload: "Recruit uploads a required document",
  task_completion: "Simple task to mark as complete",
  training_module: "Complete a training module",
  manual_approval: "Requires approval from upline or admin",
  automated_check: "System-verified condition",
  signature_required: "Electronic signature collection",
  scheduling_booking: "Book an appointment or meeting",
  video_embed: "Watch an embedded video",
  boolean_question: "Answer a yes/no or true/false question",
  acknowledgment: "Read and acknowledge content or policy",
  text_response: "Provide a written response",
  multiple_choice: "Select from multiple options",
  file_download: "Download and review a file",
  external_link: "Complete an action at an external site",
  quiz: "Complete a knowledge quiz",
  carrier_contracting: "Track carrier contracting and writing numbers",
};

/**
 * Indicates which types require metadata configuration
 */
export const CHECKLIST_TYPES_REQUIRING_METADATA: ChecklistItemType[] = [
  "scheduling_booking",
  "video_embed",
  "boolean_question",
  "acknowledgment",
  "text_response",
  "multiple_choice",
  "file_download",
  "external_link",
  "quiz",
  "signature_required",
  "carrier_contracting",
];

/**
 * Indicates which types are interactive (recruit provides input)
 */
export const INTERACTIVE_CHECKLIST_TYPES: ChecklistItemType[] = [
  "document_upload",
  "boolean_question",
  "acknowledgment",
  "text_response",
  "multiple_choice",
  "file_download",
  "external_link",
  "quiz",
  "signature_required",
  "carrier_contracting",
];

// =============================================================================
// Recruit Invitation Types
// =============================================================================

export type InvitationStatus =
  | "pending"
  | "sent"
  | "viewed"
  | "completed"
  | "expired"
  | "cancelled";

export interface RecruitInvitation {
  id: string;
  recruit_id: string | null; // Nullable - set when registration form is submitted
  inviter_id: string;
  invite_token: string;
  email: string;
  status: InvitationStatus;
  expires_at: string;
  sent_at: string | null;
  viewed_at: string | null;
  completed_at: string | null;
  resend_count: number;
  last_resent_at: string | null;
  message: string | null;
  // Prefill fields (stored until recruit submits form)
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  upline_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInvitationInput {
  recruit_id?: string; // Optional - new flow creates user on form submission
  email: string;
  message?: string;
  // Prefill fields for new flow
  first_name?: string;
  last_name?: string;
  phone?: string;
  city?: string;
  state?: string;
  upline_id?: string;
}

export interface CreateInvitationResult {
  success: boolean;
  invitation_id?: string;
  token?: string;
  error?: string;
  message: string;
}

export interface InviterInfo {
  name: string;
  email: string;
  phone: string | null;
}

export interface PrefilledData {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
}

export interface InvitationValidationResult {
  valid: boolean;
  error?:
    | "invitation_not_found"
    | "invitation_cancelled"
    | "invitation_completed"
    | "invitation_expired";
  message?: string;
  invitation_id?: string;
  recruit_id?: string;
  email?: string;
  expires_at?: string;
  inviter?: InviterInfo;
  prefilled?: PrefilledData;
}

export interface RegistrationFormData {
  first_name: string;
  last_name: string;
  phone?: string;
  date_of_birth?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip?: string;
  instagram_username?: string;
  facebook_handle?: string;
  personal_website?: string;
  referral_source?: string;
}

export interface RegistrationResult {
  success: boolean;
  recruit_id?: string;
  error?: string;
  message: string;
  inviter?: InviterInfo;
}

// Invitation status display configuration
export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  pending: "Invite Pending",
  sent: "Invite Sent",
  viewed: "Invite Viewed",
  completed: "Registration Complete",
  expired: "Invite Expired",
  cancelled: "Invite Cancelled",
};

export const INVITATION_STATUS_COLORS: Record<InvitationStatus, string> = {
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  viewed:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  completed:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  expired: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};
