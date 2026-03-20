// supabase/functions/bot-collective-analytics/index.ts
// Public edge function (no JWT required) — returns aggregate bot analytics.
// Used by "All Bots" tab to showcase collective bot effectiveness.
// Returns ONLY aggregate numbers — no PII, no agent names, no client data.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// deno-lint-ignore no-explicit-any
function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { from, to } = body;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;
    const CHAT_BOT_API_URL =
      Deno.env.get("STANDARD_CHAT_BOT_API_URL") ||
      Deno.env.get("CHAT_BOT_API_URL");
    const CHAT_BOT_API_KEY =
      Deno.env.get("STANDARD_CHAT_BOT_EXTERNAL_API_KEY") ||
      Deno.env.get("CHAT_BOT_API_KEY");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get aggregate analytics from standard-chat-bot API (if available)
    // deno-lint-ignore no-explicit-any
    let externalMetrics: any = null;
    if (CHAT_BOT_API_URL && CHAT_BOT_API_KEY) {
      try {
        const qs = new URLSearchParams();
        if (from) qs.set("from", String(from));
        if (to) qs.set("to", String(to));
        const queryString = qs.toString() ? `?${qs.toString()}` : "";

        const res = await fetch(
          `${CHAT_BOT_API_URL}/api/external/analytics/aggregate${queryString}`,
          {
            method: "GET",
            headers: { "X-API-Key": CHAT_BOT_API_KEY },
          },
        );
        if (res.ok) {
          const json = await res.json();
          externalMetrics = json?.data ?? json;
        }
      } catch {
        // External API unavailable — continue with DB-only metrics
      }
    }

    // 2. Get attribution stats from Supabase (always available)
    let attrQuery = supabase
      .from("bot_policy_attributions")
      .select(
        "id, attribution_type, confidence_score, created_at, policies(annual_premium)",
      );

    if (from) attrQuery = attrQuery.gte("created_at", from);
    if (to) attrQuery = attrQuery.lte("created_at", `${to}T23:59:59.999Z`);

    const { data: attributions } = await attrQuery;
    const attrs = attributions || [];

    // 3. Count active bots
    const { count: activeBots } = await supabase
      .from("chat_bot_agents")
      .select("id", { count: "exact", head: true })
      .eq("provisioning_status", "active");

    // 4. Compute aggregate attribution metrics
    let totalAttributions = 0;
    let botConverted = 0;
    let botAssisted = 0;
    let totalPremium = 0;

    for (const a of attrs) {
      totalAttributions++;
      if (a.attribution_type === "bot_converted") botConverted++;
      else botAssisted++;
      // deno-lint-ignore no-explicit-any
      const premium = (a.policies as any)?.annual_premium;
      if (typeof premium === "number") totalPremium += premium;
    }

    // Subtract "open" conversations (bot hasn't engaged yet) from totals
    const openConversations =
      externalMetrics?.byStatus?.open ??
      externalMetrics?.openConversations ??
      0;
    const engagedConversations = Math.max(
      0,
      (externalMetrics?.totalConversations ?? 0) - openConversations,
    );

    return jsonResponse({
      activeBots: activeBots ?? 0,
      totalConversations: engagedConversations,
      totalAppointments: externalMetrics?.totalAppointments ?? 0,
      totalAttributions,
      botConverted,
      botAssisted,
      totalPremium: Math.round(totalPremium * 100) / 100,
      bookingRate: externalMetrics?.bookingRate ?? 0,
      conversionRate:
        engagedConversations > 0
          ? Math.round((totalAttributions / engagedConversations) * 10000) / 100
          : 0,
      timeline: externalMetrics?.timeline ?? [],
    });
  } catch (err) {
    console.error("[bot-collective-analytics] Error:", err);
    return jsonResponse({ error: "Internal server error" }, 400);
  }
});
