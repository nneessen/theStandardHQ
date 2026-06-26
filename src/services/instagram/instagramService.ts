// src/services/instagram/InstagramService.ts
// Instagram DM integration service - Facade pattern composing all repositories

import { supabase } from "@/services/base/supabase";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "@/services/events/workflowEventEmitter";
import {
  InstagramIntegrationRepository,
  InstagramConversationRepository,
  InstagramMessageRepository,
  InstagramScheduledMessageRepository,
  InstagramTemplateRepository,
} from "./repositories";
import { InstagramTemplateCategoryRepository } from "./repositories/InstagramTemplateCategoryRepository";
import type {
  InstagramIntegration,
  InstagramConversation,
  InstagramMessage,
  InstagramScheduledMessage,
  InstagramMessageTemplate,
  InstagramMessageTemplateInsert,
  InstagramMessageTemplateUpdate,
  InstagramTemplateCategory,
  InstagramTemplateCategoryInsert,
  InstagramTemplateCategoryUpdate,
  ConversationFilters,
  CreateLeadFromIGInput,
} from "@/types/instagram.types";

class InstagramServiceClass {
  private integrationRepo: InstagramIntegrationRepository;
  private conversationRepo: InstagramConversationRepository;
  private messageRepo: InstagramMessageRepository;
  private scheduledMessageRepo: InstagramScheduledMessageRepository;
  private templateRepo: InstagramTemplateRepository;
  private templateCategoryRepo: InstagramTemplateCategoryRepository;

  constructor() {
    this.integrationRepo = new InstagramIntegrationRepository();
    this.conversationRepo = new InstagramConversationRepository();
    this.messageRepo = new InstagramMessageRepository();
    this.scheduledMessageRepo = new InstagramScheduledMessageRepository();
    this.templateRepo = new InstagramTemplateRepository();
    this.templateCategoryRepo = new InstagramTemplateCategoryRepository();
  }

