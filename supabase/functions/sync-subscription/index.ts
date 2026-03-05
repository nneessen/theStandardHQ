// supabase/functions/sync-subscription/index.ts
// Reconciliation endpoint: syncs subscription state from Stripe to DB.
// Called as a fallback when webhook delivery is delayed or failing.
// Authenticated — requires the user's JWT.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;

    if (!STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
    });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.slice(7));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the user's current subscription record
    const { data: userSub } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, plan_id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!userSub?.stripe_customer_id) {
      // No Stripe customer yet — try to find by email
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (customers.data.length === 0) {
        return new Response(
          JSON.stringify({ synced: false, reason: "no_customer" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Store customer ID
      await supabase
        .from("user_subscriptions")
        .update({
          stripe_customer_id: customers.data[0].id,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      userSub.stripe_customer_id = customers.data[0].id;
    }

    // Fetch active subscriptions from Stripe for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: userSub.stripe_customer_id,
      status: "active",
      limit: 1,
    });

    // Also check trialing
    if (subscriptions.data.length === 0) {
      const trialingSubs = await stripe.subscriptions.list({
        customer: userSub.stripe_customer_id,
        status: "trialing",
        limit: 1,
      });
      if (trialingSubs.data.length > 0) {
        subscriptions.data.push(...trialingSubs.data);
      }
    }

    if (subscriptions.data.length === 0) {
      return new Response(
        JSON.stringify({ synced: false, reason: "no_active_subscription" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const stripeSub = subscriptions.data[0];

    // Find the plan item — match price ID against our known plans
    const itemPriceIds = stripeSub.items.data.map((item) => item.price.id);

    const { data: matchedPlan } = await supabase
      .from("subscription_plans")
      .select("id, name, stripe_price_id_monthly, stripe_price_id_annual")
      .or(
        itemPriceIds
          .map(
            (pid) =>
              `stripe_price_id_monthly.eq.${pid},stripe_price_id_annual.eq.${pid}`,
          )
          .join(","),
      )
      .limit(1)
      .maybeSingle();

    if (!matchedPlan) {
      console.error(
        "[sync-subscription] No plan matched for price IDs:",
        itemPriceIds,
      );
      return new Response(
        JSON.stringify({ synced: false, reason: "no_matching_plan" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Determine billing interval
    const planItem = stripeSub.items.data.find(
      (item) =>
        item.price.id === matchedPlan.stripe_price_id_monthly ||
        item.price.id === matchedPlan.stripe_price_id_annual,
    );
    const billingInterval =
      planItem?.price?.recurring?.interval === "year" ? "annual" : "monthly";

    // Map status
    const statusMap: Record<string, string> = {
      active: "active",
      trialing: "trialing",
      past_due: "past_due",
      canceled: "cancelled",
    };
    const dbStatus = statusMap[stripeSub.status] || "active";

    // Update the subscription in DB
    const { error: updateError } = await supabase
      .from("user_subscriptions")
      .update({
        plan_id: matchedPlan.id,
        status: dbStatus,
        stripe_subscription_id: stripeSub.id,
        billing_interval: billingInterval,
        current_period_start: new Date(
          stripeSub.current_period_start * 1000,
        ).toISOString(),
        current_period_end: new Date(
          stripeSub.current_period_end * 1000,
        ).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[sync-subscription] Update failed:", updateError);
      return new Response(
        JSON.stringify({ synced: false, reason: "db_error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `[sync-subscription] Synced user ${user.id} to plan ${matchedPlan.name} (${stripeSub.id})`,
    );

    return new Response(
      JSON.stringify({
        synced: true,
        plan: matchedPlan.name,
        status: dbStatus,
        subscription_id: stripeSub.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[sync-subscription] Error:", err);
    return new Response(
      JSON.stringify({
        error: "Sync failed",
        detail: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
