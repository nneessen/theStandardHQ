// src/features/chat-bot/hooks/useChatBotAnalytics.ts
// TanStack Query hooks for bot analytics & attribution

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { chatBotKeys, chatBotApi } from "./useChatBot";

// ─── Types ──────────────────────────────────────────────────────

export interface ChatBotAnalytics {
  conversations: {
    total: number;
    byStatus: Record<string, number>;
    byChannel: Record<string, number>;
    avgMessagesPerConvo: number;
    suppressionRate: number;
    staleRate: number;
  };
  engagement: {
    responseRate: number;
    multiTurnRate: number;
    avgFirstResponseMin: number;
    avgObjectionCount: number;
    hardNoRate: number;
  };
  appointments: {
    total: number;
    bookingRate: number;
    showRate: number;
    cancelRate: number;
    avgDaysToAppointment: number;
  };
  messagePerformance: {
    trackedOutboundCount: number;
    resolvedOutcomeCount: number;
    resolvedOutcomeRate: number;
    positiveRate: number;
    negativeRate: number;
    schedulingRate: number;
    optOutRate: number;
    topReplyCategories: {
      category: string;
      sentCount: number;
      resolvedCount: number;
      positiveRate: number;
      negativeRate: number;
      schedulingRate: number;
      optOutRate: number;
    }[];
  };
  timeline: {
    date: string;
    conversations: number;
    appointments: number;
    conversions: number;
  }[];
}

export interface BotAttribution {
  id: string;
  policy_id: string;
  attribution_type: "bot_assisted" | "bot_converted";
  match_method: "auto_phone" | "auto_name" | "manual";
  confidence_score: number;
  lead_name: string | null;
  conversation_started_at: string | null;
  external_conversation_id: string;
  external_appointment_id: string | null;
  created_at: string;
  policies: {
    id: string;
    policy_number: string | null;
    monthly_premium: number;
    annual_premium: number | null;
    effective_date: string;
    status: string;
    clients: {
      name: string | null;
    } | null;
  } | null;
}

export interface CollectiveAnalytics {
  activeBots: number;
  totalConversations: number;
  totalAppointments: number;
  totalAttributions: number;
  botConverted: number;
  botAssisted: number;
  totalPremium: number;
  bookingRate: number;
  conversionRate: number;
  timeline: {
    date: string;
    conversations: number;
    appointments: number;
    conversions: number;
  }[];
}

// ─── Query Key Extensions ───────────────────────────────────────

export const analyticsKeys = {
  analytics: (from: string, to: string) =>
    [...chatBotKeys.all, "analytics", from, to] as const,
  attributions: (from: string, to: string) =>
    [...chatBotKeys.all, "attributions", from, to] as const,
  collective: (from: string, to: string) =>
    [...chatBotKeys.all, "collective", from, to] as const,
};

// ─── Personal Analytics Queries ─────────────────────────────────

export function useChatBotAnalytics(
  from: string,
  to: string,
  options?: { enabled?: boolean },
) {
  return useQuery<ChatBotAnalytics>({
    queryKey: analyticsKeys.analytics(from, to),
    queryFn: () => chatBotApi<ChatBotAnalytics>("get_analytics", { from, to }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: options?.enabled ?? true,
  });
}

export function useBotAttributions(from: string, to: string) {
  return useQuery<BotAttribution[]>({
    queryKey: analyticsKeys.attributions(from, to),
    queryFn: () =>
      chatBotApi<BotAttribution[]>("get_attributions", { from, to }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── Attribution Mutations ──────────────────────────────────────

export function useLinkAttribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      policyId: string;
      conversationId: string;
      appointmentId?: string;
      leadName?: string;
    }) => chatBotApi<{ success: boolean }>("link_attribution", params),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...chatBotKeys.all, "attributions"],
      });
    },
  });
}

export function useUnlinkAttribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attributionId: string) =>
      chatBotApi<{ success: boolean }>("unlink_attribution", {
        attributionId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...chatBotKeys.all, "attributions"],
      });
    },
  });
}

// ─── Collective Analytics (no JWT required) ─────────────────────

export function useCollectiveAnalytics(
  from: string,
  to: string,
  options?: { refetchInterval?: number; enabled?: boolean },
) {
  return useQuery<CollectiveAnalytics>({
    queryKey: analyticsKeys.collective(from, to),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "bot-collective-analytics",
        { body: { from, to } },
      );
      if (error) throw error;
      return data as CollectiveAnalytics;
    },
    enabled: options?.enabled ?? true,
    staleTime: 10 * 60 * 1000,
    retry: 1,
    refetchInterval: options?.refetchInterval,
  });
}
