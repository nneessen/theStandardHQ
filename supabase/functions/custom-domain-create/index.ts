// Edge Function: custom-domain-create
// Creates a new custom domain record, adds to Vercel, and initiates DNS verification flow

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import { validateHostname, getDnsInstructions } from "../_shared/dns-lookup.ts";
import {
  addDomainToVercel,
  getDomainConfig,
  removeDomainFromVercel,
} from "../_shared/vercel-api.ts";

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

    // Create admin client for service_role operations
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
      console.error("[custom-domain-create] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse request body
    const { hostname } = await req.json();

    // Validate hostname format
    const validation = validateHostname(hostname);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedHostname = hostname.toLowerCase().trim();

    // Get user's profile to retrieve imo_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("imo_id, recruiter_slug")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("[custom-domain-create] Profile error:", profileError);
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profile.imo_id) {
      return new Response(
        JSON.stringify({
          error: "User must belong to an IMO to create custom domains",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if user already has an active domain (v1 limit)
    const { data: existingActive } = await supabaseAdmin
      .from("custom_domains")
      .select("id, hostname")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (existingActive) {
      return new Response(
        JSON.stringify({
          error:
            "You already have an active custom domain. Delete it first to add a new one.",
          existing_hostname: existingActive.hostname,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if hostname is already in use (globally unique)
    const { data: existingHostname } = await supabaseAdmin
      .from("custom_domains")
      .select("id, status")
      .eq("hostname", normalizedHostname)
      .maybeSingle();

    if (existingHostname) {
      return new Response(
        JSON.stringify({ error: "This hostname is already registered" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Insert domain record with draft status.
    // No homegrown verification token — Vercel proves ownership via the CNAME itself.
    const { data: domain, error: insertError } = await supabaseAdmin
      .from("custom_domains")
      .insert({
        imo_id: profile.imo_id,
        user_id: user.id,
        hostname: normalizedHostname,
        status: "draft",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[custom-domain-create] Insert error:", insertError);

      // Handle unique constraint violation
      if (insertError.code === "23505") {
        return new Response(
          JSON.stringify({ error: "This hostname is already registered" }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to create domain record" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Register the domain with Vercel. This is REQUIRED — without it, Vercel never
    // issues SSL and the domain can never go live. So if it fails, fail loudly:
    // delete the draft row (never strand a half-created domain) and surface the error.
    console.log("[custom-domain-create] Adding to Vercel:", normalizedHostname);
    const vercelResult = await addDomainToVercel(normalizedHostname);

    if (!vercelResult.success || !vercelResult.data) {
      console.error(
        "[custom-domain-create] Vercel add failed:",
        vercelResult.error,
      );
      // Roll back the draft so the user can retry cleanly.
      await supabaseAdmin.from("custom_domains").delete().eq("id", domain.id);

      // domain_already_in_use on ANOTHER project is the user's to resolve (409);
      // anything else (invalid token, API outage) is a platform problem (502).
      const isUserResolvable = (vercelResult.error || "")
        .toLowerCase()
        .includes("another");
      return new Response(
        JSON.stringify({
          error:
            vercelResult.error ||
            "Custom domain service is temporarily unavailable. Please contact support.",
        }),
        {
          status: isUserResolvable ? 409 : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const vercelData = vercelResult.data as unknown as Record<string, unknown>;

    // Resolve the real CNAME target Vercel expects (domain-specific), falling
    // back to the generic target only if the config endpoint gives us nothing.
    let vercelCname = "cname.vercel-dns.com";
    const configResult = await getDomainConfig(normalizedHostname);
    if (
      configResult.success &&
      configResult.data?.cnames &&
      configResult.data.cnames.length > 0
    ) {
      vercelCname = configResult.data.cnames[0];
    }

    console.log("[custom-domain-create] Vercel response:", {
      name: vercelData.name,
      configured: vercelData.configured,
      verified: vercelData.verified,
      vercelCname,
    });

    // Store Vercel identity + metadata.
    await supabaseAdmin
      .from("custom_domains")
      .update({
        provider_domain_id: (vercelData.name as string) || normalizedHostname,
        provider_metadata: {
          ...vercelData,
          vercel_cname: vercelCname,
        },
      })
      .eq("id", domain.id);

    // Transition draft -> pending_dns.
    const { data: updatedDomain, error: transitionError } =
      await supabaseAdmin.rpc("admin_update_domain_status", {
        p_domain_id: domain.id,
        p_user_id: user.id,
        p_new_status: "pending_dns",
      });

    if (transitionError) {
      console.error(
        "[custom-domain-create] Transition error:",
        transitionError,
      );
      // Clean up the draft record + deprovision Vercel to avoid orphans.
      await removeDomainFromVercel(normalizedHostname);
      await supabaseAdmin.from("custom_domains").delete().eq("id", domain.id);
      return new Response(
        JSON.stringify({ error: "Failed to initialize domain" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Single CNAME instruction — Vercel verifies ownership + issues SSL once it resolves.
    const dnsInstructions = getDnsInstructions(normalizedHostname, vercelCname);

    console.log("[custom-domain-create] Domain created:", {
      id: domain.id,
      hostname: normalizedHostname,
      user_id: user.id,
      vercelCname,
    });

    // Refetch the domain to get updated provider_metadata.
    const { data: finalDomain } = await supabaseAdmin
      .from("custom_domains")
      .select("*")
      .eq("id", domain.id)
      .single();

    return new Response(
      JSON.stringify({
        domain: finalDomain || updatedDomain,
        dns_instructions: dnsInstructions,
        vercel_cname: vercelCname,
        message:
          "Domain created. Add the CNAME record below — it goes live automatically once DNS resolves.",
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[custom-domain-create] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
