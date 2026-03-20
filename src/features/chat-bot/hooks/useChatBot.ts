// src/features/chat-bot/hooks/useChatBot.ts
// React Query hooks for chat-bot-api edge function

import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { toast } from "sonner";
import type { AgentMonitoringResponse } from "@/types/chat-bot-monitoring";

import { useAuth } from "@/contexts/AuthContext";
import type { ResponseSchedule } from "../lib/response-schedule";

// ─── Query Key Factory ──────────────────────────────────────────

export const chatBotKeys = {
  all: ["chat-bot"] as const,
  agent: () => [...chatBotKeys.all, "agent"] as const,
  voiceSetupState: () =>
    [...chatBotKeys.all, "voice-setup-state", "v1"] as const,
  retellRuntime: () => [...chatBotKeys.all, "retell-runtime"] as const,
  retellVoices: () => [...chatBotKeys.all, "retell-voices"] as const,
  retellLlm: () => [...chatBotKeys.all, "retell-llm"] as const,
  conversations: (params: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
  }) => [...chatBotKeys.all, "conversations", params] as const,
  messages: (conversationId: string, params: { page: number; limit: number }) =>
    [...chatBotKeys.all, "messages", conversationId, params] as const,
  appointments: (params: { page: number; limit: number }) =>
    [...chatBotKeys.all, "appointments", params] as const,
  usage: () => [...chatBotKeys.all, "usage"] as const,
  voiceEntitlement: () => [...chatBotKeys.all, "voice-entitlement"] as const,
  voiceUsage: () => [...chatBotKeys.all, "voice-usage"] as const,
  closeStatus: () => [...chatBotKeys.all, "close-status"] as const,
  closeLeadStatuses: () => [...chatBotKeys.all, "close-lead-statuses"] as const,
  calendlyStatus: () => [...chatBotKeys.all, "calendly-status"] as const,
  calendlyEventTypes: () =>
    [...chatBotKeys.all, "calendly-event-types"] as const,
  calendarHealth: () => [...chatBotKeys.all, "calendar-health"] as const,
  googleStatus: () => [...chatBotKeys.all, "google-status"] as const,
  monitoring: () => [...chatBotKeys.all, "monitoring"] as const,
  teamAccess: (userId?: string) =>
    [...chatBotKeys.all, "team-access", userId ?? "anonymous"] as const,
};

// ─── Types ──────────────────────────────────────────────────────

export interface ChatBotAgent {
  id: string;
  name: string;
  botEnabled: boolean;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  autoOutreachLeadSources?: string[];
  allowedLeadStatuses?: string[];
  calendlyEventTypeSlug?: string | null;
  leadSourceEventTypeMappings?: { leadSource: string; eventTypeSlug: string }[];
  companyName?: string | null;
  jobTitle?: string | null;
  bio?: string | null;
  yearsOfExperience?: number | null;
  residentState?: string | null;
  nonResidentStates?: string[] | null;
  specialties?: string[] | null;
  website?: string | null;
  location?: string | null;
  businessHours?: { days: number[]; startTime: string; endTime: string } | null;
  responseSchedule?: ResponseSchedule | null;
  remindersEnabled?: boolean;
  billingExempt?: boolean;
  dailyMessageLimit?: number | null;
  maxMessagesPerConversation?: number | null;
  voiceEnabled?: boolean;
  voiceFollowUpEnabled?: boolean;
  afterHoursInboundEnabled?: boolean;
  afterHoursStartTime?: string | null;
  afterHoursEndTime?: string | null;
  afterHoursTimezone?: string | null;
  voiceProvider?: string | null;
  voiceId?: string | null;
  voiceFallbackVoiceId?: string | null;
  voiceTransferNumber?: string | null;
  voiceMaxCallDurationSeconds?: number | null;
  voiceVoicemailEnabled?: boolean;
  voiceHumanHandoffEnabled?: boolean;
  voiceQuotedFollowupEnabled?: boolean;
  connections?: {
    close?: { connected: boolean; orgName?: string };
    calendly?: { connected: boolean; eventType?: string };
    google?: { connected: boolean; calendarId?: string };
    retell?: ChatBotRetellConnection;
  };
}

