// src/features/chat-bot/hooks/useCloseSmartViews.ts
// Close CRM Smart Views fetched via the chat-bot-api edge function.
// Relocated from the removed channel-orchestration feature; consumed by the
// AI Voice Agent rules card (VoiceCallRulesCard), which already sources its
// other Close metadata hooks from this feature.

import { useQuery } from "@tanstack/react-query";
import { chatBotApi, ChatBotApiError } from "./useChatBot";

export interface CloseSmartView {
  id: string;
  /** Close API returns `label`; kept as `label` to match the API response. */
  label: string;
  type?: string;
  shared?: boolean;
}

const closeSmartViewsKey = ["chat-bot", "close-smart-views"] as const;

export function useCloseSmartViews(enabled = true) {
  return useQuery<CloseSmartView[], ChatBotApiError>({
    queryKey: closeSmartViewsKey,
    queryFn: async () => {
      const result = await chatBotApi<{ smartViews: CloseSmartView[] }>(
        "get_close_smart_views",
      );
      return result.smartViews ?? [];
    },
    enabled,
    staleTime: 300_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError)
        return false;
      return failureCount < 1;
    },
  });
}
