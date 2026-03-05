// supabase/functions/setup-addon-stripe-products/index.ts
// Creates Stripe products and prices for addon tiers, then writes IDs back to DB.
// Restricted to super admin. Idempotent — skips tiers that already have price IDs.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AddonTier {
  id: string;
  name: string;
  runs_per_month: number;
  leads_per_month?: number;
  price_monthly: number;
  price_annual: number;
  stripe_price_id_monthly?: string | null;
  stripe_price_id_annual?: string | null;
}

interface TierConfig {
  tiers: AddonTier[];
}

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

    // Verify caller is authenticated
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

    // Verify caller is super admin
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.is_super_admin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: super admin required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse input
    const body = await req.json();
    const { addonName } = body;

    if (!addonName || typeof addonName !== "string") {
      return new Response(JSON.stringify({ error: "addonName is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the addon
    const { data: addon, error: addonError } = await supabase
      .from("subscription_addons")
      .select("id, name, display_name, tier_config")
      .eq("name", addonName)
      .single();

    if (addonError || !addon) {
      return new Response(
        JSON.stringify({ error: `Addon not found: ${addonName}` }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const tierConfig = addon.tier_config as TierConfig | null;
    if (!tierConfig?.tiers || tierConfig.tiers.length === 0) {
      return new Response(
        JSON.stringify({ error: "Addon has no tiers configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create or reuse Stripe product (stored in tier_config.stripe_product_id)
    const existingConfig = tierConfig as TierConfig & {
      stripe_product_id?: string;
    };
    let stripeProductId = existingConfig.stripe_product_id || null;

    if (!stripeProductId) {
      const product = await stripe.products.create({
        name: addon.display_name || addon.name,
        metadata: {
          addon_id: addon.id,
          addon_name: addon.name,
        },
      });
      stripeProductId = product.id;

      console.log(
        `[setup-addon-stripe-products] Created Stripe product: ${stripeProductId} for ${addon.name}`,
      );
    } else {
      console.log(
        `[setup-addon-stripe-products] Reusing existing Stripe product: ${stripeProductId}`,
      );
    }

    // Process each tier — create prices where missing
    const updatedTiers = [...tierConfig.tiers];
    const results: {
      tierId: string;
      monthlyPriceId: string | null;
      annualPriceId: string | null;
      created: string[];
      skipped: string[];
    }[] = [];

    for (let i = 0; i < updatedTiers.length; i++) {
      const tier = updatedTiers[i];
      const created: string[] = [];
      const skipped: string[] = [];

      // Skip free tiers (price = 0)
      if (tier.price_monthly === 0 && tier.price_annual === 0) {
        results.push({
          tierId: tier.id,
          monthlyPriceId: null,
          annualPriceId: null,
          created: [],
          skipped: ["free tier — no prices needed"],
        });
        continue;
      }

      // Monthly price
      if (tier.stripe_price_id_monthly) {
        skipped.push("monthly (already set)");
      } else if (tier.price_monthly > 0) {
        const monthlyPrice = await stripe.prices.create({
          unit_amount: tier.price_monthly,
          currency: "usd",
          recurring: { interval: "month" },
          product: stripeProductId,
          active: true,
          metadata: {
            addon_id: addon.id,
            addon_name: addon.name,
            tier_id: tier.id,
            tier_name: tier.name,
          },
        });
        updatedTiers[i] = {
          ...tier,
          stripe_price_id_monthly: monthlyPrice.id,
        };
        created.push(`monthly: ${monthlyPrice.id}`);
      }

      // Annual price
      if (updatedTiers[i].stripe_price_id_annual) {
        skipped.push("annual (already set)");
      } else if (tier.price_annual > 0) {
        const annualPrice = await stripe.prices.create({
          unit_amount: tier.price_annual,
          currency: "usd",
          recurring: { interval: "year" },
          product: stripeProductId,
          active: true,
          metadata: {
            addon_id: addon.id,
            addon_name: addon.name,
            tier_id: tier.id,
            tier_name: tier.name,
          },
        });
        updatedTiers[i] = {
          ...updatedTiers[i],
          stripe_price_id_annual: annualPrice.id,
        };
        created.push(`annual: ${annualPrice.id}`);
      }

      results.push({
        tierId: tier.id,
        monthlyPriceId: updatedTiers[i].stripe_price_id_monthly || null,
        annualPriceId: updatedTiers[i].stripe_price_id_annual || null,
        created,
        skipped,
      });
    }

    // Write updated tier_config back to DB (include product ID)
    const updatedConfig = {
      ...existingConfig,
      tiers: updatedTiers,
      stripe_product_id: stripeProductId,
    };
    const { error: updateError } = await supabase
      .from("subscription_addons")
      .update({
        tier_config: updatedConfig,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", addon.id);

    if (updateError) {
      console.error(
        "[setup-addon-stripe-products] Failed to update tier_config:",
        updateError,
      );
      return new Response(
        JSON.stringify({
          error: "Stripe products created but failed to save to DB",
          stripeProductId,
          results,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `[setup-addon-stripe-products] Successfully set up Stripe products for ${addon.name}:`,
      JSON.stringify(results),
    );

    return new Response(
      JSON.stringify({
        success: true,
        addonName: addon.name,
        stripeProductId,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[setup-addon-stripe-products] Unhandled error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Setup failed", detail: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
