import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import { verifySignedAuthoritativeRunEnvelope } from "../_shared/underwriting/authoritative-envelope.ts";
import { sanitizeUnderwritingPayload } from "../_shared/underwriting/payload.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  const requestId = crypto.randomUUID();
  const jsonHeaders = (responseRequestId = requestId) => ({
    ...corsHeaders,
    "Content-Type": "application/json",
    "X-Request-Id": responseRequestId,
  });

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
          headers: jsonHeaders(),
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
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
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
          headers: jsonHeaders(),
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
          headers: jsonHeaders(),
        },
      );
    }

    const requestBody = await req.json();
    const payload =
      typeof requestBody === "object" && requestBody !== null
        ? (requestBody as Record<string, unknown>)
        : null;

    const rawInputPayload =
      payload === null
        ? requestBody
        : Object.fromEntries(
            Object.entries(payload).filter(
              ([key]) => key !== "authoritativeRunEnvelope",
            ),
          );

    const rawInput = sanitizeUnderwritingPayload(rawInputPayload, {
      allowRunKey: true,
      allowSelectedTermYears: true,
    });
    const verifiedRun = await verifySignedAuthoritativeRunEnvelope({
      envelope: payload?.authoritativeRunEnvelope,
      actorId: user.id,
      saveInput: rawInput,
      secret: supabaseServiceRoleKey,
    });

    console.info("[save-underwriting-session] started", {
      requestId: verifiedRun.requestId,
      userId: user.id,
      runKey: verifiedRun.input.runKey,
    });

    const { data, error } = await adminClient.rpc(
      "persist_underwriting_run_v1",
      {
        p_actor_id: user.id,
        p_input: verifiedRun.input,
        p_result: verifiedRun.result,
        p_audit_rows: verifiedRun.auditRows,
      },
    );

    if (error) {
      console.error("[save-underwriting-session] RPC error", {
        requestId: verifiedRun.requestId,
        userId: user.id,
        code: error.code,
        message: error.message,
      });
      return new Response(
        JSON.stringify({
          success: false,
          code: "save_failed",
          error: "Failed to save underwriting session",
          requestId: verifiedRun.requestId,
        }),
        {
          status: 500,
          headers: jsonHeaders(verifiedRun.requestId),
        },
      );
    }

    const parsed = data as {
      success?: boolean;
      session?: unknown;
      error?: string;
    } | null;

    if (!parsed?.success || !parsed.session) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "save_failed",
          error: parsed?.error || "Failed to save underwriting session",
          requestId: verifiedRun.requestId,
        }),
        {
          status: 500,
          headers: jsonHeaders(verifiedRun.requestId),
        },
      );
    }

    const session = parsed.session as { id?: string } | null;

    console.info("[save-underwriting-session] completed", {
      requestId: verifiedRun.requestId,
      userId: user.id,
      runKey: verifiedRun.input.runKey,
      sessionId: session?.id ?? null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        session: parsed.session,
        requestId: verifiedRun.requestId,
      }),
      {
        status: 200,
        headers: jsonHeaders(verifiedRun.requestId),
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to save underwriting session";
    const isPayloadError =
      message.includes("required") ||
      message.includes("must") ||
      message.includes("Only raw wizard inputs") ||
      message.includes("authoritative underwriting run envelope") ||
      message.includes("Run results are stale");
    const isAccessDenied = message === "Access denied";

    console.error("[save-underwriting-session] failed", {
      requestId,
      error: message,
    });

    return new Response(
      JSON.stringify({
        success: false,
        code: isAccessDenied
          ? "unauthorized"
          : isPayloadError
            ? "invalid_payload"
            : "save_failed",
        error:
          isPayloadError || isAccessDenied
            ? message
            : "Failed to save underwriting session",
        requestId,
      }),
      {
        status: isAccessDenied ? 403 : isPayloadError ? 400 : 500,
        headers: jsonHeaders(),
      },
    );
  }
});
