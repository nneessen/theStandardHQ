// supabase/functions/slack-send-message/index.ts
// Sends a message to a Slack channel

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import {
  resolveAuthorizedSlackIntegration,
  requireSlackRequestContext,
} from "../_shared/slack-auth.ts";

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  elements?: Array<{
    type: string;
    text?: string;
  }>;
}

interface SendMessageRequest {
  imoId?: string;
  integrationId?: string;
  channelId: string;
  text: string;
  blocks?: SlackBlock[];
  threadTs?: string;
  notificationType?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  channelConfigId?: string;
}

interface SlackPostMessageResponse {
  ok: boolean;
  channel?: string;
  ts?: string;
  message?: {
    text: string;
    username: string;
    bot_id: string;
    type: string;
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
    console.log("[slack-send-message] Function invoked");
    const authContext = await requireSlackRequestContext(req, corsHeaders);
    if (authContext instanceof Response) {
      return authContext;
    }

    const body: SendMessageRequest = await req.json();
    const {
      imoId,
      integrationId,
      channelId,
      text,
      blocks,
      threadTs,
      notificationType,
      relatedEntityType,
      relatedEntityId,
      channelConfigId,
    } = body;

    if ((!imoId && !integrationId) || !channelId || !text) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "Missing required fields: integrationId/imoId, channelId, text",
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
    const integrationImoId = integration.imo_id as string;

    // Decrypt bot token
    const botToken = await decrypt(integration.bot_token_encrypted);

    // Create pending message record
    const { data: messageRecord, error: insertError } =
      await authContext.supabaseAdmin
        .from("slack_messages")
        .insert({
          imo_id: integrationImoId,
          slack_integration_id: integration.id,
          channel_config_id: channelConfigId || null,
          channel_id: channelId,
          notification_type: notificationType || "policy_created",
          message_blocks: blocks || null,
          message_text: text,
          related_entity_type: relatedEntityType || null,
          related_entity_id: relatedEntityId || null,
          status: "pending",
        })
        .select()
        .single();

    if (insertError) {
      console.error(
        "[slack-send-message] Failed to create message record:",
        insertError,
      );
    }
    const messageRecordId = (messageRecord as { id: string } | null)?.id;

    // Send message to Slack
    const slackPayload: Record<string, unknown> = {
      channel: channelId,
      text,
    };

    if (blocks && blocks.length > 0) {
      slackPayload.blocks = blocks;
    }

    if (threadTs) {
      slackPayload.thread_ts = threadTs;
    }

    async function postMessage(): Promise<SlackPostMessageResponse> {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(slackPayload),
      });
      return res.json();
    }

    let data: SlackPostMessageResponse = await postMessage();

    // Self-heal: bot is not a member of this (public) channel yet. Try to
    // join, then retry the post once. Mirrors the pattern in
    // slack-policy-notification. `conversations.join` only works for public
    // channels — private channels require a human invite.
    if (!data.ok && data.error === "not_in_channel") {
      console.log(
        `[slack-send-message] not_in_channel for ${channelId}; attempting conversations.join`,
      );
      const joinRes = await fetch("https://slack.com/api/conversations.join", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: channelId }),
      });
      const joinData: { ok: boolean; error?: string } = await joinRes.json();
      if (joinData.ok) {
        console.log(
          `[slack-send-message] joined ${channelId}; retrying chat.postMessage`,
        );
        data = await postMessage();
      } else {
        console.error(
          `[slack-send-message] conversations.join failed for ${channelId}:`,
          joinData.error,
        );
      }
    }

    // Update message record with result
    if (messageRecord) {
      if (data.ok) {
        await authContext.supabaseAdmin
          .from("slack_messages")
          .update({
            message_ts: data.ts,
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", messageRecordId);
      } else {
        await authContext.supabaseAdmin
          .from("slack_messages")
          .update({
            status: "failed",
            error_message: data.error,
          })
          .eq("id", messageRecordId);
      }
    }

    if (!data.ok) {
      console.error("[slack-send-message] Slack API error:", data.error);

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
      `[slack-send-message] Message sent to channel ${channelId}, ts: ${data.ts}`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        channel: data.channel,
        ts: data.ts,
        messageId: messageRecordId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[slack-send-message] Unexpected error:", err);
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
