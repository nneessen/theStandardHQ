// src/hooks/discord/useRecruitDiscordNotification.ts
// React Query hooks for recruit Discord channel notifications.
// Mirrors src/hooks/slack/useRecruitSlackNotification.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import {
  checkDiscordNotificationSent,
  sendDiscordRecruitNotification,
} from "@/services/discord/discordRecruitNotificationService";
import { toast } from "sonner";

/**
 * Query whether new_recruit / npn_received Discord notifications have been sent.
 */
export function useRecruitDiscordNotificationStatus(
  recruitId: string | undefined,
) {
  return useQuery({
    queryKey: ["discord", "recruit-notification-status", recruitId],
    queryFn: async () => {
      if (!recruitId) return { newRecruitSent: false, npnReceivedSent: false };

      const { data, error } = await supabase
        .from("discord_messages")
        .select("notification_type")
        .eq("related_entity_id", recruitId)
        .eq("related_entity_type", "recruit")
        .in("notification_type", ["new_recruit", "npn_received"])
        .in("status", ["sent", "delivered"]);

      if (error) return { newRecruitSent: false, npnReceivedSent: false };

      const types = (data || []).map((m) => m.notification_type);
      return {
        newRecruitSent: types.includes("new_recruit"),
        npnReceivedSent: types.includes("npn_received"),
      };
    },
    enabled: !!recruitId,
    staleTime: 30 * 1000,
  });
}

/**
 * Manually send a recruit Discord notification.
 */
export function useSendRecruitDiscordNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      integrationId: string;
      channelId: string;
      embed: {
        title?: string;
        description?: string;
        color?: number;
        timestamp?: string;
      };
      notificationType: string;
      recruitId: string;
      imoId: string;
    }) => {
      const alreadySent = await checkDiscordNotificationSent(
        params.recruitId,
        params.notificationType,
      );
      if (alreadySent) {
        throw new Error("This notification has already been sent.");
      }

      const result = await sendDiscordRecruitNotification(params);
      if (!result.ok) {
        throw new Error(result.error || "Failed to send Discord notification");
      }
      return result;
    },
    onSuccess: (_, variables) => {
      toast.success("Discord notification sent successfully");
      queryClient.invalidateQueries({
        queryKey: [
          "discord",
          "recruit-notification-status",
          variables.recruitId,
        ],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send Discord notification");
    },
  });
}
