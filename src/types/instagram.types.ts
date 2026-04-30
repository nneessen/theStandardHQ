// src/types/instagram.types.ts
// TypeScript types for Instagram DM integration

// Note: Database import will be used once database.types.ts is regenerated
// import type { Database } from "./database.types";

// ============================================================================
// Enum Types (will be in Database once migrations applied)
// ============================================================================

export type InstagramConnectionStatus =
  | "connected"
  | "disconnected"
  | "expired"
  | "error";
export type InstagramMessageType =
  | "text"
  | "media"
  | "story_reply"
  | "story_mention";
export type InstagramMessageStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";
export type MessageDirection = "inbound" | "outbound";
export type ScheduledMessageStatus =
  | "pending"
  | "sent"
  | "cancelled"
  | "failed"
  | "expired";

// Prospect types for template categorization
export type ProspectType =
  | "licensed_agent"
  | "captive_agent"
  | "has_team"
  | "solar"
  | "door_to_door"
  | "athlete"
  | "car_salesman"
  | "general_cold"
  | "custom"; // For user-defined categories

// Message stages for template categorization
export type MessageStage =
  | "opener"
  | "follow_up"
  | "engagement"
  | "discovery"
  | "closer";

// Display labels for built-in prospect types
export const PROSPECT_TYPE_LABELS: Record<string, string> = {
  licensed_agent: "Licensed Agent",
  captive_agent: "Captive Agent",
  has_team: "Has Team",
  solar: "Solar",
  door_to_door: "Door-to-Door",
  athlete: "Athlete",
  car_salesman: "Car Salesman",
  general_cold: "General/Cold",
};

// Display labels for message stages
export const MESSAGE_STAGE_LABELS: Record<MessageStage, string> = {
  opener: "Opener",
  follow_up: "Follow-up",
  engagement: "Engagement",
  discovery: "Discovery",
  closer: "Closer",
};

// Built-in prospect types (cannot be deleted by user)
export const BUILT_IN_PROSPECT_TYPES: ProspectType[] = [
  "licensed_agent",
  "captive_agent",
  "has_team",
  "solar",
  "door_to_door",
  "athlete",
  "car_salesman",
  "general_cold",
];

// Custom category prefix for storing category IDs
export const CUSTOM_CATEGORY_PREFIX = "custom:";

/**
 * Check if a category value represents a custom category (stored as custom:{uuid})
 */
export function isCustomCategory(category: string | null | undefined): boolean {
  return category?.startsWith(CUSTOM_CATEGORY_PREFIX) ?? false;
}

/**
 * Extract the UUID from a custom category value
 */
export function getCustomCategoryId(category: string): string | null {
  if (!isCustomCategory(category)) return null;
  return category.slice(CUSTOM_CATEGORY_PREFIX.length);
}

/**
 * Create a custom category value from a category ID
 */
export function createCustomCategoryValue(categoryId: string): string {
  return `${CUSTOM_CATEGORY_PREFIX}${categoryId}`;
}

/**
 * Get display label for a category (handles both built-in and custom)
 */
export function getCategoryLabel(
  category: string | null | undefined,
  customCategories: InstagramTemplateCategory[] = [],
): string {
  if (!category) return "";

  // Check if it's a built-in type
  if (PROSPECT_TYPE_LABELS[category]) {
    return PROSPECT_TYPE_LABELS[category];
  }

  // Check if it's a custom category (new format: custom:{uuid})
  if (isCustomCategory(category)) {
    const categoryId = getCustomCategoryId(category);
    const customCat = customCategories.find((c) => c.id === categoryId);
    return customCat?.name ?? "Unknown";
  }

  // Legacy: might be stored by name directly (for backward compatibility)
  const legacyMatch = customCategories.find((c) => c.name === category);
  if (legacyMatch) {
    return legacyMatch.name;
  }

  // Fallback: return as-is
  return category;
}

// ============================================================================
// Database Row Types (manual definition until migrations applied)
// ============================================================================

