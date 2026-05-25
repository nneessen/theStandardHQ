// supabase/functions/slack-refresh-leaderboard/index.ts
// Refreshes the daily leaderboard message in Slack after title is updated

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";

interface DailyProductionEntry {
  agent_id: string;
  agent_name: string;
  agent_email: string;
  slack_member_id: string | null;
  total_annual_premium: number;
  policy_count: number;
}

const EPIC_LIFE_IMO_ID = "89514211-f2bd-4440-9527-90a472c5e622";

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
 * Get rank emoji for leaderboard
 */
function getRankDisplay(rank: number): string {
  switch (rank) {
    case 1:
      return "🥇";
    case 2:
      return "🥈";
    case 3:
      return "🥉";
    default:
      return `${rank}.`;
  }
}

/**
 * Look up a Slack member ID by email in the current workspace
 * Returns the member ID if found, null if not found or unrecoverable error
 * Includes retry logic for rate limiting and transient failures
 */
async function lookupSlackMemberByEmail(
  botToken: string,
  email: string,
  retryCount: number = 0,
): Promise<string | null> {
  if (!email) return null;

  const MAX_RETRIES = 2;

  try {
    const response = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${botToken}`,
        },
      },
    );
    const data = await response.json();

    if (data.ok && data.user?.id) {
      return data.user.id;
    }

    // Handle specific Slack API errors
    if (!data.ok) {
      switch (data.error) {
        case "users_not_found":
          // Expected - user not in this workspace, no need to log as error
          return null;

        case "ratelimited":
          // Rate limited - wait and retry
          if (retryCount < MAX_RETRIES) {
            const retryAfter = parseInt(
              response.headers.get("Retry-After") || "1",
              10,
            );
            console.warn(
              `[slack-refresh-leaderboard] Rate limited, retrying after ${retryAfter}s for ${email}`,
            );
            await new Promise((r) => setTimeout(r, retryAfter * 1000));
            return lookupSlackMemberByEmail(botToken, email, retryCount + 1);
          }
          console.error(
            `[slack-refresh-leaderboard] Rate limit exceeded after ${MAX_RETRIES} retries for ${email}`,
          );
          return null;

        case "invalid_auth":
        case "token_revoked":
        case "token_expired":
          // Auth errors - log as error, these need investigation
          console.error(
            `[slack-refresh-leaderboard] Slack auth error: ${data.error}. Bot token may be invalid.`,
          );
          return null;

        default:
          // Unknown error - log for debugging
          console.warn(
            `[slack-refresh-leaderboard] Slack API error for ${email}: ${data.error}`,
          );
          return null;
      }
    }

    return null;
  } catch (err) {
    // Network/transient error - retry once
    if (retryCount < 1) {
      console.warn(
        `[slack-refresh-leaderboard] Network error for ${email}, retrying...`,
      );
      await new Promise((r) => setTimeout(r, 500));
      return lookupSlackMemberByEmail(botToken, email, retryCount + 1);
    }
    console.error(
      `[slack-refresh-leaderboard] Error looking up user ${email} after retry:`,
      err,
    );
    return null;
  }
}

/**
 * Look up Slack member IDs for all agents in the production data
 * Returns a map of agent_id -> slack_member_id (or null if not found)
 *
 * NOTE: Uses sequential lookups to respect Slack API rate limits (~1 req/sec).
 * Parallel lookups would trigger rate limiting with >5 agents.
 */
async function lookupAllSlackMembers(
  botToken: string,
  entries: DailyProductionEntry[],
): Promise<Map<string, string | null>> {
  const memberMap = new Map<string, string | null>();

  // Sequential lookups to respect Slack rate limits
  // Slack's users.lookupByEmail is rate limited to ~20 requests/minute
  for (const entry of entries) {
    const memberId = await lookupSlackMemberByEmail(
      botToken,
      entry.agent_email,
    );
    memberMap.set(entry.agent_id, memberId);
  }

  return memberMap;
}

/**
 * Build the daily leaderboard text (simple text format)
 * @param memberMap - Map of agent_id -> slack_member_id looked up in THIS workspace
 */
function buildLeaderboardText(
  title: string,
  entries: DailyProductionEntry[],
  totalAP: number,
  memberMap: Map<string, string | null>,
): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  let text = `*${title}*\n_${today}_\n\n`;

  if (entries.length === 0) {
    text += "_No sales yet today_\n";
  } else {
    entries.forEach((entry, index) => {
      const rank = index + 1;
      const rankDisplay = getRankDisplay(rank);
      const ap = formatCurrency(entry.total_annual_premium);
      const policies = entry.policy_count;
      const policyText = policies === 1 ? "policy" : "policies";

      // Use @mention if member exists in THIS workspace, otherwise use agent name
      const slackMemberId = memberMap.get(entry.agent_id);
      const nameDisplay = slackMemberId
        ? `<@${slackMemberId}>`
        : entry.agent_name?.trim() ||
          entry.agent_email?.split("@")[0] ||
          "Unknown";

      text += `${rankDisplay} ${nameDisplay} - ${ap} (${policies} ${policyText})\n`;
    });
  }

  text += `\n*Total: ${formatCurrency(totalAP)}*`;

  return text;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    console.log("[slack-refresh-leaderboard] Function invoked");

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

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
    const body = await req.json();
    const { logId, title } = body;

    if (!logId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing logId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const isServiceRoleCall = bearerToken === SUPABASE_SERVICE_ROLE_KEY;

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
    }

    // Get the daily sales log
    const { data: dailyLog, error: logError } = await supabaseAdmin
      .from("daily_sales_logs")
      .select("*")
      .eq("id", logId)
      .single();

    if (logError || !dailyLog) {
      console.error("[slack-refresh-leaderboard] Log not found:", logError);
      return new Response(
        JSON.stringify({ ok: false, error: "Daily log not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (dailyLog.imo_id === EPIC_LIFE_IMO_ID) {
      console.log("[slack-refresh-leaderboard] Skipping Epic Life IMO");
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

    if (!isServiceRoleCall) {
      const {
        data: { user },
      } = await supabaseAdmin.auth.getUser(bearerToken);

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .select("imo_id")
        .eq("id", user!.id)
        .maybeSingle();

      if (
        profileError ||
        !profile?.imo_id ||
        profile.imo_id !== dailyLog.imo_id
      ) {
        return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get the Slack integration
    const { data: integration, error: intError } = await supabaseAdmin
      .from("slack_integrations")
      .select("id, bot_token_encrypted")
      .eq("id", dailyLog.slack_integration_id)
      .single();

    if (intError || !integration) {
      console.error(
        "[slack-refresh-leaderboard] Integration not found:",
        intError,
      );
      return new Response(
        JSON.stringify({ ok: false, error: "Slack integration not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Decrypt bot token first (needed for member lookup)
    const botToken = await decrypt(integration.bot_token_encrypted);

    // Get today's production for leaderboard
    const { data: productionData } = await supabaseAdmin.rpc(
      "get_daily_production_by_agent",
      {
        p_imo_id: dailyLog.imo_id,
        p_agency_id: null,
      },
    );

    const production: DailyProductionEntry[] = productionData || [];
    const totalAP = production.reduce(
      (sum, e) => sum + (e.total_annual_premium || 0),
      0,
    );

    // Look up Slack member IDs for all agents in THIS workspace
    // This ensures we use the correct member ID for @mentions
    console.log(
      `[slack-refresh-leaderboard] Looking up ${production.length} agents in workspace`,
    );
    const memberMap = await lookupAllSlackMembers(botToken, production);

    // Build the updated leaderboard text
    const leaderboardTitle = title || dailyLog.title || "Daily Sales";
    const leaderboardText = buildLeaderboardText(
      leaderboardTitle,
      production,
      totalAP,
      memberMap,
    );

    // Update the Slack message if we have the message_ts
    if (dailyLog.leaderboard_message_ts) {
      const updateResponse = await fetch("https://slack.com/api/chat.update", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: dailyLog.channel_id,
          ts: dailyLog.leaderboard_message_ts,
          text: leaderboardText,
        }),
      });

      const updateData = await updateResponse.json();

      if (!updateData.ok) {
        console.error(
          "[slack-refresh-leaderboard] Failed to update message:",
          updateData.error,
        );

        // If the message is too old or deleted, post a new one
        if (
          updateData.error === "message_not_found" ||
          updateData.error === "cant_update_message"
        ) {
          const postResponse = await fetch(
            "https://slack.com/api/chat.postMessage",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${botToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                channel: dailyLog.channel_id,
                text: leaderboardText,
              }),
            },
          );

          const postData = await postResponse.json();

          if (postData.ok) {
            // Update the log with new message_ts
            await supabaseAdmin
              .from("daily_sales_logs")
              .update({
                leaderboard_message_ts: postData.ts,
                updated_at: new Date().toISOString(),
              })
              .eq("id", logId);

            return new Response(
              JSON.stringify({
                ok: true,
                action: "posted_new",
                ts: postData.ts,
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          return new Response(
            JSON.stringify({ ok: false, error: postData.error }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        return new Response(
          JSON.stringify({ ok: false, error: updateData.error }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      console.log("[slack-refresh-leaderboard] Message updated successfully");

      return new Response(
        JSON.stringify({
          ok: true,
          action: "updated",
          ts: dailyLog.leaderboard_message_ts,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } else {
      // No message_ts, post a new message
      const postResponse = await fetch(
        "https://slack.com/api/chat.postMessage",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel: dailyLog.channel_id,
            text: leaderboardText,
          }),
        },
      );

      const postData = await postResponse.json();

      if (postData.ok) {
        // Update the log with message_ts
        await supabaseAdmin
          .from("daily_sales_logs")
          .update({
            leaderboard_message_ts: postData.ts,
            updated_at: new Date().toISOString(),
          })
          .eq("id", logId);

        console.log("[slack-refresh-leaderboard] New message posted");

        return new Response(
          JSON.stringify({ ok: true, action: "posted_new", ts: postData.ts }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({ ok: false, error: postData.error }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (err) {
    console.error("[slack-refresh-leaderboard] Unexpected error:", err);
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
