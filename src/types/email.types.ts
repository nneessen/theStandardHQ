// Email System Types

export type EmailProvider = "gmail" | "outlook";

export type EmailStatus =
  | "draft"
  | "sending"
  | "sent"
  | "delivered"
  | "opened"
  | "failed";

export type EmailQueueStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "cancelled";

export type EmailTriggerType =
  | "phase_started"
  | "phase_completed"
  | "phase_blocked"
  | "checklist_completed"
  | "checklist_approved"
  | "checklist_rejected"
  | "recruit_graduated"
  | "custom";

export type EmailTemplateCategory =
  | "onboarding"
  | "documents"
  | "follow_up"
  | "general"
  | "automation";

// OAuth token record (from database, but with encrypted fields)
export interface EmailOAuthToken {
  id: string;
  user_id: string;
  provider: EmailProvider;
  email_address: string;
  is_active: boolean;
  token_expiry: string | null;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

// Email connection status for UI
export interface EmailConnectionStatus {
  isConnected: boolean;
  provider: EmailProvider | null;
  email: string | null;
  lastUsed: string | null;
  expiresAt: string | null;
}

// Email template
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: string[];
  category: EmailTemplateCategory;
  is_global: boolean;
  created_by: string | null;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
  // Block builder fields
  blocks: EmailBlock[] | null;
  is_block_template: boolean;
}

// Create template request
export interface CreateEmailTemplateRequest {
  name: string;
  subject: string;
  body_html: string;
  body_text?: string;
  variables?: string[];
  category?: EmailTemplateCategory;
  is_global?: boolean;
  is_active?: boolean;
  // Block builder fields
  blocks?: EmailBlock[];
  is_block_template?: boolean;
}

// Email trigger rule
export interface EmailTrigger {
  id: string;
  name: string;
  description: string | null;
  trigger_type: EmailTriggerType;
  trigger_config: EmailTriggerConfig;
  template_id: string;
  delay_minutes: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  template?: EmailTemplate;
}

// Trigger configuration varies by type
export type EmailTriggerConfig =
  | PhaseChangeTriggerConfig
  | ChecklistTriggerConfig
  | CustomTriggerConfig;

export interface PhaseChangeTriggerConfig {
  phase_id?: string; // Optional: trigger for specific phase
  to_status: "in_progress" | "completed" | "blocked";
}

export interface ChecklistTriggerConfig {
  checklist_item_id?: string; // Optional: trigger for specific item
  to_status: "completed" | "approved" | "rejected";
}

export interface CustomTriggerConfig {
  [key: string]: unknown;
}

// Email queue item
export interface EmailQueueItem {
  id: string;
  trigger_id: string | null;
  recipientuser_id: string;
  senderuser_id: string;
  template_id: string | null;
  subject: string | null;
  body_html: string | null;
  variables: Record<string, string> | null;
  scheduled_for: string;
  status: EmailQueueStatus;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  sent_at: string | null;
  email_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  recipient?: { first_name: string; last_name: string; email: string };
  sender?: { first_name: string; last_name: string; email: string };
  template?: EmailTemplate;
}

// Extended user_emails type (with Gmail/Outlook fields)
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
  // Gmail/Outlook integration fields
  provider: EmailProvider | null;
  provider_message_id: string | null;
  thread_id: string | null;
  is_incoming: boolean;
  reply_to_id: string | null;
  from_address: string | null;
  to_addresses: string[] | null;
  cc_addresses: string[] | null;
  labels: string[] | null;
  // Joined fields
  sender?: { first_name: string; last_name: string; email: string };
  attachments?: UserEmailAttachment[];
}

export interface UserEmailAttachment {
  id: string;
  email_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  created_at: string;
}

// Send email request (to Edge Function)
export interface SendEmailRequest {
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  attachments?: Array<{
    filename: string;
    content: string; // Base64 encoded
    mimeType: string;
  }>;
  threadId?: string;
  replyToEmailId?: string;
  recruitId?: string;
}

