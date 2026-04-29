// src/services/slack/recruitNotificationService.ts
// Service for sending recruit-related Slack notifications.
//
// The recruit notifications channel is configured per-integration via
// `slack_integrations.recruit_channel_id` (set in Settings → Integrations →
// Slack). This replaced an older hard-coded `#new-agent-testing-odette`
// lookup that only worked for the Self Made workspace.

import { supabase } from "@/services/base/supabase";
import { slackService } from "./slackService";
import type {
  SlackIntegration,
  SlackChannel,
  SlackBlock,
  SlackNotificationType,
} from "@/types/slack.types";

/**
 * Pick the integration that should receive recruit notifications.
 * Returns the first connected integration with a configured
 * `recruit_channel_id`. Caller is expected to scope `integrations` to the
 * current user's IMO (e.g. via `useSlackIntegrations()`).
 */
export function findRecruitIntegration(
  integrations: SlackIntegration[],
): SlackIntegration | null {
  return (
    integrations.find((i) => i.isConnected && !!i.recruit_channel_id) ?? null
  );
}

/**
 * Resolve the configured recruit notifications channel from the workspace's
 * channel list. Looks up the channel by the integration's stored
 * `recruit_channel_id`.
 */
export function findRecruitChannel(
  integration: Pick<SlackIntegration, "recruit_channel_id"> | null | undefined,
  channels: SlackChannel[],
): SlackChannel | null {
  if (!integration?.recruit_channel_id) return null;
  return (
    channels.find(
      (c) => c.id === integration.recruit_channel_id && !c.is_archived,
    ) ?? null
  );
}

/**
 * Build Block Kit payload for a new recruit notification
 */
export function buildNewRecruitMessage(recruit: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  resident_state?: string | null;
  state?: string | null;
  upline_name?: string | null;
}): { text: string; blocks: SlackBlock[] } {
  const fullName =
    `${recruit.first_name || ""} ${recruit.last_name || ""}`.trim() ||
    "Unknown";
  const text = `New Recruit: ${fullName}`;
  const recruitState = recruit.resident_state || recruit.state || null;

  const detailLines = [
    `*Name:*  ${fullName}`,
    `*Email:*  ${recruit.email || "N/A"}`,
  ];
  if (recruitState) {
    detailLines.push(`*Resident State:*  ${recruitState}`);
  }
  if (recruit.upline_name) {
    detailLines.push(`*Upline:*  ${recruit.upline_name}`);
  }

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:new: *New Recruit Added*\n\n${detailLines.join("\n")}`,
      },
    },
    { type: "divider" },
  ];

  return { text, blocks };
}

/**
 * Build Block Kit payload for NPN received notification
 */
export function buildNpnReceivedMessage(recruit: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  npn?: string | null;
  resident_state?: string | null;
  state?: string | null;
  upline_name?: string | null;
}): { text: string; blocks: SlackBlock[] } {
  const fullName =
    `${recruit.first_name || ""} ${recruit.last_name || ""}`.trim() ||
    "Unknown";
  const text = `NPN Received: ${fullName}`;
  const recruitState = recruit.resident_state || recruit.state || null;

  const detailLines = [
    `*Name:*  ${fullName}`,
    `*Email:*  ${recruit.email || "N/A"}`,
    `*NPN:*  ${recruit.npn || "N/A"}`,
  ];
  if (recruitState) {
    detailLines.push(`*Resident State:*  ${recruitState}`);
  }
  if (recruit.upline_name) {
    detailLines.push(`*Upline:*  ${recruit.upline_name}`);
  }

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:white_check_mark: *NPN Received — Please send email #2*\n\n${detailLines.join("\n")}`,
      },
    },
    { type: "divider" },
  ];

  return { text, blocks };
}

/**
 * Check if a notification of the given type has already been sent for a recruit
 */
export async function checkNotificationSent(
  recruitId: string,
  notificationType: SlackNotificationType,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("slack_messages")
    .select("id")
    .eq("related_entity_id", recruitId)
    .eq("related_entity_type", "recruit")
    .eq("notification_type", notificationType)
    .in("status", ["sent", "delivered"])
    .limit(1);

  if (error) {
    console.error(
      "[recruitNotificationService] checkNotificationSent error:",
      error,
    );
    return false;
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Send a recruit notification via the slack-send-message edge function
 */
export async function sendRecruitNotification(params: {
  integrationId: string;
  channelId: string;
  text: string;
  blocks: SlackBlock[];
  notificationType: SlackNotificationType;
  recruitId: string;
  imoId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke(
    "slack-send-message",
    {
      body: {
        integrationId: params.integrationId,
        channelId: params.channelId,
        text: params.text,
        blocks: params.blocks,
        notificationType: params.notificationType,
        relatedEntityType: "recruit",
        relatedEntityId: params.recruitId,
        imoId: params.imoId,
      },
    },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return data;
}

/**
 * Full auto-post flow: find integration, resolve channel from configured
 * `recruit_channel_id`, check duplicates, send. Fails silently (logs errors,
 * never throws). Skips if the IMO has not configured a recruit channel.
 */
export async function autoPostRecruitNotification(
  recruit: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    resident_state?: string | null;
    state?: string | null;
    npn?: string | null;
    upline_name?: string | null;
  },
  notificationType: "new_recruit" | "npn_received",
  imoId: string,
): Promise<void> {
  try {
    const integrations = await slackService.getIntegrations(imoId);
    const integration = findRecruitIntegration(integrations);
    if (!integration || !integration.recruit_channel_id) {
      console.log(
        "[recruitNotificationService] No recruit channel configured for IMO, skipping auto-post",
      );
      return;
    }

    const alreadySent = await checkNotificationSent(
      recruit.id,
      notificationType,
    );
    if (alreadySent) {
      console.log(
        `[recruitNotificationService] ${notificationType} already sent for recruit ${recruit.id}, skipping`,
      );
      return;
    }

    const message =
      notificationType === "new_recruit"
        ? buildNewRecruitMessage(recruit)
        : buildNpnReceivedMessage(recruit);

    const result = await sendRecruitNotification({
      integrationId: integration.id,
      channelId: integration.recruit_channel_id,
      text: message.text,
      blocks: message.blocks,
      notificationType,
      recruitId: recruit.id,
      imoId,
    });

    if (!result.ok) {
      console.error(
        "[recruitNotificationService] Auto-post failed:",
        result.error,
      );
    }
  } catch (err) {
    console.error("[recruitNotificationService] Auto-post error:", err);
  }
}
