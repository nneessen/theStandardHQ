// Shared Discord API utilities for edge functions
// Uses Bot token auth — no OAuth needed

const DISCORD_API = "https://discord.com/api/v10";

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string; icon_url?: string };
  thumbnail?: { url: string };
  timestamp?: string;
}

interface DiscordMessagePayload {
  content?: string;
  embeds?: DiscordEmbed[];
}

interface DiscordMessageResponse {
  id: string;
  channel_id: string;
  content: string;
  timestamp: string;
}

interface DiscordSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a message to a Discord channel
 */
export async function sendDiscordMessage(
  botToken: string,
  channelId: string,
  payload: DiscordMessagePayload,
): Promise<DiscordSendResult> {
  const response = await fetch(
    `${DISCORD_API}/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    await response.text(); // consume body
    console.error(`[discord] Send failed: ${response.status}`);
    return { ok: false, error: `Discord API error: ${response.status}` };
  }

  const data = (await response.json()) as DiscordMessageResponse;
  return { ok: true, messageId: data.id };
}

/**
 * Edit an existing Discord message
 */
export async function editDiscordMessage(
  botToken: string,
  channelId: string,
  messageId: string,
  payload: DiscordMessagePayload,
): Promise<DiscordSendResult> {
  const response = await fetch(
    `${DISCORD_API}/channels/${channelId}/messages/${messageId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    await response.text(); // consume body
    console.error(`[discord] Edit failed: ${response.status}`);
    return { ok: false, error: `Discord API error: ${response.status}` };
  }

  const data = (await response.json()) as DiscordMessageResponse;
  return { ok: true, messageId: data.id };
}

/**
 * Verify a bot token by calling /users/@me
 */
export async function verifyBotToken(
  botToken: string,
): Promise<{ ok: boolean; username?: string; error?: string }> {
  const response = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bot ${botToken}` },
  });

  if (!response.ok) {
    await response.text(); // consume body
    return { ok: false, error: `Discord API error: ${response.status}` };
  }

  const data = await response.json();
  return { ok: true, username: data.username };
}

/**
 * List channels in a guild
 */
export async function listGuildChannels(
  botToken: string,
  guildId: string,
): Promise<{ id: string; name: string; type: number }[]> {
  const response = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${botToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to list channels: ${response.status}`);
  }

  const channels = await response.json();
  // Type 0 = text channel, filter out voice/category/etc
  return channels
    .filter((ch: { type: number }) => ch.type === 0)
    .map((ch: { id: string; name: string; type: number }) => ({
      id: ch.id,
      name: ch.name,
      type: ch.type,
    }));
}

// ── Embed color constants ──
export const COLORS = {
  GREEN: 0x22c55e,
  BLUE: 0x3b82f6,
  GOLD: 0xeab308,
  RED: 0xef4444,
  PURPLE: 0xa855f7,
  ZINC: 0x71717a,
} as const;

// ── Formatting helpers ──

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getRankEmoji(rank: number): string {
  switch (rank) {
    case 1:
      return "🥇";
    case 2:
      return "🥈";
    case 3:
      return "🥉";
    default:
      return `**${rank}.**`;
  }
}

export type { DiscordEmbed, DiscordMessagePayload, DiscordSendResult };
