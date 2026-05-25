// supabase/functions/slack-store-credentials/index.ts
// Encrypts and stores Slack app credentials for agencies

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { encrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import { EPIC_LIFE_IMO_ID } from "../_shared/slack-auth.ts";

interface StoreCredentialsRequest {
  imoId: string;
  agencyId?: string | null;
  clientId: string;
  clientSecret?: string;
  signingSecret?: string;
  appName?: string;
  existingId?: string;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const authHeader = req.headers.get("Authorization");

  console.log("[slack-store-credentials] === FUNCTION START ===");
  console.log("[slack-store-credentials] Method:", req.method);
  console.log("[slack-store-credentials] Origin:", origin);
  console.log("[slack-store-credentials] Auth Header present:", !!authHeader);
  console.log(
    "[slack-store-credentials] Auth Header value:",
    authHeader?.substring(0, 50) + "...",
  );

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[slack-store-credentials] Handling OPTIONS preflight");
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(origin);
  console.log(
    "[slack-store-credentials] CORS headers set for origin:",
    corsHeaders["Access-Control-Allow-Origin"],
  );

  try {
    console.log(
      "[slack-store-credentials] Function invoked, processing request...",
    );

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get auth token from request (authHeader already fetched at top)
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body: StoreCredentialsRequest = await req.json();
    const {
      imoId,
      agencyId,
      clientId,
      clientSecret,
      signingSecret,
      appName,
      existingId,
    } = body;

    if (!imoId || !clientId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing required fields: imoId, clientId",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (imoId === EPIC_LIFE_IMO_ID) {
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "Epic Life is Slack-disabled",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the user from the auth token to verify permissions
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid auth token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify user has permission (is IMO admin or super admin)
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("roles, imo_id")
      .eq("id", user.id)
      .single();

    console.log("[slack-store-credentials] User profile query:", {
      userId: user.id,
      profileError: profileError?.message,
      userProfile: userProfile
        ? { roles: userProfile.roles, imo_id: userProfile.imo_id }
        : null,
      requestedImoId: imoId,
    });

    if (profileError || !userProfile) {
      console.error(
        "[slack-store-credentials] Profile not found:",
        profileError,
      );
      return new Response(
        JSON.stringify({ ok: false, error: "User profile not found" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Handle roles as array - PostgreSQL arrays should come as JS arrays from Supabase
    const roles = Array.isArray(userProfile.roles) ? userProfile.roles : [];
    const isAdmin =
      roles.includes("imo_admin") || roles.includes("super_admin");
    const imoMatch = userProfile.imo_id === imoId;

    console.log("[slack-store-credentials] Permission check:", {
      roles,
      isAdmin,
      userImoId: userProfile.imo_id,
      requestedImoId: imoId,
      imoMatch,
    });

    if (!isAdmin || !imoMatch) {
      const reason = !isAdmin ? "User is not an admin" : "IMO ID mismatch";
      console.error("[slack-store-credentials] Permission denied:", reason);
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Insufficient permissions: ${reason}`,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Encrypt the secrets
    const encryptedClientSecret = clientSecret
      ? await encrypt(clientSecret)
      : undefined;
    const encryptedSigningSecret = signingSecret
      ? await encrypt(signingSecret)
      : undefined;

    // Build the data object
    const credentialData: Record<string, unknown> = {
      imo_id: imoId,
      agency_id: agencyId || null,
      client_id: clientId,
      app_name: appName || null,
      updated_at: new Date().toISOString(),
    };

    // Only include secrets if provided
    if (encryptedClientSecret) {
      credentialData.client_secret_encrypted = encryptedClientSecret;
    }
    if (encryptedSigningSecret) {
      credentialData.signing_secret_encrypted = encryptedSigningSecret;
    }

    let result;

    if (existingId) {
      // Update existing record
      const { data, error } = await supabase
        .from("agency_slack_credentials")
        .update(credentialData)
        .eq("id", existingId)
        .eq("imo_id", imoId) // Extra security check
        .select("id")
        .single();

      if (error) {
        console.error("[slack-store-credentials] Update error:", error);
        return new Response(
          JSON.stringify({ ok: false, error: error.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      result = data;
      console.log(
        `[slack-store-credentials] Updated credentials ${existingId}`,
      );
    } else {
      // Insert new record
      credentialData.created_by = user.id;
      credentialData.created_at = new Date().toISOString();

      // Check if credentials already exist for this agency
      const existingQuery = supabase
        .from("agency_slack_credentials")
        .select("id")
        .eq("imo_id", imoId);

      if (agencyId) {
        existingQuery.eq("agency_id", agencyId);
      } else {
        existingQuery.is("agency_id", null);
      }

      const { data: existing } = await existingQuery.maybeSingle();

      if (existing) {
        // Update instead of insert
        const { data, error } = await supabase
          .from("agency_slack_credentials")
          .update(credentialData)
          .eq("id", existing.id)
          .select("id")
          .single();

        if (error) {
          console.error("[slack-store-credentials] Upsert error:", error);
          return new Response(
            JSON.stringify({ ok: false, error: error.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        result = data;
        console.log(
          `[slack-store-credentials] Updated existing credentials ${existing.id}`,
        );
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("agency_slack_credentials")
          .insert(credentialData)
          .select("id")
          .single();

        if (error) {
          console.error("[slack-store-credentials] Insert error:", error);
          return new Response(
            JSON.stringify({ ok: false, error: error.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        result = data;
        console.log(
          `[slack-store-credentials] Created new credentials ${result.id}`,
        );
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        id: result.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[slack-store-credentials] Unexpected error:", err);
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