export interface InstagramIntegrationRow {
  id: string;
  imo_id: string;
  user_id: string;
  instagram_user_id: string;
  instagram_username: string;
  instagram_name: string | null;
  instagram_profile_picture_url: string | null;
  facebook_page_id: string;
  facebook_page_name: string | null;
  access_token_encrypted: string;
  token_expires_at: string | null;
  last_refresh_at: string | null;
  scopes: string[];
  connection_status: InstagramConnectionStatus;
  is_active: boolean;
  last_connected_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  api_calls_this_hour: number;
  api_calls_reset_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstagramConversationRow {
  id: string;
  integration_id: string;
  instagram_conversation_id: string;
  participant_instagram_id: string;
  participant_username: string | null;
  participant_name: string | null;
  participant_profile_picture_url: string | null;
  participant_avatar_cached_url: string | null;
  participant_avatar_cached_at: string | null;
  participant_email: string | null;
  participant_phone: string | null;
  contact_notes: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_direction: MessageDirection | null;
  unread_count: number;
  can_reply_until: string | null;
  last_inbound_at: string | null;
  is_priority: boolean;
  priority_set_at: string | null;
  priority_set_by: string | null;
  priority_notes: string | null;
  recruiting_lead_id: string | null;
  auto_reminder_enabled: boolean;
  auto_reminder_template_id: string | null;
  auto_reminder_hours: number;
  created_at: string;
  updated_at: string;
}

export interface InstagramMessageRow {
  id: string;
  conversation_id: string;
  instagram_message_id: string;
  message_text: string | null;
  message_type: InstagramMessageType;
  media_url: string | null;
  media_cached_url: string | null;
  media_cached_at: string | null;
  media_type: string | null;
  story_id: string | null;
  story_url: string | null;
  direction: MessageDirection;
  status: InstagramMessageStatus;
  sender_instagram_id: string;
  sender_username: string | null;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  template_id: string | null;
  scheduled_message_id: string | null;
  created_at: string;
}

export interface InstagramScheduledMessageRow {
  id: string;
  conversation_id: string;
  message_text: string;
  template_id: string | null;
  scheduled_for: string;
  scheduled_by: string;
  messaging_window_expires_at: string;
  status: ScheduledMessageStatus;
  sent_at: string | null;
  sent_message_id: string | null;
  error_message: string | null;
  retry_count: number;
  is_auto_reminder: boolean;
  created_at: string;
  updated_at: string;
}

export interface InstagramMessageTemplateRow {
  id: string;
  imo_id: string;
  user_id: string | null;
  name: string;
  content: string;
  category: string | null; // Prospect type (licensed_agent, has_team, solar, etc.)
  message_stage: string | null; // Message stage (opener, follow_up, closer)
  use_count: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface InstagramTemplateCategoryRow {
  id: string;
  user_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InstagramUsageTrackingRow {
  id: string;
  imo_id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  messages_sent: number;
  messages_received: number;
  api_calls_made: number;
  scheduled_messages_sent: number;
  templates_used: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Insert Types
// ============================================================================

export type InstagramIntegrationInsert = Omit<
  InstagramIntegrationRow,
  | "id"
  | "created_at"
  | "updated_at"
  | "api_calls_this_hour"
  | "api_calls_reset_at"
>;

export type InstagramConversationInsert = Omit<
  InstagramConversationRow,
  "id" | "created_at" | "updated_at" | "unread_count"
>;

export type InstagramMessageInsert = Omit<
  InstagramMessageRow,
  "id" | "created_at"
>;

export type InstagramScheduledMessageInsert = Omit<
  InstagramScheduledMessageRow,
  | "id"
  | "created_at"
  | "updated_at"
  | "sent_at"
  | "sent_message_id"
  | "error_message"
  | "retry_count"
>;

export type InstagramMessageTemplateInsert = Omit<
  InstagramMessageTemplateRow,
  "id" | "created_at" | "updated_at" | "use_count" | "last_used_at"
>;

export type InstagramTemplateCategoryInsert = Omit<
  InstagramTemplateCategoryRow,
  "id" | "created_at" | "updated_at"
>;

// ============================================================================
// Update Types
// ============================================================================

export type InstagramIntegrationUpdate = Partial<InstagramIntegrationRow>;
export type InstagramConversationUpdate = Partial<InstagramConversationRow>;
export type InstagramScheduledMessageUpdate =
  Partial<InstagramScheduledMessageRow>;
export type InstagramMessageTemplateUpdate =
  Partial<InstagramMessageTemplateRow>;
export type InstagramTemplateCategoryUpdate =
  Partial<InstagramTemplateCategoryRow>;

// ============================================================================
// Application Interfaces (with computed fields)
// ============================================================================

export interface InstagramIntegration extends InstagramIntegrationRow {
  /** Computed: is_active && connection_status === 'connected' */
  isConnected: boolean;
  /** Computed: token expiring within 7 days */
  tokenExpiringSoon: boolean;
}

export interface InstagramConversation extends InstagramConversationRow {
  /** Whether this conversation is linked to a recruiting lead */
  hasLinkedLead: boolean;
  // Note: windowStatus and windowTimeRemaining are now computed in UI via lib/instagram selectors
}

export interface InstagramMessage extends InstagramMessageRow {
  /** Formatted sent timestamp for display */
  formattedSentAt?: string;
  /** Whether message was sent by us */
  isOutbound: boolean;
}

export interface InstagramScheduledMessage extends InstagramScheduledMessageRow {
  /** Computed: is scheduled time in the past */
  isPastDue: boolean;
  /** Computed: is window expired */
  isWindowExpired: boolean;
}

export type InstagramMessageTemplate = InstagramMessageTemplateRow;
export type InstagramTemplateCategory = InstagramTemplateCategoryRow;

export interface InstagramUsageStats {
  messagesSent: number;
  messagesReceived: number;
  apiCallsMade: number;
  periodStart: string;
  periodEnd: string;
}

// ============================================================================
// API Types (from Instagram/Meta API responses)
// ============================================================================

export interface InstagramProfile {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
}

export interface InstagramConversationAPI {
  id: string;
  updated_time: string;
  participants: {
    data: Array<{
      id: string;
      username?: string;
      name?: string;
    }>;
  };
  messages?: {
    data: InstagramMessageAPI[];
  };
}

export interface InstagramMessageAPI {
  id: string;
  created_time: string;
  from: {
    id: string;
    username?: string;
    name?: string;
  };
  to: {
    data: Array<{
      id: string;
      username?: string;
    }>;
  };
  message?: string;
  attachments?: {
    data: Array<{
      id: string;
      mime_type: string;
      file_url?: string;
      image_data?: {
        url: string;
        width: number;
        height: number;
      };
      video_data?: {
        url: string;
        width: number;
        height: number;
      };
    }>;
  };
  story?: {
    id: string;
    media_url: string;
  };
}

// ============================================================================
// OAuth Types
// ============================================================================

export interface InstagramOAuthState {
  userId: string;
  imoId: string;
  timestamp: number;
  returnUrl?: string;
}

export interface InstagramOAuthResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface InstagramLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // Seconds until expiration (~60 days = 5184000)
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface InstagramWebhookEvent {
  object: "instagram";
  entry: Array<{
    id: string; // Instagram Business Account ID
    time: number;
    messaging?: Array<InstagramWebhookMessaging>;
  }>;
}

export interface InstagramWebhookMessaging {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: Array<{
      type: "image" | "video" | "audio" | "file";
      payload: {
        url: string;
      };
    }>;
    reply_to?: {
      mid: string;
    };
    is_echo?: boolean;
    is_deleted?: boolean;
  };
  reaction?: {
    mid: string;
    action: "react" | "unreact";
    reaction: string;
    emoji: string;
  };
  read?: {
    mid: string;
    watermark: number;
  };
}

// ============================================================================
// Service Types
// ============================================================================

export interface ConversationFilters {
  isPriority?: boolean;
  hasUnread?: boolean;
  hasOpenWindow?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateLeadFromIGInput {
  conversationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city?: string;
  state?: string;
  availability?: "full_time" | "part_time" | "exploring";
  insuranceExperience?:
    | "none"
    | "less_than_1_year"
    | "1_to_3_years"
    | "3_plus_years";
  whyInterested?: string;
}

export interface ScheduleMessageInput {
  conversationId: string;
  messageText: string;
  scheduledFor: Date;
  templateId?: string;
}

export interface AutoReminderConfig {
  enabled: boolean;
  templateId?: string;
  hoursAfterLastOutbound: number;
}

export interface UpdateContactInfoInput {
  conversationId: string;
  email?: string;
  phone?: string;
  notes?: string;
}

// ============================================================================
// Query Key Factory
// ============================================================================

export const instagramKeys = {
  all: ["instagram"] as const,

  // Integrations
  integrations: (userId: string) =>
    [...instagramKeys.all, "integrations", userId] as const,
  integration: (integrationId: string) =>
    [...instagramKeys.all, "integration", integrationId] as const,

  // Conversations
  conversations: (integrationId: string) =>
    [...instagramKeys.all, "conversations", integrationId] as const,
  conversation: (conversationId: string) =>
    [...instagramKeys.all, "conversation", conversationId] as const,
  priorityConversations: (integrationId: string) =>
    [...instagramKeys.all, "priority", integrationId] as const,

  // Messages
  messages: (conversationId: string) =>
    [...instagramKeys.all, "messages", conversationId] as const,

  // Scheduled messages
  scheduled: (conversationId: string) =>
    [...instagramKeys.all, "scheduled", conversationId] as const,
  allScheduled: (integrationId: string) =>
    [...instagramKeys.all, "allScheduled", integrationId] as const,

  // Templates (legacy IMO-based)
  templates: (imoId: string) =>
    [...instagramKeys.all, "templates", imoId] as const,
  template: (templateId: string) =>
    [...instagramKeys.all, "template", templateId] as const,

  // Templates (user-based - personal templates)
  userTemplates: (userId: string) =>
    [...instagramKeys.all, "templates", "user", userId] as const,

  // Template Categories
  templateCategories: (userId: string) =>
    [...instagramKeys.all, "templateCategories", userId] as const,
  templateCategory: (categoryId: string) =>
    [...instagramKeys.all, "templateCategory", categoryId] as const,

  // Usage
  usage: (userId: string, period?: string) =>
    [...instagramKeys.all, "usage", userId, period] as const,
};

// ============================================================================
// Helper Types
// ============================================================================

// Note: Window status helpers (getWindowStatus, getWindowTimeRemaining, formatWindowTimeRemaining)
// have been moved to src/lib/instagram/selectors.ts to avoid duplication and ensure
// values are computed fresh at render time rather than stored in DB transforms.
