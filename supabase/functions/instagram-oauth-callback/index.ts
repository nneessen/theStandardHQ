// supabase/functions/instagram-oauth-callback/index.ts
// Handles Meta OAuth callback for Instagram Business account connection
// 1. Exchanges code for short-lived token
// 2. Exchanges short-lived for long-lived token (~60 days)
// 3. Gets Instagram Business Account from connected Facebook Page
// 4. Stores encrypted tokens in instagram_integrations table

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { encrypt } from "../_shared/encryption.ts";
import { parseSignedState } from "../_shared/hmac.ts";
import { corsResponse } from "../_shared/cors.ts";

interface OAuthState {
  imoId: string;
  userId: string;
  timestamp: number;
  returnUrl?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  // APP_URL must be set
  const APP_URL = Deno.env.get("APP_URL");
  if (!APP_URL) {
    console.error(
      "[instagram-oauth-callback] APP_URL environment variable not set",
    );
    return new Response(
      JSON.stringify({ error: "Server configuration error: APP_URL not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    console.log("[instagram-oauth-callback] Function invoked");

    // Get environment variables
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const INSTAGRAM_APP_ID = Deno.env.get("INSTAGRAM_APP_ID");
    const INSTAGRAM_APP_SECRET = Deno.env.get("INSTAGRAM_APP_SECRET");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[instagram-oauth-callback] Missing Supabase credentials");
      return Response.redirect(
        `${APP_URL}/messages?instagram=error&reason=config`,
      );
    }

    if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET) {
      console.error(
        "[instagram-oauth-callback] Missing Instagram app credentials",
      );
      return Response.redirect(
        `${APP_URL}/messages?instagram=error&reason=config`,
      );
    }

    // Parse URL parameters
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorReason = url.searchParams.get("error_reason");
    const errorDescription = url.searchParams.get("error_description");

    // Handle OAuth errors from Meta
    if (error) {
      console.error("[instagram-oauth-callback] Meta OAuth error:", {
        error,
        errorReason,
        errorDescription,
      });
      return Response.redirect(
        `${APP_URL}/messages?instagram=error&reason=${error}`,
      );
    }

    if (!code || !stateParam) {
      console.error("[instagram-oauth-callback] Missing code or state");
      return Response.redirect(
        `${APP_URL}/messages?instagram=error&reason=missing_params`,
      );
    }

    // Parse and verify signed state (HMAC protected)
    const state = await parseSignedState<OAuthState>(stateParam);

    if (!state) {
      console.error(
        "[instagram-oauth-callback] Invalid or tampered state parameter",
      );
      return Response.redirect(
        `${APP_URL}/messages?instagram=error&reason=invalid_state`,
      );
    }

    // Check state timestamp (expire after 10 minutes)
    if (Date.now() - state.timestamp > 10 * 60 * 1000) {
      console.error("[instagram-oauth-callback] State expired");
      return Response.redirect(
        `${APP_URL}/messages?instagram=error&reason=expired`,
      );
    }

    const { imoId, userId, returnUrl } = state;
    // Ensure redirect URL is absolute
    let redirectUrl = returnUrl || `${APP_URL}/messages`;
    if (redirectUrl.startsWith("/")) {
      redirectUrl = `${APP_URL}${redirectUrl}`;
    }

    console.log(
      `[instagram-oauth-callback] Processing OAuth for IMO: ${imoId}, User: ${userId}`,
    );

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // =========================================================================
    // Step 1: Exchange code for short-lived access token (Instagram API)
    // =========================================================================
    const tokenUrl = "https://api.instagram.com/oauth/access_token";
    const tokenRedirectUri = `${APP_URL}/api/instagram-oauth-callback`;

    console.log("[instagram-oauth-callback] Exchanging code for token...");

    // Instagram requires POST with form data
    const tokenFormData = new URLSearchParams();
    tokenFormData.append("client_id", INSTAGRAM_APP_ID);
    tokenFormData.append("client_secret", INSTAGRAM_APP_SECRET);
    tokenFormData.append("grant_type", "authorization_code");
    tokenFormData.append("redirect_uri", tokenRedirectUri);
    tokenFormData.append("code", code);

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenFormData.toString(),
    });
    const tokenData = await tokenResponse.json();

    console.log(
      "[instagram-oauth-callback] Token response:",
      JSON.stringify(tokenData),
    );

    if (tokenData.error_message || !tokenData.access_token) {
      console.error(
        "[instagram-oauth-callback] Token exchange failed:",
        tokenData.error_message || tokenData,
      );
      return Response.redirect(
        `${redirectUrl}?instagram=error&reason=token_exchange`,
      );
    }

