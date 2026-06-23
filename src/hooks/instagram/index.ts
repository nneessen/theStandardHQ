// src/hooks/instagram/index.ts
// Instagram hooks exports

export {
  // Integration hooks
  useInstagramIntegrations,
  useInstagramIntegrationById,
  useActiveInstagramIntegration,
  useHasInstagramIntegration,
  useInstagramTokenExpiryCheck,
  useConnectInstagram,
  useDisconnectInstagram,
  useDeleteInstagramIntegration,
  // Conversation hooks
  useInstagramConversations,
  useInstagramConversation,
  usePriorityInstagramConversations,
  useSyncInstagramConversations,
  // Message hooks
  useInstagramMessages,
  useSyncInstagramMessages,
  useSendInstagramMessage,
  // Priority hooks
  useSetInstagramPriority,
  // Contact info hooks
  useUpdateInstagramContactInfo,
  // Lead hooks
  useCreateLeadFromInstagram,
  // Template hooks
  useInstagramTemplates,
  useCreateInstagramTemplate,
  useUpdateInstagramTemplate,
  useDeleteInstagramTemplate,
  // Template category hooks
  useInstagramTemplateCategories,
  useCreateTemplateCategory,
  useUpdateTemplateCategory,
  useDeleteTemplateCategory,
  // Scheduled message hooks
  useInstagramScheduledMessages,
  useCancelInstagramScheduledMessage,
  useScheduleInstagramMessage,
} from "./useInstagramIntegration";

// Realtime subscription hooks
export {
  useInstagramMessagesRealtime,
  useInstagramConversationsRealtime,
  useInstagramRealtime,
  useInstagramUnreadCount,
} from "./useInstagramRealtime";

// Social Studio scheduled-post hooks
export {
  useScheduledPosts,
  useSchedulePost,
  useCancelScheduledPost,
} from "./useInstagramScheduledPosts";