export interface ChatBotRetellConnection {
  connected: boolean;
  id?: string;
  agentId?: string;
  apiKeyMasked?: string;
  retellAgentId?: string;
  fromNumberSource?: "retell" | "close";
  fromNumber?: string | null;
  closePhoneNumber?: string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CalendlyEventType {
  uri: string;
  name: string;
  slug: string;
  duration: number;
  active: boolean;
  locations?: { kind: string; location?: string }[];
}

export interface ChatBotCloseLeadStatus {
  id: string;
  label: string;
}

export interface ChatBotConversation {
  id: string;
  closeLeadId: string;
  localPhone: string | null;
  leadName: string | null;
  leadPhone: string | null;
  status: string;
  lastEventAt: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface ChatBotMessage {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  content: string;
  createdAt: string;
}

export interface ChatBotAppointment {
  id: string;
  leadName: string;
  scheduledAt: string | null;
  endAt: string | null;
  status: string;
  source: "bot" | "calendar_sync" | null;
  createdAt: string | null;
  eventUrl?: string | null;
  reminder24hSentAt: string | null;
  reminder1hSentAt: string | null;
  reminder15mSentAt: string | null;
}

export interface ChatBotUsage {
  leadsUsed: number;
  leadLimit: number;
  periodStart: string;
  periodEnd: string;
  tierName: string;
}

export interface ChatBotVoiceEntitlement {
  agentId: string;
  status: string;
  planCode: string;
  includedMinutes: number;
  hardLimitMinutes: number;
  cycleStartAt: string | null;
  cycleEndAt: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  features: {
    missedAppointment: boolean;
    reschedule: boolean;
    quotedFollowup: boolean;
    afterHoursInbound: boolean;
  };
  usage: {
    outboundCalls: number;
    inboundCalls: number;
    answeredCalls: number;
    usedMinutes: number;
    remainingMinutes: number;
  };
}

export interface ChatBotVoiceUsage {
  cycleStartAt: string | null;
  cycleEndAt: string | null;
  includedMinutes: number;
  hardLimitMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  outboundCalls: number;
  inboundCalls: number;
  answeredCalls: number;
}

export interface ChatBotVoiceSetupState {
  agent: {
    exists: boolean;
    provisioningStatus: string | null;
    published: boolean;
    id?: string | null;
    displayName?: string | null;
  };
  readiness: {
    entitlementActive: boolean;
  };
  connections: {
    close: {
      connected: boolean;
      orgName?: string | null;
    };
    retell: {
      connected: boolean;
      retellAgentId?: string | null;
      status?: string | null;
    };
    calendar?: {
      connected: boolean;
    };
    calendly?: {
      connected: boolean;
    };
  };
  nextAction: {
    key: string;
    label?: string | null;
    description?: string | null;
  };
  entitlement?: ChatBotVoiceEntitlement | null;
  usage?: ChatBotVoiceUsage | null;
}

export interface ChatBotRetellRuntime {
  connection: {
    id: string;
    agentId: string;
    apiKeyMasked: string;
    retellAgentId: string;
    fromNumberSource: "retell" | "close";
    fromNumber: string | null;
    closePhoneNumber: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  agent: Record<string, unknown>;
  llm: Record<string, unknown> | null;
}

export interface ChatBotRetellVoice {
  voice_id: string;
  voice_name: string;
  provider: string;
  gender: string;
  preview_audio_url?: string;
  accent?: string;
  age?: string;
}

export interface ChatBotRetellVoiceSearchHit {
  name?: string;
  description?: string;
  provider_voice_id?: string;
  public_user_id?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CalendarHealthIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  action: string;
}

export interface CalendarHealthResponse {
  healthy: boolean;
  eventType: {
    name: string;
    slug: string;
    duration: number;
    locationKind: string | null;
    schedulingUrl: string;
  } | null;
  issues: CalendarHealthIssue[];
}

interface TeamAccessResponse {
  hasTeamAccess: boolean;
}

export interface ChatBotCreateVoiceAgentResponse {
  success?: boolean;
  agent?: {
    exists?: boolean;
    provisioningStatus?: string;
    id?: string | null;
    displayName?: string | null;
    published?: boolean;
  };
}

// ─── API Helper ─────────────────────────────────────────────────

const EMPTY_VOICE_FEATURES = {
  missedAppointment: false,
  reschedule: false,
  quotedFollowup: false,
  afterHoursInbound: false,
};

const EMPTY_VOICE_USAGE = {
  outboundCalls: 0,
  inboundCalls: 0,
  answeredCalls: 0,
  usedMinutes: 0,
  remainingMinutes: 0,
};

const OPTIONAL_NOT_PROVISIONED_ACTIONS = new Set([
  "get_retell_runtime",
  "get_retell_llm",
  "get_calendar_health",
  "get_monitoring",
]);

const VOICE_SETUP_POLLING_ACTION_KEYS = new Set(["wait_for_provisioning"]);
const VOICE_AGENT_PENDING_STATUSES = new Set([
  "pending",
  "queued",
  "requested",
  "creating",
  "provisioning",
]);

function normalizeVoiceEntitlement(
  entitlement: ChatBotVoiceEntitlement | null | undefined,
): ChatBotVoiceEntitlement | null {
  if (!entitlement) return null;

  return {
    ...entitlement,
    features: {
      ...EMPTY_VOICE_FEATURES,
      ...(entitlement.features ?? {}),
    },
    usage: {
      ...EMPTY_VOICE_USAGE,
      ...(entitlement.usage ?? {}),
    },
  };
}

function normalizeVoiceUsage(
  usage: ChatBotVoiceUsage | null | undefined,
): ChatBotVoiceUsage | null {
  if (!usage) return null;

  return {
    cycleStartAt: usage.cycleStartAt ?? null,
    cycleEndAt: usage.cycleEndAt ?? null,
    includedMinutes: usage.includedMinutes ?? 0,
    hardLimitMinutes: usage.hardLimitMinutes ?? 0,
    usedMinutes: usage.usedMinutes ?? 0,
    remainingMinutes: usage.remainingMinutes ?? 0,
    outboundCalls: usage.outboundCalls ?? 0,
    inboundCalls: usage.inboundCalls ?? 0,
    answeredCalls: usage.answeredCalls ?? 0,
  };
}

function normalizeVoiceSetupState(
  setupState: ChatBotVoiceSetupState | null | undefined,
): ChatBotVoiceSetupState | null {
  if (!setupState) return null;

  return {
    agent: {
      exists: setupState.agent?.exists === true,
      provisioningStatus: setupState.agent?.provisioningStatus ?? null,
      published: setupState.agent?.published === true,
      id: setupState.agent?.id ?? null,
      displayName: setupState.agent?.displayName ?? null,
    },
    readiness: {
      entitlementActive: setupState.readiness?.entitlementActive === true,
    },
    connections: {
      close: {
        connected: setupState.connections?.close?.connected === true,
        orgName: setupState.connections?.close?.orgName ?? null,
      },
      retell: {
        connected: setupState.connections?.retell?.connected === true,
        retellAgentId: setupState.connections?.retell?.retellAgentId ?? null,
        status: setupState.connections?.retell?.status ?? null,
      },
      ...(setupState.connections?.calendar
        ? {
            calendar: {
              connected: setupState.connections.calendar.connected === true,
            },
          }
        : {}),
      ...(setupState.connections?.calendly
        ? {
            calendly: {
              connected: setupState.connections.calendly.connected === true,
            },
          }
        : {}),
    },
    nextAction: {
      key: setupState.nextAction?.key ?? "unknown",
      label: setupState.nextAction?.label ?? null,
      description: setupState.nextAction?.description ?? null,
    },
    entitlement: normalizeVoiceEntitlement(setupState.entitlement),
    usage: normalizeVoiceUsage(setupState.usage),
  };
}

function shouldPollVoiceSetupState(
  setupState: ChatBotVoiceSetupState | null | undefined,
): boolean {
  if (!setupState) return false;

  const nextActionKey = setupState.nextAction?.key?.trim().toLowerCase();
  if (nextActionKey && VOICE_SETUP_POLLING_ACTION_KEYS.has(nextActionKey)) {
    return true;
  }

  const provisioningStatus = setupState.agent?.provisioningStatus
    ?.trim()
    .toLowerCase();
  return Boolean(
    provisioningStatus && VOICE_AGENT_PENDING_STATUSES.has(provisioningStatus),
  );
}

function invalidateVoiceSetupQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({
    queryKey: chatBotKeys.voiceSetupState(),
  });
}

function invalidateVoiceAgentQueries(queryClient: QueryClient) {
  // Cancel in-flight polls before invalidating to prevent stale poll responses
  // from overwriting the fresh post-mutation data in the query cache.
  void queryClient.cancelQueries({
    queryKey: chatBotKeys.voiceSetupState(),
  });
  void queryClient.invalidateQueries({
    queryKey: chatBotKeys.voiceSetupState(),
  });
  void queryClient.invalidateQueries({ queryKey: chatBotKeys.agent() });
  void queryClient.invalidateQueries({
    queryKey: chatBotKeys.voiceEntitlement(),
  });
  void queryClient.invalidateQueries({ queryKey: chatBotKeys.voiceUsage() });
  void queryClient.invalidateQueries({ queryKey: chatBotKeys.retellRuntime() });
  void queryClient.invalidateQueries({ queryKey: chatBotKeys.retellVoices() });
  void queryClient.invalidateQueries({ queryKey: chatBotKeys.retellLlm() });
  invalidateVoiceSetupQueries(queryClient);
}

export class ChatBotApiError extends Error {
  constructor(
    message: string,
    public readonly isNotProvisioned: boolean = false,
    public readonly isServiceError: boolean = false,
    public readonly isTransportError: boolean = false,
  ) {
    super(message);
    this.name = "ChatBotApiError";
  }
}

function isEdgeTransportFailure(message: string, status?: number): boolean {
  if (typeof status === "number") return false;

  return (
    message.includes("Failed to send a request to the Edge Function") ||
    message.includes("Failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("NetworkError")
  );
}

function isNotProvisionedActionError(
  action: string,
  message: string,
  status?: number,
): boolean {
  const normalizedMessage = message.trim().toLowerCase();

  if (normalizedMessage.includes("no active chat bot")) {
    return true;
  }

  // Any 404 from the edge relay (function not deployed, or "no active bot") is
  // treated as "not provisioned" — prevents console spam in local dev where
  // chat-bot-api isn't served.
  if (status === 404) {
    return true;
  }

  if (
    normalizedMessage.includes("not found") ||
    normalizedMessage.includes("function not found")
  ) {
    return true;
  }

  if (action === "create_voice_agent") {
    return normalizedMessage.includes(
      "voice agent creation is not available in this environment yet.",
    );
  }

  if (!OPTIONAL_NOT_PROVISIONED_ACTIONS.has(action)) {
    return false;
  }

  return false;
}

export async function chatBotApi<T>(
  action: string,
  params?: Record<string, unknown>,
): Promise<T> {
  let accessToken: string | undefined = (await supabase.auth.getSession()).data
    .session?.access_token;

  if (!accessToken) {
    const {
      data: { session },
    } = await supabase.auth.refreshSession();
    accessToken = session?.access_token;
  }

  const { data, error } = await supabase.functions.invoke("chat-bot-api", {
    headers: accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : undefined,
    body: { action, ...params },
  });

  if (error) {
    // For FunctionsHttpError the response body hasn't been read yet.
    // Read it from the Response object stored in error.context.
    let bodyError: string | undefined;
    let bodyServiceDown = false;
    const status =
      (error as { context?: Response }).context?.status ?? undefined;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        bodyError =
          typeof body?.error === "string"
            ? body.error
            : (body?.error?.message ?? undefined);
        bodyServiceDown = body?.serviceDown === true;
      }
    } catch {
      // body already consumed or not JSON — fall through
    }

    // Fall back to data?.error (older Supabase client behaviour) then generic message
    if (!bodyError) {
      const de = data?.error;
      bodyError =
        typeof de === "string"
          ? de
          : typeof de === "object" && de?.message
            ? de.message
            : undefined;
    }

    const msg = bodyError || error.message || "Chat bot API error";

    const isNotFound = isNotProvisionedActionError(action, msg, status);

    const isTransportError = isEdgeTransportFailure(msg, status);
    const isServiceError =
      isTransportError ||
      bodyServiceDown ||
      msg.includes("temporarily unavailable");

    if (!isTransportError && !isServiceError && !isNotFound) {
      console.error(`[chatBotApi] ${action} failed (status=${status}):`, msg);
    }
    throw new ChatBotApiError(
      msg,
      isNotFound,
      isServiceError,
      isTransportError,
    );
  }

