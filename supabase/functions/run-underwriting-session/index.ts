import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import { createSignedAuthoritativeRunEnvelope } from "../_shared/underwriting/authoritative-envelope.ts";
import { computeAuthoritativeUnderwritingRun } from "../_shared/underwriting/engine.ts";
import { sanitizeUnderwritingPayload } from "../_shared/underwriting/payload.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  const requestId = crypto.randomUUID();
  const jsonHeaders = {
    ...corsHeaders,
    "Content-Type": "application/json",
    "X-Request-Id": requestId,
  };

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
          headers: jsonHeaders,
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
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
          headers: jsonHeaders,
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
          headers: jsonHeaders,
        },
      );
    }

    const payload = sanitizeUnderwritingPayload(await req.json(), {
      allowRunKey: true,
      requireRunKey: true,
      allowSelectedTermYears: true,
    });

    console.info("[run-underwriting-session] started", {
      requestId,
      userId: user.id,
      imoId: profile.imo_id,
      runKey: payload.runKey,
      selectedTermYears: payload.selectedTermYears ?? null,
    });

    const result = await computeAuthoritativeUnderwritingRun({
      client,
      payload,
      imoId: profile.imo_id,
      requestId,
    });

    const authoritativeRunEnvelope = await createSignedAuthoritativeRunEnvelope(
      {
        actorId: user.id,
        requestId,
        input: payload,
        runResult: result,
        secret: supabaseServiceRoleKey,
      },
    );

    console.info("[run-underwriting-session] completed", {
      requestId,
      userId: user.id,
      runKey: payload.runKey,
      recommendationCount: result.decisionResult.recommendations.length,
      eligibleCount: result.decisionResult.eligibleProducts.length,
      unknownCount: result.decisionResult.unknownEligibility.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        requestId,
        decisionResult: result.decisionResult,
        authoritativeRunEnvelope,
        evaluationMetadata: result.evaluationMetadata,
      }),
      {
        status: 200,
        headers: jsonHeaders,
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
        headers: jsonHeaders,
      },
    );
  }
});
