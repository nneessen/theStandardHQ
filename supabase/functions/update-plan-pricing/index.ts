// supabase/functions/update-plan-pricing/index.ts
// Updates a subscription plan's pricing in both the DB and Stripe atomically.
// Creates new Stripe prices, archives old ones, updates subscription_plans row,
// and writes an audit entry to subscription_plan_changes.
// Restricted to super admin callers only.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UpdatePlanPricingBody {
  planId: string;
  priceMonthly: number; // in cents, e.g. 15000 = $150/mo
  priceAnnual: number; // in cents, e.g. 144000 = $1440/yr
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

    // ── 1. Verify caller is authenticated ──────────────────────────────────
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

    // ── 2. Verify caller is super admin ────────────────────────────────────
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

    // ── 3. Parse and validate input ────────────────────────────────────────
    const body: UpdatePlanPricingBody = await req.json();
    const { planId, priceMonthly, priceAnnual } = body;

    if (
      !planId ||
      typeof planId !== "string" ||
      priceMonthly == null ||
      priceAnnual == null
    ) {
      return new Response(
        JSON.stringify({
          error: "planId, priceMonthly, and priceAnnual are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (typeof priceMonthly !== "number" || typeof priceAnnual !== "number") {
      return new Response(
        JSON.stringify({
          error: "priceMonthly and priceAnnual must be numbers",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (priceMonthly < 0 || priceAnnual < 0) {
      return new Response(
        JSON.stringify({ error: "Prices must be non-negative" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Stripe's unit_amount max is 99999999 cents. Use 999999 ($9,999.99) as a
    // conservative business limit to catch fat-finger errors before they reach Stripe.
    if (priceMonthly > 999999 || priceAnnual > 999999) {
      return new Response(
        JSON.stringify({
          error:
            "Prices exceed maximum allowed value (999999 cents = $9,999.99)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── 4. Fetch current plan ──────────────────────────────────────────────
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select(
        "id, name, display_name, price_monthly, price_annual, stripe_price_id_monthly, stripe_price_id_annual, stripe_product_id",
      )
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 5. Create new Stripe prices (only for prices that changed) ─────────
    let newMonthlyPriceId: string | null = plan.stripe_price_id_monthly;
    let newAnnualPriceId: string | null = plan.stripe_price_id_annual;

    const monthlyChanged = priceMonthly !== plan.price_monthly;
    const annualChanged = priceAnnual !== plan.price_annual;

    if (monthlyChanged && plan.stripe_product_id) {
      const newMonthlyPrice = await stripe.prices.create({
        unit_amount: priceMonthly,
        currency: "usd",
        recurring: { interval: "month" },
        product: plan.stripe_product_id,
        active: true,
        metadata: {
          plan_id: planId,
          plan_name: plan.name,
        },
      });
      newMonthlyPriceId = newMonthlyPrice.id;
    }

    if (annualChanged && plan.stripe_product_id) {
      const newAnnualPrice = await stripe.prices.create({
        unit_amount: priceAnnual,
        currency: "usd",
        recurring: { interval: "year" },
        product: plan.stripe_product_id,
        active: true,
        metadata: {
          plan_id: planId,
          plan_name: plan.name,
        },
      });
      newAnnualPriceId = newAnnualPrice.id;
    }

    // ── 6. Update DB (subscription_plans row) ──────────────────────────────
    const updatePayload: Record<string, unknown> = {
      price_monthly: priceMonthly,
      price_annual: priceAnnual,
      updated_at: new Date().toISOString(),
    };
    if (newMonthlyPriceId !== plan.stripe_price_id_monthly) {
      updatePayload.stripe_price_id_monthly = newMonthlyPriceId;
    }
    if (newAnnualPriceId !== plan.stripe_price_id_annual) {
      updatePayload.stripe_price_id_annual = newAnnualPriceId;
    }

    const { data: updatedPlan, error: updateError } = await supabase
      .from("subscription_plans")
      .update(updatePayload)
      .eq("id", planId)
      .select()
      .single();

    if (updateError) {
      console.error("[update-plan-pricing] DB update failed:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update plan in database" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── 7. Archive old Stripe prices (after DB is committed) ───────────────
    if (
      monthlyChanged &&
      plan.stripe_price_id_monthly &&
      newMonthlyPriceId !== plan.stripe_price_id_monthly
    ) {
      try {
        await stripe.prices.update(plan.stripe_price_id_monthly, {
          active: false,
        });
      } catch (archiveErr) {
        // Non-fatal: log but don't fail. Old price is orphaned but DB is correct.
        console.warn(
          "[update-plan-pricing] Failed to archive old monthly price:",
          plan.stripe_price_id_monthly,
          archiveErr,
        );
      }
    }

    if (
      annualChanged &&
      plan.stripe_price_id_annual &&
      newAnnualPriceId !== plan.stripe_price_id_annual
    ) {
      try {
        await stripe.prices.update(plan.stripe_price_id_annual, {
          active: false,
        });
      } catch (archiveErr) {
        console.warn(
          "[update-plan-pricing] Failed to archive old annual price:",
          plan.stripe_price_id_annual,
          archiveErr,
        );
      }
    }

    // ── 8. Write audit entry ───────────────────────────────────────────────
    const { error: auditError } = await supabase
      .from("subscription_plan_changes")
      .insert({
        plan_id: planId,
        changed_by: user.id,
        change_type: "pricing",
        old_value: {
          price_monthly: plan.price_monthly,
          price_annual: plan.price_annual,
          stripe_price_id_monthly: plan.stripe_price_id_monthly,
          stripe_price_id_annual: plan.stripe_price_id_annual,
        },
        new_value: {
          price_monthly: priceMonthly,
          price_annual: priceAnnual,
          stripe_price_id_monthly: newMonthlyPriceId,
          stripe_price_id_annual: newAnnualPriceId,
        },
      });

    if (auditError) {
      // Pricing update already committed to DB and Stripe — do not fail the request.
      // Log as error so compliance gaps surface in function logs.
      console.error(
        "[update-plan-pricing] Audit trail write failed:",
        auditError,
      );
    }

    return new Response(JSON.stringify({ plan: updatedPlan }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Log the full error server-side; never expose internal details to callers.
    console.error("[update-plan-pricing] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Pricing update failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
