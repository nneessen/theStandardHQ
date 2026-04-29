// src/hooks/slack/index.ts

// Multi-workspace integration hooks
export {
  // Multi-workspace
  useSlackIntegrations,
  useSlackIntegrationById,
  useDisconnectSlackById,
  useDeleteSlackIntegration,
  useToggleSlackIntegrationActive,
  useTestSlackConnectionById,
  useUpdateSlackIntegrationSettings,
  useSlackChannelsById,
  useJoinSlackChannelById,
  // Legacy (backward compatibility)
  useSlackIntegration,
  useHasSlackIntegration,
  useConnectSlack,
  useReauthorizeSlackIntegration,
  useDisconnectSlack,
  useTestSlackConnection,
  useUpdateSlackChannelSettings,
  useSlackChannels,
  useJoinSlackChannel,
  // Messages
  useSlackMessages,
  useSlackMessageStats,
  useSendTestSlackMessage,
  usePostLeaderboard,
  // Reactions
  useAddSlackReaction,
  useRemoveSlackReaction,
  // Channel members
  useSlackChannelMembers,
} from "./useSlackIntegration";

export {
  // User Preferences
  useUserSlackPreferences,
  useUpdateUserSlackPreferences,
  useSetDefaultSlackChannel,
  useSetPolicyPostChannels,
  useTogglePolicyPostChannel,
  useToggleAutoPost,
} from "./useUserSlackPreferences";

export {
  // Webhooks (multi-workspace notifications without OAuth)
  useSlackWebhooks,
  useAddSlackWebhook,
  useUpdateSlackWebhook,
  useDeleteSlackWebhook,
  useTestSlackWebhook,
} from "./useSlackWebhooks";

export {
  // Recruit notifications
  useRecruitNotificationStatus,
  useSendRecruitSlackNotification,
  useAutoPostRecruitNotification,
} from "./useRecruitSlackNotification";

export {
  // Recruit notification utilities (pure helpers)
  findRecruitIntegration,
  findRecruitChannel,
  buildNewRecruitMessage,
  buildNpnReceivedMessage,
  checkNotificationSent,
  sendRecruitNotification,
  autoPostRecruitNotification,
} from "../../services/slack/recruitNotificationService";
