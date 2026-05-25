// supabase/functions/slack-oauth-init/index.ts
// Generates a signed OAuth URL for Slack authentication
// Supports per-agency Slack app credentials for multi-workspace OAuth

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSignedState } from "../_shared/hmac.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import {
  authorizeSlackImoAccess,
  requireSlackRequestContext,
} from "../_shared/slack-auth.ts";

interface OAuthInitRequest {
  imoId: string;
  userId: string;
  agencyId?: string; // Optional: connect workspace for specific agency
  returnUrl?: string;
}

interface SlackCredentials {
  credential_id: string;
  client_id: string;
  client_secret_encrypted: string;
  signing_secret_encrypted: string | null;
  app_name: string | null;
  source_agency_id: string | null;
  is_fallback: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    console.log("[slack-oauth-init] Function invoked");
    const authContext = await requireSlackRequestContext(req, corsHeaders);
    if (authContext instanceof Response) {
      return authContext;
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    if (!SUPABASE_URL) {
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body: OAuthInitRequest = await req.json();
    const { imoId, userId, agencyId, returnUrl } = body;

    if (!imoId || !userId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing imoId or userId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const imoAccessResponse = await authorizeSlackImoAccess(
      authContext,
      corsHeaders,
      imoId,
    );
    if (imoAccessResponse) {
      return imoAccessResponse;
    }

    if (!authContext.isServiceRoleCall && authContext.userId !== userId) {
      return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (agencyId) {
      const { data: agency, error: agencyError } =
        await authContext.supabaseAdmin
          .from("agencies")
          .select("id, imo_id")
          .eq("id", agencyId)
          .eq("imo_id", imoId)
          .maybeSingle();

      if (agencyError || !agency) {
        return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // =========================================================================
    // Look up Slack credentials for this agency (or fall back to IMO-level/env)
    // =========================================================================
    let clientId: string | null = null;

    // Try database credentials first
    const { data: credentials, error: credError } =
      await authContext.supabaseAdmin.rpc("get_agency_slack_credentials", {
        p_imo_id: imoId,
        p_agency_id: agencyId || null,
      });

    if (credError) {
      console.error(
        "[slack-oauth-init] Error looking up credentials:",
        credError,
      );
    }

    const creds = (credentials as SlackCredentials[] | null)?.[0];

    if (creds?.client_id) {
      clientId = creds.client_id;
      console.log(
        `[slack-oauth-init] Using database credentials${creds.is_fallback ? " (fallback)" : ""} from agency ${creds.source_agency_id || "IMO-level"}`,
      );
    } else {
      // Fall back to environment variable (legacy support)
      clientId = Deno.env.get("SLACK_CLIENT_ID") || null;
      if (clientId) {
        console.log("[slack-oauth-init] Using env SLACK_CLIENT_ID (legacy)");
      }
    }

    if (!clientId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No Slack app credentials configured for this agency",
          needsCredentials: true,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create signed state (includes agencyId for agency-level workspace connection)
    const state = {
      imoId,
      userId,
      agencyId: agencyId || null, // null = IMO-level integration
      timestamp: Date.now(),
      returnUrl,
    };

    const signedState = await createSignedState(state);

    // Build OAuth URL
    const redirectUri = `${SUPABASE_URL}/functions/v1/slack-oauth-callback`;
    const scope =
      "chat:write,chat:write.customize,channels:read,channels:join,users:read,users:read.email";

    const authUrl = new URL("https://slack.com/oauth/v2/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", signedState);

    console.log(
      `[slack-oauth-init] Generated OAuth URL for IMO ${imoId}${agencyId ? `, Agency ${agencyId}` : " (IMO-level)"}`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        url: authUrl.toString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[slack-oauth-init] Unexpected error:", err);
    const corsHeaders = getCorsHeaders(req.headers.get("origin"));
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
