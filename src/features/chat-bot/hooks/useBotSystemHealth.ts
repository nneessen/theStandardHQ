// src/features/chat-bot/hooks/useBotSystemHealth.ts
// Polls the standard-chat-bot system-wide monitoring endpoint every 30s.
// Goes through the existing chat-bot-api edge function proxy so the
// EXTERNAL_API_KEY never touches the browser bundle.

import { useQuery } from "@tanstack/react-query";
import type { SystemMonitoringResponse } from "@/types/chat-bot-monitoring";
import { chatBotApi, ChatBotApiError } from "./useChatBot";

const REFETCH_INTERVAL_MS = 30_000;

export const botHealthKeys = {
  all: ["chat-bot", "monitoring"] as const,
  systemHealth: () => [...botHealthKeys.all, "system-health"] as const,
};

/**
 * System-wide health query for the Bot Health admin page.
 *
 * Behavior:
 * - Polls every 30s while mounted (no websockets, no SSE — per spec).
 * - Refetches on window focus so tab-switching surfaces fresh data.
 * - staleTime 0 → TanStack Query will always show the latest successful
 *   snapshot even after a failing refetch (v5 semantics).
 * - Does NOT retry on service / transport errors: we want the "Bot API
 *   unreachable" banner to surface immediately rather than hide behind
 *   three silent retries.
 */
export function useBotSystemHealth() {
  return useQuery<SystemMonitoringResponse, ChatBotApiError>({
    queryKey: botHealthKeys.systemHealth(),
    queryFn: () => chatBotApi<SystemMonitoringResponse>("get_system_health"),
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: (failureCount, error) => {
      if (
        error instanceof ChatBotApiError &&
        (error.isServiceError || error.isTransportError)
      ) {
        return false;
      }
      return failureCount < 1;
    },
  });
}