  if (!data || data.error) {
    const errVal = data?.error;
    const msg =
      typeof errVal === "string"
        ? errVal
        : errVal?.message || "Unknown chat bot API error";
    const isNotFound =
      data?.notProvisioned === true || isNotProvisionedActionError(action, msg);
    const isServiceDown = data?.serviceDown === true;
    if (!isNotFound && !isServiceDown) {
      console.error(`[chatBotApi] ${action} returned error in body:`, msg);
    }
    throw new ChatBotApiError(msg, isNotFound, isServiceDown);
  }

  return data as T;
}

// ─── Queries ────────────────────────────────────────────────────

export function useChatBotAgent(enabled = true) {
  const { user, loading } = useAuth();
  return useQuery<ChatBotAgent | null, ChatBotApiError>({
    queryKey: chatBotKeys.agent(),
    queryFn: async () => {
      try {
        return await chatBotApi<ChatBotAgent>("get_agent");
      } catch (err) {
        // Treat "not provisioned" (no active bot, function 404, etc.) as empty state.
        if (err instanceof ChatBotApiError && err.isNotProvisioned) {
          return null;
        }
        if (err instanceof ChatBotApiError && err.isServiceError) {
          throw err;
        }
        throw err;
      }
    },
    enabled: enabled && !!user?.id && !loading,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isNotProvisioned) {
        return false;
      }
      if (error instanceof ChatBotApiError && error.isTransportError) {
        return false;
      }
      if (error instanceof ChatBotApiError && error.isServiceError)
        return failureCount < 1;
      return failureCount < 1;
    },
  });
}

