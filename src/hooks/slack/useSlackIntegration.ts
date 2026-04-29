// src/hooks/slack/useSlackIntegration.ts
// TanStack Query hooks for Slack integration (multi-workspace support)

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentUserProfile } from "@/hooks/admin";
import { slackService } from "@/services/slack";
import { slackKeys } from "@/types/slack.types";
import type {
  SlackIntegration,
  SlackChannel,
  SlackUser,
  SlackMessage,
  SlackNotificationType,
} from "@/types/slack.types";

// ============================================================================
// Integration Hooks (Multi-Workspace)
// ============================================================================

/**
 * Get all Slack integrations for the current user's IMO
 */
export function useSlackIntegrations() {
  const { data: profile } = useCurrentUserProfile();
  const imoId = profile?.imo_id;

  return useQuery({
    queryKey: slackKeys.integrations(imoId ?? ""),
    queryFn: async (): Promise<SlackIntegration[]> => {
      if (!imoId) return [];
      return slackService.getIntegrations(imoId);
    },
    enabled: !!imoId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get a specific Slack integration by ID
 */
export function useSlackIntegrationById(integrationId: string | undefined) {
  return useQuery({
    queryKey: slackKeys.integration(integrationId ?? ""),
    queryFn: async (): Promise<SlackIntegration | null> => {
      if (!integrationId) return null;
      return slackService.getIntegrationById(integrationId);
    },
    enabled: !!integrationId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get first active Slack integration (backward compatibility)
 * @deprecated Use useSlackIntegrations() for multi-workspace support
 */
export function useSlackIntegration() {
  const { data: profile } = useCurrentUserProfile();
  const imoId = profile?.imo_id;

  return useQuery({
    queryKey: [...slackKeys.integrations(imoId ?? ""), "first"],
    queryFn: async (): Promise<SlackIntegration | null> => {
      if (!imoId) return null;
      return slackService.getIntegration(imoId);
    },
    enabled: !!imoId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Check if user's IMO has at least one active Slack integration
 */
export function useHasSlackIntegration() {
  const { data: integrations = [], isLoading } = useSlackIntegrations();
  return {
    hasIntegration: integrations.some((i) => i.isConnected),
    isLoading,
  };
}

/**
 * Initiate Slack OAuth connection (adds new workspace)
 * If user has an agency, uses agency-level OAuth to pick up agency-specific credentials
 */
export function useConnectSlack() {
  const { user } = useAuth();
  const { data: profile } = useCurrentUserProfile();

  return useMutation({
    mutationFn: async (returnUrl?: string): Promise<void> => {
      if (!profile?.imo_id || !user?.id) {
        throw new Error("User not authenticated or no IMO assigned");
      }

      let oauthUrl: string;

      // If user has an agency, use agency-level OAuth to pick up agency credentials
      if (profile.agency_id) {
        oauthUrl = await slackService.initiateOAuthForAgency(
          profile.agency_id,
          profile.imo_id,
          user.id,
          returnUrl,
        );
      } else {
        // IMO-level connection
        oauthUrl = await slackService.initiateOAuth(
          profile.imo_id,
          user.id,
          returnUrl,
        );
      }

      window.location.href = oauthUrl;
    },
  });
}

/**
 * Re-authorize an existing Slack integration
 * Uses the integration's existing agency_id to ensure the correct OAuth flow
 * This prevents agency_id mismatch when the user's current agency differs from the integration's
 */
export function useReauthorizeSlackIntegration() {
  const { user } = useAuth();
  const { data: profile } = useCurrentUserProfile();

  return useMutation({
    mutationFn: async ({
      integrationId,
      returnUrl,
    }: {
      integrationId: string;
      returnUrl?: string;
    }): Promise<void> => {
      if (!profile?.imo_id || !user?.id) {
        throw new Error("User not authenticated or no IMO assigned");
      }

      // Fetch the existing integration to get its agency_id
      const integration = await slackService.getIntegrationById(integrationId);
      if (!integration) {
        throw new Error("Integration not found");
      }

      let oauthUrl: string;

      // Use the integration's agency_id, not the user's current agency
      if (integration.agency_id) {
        oauthUrl = await slackService.initiateOAuthForAgency(
          integration.agency_id,
          profile.imo_id,
          user.id,
          returnUrl,
        );
      } else {
        // IMO-level integration
        oauthUrl = await slackService.initiateOAuth(
          profile.imo_id,
          user.id,
          returnUrl,
        );
      }

      window.location.href = oauthUrl;
    },
  });
}

/**
 * Disconnect a specific Slack workspace by integration ID
 * Sets is_active = false and connection_status = 'disconnected', but preserves data
 */
export function useDisconnectSlackById() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentUserProfile();

  return useMutation({
    mutationFn: async (integrationId: string): Promise<void> => {
      await slackService.disconnectById(integrationId);
    },
    onSuccess: () => {
      if (profile?.imo_id) {
        queryClient.invalidateQueries({
          queryKey: slackKeys.integrations(profile.imo_id),
        });
        queryClient.invalidateQueries({
          queryKey: slackKeys.all,
        });
      }
    },
  });
}

/**
 * Permanently delete a Slack workspace integration
 * Removes the integration record and all related data (channel configs, messages)
 */
export function useDeleteSlackIntegration() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentUserProfile();

  return useMutation({
    mutationFn: async (integrationId: string): Promise<void> => {
      await slackService.deleteIntegrationById(integrationId);
    },
    onSuccess: () => {
      if (profile?.imo_id) {
        queryClient.invalidateQueries({
          queryKey: slackKeys.integrations(profile.imo_id),
        });
        queryClient.invalidateQueries({
          queryKey: slackKeys.all,
        });
      }
    },
  });
}

/**
 * Toggle integration active status (enable/disable notifications)
 */
export function useToggleSlackIntegrationActive() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentUserProfile();

  return useMutation({
    mutationFn: async ({
      integrationId,
      active,
    }: {
      integrationId: string;
      active: boolean;
    }): Promise<SlackIntegration> => {
      return slackService.toggleIntegrationActive(integrationId, active);
    },
    onSuccess: (_, variables) => {
      if (profile?.imo_id) {
        queryClient.invalidateQueries({
          queryKey: slackKeys.integrations(profile.imo_id),
        });
        queryClient.invalidateQueries({
          queryKey: slackKeys.integration(variables.integrationId),
        });
      }
    },
  });
}

/**
 * Disconnect Slack workspace (deprecated - disconnects first integration)
 * @deprecated Use useDisconnectSlackById() for multi-workspace support
 */
export function useDisconnectSlack() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentUserProfile();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      if (!profile?.imo_id) {
        throw new Error("No IMO assigned");
      }
      await slackService.disconnect(profile.imo_id);
    },
    onSuccess: () => {
      if (profile?.imo_id) {
        queryClient.invalidateQueries({
          queryKey: slackKeys.integrations(profile.imo_id),
        });
        queryClient.invalidateQueries({
          queryKey: slackKeys.all,
        });
      }
    },
  });
}

/**
 * Test Slack connection for a specific integration
 */
export function useTestSlackConnectionById() {
  return useMutation({
    mutationFn: async (
      integrationId: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      return slackService.testConnectionById(integrationId);
    },
  });
}

/**
 * Test Slack connection (deprecated)
 * @deprecated Use useTestSlackConnectionById() for multi-workspace support
 */
export function useTestSlackConnection() {
  const { data: profile } = useCurrentUserProfile();

  return useMutation({
    mutationFn: async (): Promise<{ ok: boolean; error?: string }> => {
      if (!profile?.imo_id) {
        throw new Error("No IMO assigned");
      }
      return slackService.testConnection(profile.imo_id);
    },
  });
}

/**
 * Update settings for a specific Slack integration
 */
export function useUpdateSlackIntegrationSettings() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentUserProfile();

  return useMutation({
    mutationFn: async ({
      integrationId,
      settings,
    }: {
      integrationId: string;
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
      };
    }): Promise<SlackIntegration> => {
      return slackService.updateIntegrationSettings(integrationId, settings);
    },
    onSuccess: (_, variables) => {
      if (profile?.imo_id) {
        queryClient.invalidateQueries({
          queryKey: slackKeys.integrations(profile.imo_id),
        });
        queryClient.invalidateQueries({
          queryKey: slackKeys.integration(variables.integrationId),
        });
      }
    },
  });
}

