// supabase/functions/chat-bot-api/index.ts
// User-facing edge function — proxies chat bot management actions to standard-chat-bot external API.
// Auth: Bearer token (user JWT) → resolves user_id → looks up chat_bot_agents → proxies request.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import {
  assertNoVoiceActionParams,
  parseAddRetellVoiceParams,
  parseCreateVoiceAgentParams,
  parseRetellAgentUpdateParams,
  parseRetellConnectionParams,
  parseRetellLlmUpdateParams,
  parseRetellSearchParams,
  parseUpdateConfigParams,
} from "../../../src/features/voice-agent/lib/voice-agent-contract.ts";
import { createStandardChatBotVoiceClient } from "../_shared/standard-chat-bot-voice.ts";
import { decrypt } from "../_shared/encryption.ts";
import {
  DEFAULT_VOICE_FEATURES,
  getUtcCalendarMonthCycle,
  getVoiceTierConfig,
} from "../../../src/services/subscription/voice-sync.ts";

const PREMIUM_VOICE_ADDON_NAME = "premium_voice";
const VOICE_TRIAL_INCLUDED_MINUTES = 15;
const VOICE_TRIAL_HARD_LIMIT_MINUTES = 15;
const VOICE_TRIAL_PLAN_CODE = "voice_trial";

const ALLOWED_ORIGINS = [
  "https://app.thestandardhq.com",
  "https://www.thestandardhq.com",
  "https://thestandardhq.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3004",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3004",
];