/**
 * Checks if the current user is on a team whose leader has a billing-exempt bot.
 * Walks up the user's hierarchy_path and checks chat_bot_agents for any
 * upline with billing_exempt = true.
 */
export function useIsOnExemptTeam() {
  const { user, loading } = useAuth();
  return useQuery<boolean>({
    queryKey: chatBotKeys.teamAccess(user?.id),
    queryFn: async () =>
      (await chatBotApi<TeamAccessResponse>("get_team_access")).hasTeamAccess,
    enabled: !!user?.id && !loading,
    staleTime: 300_000, // 5 min — team structure rarely changes
  });
}

export function useChatBotConversations(
  page: number,
  limit: number,
  status?: string,
  enabled = true,
  search?: string,
) {
  return useQuery<PaginatedResponse<ChatBotConversation>, Error>({
    queryKey: chatBotKeys.conversations({ page, limit, status, search }),
    queryFn: () =>
      chatBotApi<PaginatedResponse<ChatBotConversation>>("get_conversations", {
        page,
        limit,
        status,
        search,
      }),
    staleTime: 10_000,
    enabled,
  });
}

export function useChatBotMessages(
  conversationId: string | null,
  page: number,
  limit: number,
) {
  return useQuery<PaginatedResponse<ChatBotMessage>, Error>({
    queryKey: chatBotKeys.messages(conversationId || "", { page, limit }),
    queryFn: () =>
      chatBotApi<PaginatedResponse<ChatBotMessage>>("get_messages", {
        conversationId,
        page,
        limit,
      }),
    enabled: !!conversationId,
    staleTime: 5_000,
  });
}

