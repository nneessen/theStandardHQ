// supabase/functions/slack-oauth-callback/index.ts
// Handles Slack OAuth callback, exchanges code for tokens, stores encrypted
// Supports per-agency Slack app credentials for multi-workspace OAuth

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { encrypt, decrypt } from "../_shared/encryption.ts";
import { parseSignedState } from "../_shared/hmac.ts";
import { corsResponse } from "../_shared/cors.ts";
import { EPIC_LIFE_IMO_ID } from "../_shared/slack-auth.ts";

interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: {
    id: string;
    name: string;
  };
  authed_user?: {
    id: string;
    scope?: string;
    access_token?: string;
    token_type?: string;
  };
  error?: string;
}

interface OAuthState {
  imoId: string;
  userId: string;
  agencyId?: string | null; // Agency-level integration (null = IMO-level)
  timestamp: number;
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

  // APP_URL must be set - no fallback to avoid cross-tenant issues
  const APP_URL = Deno.env.get("APP_URL");
  if (!APP_URL) {
    console.error(
      "[slack-oauth-callback] APP_URL environment variable not set",
    );
    return new Response(
      JSON.stringify({ error: "Server configuration error: APP_URL not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    console.log("[slack-oauth-callback] Function invoked");

    // Get environment variables
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[slack-oauth-callback] Missing Supabase credentials");
      return Response.redirect(
        `${APP_URL}/settings/integrations?slack=error&reason=config`,
      );
    }

    // Parse URL parameters
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Handle OAuth errors from Slack
    if (error) {
      console.error("[slack-oauth-callback] Slack OAuth error:", error);
      return Response.redirect(
        `${APP_URL}/settings/integrations?slack=error&reason=${error}`,
      );
    }

    if (!code || !stateParam) {
      console.error("[slack-oauth-callback] Missing code or state");
      return Response.redirect(
        `${APP_URL}/settings/integrations?slack=error&reason=missing_params`,
      );
    }

    // Parse and verify signed state (HMAC protected)
    const state = await parseSignedState<OAuthState>(stateParam);

    if (!state) {
      console.error(
        "[slack-oauth-callback] Invalid or tampered state parameter",
      );
      return Response.redirect(
        `${APP_URL}/settings/integrations?slack=error&reason=invalid_state`,
      );
    }

    // Check state timestamp (expire after 10 minutes)
    if (Date.now() - state.timestamp > 10 * 60 * 1000) {
      console.error("[slack-oauth-callback] State expired");
      return Response.redirect(
        `${APP_URL}/settings/integrations?slack=error&reason=expired`,
      );
    }

    const { imoId, userId, agencyId, returnUrl } = state;

    if (imoId === EPIC_LIFE_IMO_ID) {
      return Response.redirect(
        `${APP_URL}/settings/integrations?slack=error&reason=epic_disabled`,
      );
    }

    // Ensure redirect URL is absolute (handle relative paths from frontend)
    let redirectUrl = returnUrl || `${APP_URL}/settings/integrations`;
    if (redirectUrl.startsWith("/")) {
      redirectUrl = `${APP_URL}${redirectUrl}`;
    }

    console.log(
      `[slack-oauth-callback] Processing OAuth for IMO: ${imoId}${agencyId ? `, Agency: ${agencyId}` : " (IMO-level)"}`,
    );

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("imo_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile?.imo_id || profile.imo_id !== imoId) {
      return Response.redirect(`${redirectUrl}?slack=error&reason=forbidden`);
    }

    if (agencyId) {
      const { data: agency, error: agencyError } = await supabase
        .from("agencies")
        .select("id")
        .eq("id", agencyId)
        .eq("imo_id", imoId)
        .maybeSingle();

      if (agencyError || !agency) {
        return Response.redirect(`${redirectUrl}?slack=error&reason=forbidden`);
      }
    }

    // =========================================================================
    // Look up Slack credentials for this agency
    // =========================================================================
    let clientId: string | null = null;
    let clientSecret: string | null = null;

    // Try database credentials first
    const { data: credentials, error: credError } = await supabase.rpc(
      "get_agency_slack_credentials",
      {
        p_imo_id: imoId,
        p_agency_id: agencyId || null,
      },
    );

    if (credError) {
      console.error(
        "[slack-oauth-callback] Error looking up credentials:",
        credError,
      );
    }

    const creds = (credentials as SlackCredentials[] | null)?.[0];

    if (creds?.client_id && creds?.client_secret_encrypted) {
      clientId = creds.client_id;
      try {
        clientSecret = await decrypt(creds.client_secret_encrypted);
        console.log(
          `[slack-oauth-callback] Using database credentials${creds.is_fallback ? " (fallback)" : ""} from agency ${creds.source_agency_id || "IMO-level"}`,
        );
      } catch (decryptErr) {
        console.error(
          "[slack-oauth-callback] Failed to decrypt client secret:",
          decryptErr,
        );
      }
    }

    // Fall back to environment variables (legacy support)
    if (!clientId || !clientSecret) {
      clientId = Deno.env.get("SLACK_CLIENT_ID") || null;
      clientSecret = Deno.env.get("SLACK_CLIENT_SECRET") || null;
      if (clientId && clientSecret) {
        console.log(
          "[slack-oauth-callback] Using env SLACK_CLIENT_ID/SECRET (legacy)",
        );
      }
    }

    if (!clientId || !clientSecret) {
      console.error("[slack-oauth-callback] No valid Slack credentials found");
      return Response.redirect(
        `${redirectUrl}?slack=error&reason=no_credentials`,
      );
    }

    // Exchange code for tokens
    const tokenUrl = "https://slack.com/api/oauth.v2.access";
    const tokenRedirectUri = `${SUPABASE_URL}/functions/v1/slack-oauth-callback`;

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: tokenRedirectUri,
      }),
    });

    const tokenData: SlackOAuthResponse = await tokenResponse.json();

    if (!tokenData.ok || !tokenData.access_token) {
      console.error(
        "[slack-oauth-callback] Token exchange failed:",
        tokenData.error,
      );
      return Response.redirect(
        `${redirectUrl}?slack=error&reason=${tokenData.error || "token_exchange"}`,
      );
    }

    console.log("[slack-oauth-callback] Token exchange successful:", {
      teamId: tokenData.team?.id,
      teamName: tokenData.team?.name,
      botUserId: tokenData.bot_user_id,
    });

    // Encrypt tokens
    const encryptedAccessToken = await encrypt(tokenData.access_token);
    const encryptedBotToken = await encrypt(tokenData.access_token); // Bot token is same as access_token in v2
    const encryptedUserToken = tokenData.authed_user?.access_token
      ? await encrypt(tokenData.authed_user.access_token)
      : null;

    // Upsert the integration - use (team_id, agency_id) as conflict key
    // This allows:
    // - Multiple workspaces per IMO (different team_id values)
    // - Same workspace connected at different agency levels (same team_id, different agency_id)
    // - But prevents duplicate (team_id, agency_id) pairs
    const teamId = tokenData.team?.id || "";
    const teamName = tokenData.team?.name || "Unknown Workspace";

    // First, check if an integration already exists for this team_id + agency_id combination
    // We do this because Postgres UNIQUE constraints treat NULL as distinct, so we need to handle it manually
    let existingQuery = supabase
      .from("slack_integrations")
      .select("id")
      .eq("team_id", teamId);

    // Handle NULL agency_id properly (use .is() for NULL comparison)
    if (agencyId) {
      existingQuery = existingQuery.eq("agency_id", agencyId);
    } else {
      existingQuery = existingQuery.is("agency_id", null);
    }

    const { data: existingIntegration } = await existingQuery.maybeSingle();

    const integrationData = {
      imo_id: imoId,
      agency_id: agencyId || null, // Agency-level or IMO-level integration
      access_token_encrypted: encryptedAccessToken,
      bot_token_encrypted: encryptedBotToken,
      refresh_token_encrypted: encryptedUserToken,
      team_id: teamId,
      team_name: teamName,
      display_name: teamName, // Set display_name to team_name by default
      bot_user_id: tokenData.bot_user_id || "",
      bot_name: "The Standard HQ",
      scope: tokenData.scope || "",
      token_type: tokenData.token_type || "bot",
      authed_user_id: tokenData.authed_user?.id,
      authed_user_email: null, // Would need separate API call to get email
      is_active: true,
      connection_status: "connected",
      last_error: null,
      last_connected_at: new Date().toISOString(),
      created_by: userId,
    };

    let upsertError;
    if (existingIntegration) {
      // Update existing integration
      const { error } = await supabase
        .from("slack_integrations")
        .update(integrationData)
        .eq("id", existingIntegration.id);
      upsertError = error;
    } else {
      // Insert new integration
      const { error } = await supabase
        .from("slack_integrations")
        .insert(integrationData);
      upsertError = error;
    }

    if (upsertError) {
      console.error(
        "[slack-oauth-callback] Failed to save integration:",
        upsertError,
      );
      return Response.redirect(`${redirectUrl}?slack=error&reason=save_failed`);
    }

    console.log(
      `[slack-oauth-callback] Integration saved successfully for workspace: ${teamName}${agencyId ? ` (Agency: ${agencyId})` : " (IMO-level)"}`,
    );

    // Redirect back to app with success
    return Response.redirect(
      `${redirectUrl}?slack=success&team=${encodeURIComponent(tokenData.team?.name || "")}`,
    );
  } catch (err) {
    console.error("[slack-oauth-callback] Unexpected error:", err);
    const errorMsg =
      err instanceof Error ? encodeURIComponent(err.message) : "unknown";
    return Response.redirect(
      `${APP_URL}/settings/integrations?slack=error&reason=unexpected&details=${errorMsg}`,
    );
  }
});
