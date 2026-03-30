// src/services/discord/discordRecruitNotificationService.ts
// Mirrors src/services/slack/recruitNotificationService.ts for Discord.

import { supabase } from "@/services/base/supabase";

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
}

interface DiscordIntegration {
  id: string;
  imo_id: string;
  recruit_channel_id: string | null;
  recruit_channel_name: string | null;
  is_active: boolean;
  connection_status: string;
}

const COLORS = { GREEN: 0x22c55e, BLUE: 0x3b82f6 } as const;

/**
 * Find the active Discord integration with a recruit channel configured.
 */
export async function findDiscordRecruitIntegration(
  imoId: string,
): Promise<DiscordIntegration | null> {
  const { data, error } = await supabase
    .from("discord_integrations")
    .select(
      "id, imo_id, recruit_channel_id, recruit_channel_name, is_active, connection_status",
    )
    .eq("imo_id", imoId)
    .eq("is_active", true)
    .eq("connection_status", "connected")
    .not("recruit_channel_id", "is", null)
    .maybeSingle();

  if (error || !data) return null;
  return data as DiscordIntegration;
}

/**
 * Build Discord embed for a new recruit notification.
 */
export function buildNewRecruitEmbed(recruit: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  resident_state?: string | null;
  state?: string | null;
  upline_name?: string | null;
}): DiscordEmbed {
  const fullName =
    `${recruit.first_name || ""} ${recruit.last_name || ""}`.trim() ||
    "Unknown";
  const recruitState = recruit.resident_state || recruit.state || null;

  const lines = [
    `**Name:** ${fullName}`,
    `**Email:** ${recruit.email || "N/A"}`,
  ];
  if (recruitState) lines.push(`**Resident State:** ${recruitState}`);
  if (recruit.upline_name) lines.push(`**Upline:** ${recruit.upline_name}`);

  return {
    title: "New Recruit Added",
    description: lines.join("\n"),
    color: COLORS.GREEN,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build Discord embed for NPN received notification.
 */
export function buildNpnReceivedEmbed(recruit: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  npn?: string | null;
  resident_state?: string | null;
  state?: string | null;
  upline_name?: string | null;
}): DiscordEmbed {
  const fullName =
    `${recruit.first_name || ""} ${recruit.last_name || ""}`.trim() ||
    "Unknown";
  const recruitState = recruit.resident_state || recruit.state || null;

  const lines = [
    `**Name:** ${fullName}`,
    `**Email:** ${recruit.email || "N/A"}`,
    `**NPN:** ${recruit.npn || "N/A"}`,
  ];
  if (recruitState) lines.push(`**Resident State:** ${recruitState}`);
  if (recruit.upline_name) lines.push(`**Upline:** ${recruit.upline_name}`);

  return {
    title: "NPN Received — Please send email #2",
    description: lines.join("\n"),
    color: COLORS.BLUE,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check if a Discord notification of the given type has been sent for a recruit.
 */
export async function checkDiscordNotificationSent(
  recruitId: string,
  notificationType: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("discord_messages")
    .select("id")
    .eq("related_entity_id", recruitId)
    .eq("related_entity_type", "recruit")
    .eq("notification_type", notificationType)
    .in("status", ["sent", "delivered"])
    .limit(1);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/**
 * Send a recruit notification to Discord via the discord-send-message edge function.
 */
export async function sendDiscordRecruitNotification(params: {
  integrationId: string;
  channelId: string;
  embed: DiscordEmbed;
  notificationType: string;
  recruitId: string;
  imoId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke(
    "discord-send-message",
    {
      body: {
        integrationId: params.integrationId,
        channelId: params.channelId,
        embeds: [params.embed],
        notificationType: params.notificationType,
        relatedEntityType: "recruit",
        relatedEntityId: params.recruitId,
        imoId: params.imoId,
      },
    },
  );

  if (error) return { ok: false, error: error.message };
  return data;
}