export function useChatBotAppointments(page: number, limit: number) {
  return useQuery<PaginatedResponse<ChatBotAppointment>, Error>({
    queryKey: chatBotKeys.appointments({ page, limit }),
    queryFn: () =>
      chatBotApi<PaginatedResponse<ChatBotAppointment>>("get_appointments", {
        page,
        limit,
      }),
    staleTime: 30_000,
  });
}

export function useChatBotUsage(options?: { enabled?: boolean }) {
  return useQuery<ChatBotUsage, Error>({
    queryKey: chatBotKeys.usage(),
    queryFn: () => chatBotApi<ChatBotUsage>("get_usage"),
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
}

export function useChatBotVoiceEntitlement(enabled = true) {
  return useQuery<ChatBotVoiceEntitlement | null, ChatBotApiError>({
    queryKey: chatBotKeys.voiceEntitlement(),
    queryFn: async () => {
      const result = await chatBotApi<{
        entitlement: ChatBotVoiceEntitlement | null;
      }>("get_voice_entitlement");
      return normalizeVoiceEntitlement(result.entitlement);
    },
    enabled,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useChatBotVoiceSetupState(enabled = true) {
  const { user, loading } = useAuth();
  return useQuery<ChatBotVoiceSetupState | null, ChatBotApiError>({
    queryKey: chatBotKeys.voiceSetupState(),
    queryFn: async () => {
      try {
        const result = await chatBotApi<ChatBotVoiceSetupState>(
          "get_voice_setup_state",
        );
        return normalizeVoiceSetupState(result);
      } catch (err) {
        if (
          err instanceof ChatBotApiError &&
          err.message.includes("No active chat bot")
        ) {
          return null;
        }
        throw err;
      }
    },
    enabled: enabled && !!user?.id && !loading,
    staleTime: 15_000,
    gcTime: 300_000,
    refetchInterval: (query) =>
      shouldPollVoiceSetupState(query.state.data) ? 5_000 : false,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useChatBotVoiceUsage(enabled = true) {
  return useQuery<ChatBotVoiceUsage, ChatBotApiError>({
    queryKey: chatBotKeys.voiceUsage(),
    queryFn: () => chatBotApi<ChatBotVoiceUsage>("get_voice_usage"),
    enabled,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useChatBotRetellRuntime(enabled = true) {
  return useQuery<ChatBotRetellRuntime | null, ChatBotApiError>({
    queryKey: chatBotKeys.retellRuntime(),
    queryFn: async () => {
      try {
        return await chatBotApi<ChatBotRetellRuntime>("get_retell_runtime");
      } catch (err) {
        if (err instanceof ChatBotApiError && err.isNotProvisioned) {
          return null;
        }
        throw err;
      }
    },
    enabled,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useChatBotRetellVoices(enabled = true) {
  return useQuery<ChatBotRetellVoice[], ChatBotApiError>({
    queryKey: chatBotKeys.retellVoices(),
    queryFn: async () => {
      const result = await chatBotApi<{ voices: ChatBotRetellVoice[] }>(
        "get_retell_voices",
      );
      return result.voices ?? [];
    },
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useChatBotRetellLlm(enabled = true) {
  return useQuery<Record<string, unknown> | null, ChatBotApiError>({
    queryKey: chatBotKeys.retellLlm(),
    queryFn: async () => {
      try {
        return await chatBotApi<Record<string, unknown> | null>(
          "get_retell_llm",
        );
      } catch (err) {
        if (err instanceof ChatBotApiError && err.isNotProvisioned) {
          return null;
        }
        throw err;
      }
    },
    enabled,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useChatBotCloseStatus(enabled = true) {
  return useQuery<{ connected: boolean; orgName?: string }, ChatBotApiError>({
    queryKey: chatBotKeys.closeStatus(),
    queryFn: () =>
      chatBotApi<{ connected: boolean; orgName?: string }>("get_close_status"),
    enabled,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useChatBotCloseLeadStatuses(enabled = true) {
  return useQuery<ChatBotCloseLeadStatus[], ChatBotApiError>({
    queryKey: chatBotKeys.closeLeadStatuses(),
    queryFn: async () => {
      const result = await chatBotApi<{
        statuses: ChatBotCloseLeadStatus[];
      }>("get_close_lead_statuses");
      return result.statuses ?? [];
    },
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useChatBotCalendlyStatus(enabled = true) {
  return useQuery<
    {
      connected: boolean;
      eventType?: string;
      userName?: string;
      userEmail?: string;
    },
    ChatBotApiError
  >({
    queryKey: chatBotKeys.calendlyStatus(),
    queryFn: () =>
      chatBotApi<{
        connected: boolean;
        eventType?: string;
        userName?: string;
        userEmail?: string;
      }>("get_calendly_status"),
    enabled,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useChatBotCalendlyEventTypes(enabled = true) {
  return useQuery<CalendlyEventType[], ChatBotApiError>({
    queryKey: chatBotKeys.calendlyEventTypes(),
    queryFn: () => chatBotApi<CalendlyEventType[]>("get_calendly_event_types"),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

// ─── Google Calendar ────────────────────────────────────────────

export function useChatBotGoogleStatus(enabled = true) {
  return useQuery<
    {
      connected: boolean;
      calendarId?: string;
      userEmail?: string;
    },
    ChatBotApiError
  >({
    queryKey: chatBotKeys.googleStatus(),
    queryFn: () =>
      chatBotApi<{
        connected: boolean;
        calendarId?: string;
        userEmail?: string;
      }>("get_google_status"),
    enabled,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useGetGoogleAuthUrl() {
  return useMutation({
    mutationFn: (returnUrl: string) =>
      chatBotApi<{ url: string }>("get_google_auth_url", { returnUrl }),
    onError: (error: Error) => {
      toast.error(error.message || "Failed to get Google auth URL.");
    },
  });
}

export function useDisconnectGoogle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => chatBotApi<{ success: boolean }>("disconnect_google"),
    onSuccess: () => {
      toast.success("Google Calendar disconnected.");
      void queryClient.invalidateQueries({ queryKey: chatBotKeys.agent() });
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.googleStatus(),
      });
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.calendarHealth(),
      });
      invalidateVoiceSetupQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to disconnect Google Calendar.");
    },
  });
}

export function useUpdateBusinessHours() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (businessHours: {
      days: number[];
      startTime: string;
      endTime: string;
    }) =>
      chatBotApi<{ success: boolean }>("update_business_hours", {
        businessHours,
      }),
    onSuccess: () => {
      toast.success("Business hours updated.");
      queryClient.invalidateQueries({ queryKey: chatBotKeys.agent() });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update business hours.");
    },
  });
}

// ─── Mutations ──────────────────────────────────────────────────

export function useStartVoiceTrial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      chatBotApi<{ success: boolean; trial: boolean }>("start_voice_trial"),
    onSuccess: () => {
      toast.success(
        "Voice trial activated — you can now create your voice agent.",
      );
      // Invalidate addon queries so the page picks up the new addon row
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
      invalidateVoiceAgentQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to activate voice trial.");
    },
  });
}

export function useCreateVoiceAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { templateKey?: string } = {}) =>
      chatBotApi<ChatBotCreateVoiceAgentResponse>("create_voice_agent", params),
    onSuccess: () => {
      toast.success("Your voice agent has been created.");
      invalidateVoiceAgentQueries(queryClient);
    },
    onError: (error: Error) => {
      if (error instanceof ChatBotApiError && error.isNotProvisioned) {
        toast.error(
          "Voice agent creation is not available in this environment yet.",
        );
        return;
      }
      toast.error(error.message || "Failed to create your voice agent.");
    },
  });
}

export function useSaveRetellConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connection: {
      apiKey: string;
      retellAgentId: string;
      fromNumberSource?: "retell" | "close";
      fromNumber?: string;
      closePhoneNumber?: string;
    }) =>
      chatBotApi<{ success: boolean }>("save_retell_connection", connection),
    onSuccess: () => {
      toast.success("Managed voice connection saved.");
      invalidateVoiceAgentQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save the voice connection.");
    },
  });
}

export function useDisconnectRetellConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      chatBotApi<{ success: boolean }>("disconnect_retell_connection"),
    onSuccess: () => {
      toast.success("Managed voice connection disconnected.");
      invalidateVoiceAgentQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(
        error.message || "Failed to disconnect the voice connection.",
      );
    },
  });
}

export function useUpdateRetellAgentDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      chatBotApi<Record<string, unknown>>("update_retell_agent", { patch }),
    onSuccess: () => {
      toast.success("Voice draft updated.");
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.retellRuntime(),
      });
      invalidateVoiceSetupQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update the voice draft.");
    },
  });
}

export function usePublishRetellAgentDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      chatBotApi<{ published: boolean }>("publish_retell_agent"),
    onSuccess: () => {
      toast.success("Voice draft published.");
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.retellRuntime(),
      });
      void queryClient.invalidateQueries({ queryKey: chatBotKeys.retellLlm() });
      invalidateVoiceSetupQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to publish the voice draft.");
    },
  });
}

export function useUpdateRetellLlm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      chatBotApi<Record<string, unknown>>("update_retell_llm", { patch }),
    onSuccess: () => {
      toast.success("Voice instructions updated.");
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.retellRuntime(),
      });
      void queryClient.invalidateQueries({ queryKey: chatBotKeys.retellLlm() });
      invalidateVoiceSetupQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update the voice instructions.");
    },
  });
}

