// src/services/slack/slackService.ts
// Slack integration service for managing workspace connections and channel configurations

import { supabase } from "@/services/base/supabase";
import type {
  SlackIntegration,
  SlackIntegrationRow,
  SlackMessage,
  SlackMessageRow,
  SlackChannel,
  SlackUser,
  SlackNotificationType,
} from "@/types/slack.types";

// No client-side environment variables needed - OAuth init is handled server-side

/**
 * Transform database row to SlackIntegration
 */
function transformIntegrationRow(row: SlackIntegrationRow): SlackIntegration {
  return {
    ...row,
    isConnected: row.is_active && row.connection_status === "connected",
  };
}

/**
 * Transform database row to SlackMessage
 */
function transformMessageRow(row: SlackMessageRow): SlackMessage {
  return {
    ...row,
    formattedSentAt: row.sent_at
      ? new Date(row.sent_at).toLocaleString()
      : undefined,
  };
}

export const slackService = {
  // ============================================================================
  // Integration Management (Multi-Workspace)
  // ============================================================================

  /**
   * Get all Slack integrations for an IMO (multi-workspace support)
   */
  async getIntegrations(imoId: string): Promise<SlackIntegration[]> {
    const { data, error } = await supabase
      .from("slack_integrations")
      .select("*")
      .eq("imo_id", imoId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[slackService] Error fetching integrations:", error);
      throw error;
    }

    return (data || []).map(transformIntegrationRow);
  },

  /**
   * Get integrations for a specific agency
   */
  async getIntegrationsByAgency(agencyId: string): Promise<SlackIntegration[]> {
    const { data, error } = await supabase
      .from("slack_integrations")
      .select("*")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(
        "[slackService] Error fetching agency integrations:",
        error,
      );
      throw error;
    }

    return (data || []).map(transformIntegrationRow);
  },

  /**
   * Get all integrations in the agency hierarchy (for display purposes)
   * Returns integrations for the agency, all parent agencies, and IMO-level
   */
  async getIntegrationsByAgencyHierarchy(
    agencyId: string,
  ): Promise<SlackIntegration[]> {
    const { data, error } = await supabase.rpc(
      "get_slack_integrations_for_agency_hierarchy",
      { p_agency_id: agencyId },
    );

    if (error) {
      console.error(
        "[slackService] Error fetching agency hierarchy integrations:",
        error,
      );
      throw error;
    }

    if (!data || data.length === 0) return [];

    // Fetch full integration details for each
    const integrationIds = data.map(
      (d: { integration_id: string }) => d.integration_id,
    );
    const { data: fullIntegrations } = await supabase
      .from("slack_integrations")
      .select("*")
      .in("id", integrationIds);

    return (fullIntegrations || []).map(transformIntegrationRow);
  },

  /**
   * Get a single Slack integration by ID
   */
  async getIntegrationById(
    integrationId: string,
  ): Promise<SlackIntegration | null> {
    const { data, error } = await supabase
      .from("slack_integrations")
      .select("*")
      .eq("id", integrationId)
      .maybeSingle();

    if (error) {
      console.error("[slackService] Error fetching integration:", error);
      throw error;
    }

    return data ? transformIntegrationRow(data) : null;
  },

  /**
   * Get the first active Slack integration for an IMO (backward compatibility)
   * @deprecated Use getIntegrations() for multi-workspace support
   */
  async getIntegration(imoId: string): Promise<SlackIntegration | null> {
    const { data, error } = await supabase
      .from("slack_integrations")
      .select("*")
      .eq("imo_id", imoId)
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[slackService] Error fetching integration:", error);
      throw error;
    }

    return data ? transformIntegrationRow(data) : null;
  },

  /**
   * Check if IMO has at least one active Slack integration
   */
  async hasActiveIntegration(imoId: string): Promise<boolean> {
    const integrations = await this.getIntegrations(imoId);
    return integrations.some((i) => i.isConnected);
  },

  /**
   * Initiate Slack OAuth flow
   * Returns the OAuth URL to redirect the user to
   * Uses server-side state signing for security
   */
  async initiateOAuth(
    imoId: string,
    userId: string,
    returnUrl?: string,
  ): Promise<string> {
    const { data, error } = await supabase.functions.invoke(
      "slack-oauth-init",
      {
        body: { imoId, userId, returnUrl },
      },
    );

    if (error) {
      console.error("[slackService] Error initiating OAuth:", error);
      throw new Error("Failed to initiate Slack OAuth");
    }

    if (!data?.ok || !data?.url) {
      throw new Error(data?.error || "Failed to generate OAuth URL");
    }

    return data.url;
  },

  /**
   * Initiate Slack OAuth flow for a specific agency
   * This allows agency-level workspace connections
   */
  async initiateOAuthForAgency(
    agencyId: string,
    imoId: string,
    userId: string,
    returnUrl?: string,
  ): Promise<string> {
    const { data, error } = await supabase.functions.invoke(
      "slack-oauth-init",
      {
        body: { imoId, userId, agencyId, returnUrl },
      },
    );

    if (error) {
      console.error("[slackService] Error initiating agency OAuth:", error);
      throw new Error("Failed to initiate Slack OAuth for agency");
    }

    if (!data?.ok || !data?.url) {
      throw new Error(data?.error || "Failed to generate OAuth URL");
    }

    return data.url;
  },

  /**
   * Toggle integration active status (enable/disable posting without disconnecting)
   */
  async toggleIntegrationActive(
    integrationId: string,
    active: boolean,
  ): Promise<SlackIntegration> {
    const { data, error } = await supabase
      .from("slack_integrations")
      .update({ is_active: active })
      .eq("id", integrationId)
      .select()
      .single();

    if (error) {
      console.error("[slackService] Error toggling integration active:", error);
      throw error;
    }

    return transformIntegrationRow(data);
  },

  /**
   * Disconnect a specific Slack workspace by integration ID
   */
  async disconnectById(integrationId: string): Promise<void> {
    const { error } = await supabase
      .from("slack_integrations")
      .update({
        is_active: false,
        connection_status: "disconnected",
      })
      .eq("id", integrationId);

    if (error) {
      console.error("[slackService] Error disconnecting:", error);
      throw error;
    }
  },

  /**
   * Disconnect Slack workspace by IMO (deprecated - disconnects first integration)
   * @deprecated Use disconnectById() for multi-workspace support
   */
  async disconnect(imoId: string): Promise<void> {
    const { error } = await supabase
      .from("slack_integrations")
      .update({
        is_active: false,
        connection_status: "disconnected",
      })
      .eq("imo_id", imoId);

    if (error) {
      console.error("[slackService] Error disconnecting:", error);
      throw error;
    }
  },

  /**
   * Delete a specific Slack integration by ID
   */
  async deleteIntegrationById(integrationId: string): Promise<void> {
    const { error } = await supabase
      .from("slack_integrations")
      .delete()
      .eq("id", integrationId);

    if (error) {
      console.error("[slackService] Error deleting integration:", error);
      throw error;
    }
  },

  /**
   * Delete Slack integration by IMO (deprecated)
   * @deprecated Use deleteIntegrationById() for multi-workspace support
   */
  async deleteIntegration(imoId: string): Promise<void> {
    const { error } = await supabase
      .from("slack_integrations")
      .delete()
      .eq("imo_id", imoId);

    if (error) {
      console.error("[slackService] Error deleting integration:", error);
      throw error;
    }
  },

  /**
   * Update channel settings on a specific integration
   */
  async updateIntegrationSettings(
    integrationId: string,
    settings: {
      display_name?: string | null;
      policy_channel_id?: string | null;
      policy_channel_name?: string | null;
      leaderboard_channel_id?: string | null;
      leaderboard_channel_name?: string | null;
      recruit_channel_id?: string | null;
      recruit_channel_name?: string | null;
      include_client_info?: boolean;
      include_leaderboard_with_policy?: boolean;
    },
  ): Promise<SlackIntegration> {
    const { data, error } = await supabase
      .from("slack_integrations")
      .update(settings)
      .eq("id", integrationId)
      .select()
      .single();

    if (error) {
      console.error(
        "[slackService] Error updating integration settings:",
        error,
      );
      throw error;
    }

    return transformIntegrationRow(data);
  },

  /**
   * Update channel settings by IMO (deprecated)
   * @deprecated Use updateIntegrationSettings() for multi-workspace support
   */
  async updateChannelSettings(
    imoId: string,
    settings: {
      policy_channel_id?: string | null;
      policy_channel_name?: string | null;
      leaderboard_channel_id?: string | null;
      leaderboard_channel_name?: string | null;
      include_client_info?: boolean;
      include_leaderboard_with_policy?: boolean;
    },
  ): Promise<SlackIntegration> {
    const { data, error } = await supabase
      .from("slack_integrations")
      .update(settings)
      .eq("imo_id", imoId)
      .select()
      .single();

    if (error) {
      console.error("[slackService] Error updating channel settings:", error);
      throw error;
    }

    return transformIntegrationRow(data);
  },

  /**
   * Test Slack connection for a specific integration
   */
  async testConnectionById(
    integrationId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const { data, error } = await supabase.functions.invoke(
      "slack-test-connection",
      {
        body: { integrationId },
      },
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    return data;
  },

  /**
   * Test Slack connection by IMO (deprecated)
   * @deprecated Use testConnectionById() for multi-workspace support
   */
  async testConnection(
    imoId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const { data, error } = await supabase.functions.invoke(
      "slack-test-connection",
      {
        body: { imoId },
      },
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    return data;
  },

  // ============================================================================
  // Channel Management
  // ============================================================================

  /**
   * List available Slack channels for a specific integration
   */
  async listChannelsById(integrationId: string): Promise<SlackChannel[]> {
    const { data, error } = await supabase.functions.invoke(
      "slack-list-channels",
      {
        body: { integrationId },
      },
    );

    if (error) {
      console.error("[slackService] Error listing channels:", error);
      throw error;
    }

    // Handle graceful error responses (ok: false with status 200)
    if (data && !data.ok) {
      console.error("[slackService] Slack error:", data.error);
      throw new Error(data.error || "Failed to list channels");
    }

    return data?.channels || [];
  },

  /**
   * List available Slack channels via edge function (deprecated)
   * @deprecated Use listChannelsById() for multi-workspace support
   */
  async listChannels(imoId: string): Promise<SlackChannel[]> {
    const { data, error } = await supabase.functions.invoke(
      "slack-list-channels",
      {
        body: { imoId },
      },
    );

    if (error) {
      console.error("[slackService] Error listing channels:", error);
      throw error;
    }

    return data?.channels || [];
  },

  /**
   * Join a Slack channel for a specific integration
   */
  async joinChannelById(
    integrationId: string,
    channelId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const { data, error } = await supabase.functions.invoke(
      "slack-join-channel",
      {
        body: { integrationId, channelId },
      },
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    return data;
  },

  /**
   * Join a Slack channel via edge function (deprecated)
   * @deprecated Use joinChannelById() for multi-workspace support
   */
  async joinChannel(
    imoId: string,
    channelId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const { data, error } = await supabase.functions.invoke(
      "slack-join-channel",
      {
        body: { imoId, channelId },
      },
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    return data;
  },

  /**
   * Get channel members for mention autocomplete
   */
  async getChannelMembers(
    integrationId: string,
    channelId: string,
  ): Promise<SlackUser[]> {
    const { data, error } = await supabase.functions.invoke(
      "slack-get-channel-members",
      {
        body: { integrationId, channelId },
      },
    );

    if (error) {
      console.error("[slackService] Error getting channel members:", error);
      throw error;
    }

    // Handle graceful error responses (ok: false with status 200)
    if (data && !data.ok) {
      console.error("[slackService] Slack error:", data.error);
      throw new Error(data.error || "Failed to get channel members");
    }

    console.log(
      `[slackService] Fetched ${data?.members?.length || 0} channel members`,
      data?.members,
    );

    return data?.members || [];
  },

  // ============================================================================
  // Message History
  // ============================================================================

  /**
   * Get message history for an IMO
   */
  async getMessages(
    imoId: string,
    options?: {
      limit?: number;
      offset?: number;
      notificationType?: SlackNotificationType;
      status?: string;
    },
  ): Promise<{ messages: SlackMessage[]; total: number }> {
    let query = supabase
      .from("slack_messages")
      .select("*", { count: "exact" })
      .eq("imo_id", imoId)
      .order("created_at", { ascending: false });

    if (options?.notificationType) {
      query = query.eq("notification_type", options.notificationType);
    }
    if (options?.status) {
      query = query.eq("status", options.status);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 50) - 1,
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[slackService] Error fetching messages:", error);
      throw error;
    }

    return {
      messages: (data || []).map(transformMessageRow),
      total: count || 0,
    };
  },

  /**
   * Get a specific message by ID
   */
  async getMessage(id: string): Promise<SlackMessage | null> {
    const { data, error } = await supabase
      .from("slack_messages")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[slackService] Error fetching message:", error);
      throw error;
    }

    return data ? transformMessageRow(data) : null;
  },

  /**
   * Get message statistics for an IMO
   */
  async getMessageStats(imoId: string): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
  }> {
    const { data, error } = await supabase
      .from("slack_messages")
      .select("status")
      .eq("imo_id", imoId);

    if (error) {
      console.error("[slackService] Error fetching message stats:", error);
      throw error;
    }

    const messages = data || [];
    return {
      total: messages.length,
      sent: messages.filter(
        (m) => m.status === "sent" || m.status === "delivered",
      ).length,
      failed: messages.filter((m) => m.status === "failed").length,
      pending: messages.filter(
        (m) => m.status === "pending" || m.status === "retrying",
      ).length,
    };
  },

  // ============================================================================
  // Manual Message Sending (for testing/manual triggers)
  // ============================================================================

  /**
   * Send a test message to a channel
   */
  async sendTestMessage(
    imoId: string,
    channelId: string,
    message: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const { data, error } = await supabase.functions.invoke(
      "slack-send-message",
      {
        body: {
          imoId,
          channelId,
          text: message,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: message,
              },
            },
          ],
        },
      },
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    return data;
  },

  /**
   * Manually trigger a leaderboard post
   */
  async postLeaderboard(
    imoId: string,
    agencyId?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const { data, error } = await supabase.functions.invoke(
      "slack-daily-leaderboard",
      {
        body: { imoId, agencyId, manual: true },
      },
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    return data;
  },

  // ============================================================================
  // Message Reactions
  // ============================================================================

  /**
   * Add a reaction (emoji) to a message
   */
  async addReaction(
    integrationIdOrImoId: string,
    channelId: string,
    messageTs: string,
    emojiName: string,
    useIntegrationId: boolean = true,
  ): Promise<{ ok: boolean; error?: string; alreadyReacted?: boolean }> {
    const { data, error } = await supabase.functions.invoke(
      "slack-add-reaction",
      {
        body: {
          ...(useIntegrationId
            ? { integrationId: integrationIdOrImoId }
            : { imoId: integrationIdOrImoId }),
          channelId,
          messageTs,
          emojiName,
        },
      },
    );

    if (error) {
      console.error("[slackService] Error adding reaction:", error);
      throw error;
    }

    return data;
  },

  /**
   * Remove a reaction (emoji) from a message
   */
  async removeReaction(
    imoId: string,
    channelId: string,
    messageTs: string,
    emojiName: string,
  ): Promise<{ ok: boolean; error?: string; noReaction?: boolean }> {
    const { data, error } = await supabase.functions.invoke(
      "slack-remove-reaction",
      {
        body: {
          imoId,
          channelId,
          messageTs,
          emojiName,
        },
      },
    );

    if (error) {
      console.error("[slackService] Error removing reaction:", error);
      throw error;
    }

    return data;
  },
};

export default slackService;
