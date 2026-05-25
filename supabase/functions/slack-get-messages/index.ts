// supabase/functions/slack-get-messages/index.ts
// Fetches message history from a Slack channel

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import {
  resolveAuthorizedSlackIntegration,
  requireSlackRequestContext,
} from "../_shared/slack-auth.ts";

interface SlackMessage {
  type: string;
  user?: string;
  text: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
  reactions?: Array<{
    name: string;
    count: number;
  }>;
  files?: Array<{
    id: string;
    name: string;
    mimetype: string;
    url_private: string;
  }>;
}

interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  profile?: {
    image_48?: string;
    display_name?: string;
  };
}

interface SlackMessagesResponse {
  ok: boolean;
  messages?: SlackMessage[];
  has_more?: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const authContext = await requireSlackRequestContext(req, corsHeaders);
    if (authContext instanceof Response) {
      return authContext;
    }

    const body = await req.json();
    const { imoId, integrationId, channelId, limit = 50, cursor } = body;

    if ((!imoId && !integrationId) || !channelId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing integrationId/imoId or channelId",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const integrationResult = await resolveAuthorizedSlackIntegration(
      authContext,
      corsHeaders,
      { imoId, integrationId },
    );
    if (integrationResult instanceof Response) {
      return integrationResult;
    }
    const { integration } = integrationResult;

    const botToken = await decrypt(integration.bot_token_encrypted);

    // Fetch messages from Slack
    const params = new URLSearchParams({
      channel: channelId,
      limit: String(limit),
    });
    if (cursor) {
      params.set("cursor", cursor);
    }

    const messagesRes = await fetch(
      `https://slack.com/api/conversations.history?${params}`,
      {
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    const messagesData: SlackMessagesResponse = await messagesRes.json();

    if (!messagesData.ok) {
      console.error(
        "[slack-get-messages] Slack API error:",
        messagesData.error,
        "for channel:",
        channelId,
      );

      // Map common Slack errors to user-friendly messages
      let userMessage = messagesData.error || "Failed to fetch messages";
      if (messagesData.error === "not_in_channel") {
        userMessage =
          "Bot is not a member of this channel. Please invite the bot first.";
      } else if (messagesData.error === "channel_not_found") {
        userMessage = "Channel not found or has been deleted.";
      } else if (
        messagesData.error === "token_revoked" ||
        messagesData.error === "invalid_auth"
      ) {
        userMessage = "Slack connection expired. Please reconnect in Settings.";
      }

      return new Response(
        JSON.stringify({
          ok: false,
          error: userMessage,
          slackError: messagesData.error,
        }),
        {
          status: 200, // Return 200 with ok:false so client can handle gracefully
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get unique user IDs to fetch user info
    const userIds = new Set<string>();
    messagesData.messages?.forEach((msg) => {
      if (msg.user) userIds.add(msg.user);
    });

    // Fetch user info for all users
    const userMap: Record<string, SlackUser> = {};
    for (const userId of userIds) {
      const userRes = await fetch(
        `https://slack.com/api/users.info?user=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${botToken}`,
          },
        },
      );
      const userData = await userRes.json();
      if (userData.ok && userData.user) {
        userMap[userId] = {
          id: userData.user.id,
          name: userData.user.name,
          real_name: userData.user.real_name,
          profile: {
            image_48: userData.user.profile?.image_48,
            display_name: userData.user.profile?.display_name,
          },
        };
      }
    }

    // Format messages with user info
    const messages = (messagesData.messages || []).map((msg) => ({
      id: msg.ts,
      text: msg.text,
      timestamp: msg.ts,
      threadTs: msg.thread_ts,
      replyCount: msg.reply_count,
      user: msg.user ? userMap[msg.user] : null,
      reactions: msg.reactions,
      files: msg.files?.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.mimetype,
      })),
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        messages,
        hasMore: messagesData.has_more || false,
        nextCursor: messagesData.response_metadata?.next_cursor,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[slack-get-messages] Error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