export function useSearchRetellVoices() {
  return useMutation({
    mutationFn: (params: {
      searchQuery: string;
      voiceProvider?: "elevenlabs" | "cartesia" | "minimax" | "fish_audio";
    }) =>
      chatBotApi<{ voices: ChatBotRetellVoiceSearchHit[] }>(
        "search_retell_voices",
        params,
      ),
    onError: (error: Error) => {
      toast.error(error.message || "Failed to search voice options.");
    },
  });
}

export function useAddRetellVoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      providerVoiceId: string;
      voiceName: string;
      publicUserId?: string;
      voiceProvider?: "elevenlabs" | "cartesia" | "minimax" | "fish_audio";
    }) =>
      chatBotApi<{ voiceId: string; voiceName: string }>(
        "add_retell_voice",
        params,
      ),
    onSuccess: () => {
      toast.success("Voice added to your library.");
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.retellVoices(),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add the voice to your library.");
    },
  });
}

export function useConnectClose() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (apiKey: string) =>
      chatBotApi<{ success: boolean }>("connect_close", { apiKey }),
    onSuccess: () => {
      toast.success("Close CRM connected successfully.");
      void queryClient.invalidateQueries({ queryKey: chatBotKeys.agent() });
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.closeStatus(),
      });
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.closeLeadStatuses(),
      });
      invalidateVoiceSetupQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to connect Close CRM.");
    },
  });
}