  /**
   * Get auth headers for edge function calls
   * Retrieves the current user's session token
   */
  private async getAuthHeaders(): Promise<{ Authorization: string }> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Not authenticated");
    }
    return { Authorization: `Bearer ${session.access_token}` };
  }

  // ============================================================================
  // OAuth & Integration (Edge Functions)
  // ============================================================================

  /**
   * Initiate Instagram OAuth flow
   * Returns the OAuth URL to redirect the user to
   */
  async initiateOAuth(
    imoId: string,
    userId: string,
    returnUrl?: string,
  ): Promise<string> {
    const { data, error } = await supabase.functions.invoke(
      "instagram-oauth-init",
      {
        body: { imoId, userId, returnUrl },
      },
    );

    if (error) {
      console.error("[InstagramService] Error initiating OAuth:", error);
      throw new Error("Failed to initiate Instagram OAuth");
    }

    if (!data?.ok) {
      if (data?.upgradeRequired) {
        throw new Error(
          "Instagram DM integration requires Team tier subscription",
        );
      }
      if (data?.needsCredentials) {
        throw new Error(
          "Instagram integration not configured. Contact administrator.",
        );
      }
      throw new Error(data?.error || "Failed to generate OAuth URL");
    }

    return data.url;
  }

  /**
   * Get all Instagram integrations for an IMO
   */
  async getIntegrations(imoId: string): Promise<InstagramIntegration[]> {
    return this.integrationRepo.findByImoId(imoId);
  }

  /**
   * Get a single Instagram integration by ID
   */
  async getIntegrationById(
    integrationId: string,
  ): Promise<InstagramIntegration | null> {
    return this.integrationRepo.findById(integrationId);
  }

  /**
   * Get the first active Instagram integration for a user
   */
  async getActiveIntegration(
    userId: string,
  ): Promise<InstagramIntegration | null> {
    return this.integrationRepo.findActiveByUserId(userId);
  }

  /**
   * Check if user has at least one active Instagram integration
   */
  async hasActiveIntegration(userId: string): Promise<boolean> {
    const integration = await this.integrationRepo.findActiveByUserId(userId);
    return !!integration;
  }

  /**
   * Disconnect an Instagram integration
   */
  async disconnect(integrationId: string): Promise<void> {
    // REAL disconnect: the edge function revokes the app's authorization at Meta (so a
    // different business account can be connected afterwards — a soft DB flag never did this)
    // and removes the row. Fall back to the soft DB disconnect if the function is unavailable
    // so the UI still reflects the change.
    const { error } = await supabase.functions.invoke("instagram-disconnect", {
      body: { integrationId },
    });
    if (error) {
      await this.integrationRepo.disconnect(integrationId);
    }
  }

  /**
   * Delete an Instagram integration completely
   */
  async deleteIntegration(integrationId: string): Promise<void> {
    return this.integrationRepo.delete(integrationId);
  }

  // ============================================================================
  // Conversations
  // ============================================================================

  /**
   * Sync conversations from Instagram API and store in local DB
   * This is the primary method to fetch fresh data from Instagram
   */
  async syncConversations(
    integrationId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{
    conversations: InstagramConversation[];
    hasMore: boolean;
    nextCursor?: string;
    syncedCount: number;
  }> {
    const headers = await this.getAuthHeaders();
    const invoke = () =>
      supabase.functions.invoke("instagram-get-conversations", {
        headers,
        body: {
          integrationId,
          limit: options?.limit ?? 20,
          cursor: options?.cursor,
          syncToDb: true,
        },
      });

    const { data, error } = await invoke();

    if (error) {
      console.error("[InstagramService] Error syncing conversations:", error);
      throw new Error("Failed to sync Instagram conversations");
    }

    if (!data?.ok) {
      // Handle TOKEN_REFRESHED: server refreshed token, retry once
      if (data?.code === "TOKEN_REFRESHED" && data?.retry) {
        console.log(
          "[InstagramService] Token was refreshed server-side, retrying...",
        );
        const retryRes = await invoke();
        if (retryRes.error) {
          console.error("[InstagramService] Retry failed:", retryRes.error);
          throw new Error("Failed to sync Instagram conversations");
        }
        if (!retryRes.data?.ok) {
          throw new Error(
            retryRes.data?.error || "Failed to sync conversations",
          );
        }
        return {
          conversations: retryRes.data.conversations || [],
          hasMore: retryRes.data.hasMore || false,
          nextCursor: retryRes.data.nextCursor,
          syncedCount: retryRes.data.syncedCount || 0,
        };
      }

      if (data?.code === "TOKEN_EXPIRED") {
        throw new Error("Instagram token expired. Please reconnect.");
      }
      throw new Error(data?.error || "Failed to sync conversations");
    }

    return {
      conversations: data.conversations || [],
      hasMore: data.hasMore || false,
      nextCursor: data.nextCursor,
      syncedCount: data.syncedCount || 0,
    };
  }

  /**
   * Get conversations for an integration (from local DB)
   */
  async getConversations(
    integrationId: string,
    filters?: ConversationFilters,
  ): Promise<InstagramConversation[]> {
    return this.conversationRepo.findByIntegrationId(integrationId, filters);
  }

  /**
   * Get a single conversation by ID
   */
  async getConversationById(
    conversationId: string,
  ): Promise<InstagramConversation | null> {
    return this.conversationRepo.findById(conversationId);
  }

  /**
   * Set priority status for a conversation
   */
  async setPriority(
    conversationId: string,
    isPriority: boolean,
    userId: string,
    notes?: string,
  ): Promise<void> {
    return this.conversationRepo.updatePriority(
      conversationId,
      isPriority,
      userId,
      notes,
    );
  }

  /**
   * Update manually-entered contact info for a conversation participant
   * Requires userId for authorization verification
   */
  async updateContactInfo(
    conversationId: string,
    userId: string,
    contactInfo: {
      email?: string;
      phone?: string;
      notes?: string;
    },
  ): Promise<void> {
    return this.conversationRepo.updateContactInfo(
      conversationId,
      userId,
      contactInfo,
    );
  }

  /**
   * Create a recruiting lead from an Instagram conversation
   * Requires userId for authorization verification
   */
  async createLeadFromConversation(
    input: CreateLeadFromIGInput,
    userId: string,
  ): Promise<string> {
    const leadId = await this.conversationRepo.createLeadFromConversation(
      input.conversationId,
      userId,
      {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        city: input.city,
        state: input.state,
        availability: input.availability,
        insuranceExperience: input.insuranceExperience,
        whyInterested: input.whyInterested,
      },
    );

    // Emit instagram.lead_created (non-fatal). recipientId = the owning agent.
    await workflowEventEmitter.emit(WORKFLOW_EVENTS.INSTAGRAM_LEAD_CREATED, {
      recipientId: userId,
      leadId,
      conversationId: input.conversationId,
      timestamp: new Date().toISOString(),
    });

    return leadId;
  }

  // ============================================================================
  // Messages
  // ============================================================================

  /**
   * Sync messages from Instagram API for a conversation
   */
  async syncMessages(
    conversationId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{
    messages: InstagramMessage[];
    hasMore: boolean;
    nextCursor?: string;
    syncedCount: number;
  }> {
    const headers = await this.getAuthHeaders();
    const invoke = () =>
      supabase.functions.invoke("instagram-get-messages", {
        headers,
        body: {
          conversationId,
          limit: options?.limit ?? 50,
          cursor: options?.cursor,
          syncToDb: true,
        },
      });

    const { data, error } = await invoke();

    if (error) {
      console.error("[InstagramService] Error syncing messages:", error);
      throw new Error("Failed to sync Instagram messages");
    }

    if (!data?.ok) {
      // Handle TOKEN_REFRESHED: server refreshed token, retry once
      if (data?.code === "TOKEN_REFRESHED" && data?.retry) {
        console.log(
          "[InstagramService] Token was refreshed server-side, retrying syncMessages...",
        );
        const retryRes = await invoke();
        if (retryRes.error) {
          console.error("[InstagramService] Retry failed:", retryRes.error);
          throw new Error("Failed to sync Instagram messages");
        }
        if (!retryRes.data?.ok) {
          throw new Error(retryRes.data?.error || "Failed to sync messages");
        }
        return {
          messages: retryRes.data.messages || [],
          hasMore: retryRes.data.hasMore || false,
          nextCursor: retryRes.data.nextCursor,
          syncedCount: retryRes.data.syncedCount || 0,
        };
      }

      if (data?.code === "TOKEN_EXPIRED") {
        throw new Error("Instagram token expired. Please reconnect.");
      }
      throw new Error(data?.error || "Failed to sync messages");
    }

    return {
      messages: data.messages || [],
      hasMore: data.hasMore || false,
      nextCursor: data.nextCursor,
      syncedCount: data.syncedCount || 0,
    };
  }

  /**
   * Send a message via Instagram API
   */
  async sendMessage(
    conversationId: string,
    messageText: string,
    templateId?: string,
  ): Promise<InstagramMessage> {
    const headers = await this.getAuthHeaders();
    const invoke = () =>
      supabase.functions.invoke("instagram-send-message", {
        headers,
        body: {
          conversationId,
          messageText,
          templateId,
        },
      });

    const { data, error } = await invoke();

    if (error) {
      console.error("[InstagramService] Error sending message:", error);
      throw new Error("Failed to send Instagram message");
    }

    if (!data?.ok) {
      // Handle TOKEN_REFRESHED: server refreshed token, retry once
      if (data?.code === "TOKEN_REFRESHED" && data?.retry) {
        console.log(
          "[InstagramService] Token was refreshed server-side, retrying sendMessage...",
        );
        const retryRes = await invoke();
        if (retryRes.error) {
          console.error("[InstagramService] Retry failed:", retryRes.error);
          throw new Error("Failed to send Instagram message");
        }
        if (!retryRes.data?.ok) {
          // Preserve specific error codes on retry
          if (retryRes.data?.code === "WINDOW_CLOSED") {
            throw new Error(
              "Messaging window closed. You can only reply within 24 hours of the last message from this user.",
            );
          }
          if (retryRes.data?.code === "RATE_LIMITED") {
            throw new Error(
              "Instagram API rate limit reached. Please try again later.",
            );
          }
          throw new Error(retryRes.data?.error || "Failed to send message");
        }
        return retryRes.data.message;
      }

      if (data?.code === "TOKEN_EXPIRED") {
        throw new Error("Instagram token expired. Please reconnect.");
      }
      if (data?.code === "WINDOW_CLOSED") {
        throw new Error(
          "Messaging window closed. You can only reply within 24 hours of the last message from this user.",
        );
      }
      if (data?.code === "RATE_LIMITED") {
        throw new Error(
          "Instagram API rate limit reached. Please try again later.",
        );
      }
      throw new Error(data?.error || "Failed to send message");
    }

    return data.message;
  }

  /**
   * Get messages for a conversation (from local DB)
   */
  async getMessages(
    conversationId: string,
    limit?: number,
    offset?: number,
  ): Promise<{ messages: InstagramMessage[]; total: number }> {
    return this.messageRepo.findByConversationId(conversationId, limit, offset);
  }

  // ============================================================================
  // Templates
  // ============================================================================

  /**
   * Get message templates for an IMO
   */
  async getTemplates(imoId: string): Promise<InstagramMessageTemplate[]> {
    return this.templateRepo.findActiveByImoId(imoId);
  }

  /**
   * Create a new message template
   */
  async createTemplate(
    template: InstagramMessageTemplateInsert,
  ): Promise<InstagramMessageTemplate> {
    return this.templateRepo.create(template);
  }

  /**
   * Update a message template
   */
  async updateTemplate(
    templateId: string,
    updates: InstagramMessageTemplateUpdate,
  ): Promise<InstagramMessageTemplate> {
    return this.templateRepo.update(templateId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Delete a message template (soft delete)
   */
  async deleteTemplate(templateId: string, userId?: string): Promise<void> {
    return this.templateRepo.softDelete(templateId, userId);
  }

  /**
   * Get templates for a specific user (personal templates)
   */
  async getTemplatesByUser(
    userId: string,
  ): Promise<InstagramMessageTemplate[]> {
    return this.templateRepo.findByUserId(userId);
  }

  /**
   * Get templates filtered by prospect type and/or message stage
   */
  async getTemplatesByFilters(
    userId: string,
    filters: {
      prospectType?: string;
      messageStage?: string;
    },
  ): Promise<InstagramMessageTemplate[]> {
    return this.templateRepo.findByFilters(userId, filters);
  }

  // ============================================================================
  // Template Categories
  // ============================================================================

  /**
   * Get all custom template categories for a user
   */
  async getTemplateCategories(
    userId: string,
  ): Promise<InstagramTemplateCategory[]> {
    return this.templateCategoryRepo.findByUserId(userId);
  }

  /**
   * Create a new template category
   */
  async createTemplateCategory(
    category: InstagramTemplateCategoryInsert,
  ): Promise<InstagramTemplateCategory> {
    return this.templateCategoryRepo.create(category);
  }

  /**
   * Update a template category
   */
  async updateTemplateCategory(
    categoryId: string,
    updates: InstagramTemplateCategoryUpdate,
  ): Promise<InstagramTemplateCategory> {
    return this.templateCategoryRepo.update(categoryId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Delete a template category (soft delete)
   * Also clears this category from any templates using it
   */
  async deleteTemplateCategory(categoryId: string): Promise<void> {
    // Get the category to find its user_id
    const category = await this.templateCategoryRepo.findById(categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    // Clear templates using this category (new format: custom:{uuid})
    const customCategoryValue = `custom:${categoryId}`;
    await this.templateRepo.clearCategory(
      category.user_id,
      customCategoryValue,
    );

    // Also clear legacy format (stored by name) for backward compatibility
    await this.templateRepo.clearCategory(category.user_id, category.name);

    // Soft delete the category (with user_id for defense-in-depth)
    return this.templateCategoryRepo.softDelete(categoryId, category.user_id);
  }

  /**
   * Reorder template categories
   */
  async reorderTemplateCategories(
    userId: string,
    categoryIds: string[],
  ): Promise<void> {
    return this.templateCategoryRepo.reorder(userId, categoryIds);
  }

  // ============================================================================
  // Scheduled Messages
  // ============================================================================

  /**
   * Get scheduled messages for a conversation
   */
  async getScheduledMessages(
    conversationId: string,
  ): Promise<InstagramScheduledMessage[]> {
    return this.scheduledMessageRepo.findPendingByConversationId(
      conversationId,
    );
  }

  /**
   * Cancel a scheduled message
   */
  async cancelScheduledMessage(messageId: string): Promise<void> {
    return this.scheduledMessageRepo.cancel(messageId);
  }

  /**
   * Schedule a message for future sending
   * Validates that scheduled time is within the messaging window
   */
  async scheduleMessage(
    conversationId: string,
    messageText: string,
    scheduledFor: Date,
    userId: string,
    templateId?: string,
  ): Promise<InstagramScheduledMessage> {
    // Validate message content
    if (!messageText || messageText.trim().length === 0) {
      throw new Error("Message text is required");
    }
    if (messageText.length > 1000) {
      throw new Error("Message exceeds 1000 character limit");
    }

    // Get conversation to verify ownership and check window
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Verify user ownership through conversation repository
    const ownsConversation = await this.conversationRepo.verifyOwnership(
      conversationId,
      userId,
    );
    if (!ownsConversation) {
      throw new Error("Access denied to this conversation");
    }

    // Check messaging window
    if (!conversation.can_reply_until) {
      throw new Error(
        "Cannot schedule message: messaging window is closed. Wait for the contact to message you first.",
      );
    }

    const windowExpiry = new Date(conversation.can_reply_until);
    const now = new Date();

    if (windowExpiry <= now) {
      throw new Error(
        "Cannot schedule message: messaging window has expired. Wait for the contact to message you first.",
      );
    }

    // Validate scheduled time is in the future
    if (scheduledFor <= now) {
      throw new Error("Scheduled time must be in the future");
    }

    // Validate scheduled time is before window expiry
    if (scheduledFor >= windowExpiry) {
      throw new Error(
        "Scheduled time must be before the messaging window expires",
      );
    }

    // Create the scheduled message
    return this.scheduledMessageRepo.create({
      conversation_id: conversationId,
      message_text: messageText.trim(),
      template_id: templateId || null,
      scheduled_for: scheduledFor.toISOString(),
      scheduled_by: userId,
      messaging_window_expires_at: conversation.can_reply_until,
      status: "pending",
      is_auto_reminder: false,
    });
  }

  /**
   * Find pending auto-reminders for a conversation
   */
  async getPendingAutoReminders(
    conversationId: string,
  ): Promise<InstagramScheduledMessage[]> {
    return this.scheduledMessageRepo.findPendingAutoReminders(conversationId);
  }
}

// Singleton export
export const instagramService = new InstagramServiceClass();
export default instagramService;
