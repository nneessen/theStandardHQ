// supabase/functions/instagram-oauth-init/index.ts
// Generates a Meta OAuth URL for Instagram Business account authentication
// Required scopes: instagram_basic, instagram_manage_messages, pages_manage_metadata

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { createSignedState } from "../_shared/hmac.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import {
  shouldGrantTemporaryInstagramAccess,
  hasPermanentInstagramAccess,
} from "../_shared/temporaryAccess.ts";

interface OAuthInitRequest {
  imoId: string;
  userId: string;
  returnUrl?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    console.log("[instagram-oauth-init] Function invoked");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const INSTAGRAM_APP_ID = Deno.env.get("INSTAGRAM_APP_ID");
    const authHeader = req.headers.get("Authorization");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[instagram-oauth-init] Missing Supabase credentials");
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!INSTAGRAM_APP_ID) {
      console.error("[instagram-oauth-init] INSTAGRAM_APP_ID not configured");
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Instagram integration not configured. Contact administrator.",
          needsCredentials: true,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body: OAuthInitRequest = await req.json();
    const { imoId, userId, returnUrl } = body;

    if (!imoId || !userId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing imoId or userId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check Instagram access with temporary free access period support
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // User-scoped client so current_user_imo_grants_all_features() resolves
    // auth.uid(). The service-role client above has no user context, so that RPC
    // would always see auth.uid() = NULL and return false (the bug that 403'd
    // Epic Life users despite imos.free_all_features = true). Mirrors
    // close-ai-builder / business-tools-proxy, which call this same RPC this way.
    const userClient =
      SUPABASE_ANON_KEY && authHeader
        ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
          })
        : null;

    // Fetch user email for permanent access check
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email;

    let hasInstagramAccess = false;

    // Check for permanent access (Meta App Review accounts)
    if (hasPermanentInstagramAccess(userEmail)) {
      console.log(
        `[instagram-oauth-init] User ${userId} (${userEmail}) granted permanent Instagram access`,
      );
      hasInstagramAccess = true;
    }
    // During temporary free access period (until Feb 1, 2026), grant access to all users
    else if (shouldGrantTemporaryInstagramAccess()) {
      console.log(
        `[instagram-oauth-init] User ${userId} granted access via temporary free access period`,
      );
      hasInstagramAccess = true;
    } else {
      const { data: imoGrantsAllFeatures, error: imoAccessError } = userClient
        ? await userClient.rpc("current_user_imo_grants_all_features")
        : { data: false, error: null };

      if (imoAccessError) {
        console.error(
          "[instagram-oauth-init] Error checking IMO feature bypass:",
          imoAccessError,
        );
      }

      if (imoGrantsAllFeatures) {
        hasInstagramAccess = true;
        console.log(
          `[instagram-oauth-init] User ${userId} granted access via IMO feature bypass`,
        );
      } else {
        // After Feb 1, 2026: Check subscription using the database function
        const { data: accessResult, error: accessError } = await supabase.rpc(
          "user_has_instagram_access",
          { p_user_id: userId },
        );

        if (accessError) {
          console.error(
            "[instagram-oauth-init] Error checking Instagram access:",
            accessError,
          );
        }

        hasInstagramAccess = accessResult === true;
        console.log(
          `[instagram-oauth-init] User ${userId} subscription check result: ${hasInstagramAccess}`,
        );
      }
    }

    if (!hasInstagramAccess) {
      console.warn(
        `[instagram-oauth-init] User ${userId} does not have Instagram access`,
      );
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Instagram DM integration requires Team tier subscription",
          upgradeRequired: true,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `[instagram-oauth-init] User ${userId} has Instagram access, proceeding with OAuth`,
    );

    // Create signed state (includes userId, imoId, timestamp for callback verification)
    const state = {
      imoId,
      userId,
      timestamp: Date.now(),
      returnUrl,
    };

    const signedState = await createSignedState(state);

    // Build Instagram OAuth URL
    const APP_URL = Deno.env.get("APP_URL") || "https://www.thestandardhq.com";
    const redirectUri = `${APP_URL}/api/instagram-oauth-callback`;

    // Instagram Business API scopes
    const scope = [
      "instagram_business_basic",
      "instagram_business_manage_messages",
      "instagram_business_manage_comments",
      "instagram_business_content_publish",
    ].join(",");

    // Use Instagram's OAuth endpoint directly
    const authUrl = new URL("https://www.instagram.com/oauth/authorize");
    authUrl.searchParams.set("client_id", INSTAGRAM_APP_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", signedState);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("enable_fb_login", "0");
    // Force a fresh Instagram login on every connect. Without this, Instagram silently
    // re-authorizes whichever account it last approved (the existing one), so connecting a
    // SECOND business account just re-updates the first. force_reauth=true makes the user
    // log in again and choose which account to connect (multi-account, WI-6).
    authUrl.searchParams.set("force_reauth", "true");

    console.log(
      `[instagram-oauth-init] Generated OAuth URL for IMO ${imoId}, user ${userId}`,
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
    console.error("[instagram-oauth-init] Unexpected error:", err);
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