/**
 * Update Slack channel settings (deprecated)
 * @deprecated Use useUpdateSlackIntegrationSettings() for multi-workspace support
 */
export function useUpdateSlackChannelSettings() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentUserProfile();

  return useMutation({
    mutationFn: async (settings: {
      policy_channel_id?: string | null;
      policy_channel_name?: string | null;
      leaderboard_channel_id?: string | null;
      leaderboard_channel_name?: string | null;
      include_client_info?: boolean;
      include_leaderboard_with_policy?: boolean;
    }): Promise<SlackIntegration> => {
      if (!profile?.imo_id) {
        throw new Error("No IMO assigned");
      }
      return slackService.updateChannelSettings(profile.imo_id, settings);
    },
    onSuccess: () => {
      if (profile?.imo_id) {
        queryClient.invalidateQueries({
          queryKey: slackKeys.integrations(profile.imo_id),
        });
      }
    },
  });
}

// ============================================================================
// Channel Hooks
// ============================================================================

/**
 * List available Slack channels for a specific integration
 */
export function useSlackChannelsById(integrationId: string | undefined) {
  return useQuery({
    queryKey: slackKeys.channels(integrationId ?? ""),
    queryFn: async (): Promise<SlackChannel[]> => {
      if (!integrationId) return [];
      return slackService.listChannelsById(integrationId);
    },
    enabled: !!integrationId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * List available Slack channels (deprecated - uses first integration)
 * @deprecated Use useSlackChannelsById() for multi-workspace support
 */
export function useSlackChannels() {
  const { data: profile } = useCurrentUserProfile();
  const imoId = profile?.imo_id;

  return useQuery({
    queryKey: slackKeys.allChannels(imoId ?? ""),
    queryFn: async (): Promise<SlackChannel[]> => {
      if (!imoId) return [];
      return slackService.listChannels(imoId);
    },
    enabled: !!imoId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Join a Slack channel for a specific integration
 */
export function useJoinSlackChannelById() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      integrationId,
      channelId,
    }: {
      integrationId: string;
      channelId: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      return slackService.joinChannelById(integrationId, channelId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: slackKeys.channels(variables.integrationId),
      });
    },
  });
}

/**
 * Get members of a Slack channel for mention autocomplete
 */
export function useSlackChannelMembers(
  integrationId: string | null,
  channelId: string | null,
) {
  return useQuery({
    queryKey: ["slack-channel-members", integrationId, channelId],
    queryFn: async (): Promise<SlackUser[]> => {
      if (!integrationId || !channelId) return [];
      return slackService.getChannelMembers(integrationId, channelId);
    },
    enabled: !!integrationId && !!channelId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

/**
 * Join a Slack channel (deprecated)
 * @deprecated Use useJoinSlackChannelById() for multi-workspace support
 */
export function useJoinSlackChannel() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentUserProfile();

  return useMutation({
    mutationFn: async (
      channelId: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!profile?.imo_id) {
        throw new Error("No IMO assigned");
      }
      return slackService.joinChannel(profile.imo_id, channelId);
    },
    onSuccess: () => {
      if (profile?.imo_id) {
        queryClient.invalidateQueries({
          queryKey: slackKeys.allChannels(profile.imo_id),
        });
      }
    },
  });
}

// ============================================================================
// Message Hooks
// ============================================================================

/**
 * Get Slack message history
 */
export function useSlackMessages(options?: {
  limit?: number;
  offset?: number;
  notificationType?: SlackNotificationType;
  status?: string;
}) {
  const { data: profile } = useCurrentUserProfile();
  const imoId = profile?.imo_id;

  return useQuery({
    queryKey: [...slackKeys.messages(imoId ?? ""), options],
    queryFn: async (): Promise<{ messages: SlackMessage[]; total: number }> => {
      if (!imoId) return { messages: [], total: 0 };
      return slackService.getMessages(imoId, options);
    },
    enabled: !!imoId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Get message statistics
 */
export function useSlackMessageStats() {
  const { data: profile } = useCurrentUserProfile();
  const imoId = profile?.imo_id;

  return useQuery({
    queryKey: [...slackKeys.messages(imoId ?? ""), "stats"],
    queryFn: async () => {
      if (!imoId) return { total: 0, sent: 0, failed: 0, pending: 0 };
      return slackService.getMessageStats(imoId);
    },
    enabled: !!imoId,
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Send a test message
 */
export function useSendTestSlackMessage() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentUserProfile();

  return useMutation({
    mutationFn: async ({
      channelId,
      message,
    }: {
      channelId: string;
      message: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      if (!profile?.imo_id) {
        throw new Error("No IMO assigned");
      }
      return slackService.sendTestMessage(profile.imo_id, channelId, message);
    },
    onSuccess: () => {
      if (profile?.imo_id) {
        queryClient.invalidateQueries({
          queryKey: slackKeys.messages(profile.imo_id),
        });
      }
    },
  });
}

/**
 * Manually trigger leaderboard post
 */
export function usePostLeaderboard() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentUserProfile();

  return useMutation({
    mutationFn: async (
      agencyId?: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!profile?.imo_id) {
        throw new Error("No IMO assigned");
      }
      return slackService.postLeaderboard(profile.imo_id, agencyId);
    },
    onSuccess: () => {
      if (profile?.imo_id) {
        queryClient.invalidateQueries({
          queryKey: slackKeys.messages(profile.imo_id),
        });
      }
    },
  });
}

// ============================================================================
// Message Reactions
// ============================================================================

/**
 * Add a reaction to a Slack message (supports multi-workspace)
 */
export function useAddSlackReaction() {
  const { data: profile } = useCurrentUserProfile();

  return useMutation({
    mutationFn: async ({
      integrationId,
      channelId,
      messageTs,
      emojiName,
    }: {
      integrationId?: string;
      channelId: string;
      messageTs: string;
      emojiName: string;
    }): Promise<{ ok: boolean; error?: string; alreadyReacted?: boolean }> => {
      // Use integrationId if provided, otherwise fall back to imo_id (legacy)
      if (integrationId) {
        return slackService.addReaction(
          integrationId,
          channelId,
          messageTs,
          emojiName,
          true, // useIntegrationId = true
        );
      } else {
        if (!profile?.imo_id) {
          throw new Error("No IMO assigned");
        }
        return slackService.addReaction(
          profile.imo_id,
          channelId,
          messageTs,
          emojiName,
          false, // useIntegrationId = false
        );
      }
    },
  });
}

/**
 * Remove a reaction from a Slack message
 */
export function useRemoveSlackReaction() {
  const { data: profile } = useCurrentUserProfile();

  return useMutation({
    mutationFn: async ({
      channelId,
      messageTs,
      emojiName,
    }: {
      channelId: string;
      messageTs: string;
      emojiName: string;
    }): Promise<{ ok: boolean; error?: string; noReaction?: boolean }> => {
      if (!profile?.imo_id) {
        throw new Error("No IMO assigned");
      }
      return slackService.removeReaction(
        profile.imo_id,
        channelId,
        messageTs,
        emojiName,
      );
    },
  });
}
