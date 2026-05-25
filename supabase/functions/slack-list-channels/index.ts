// supabase/functions/slack-list-channels/index.ts
// Lists Slack channels the bot can access

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import {
  resolveAuthorizedSlackIntegration,
  requireSlackRequestContext,
} from "../_shared/slack-auth.ts";

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
  is_archived: boolean;
  num_members?: number;
  purpose?: {
    value: string;
  };
  topic?: {
    value: string;
  };
}

interface SlackChannelsResponse {
  ok: boolean;
  channels?: SlackChannel[];
  response_metadata?: {
    next_cursor?: string;
  };
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    console.log("[slack-list-channels] Function invoked");
    const authContext = await requireSlackRequestContext(req, corsHeaders);
    if (authContext instanceof Response) {
      return authContext;
    }

    const body = await req.json();
    const { imoId, integrationId } = body;

    if (!imoId && !integrationId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing imoId or integrationId" }),
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

    // Decrypt bot token
    const botToken = await decrypt(integration.bot_token_encrypted);

    // Slack's `conversations.list` requires `channels:read` for public and
    // `groups:read` for private channels. If you pass `types=public_channel,
    // private_channel` and lack EITHER scope, the whole call returns
    // `missing_scope` — even for the channels you DO have scope for. To stay
    // resilient against partial-scope installs (e.g. an older Slack app that
    // never asked for `groups:read`), query the two types separately and
    // treat each as best-effort.
    async function fetchAllChannels(
      channelType: "public_channel" | "private_channel",
    ): Promise<{
      channels: SlackChannel[];
      fatalError?: SlackChannelsResponse["error"];
    }> {
      const out: SlackChannel[] = [];
      let cursor: string | undefined;
      do {
        const params = new URLSearchParams({
          types: channelType,
          exclude_archived: "true",
          limit: "200",
        });
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(
          `https://slack.com/api/conversations.list?${params}`,
          {
            headers: {
              Authorization: `Bearer ${botToken}`,
              "Content-Type": "application/json",
            },
          },
        );
        const data: SlackChannelsResponse = await res.json();

        if (!data.ok) {
          // missing_scope on the private-channel call is expected for
          // narrow-scope installs and is NOT fatal — just return empty so the
          // caller can still serve public channels. Auth/token errors ARE
          // fatal.
          if (data.error === "missing_scope") {
            console.warn(
              `[slack-list-channels] ${channelType} list returned missing_scope; skipping`,
            );
            return { channels: out };
          }
          return { channels: out, fatalError: data.error };
        }
        if (data.channels) out.push(...data.channels);
        cursor = data.response_metadata?.next_cursor;
      } while (cursor);
      return { channels: out };
    }

    const publicResult = await fetchAllChannels("public_channel");

    if (publicResult.fatalError) {
      const errCode = publicResult.fatalError;
      console.error("[slack-list-channels] Slack API error:", errCode);

      if (errCode === "token_revoked" || errCode === "invalid_auth") {
        await authContext.supabaseAdmin
          .from("slack_integrations")
          .update({
            connection_status: "error",
            last_error: errCode,
          })
          .eq("id", integration.id);
      }

      let userMessage = errCode || "Failed to list channels";
      if (errCode === "missing_scope") {
        userMessage =
          "The Slack app is missing the 'channels:read' permission. Please reconnect Slack in Settings.";
      } else if (errCode === "token_revoked" || errCode === "invalid_auth") {
        userMessage = "Slack connection expired. Please reconnect in Settings.";
      } else if (errCode === "not_authed") {
        userMessage =
          "Slack authentication failed. Please reconnect in Settings.";
      }

      return new Response(
        JSON.stringify({ ok: false, error: userMessage, slackError: errCode }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const privateResult = await fetchAllChannels("private_channel");
    if (privateResult.fatalError) {
      console.warn(
        "[slack-list-channels] private_channel fetch non-fatal error:",
        privateResult.fatalError,
      );
    }

    const allChannels: SlackChannel[] = [
      ...publicResult.channels,
      ...privateResult.channels,
    ];

    console.log(
      `[slack-list-channels] Found ${allChannels.length} channels (${publicResult.channels.length} public, ${privateResult.channels.length} private) for integration ${integrationId || imoId}`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        channels: allChannels.map((ch) => ({
          id: ch.id,
          name: ch.name,
          is_private: ch.is_private,
          is_member: ch.is_member,
          is_archived: ch.is_archived,
          num_members: ch.num_members,
          purpose: ch.purpose?.value,
          topic: ch.topic?.value,
        })),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[slack-list-channels] Unexpected error:", err);
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
