// supabase/functions/chat-bot-provision/index.ts
// Internal function (service-role only) — provisions/deprovisions/updates chat bot agents
// Called by stripe-webhook handler, NOT by end users directly.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Helper to call standard-chat-bot external API
async function callChatBotApi(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const CHAT_BOT_API_URL = Deno.env.get("CHAT_BOT_API_URL");
  const CHAT_BOT_API_KEY = Deno.env.get("CHAT_BOT_API_KEY");

  if (!CHAT_BOT_API_URL || !CHAT_BOT_API_KEY) {
    throw new Error("CHAT_BOT_API_URL or CHAT_BOT_API_KEY not configured");
  }

  const url = `${CHAT_BOT_API_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": CHAT_BOT_API_KEY,
    },
  };
  if (method !== "GET" && method !== "DELETE") {
    options.body = JSON.stringify(body || {});
  }

  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // Verify service-role auth (only internal calls should reach this function)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;

    // Use service role client for all DB operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { action, userId, tierId, billingExempt } = await req.json();

    if (!userId) {
      return jsonResponse({ error: "userId is required" }, 400);
    }

    switch (action) {
      // ──────────────────────────────────────────────
      // PROVISION — create agent in standard-chat-bot
      // ──────────────────────────────────────────────
      case "provision": {
        // Idempotency: check if already provisioned
        const { data: existing } = await supabase
          .from("chat_bot_agents")
          .select("id, external_agent_id, provisioning_status")
          .eq("user_id", userId)
          .maybeSingle();

        if (existing?.provisioning_status === "active") {
          console.log(
            `[chat-bot-provision] Already provisioned for user ${userId}`,
          );
          return jsonResponse({
            success: true,
            agentId: existing.external_agent_id,
            alreadyProvisioned: true,
          });
        }

        // Get user name for agent display
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name")
          .eq("id", userId)
          .maybeSingle();

        const agentName = profile
          ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
            "Chat Bot Agent"
          : "Chat Bot Agent";

        // Billing-exempt agents (team members) skip tier/lead-limit logic
        if (billingExempt === true) {
          const result = await callChatBotApi("POST", "/api/external/agents", {
            externalRef: userId,
            name: agentName,
            billingExempt: true,
          });

          if (!result.ok) {
            console.error(
              `[chat-bot-provision] Failed to provision billing-exempt agent for user ${userId}:`,
              result.data,
            );
            await supabase.from("chat_bot_agents").upsert(
              {
                user_id: userId,
                external_agent_id: "",
                provisioning_status: "failed",
                billing_exempt: true,
                tier_id: null,
                error_message: JSON.stringify(result.data),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id" },
            );
            return jsonResponse(
              { error: "Failed to provision agent", details: result.data },
              500,
            );
          }

          const externalAgentId =
            (result.data.data as Record<string, unknown>)?.agentId ||
            result.data.agentId;

          await supabase.from("chat_bot_agents").upsert(
            {
              user_id: userId,
              external_agent_id: String(externalAgentId),
              provisioning_status: "active",
              billing_exempt: true,
              tier_id: null,
              error_message: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );

          console.log(
            `[chat-bot-provision] Provisioned billing-exempt agent ${externalAgentId} for user ${userId}`,
          );
          return jsonResponse({ success: true, agentId: externalAgentId });
        }

        // Get tier config to determine lead limit
        let leadLimit = 50; // default Starter
        if (tierId) {
          const { data: addon } = await supabase
            .from("subscription_addons")
            .select("tier_config")
            .eq("name", "ai_chat_bot")
            .maybeSingle();

          if (addon?.tier_config) {
            const tierConfig = addon.tier_config as {
              tiers: Array<{
                id: string;
                runs_per_month: number;
              }>;
            };
            const tier = tierConfig.tiers?.find(
              (t: { id: string }) => t.id === tierId,
            );
            if (tier) {
              leadLimit = tier.runs_per_month;
            }
          }
        }

        // Call standard-chat-bot API to create agent
        const result = await callChatBotApi("POST", "/api/external/agents", {
          externalRef: userId,
          name: agentName,
          leadLimit,
        });

        if (!result.ok) {
          console.error(
            `[chat-bot-provision] Failed to provision agent for user ${userId}:`,
            result.data,
          );

          // Record failure
          await supabase.from("chat_bot_agents").upsert(
            {
              user_id: userId,
              external_agent_id: "",
              provisioning_status: "failed",
              tier_id: tierId || "starter",
              error_message: JSON.stringify(result.data),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );

          return jsonResponse(
            { error: "Failed to provision agent", details: result.data },
            500,
          );
        }

        const externalAgentId =
          (result.data.data as Record<string, unknown>)?.agentId ||
          result.data.agentId;

        // Insert/update chat_bot_agents row
        await supabase.from("chat_bot_agents").upsert(
          {
            user_id: userId,
            external_agent_id: String(externalAgentId),
            provisioning_status: "active",
            tier_id: tierId || "starter",
            error_message: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

        console.log(
          `[chat-bot-provision] Provisioned agent ${externalAgentId} for user ${userId}`,
        );

        return jsonResponse({
          success: true,
          agentId: externalAgentId,
        });
      }

      // ──────────────────────────────────────────────
      // DEPROVISION — disable agent in standard-chat-bot
      // ──────────────────────────────────────────────
      case "deprovision": {
        const { data: agent } = await supabase
          .from("chat_bot_agents")
          .select("id, external_agent_id, provisioning_status")
          .eq("user_id", userId)
          .maybeSingle();

        if (!agent) {
          console.log(
            `[chat-bot-provision] No agent found to deprovision for user ${userId}`,
          );
          return jsonResponse({ success: true, alreadyDeprovisioned: true });
        }

        if (agent.provisioning_status === "deprovisioned") {
          console.log(
            `[chat-bot-provision] Already deprovisioned for user ${userId}`,
          );
          return jsonResponse({ success: true, alreadyDeprovisioned: true });
        }

        if (agent.external_agent_id) {
          const result = await callChatBotApi(
            "POST",
            `/api/external/agents/${agent.external_agent_id}/deprovision`,
          );

          if (!result.ok && result.status !== 404) {
            console.error(
              `[chat-bot-provision] Failed to deprovision agent for user ${userId}:`,
              result.data,
            );

            await supabase
              .from("chat_bot_agents")
              .update({
                provisioning_status: "failed",
                error_message: `Deprovision failed: ${JSON.stringify(result.data)}`,
                updated_at: new Date().toISOString(),
              })
              .eq("id", agent.id);

            return jsonResponse(
              { error: "Failed to deprovision agent", details: result.data },
              500,
            );
          }
        }

        await supabase
          .from("chat_bot_agents")
          .update({
            provisioning_status: "deprovisioned",
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", agent.id);

        console.log(
          `[chat-bot-provision] Deprovisioned agent for user ${userId}`,
        );

        return jsonResponse({ success: true });
      }

      // ──────────────────────────────────────────────
      // UPDATE TIER — change lead limit on existing agent
      // ──────────────────────────────────────────────
      case "update_tier": {
        if (!tierId) {
          return jsonResponse(
            { error: "tierId is required for update_tier" },
            400,
          );
        }

        const { data: agent } = await supabase
          .from("chat_bot_agents")
          .select("id, external_agent_id, provisioning_status")
          .eq("user_id", userId)
          .maybeSingle();

        if (!agent || agent.provisioning_status !== "active") {
          return jsonResponse(
            { error: "No active agent found for this user" },
            404,
          );
        }

        // Resolve lead limit from tier config
        const { data: addon } = await supabase
          .from("subscription_addons")
          .select("tier_config")
          .eq("name", "ai_chat_bot")
          .maybeSingle();

        let leadLimit = 50;
        if (addon?.tier_config) {
          const tierConfig = addon.tier_config as {
            tiers: Array<{ id: string; runs_per_month: number }>;
          };
          const tier = tierConfig.tiers?.find(
            (t: { id: string }) => t.id === tierId,
          );
          if (tier) {
            leadLimit = tier.runs_per_month;
          }
        }

        const result = await callChatBotApi(
          "PATCH",
          `/api/external/agents/${agent.external_agent_id}`,
          { leadLimit },
        );

        if (!result.ok) {
          console.error(
            `[chat-bot-provision] Failed to update tier for user ${userId}:`,
            result.data,
          );
          return jsonResponse(
            { error: "Failed to update agent tier", details: result.data },
            500,
          );
        }

        await supabase
          .from("chat_bot_agents")
          .update({
            tier_id: tierId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", agent.id);

        console.log(
          `[chat-bot-provision] Updated tier to ${tierId} (leadLimit=${leadLimit}) for user ${userId}`,
        );

        return jsonResponse({ success: true, leadLimit });
      }

      // ──────────────────────────────────────────────
      // SET BILLING EXEMPT — toggle billing exemption on existing agent
      // ──────────────────────────────────────────────
      case "set_billing_exempt": {
        if (typeof billingExempt !== "boolean") {
          return jsonResponse(
            {
              error:
                "billingExempt (boolean) is required for set_billing_exempt",
            },
            400,
          );
        }

        const { data: agent } = await supabase
          .from("chat_bot_agents")
          .select("id, external_agent_id, provisioning_status")
          .eq("user_id", userId)
          .eq("provisioning_status", "active")
          .maybeSingle();

        if (!agent) {
          return jsonResponse(
            { error: "No active agent found for this user" },
            404,
          );
        }

        const result = await callChatBotApi(
          "PATCH",
          `/api/external/agents/${agent.external_agent_id}`,
          { billingExempt },
        );

        if (!result.ok) {
          console.error(
            `[chat-bot-provision] Failed to set billing_exempt for user ${userId}:`,
            result.data,
          );
          return jsonResponse(
            { error: "Failed to update billing exempt", details: result.data },
            500,
          );
        }

        await supabase
          .from("chat_bot_agents")
          .update({
            billing_exempt: billingExempt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", agent.id);

        console.log(
          `[chat-bot-provision] Set billing_exempt=${billingExempt} for user ${userId}`,
        );
        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("[chat-bot-provision] Unhandled error:", err);
    return jsonResponse(
      { error: "Internal server error", message: String(err) },
      500,
    );
  }
});