export function useDisconnectClose() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => chatBotApi<{ success: boolean }>("disconnect_close"),
    onSuccess: () => {
      toast.success("Close CRM disconnected.");
      void queryClient.invalidateQueries({ queryKey: chatBotKeys.agent() });
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.closeStatus(),
      });
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.closeLeadStatuses(),
      });
      invalidateVoiceSetupQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to disconnect Close CRM.");
    },
  });
}

export function useGetCalendlyAuthUrl() {
  return useMutation({
    mutationFn: (returnUrl: string) =>
      chatBotApi<{ url: string }>("get_calendly_auth_url", { returnUrl }),
    onError: (error: Error) => {
      toast.error(error.message || "Failed to get Calendly auth URL.");
    },
  });
}

export function useDisconnectCalendly() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => chatBotApi<{ success: boolean }>("disconnect_calendly"),
    onSuccess: () => {
      toast.success("Calendly disconnected.");
      void queryClient.invalidateQueries({ queryKey: chatBotKeys.agent() });
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.calendlyStatus(),
      });
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.calendarHealth(),
      });
      invalidateVoiceSetupQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to disconnect Calendly.");
    },
  });
}

export function useUpdateBotConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: {
      name?: string;
      botEnabled?: boolean;
      timezone?: string;
      autoOutreachLeadSources?: string[];
      allowedLeadStatuses?: string[];
      calendlyEventTypeSlug?: string | null;
      leadSourceEventTypeMappings?: {
        leadSource: string;
        eventTypeSlug: string;
      }[];
      companyName?: string | null;
      jobTitle?: string | null;
      bio?: string | null;
      yearsOfExperience?: number | null;
      residentState?: string | null;
      nonResidentStates?: string[] | null;
      specialties?: string[] | null;
      website?: string | null;
      location?: string | null;
      remindersEnabled?: boolean;
      responseSchedule?: ResponseSchedule | null;
      dailyMessageLimit?: number | null;
      maxMessagesPerConversation?: number | null;
      voiceEnabled?: boolean;
      voiceFollowUpEnabled?: boolean;
      afterHoursInboundEnabled?: boolean;
      afterHoursStartTime?: string | null;
      afterHoursEndTime?: string | null;
      afterHoursTimezone?: string | null;
      voiceProvider?: string | null;
      voiceId?: string | null;
      voiceFallbackVoiceId?: string | null;
      voiceTransferNumber?: string | null;
      voiceMaxCallDurationSeconds?: number | null;
      voiceVoicemailEnabled?: boolean;
      voiceHumanHandoffEnabled?: boolean;
      voiceQuotedFollowupEnabled?: boolean;
    }) => chatBotApi<{ success: boolean }>("update_config", config),
    onMutate: async (config) => {
      await queryClient.cancelQueries({ queryKey: chatBotKeys.agent() });
      const previous = queryClient.getQueryData<ChatBotAgent | null>(
        chatBotKeys.agent(),
      );
      if (previous) {
        queryClient.setQueryData<ChatBotAgent>(chatBotKeys.agent(), {
          ...previous,
          ...config,
        });
      }
      return { previous };
    },
    onSuccess: () => {
      toast.success("Bot configuration updated.");
      void queryClient.invalidateQueries({ queryKey: chatBotKeys.agent() });
      invalidateVoiceSetupQueries(queryClient);
    },
    onError: (error: Error, _config, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(chatBotKeys.agent(), context.previous);
      }
      toast.error(error.message || "Failed to update bot configuration.");
    },
  });
}

