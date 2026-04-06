// supabase/functions/gmail-oauth-init/index.ts
// Generates a Google OAuth URL for Gmail API authentication
// Required scopes: gmail.send, gmail.readonly, userinfo.email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSignedState } from "../_shared/hmac.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";

interface OAuthInitRequest {
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
    console.log("[gmail-oauth-init] Function invoked");

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    // Use custom domain if set, otherwise fall back to default Supabase URL
    const SUPABASE_URL =
      Deno.env.get("CUSTOM_DOMAIN_URL") || Deno.env.get("SUPABASE_URL");

    if (!GOOGLE_CLIENT_ID) {
      console.error("[gmail-oauth-init] GOOGLE_CLIENT_ID not configured");
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Gmail integration not configured. Contact administrator.",
          needsCredentials: true,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!SUPABASE_URL) {
      console.error("[gmail-oauth-init] Missing SUPABASE_URL");
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body: OAuthInitRequest = await req.json();
    const { userId, returnUrl } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing userId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`[gmail-oauth-init] Initiating OAuth for user ${userId}`);

    // Create signed state (includes userId, timestamp for callback verification)
    const state = {
      userId,
      timestamp: Date.now(),
      returnUrl: returnUrl || null,
    };

    const signedState = await createSignedState(state);

    // Build Google OAuth URL
    // Redirect to our edge function callback
    const redirectUri = `${SUPABASE_URL}/functions/v1/gmail-oauth-callback`;

    // Gmail API scopes
    // gmail.send - Send emails
    // gmail.readonly - Read emails
    // userinfo.email - Get user's email address
    const scopes = [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", signedState);
    // access_type=offline is CRITICAL to get a refresh token
    authUrl.searchParams.set("access_type", "offline");
    // prompt=consent forces consent screen and ensures refresh token is returned
    authUrl.searchParams.set("prompt", "consent");
    // NOTE: include_granted_scopes was REMOVED in April 2026 to pass Google
    // OAuth verification. With incremental authorization enabled, any test
    // account that had previously granted gmail.modify (from earlier dev work
    // before the March 11 removal) would carry that scope forward forever on
    // the consent screen — even though the codebase no longer requests it.
    // Google's reviewer was seeing the leaked scope and rejecting verification.
    // Without this flag, the consent screen shows ONLY the 4 scopes above:
    // gmail.send, gmail.readonly, userinfo.email, userinfo.profile.

    console.log(`[gmail-oauth-init] Generated OAuth URL for user ${userId}`);

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
    console.error("[gmail-oauth-init] Unexpected error:", err);
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