// Send email response
export interface SendEmailResponse {
  success: boolean;
  emailId?: string;
  gmailMessageId?: string;
  threadId?: string;
  error?: string;
}

// Email quota tracking
export interface EmailQuota {
  user_id: string;
  provider: EmailProvider;
  date: string;
  emails_sent: number;
  daily_limit: number; // Frontend-provided, based on provider
  remaining: number;
}

// Template variable definitions — re-exported from canonical source
import {
  TEMPLATE_VARIABLES,
  type TemplateVariableDefinition,
} from "@/lib/templateVariables";

/** Email template variables filtered to the email context, mapped to legacy { name, description } shape */
export const EMAIL_TEMPLATE_VARIABLES = TEMPLATE_VARIABLES.filter(
  (v: TemplateVariableDefinition) => v.contexts.includes("email"),
).map((v: TemplateVariableDefinition) => ({
  name: v.key,
  description: v.description,
}));

export type EmailTemplateVariableName = string;

// ============================================
// Email Block Builder Types (Visual Templates)
// ============================================

export type EmailBlockType =
  | "header"
  | "text"
  | "button"
  | "divider"
  | "spacer"
  | "footer"
  | "image"
  | "columns"
  | "social"
  | "quote";

// Modern email-safe fonts with Google Fonts + fallbacks
export type EmailFontFamily =
  | "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  | "'Roboto', Arial, sans-serif"
  | "'Open Sans', Helvetica, sans-serif"
  | "'Lato', 'Helvetica Neue', sans-serif"
  | "'Montserrat', Arial, sans-serif"
  | "'Poppins', sans-serif"
  | "'Source Sans Pro', Arial, sans-serif"
  | "'Nunito', sans-serif"
  | "'Playfair Display', Georgia, serif"
  | "'Merriweather', Georgia, serif"
  | "Georgia, serif"
  | "Arial, sans-serif";

export type EmailFontWeight = 400 | 500 | 600 | 700;

export interface FontOption {
  value: EmailFontFamily;
  label: string;
  category: "sans-serif" | "serif";
  weights: EmailFontWeight[];
  googleFont?: string; // Google Fonts import name
}

export const MODERN_EMAIL_FONTS: FontOption[] = [
  {
    value: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    label: "Inter",
    category: "sans-serif",
    weights: [400, 500, 600, 700],
    googleFont: "Inter",
  },
  {
    value: "'Roboto', Arial, sans-serif",
    label: "Roboto",
    category: "sans-serif",
    weights: [400, 500, 700],
    googleFont: "Roboto",
  },
  {
    value: "'Open Sans', Helvetica, sans-serif",
    label: "Open Sans",
    category: "sans-serif",
    weights: [400, 600, 700],
    googleFont: "Open+Sans",
  },
  {
    value: "'Lato', 'Helvetica Neue', sans-serif",
    label: "Lato",
    category: "sans-serif",
    weights: [400, 700],
    googleFont: "Lato",
  },
  {
    value: "'Montserrat', Arial, sans-serif",
    label: "Montserrat",
    category: "sans-serif",
    weights: [400, 500, 600, 700],
    googleFont: "Montserrat",
  },
  {
    value: "'Poppins', sans-serif",
    label: "Poppins",
    category: "sans-serif",
    weights: [400, 500, 600, 700],
    googleFont: "Poppins",
  },
  {
    value: "'Source Sans Pro', Arial, sans-serif",
    label: "Source Sans Pro",
    category: "sans-serif",
    weights: [400, 600, 700],
    googleFont: "Source+Sans+Pro",
  },
  {
    value: "'Nunito', sans-serif",
    label: "Nunito",
    category: "sans-serif",
    weights: [400, 600, 700],
    googleFont: "Nunito",
  },
  {
    value: "'Playfair Display', Georgia, serif",
    label: "Playfair Display",
    category: "serif",
    weights: [400, 700],
    googleFont: "Playfair+Display",
  },
  {
    value: "'Merriweather', Georgia, serif",
    label: "Merriweather",
    category: "serif",
    weights: [400, 700],
    googleFont: "Merriweather",
  },
  {
    value: "Georgia, serif",
    label: "Georgia",
    category: "serif",
    weights: [400, 700],
  },
  {
    value: "Arial, sans-serif",
    label: "Arial",
    category: "sans-serif",
    weights: [400, 700],
  },
];

