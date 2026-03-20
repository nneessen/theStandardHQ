// supabase/functions/backfill-attributions/index.ts
// ONE-TIME backfill: checks recent policies for all active bot agents against
// external conversation history. Creates attributions for matches.
// Deploy with: npx supabase functions deploy backfill-attributions --project-ref <ref>
// Invoke with: curl -X POST <url>/functions/v1/backfill-attributions -H "Authorization: Bearer <service_role_key>"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CHAT_BOT_API_URL =
    Deno.env.get("STANDARD_CHAT_BOT_API_URL") ||
    Deno.env.get("CHAT_BOT_API_URL");
  const CHAT_BOT_API_KEY =
    Deno.env.get("STANDARD_CHAT_BOT_EXTERNAL_API_KEY") ||
    Deno.env.get("CHAT_BOT_API_KEY");

  if (!CHAT_BOT_API_URL || !CHAT_BOT_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "CHAT_BOT_API_URL or CHAT_BOT_API_KEY not configured",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Get all active bot agents
  const { data: agents } = await supabase
    .from("chat_bot_agents")
    .select("user_id, external_agent_id")
    .eq("provisioning_status", "active");

  if (!agents || agents.length === 0) {
    return new Response(
      JSON.stringify({ message: "No active agents found", results: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const from90d = new Date(Date.now() - 90 * 86400000)
    .toISOString()
    .slice(0, 10);
  // deno-lint-ignore no-explicit-any
  const results: any[] = [];

  for (const agent of agents) {
    // 2. Get recent policies for this user with client info
    const { data: policies } = await supabase
      .from("policies")
      .select("id, user_id, effective_date, clients(name, phone)")
      .eq("user_id", agent.user_id)
      .gte("effective_date", from90d)
      .not("client_id", "is", null);

    if (!policies || policies.length === 0) {
      results.push({
        agent: agent.external_agent_id,
        policies: 0,
        matched: 0,
        skipped: "no_policies",
      });
      continue;
    }

    let matched = 0;
    let skipped = 0;
    let errors = 0;

    for (const policy of policies) {
      // Skip if already attributed
      const { data: existing } = await supabase
        .from("bot_policy_attributions")
        .select("id")
        .eq("policy_id", policy.id)
        .maybeSingle();
      if (existing) {
        skipped++;
        continue;
      }

      // deno-lint-ignore no-explicit-any
      const client = policy.clients as any;
      if (!client) {
        skipped++;
        continue;
      }

      const clientPhone = (client.phone || "").replace(/\D/g, "");
      const clientName = (client.name || "").trim();

      if (!clientPhone && !clientName) {
        skipped++;
        continue;
      }

      // 3. Search external API for matching conversations
      try {
        const qs = new URLSearchParams();
        if (clientPhone) qs.set("leadPhone", clientPhone);
        if (clientName) qs.set("leadName", clientName);
        qs.set("from", from90d);

        const res = await fetch(
          `${CHAT_BOT_API_URL}/api/external/agents/${agent.external_agent_id}/conversations/search?${qs.toString()}`,
          { method: "GET", headers: { "X-API-Key": CHAT_BOT_API_KEY } },
        );

        if (!res.ok) {
          errors++;
          continue;
        }

        const json = await res.json();
        const payload = json?.data ?? json;
        const matches = Array.isArray(payload) ? payload : [];

        if (matches.length === 0) continue;

        // Find best match: phone > name
        // deno-lint-ignore no-explicit-any
        let bestMatch: any = null;
        let matchMethod = "auto_name";
        let confidence = 0.7;

        for (const m of matches) {
          const mPhone = (m.leadPhone || "").replace(/\D/g, "");
          if (clientPhone && mPhone === clientPhone) {
            bestMatch = m;
            matchMethod = "auto_phone";
            confidence = 1.0;
            break;
          }
          if (!bestMatch) bestMatch = m;
        }

        if (!bestMatch) continue;

        const attributionType = bestMatch.appointmentId
          ? "bot_converted"
          : "bot_assisted";

        // 4. Insert attribution
        const { error: insertErr } = await supabase
          .from("bot_policy_attributions")
          .insert({
            policy_id: policy.id,
            user_id: agent.user_id,
            external_conversation_id: bestMatch.id || bestMatch.conversationId,
            external_appointment_id: bestMatch.appointmentId || null,
            attribution_type: attributionType,
            match_method: matchMethod,
            confidence_score: confidence,
            lead_name: bestMatch.leadName || clientName || null,
            conversation_started_at: bestMatch.startedAt || null,
          });

        if (insertErr) {
          if (insertErr.code !== "23505") errors++;
        } else {
          matched++;
          console.log(
            `[backfill] Matched: ${clientName} → ${attributionType} (${matchMethod}, confidence=${confidence})`,
          );
        }
      } catch (err) {
        console.error(`[backfill] Error for policy ${policy.id}:`, err);
        errors++;
      }
    }

    results.push({
      agent: agent.external_agent_id,
      userId: agent.user_id,
      policies: policies.length,
      matched,
      skipped,
      errors,
    });
  }

  console.log("[backfill] Complete:", JSON.stringify(results));

  return new Response(
    JSON.stringify({ message: "Backfill complete", results }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
