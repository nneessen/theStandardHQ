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

    // While the domain is awaiting DNS or issuing SSL, poll Vercel for updates.
    // Both pending_dns (waiting for the user's CNAME) and provisioning (DNS seen,
    // SSL minting) must check Vercel — otherwise a pending_dns domain would never
    // auto-advance to active.
    if (
      (domain.status === "pending_dns" || domain.status === "provisioning") &&
      domain.provider_domain_id
    ) {
      // Timeout applies ONLY to provisioning (SSL issuing). pending_dns may sit
      // for days while the user adds DNS, so it must never time out.
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
            // Vercel says it's configured but we couldn't flip to active. Return
            // the current state and let the next poll retry — do NOT fall through
            // to the timeout block below, which could wrongly mark a configured
            // domain as errored.
            return new Response(
              JSON.stringify({
                status: domain.status,
                domain,
                diagnostics,
                message: "Finalizing — your domain is configured on Vercel.",
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
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

        // Not configured yet.
        // Timeout applies only once SSL is actually being issued (provisioning).
        if (domain.status === "provisioning" && provisioningAge > TWO_HOURS) {
          console.log(
            "[custom-domain-status] Provisioning timeout:",
            domain.hostname,
            `(${Math.round(provisioningAge / 60000)}m)`,
          );

          const timeoutDetails = configData?.misconfigured
            ? "DNS appears misconfigured. Check your CNAME record points to the value shown."
            : "SSL provisioning timed out after 2 hours.";

          const { data: errorDomain, error: errorTransition } =
            await supabaseAdmin.rpc("admin_update_domain_status", {
              p_domain_id: domain.id,
              p_user_id: user.id,
              p_new_status: "error",
              p_provider_metadata: JSON.stringify(vercelData ?? configData),
              p_last_error: `${timeoutDetails} You can delete and re-add the domain to retry.`,
            });

          if (!errorTransition) {
            return new Response(
              JSON.stringify({
                status: "error",
                domain: errorDomain,
                diagnostics,
                message: `${timeoutDetails} You can delete and re-add the domain to retry.`,
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

        // NOTE: we intentionally do NOT auto-advance pending_dns -> provisioning.
        // Vercel returns verified:true for a subdomain at create time (before any
        // CNAME exists), so keying a transition on it would arm the 2h SSL timeout
        // before the user adds DNS and prematurely error a slow-but-correct user.
        // There is no reliable "CNAME present but SSL still minting" signal
        // (misconfigured===false is already our active trigger), so we stay in
        // pending_dns, poll, and jump straight to active once configured. A truly
        // misconfigured domain simply sits in pending_dns with diagnostics showing
        // misconfigured:Yes — more honest than a misleading hard error.

        // Merge fresh Vercel data over the existing metadata — do NOT replace it,
        // or we'd drop the synthetic `vercel_cname` we stored at create time and
        // the DNS instructions would revert to the generic CNAME target while the
        // user is still trying to add the record.
        const existingMeta =
          domain.provider_metadata &&
          typeof domain.provider_metadata === "object"
            ? (domain.provider_metadata as Record<string, unknown>)
            : {};
        const mergedMeta = vercelData
          ? {
              ...existingMeta,
              ...(vercelData as unknown as Record<string, unknown>),
            }
          : existingMeta;

        // Update provider_metadata (but don't reset updated_at — preserve timeout tracking)
        await supabaseAdmin
          .from("custom_domains")
          .update({ provider_metadata: mergedMeta })
          .eq("id", domain.id);

        // Still waiting — keep the current status (pending_dns or provisioning).
        return new Response(
          JSON.stringify({
            status: domain.status,
            domain: {
              ...domain,
              provider_metadata: mergedMeta,
            },
            vercel_verification: vercelData?.verification || [],
            diagnostics,
            message:
              domain.status === "pending_dns"
                ? "Waiting for the CNAME record to propagate."
                : "SSL certificate is still being provisioned.",
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

        // Still check timeout even when Vercel API fails — but only for
        // provisioning (an SSL-issuing domain), never pending_dns.
        if (domain.status === "provisioning" && provisioningAge > TWO_HOURS) {
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
                "SSL provisioning timed out after 2 hours (Vercel unreachable). You can delete and re-add the domain to retry.",
            });

          if (!errorTransition) {
            return new Response(
              JSON.stringify({
                status: "error",
                domain: errorDomain,
                message:
                  "SSL provisioning timed out. You can delete and re-add the domain to retry.",
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
      return "Add the CNAME record — your domain goes live automatically once it resolves.";
    case "verified":
      return "DNS verified.";
    case "provisioning":
      return "DNS detected. SSL certificate is being issued.";
    case "active":
      return "Domain is active and ready to use.";
    case "error":
      return "An error occurred. Check last_error for details.";
    default:
      return "Unknown status.";
  }
}
