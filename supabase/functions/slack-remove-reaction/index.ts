// supabase/functions/slack-remove-reaction/index.ts
// Removes a reaction (emoji) from a Slack message

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import {
  resolveAuthorizedSlackIntegration,
  requireSlackRequestContext,
} from "../_shared/slack-auth.ts";

interface RemoveReactionPayload {
  imoId: string;
  channelId: string;
  messageTs: string;
  emojiName: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    console.log("[slack-remove-reaction] Function invoked");
    const authContext = await requireSlackRequestContext(req, corsHeaders);
    if (authContext instanceof Response) {
      return authContext;
    }

    const body: RemoveReactionPayload = await req.json();
    const { imoId, channelId, messageTs, emojiName } = body;

    if (!imoId || !channelId || !messageTs || !emojiName) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "Missing required fields: imoId, channelId, messageTs, emojiName",
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
      { imoId },
    );
    if (integrationResult instanceof Response) {
      return integrationResult;
    }
    const { integration } = integrationResult;

    // Decrypt bot token
    const botToken = await decrypt(integration.bot_token_encrypted);

    // Remove reaction via Slack API
    const response = await fetch("https://slack.com/api/reactions.remove", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channelId,
        timestamp: messageTs,
        name: emojiName,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      // Handle common error - no_reaction
      if (data.error === "no_reaction") {
        return new Response(JSON.stringify({ ok: true, noReaction: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.error("[slack-remove-reaction] Slack API error:", data.error);
      return new Response(JSON.stringify({ ok: false, error: data.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(
      `[slack-remove-reaction] Removed :${emojiName}: from message ${messageTs}`,
    );

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[slack-remove-reaction] Unexpected error:", err);
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
