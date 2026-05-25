// supabase/functions/slack-daily-leaderboard/index.ts
// Posts daily sales leaderboard to configured Slack channels

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";

interface LeaderboardEntry {
  agent_id: string;
  agent_name: string;
  agent_email: string;
  total_annual_premium: number;
  active_policies: number;
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: Array<{
    type: string;
    text: string;
  }>;
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get rank emoji
 */
function getRankEmoji(rank: number): string {
  switch (rank) {
    case 1:
      return ":first_place_medal:";
    case 2:
      return ":second_place_medal:";
    case 3:
      return ":third_place_medal:";
    default:
      return `${rank}.`;
  }
}

const EPIC_LIFE_IMO_ID = "89514211-f2bd-4440-9527-90a472c5e622";

/**
 * Build leaderboard blocks
 */
function buildLeaderboardBlocks(
  entries: LeaderboardEntry[],
  totalPremium: number,
  period: string,
): SlackBlock[] {
  // Build leaderboard text
  const leaderboardLines = entries
    .slice(0, 10)
    .map((entry, index) => {
      const rank = index + 1;
      const emoji = getRankEmoji(rank);
      const name =
        entry.agent_name || entry.agent_email?.split("@")[0] || "Unknown";
      const premium = formatCurrency(entry.total_annual_premium);
      const policies = entry.active_policies;
      return `${emoji} *${name}* - ${premium} (${policies} ${policies === 1 ? "policy" : "policies"})`;
    })
    .join("\n");

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `:trophy: ${period} Sales Leaderboard`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Top Performers*",
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: leaderboardLines || "_No sales recorded yet_",
      },
    },
    {
      type: "divider",
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*Total Production:* ${formatCurrency(totalPremium)} | Posted by The Standard HQ`,
        },
      ],
    },
  ];

  return blocks;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    console.log("[slack-daily-leaderboard] Function invoked");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const bearerToken = authHeader.slice(7);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
    const body = await req.json();
    const { imoId, agencyId, manual = false } = body;

    if (!imoId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing imoId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (imoId === EPIC_LIFE_IMO_ID) {
      console.log("[slack-daily-leaderboard] Skipping Epic Life IMO");
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "Epic Life is Slack-disabled",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const isServiceRoleCall = bearerToken === SUPABASE_SERVICE_ROLE_KEY;
    let productionClient = supabaseAdmin;

    if (!isServiceRoleCall) {
      const {
        data: { user },
        error: authError,
      } = await supabaseAdmin.auth.getUser(bearerToken);

      if (authError || !user) {
        return new Response(
          JSON.stringify({ ok: false, error: "Unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .select("imo_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile?.imo_id || profile.imo_id !== imoId) {
        return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      productionClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }

    // Get Slack integration with channel settings (including workspace logo)
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from("slack_integrations")
      .select("*, workspace_logo_url")
      .eq("imo_id", imoId)
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .maybeSingle();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No active Slack integration found",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if leaderboard channel is configured
    if (!integration.leaderboard_channel_id) {
      console.log(
        "[slack-daily-leaderboard] No leaderboard channel configured",
      );
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "No leaderboard channel configured",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if leaderboard posting is enabled in settings
    if (integration.include_leaderboard_with_policy === false) {
      console.log(
        "[slack-daily-leaderboard] Leaderboard posting disabled in settings",
      );
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "Leaderboard posting disabled in settings",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get production data using RPC
    const { data: production, error: prodError } = await productionClient.rpc(
      "get_agency_production_by_agent",
      {
        p_agency_id: agencyId || null,
      },
    );

    if (prodError) {
      console.error(
        "[slack-daily-leaderboard] Error fetching production:",
        prodError,
      );
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to fetch production data" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!production || production.length === 0) {
      console.log("[slack-daily-leaderboard] No production data available");
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "No production data",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Sort by total premium
    const sortedProduction = (production as LeaderboardEntry[])
      .sort((a, b) => b.total_annual_premium - a.total_annual_premium)
      .slice(0, 10);

    const totalPremium = (production as LeaderboardEntry[]).reduce(
      (sum, entry) => sum + (entry.total_annual_premium || 0),
      0,
    );

    // Build leaderboard blocks
    const period = manual ? "Current" : "Daily";
    const leaderboardBlocks = buildLeaderboardBlocks(
      sortedProduction,
      totalPremium,
      period,
    );
    const leaderboardText = `${period} Sales Leaderboard - Total: ${formatCurrency(totalPremium)}`;

    // Decrypt bot token
    const botToken = await decrypt(integration.bot_token_encrypted);

    // Build message payload with optional workspace logo as icon
    const messagePayload: Record<string, unknown> = {
      channel: integration.leaderboard_channel_id,
      text: leaderboardText,
      blocks: leaderboardBlocks,
    };

    // Use workspace logo as bot icon if configured
    if (integration.workspace_logo_url) {
      messagePayload.icon_url = integration.workspace_logo_url;
    }

    // Send to configured leaderboard channel
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messagePayload),
    });

    const data = await response.json();

    // Record message
    await supabaseAdmin.from("slack_messages").insert({
      imo_id: imoId,
      slack_integration_id: integration.id,
      channel_id: integration.leaderboard_channel_id,
      notification_type: "daily_leaderboard",
      message_blocks: leaderboardBlocks,
      message_text: leaderboardText,
      related_entity_type: "leaderboard",
      related_entity_id: null,
      status: data.ok ? "sent" : "failed",
      message_ts: data.ts || null,
      error_message: data.error || null,
      sent_at: data.ok ? new Date().toISOString() : null,
    });

    // Update integration status if token is invalid
    if (data.error === "token_revoked" || data.error === "invalid_auth") {
      await supabaseAdmin
        .from("slack_integrations")
        .update({
          connection_status: "error",
          last_error: data.error,
        })
        .eq("id", integration.id);
    }

    const result = {
      channel: integration.leaderboard_channel_name,
      ok: data.ok,
      error: data.error,
    };

    console.log(
      `[slack-daily-leaderboard] Posted leaderboard to #${integration.leaderboard_channel_name}`,
    );

    return new Response(JSON.stringify({ ok: true, results: [result] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[slack-daily-leaderboard] Unexpected error:", err);
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
