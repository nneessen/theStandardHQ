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
 * Channel name patterns we'll auto-pick as the recruit channel when
 * `slack_integrations.recruit_channel_id` is not yet configured. Includes
 * the legacy hard-coded Self Made channel so existing users continue to
 * work without re-configuring, plus a few common conventions any IMO is
 * likely to have. Once a user sets the channel via Settings, the explicit
 * choice always wins.
 */
const RECRUIT_CHANNEL_NAME_FALLBACKS = [
  "new-agent-testing-odette",
  "new-agents",
  "new-recruits",
  "recruiting",
  "recruits",
  "recruit-notifications",
];

function autoPickRecruitChannel(channels: SlackChannel[]): SlackChannel | null {
  for (const name of RECRUIT_CHANNEL_NAME_FALLBACKS) {
    const match = channels.find((c) => c.name === name && !c.is_archived);
    if (match) return match;
  }
  // Last-ditch: any non-archived channel whose name contains "recruit"
  return (
    channels.find((c) => !c.is_archived && /recruit/i.test(c.name)) ?? null
  );
}

/**
 * Pick the integration that should receive recruit notifications. Caller is
 * expected to scope `integrations` to the current user's IMO (e.g. via
 * `useSlackIntegrations()`). Returns the first connected integration with a
 * configured `recruit_channel_id`, or — if none configured — falls back to
 * the first connected integration so the channel-name fallback can attempt
 * to auto-pick a channel.
 */
export function findRecruitIntegration(
  integrations: SlackIntegration[],
): SlackIntegration | null {
  const configured = integrations.find(
    (i) => i.isConnected && !!i.recruit_channel_id,
  );
  if (configured) return configured;
  return integrations.find((i) => i.isConnected) ?? null;
}

/**
 * Resolve the recruit notifications channel from the workspace's channel
 * list. Prefers the integration's stored `recruit_channel_id` (set via the
 * Settings picker). If that isn't configured yet, auto-picks a channel by
 * common naming convention (legacy `#new-agent-testing-odette`, plus
 * `#recruiting`, `#new-agents`, etc.) so the buttons keep working for IMOs
 * that haven't configured the channel explicitly.
 */
export function findRecruitChannel(
  integration: Pick<SlackIntegration, "recruit_channel_id"> | null | undefined,
  channels: SlackChannel[],
): SlackChannel | null {
  if (integration?.recruit_channel_id) {
    const explicit = channels.find(
      (c) => c.id === integration.recruit_channel_id && !c.is_archived,
    );
    if (explicit) return explicit;
  }
  return autoPickRecruitChannel(channels);
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
    if (!integration) {
      console.log(
        "[recruitNotificationService] No connected Slack integration for IMO, skipping auto-post",
      );
      return;
    }

    // Resolve channel id: explicit config wins, else fall back by name lookup.
    let channelId = integration.recruit_channel_id ?? null;
    if (!channelId) {
      const channels = await slackService.listChannelsById(integration.id);
      const fallback = findRecruitChannel(integration, channels);
      channelId = fallback?.id ?? null;
    }
    if (!channelId) {
      console.log(
        "[recruitNotificationService] No recruit channel configured or discoverable for IMO, skipping auto-post",
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
      channelId,
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