function buildCorsHeaders(req?: Request) {
  const isLocal =
    Deno.env.get("ENVIRONMENT") === "local" ||
    Deno.env.get("SUPABASE_URL")?.includes("127.0.0.1") ||
    Deno.env.get("SUPABASE_URL")?.includes("localhost");
  let origin = "*";
  if (!isLocal && req) {
    const reqOrigin = req.headers.get("origin") ?? "";
    origin = ALLOWED_ORIGINS.includes(reqOrigin)
      ? reqOrigin
      : ALLOWED_ORIGINS[0];
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

// Default headers for non-request-scoped responses
const corsHeaders = buildCorsHeaders();

// deno-lint-ignore no-explicit-any
function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validateReturnUrl(value: unknown): string {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    // Allow production origins and localhost for dev
    if (
      ALLOWED_ORIGINS.some((o) => trimmed.startsWith(o)) ||
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1"
    ) {
      return trimmed;
    }
    return "";
  } catch {
    return "";
  }
}

// Helper to call standard-chat-bot external API
async function callChatBotApi(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  // deno-lint-ignore no-explicit-any
): Promise<{ ok: boolean; status: number; data: any }> {
  const CHAT_BOT_API_URL =
    Deno.env.get("STANDARD_CHAT_BOT_API_URL") ||
    Deno.env.get("CHAT_BOT_API_URL");
  const CHAT_BOT_API_KEY =
    Deno.env.get("STANDARD_CHAT_BOT_EXTERNAL_API_KEY") ||
    Deno.env.get("CHAT_BOT_API_KEY");

  if (!CHAT_BOT_API_URL || !CHAT_BOT_API_KEY) {
    throw new Error("CHAT_BOT_API_URL or CHAT_BOT_API_KEY not configured");
  }

  const url = `${CHAT_BOT_API_URL}${path}`;
  const hasBody = method !== "GET" && method !== "DELETE";
  const headers: Record<string, string> = {
    "X-API-Key": CHAT_BOT_API_KEY,
  };
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const options: RequestInit = { method, headers, signal: controller.signal };
  if (hasBody) {
    options.body = JSON.stringify(body || {});
  }

  try {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

// Helper to forward multipart form data to standard-chat-bot (for audio uploads)
async function callChatBotApiMultipart(
  path: string,
  formData: FormData,
  timeoutMs = 60_000,
  // deno-lint-ignore no-explicit-any
): Promise<{ ok: boolean; status: number; data: any }> {
  const CHAT_BOT_API_URL =
    Deno.env.get("STANDARD_CHAT_BOT_API_URL") ||
    Deno.env.get("CHAT_BOT_API_URL");
  const CHAT_BOT_API_KEY =
    Deno.env.get("STANDARD_CHAT_BOT_EXTERNAL_API_KEY") ||
    Deno.env.get("CHAT_BOT_API_KEY");

  if (!CHAT_BOT_API_URL || !CHAT_BOT_API_KEY) {
    throw new Error("CHAT_BOT_API_URL or CHAT_BOT_API_KEY not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${CHAT_BOT_API_URL}${path}`, {
      method: "POST",
      headers: { "X-API-Key": CHAT_BOT_API_KEY },
      body: formData,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function upsertRetellConnection(
  agentId: string,
  params: Record<string, unknown>,
) {
  const existing = await callChatBotApi(
    "GET",
    `/api/external/agents/${agentId}/connections/retell`,
  );

  if (existing.ok) {
    return await callChatBotApi(
      "PATCH",
      `/api/external/agents/${agentId}/connections/retell`,
      params,
    );
  }

  if (existing.status !== 404) {
    return existing;
  }

  return await callChatBotApi(
    "POST",
    `/api/external/agents/${agentId}/connections/retell`,
    params,
  );
}

function extractExternalAgentId(data: unknown): string | null {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const nestedData = record.data;
    if (nestedData && typeof nestedData === "object") {
      const nestedId = (nestedData as Record<string, unknown>).agentId;
      if (typeof nestedId === "string" && nestedId.trim()) {
        return nestedId.trim();
      }
    }

    const directId = record.agentId;
    if (typeof directId === "string" && directId.trim()) {
      return directId.trim();
    }
  }

  return null;
}

function buildManagedWorkspaceName(
  profile: {
    first_name: string | null;
    last_name: string | null;
  } | null,
): string {
  const displayName =
    `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();

  return displayName || "The Standard HQ Workspace";
}

async function getUserProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("first_name, last_name, is_super_admin")
    .eq("id", userId)
    .maybeSingle();

  return profile;
}

function extractErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const error = record.error;
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  const message = record.message;
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  return null;
}

function isVoiceCreateRouteUnavailable(res: {
  status: number;
  data: unknown;
}): boolean {
  if (res.status !== 404) {
    return false;
  }

  const message = extractErrorMessage(res.data)?.toLowerCase();
  if (!message) {
    return true;
  }

  return (
    message === "not found" ||
    message.includes("function not found") ||
    message.includes("route") ||
    message.includes("cannot post")
  );
}

async function ensureAgentContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  allowAutoProvision: boolean,
) {
  const { data: existingAgent } = await supabase
    .from("chat_bot_agents")
    .select(
      "id, external_agent_id, provisioning_status, billing_exempt, tier_id",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (
    existingAgent?.provisioning_status === "active" &&
    typeof existingAgent.external_agent_id === "string" &&
    existingAgent.external_agent_id.trim()
  ) {
    return {
      ok: true as const,
      agentId: existingAgent.external_agent_id.trim(),
      localBillingExempt: existingAgent.billing_exempt === true,
    };
  }

  if (!allowAutoProvision) {
    return {
      ok: false as const,
      status: 404,
      error: "No active chat bot found",
    };
  }

  const profile = await getUserProfile(supabase, userId);
  const { isOnExemptTeam } = await getTeamAccessStatus(supabase, userId);
  const billingExempt =
    existingAgent?.billing_exempt === true || isOnExemptTeam;
  const provisionRes = await callChatBotApi("POST", "/api/external/agents", {
    externalRef: userId,
    name: buildManagedWorkspaceName(profile),
    billingExempt,
    ...(billingExempt ? {} : { leadLimit: 5 }),
  });

  if (!provisionRes.ok) {
    console.error(
      `[chat-bot-api] ensureAgentContext provision failed for user ${userId}:`,
      `status=${provisionRes.status}`,
      JSON.stringify(provisionRes.data),
    );
    return {
      ok: false as const,
      status: safeStatus(provisionRes.status),
      error:
        typeof provisionRes.data?.error === "string"
          ? provisionRes.data.error
          : typeof provisionRes.data?.message === "string"
            ? provisionRes.data.message
            : `Failed to provision workspace (upstream ${provisionRes.status})`,
      details: provisionRes.data,
    };
  }

  const newAgentId = extractExternalAgentId(provisionRes.data);
  if (!newAgentId) {
    return {
      ok: false as const,
      status: 400,
      error: "Provisioning did not return an external agent ID",
    };
  }

  const { error: upsertError } = await supabase.from("chat_bot_agents").upsert(
    {
      user_id: userId,
      external_agent_id: newAgentId,
      provisioning_status: "active",
      billing_exempt: billingExempt,
      tier_id: existingAgent?.tier_id ?? null,
      error_message: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (upsertError) {
    console.error(
      `[chat-bot-api] Failed to persist workspace context for user ${userId}:`,
      upsertError,
    );
    return {
      ok: false as const,
      status: 400,
      error: "Failed to persist workspace context",
    };
  }

  return {
    ok: true as const,
    agentId: newAgentId,
    localBillingExempt: billingExempt,
  };
}

// Never return 5xx from edge function — Supabase runtime treats it as a crash (502 Bad Gateway).
function safeStatus(status: number): number {
  return status >= 500 ? 400 : status;
}

// Normalize a rate value to 0-1 decimal range.
// External API may return either 0-1 decimals or 0-100 percentages.
function normalizeRate(val: unknown): number {
  if (typeof val !== "number" || isNaN(val)) return 0;
  return val > 1 ? val / 100 : val;
}

// deno-lint-ignore no-explicit-any
function normalizeAnalyticsPayload(payload: any): any {
  if (!payload || typeof payload !== "object") return payload;

  if (payload.appointments) {
    payload.appointments.bookingRate = normalizeRate(
      payload.appointments.bookingRate,
    );
    payload.appointments.showRate = normalizeRate(
      payload.appointments.showRate,
    );
    payload.appointments.cancelRate = normalizeRate(
      payload.appointments.cancelRate,
    );
  }
  if (payload.conversations) {
    payload.conversations.suppressionRate = normalizeRate(
      payload.conversations.suppressionRate,
    );
    payload.conversations.staleRate = normalizeRate(
      payload.conversations.staleRate,
    );
  }
  if (payload.engagement) {
    payload.engagement.responseRate = normalizeRate(
      payload.engagement.responseRate,
    );
    payload.engagement.multiTurnRate = normalizeRate(
      payload.engagement.multiTurnRate,
    );
    payload.engagement.hardNoRate = normalizeRate(
      payload.engagement.hardNoRate,
    );
  }
  if (payload.messagePerformance) {
    payload.messagePerformance.positiveRate = normalizeRate(
      payload.messagePerformance.positiveRate,
    );
    payload.messagePerformance.negativeRate = normalizeRate(
      payload.messagePerformance.negativeRate,
    );
    payload.messagePerformance.schedulingRate = normalizeRate(
      payload.messagePerformance.schedulingRate,
    );
    payload.messagePerformance.optOutRate = normalizeRate(
      payload.messagePerformance.optOutRate,
    );
    payload.messagePerformance.resolvedOutcomeRate = normalizeRate(
      payload.messagePerformance.resolvedOutcomeRate,
    );
    if (Array.isArray(payload.messagePerformance.topReplyCategories)) {
      for (const cat of payload.messagePerformance.topReplyCategories) {
        cat.positiveRate = normalizeRate(cat.positiveRate);
        cat.negativeRate = normalizeRate(cat.negativeRate);
        cat.schedulingRate = normalizeRate(cat.schedulingRate);
        cat.optOutRate = normalizeRate(cat.optOutRate);
      }
    }
  }
  return payload;
}

// Unwrap apiSuccess envelope: { success: true, data: <payload>, meta?: {...} } → <payload>
// deno-lint-ignore no-explicit-any
function unwrap(res: { ok: boolean; status: number; data: any }): {
  // deno-lint-ignore no-explicit-any
  payload: any;
  // deno-lint-ignore no-explicit-any
  meta: any;
  status: number;
  errorMessage: string | null;
  serviceDown: boolean;
} {
  if (!res.ok || res.data?.success === false) {
    const errObj = res.data?.error;
    const msg =
      typeof errObj === "string"
        ? errObj
        : errObj?.message || "Unknown API error";
    const isServiceDown = res.status >= 500;
    return {
      payload: null,
      meta: null,
      status: safeStatus(res.status),
      errorMessage: isServiceDown ? "Bot service temporarily unavailable" : msg,
      serviceDown: isServiceDown,
    };
  }
  return {
    payload: res.data && "data" in res.data ? res.data.data : res.data,
    meta: res.data?.meta ?? null,
    status: safeStatus(res.status),
    errorMessage: null,
    serviceDown: false,
  };
}

// deno-lint-ignore no-explicit-any
function sendResult(res: { ok: boolean; status: number; data: any }): Response {
  const { payload, status, errorMessage } = unwrap(res);
  if (errorMessage) {
    return jsonResponse({ error: errorMessage }, status);
  }
  return jsonResponse(payload, status);
}

function getWebAppUrl(): string | null {
  const explicit = Deno.env.get("STANDARD_CHAT_BOT_WEB_APP_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  const apiUrl =
    Deno.env.get("STANDARD_CHAT_BOT_API_URL") ||
    Deno.env.get("CHAT_BOT_API_URL");
  if (apiUrl) {
    try {
      const url = new URL(apiUrl);
      if (url.hostname.startsWith("api-")) {
        url.hostname = url.hostname.replace(/^api-/, "app-");
        return url.origin;
      }
      if (url.hostname.startsWith("api.")) {
        url.hostname = url.hostname.replace(/^api\./, "app.");
        return url.origin;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function sendConnectionStatusResult(
  res: { ok: boolean; status: number; data: any },
  mapPayload: (payload: any) => Record<string, unknown>,
): Response {
  if (res.status === 404) {
    return jsonResponse({ connected: false });
  }

  const { payload, status, errorMessage, serviceDown } = unwrap(res);
  if (errorMessage) {
    return jsonResponse(
      {
        error: errorMessage,
        serviceDown,
      },
      status,
    );
  }

  return jsonResponse(mapPayload(payload), status);
}

async function getTeamAccessStatus(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{
  profile: {
    first_name: string | null;
    last_name: string | null;
    hierarchy_path: string | null;
    is_super_admin: boolean | null;
  } | null;
  isOnExemptTeam: boolean;
}> {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("first_name, last_name, hierarchy_path, is_super_admin")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return { profile: null, isOnExemptTeam: false };
  }

  if (profile.is_super_admin === true) {
    return { profile, isOnExemptTeam: true };
  }

  // Check for explicit team access override (e.g. upline users)
  const { data: override } = await supabase
    .from("chat_bot_team_overrides")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (override) {
    return { profile, isOnExemptTeam: true };
  }

  const hierarchyPath = profile.hierarchy_path || userId;
  const uplineIds = hierarchyPath.split(".").slice(0, -1);

  if (uplineIds.length === 0) {
    return { profile, isOnExemptTeam: false };
  }

  const { data: exemptUplines } = await supabase
    .from("chat_bot_agents")
    .select("user_id")
    .in("user_id", uplineIds)
    .eq("billing_exempt", true)
    .eq("provisioning_status", "active")
    .limit(1);

  return {
    profile,
    isOnExemptTeam: (exemptUplines?.length ?? 0) > 0,
  };
}

serve(async (req) => {
  const reqCorsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: reqCorsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...reqCorsHeaders, "Content-Type": "application/json" },
    });
  }

  // deno-lint-ignore no-explicit-any
  let incomingFormData: FormData | null = null;

  try {
    // Parse body: detect multipart (audio uploads) vs JSON (everything else)
    const contentType = req.headers.get("content-type") || "";
    // deno-lint-ignore no-explicit-any
    let action: string;
    // deno-lint-ignore no-explicit-any
    let params: Record<string, any>;

    if (contentType.includes("multipart/form-data")) {
      incomingFormData = await req.formData();
      action = (incomingFormData.get("action") as string) || "";
      params = {};
      for (const [key, value] of incomingFormData.entries()) {
        if (key !== "action" && key !== "file" && typeof value === "string") {
          params[key] = value;
        }
      }
    } else {
      const body = await req.json().catch(() => ({}));
      ({ action, ...params } = body);
    }

    // ──────────────────────────────────────────────
    // Two-client pattern: auth client validates JWTs against the local/native
    // Supabase instance. Data client queries the production DB for real data
    // even in local dev (when REMOTE_SUPABASE_URL is set).
    // In production, both point to the same instance.
    // ──────────────────────────────────────────────
    const LOCAL_SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const LOCAL_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;

    const REMOTE_URL = Deno.env.get("REMOTE_SUPABASE_URL");
    const REMOTE_KEY = Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY");

    // Auth client — always uses the native Supabase (validates local JWTs)
    const authClient = createClient(
      LOCAL_SUPABASE_URL,
      LOCAL_SUPABASE_SERVICE_ROLE_KEY,
    );

    // Data client — uses production when available, otherwise same as auth
    const supabase =
      REMOTE_URL && REMOTE_KEY
        ? createClient(REMOTE_URL, REMOTE_KEY)
        : authClient;

    // Authenticate user via JWT (deploy WITHOUT --no-verify-jwt so the full token passes through)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s*/i, "").trim();
    if (!token) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // ──────────────────────────────────────────────
    // Super-admin "act on behalf of" support
    // ──────────────────────────────────────────────
    let effectiveUserId = user.id;
    let isSuperAdminCaller = false;

    if (params.targetUserId && typeof params.targetUserId === "string") {
      const callerProfile = await getUserProfile(supabase, user.id);
      if (!callerProfile?.is_super_admin) {
        return jsonResponse(
          { error: "Only super-admins can act on behalf of other users" },
          403,
        );
      }
      isSuperAdminCaller = true;
      effectiveUserId = params.targetUserId;
    }

    // ──────────────────────────────────────────────
    // ADMIN ACTIONS — super-admin only
    // ──────────────────────────────────────────────
    if (action === "admin_list_agents") {
      if (!isSuperAdminCaller) {
        const callerProfile = await getUserProfile(supabase, user.id);
        if (!callerProfile?.is_super_admin) {
          return jsonResponse({ error: "Forbidden" }, 403);
        }
      }

      // 1. Fetch provisioned agents
      const { data: agents, error: agentsErr } = await supabase
        .from("chat_bot_agents")
        .select(
          "id, user_id, external_agent_id, provisioning_status, billing_exempt, tier_id, error_message, created_at, updated_at",
        )
        .order("created_at", { ascending: false });

      if (agentsErr) {
        return jsonResponse({ error: agentsErr.message }, 400);
      }

      // 2. Also fetch users with chat bot addon (may not have agent row yet)
      const { data: addonUsers } = await supabase
        .from("user_subscription_addons")
        .select("user_id, status, tier_id, subscription_addons!inner(name)")
        .eq("subscription_addons.name", "ai_chat_bot");

      // 3. Fetch team overrides
      const { data: overrides } = await supabase
        .from("chat_bot_team_overrides")
        .select("id, user_id, granted_by, reason, created_at");

      // 4. Build set of all relevant user IDs
      const agentUserIds = new Set((agents || []).map((a) => a.user_id));
      const allUserIds = new Set(agentUserIds);
      for (const au of addonUsers || []) {
        allUserIds.add(au.user_id);
      }
      for (const o of overrides || []) {
        allUserIds.add(o.user_id);
      }

      // 5. Batch-fetch user profiles for all relevant users
      const userIdArray = Array.from(allUserIds);
      const { data: profiles } =
        userIdArray.length > 0
          ? await supabase
              .from("user_profiles")
              .select("id, first_name, last_name, email")
              .in("id", userIdArray)
          : { data: [] };

      const profileMap: Record<
        string,
        { first_name: string | null; last_name: string | null; email: string }
      > = {};
      for (const p of profiles || []) {
        profileMap[p.id] = p;
      }

      // 6. Enrich existing agents
      const enrichedAgents = (agents || []).map((a) => {
        const profile = profileMap[a.user_id];
        return {
          ...a,
          userName: profile
            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
              null
            : null,
          userEmail: profile?.email || null,
        };
      });

      // 7. Add "virtual" rows for users with addon but no agent row
      for (const au of addonUsers || []) {
        if (!agentUserIds.has(au.user_id)) {
          const profile = profileMap[au.user_id];
          enrichedAgents.push({
            id: `addon_${au.user_id}`,
            user_id: au.user_id,
            external_agent_id: "",
            provisioning_status:
              au.status === "active" ? "not_provisioned" : au.status,
            billing_exempt: false,
            tier_id: au.tier_id || null,
            error_message: null,
            created_at: null,
            updated_at: null,
            userName: profile
              ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
                null
              : null,
            userEmail: profile?.email || null,
          });
        }
      }

      // 8. Add "virtual" rows for users with team override but no agent/addon
      const enrichedUserIds = new Set(enrichedAgents.map((a) => a.user_id));
      for (const o of overrides || []) {
        if (!enrichedUserIds.has(o.user_id)) {
          const profile = profileMap[o.user_id];
          enrichedAgents.push({
            id: `override_${o.user_id}`,
            user_id: o.user_id,
            external_agent_id: "",
            provisioning_status: "override_only",
            billing_exempt: false,
            tier_id: null,
            error_message: null,
            created_at: o.created_at,
            updated_at: null,
            userName: profile
              ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
                null
              : null,
            userEmail: profile?.email || null,
          });
        }
      }

      return jsonResponse({
        agents: enrichedAgents,
        teamOverrides: overrides || [],
      });
    }

    if (action === "admin_grant_team_access") {
      if (!isSuperAdminCaller) {
        const callerProfile = await getUserProfile(supabase, user.id);
        if (!callerProfile?.is_super_admin) {
          return jsonResponse({ error: "Forbidden" }, 403);
        }
      }

      const { userId: targetId, reason } = params;
      if (!targetId || typeof targetId !== "string") {
        return jsonResponse({ error: "userId is required" }, 400);
      }

      const { error: upsertErr } = await supabase
        .from("chat_bot_team_overrides")
        .upsert(
          {
            user_id: targetId,
            granted_by: user.id,
            reason: typeof reason === "string" ? reason : null,
          },
          { onConflict: "user_id" },
        );

      if (upsertErr) {
        return jsonResponse({ error: upsertErr.message }, 400);
      }
      return jsonResponse({ success: true });
    }

    if (action === "admin_revoke_team_access") {
      if (!isSuperAdminCaller) {
        const callerProfile = await getUserProfile(supabase, user.id);
        if (!callerProfile?.is_super_admin) {
          return jsonResponse({ error: "Forbidden" }, 403);
        }
      }

      const { userId: targetId } = params;
      if (!targetId || typeof targetId !== "string") {
        return jsonResponse({ error: "userId is required" }, 400);
      }

      const { error: delErr } = await supabase
        .from("chat_bot_team_overrides")
        .delete()
        .eq("user_id", targetId);

      if (delErr) {
        return jsonResponse({ error: delErr.message }, 400);
      }
      return jsonResponse({ success: true });
    }

    if (action === "get_team_access") {
      const { isOnExemptTeam } = await getTeamAccessStatus(
        supabase,
        effectiveUserId,
      );
      return jsonResponse({ hasTeamAccess: isOnExemptTeam });
    }

    if (
      action === "save_retell_connection" ||
      action === "disconnect_retell_connection"
    ) {
      const profile = await getUserProfile(supabase, user.id);
      if (!profile?.is_super_admin) {
        return jsonResponse(
          {
            error: "Only super-admins can manage the manual voice runtime link",
          },
          403,
        );
      }
    }

    // ──────────────────────────────────────────────
    // TEAM PROVISION — must run BEFORE agent lookup (no agent row exists yet)
    // ──────────────────────────────────────────────
    if (action === "team_provision") {
      const { profile, isOnExemptTeam } = await getTeamAccessStatus(
        supabase,
        effectiveUserId,
      );
      if (!profile) {
        return jsonResponse({ error: "User profile not found" }, 404);
      }

      if (!isOnExemptTeam) {
        return jsonResponse(
          {
            error:
              "Free bot access requires your team leader to have an active billing-exempt bot",
          },
          403,
        );
      }

      // 2. Idempotency check
      const { data: existing } = await supabase
        .from("chat_bot_agents")
        .select("id, external_agent_id, provisioning_status, billing_exempt")
        .eq("user_id", effectiveUserId)
        .maybeSingle();

      if (existing?.provisioning_status === "active") {
        const upgradeRes = await callChatBotApi(
          "PATCH",
          `/api/external/agents/${existing.external_agent_id}`,
          { billingExempt: true },
        );

        if (!upgradeRes.ok) {
          console.error(
            `[chat-bot-api] Failed to sync billing-exempt access for agent ${existing.external_agent_id} and user ${effectiveUserId}:`,
            upgradeRes.data,
          );
          return jsonResponse(
            {
              error: "Failed to enable team access for existing bot",
              details: upgradeRes.data,
            },
            safeStatus(upgradeRes.status),
          );
        }

        await supabase
          .from("chat_bot_agents")
          .update({
            billing_exempt: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        return jsonResponse({
          success: true,
          agentId: existing.external_agent_id,
          alreadyProvisioned: true,
          upgradedToTeamAccess: existing.billing_exempt !== true,
        });
      }

      // 3. Build agent name
      const agentName = profile
        ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
          "Chat Bot Agent"
        : "Chat Bot Agent";

      // 4. Provision on external API with billing exemption
      const provisionRes = await callChatBotApi(
        "POST",
        "/api/external/agents",
        { externalRef: effectiveUserId, name: agentName, billingExempt: true },
      );

      if (!provisionRes.ok) {
        console.error(
          `[chat-bot-api] team_provision failed for user ${effectiveUserId}:`,
          provisionRes.data,
        );
        await supabase.from("chat_bot_agents").upsert(
          {
            user_id: effectiveUserId,
            external_agent_id: "",
            provisioning_status: "failed",
            billing_exempt: true,
            tier_id: null,
            error_message: JSON.stringify(provisionRes.data),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        return jsonResponse(
          { error: "Failed to provision team bot", details: provisionRes.data },
          safeStatus(provisionRes.status),
        );
      }

      const newAgentId =
        (provisionRes.data.data as Record<string, unknown>)?.agentId ||
        provisionRes.data.agentId;

      // 5. Upsert local record
      await supabase.from("chat_bot_agents").upsert(
        {
          user_id: effectiveUserId,
          external_agent_id: String(newAgentId),
          provisioning_status: "active",
          billing_exempt: true,
          tier_id: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      console.log(
        `[chat-bot-api] Team-provisioned agent ${newAgentId} for user ${effectiveUserId}`,
      );
      return jsonResponse({ success: true, agentId: newAgentId });
    }

    // ──────────────────────────────────────────────
    // START VOICE TRIAL — runs BEFORE agent lookup
    // Voice-only users may not have a chat_bot_agents row yet.
    // Steps 1-4 (addon activation) need no agent. Step 5 (entitlement
    // sync) uses the agent if one exists, skips otherwise.
    // ──────────────────────────────────────────────
    if (action === "start_voice_trial") {
      assertNoVoiceActionParams(params, "Start voice trial request");

      // 1. Look up premium_voice addon SKU
      const { data: voiceAddonSku } = await supabase
        .from("subscription_addons")
        .select("id, tier_config")
        .eq("name", PREMIUM_VOICE_ADDON_NAME)
        .maybeSingle();

      if (!voiceAddonSku?.id) {
        return jsonResponse({ error: "Voice addon is not available." }, 404);
      }

      // 2. Resolve tier for defaults
      const tier = getVoiceTierConfig(voiceAddonSku.tier_config);
      const now = new Date();
      const cycle = getUtcCalendarMonthCycle(now);
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30);

      // 3. Atomic upsert — INSERT with ON CONFLICT to prevent TOCTOU race.
      // If two concurrent requests both pass the entitlement check, the UNIQUE
      // constraint on (user_id, addon_id) ensures only one row is created.
      const { data: insertedAddon, error: insertError } = await supabase
        .from("user_subscription_addons")
        .upsert(
          {
            user_id: effectiveUserId,
            addon_id: voiceAddonSku.id,
            status: "active",
            tier_id: tier?.id ?? "voice_pro",
            billing_interval: "monthly",
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            voice_sync_status: "pending",
          },
          { onConflict: "user_id,addon_id", ignoreDuplicates: true },
        )
        .select("id")
        .maybeSingle();

      // If upsert returned no row, it means the addon already existed (conflict ignored)
      if (!insertedAddon && !insertError) {
        return jsonResponse(
          {
            error: "Voice is already activated for this workspace.",
            success: true,
            trial: true,
          },
          200,
        );
      }

      if (insertError) {
        console.error(
          `[chat-bot-api] Failed to insert voice trial addon for user ${effectiveUserId}:`,
          insertError,
        );
        return jsonResponse({ error: "Failed to activate voice trial." }, 500);
      }

      // 5. Sync trial entitlement — optional, only if agent exists
      const trialAgentContext = await ensureAgentContext(
        supabase,
        effectiveUserId,
        false,
      );

      if (trialAgentContext.ok) {
        try {
          const voiceClient = createStandardChatBotVoiceClient();
          const idempotencyKey = `trial_${effectiveUserId}_${Date.now()}`;
          const syncResult = await voiceClient.upsertVoiceEntitlement(
            trialAgentContext.agentId,
            {
              status: "trialing",
              planCode: VOICE_TRIAL_PLAN_CODE,
              includedMinutes: VOICE_TRIAL_INCLUDED_MINUTES,
              hardLimitMinutes: VOICE_TRIAL_HARD_LIMIT_MINUTES,
              allowOverage: false,
              overageRateCents: null,
              cycleStartAt: cycle.cycleStartAt,
              cycleEndAt: cycle.cycleEndAt,
              effectiveAt: now.toISOString(),
              features: {
                ...DEFAULT_VOICE_FEATURES,
                ...(tier?.features ?? {}),
              },
              metadata: {
                source: "commissionTracker",
                activationType: "trial",
                tierId: tier?.id ?? "voice_pro",
              },
            },
            idempotencyKey,
          );

          if (syncResult.ok) {
            await supabase
              .from("user_subscription_addons")
              .update({
                voice_sync_status: "synced",
                voice_last_synced_at: now.toISOString(),
                voice_last_sync_attempt_at: now.toISOString(),
                voice_entitlement_snapshot: syncResult.data ?? null,
                voice_last_sync_error: null,
                voice_last_sync_http_status: syncResult.status,
              })
              .eq("id", insertedAddon.id);
          } else {
            console.error(
              `[chat-bot-api] Voice trial sync failed for user ${effectiveUserId}:`,
              syncResult.error,
            );
            await supabase
              .from("user_subscription_addons")
              .update({
                voice_sync_status: "degraded",
                voice_last_sync_attempt_at: now.toISOString(),
                voice_last_sync_error:
                  syncResult.error ?? "Voice entitlement sync failed",
                voice_last_sync_http_status: syncResult.status,
              })
              .eq("id", insertedAddon.id);
          }
        } catch (syncError) {
          console.error(
            `[chat-bot-api] Voice trial sync threw for user ${effectiveUserId}:`,
            syncError,
          );
          await supabase
            .from("user_subscription_addons")
            .update({
              voice_sync_status: "degraded",
              voice_last_sync_attempt_at: now.toISOString(),
              voice_last_sync_error: "Voice entitlement sync failed",
            })
            .eq("id", insertedAddon.id);
        }
      } else {
        // No agent yet — sync will happen when agent is created
        console.log(
          `[chat-bot-api] Voice trial activated for user ${effectiveUserId} without agent sync (no chat bot agent exists yet)`,
        );
      }

      return jsonResponse({ success: true, trial: true });
    }

    // ──────────────────────────────────────────────
    // GET VOICE SETUP STATE — runs BEFORE agent lookup
    // Voice-only users may not have a chat_bot_agents row yet.
    // Returns a "not provisioned" state when no agent exists.
    // ──────────────────────────────────────────────
    if (action === "get_voice_setup_state") {
      assertNoVoiceActionParams(params, "Get voice setup state request");

      const setupAgentContext = await ensureAgentContext(
        supabase,
        effectiveUserId,
        false,
      );

      if (!setupAgentContext.ok) {
        // No agent — return a minimal setup state indicating voice is not provisioned
        // Check if voice addon exists to determine entitlement status
        const { data: voiceAddon } = await supabase
          .from("user_subscription_addons")
          .select("id, status")
          .eq("user_id", effectiveUserId)
          .eq(
            "addon_id",
            (
              await supabase
                .from("subscription_addons")
                .select("id")
                .eq("name", PREMIUM_VOICE_ADDON_NAME)
                .maybeSingle()
            ).data?.id ?? "",
          )
          .maybeSingle();

        return jsonResponse({
          nextAction: {
            key: voiceAddon ? "connect_close" : "activate_trial",
            label: voiceAddon
              ? "Connect Close CRM"
              : "Activate your voice trial",
            description: voiceAddon
              ? "Connect Close CRM first so inbound calls and lead lookups can be routed correctly."
              : "Voice access has to be active before a managed voice agent can be created.",
          },
          agent: { exists: false, published: false, provisioningStatus: null },
          connections: {
            close: { connected: false },
            retell: { connected: false },
          },
          readiness: {
            entitlementActive: !!voiceAddon,
          },
        });
      }

      // Agent exists — proxy to Standard-ChatBot
      const res = await callChatBotApi(
        "GET",
        `/api/external/agents/${setupAgentContext.agentId}/voice/setup-state`,
      );
      return sendResult(res);
    }

    let agentContext = await ensureAgentContext(
      supabase,
      effectiveUserId,
      action === "connect_close" || action === "create_voice_agent",
    );

    // Fallback: if the data client is remote and couldn't find the agent,
    // check the local DB. This handles local dev where the user exists
    // locally but not in the remote/production DB.
    if (!agentContext.ok && supabase !== authClient) {
      const localContext = await ensureAgentContext(
        authClient,
        effectiveUserId,
        false,
      );
      if (localContext.ok) {
        console.log(
          `[chat-bot-api] Agent not found in remote DB, using local fallback for user ${effectiveUserId}`,
        );
        agentContext = localContext;
      }
    }

    if (!agentContext.ok) {
      // Return 200 with error body for "not provisioned" (status 404) to avoid
      // browser network-level 404 logs that cannot be suppressed by JS.
      const httpStatus =
        agentContext.status === 404 ? 200 : agentContext.status;
      return jsonResponse(
        {
          error: agentContext.error,
          notProvisioned: agentContext.status === 404,
        },
        httpStatus,
      );
    }

    const agentId = agentContext.agentId;
    const localBillingExempt = agentContext.localBillingExempt;

    switch (action) {
      // ──────────────────────────────────────────────
      // AGENT STATUS & CONFIG
      // ──────────────────────────────────────────────
      case "get_agent": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}`,
        );
        const { payload, status, errorMessage, serviceDown } = unwrap(res);
        if (errorMessage) {
          // If the external platform no longer recognises this agent (404),
          // mark the local DB record as "failed" so re-provisioning works.
          if (res.status === 404) {
            await supabase
              .from("chat_bot_agents")
              .update({
                provisioning_status: "failed",
                error_message: "Agent not found on external platform",
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", effectiveUserId);
            console.log(
              `[chat-bot-api] Marked agent ${agentId} as failed (404 from external API) for user ${effectiveUserId}`,
            );
          }
          return jsonResponse(
            { error: errorMessage, ...(serviceDown && { serviceDown: true }) },
            status,
          );
        }

        const { isOnExemptTeam } = await getTeamAccessStatus(
          supabase,
          effectiveUserId,
        );
        const effectiveUnlimitedAccess = localBillingExempt || isOnExemptTeam;

        // Transform: flatten agent + reshape connections
        const agentData = { ...(payload.agent || {}) };
        if (effectiveUnlimitedAccess && agentData.billingExempt !== true) {
          const syncRes = await callChatBotApi(
            "PATCH",
            `/api/external/agents/${agentId}`,
            { billingExempt: true },
          );

          if (!syncRes.ok) {
            console.warn(
              `[chat-bot-api] Failed to re-sync billing-exempt access for agent ${agentId} and user ${effectiveUserId}:`,
              syncRes.data,
            );
          } else {
            agentData.billingExempt = true;
          }
        }

        const closeConn = payload.connections?.close;
        const calendlyConn = payload.connections?.calendly;
        const googleConn = payload.connections?.google;
        const retellConn = payload.connections?.retell;

        return jsonResponse({
          id: agentData.id,
          name: agentData.name,
          botEnabled: agentData.botEnabled ?? false,
          timezone: agentData.timezone ?? "America/New_York",
          isActive: agentData.isActive ?? true,
          createdAt: agentData.createdAt,
          autoOutreachLeadSources: agentData.autoOutreachLeadSources || [],
          allowedLeadStatuses: agentData.allowedLeadStatuses || [],
          blockedLeadStatuses: agentData.blockedLeadStatuses || [],
          calendlyEventTypeSlug: agentData.calendlyEventTypeSlug || null,
          leadSourceEventTypeMappings:
            agentData.leadSourceEventTypeMappings || [],
          companyName: agentData.companyName || null,
          jobTitle: agentData.jobTitle || null,
          bio: agentData.bio || null,
          yearsOfExperience: agentData.yearsOfExperience ?? null,
          residentState: agentData.residentState || null,
          nonResidentStates: agentData.nonResidentStates || null,
          specialties: agentData.specialties || null,
          website: agentData.website || null,
          location: agentData.location || null,
          businessHours: agentData.businessHours || null,
          responseSchedule: agentData.responseSchedule || null,
          remindersEnabled: agentData.remindersEnabled ?? false,
          billingExempt:
            agentData.billingExempt === true || effectiveUnlimitedAccess,
          dailyMessageLimit: agentData.dailyMessageLimit ?? null,
          maxMessagesPerConversation:
            agentData.maxMessagesPerConversation ?? null,
          voiceEnabled: agentData.voiceEnabled ?? false,
          voiceFollowUpEnabled: agentData.voiceFollowUpEnabled ?? false,
          afterHoursInboundEnabled: agentData.afterHoursInboundEnabled ?? false,
          afterHoursStartTime: agentData.afterHoursStartTime ?? null,
          afterHoursEndTime: agentData.afterHoursEndTime ?? null,
          afterHoursTimezone: agentData.afterHoursTimezone ?? null,
          voiceProvider: agentData.voiceProvider ?? null,
          voiceId: agentData.voiceId ?? null,
          voiceFallbackVoiceId: agentData.voiceFallbackVoiceId ?? null,
          voiceTransferNumber: agentData.voiceTransferNumber ?? null,
          voiceMaxCallDurationSeconds:
            agentData.voiceMaxCallDurationSeconds ?? null,
          voiceVoicemailEnabled: agentData.voiceVoicemailEnabled ?? true,
          voiceHumanHandoffEnabled: agentData.voiceHumanHandoffEnabled ?? true,
          voiceQuotedFollowupEnabled:
            agentData.voiceQuotedFollowupEnabled ?? false,
          primaryPhone: agentData.primaryPhone ?? null,
          statusTriggerSequences: agentData.statusTriggerSequences || [],
          reEngagementEnabled: agentData.reEngagementEnabled ?? false,
          reEngagementDelayHours: agentData.reEngagementDelayHours ?? null,
          reEngagementMaxAttempts: agentData.reEngagementMaxAttempts ?? null,
          connections: {
            close: closeConn
              ? { connected: true, orgName: closeConn.orgId || undefined }
              : { connected: false },
            calendly: calendlyConn
              ? {
                  connected: true,
                  eventType: calendlyConn.calendarId || undefined,
                }
              : { connected: false },
            google: googleConn
              ? {
                  connected: true,
                  calendarId: googleConn.calendarId || undefined,
                }
              : { connected: false },
            retell: retellConn
              ? {
                  connected: true,
                  id: retellConn.id,
                  agentId: retellConn.agentId,
                  apiKeyMasked: retellConn.apiKeyMasked,
                  retellAgentId: retellConn.retellAgentId,
                  fromNumberSource: retellConn.fromNumberSource,
                  fromNumber: retellConn.fromNumber ?? null,
                  closePhoneNumber: retellConn.closePhoneNumber ?? null,
                  status: retellConn.status,
                  createdAt: retellConn.createdAt,
                  updatedAt: retellConn.updatedAt,
                }
              : { connected: false },
          },
        });
      }

      case "get_status": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/status`,
        );
        return sendResult(res);
      }

      case "update_config": {
        const safeParams = parseUpdateConfigParams(params);
        const res = await callChatBotApi(
          "PATCH",
          `/api/external/agents/${agentId}`,
          safeParams,
        );
        return sendResult(res);
      }

      case "create_voice_agent": {
        const parsedParams = parseCreateVoiceAgentParams(params);
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/voice/agent/create`,
          parsedParams,
        );
        if (isVoiceCreateRouteUnavailable(res)) {
          return jsonResponse(
            {
              error:
                "Voice agent creation is not available in this environment yet.",
            },
            404,
          );
        }
        return sendResult(res);
      }

      case "save_retell_connection": {
        const parsedParams = parseRetellConnectionParams(params);
        const res = await upsertRetellConnection(agentId, parsedParams);
        return sendResult(res);
      }

      case "disconnect_retell_connection": {
        assertNoVoiceActionParams(
          params,
          "Disconnect voice connection request",
        );
        const res = await callChatBotApi(
          "DELETE",
          `/api/external/agents/${agentId}/connections/retell`,
        );
        return sendResult(res);
      }

      case "get_retell_runtime": {
        assertNoVoiceActionParams(params, "Get voice runtime request");
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/retell/runtime`,
        );
        return sendResult(res);
      }

      case "get_retell_voices": {
        assertNoVoiceActionParams(params, "Get voice library request");
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/retell/voices`,
        );
        return sendResult(res);
      }

      case "search_retell_voices": {
        const parsedParams = parseRetellSearchParams(params);
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/retell/voices/search`,
          parsedParams,
        );
        return sendResult(res);
      }

      case "add_retell_voice": {
        const parsedParams = parseAddRetellVoiceParams(params);
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/retell/voices/add`,
          parsedParams,
        );
        return sendResult(res);
      }

      case "update_retell_agent": {
        const parsedParams = parseRetellAgentUpdateParams(params);
        const res = await callChatBotApi(
          "PATCH",
          `/api/external/agents/${agentId}/retell/agent`,
          parsedParams,
        );
        return sendResult(res);
      }

      case "publish_retell_agent": {
        assertNoVoiceActionParams(params, "Publish voice draft request");
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/retell/agent/publish`,
        );
        return sendResult(res);
      }

      case "get_retell_llm": {
        assertNoVoiceActionParams(params, "Get voice instructions request");
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/retell/llm`,
        );
        return sendResult(res);
      }

      case "update_retell_llm": {
        const parsedParams = parseRetellLlmUpdateParams(params);
        const res = await callChatBotApi(
          "PATCH",
          `/api/external/agents/${agentId}/retell/llm`,
          parsedParams,
        );
        return sendResult(res);
      }

      // ──────────────────────────────────────────────
      // CLOSE CRM CONNECTION
      // ──────────────────────────────────────────────
      case "connect_close": {
        const allowedKeys = ["apiKey"];
        const invalidKeys = Object.keys(params).filter(
          (k) => !allowedKeys.includes(k),
        );
        if (invalidKeys.length > 0) {
          return jsonResponse(
            {
              error: `Connect Close request contains unsupported fields: ${invalidKeys.join(", ")}.`,
            },
            400,
          );
        }
        const apiKey =
          typeof params.apiKey === "string" ? params.apiKey.trim() : "";
        if (!apiKey) {
          return jsonResponse({ error: "Close API key is required." }, 400);
        }
        // Send to standard-chat-bot (existing flow)
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/connections/close`,
          { apiKey },
        );

        // Also store encrypted key in close_config for direct Close API access
        try {
          const { encrypt } = await import("../_shared/encryption.ts");
          const encryptedKey = await encrypt(apiKey);

          // Verify key + get org info from Close API
          let orgName: string | null = null;
          let orgId: string | null = null;
          try {
            const meRes = await fetch("https://api.close.com/api/v1/me/", {
              headers: {
                Authorization: `Basic ${btoa(`${apiKey}:`)}`,
                Accept: "application/json",
              },
              signal: AbortSignal.timeout(8000),
            });
            if (meRes.ok) {
              const meData = await meRes.json();
              orgId = meData.organization_id ?? null;
              // Fetch org name if we have the org ID
              if (orgId) {
                const orgRes = await fetch(
                  `https://api.close.com/api/v1/organization/${orgId}/`,
                  {
                    headers: {
                      Authorization: `Basic ${btoa(`${apiKey}:`)}`,
                      Accept: "application/json",
                    },
                    signal: AbortSignal.timeout(8000),
                  },
                );
                if (orgRes.ok) {
                  const orgData = await orgRes.json();
                  orgName = orgData.name ?? orgData.display_name ?? null;
                }
              }
            }
          } catch {
            // Non-critical: org info is optional, key storage is what matters
          }

          const { error: upsertError } = await supabase
            .from("close_config")
            .upsert(
              {
                user_id: effectiveUserId,
                api_key_encrypted: encryptedKey,
                organization_id: orgId,
                organization_name: orgName,
                is_active: true,
                last_verified_at: new Date().toISOString(),
              },
              { onConflict: "user_id" },
            );

          if (upsertError) {
            console.error(
              "[chat-bot-api] close_config upsert failed:",
              upsertError,
            );
            return jsonResponse(
              {
                error:
                  "Failed to save Close CRM configuration. Please try again.",
                detail: upsertError.message,
              },
              500,
            );
          }
        } catch (e) {
          console.error(
            "[chat-bot-api] Failed to store Close key in close_config:",
            e,
          );
          return jsonResponse(
            {
              error:
                "Failed to save Close CRM configuration. Please try again.",
              detail: String(e),
            },
            500,
          );
        }

        return sendResult(res);
      }

      case "disconnect_close": {
        const res = await callChatBotApi(
          "DELETE",
          `/api/external/agents/${agentId}/connections/close`,
        );

        // Also deactivate in close_config
        try {
          await supabase
            .from("close_config")
            .update({ is_active: false })
            .eq("user_id", effectiveUserId);
        } catch {
          // Non-blocking
        }

        return sendResult(res);
      }

      case "get_close_status": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/connections/close`,
        );
        return sendConnectionStatusResult(res, (payload) => ({
          connected: true,
          orgName: payload?.orgId || undefined,
        }));
      }

      case "get_close_lead_statuses": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/lead-statuses`,
        );
        const { payload, status, errorMessage } = unwrap(res);
        if (errorMessage) {
          return jsonResponse({ error: errorMessage }, status);
        }
        return jsonResponse({
          statuses: Array.isArray(payload?.statuses) ? payload.statuses : [],
        });
      }

      case "get_phone_numbers": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/phone-numbers`,
        );
        const { payload, status, errorMessage } = unwrap(res);
        if (errorMessage) {
          return jsonResponse({ error: errorMessage }, status);
        }
        return jsonResponse({
          phoneNumbers: Array.isArray(payload) ? payload : [],
        });
      }

      // ──────────────────────────────────────────────
      // VOICE PHONE NUMBERS (Retell-managed)
      // ──────────────────────────────────────────────

      case "list_voice_phone_numbers": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/voice/phone-numbers`,
        );
        const {
          payload,
          status: listStatus,
          errorMessage: listErr,
        } = unwrap(res);
        if (listErr) {
          return jsonResponse({ error: listErr }, listStatus);
        }
        return jsonResponse({
          phoneNumbers: Array.isArray(payload) ? payload : [],
        });
      }

      case "get_voice_phone_number": {
        const { phoneNumberId: getPhoneId } = params;
        if (!getPhoneId) {
          return jsonResponse({ error: "phoneNumberId is required" }, 400);
        }
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/voice/phone-numbers/${getPhoneId}`,
        );
        return sendResult(res);
      }

      case "update_voice_phone_number": {
        const { phoneNumberId: updatePhoneId, ...updateFields } = params;
        if (!updatePhoneId) {
          return jsonResponse({ error: "phoneNumberId is required" }, 400);
        }
        const patchBody: Record<string, unknown> = {};
        if (updateFields.nickname !== undefined)
          patchBody.nickname = updateFields.nickname;
        if (updateFields.isPrimary !== undefined)
          patchBody.isPrimary = updateFields.isPrimary;
        const res = await callChatBotApi(
          "PATCH",
          `/api/external/agents/${agentId}/voice/phone-numbers/${updatePhoneId}`,
          patchBody,
        );
        return sendResult(res);
      }

      // ──────────────────────────────────────────────
      // CALENDLY CONNECTION
      // ──────────────────────────────────────────────
      case "get_calendly_auth_url": {
        const returnUrl = validateReturnUrl(params.returnUrl);
        console.log(
          "[get_calendly_auth_url] agentId:",
          agentId,
          "returnUrl:",
          returnUrl,
        );
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/calendly/authorize?returnUrl=${encodeURIComponent(returnUrl)}`,
        );
        console.log(
          "[get_calendly_auth_url] API response ok:",
          res.ok,
          "status:",
          res.status,
          "data:",
          JSON.stringify(res.data).slice(0, 200),
        );
        const { payload, status, errorMessage } = unwrap(res);
        if (errorMessage) {
          console.error("[get_calendly_auth_url] error:", errorMessage);
          return jsonResponse({ error: errorMessage }, status);
        }
        console.log(
          "[get_calendly_auth_url] returning url:",
          payload?.url?.slice(0, 80),
        );
        return jsonResponse({ url: payload.url });
      }

      case "disconnect_calendly": {
        const res = await callChatBotApi(
          "DELETE",
          `/api/external/agents/${agentId}/connections/calendly`,
        );
        return sendResult(res);
      }

      case "get_calendly_status": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/connections/calendly`,
        );
        return sendConnectionStatusResult(res, (payload) => ({
          connected: true,
          eventType: payload?.calendarId ? "Connected" : undefined,
          userName: payload?.userName || undefined,
          userEmail: payload?.userEmail || undefined,
        }));
      }

      case "get_calendar_health": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/calendar-health`,
        );
        return sendResult(res);
      }

      // ──────────────────────────────────────────────
      // GOOGLE CALENDAR CONNECTION
      // ──────────────────────────────────────────────
      case "get_google_auth_url": {
        const returnUrl = validateReturnUrl(params.returnUrl);
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/google/authorize?returnUrl=${encodeURIComponent(returnUrl)}`,
        );
        const { payload, status, errorMessage } = unwrap(res);
        if (errorMessage) {
          return jsonResponse({ error: errorMessage }, status);
        }
        return jsonResponse({ url: payload.url });
      }

      case "get_google_status": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/connections/google`,
        );
        return sendConnectionStatusResult(res, (payload) => ({
          connected: true,
          calendarId: payload?.calendarId || undefined,
          userEmail: payload?.userEmail || undefined,
        }));
      }

      case "disconnect_google": {
        const res = await callChatBotApi(
          "DELETE",
          `/api/external/agents/${agentId}/connections/google`,
        );
        return sendResult(res);
      }

      case "update_business_hours": {
        const res = await callChatBotApi(
          "PATCH",
          `/api/external/agents/${agentId}`,
          { businessHours: params.businessHours },
        );
        return sendResult(res);
      }

      // ──────────────────────────────────────────────
      // CONVERSATIONS & MESSAGES
      // ──────────────────────────────────────────────
      case "get_conversations": {
        const qs = new URLSearchParams();
        if (params.page) qs.set("page", String(params.page));
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.status) qs.set("status", String(params.status));
        if (params.search) qs.set("search", String(params.search));
        const queryString = qs.toString() ? `?${qs.toString()}` : "";
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/conversations${queryString}`,
        );
        const { payload, meta, status, errorMessage } = unwrap(res);
        if (errorMessage) {
          return jsonResponse({ error: errorMessage }, status);
        }
        const pagination = meta?.pagination || {};
        return jsonResponse({
          data: Array.isArray(payload) ? payload : [],
          total: pagination.totalItems ?? pagination.total ?? 0,
          page: pagination.page ?? 1,
          limit: pagination.limit ?? 20,
        });
      }

      case "get_messages": {
        const { conversationId } = params;
        if (!conversationId) {
          return jsonResponse({ error: "conversationId is required" }, 400);
        }
        const qs = new URLSearchParams();
        if (params.page) qs.set("page", String(params.page));
        if (params.limit) qs.set("limit", String(params.limit));
        const queryString = qs.toString() ? `?${qs.toString()}` : "";
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/conversations/${conversationId}/messages${queryString}`,
        );
        const { payload, meta, status, errorMessage } = unwrap(res);
        if (errorMessage) {
          return jsonResponse({ error: errorMessage }, status);
        }
        // deno-lint-ignore no-explicit-any
        const rawItems: any[] = Array.isArray(payload) ? payload : [];
        // Normalize external API fields → frontend ChatBotMessage shape.
        // Spread raw message first to preserve all fields, then overlay normalized keys.
        // deno-lint-ignore no-explicit-any
        const normalizedMessages = rawItems.map((m: any) => ({
          ...m,
          id: m.id || m.uuid || "",
          conversationId:
            m.conversationId || m.conversation_id || conversationId,
          direction: m.direction || "outbound",
          content:
            m.content || m.text || m.body || m.message || m.full_content || "",
          createdAt: m.createdAt || m.created_at || m.date_created || "",
          channel: m.channel || null,
          senderType: m.senderType || m.sender_type || null,
          messageKind: m.messageKind || m.message_kind || null,
        }));
        const pagination = meta?.pagination || {};
        return jsonResponse({
          data: normalizedMessages,
          total: pagination.totalItems ?? pagination.total ?? 0,
          page: pagination.page ?? 1,
          limit: pagination.limit ?? 50,
        });
      }

      // ──────────────────────────────────────────────
      // APPOINTMENTS & USAGE
      // ──────────────────────────────────────────────
      case "get_appointments": {
        const qs = new URLSearchParams();
        if (params.page) qs.set("page", String(params.page));
        if (params.limit) qs.set("limit", String(params.limit));
        const queryString = qs.toString() ? `?${qs.toString()}` : "";
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/appointments${queryString}`,
        );
        console.log(
          "[get_appointments] raw response:",
          JSON.stringify(res.data).slice(0, 800),
        );
        const { payload, meta, status, errorMessage } = unwrap(res);
        if (errorMessage) {
          return jsonResponse({ error: errorMessage }, status);
        }
        // Normalize external API fields → frontend ChatBotAppointment shape.
        // External APIs (Calendly-backed) may return snake_case or different field names.
        // deno-lint-ignore no-explicit-any
        const rawItems: any[] = Array.isArray(payload) ? payload : [];
        // deno-lint-ignore no-explicit-any
        const normalizedItems = rawItems.map((item: any) => {
          // Map Calendly-style status → our status vocabulary
          const rawStatus = (
            item.status ||
            item.event_status ||
            ""
          ).toLowerCase();
          let normalizedStatus: string;
          switch (rawStatus) {
            case "confirmed":
            case "active":
            case "pending":
              normalizedStatus = "scheduled";
              break;
            case "completed":
            case "done":
              normalizedStatus = "completed";
              break;
            case "cancelled":
            case "canceled":
              normalizedStatus = "cancelled";
              break;
            case "no_show":
            case "no-show":
            case "noshow":
              normalizedStatus = "no_show";
              break;
            default:
              normalizedStatus = rawStatus || "scheduled";
          }
          return {
            id: item.id || item.uuid || item.uri || crypto.randomUUID(),
            leadName:
              item.leadName ||
              item.lead_name ||
              item.invitee_name ||
              item.inviteeName ||
              item.name ||
              "Unknown Lead",
            scheduledAt:
              item.scheduledAt ||
              item.scheduled_at ||
              item.startAt ||
              item.start_at ||
              item.start_time ||
              item.startTime ||
              item.event_start ||
              item.eventStart ||
              null,
            status: normalizedStatus,
            createdAt:
              item.createdAt ||
              item.created_at ||
              item.booked_at ||
              item.bookedAt ||
              null,
            eventUrl:
              item.eventUrl ||
              item.event_url ||
              item.uri ||
              item.calendly_url ||
              null,
            endAt: item.endAt || item.end_at || item.end_time || null,
            source: item.source || null,
            reminder24hSentAt:
              item.reminder24hSentAt || item.reminder_24h_sent_at || null,
            reminder1hSentAt:
              item.reminder1hSentAt || item.reminder_1h_sent_at || null,
            reminder15mSentAt:
              item.reminder15mSentAt || item.reminder_15m_sent_at || null,
          };
        });
        const pagination = meta?.pagination || {};
        const total =
          pagination.totalItems ??
          pagination.total ??
          meta?.total ??
          normalizedItems.length;
        return jsonResponse({
          data: normalizedItems,
          total,
          page: pagination.page ?? 1,
          limit: pagination.limit ?? 20,
        });
      }

      case "get_usage": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/usage`,
        );
        const { payload, status, errorMessage } = unwrap(res);
        if (errorMessage) {
          return jsonResponse({ error: errorMessage }, status);
        }
        return jsonResponse({
          leadsUsed: payload?.leadCount ?? 0,
          leadLimit: payload?.leadLimit ?? 0,
          periodStart: payload?.periodStart ?? null,
          periodEnd: payload?.periodEnd ?? null,
          tierName: payload?.planName || "Free",
        });
      }

      case "get_voice_entitlement": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/voice-entitlement`,
        );
        const { payload, status, errorMessage } = unwrap(res);
        if (errorMessage) {
          return jsonResponse({ error: errorMessage }, status);
        }
        return jsonResponse({ entitlement: payload ?? null });
      }

      case "get_voice_usage": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/voice-usage`,
        );
        return sendResult(res);
      }

      case "get_voice_clone_status": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/voice/clone-status`,
        );
        const { payload, status, errorMessage } = unwrap(res);
        if (errorMessage) {
          return jsonResponse({ error: errorMessage }, status);
        }
        const webAppUrl = getWebAppUrl();
        const cloneWizardUrl = webAppUrl
          ? `${webAppUrl}/agents/${agentId}/voice/clone`
          : null;
        return jsonResponse({ ...(payload ?? {}), cloneWizardUrl });
      }

      case "get_voice_clone_scripts": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/voice/clone/scripts`,
        );
        return sendResult(res);
      }

      case "update_voice_clone_scripts": {
        const scripts = params.scripts;
        if (!Array.isArray(scripts)) {
          return jsonResponse({ error: "scripts array is required" }, 400);
        }
        // Validate script entries before forwarding (proxy-layer contract enforcement)
        if (scripts.length < 15 || scripts.length > 25) {
          return jsonResponse(
            {
              error: `scripts must contain 15-25 entries, received ${scripts.length}`,
            },
            400,
          );
        }
        for (let i = 0; i < scripts.length; i++) {
          const s = scripts[i];
          if (!s || typeof s !== "object") {
            return jsonResponse(
              { error: `scripts[${i}] must be an object` },
              400,
            );
          }
          if (typeof s.segmentIndex !== "number" || s.segmentIndex !== i) {
            return jsonResponse(
              {
                error: `scripts[${i}].segmentIndex must be ${i} (sequential, 0-indexed)`,
              },
              400,
            );
          }
          if (!s.category || !s.title || !s.scriptText) {
            return jsonResponse(
              {
                error: `scripts[${i}] requires category, title, and scriptText`,
              },
              400,
            );
          }
          if (typeof s.scriptText === "string" && s.scriptText.length > 10000) {
            return jsonResponse(
              {
                error: `scripts[${i}].scriptText exceeds 10000 character limit`,
              },
              400,
            );
          }
        }
        const res = await callChatBotApi(
          "PUT",
          `/api/external/agents/${agentId}/voice/clone/scripts`,
          { scripts },
        );
        return sendResult(res);
      }

      case "reset_voice_clone_scripts": {
        const res = await callChatBotApi(
          "DELETE",
          `/api/external/agents/${agentId}/voice/clone/scripts`,
        );
        return sendResult(res);
      }

      case "start_voice_clone": {
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/voice/clone/start`,
          {
            voiceName: params.voiceName,
            consentAccepted:
              params.consentAccepted === true ||
              params.consentAccepted === "true",
          },
        );
        return sendResult(res);
      }

      case "upload_voice_clone_segment": {
        const cloneId = params.clone_id;
        if (!cloneId) {
          return jsonResponse({ error: "clone_id is required" }, 400);
        }
        if (!incomingFormData) {
          return jsonResponse(
            {
              error: "upload_voice_clone_segment requires multipart/form-data",
            },
            400,
          );
        }
        // Reconstruct FormData for upstream: text fields MUST come before file
        // (@fastify/multipart's request.file() only sees fields before the file part)
        const upstreamForm = new FormData();
        const file = incomingFormData.get("file");

        // M1: Enforce max segment size (50 MB) at the proxy layer
        if (file instanceof File && file.size > 52_428_800) {
          return jsonResponse(
            { error: "Audio segment exceeds 50 MB limit" },
            413,
          );
        }

        const segmentIndex =
          incomingFormData.get("segmentIndex") ?? params.segmentIndex;
        const durationSeconds =
          incomingFormData.get("durationSeconds") ?? params.durationSeconds;

        // Append text fields first — fastify multipart requires this ordering
        if (segmentIndex !== undefined && segmentIndex !== null) {
          upstreamForm.append("segmentIndex", String(segmentIndex));
        }
        if (durationSeconds !== undefined && durationSeconds !== null) {
          upstreamForm.append("durationSeconds", String(durationSeconds));
        }
        // File must be last
        if (file) upstreamForm.append("file", file);

        const res = await callChatBotApiMultipart(
          `/api/external/agents/${agentId}/voice/clone/${cloneId}/segments`,
          upstreamForm,
        );
        return sendResult(res);
      }

      case "get_voice_clone_session": {
        const cloneId = params.clone_id;
        if (!cloneId) {
          return jsonResponse({ error: "clone_id is required" }, 400);
        }
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/voice/clone/${cloneId}`,
        );
        return sendResult(res);
      }

      case "submit_voice_clone": {
        const cloneId = params.clone_id;
        if (!cloneId) {
          return jsonResponse({ error: "clone_id is required" }, 400);
        }
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/voice/clone/${cloneId}/submit`,
        );
        return sendResult(res);
      }

      case "activate_voice_clone": {
        const cloneId = params.clone_id;
        if (!cloneId) {
          return jsonResponse({ error: "clone_id is required" }, 400);
        }
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/voice/clone/${cloneId}/activate`,
        );
        return sendResult(res);
      }

      case "deactivate_voice_clone": {
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/voice/clone/deactivate`,
        );
        return sendResult(res);
      }

      case "cancel_voice_clone": {
        const cloneId = params.clone_id;
        if (!cloneId) {
          return jsonResponse({ error: "clone_id is required" }, 400);
        }
        // Try POST /cancel first (matches backend POST pattern for all clone ops).
        // Fall back to DELETE if POST 404s (legacy compat).
        let res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/voice/clone/${cloneId}/cancel`,
        );
        if (!res.ok && res.status === 404) {
          res = await callChatBotApi(
            "DELETE",
            `/api/external/agents/${agentId}/voice/clone/${cloneId}`,
          );
        }
        return sendResult(res);
      }

      case "delete_voice_clone_segment": {
        const cloneId = params.clone_id;
        const segmentIndex = params.segment_index;
        if (!cloneId || segmentIndex === undefined || segmentIndex === null) {
          return jsonResponse(
            { error: "clone_id and segment_index are required" },
            400,
          );
        }
        const res = await callChatBotApi(
          "DELETE",
          `/api/external/agents/${agentId}/voice/clone/${cloneId}/segments/${segmentIndex}`,
        );
        return sendResult(res);
      }

      case "get_calendly_event_types": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/calendly/event-types`,
        );
        const { payload, status, errorMessage } = unwrap(res);
        if (errorMessage) {
          return jsonResponse({ error: errorMessage }, status);
        }
        if (!Array.isArray(payload)) {
          console.warn(
            `[get_calendly_event_types] Unexpected payload shape (type=${typeof payload}):`,
            JSON.stringify(payload).slice(0, 200),
          );
        }
        return jsonResponse(Array.isArray(payload) ? payload : []);
      }

      // ──────────────────────────────────────────────
      // ANALYTICS & ATTRIBUTION
      // ──────────────────────────────────────────────
      case "get_analytics": {
        const qs = new URLSearchParams();
        if (params.from) qs.set("from", String(params.from));
        if (params.to) qs.set("to", String(params.to));
        const queryString = qs.toString() ? `?${qs.toString()}` : "";
        try {
          const res = await callChatBotApi(
            "GET",
            `/api/external/agents/${agentId}/analytics${queryString}`,
          );
          console.log(
            "[get_analytics] raw res.data:",
            JSON.stringify(res.data).slice(0, 500),
          );
          const { payload, errorMessage } = unwrap(res);
          console.log(
            "[get_analytics] unwrapped payload:",
            JSON.stringify(payload).slice(0, 500),
          );
          console.log("[get_analytics] errorMessage:", errorMessage);
          if (errorMessage) {
            // External API not deployed yet — return empty analytics shell
            return jsonResponse({
              conversations: {
                total: 0,
                byStatus: {},
                byChannel: {},
                avgMessagesPerConvo: 0,
                suppressionRate: 0,
                staleRate: 0,
              },
              engagement: {
                responseRate: 0,
                multiTurnRate: 0,
                avgFirstResponseMin: 0,
                avgObjectionCount: 0,
                hardNoRate: 0,
              },
              appointments: {
                total: 0,
                bookingRate: 0,
                showRate: 0,
                cancelRate: 0,
                avgDaysToAppointment: 0,
              },
              timeline: [],
            });
          }
          return jsonResponse(normalizeAnalyticsPayload(payload));
        } catch {
          // External API unavailable — return empty shell
          return jsonResponse({
            conversations: {
              total: 0,
              byStatus: {},
              byChannel: {},
              avgMessagesPerConvo: 0,
              suppressionRate: 0,
              staleRate: 0,
            },
            engagement: {
              responseRate: 0,
              multiTurnRate: 0,
              avgFirstResponseMin: 0,
              avgObjectionCount: 0,
              hardNoRate: 0,
            },
            appointments: {
              total: 0,
              bookingRate: 0,
              showRate: 0,
              cancelRate: 0,
              avgDaysToAppointment: 0,
            },
            timeline: [],
          });
        }
      }

      case "get_attributions": {
        const from = params.from ? String(params.from) : null;
        const to = params.to ? String(params.to) : null;

        // Step 1: Get attributions with policy data (no nested client embed — PostgREST aliasing bug)
        let query = supabase
          .from("bot_policy_attributions")
          .select(
            "id, policy_id, attribution_type, match_method, confidence_score, lead_name, conversation_started_at, external_conversation_id, external_appointment_id, created_at, policies(id, policy_number, monthly_premium, annual_premium, effective_date, status, client_id)",
          )
          .eq("user_id", effectiveUserId)
          .order("created_at", { ascending: false });

        if (from) query = query.gte("conversation_started_at", from);
        if (to)
          query = query.lte("conversation_started_at", `${to}T23:59:59.999Z`);

        const { data: rawAttrs, error: qErr } = await query;
        if (qErr) {
          return jsonResponse({ error: qErr.message }, 400);
        }
        const attrs = rawAttrs || [];

        // Step 2: Batch-fetch client names for all attributed policies
        // deno-lint-ignore no-explicit-any
        const clientIds = attrs
          .map((a: any) => a.policies?.client_id)
          .filter(Boolean);
        // deno-lint-ignore no-explicit-any
        const clientMap: Record<string, any> = {};
        if (clientIds.length > 0) {
          const { data: clients } = await supabase
            .from("clients")
            .select("id, name")
            .in("id", clientIds);
          if (clients) {
            for (const c of clients) {
              clientMap[c.id] = { name: c.name };
            }
          }
        }

        // Step 3: Merge client data into attributions
        // deno-lint-ignore no-explicit-any
        const result = attrs.map((a: any) => {
          const clientId = a.policies?.client_id;
          const client = clientId ? clientMap[clientId] || null : null;
          return {
            ...a,
            policies: a.policies
              ? {
                  id: a.policies.id,
                  policy_number: a.policies.policy_number,
                  monthly_premium: a.policies.monthly_premium,
                  annual_premium: a.policies.annual_premium,
                  effective_date: a.policies.effective_date,
                  status: a.policies.status,
                  clients: client,
                }
              : null,
          };
        });

        return jsonResponse(result);
      }

      case "check_attribution": {
        const { policyId } = params;
        if (!policyId) {
          return jsonResponse({ error: "policyId is required" }, 400);
        }

        // Already attributed?
        const { data: existing } = await supabase
          .from("bot_policy_attributions")
          .select("id")
          .eq("policy_id", policyId)
          .maybeSingle();
        if (existing) {
          return jsonResponse({ matched: false, reason: "already_attributed" });
        }

        // Get policy + client info (verify ownership — service_role bypasses RLS)
        const { data: policy } = await supabase
          .from("policies")
          .select("id, user_id, clients(name, phone)")
          .eq("id", policyId)
          .single();
        if (!policy || !policy.clients) {
          return jsonResponse({ matched: false, reason: "no_client" });
        }
        if (policy.user_id !== effectiveUserId) {
          return jsonResponse({ error: "Forbidden" }, 403);
        }

        // deno-lint-ignore no-explicit-any
        const client = policy.clients as any;
        const clientPhone = (client.phone || "").replace(/\D/g, "");
        const clientName = (client.name || "").trim();

        // Search bot conversations for matching lead (last 90 days)
        const from90d = new Date(Date.now() - 90 * 86400000)
          .toISOString()
          .slice(0, 10);
        const qs = new URLSearchParams();
        if (clientPhone) qs.set("leadPhone", clientPhone);
        if (clientName) qs.set("leadName", clientName);
        qs.set("from", from90d);

        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/conversations/search?${qs.toString()}`,
        );
        const { payload } = unwrap(res);
        const matches = Array.isArray(payload) ? payload : [];

        if (matches.length === 0) {
          return jsonResponse({ matched: false, reason: "no_match" });
        }

        // Determine best match: phone match > name match
        // deno-lint-ignore no-explicit-any
        let bestMatch: any = null;
        let matchMethod = "auto_name";
        let confidence = 0.7;

        for (const m of matches) {
          const mPhone = (m.leadPhone || "").replace(/\D/g, "");
          if (clientPhone && mPhone === clientPhone) {
            bestMatch = m;
            matchMethod = "auto_phone";
            confidence = 1.0;
            break;
          }
          if (!bestMatch) bestMatch = m;
        }

        if (!bestMatch) {
          return jsonResponse({ matched: false, reason: "no_match" });
        }

        const attributionType = bestMatch.appointmentId
          ? "bot_converted"
          : "bot_assisted";

        const { error: insertErr } = await supabase
          .from("bot_policy_attributions")
          .insert({
            policy_id: policyId,
            user_id: effectiveUserId,
            external_conversation_id: bestMatch.id || bestMatch.conversationId,
            external_appointment_id: bestMatch.appointmentId || null,
            attribution_type: attributionType,
            match_method: matchMethod,
            confidence_score: confidence,
            lead_name: bestMatch.leadName || clientName || null,
            conversation_started_at: bestMatch.startedAt || null,
          });

        if (insertErr) {
          // Unique constraint = already attributed (race condition), not an error
          if (insertErr.code === "23505") {
            return jsonResponse({
              matched: false,
              reason: "already_attributed",
            });
          }
          return jsonResponse({ error: insertErr.message }, 400);
        }

        return jsonResponse({
          matched: true,
          attributionType,
          matchMethod,
          confidence,
        });
      }

      case "link_attribution": {
        const {
          policyId,
          conversationId: extConvoId,
          appointmentId: extApptId,
          leadName: manualLeadName,
        } = params;
        if (!policyId || !extConvoId) {
          return jsonResponse(
            { error: "policyId and conversationId are required" },
            400,
          );
        }

        // Verify policy ownership (service_role bypasses RLS)
        const { data: linkPolicy } = await supabase
          .from("policies")
          .select("user_id")
          .eq("id", policyId)
          .single();
        if (!linkPolicy || linkPolicy.user_id !== effectiveUserId) {
          return jsonResponse({ error: "Forbidden" }, 403);
        }

        const { error: insertErr } = await supabase
          .from("bot_policy_attributions")
          .upsert(
            {
              policy_id: policyId,
              user_id: effectiveUserId,
              external_conversation_id: String(extConvoId),
              external_appointment_id: extApptId ? String(extApptId) : null,
              attribution_type: extApptId ? "bot_converted" : "bot_assisted",
              match_method: "manual",
              confidence_score: 1.0,
              lead_name: manualLeadName ? String(manualLeadName) : null,
            },
            { onConflict: "policy_id" },
          );

        if (insertErr) {
          return jsonResponse({ error: insertErr.message }, 400);
        }
        return jsonResponse({ success: true });
      }

      case "unlink_attribution": {
        const { attributionId } = params;
        if (!attributionId) {
          return jsonResponse({ error: "attributionId is required" }, 400);
        }

        const { error: delErr } = await supabase
          .from("bot_policy_attributions")
          .delete()
          .eq("id", attributionId)
          .eq("user_id", effectiveUserId);

        if (delErr) {
          return jsonResponse({ error: delErr.message }, 400);
        }
        return jsonResponse({ success: true });
      }

      case "get_monitoring": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/monitoring`,
        );
        return sendResult(res);
      }

      case "get_system_health": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/monitoring/system`,
        );
        return sendResult(res);
      }

      // ──────────────────────────────────────────────
      // CHANNEL ORCHESTRATION — RULESET
      // ──────────────────────────────────────────────
      case "get_orchestration_ruleset": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/orchestration`,
        );
        return sendResult(res);
      }

      case "update_orchestration_ruleset": {
        const { name, isActive, rules, fallbackAction } = params;
        const res = await callChatBotApi(
          "PUT",
          `/api/external/agents/${agentId}/orchestration`,
          { name, isActive, rules, fallbackAction },
        );
        return sendResult(res);
      }

      case "patch_orchestration_ruleset": {
        const { isActive, fallbackAction } = params;
        const body: Record<string, unknown> = {};
        if (isActive !== undefined) body.isActive = isActive;
        if (fallbackAction !== undefined) body.fallbackAction = fallbackAction;
        const res = await callChatBotApi(
          "PATCH",
          `/api/external/agents/${agentId}/orchestration`,
          body,
        );
        return sendResult(res);
      }

      case "delete_orchestration_ruleset": {
        const res = await callChatBotApi(
          "DELETE",
          `/api/external/agents/${agentId}/orchestration`,
        );
        return sendResult(res);
      }

      // ──────────────────────────────────────────────
      // CHANNEL ORCHESTRATION — INDIVIDUAL RULES
      // ──────────────────────────────────────────────
      case "create_orchestration_rule": {
        const { name, enabled, conditions, ruleAction } = params;
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/orchestration/rules`,
          { name, enabled, conditions, action: ruleAction },
        );
        return sendResult(res);
      }

      case "update_orchestration_rule": {
        const { ruleId, patch } = params;
        if (!ruleId) {
          return jsonResponse({ error: "ruleId is required" }, 400);
        }
        const res = await callChatBotApi(
          "PATCH",
          `/api/external/agents/${agentId}/orchestration/rules/${ruleId}`,
          patch as Record<string, unknown>,
        );
        return sendResult(res);
      }

      case "delete_orchestration_rule": {
        const { ruleId } = params;
        if (!ruleId) {
          return jsonResponse({ error: "ruleId is required" }, 400);
        }
        const res = await callChatBotApi(
          "DELETE",
          `/api/external/agents/${agentId}/orchestration/rules/${ruleId}`,
        );
        return sendResult(res);
      }

      case "toggle_orchestration_rule": {
        const { ruleId, enabled } = params;
        if (!ruleId) {
          return jsonResponse({ error: "ruleId is required" }, 400);
        }
        const res = await callChatBotApi(
          "PATCH",
          `/api/external/agents/${agentId}/orchestration/rules/${ruleId}/enabled`,
          { enabled },
        );
        return sendResult(res);
      }

      case "reorder_orchestration_rules": {
        const { orderedRuleIds } = params;
        if (!Array.isArray(orderedRuleIds)) {
          return jsonResponse(
            { error: "orderedRuleIds array is required" },
            400,
          );
        }
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/orchestration/rules/reorder`,
          { orderedRuleIds },
        );
        return sendResult(res);
      }

      // ──────────────────────────────────────────────
      // CHANNEL ORCHESTRATION — TEMPLATES
      // ──────────────────────────────────────────────
      case "get_orchestration_templates": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/orchestration/templates`,
        );
        const { payload, status, errorMessage } = unwrap(res);
        if (errorMessage) {
          return jsonResponse({ error: errorMessage }, status);
        }
        return jsonResponse({
          templates: Array.isArray(payload) ? payload : [],
        });
      }

      case "get_orchestration_template_preview": {
        const { templateKey } = params;
        if (!templateKey) {
          return jsonResponse({ error: "templateKey is required" }, 400);
        }
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/orchestration/templates/${templateKey}/preview`,
        );
        return sendResult(res);
      }

      case "apply_orchestration_template": {
        const { templateKey, mode } = params;
        if (!templateKey) {
          return jsonResponse({ error: "templateKey is required" }, 400);
        }
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/orchestration/templates/${templateKey}/apply`,
          { mode: mode || "replace" },
        );
        return sendResult(res);
      }

      // ──────────────────────────────────────────────
      // CHANNEL ORCHESTRATION — EVALUATE
      // ──────────────────────────────────────────────
      case "evaluate_orchestration": {
        const {
          leadStatus,
          leadSource,
          conversationStatus,
          channel,
          evaluateAt,
        } = params;
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/orchestration/evaluate`,
          { leadStatus, leadSource, conversationStatus, channel, evaluateAt },
        );
        return sendResult(res);
      }

      // ──────────────────────────────────────────────
      // CHANNEL ORCHESTRATION — POST-CALL CONFIG
      // ──────────────────────────────────────────────
      case "get_post_call_config": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/orchestration/post-call-config`,
        );
        return sendResult(res);
      }

      case "update_post_call_config": {
        const { statusMapping, customFieldMapping, transcriptWriteback } =
          params;
        const body: Record<string, unknown> = {};
        if (statusMapping !== undefined) body.statusMapping = statusMapping;
        if (customFieldMapping !== undefined)
          body.customFieldMapping = customFieldMapping;
        if (transcriptWriteback !== undefined)
          body.transcriptWriteback = transcriptWriteback;
        const res = await callChatBotApi(
          "PATCH",
          `/api/external/agents/${agentId}/orchestration/post-call-config`,
          body,
        );
        return sendResult(res);
      }

      // ──────────────────────────────────────────────
      // VOICE SESSIONS
      // ──────────────────────────────────────────────
      case "get_voice_sessions": {
        const qs = new URLSearchParams();
        if (params.page) qs.set("page", String(params.page));
        if (params.limit) qs.set("limit", String(params.limit));
        const queryString = qs.toString() ? `?${qs.toString()}` : "";
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/voice-sessions${queryString}`,
        );
        const { payload, meta, status, errorMessage } = unwrap(res);
        if (errorMessage) {
          return jsonResponse({ error: errorMessage }, status);
        }
        const pagination = meta?.pagination || payload?.pagination || {};
        return jsonResponse({
          items: Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload)
              ? payload
              : [],
          pagination: {
            page: pagination.page ?? 1,
            limit: pagination.limit ?? 20,
            totalItems: pagination.totalItems ?? 0,
            totalPages: pagination.totalPages ?? 0,
            hasNext: pagination.hasNext ?? false,
            hasPrev: pagination.hasPrev ?? false,
          },
        });
      }

      case "get_voice_session": {
        const { sessionId } = params;
        if (!sessionId) {
          return jsonResponse({ error: "sessionId is required" }, 400);
        }
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/voice-sessions/${sessionId}`,
        );
        return sendResult(res);
      }

      case "manual_voice_writeback": {
        const { sessionId, format, includeRecordingLink } = params;
        if (!sessionId) {
          return jsonResponse({ error: "sessionId is required" }, 400);
        }
        const body: Record<string, unknown> = {};
        if (format !== undefined) body.format = format;
        if (includeRecordingLink !== undefined)
          body.includeRecordingLink = includeRecordingLink;
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/voice-sessions/${sessionId}/writeback`,
          body,
        );
        return sendResult(res);
      }

      // ──────────────────────────────────────────────
      // CLOSE CRM DATA (for orchestration dropdowns)
      // ──────────────────────────────────────────────
      case "get_close_lead_sources": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/close/lead-sources`,
        );
        const { payload, status, errorMessage } = unwrap(res);
        if (errorMessage) {
          return jsonResponse({ error: errorMessage }, status);
        }
        const rawSources = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.sources)
            ? payload.sources
            : [];
        // Normalize { value, configured } → { id, label } for frontend
        const sources = rawSources.map((s: any) => ({
          id: s.id ?? s.value ?? s.label ?? "",
          label: s.label ?? s.value ?? s.id ?? "",
        }));
        return jsonResponse({ sources });
      }

      case "get_close_custom_fields": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/close/custom-fields`,
        );
        const { payload, status, errorMessage } = unwrap(res);
        if (errorMessage) {
          return jsonResponse({ error: errorMessage }, status);
        }
        const rawFields = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.fields)
            ? payload.fields
            : [];
        // Normalize { id, label, key, type } → { key, name, type } for frontend
        const fields = rawFields.map((f: any) => ({
          key: f.key ?? f.id ?? "",
          name: f.name ?? f.label ?? f.key ?? "",
          type: f.type ?? "text",
        }));
        return jsonResponse({ fields });
      }

      case "get_close_smart_views": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/close/smart-views`,
        );
        const { payload, status, errorMessage } = unwrap(res);
        if (errorMessage) {
          return jsonResponse({ error: errorMessage }, status);
        }
        const smartViews = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.smartViews)
            ? payload.smartViews
            : [];
        return jsonResponse({ smartViews });
      }

      // CLOSE KPI DASHBOARD actions moved to dedicated close-kpi-data edge function

      // ──────────────────────────────────────────────
      // VOICE RULES & GUARDRAILS
      // ──────────────────────────────────────────────
      case "update_voice_inbound_rules": {
        const {
          enabled,
          afterHoursEnabled,
          allowedLeadStatuses,
          transferNumber,
          afterHoursStartTime,
          afterHoursEndTime,
          afterHoursTimezone,
        } = params;
        const body: Record<string, unknown> = {};
        if (enabled !== undefined) body.enabled = enabled;
        if (afterHoursEnabled !== undefined)
          body.afterHoursEnabled = afterHoursEnabled;
        if (allowedLeadStatuses !== undefined)
          body.allowedLeadStatuses = allowedLeadStatuses;
        if (transferNumber !== undefined) body.transferNumber = transferNumber;
        if (afterHoursStartTime !== undefined)
          body.afterHoursStartTime = afterHoursStartTime;
        if (afterHoursEndTime !== undefined)
          body.afterHoursEndTime = afterHoursEndTime;
        if (afterHoursTimezone !== undefined)
          body.afterHoursTimezone = afterHoursTimezone;
        const res = await callChatBotApi(
          "PATCH",
          `/api/external/agents/${agentId}/voice/rules/inbound`,
          body,
        );
        return sendResult(res);
      }

      case "update_voice_outbound_rules": {
        const {
          enabled,
          mode,
          customFieldKey,
          allowedLeadStatuses,
          allowedLeadSources,
        } = params;
        const body: Record<string, unknown> = {};
        if (enabled !== undefined) body.enabled = enabled;
        if (mode !== undefined) body.mode = mode;
        if (customFieldKey !== undefined) body.customFieldKey = customFieldKey;
        if (allowedLeadStatuses !== undefined)
          body.allowedLeadStatuses = allowedLeadStatuses;
        if (allowedLeadSources !== undefined)
          body.allowedLeadSources = allowedLeadSources;
        const res = await callChatBotApi(
          "PATCH",
          `/api/external/agents/${agentId}/voice/rules/outbound`,
          body,
        );
        return sendResult(res);
      }

      case "update_voice_guardrails": {
        const guardrailKeys = [
          "maxCallDurationSeconds",
          "silenceHangupSeconds",
          "ringTimeoutSeconds",
          "maxDailyOutboundCalls",
          "maxAttemptsPerLead",
          "outboundCooldownHours",
          "voicemailEnabled",
          "humanHandoffEnabled",
          "quotedFollowupEnabled",
          "workspaceActive",
          "workspaceKillSwitchEnabled",
        ];
        const body: Record<string, unknown> = {};
        for (const key of guardrailKeys) {
          if (params[key] !== undefined) body[key] = params[key];
        }
        const res = await callChatBotApi(
          "PATCH",
          `/api/external/agents/${agentId}/voice/guardrails`,
          body,
        );
        return sendResult(res);
      }

      // ──────────────────────────────────────────────
      // CLOSE CRM WRITE HELPERS
      // ──────────────────────────────────────────────
      case "create_close_custom_field": {
        const { key, label, type } = params;
        if (!key || typeof key !== "string") {
          return jsonResponse({ error: "key is required" }, 400);
        }
        const body: Record<string, unknown> = { key };
        if (label !== undefined) body.label = label;
        if (type !== undefined) body.type = type;
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/close/custom-fields/create`,
          body,
        );
        return sendResult(res);
      }

      case "create_close_smart_view": {
        const { name, customFieldKey, customFieldValue, shared } = params;
        if (!customFieldKey || typeof customFieldKey !== "string") {
          return jsonResponse({ error: "customFieldKey is required" }, 400);
        }
        const body: Record<string, unknown> = { customFieldKey };
        if (name !== undefined) body.name = name;
        if (customFieldValue !== undefined)
          body.customFieldValue = customFieldValue;
        if (shared !== undefined) body.shared = shared;
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/close/smart-views/create`,
          body,
        );
        return sendResult(res);
      }

      case "refresh_close_metadata": {
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/close/metadata/refresh`,
        );
        return sendResult(res);
      }

      // ──────────────────────────────────────────────
      // SYNC BOT MESSAGES → CLOSE SMS ACTIVITIES
      // ──────────────────────────────────────────────
      case "sync_messages_to_close": {
        const { conversationId } = params;
        if (!conversationId) {
          return jsonResponse({ error: "conversationId is required" }, 400);
        }

        // 1. Get the conversation to find closeLeadId + phone numbers
        const convRes = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/conversations/${conversationId}`,
        );
        const convData = convRes.ok
          ? (convRes.data?.data?.conversation ??
            convRes.data?.data ??
            convRes.data)
          : null;
        if (!convData) {
          return jsonResponse({ error: "Conversation not found" }, 404);
        }
        const closeLeadId = convData.closeLeadId || convData.close_lead_id;
        if (!closeLeadId) {
          return jsonResponse({
            synced: 0,
            skipped: true,
            reason: "No Close lead linked to this conversation",
          });
        }
        const remotePhone = convData.leadPhone || convData.lead_phone || null;
        const localPhone = convData.localPhone || convData.local_phone || null;

        // 2. Fetch all bot messages (paginate up to 500)
        const allBotMessages: {
          id: string;
          direction: string;
          content: string;
          createdAt: string;
        }[] = [];
        let msgPage = 1;
        const msgLimit = 100;
        while (allBotMessages.length < 500) {
          const msgRes = await callChatBotApi(
            "GET",
            `/api/external/agents/${agentId}/conversations/${conversationId}/messages?page=${msgPage}&limit=${msgLimit}`,
          );
          const { payload, meta } = unwrap(msgRes);
          const items = Array.isArray(payload) ? payload : [];
          if (items.length === 0) break;
          for (const m of items) {
            allBotMessages.push({
              id: m.id || m.uuid || "",
              direction: m.direction || "outbound",
              content: m.content || m.text || m.body || "",
              createdAt: m.createdAt || m.created_at || m.date_created || "",
            });
          }
          const totalItems =
            meta?.pagination?.totalItems ?? meta?.pagination?.total ?? 0;
          if (allBotMessages.length >= totalItems || items.length < msgLimit)
            break;
          msgPage++;
        }

        if (allBotMessages.length === 0) {
          return jsonResponse({ synced: 0, reason: "No bot messages" });
        }

        // 3. Get Close API key
        const envCloseKey = Deno.env.get("CLOSE_API_KEY");
        let closeApiKey: string;
        if (envCloseKey) {
          closeApiKey = envCloseKey;
        } else {
          const { data: encryptedKey, error: rpcError } = await supabase.rpc(
            "get_close_api_key",
            { p_user_id: effectiveUserId },
          );
          if (rpcError || !encryptedKey) {
            return jsonResponse(
              {
                error:
                  "Close CRM not connected. Connect your Close account first.",
                code: "CLOSE_NOT_CONNECTED",
              },
              400,
            );
          }
          closeApiKey = await decrypt(encryptedKey);
        }

        const closeAuth = `Basic ${btoa(`${closeApiKey}:`)}`;
        const CLOSE_BASE = "https://api.close.com/api/v1";

        // 4. Fetch existing Close SMS activities for this lead
        const existingSms: {
          text: string;
          direction: string;
          date_created: string;
        }[] = [];
        let hasMore = true;
        let skip = 0;
        while (hasMore) {
          const smsRes = await fetch(
            `${CLOSE_BASE}/activity/sms/?lead_id=${closeLeadId}&_skip=${skip}&_limit=100`,
            {
              headers: {
                Authorization: closeAuth,
                Accept: "application/json",
              },
              signal: AbortSignal.timeout(12_000),
            },
          );
          if (!smsRes.ok) {
            const errText = await smsRes.text().catch(() => "");
            console.error(
              "[sync_messages_to_close] Failed to fetch Close SMS:",
              smsRes.status,
              errText,
            );
            return jsonResponse(
              {
                error: `Failed to fetch Close SMS activities: ${smsRes.status}`,
              },
              400,
            );
          }
          const smsData = await smsRes.json();
          const items = smsData.data || [];
          for (const s of items) {
            existingSms.push({
              text: (s.text || "").trim(),
              direction: s.direction || "",
              date_created: s.date_created || "",
            });
          }
          hasMore = smsData.has_more === true;
          skip += items.length;
          if (items.length === 0) break;
        }

        // 5. Diff: find bot messages not in Close
        // Match by content + direction (fuzzy timestamp within 60s)
        function isSynced(botMsg: {
          content: string;
          direction: string;
          createdAt: string;
        }): boolean {
          const botText = botMsg.content.trim();
          const botDir =
            botMsg.direction === "outbound" ? "outbound" : "inbound";
          const botTime = new Date(botMsg.createdAt).getTime();
          return existingSms.some((s) => {
            if (s.text !== botText) return false;
            if (s.direction !== botDir) return false;
            const closeTime = new Date(s.date_created).getTime();
            return Math.abs(botTime - closeTime) < 120_000; // 2min tolerance
          });
        }

        const toSync = allBotMessages.filter((m) => m.content && !isSynced(m));

        // 6. Create missing SMS activities in Close
        let synced = 0;
        let failed = 0;
        for (const msg of toSync) {
          const smsBody: Record<string, unknown> = {
            lead_id: closeLeadId,
            text: msg.content,
            direction: msg.direction === "outbound" ? "outbound" : "inbound",
            status: msg.direction === "outbound" ? "sent" : "inbox",
            date_created: msg.createdAt,
          };
          if (remotePhone) smsBody.remote_phone = remotePhone;
          if (localPhone) smsBody.local_phone = localPhone;

          try {
            const createRes = await fetch(`${CLOSE_BASE}/activity/sms/`, {
              method: "POST",
              headers: {
                Authorization: closeAuth,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(smsBody),
              signal: AbortSignal.timeout(10_000),
            });
            if (createRes.ok) {
              synced++;
            } else {
              failed++;
              const errText = await createRes.text().catch(() => "");
              console.error(
                `[sync_messages_to_close] Failed to create SMS activity: ${createRes.status}`,
                errText,
              );
            }
          } catch (e) {
            failed++;
            console.error("[sync_messages_to_close] Error creating SMS:", e);
          }

          // Rate limit protection: small delay between creates
          if (toSync.length > 10) {
            await new Promise((r) => setTimeout(r, 200));
          }
        }

        return jsonResponse({
          synced,
          failed,
          total: allBotMessages.length,
          alreadyInClose: allBotMessages.length - toSync.length,
          closeLeadId,
        });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("[chat-bot-api] Unhandled error:", err);

    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("CHAT_BOT_API_URL or CHAT_BOT_API_KEY not configured")
    ) {
      return jsonResponse(
        {
          error:
            "Chat bot service is not configured in this local edge environment.",
          serviceDown: true,
          message,
        },
        400,
      );
    }

    return jsonResponse(
      { error: "Internal server error", message },
      safeStatus(500),
    );
  }
});
