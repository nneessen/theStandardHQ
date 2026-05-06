// supabase/functions/recruit-templates/index.ts
//
// GET /functions/v1/recruit-templates?external_ref=<uuid>&category=<...>&stage=<...>&limit=<...>
//
// Returns Instagram message templates from `instagram_message_templates`,
// filtered by category + stage, scoped to the user identified by
// `external_ref` (the standard-chat-bot agent's commissionTracker user_id).
// System templates (user_id IS NULL) are also returned so newly-onboarded
// recruiters get the seeded library out of the box.
//
// Auth: X-API-Key header, compared against RECRUIT_TEMPLATES_API_KEY secret
// in constant time. NO bearer/JWT auth — this is a service-to-service
// endpoint called by standard-chat-bot, not by users.
//
// DB access: SUPABASE_SERVICE_ROLE_KEY (RLS bypass). The user-scoping is
// enforced by the WHERE clause here, NOT by RLS, because the caller is a
// service, not the user themselves.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import { parseRecruitTemplatesQuery, timingSafeEqual } from "./validation.ts";

const FUNCTION_TAG = "[recruit-templates]";

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method !== "GET") {
    return jsonResponse({ error: "method not allowed" }, 405, corsHeaders);
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  const expectedKey = Deno.env.get("RECRUIT_TEMPLATES_API_KEY");
  if (!expectedKey || expectedKey.length < 32) {
    // Misconfigured server — the secret hasn't been set or is too short to
    // be a real key. 500 here (not 401) so we don't leak the misconfiguration
    // as a successful auth failure.
    console.error(
      `${FUNCTION_TAG} RECRUIT_TEMPLATES_API_KEY not set or too short (must be >= 32 chars)`,
    );
    return jsonResponse({ error: "server misconfigured" }, 500, corsHeaders);
  }

  const providedKey = req.headers.get("x-api-key") ?? "";
  if (!timingSafeEqual(providedKey, expectedKey)) {
    return jsonResponse({ error: "unauthorized" }, 401, corsHeaders);
  }

  // ── Parse + validate query params ────────────────────────────────────────
  const url = new URL(req.url);
  const parsed = parseRecruitTemplatesQuery(url.searchParams);
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, parsed.status, corsHeaders);
  }
  const { externalRef, category, stage, limit } = parsed.value;

  // ── Query templates ──────────────────────────────────────────────────────
  let supabase;
  try {
    supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  } catch (err) {
    console.error(`${FUNCTION_TAG} Failed to create Supabase client:`, err);
    return jsonResponse({ error: "server error" }, 500, corsHeaders);
  }

  let query = supabase
    .from("instagram_message_templates")
    .select("id, content, category, message_stage, use_count, last_used_at")
    .eq("is_active", true)
    .eq("category", category)
    // user-scoped + system templates. PostgREST `.or()` with the IS-NULL
    // predicate is the documented way to express the union here.
    .or(`user_id.eq.${externalRef},user_id.is.null`)
    // Popularity-weighted: most-used templates surface first. The bot
    // injects the top N as voice examples; popularity is a strong signal
    // that the user has validated these templates by repeatedly choosing
    // them in the Instagram outreach UI. Recency tiebreaker.
    .order("use_count", { ascending: false })
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (stage !== null) {
    query = query.eq("message_stage", stage);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`${FUNCTION_TAG} DB query failed:`, error);
    return jsonResponse({ error: "query failed" }, 500, corsHeaders);
  }

  const templates = (data ?? []).map((row) => ({
    id: row.id as string,
    content: row.content as string,
    category: row.category as string,
    stage: row.message_stage as string | null,
    use_count: row.use_count as number,
    last_used_at: row.last_used_at as string | null,
  }));

  console.log(
    `${FUNCTION_TAG} returned ${templates.length} templates for user=${externalRef} category=${category} stage=${stage ?? "*"}`,
  );

  return jsonResponse(
    {
      templates,
      category,
      stage,
      limit,
      count: templates.length,
    },
    200,
    corsHeaders,
  );
});

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
