// supabase/functions/discord-send-message/index.ts
// Generic Discord message sender — mirrors slack-send-message.
// Accepts embeds + optional plain text, records in discord_messages.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import { sendDiscordMessage, type DiscordEmbed } from "../_shared/discord.ts";

interface SendMessageRequest {
  imoId?: string;
  integrationId?: string;
  channelId: string;
  content?: string;
  embeds?: DiscordEmbed[];
  notificationType?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body: SendMessageRequest = await req.json();
    const {
      imoId,
      integrationId,
      channelId,
      content,
      embeds,
      notificationType,
      relatedEntityType,
      relatedEntityId,
    } = body;

    if ((!imoId && !integrationId) || !channelId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing required fields: integrationId/imoId, channelId",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!content && (!embeds || embeds.length === 0)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Must provide content or embeds" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find Discord integration
    let query = supabase
      .from("discord_integrations")
      .select("*")
      .eq("is_active", true)
      .eq("connection_status", "connected");

    if (integrationId) {
      query = query.eq("id", integrationId);
    } else {
      query = query.eq("imo_id", imoId);
    }

    const { data: integration, error: fetchError } = await query.maybeSingle();

    if (fetchError || !integration) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No active Discord integration found",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const botToken = await decrypt(integration.bot_token_encrypted);

    // Send to Discord
    const result = await sendDiscordMessage(botToken, channelId, {
      content: content || undefined,
      embeds: embeds || undefined,
    });

    // Audit in discord_messages
    await supabase.from("discord_messages").insert({
      imo_id: imoId || integration.imo_id,
      discord_integration_id: integration.id,
      channel_id: channelId,
      notification_type: notificationType || "general",
      message_id: result.messageId || null,
      status: result.ok ? "sent" : "failed",
      message_text: content || embeds?.[0]?.description || "",
      related_entity_type: relatedEntityType || null,
      related_entity_id: relatedEntityId || null,
      sent_at: result.ok ? new Date().toISOString() : null,
      error_message: result.error || null,
    });

    return new Response(
      JSON.stringify({
        ok: result.ok,
        messageId: result.messageId,
        error: result.error,
      }),
      {
        status: result.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[discord-send-message] Unexpected error:", err);
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
