// Edge Function: custom-domain-status
// Checks current domain status and updates from Vercel if provisioning

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import { getDomainStatus, getDomainConfig } from "../_shared/vercel-api.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Accept both GET and POST
    if (req.method !== "GET" && req.method !== "POST") {
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

    // Get domain_id from query params (GET) or body (POST)
    let domain_id: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      domain_id = url.searchParams.get("domain_id");
    } else {
      const body = await req.json();
      domain_id = body.domain_id;
    }

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

    // If domain is in provisioning status, check Vercel for updates
    if (domain.status === "provisioning" && domain.provider_domain_id) {
      // Timeout detection first — use the DB timestamp (before any updates)
      const provisioningAge =
        Date.now() - new Date(domain.updated_at).getTime();
      const TWO_HOURS = 2 * 60 * 60 * 1000;

      console.log(
        "[custom-domain-status] Checking Vercel status:",
        domain.hostname,
      );

      // Dual-check: getDomainStatus (v9 project domains) + getDomainConfig (v6 domain config)
      // getDomainStatus.configured is unreliable (often undefined), so we also check
      // getDomainConfig.misconfigured which is the reliable indicator
      const [vercelResult, configResult] = await Promise.all([
        getDomainStatus(domain.hostname),
        getDomainConfig(domain.hostname),
      ]);

      const vercelData = vercelResult.success ? vercelResult.data : null;
      const configData = configResult.success ? configResult.data : null;

      // Build diagnostics for the frontend
      const diagnostics = {
        dns_configured: configData?.misconfigured === false,
        cnames_found: configData?.cnames ?? [],
        misconfigured: configData?.misconfigured ?? null,
        vercel_verified: vercelData?.verified ?? null,
        vercel_configured: vercelData?.configured ?? null,
        configured_by: configData?.configuredBy ?? null,
      };

      // Domain is active if EITHER check confirms it
      const isConfigured =
        vercelData?.configured === true || configData?.misconfigured === false;

      if (vercelData || configData) {
        if (isConfigured) {
          // Transition to active!
          const metadata = vercelData ?? configData;
          const { data: activeDomain, error: activeError } =
            await supabaseAdmin.rpc("admin_update_domain_status", {
              p_domain_id: domain.id,
              p_user_id: user.id,
              p_new_status: "active",
              p_provider_metadata: JSON.stringify(metadata),
            });

          if (activeError) {
            console.error(
              "[custom-domain-status] Active transition error:",
              activeError,
            );
          } else {
            console.log(
              "[custom-domain-status] Domain now active:",
              domain.hostname,
              "detected via:",
              vercelData?.configured === true
                ? "v9 configured"
                : "v6 !misconfigured",
            );

            return new Response(
              JSON.stringify({
                status: "active",
                domain: activeDomain,
                diagnostics,
                message: "Domain is now active! SSL certificate is ready.",
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
        }

        // Not configured yet — check if we've exceeded the timeout
        if (provisioningAge > TWO_HOURS) {
          console.log(
            "[custom-domain-status] Provisioning timeout:",
            domain.hostname,
            `(${Math.round(provisioningAge / 60000)}m)`,
          );

          const timeoutDetails = configData?.misconfigured
            ? "DNS appears misconfigured. Check your CNAME record points to cname.vercel-dns.com."
            : "SSL provisioning timed out after 2 hours.";

          const { data: errorDomain, error: errorTransition } =
            await supabaseAdmin.rpc("admin_update_domain_status", {
              p_domain_id: domain.id,
              p_user_id: user.id,
              p_new_status: "error",
              p_provider_metadata: JSON.stringify(vercelData ?? configData),
              p_last_error: `${timeoutDetails} You can retry provisioning or delete and re-add.`,
            });

          if (!errorTransition) {
            return new Response(
              JSON.stringify({
                status: "error",
                domain: errorDomain,
                diagnostics,
                message: `${timeoutDetails} You can retry provisioning or delete and re-add.`,
              }),
              {
                status: 200,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              },
            );
          }
        }

        // Update provider_metadata (but don't reset updated_at — preserve timeout tracking)
        await supabaseAdmin
          .from("custom_domains")
          .update({ provider_metadata: vercelData ?? domain.provider_metadata })
          .eq("id", domain.id);

        // Still provisioning - return updated data with diagnostics
        return new Response(
          JSON.stringify({
            status: "provisioning",
            domain: {
              ...domain,
              provider_metadata: vercelData ?? domain.provider_metadata,
            },
            vercel_verification: vercelData?.verification || [],
            diagnostics,
            message: "SSL certificate is still being provisioned.",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } else {
        // Both Vercel API calls failed
        console.error(
          "[custom-domain-status] Both Vercel checks failed:",
          vercelResult.error,
          configResult.error,
        );

        // Still check timeout even when Vercel API fails
        if (provisioningAge > TWO_HOURS) {
          console.log(
            "[custom-domain-status] Provisioning timeout (Vercel unreachable):",
            domain.hostname,
          );

          const { data: errorDomain, error: errorTransition } =
            await supabaseAdmin.rpc("admin_update_domain_status", {
              p_domain_id: domain.id,
              p_user_id: user.id,
              p_new_status: "error",
              p_provider_metadata: JSON.stringify(domain.provider_metadata),
              p_last_error:
                "SSL provisioning timed out after 2 hours (Vercel unreachable). You can retry provisioning or delete and re-add.",
            });

          if (!errorTransition) {
            return new Response(
              JSON.stringify({
                status: "error",
                domain: errorDomain,
                message:
                  "SSL provisioning timed out. You can retry provisioning or delete and re-add.",
              }),
              {
                status: 200,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              },
            );
          }
        }
      }
    }

    // Return current domain state
    return new Response(
      JSON.stringify({
        status: domain.status,
        domain: domain,
        message: getStatusMessage(domain.status),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[custom-domain-status] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getStatusMessage(status: string): string {
  switch (status) {
    case "draft":
      return "Domain created. Configure DNS and verify ownership.";
    case "pending_dns":
      return "Waiting for DNS verification.";
    case "verified":
      return "DNS verified. Ready to provision.";
    case "provisioning":
      return "SSL certificate is being provisioned.";
    case "active":
      return "Domain is active and ready to use.";
    case "error":
      return "An error occurred. Check last_error for details.";
    default:
      return "Unknown status.";
  }
}