// Helper to get Google Fonts import URL for used fonts
export function getGoogleFontsImport(fonts: EmailFontFamily[]): string {
  const googleFonts = MODERN_EMAIL_FONTS.filter(
    (f) => fonts.includes(f.value) && f.googleFont,
  ).map((f) => `${f.googleFont}:wght@${f.weights.join(";")}`);
  if (googleFonts.length === 0) return "";
  return `@import url('https://fonts.googleapis.com/css2?family=${googleFonts.join("&family=")}&display=swap');`;
}

export interface EmailBlockStyles {
  backgroundColor?: string;
  textColor?: string;
  padding?: string;
  alignment?: "left" | "center" | "right";
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: EmailFontFamily;
  lineHeight?: string;
  letterSpacing?: string;
  borderRadius?: string;
  // Border controls
  borderWidth?: string;
  borderColor?: string;
  borderStyle?: "none" | "solid" | "dashed" | "dotted";
  // Width control
  width?: string;
  maxWidth?: string;
}

// Global template settings
export interface EmailTemplateSettings {
  backgroundColor?: string;
  contentWidth?: number; // max-width in pixels
  fontFamily?: EmailFontFamily;
  preheaderText?: string;
}

export interface EmailBlock {
  id: string;
  type: EmailBlockType;
  content: EmailBlockContent;
  styles: EmailBlockStyles;
}

// Content varies by block type
export type EmailBlockContent =
  | HeaderBlockContent
  | TextBlockContent
  | ButtonBlockContent
  | DividerBlockContent
  | SpacerBlockContent
  | FooterBlockContent
  | ImageBlockContent
  | ColumnsBlockContent
  | SocialBlockContent
  | QuoteBlockContent;

export interface HeaderBlockContent {
  type: "header";
  title: string;
  logoUrl?: string;
  showLogo?: boolean;
}

export interface TextBlockContent {
  type: "text";
  html: string;
}

export type ButtonVariant = "solid" | "outline" | "ghost";

export interface ButtonBlockContent {
  type: "button";
  text: string;
  url: string;
  buttonColor?: string;
  textColor?: string;
  // Enhanced button options
  variant?: ButtonVariant;
  fullWidth?: boolean;
  icon?: string; // Lucide icon name
  iconPosition?: "left" | "right";
}

export interface DividerBlockContent {
  type: "divider";
  color?: string;
  thickness?: number;
  style?: "solid" | "dashed" | "dotted";
}

export interface SpacerBlockContent {
  type: "spacer";
  height: number;
}

export interface FooterBlockContent {
  type: "footer";
  text: string;
  showUnsubscribe?: boolean;
}

// New block types
export interface ImageBlockContent {
  type: "image";
  src: string;
  alt: string;
  width?: number; // percentage or pixels
  linkUrl?: string;
  linkTarget?: "_blank" | "_self";
}

export interface ColumnContent {
  blocks: EmailBlock[];
}

export interface ColumnsBlockContent {
  type: "columns";
  columnCount: 2 | 3;
  columns: ColumnContent[];
  gap?: number; // gap in pixels
}

export type SocialPlatform =
  | "facebook"
  | "twitter"
  | "instagram"
  | "youtube"
  | "email";

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
  enabled: boolean;
}

export interface SocialBlockContent {
  type: "social";
  links: SocialLink[];
  iconSize?: number;
  iconColor?: string;
  iconStyle?: "filled" | "outline";
}

export interface QuoteBlockContent {
  type: "quote";
  text: string;
  author?: string;
  accentColor?: string;
}
