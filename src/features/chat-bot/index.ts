// src/features/chat-bot/index.ts
// Barrel export for chat-bot feature module

export { ChatBotPage } from "./ChatBotPage";
export { CloseLogo } from "./components/IntegrationLogos";
export { BlockedLeadStatusSelector } from "./components/BlockedLeadStatusSelector";
export { ConnectionCard } from "./components/ConnectionCard";
export { LeadStatusSelector } from "./components/LeadStatusSelector";
export { LeadSourceSelector } from "./components/LeadSourceSelector";
export {
  chatBotApi,
  chatBotKeys,
  ChatBotApiError,
  useChatBotAgent,
  useChatBotVoiceSetupState,
  useChatBotVoiceEntitlement,
  useChatBotVoiceUsage,
  useChatBotVoiceCloneStatus,
  useChatBotCloseLeadStatuses,
  useChatBotCloseLeadSources,
  useChatBotCloseCustomFields,
  useStartVoiceTrial,
  useCreateVoiceAgent,
  useConnectClose,
  useDisconnectClose,
  useChatBotCloseStatus,
  useChatBotRetellRuntime,
  useChatBotRetellVoices,
  useChatBotRetellLlm,
  useSaveRetellConnection,
  useDisconnectRetellConnection,
  useUpdateRetellAgentDraft,
  usePublishRetellAgentDraft,
  useUpdateRetellLlm,
  useSearchRetellVoices,
  useAddRetellVoice,
  useUpdateBotConfig,
  useUpdateVoiceInboundRules,
  useUpdateVoiceOutboundRules,
  useUpdateVoiceGuardrails,
  useIsOnExemptTeam,
  useVoicePhoneNumbers,
  usePurchasePhoneNumber,
  useReleasePhoneNumber,
  useUpdateVoicePhoneNumber,
  type ChatBotAgent,
  type ChatBotCreateVoiceAgentResponse,
  type ChatBotCloseLeadStatus,
  type ChatBotCloseLeadSource,
  type ChatBotCloseCustomField,
  type ChatBotRetellConnection,
  type ChatBotRetellRuntime,
  type ChatBotRetellVoice,
  type ChatBotRetellVoiceSearchHit,
  type ChatBotVoiceSetupState,
  type ChatBotVoiceEntitlement,
  type ChatBotVoiceCloneStatus,
  type ChatBotVoiceUsage,
} from "./hooks/useChatBot";

export {
  useVoiceCloneScripts,
  useVoiceCloneSession,
  useStartVoiceClone,
  useUploadVoiceCloneSegment,
  useSubmitVoiceClone,
  useActivateVoiceClone,
  useDeactivateVoiceClone,
  useDeleteVoiceCloneSegment,
  useCancelVoiceClone,
  useUpdateVoiceCloneScripts,
  useResetVoiceCloneScripts,
  type VoiceCloneScript,
  type VoiceCloneScriptsResponse,
  type VoiceCloneScriptsUpdateResponse,
  type VoiceCloneStartResponse,
  type VoiceCloneSession,
  type VoiceCloneSessionSegment,
  type VoiceCloneSegmentUploadResponse,
} from "./hooks/useChatBotVoiceClone";

export type {
  VoicePhoneNumber,
  PurchasePhoneNumberParams,
  UpdatePhoneNumberParams,
} from "../voice-agent/types/voice-phone-number.types";

// Bot health monitoring — used by the /admin/bot-health page
export { useBotSystemHealth, botHealthKeys } from "./hooks/useBotSystemHealth";
export {
  evaluateThreshold,
  getQueueThreshold,
  worstLevel,
  DB_LATENCY_MS_THRESHOLD,
  TOTAL_FAILED_24H_THRESHOLD,
  QUEUE_PENDING_THRESHOLDS,
  UNKNOWN_QUEUE_THRESHOLD,
  type Threshold,
  type ThresholdLevel,
} from "./lib/monitoring-thresholds";