    const shortLivedToken = tokenData.access_token;
    const instagramUserId = tokenData.user_id;
    console.log(
      "[instagram-oauth-callback] Short-lived token obtained, user_id:",
      instagramUserId,
    );

    // =========================================================================
    // Step 2: Exchange short-lived token for long-lived token (60 days)
    // =========================================================================
    // CRITICAL: The initial token from api.instagram.com/oauth/access_token is
    // SHORT-LIVED (~1 hour). We MUST exchange it for a long-lived token (60 days)
    // using the ig_exchange_token endpoint. This is required for both:
    // - Instagram Basic Display API (deprecated Dec 2024)
    // - Instagram API with Instagram Login (current)
    //
    // Reference: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
    console.log(
      "[instagram-oauth-callback] Exchanging short-lived token for long-lived token...",
    );

    const exchangeUrl = new URL("https://graph.instagram.com/access_token");
    exchangeUrl.searchParams.set("grant_type", "ig_exchange_token");
    exchangeUrl.searchParams.set("client_secret", INSTAGRAM_APP_SECRET);
    exchangeUrl.searchParams.set("access_token", shortLivedToken);

    const exchangeResponse = await fetch(exchangeUrl.toString(), {
      method: "GET",
    });
    const exchangeData = await exchangeResponse.json();

    console.log(
      "[instagram-oauth-callback] Token exchange response:",
      JSON.stringify({
        ...exchangeData,
        access_token: exchangeData.access_token ? "[REDACTED]" : undefined,
      }),
    );

    let accessToken: string;
    let tokenExpiresAt: Date;

