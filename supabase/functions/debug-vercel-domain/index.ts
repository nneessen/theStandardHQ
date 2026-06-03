// supabase/functions/debug-vercel-domain/index.ts
// Temporary debug function to check/remove domain from Vercel

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";

const VERCEL_API_BASE = "https://api.vercel.com";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // =====================================================================
    // AUTHORIZATION — super-admin only.
    // This debug endpoint performs privileged Vercel domain operations
    // (read / remove / activate). It must never be reachable without a
    // verified super-admin JWT. It has no production callers.
    // =====================================================================
    const authHeader = req.headers.get("Authorization");
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!bearer) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createSupabaseAdminClient();

    const { data: authData, error: authErr } =
      await supabaseAdmin.auth.getUser(bearer);

    if (authErr || !authData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("is_super_admin")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (!callerProfile?.is_super_admin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: super-admin required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = Deno.env.get("VERCEL_API_TOKEN");
    const projectId = Deno.env.get("VERCEL_PROJECT_ID");

    if (!token || !projectId) {
      return new Response(
        JSON.stringify({ error: "Vercel credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { hostname, action } = await req.json();

    if (!hostname) {
      return new Response(JSON.stringify({ error: "hostname required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(
      `[debug-vercel-domain] Action: ${action || "check"}, Hostname: ${hostname}`,
    );

    // Check domain status on our project
    const checkResponse = await fetch(
      `${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const onOurProject = checkResponse.status !== 404;
    let checkData = null;
    if (onOurProject) {
      checkData = await checkResponse.json();
    }

    // Check domain config (SSL status)
    const configResponse = await fetch(
      `${VERCEL_API_BASE}/v6/domains/${encodeURIComponent(hostname)}/config`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    let configData = null;
    if (configResponse.ok) {
      configData = await configResponse.json();
    }

    // Check domain info globally (which project owns it)
    const globalResponse = await fetch(
      `${VERCEL_API_BASE}/v5/domains/${encodeURIComponent(hostname)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    let globalData = null;
    if (globalResponse.ok) {
      globalData = await globalResponse.json();
    } else {
      const errorData = await globalResponse.json();
      globalData = { error: errorData };
    }

    // If action is 'remove', try to remove from our project
    if (action === "remove" && onOurProject) {
      console.log(
        `[debug-vercel-domain] Removing ${hostname} from project ${projectId}`,
      );
      const removeResponse = await fetch(
        `${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const removeResult = removeResponse.ok
        ? "success"
        : await removeResponse.json();

      return new Response(
        JSON.stringify({
          hostname,
          projectId,
          wasOnOurProject: onOurProject,
          removeResult,
          globalInfo: globalData,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // If action is 'activate', force update DB status to active
    if (action === "activate") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/custom_domains?hostname=eq.${encodeURIComponent(hostname)}`,
        {
          method: "PATCH",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            status: "active",
            updated_at: new Date().toISOString(),
          }),
        },
      );

      const updateResult = updateResponse.ok
        ? await updateResponse.json()
        : await updateResponse.text();

      return new Response(
        JSON.stringify({
          hostname,
          action: "activate",
          updateResult,
          configData,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        hostname,
        projectId,
        onOurProject,
        projectDomainInfo: checkData,
        domainConfig: configData,
        globalDomainInfo: globalData,
        hint: onOurProject
          ? "Domain IS on our project. Use action:'remove' to delete it, or action:'activate' to force active status."
          : "Domain is NOT on our project. Check globalDomainInfo for ownership details.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[debug-vercel-domain] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