export function useProvisionTeamBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      chatBotApi<{ success: boolean; agentId: string }>("team_provision"),
    onSuccess: () => {
      toast.success("Bot access ready. Loading your bot.");
      queryClient.invalidateQueries({ queryKey: chatBotKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to activate team bot.");
    },
  });
}

// ─── Calendar Health ────────────────────────────────────────────

export function useCalendarHealth(enabled = true) {
  return useQuery({
    queryKey: chatBotKeys.calendarHealth(),
    queryFn: async () => {
      try {
        return await chatBotApi<CalendarHealthResponse>("get_calendar_health");
      } catch (err) {
        // If the external API doesn't support this endpoint yet, return null
        if (err instanceof ChatBotApiError && err.isNotProvisioned) return null;
        throw err;
      }
    },
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

// ─── Monitoring ─────────────────────────────────────────────────

export function useAgentMonitoring(enabled = true) {
  return useQuery({
    queryKey: chatBotKeys.monitoring(),
    queryFn: async () => {
      try {
        return await chatBotApi<AgentMonitoringResponse>("get_monitoring");
      } catch (err) {
        // If the external API doesn't support this endpoint yet, return null
        if (
          err instanceof ChatBotApiError &&
          (err.isNotProvisioned || err.isServiceError)
        )
          return null;
        throw err;
      }
    },
    enabled,
    refetchInterval: (query) => {
      // Stop polling if the endpoint isn't available yet
      if (query.state.data === null) return false;
      return 30_000;
    },
    staleTime: 15_000,
    retry: 1,
  });
}