    if (exchangeData.error || !exchangeData.access_token) {
      // Token exchange failed - fall back to short-lived token with correct expiry
      console.warn(
        "[instagram-oauth-callback] Long-lived token exchange failed:",
        exchangeData.error?.message || "No access token in response",
      );
      console.warn(
        "[instagram-oauth-callback] Falling back to short-lived token (1 hour expiry)",
      );
      accessToken = shortLivedToken;
      // Short-lived tokens expire in ~1 hour (3600 seconds)
      const shortLivedExpiry = tokenData.expires_in || 3600;
      tokenExpiresAt = new Date(Date.now() + shortLivedExpiry * 1000);
    } else {
      // Successfully got long-lived token
      accessToken = exchangeData.access_token;
      // Long-lived tokens expire in ~60 days (5184000 seconds)
      const expiresInSeconds = exchangeData.expires_in || 5184000;
      tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);
      console.log(
        `[instagram-oauth-callback] Long-lived token obtained, expires in ${Math.round(expiresInSeconds / 86400)} days (${tokenExpiresAt.toISOString()})`,
      );
    }

    // =========================================================================
    // Step 3: Get Instagram profile details
    // =========================================================================
    // IMPORTANT: Instagram Graph API does NOT have a /me endpoint like Facebook.
    // Must use /{user-id} where user-id comes from the token response.
    //
    // The error "Unsupported request - method type: get" (IGApiException 100) happens when:
    // 1. Using /me endpoint (doesn't exist for Instagram API)
    // 2. Requesting user_id as a FIELD (it's not a valid field - it's only in the URL)
    //
    // CORRECT: Use /{instagramUserId} with fields: id,username,name,account_type
    // The returned 'id' field is the IGSID that matches webhooks and conversations.
    console.log(
      `[instagram-oauth-callback] Fetching Instagram profile for user: ${instagramUserId}`,
    );

    const igProfileUrl = new URL(
      `https://graph.instagram.com/v21.0/${instagramUserId}`,
    );
    igProfileUrl.searchParams.set("access_token", accessToken);
    // CRITICAL: Only request valid fields. DO NOT include:
    // - user_id (not a valid field - causes IGApiException 100)
    // - profile_picture_url (not supported in Business API)
    igProfileUrl.searchParams.set("fields", "id,username,name,account_type");

    const igProfileResponse = await fetch(igProfileUrl.toString());
    const igProfile = await igProfileResponse.json();

    console.log(
      "[instagram-oauth-callback] Profile response:",
      JSON.stringify(igProfile),
    );

    if (!igProfile.username) {
      console.error(
        "[instagram-oauth-callback] Failed to get Instagram profile:",
        igProfile,
      );
      return Response.redirect(
        `${redirectUrl}?instagram=error&reason=profile_fetch`,
      );
    }

    // CRITICAL: Use igProfile.id - this is the IGSID that matches:
    // 1. Webhook entry.id (for routing incoming messages)
    // 2. Conversation participant IDs (for matching self vs other)
    // The token's user_id is a different format and should NOT be stored.
    const instagramBusinessAccountId = igProfile.id;

    if (!instagramBusinessAccountId) {
      console.error(
        "[instagram-oauth-callback] No id in profile response:",
        igProfile,
      );
      return Response.redirect(
        `${redirectUrl}?instagram=error&reason=missing_id`,
      );
    }

    console.log(
      `[instagram-oauth-callback] Instagram profile: @${igProfile.username} (${igProfile.name || "No name"})`,
    );
    console.log(
      `[instagram-oauth-callback] Storing instagram_user_id: ${instagramBusinessAccountId} (IGSID from /${instagramUserId} endpoint)`,
    );

    // =========================================================================
    // Step 4: Encrypt tokens and store in database
    // =========================================================================
    const encryptedAccessToken = await encrypt(accessToken);

    // Check if integration already exists for this user/IMO or Instagram account
    // The unique constraint is on (user_id, imo_id), so check both cases:
    // 1. Same user reconnecting (possibly with different Instagram account)
    // 2. Same Instagram account being reconnected
    const { data: existingByUser } = await supabase
      .from("instagram_integrations")
      .select("id")
      .eq("user_id", userId)
      .eq("imo_id", imoId)
      .maybeSingle();

    // instagram_user_id is GLOBALLY unique (instagram_integrations_ig_user_unique):
    // the IGSID routes inbound webhooks, so one Instagram account maps to exactly one
    // row platform-wide. Look it up WITHOUT an imo filter — otherwise reconnecting an
    // account that was previously connected under a different IMO/user (e.g. a user
    // whose IMO moved FFG -> Epic Life) finds nothing here, falls through to INSERT,
    // and violates the unique constraint -> "save_failed". Matching the constraint
    // makes it UPDATE (reassign) the existing row to the re-authenticating user.
    const { data: existingByInstagram } = await supabase
      .from("instagram_integrations")
      .select("id")
      .eq("instagram_user_id", instagramBusinessAccountId)
      .maybeSingle();

    // Prefer user match (to handle reconnecting with different Instagram account)
    const existingIntegration = existingByUser || existingByInstagram;

    const integrationData = {
      imo_id: imoId,
      user_id: userId,
      instagram_user_id: instagramBusinessAccountId,
      instagram_username: igProfile.username,
      instagram_name: igProfile.name || null,
      instagram_profile_picture_url: null, // Not available in Instagram Business API
      facebook_page_id: null,
      facebook_page_name: null,
      access_token_encrypted: encryptedAccessToken,
      token_expires_at: tokenExpiresAt.toISOString(),
      last_refresh_at: new Date().toISOString(),
      scopes: [
        "instagram_business_basic",
        "instagram_business_manage_messages",
        "instagram_business_manage_comments",
        "instagram_business_content_publish",
      ],
      connection_status: "connected",
      is_active: true,
      last_connected_at: new Date().toISOString(),
      last_error: null,
      last_error_at: null,
    };

    let upsertError;
    if (existingIntegration) {
      // Update existing integration
      console.log(
        `[instagram-oauth-callback] Updating existing integration: ${existingIntegration.id}`,
      );
      const { error } = await supabase
        .from("instagram_integrations")
        .update(integrationData)
        .eq("id", existingIntegration.id);
      upsertError = error;
    } else {
      // Insert new integration
      console.log("[instagram-oauth-callback] Creating new integration");
      const { error } = await supabase
        .from("instagram_integrations")
        .insert(integrationData);
      upsertError = error;
    }

    if (upsertError) {
      console.error(
        "[instagram-oauth-callback] Failed to save integration:",
        upsertError,
      );
      return Response.redirect(
        `${redirectUrl}?instagram=error&reason=save_failed`,
      );
    }

    console.log(
      `[instagram-oauth-callback] Integration saved successfully for @${igProfile.username}`,
    );

    // Redirect back to app with success
    return Response.redirect(
      `${redirectUrl}?instagram=success&account=${encodeURIComponent(igProfile.username)}`,
    );
  } catch (err) {
    console.error("[instagram-oauth-callback] Unexpected error:", err);
    const errorMsg =
      err instanceof Error ? encodeURIComponent(err.message) : "unknown";
    return Response.redirect(
      `${APP_URL}/messages?instagram=error&reason=unexpected&details=${errorMsg}`,
    );
  }
});
