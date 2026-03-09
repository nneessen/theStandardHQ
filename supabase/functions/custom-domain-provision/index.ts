// Edge Function: custom-domain-provision
// Adds verified domain to Vercel project for SSL provisioning

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import { addDomainToVercel, getDomainConfig } from "../_shared/vercel-api.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Validate request method
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Extract and validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse request body
    const { domain_id } = await req.json();

    if (!domain_id) {
      return new Response(JSON.stringify({ error: "domain_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch domain record
    const { data: domain, error: fetchError } = await supabaseAdmin
      .from("custom_domains")
      .select("*")
      .eq("id", domain_id)
      .single();

    if (fetchError || !domain) {
      return new Response(JSON.stringify({ error: "Domain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    if (domain.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check status: must be verified, OR error with a previous verified_at (retry)
    const canProvision =
      domain.status === "verified" ||
      (domain.status === "error" && domain.verified_at != null);

    if (!canProvision) {
      return new Response(
        JSON.stringify({
          error: `Cannot provision domain in ${domain.status} status. DNS verification required first.`,
          current_status: domain.status,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Transition to provisioning status
    const { error: transitionError } = await supabaseAdmin.rpc(
      "admin_update_domain_status",
      {
        p_domain_id: domain.id,
        p_user_id: user.id,
        p_new_status: "provisioning",
      },
    );

    if (transitionError) {
      console.error(
        "[custom-domain-provision] Transition error:",
        transitionError,
      );
      return new Response(
        JSON.stringify({ error: "Failed to update domain status" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Add domain to Vercel
    console.log("[custom-domain-provision] Adding to Vercel:", domain.hostname);
    const vercelResult = await addDomainToVercel(domain.hostname);

    if (!vercelResult.success) {
      // Transition to error status
      await supabaseAdmin.rpc("admin_update_domain_status", {
        p_domain_id: domain.id,
        p_user_id: user.id,
        p_new_status: "error",
        p_last_error: vercelResult.error,
        p_provider_metadata: vercelResult.data
          ? JSON.stringify(vercelResult.data)
          : null,
      });

      console.error(
        "[custom-domain-provision] Vercel error:",
        vercelResult.error,
      );

      return new Response(
        JSON.stringify({
          error: vercelResult.error,
          vercel_data: vercelResult.data,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const vercelData = vercelResult.data!;

    // Dual-check: also hit getDomainConfig for the reliable misconfigured flag
    const configResult = await getDomainConfig(domain.hostname);
    const configData = configResult.success ? configResult.data : null;

    // Domain is active if EITHER check confirms it
    const isConfigured =
      vercelData.configured === true || configData?.misconfigured === false;

    if (isConfigured) {
      // Domain is immediately active!
      const { data: activeDomain, error: activeError } =
        await supabaseAdmin.rpc("admin_update_domain_status", {
          p_domain_id: domain.id,
          p_user_id: user.id,
          p_new_status: "active",
          p_provider_domain_id: vercelData.name,
          p_provider_metadata: JSON.stringify(vercelData),
        });

      if (activeError) {
        console.error(
          "[custom-domain-provision] Active transition error:",
          activeError,
        );
      }

      console.log(
        "[custom-domain-provision] Domain immediately active:",
        domain.hostname,
      );

      return new Response(
        JSON.stringify({
          status: "active",
          domain: activeDomain,
          message: "Domain is now active! SSL certificate is ready.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Domain added but SSL not yet configured - stay in provisioning
    await supabaseAdmin.rpc("admin_update_domain_status", {
      p_domain_id: domain.id,
      p_user_id: user.id,
      p_new_status: "provisioning",
      p_provider_domain_id: vercelData.name,
      p_provider_metadata: JSON.stringify(vercelData),
    });

    // Actually this won't work since we're already in provisioning - just update metadata directly
    await supabaseAdmin
      .from("custom_domains")
      .update({
        provider_domain_id: vercelData.name,
        provider_metadata: vercelData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", domain.id);

    console.log(
      "[custom-domain-provision] Domain provisioning:",
      domain.hostname,
    );

    // Check if Vercel requires additional verification
    const vercelVerification = vercelData.verification || [];

    return new Response(
      JSON.stringify({
        status: "provisioning",
        domain: {
          ...domain,
          provider_metadata: vercelData,
          status: "provisioning",
        },
        vercel_verification: vercelVerification,
        message:
          vercelVerification.length > 0
            ? "Domain added. Vercel requires additional verification records."
            : "Domain added. SSL certificate is being provisioned. This may take a few minutes.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[custom-domain-provision] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
