// supabase/functions/slack-join-channel/index.ts
// Joins the bot to a Slack channel

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import {
  resolveAuthorizedSlackIntegration,
  requireSlackRequestContext,
} from "../_shared/slack-auth.ts";

interface SlackJoinResponse {
  ok: boolean;
  channel?: {
    id: string;
    name: string;
    is_member: boolean;
  };
  error?: string;
  warning?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    console.log("[slack-join-channel] Function invoked");
    const authContext = await requireSlackRequestContext(req, corsHeaders);
    if (authContext instanceof Response) {
      return authContext;
    }

    const body = await req.json();
    const { imoId, integrationId, channelId } = body;

    if ((!imoId && !integrationId) || !channelId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing imoId/integrationId or channelId",
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

    // Decrypt bot token
    const botToken = await decrypt(integration.bot_token_encrypted);

    // Join channel using Slack API
    const response = await fetch("https://slack.com/api/conversations.join", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: channelId }),
    });

    const data: SlackJoinResponse = await response.json();

    if (!data.ok) {
      console.error(
        `[slack-join-channel] Failed to join channel: ${data.error}`,
      );

      // Handle specific error cases
      if (data.error === "channel_not_found") {
        return new Response(
          JSON.stringify({ ok: false, error: "Channel not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (data.error === "is_private") {
        return new Response(
          JSON.stringify({
            ok: false,
            error:
              "Cannot join private channel. Please invite the bot manually.",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Update integration status if token is invalid
      if (data.error === "token_revoked" || data.error === "invalid_auth") {
        await authContext.supabaseAdmin
          .from("slack_integrations")
          .update({
            connection_status: "error",
            last_error: data.error,
          })
          .eq("id", integration.id);
      }

      return new Response(JSON.stringify({ ok: false, error: data.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(
      `[slack-join-channel] Bot joined channel ${data.channel?.name || channelId}`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        channel: {
          id: data.channel?.id || channelId,
          name: data.channel?.name,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[slack-join-channel] Unexpected error:", err);
    const corsHeaders = getCorsHeaders(req.headers.get("origin"));
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
