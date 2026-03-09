import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import { computeAuthoritativeUnderwritingRun } from "../_shared/underwriting/engine.ts";
import { sanitizeUnderwritingPayload } from "../_shared/underwriting/payload.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  const requestId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "unauthorized",
          error: "Missing authorization header",
          requestId,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase environment is not configured");
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "unauthorized",
          error: "Unauthorized",
          requestId,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: profile, error: profileError } = await client
      .from("user_profiles")
      .select("imo_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.imo_id) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "profile_not_configured",
          error: "User profile is not configured for UW Wizard",
          requestId,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const payload = sanitizeUnderwritingPayload(await req.json(), {
      allowRunKey: true,
      requireRunKey: true,
      allowSelectedTermYears: true,
    });

    const result = await computeAuthoritativeUnderwritingRun({
      client,
      payload,
      imoId: profile.imo_id,
      requestId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        requestId,
        decisionResult: result.decisionResult,
        evaluationMetadata: result.evaluationMetadata,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Run failed";
    const isPayloadError =
      message.includes("required") ||
      message.includes("must") ||
      message.includes("Only raw wizard inputs");

    console.error("[run-underwriting-session] failed", {
      requestId,
      error: message,
    });

    return new Response(
      JSON.stringify({
        success: false,
        code: isPayloadError ? "invalid_payload" : "evaluation_failed",
        error: isPayloadError
          ? message
          : "Failed to compute underwriting recommendations",
        requestId,
      }),
      {
        status: isPayloadError ? 400 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
