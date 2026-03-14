// supabase/functions/chat-bot-api/index.ts
// User-facing edge function — proxies chat bot management actions to standard-chat-bot external API.
// Auth: Bearer token (user JWT) → resolves user_id → looks up chat_bot_agents → proxies request.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// deno-lint-ignore no-explicit-any
function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Helper to call standard-chat-bot external API
async function callChatBotApi(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  // deno-lint-ignore no-explicit-any
): Promise<{ ok: boolean; status: number; data: any }> {
  const CHAT_BOT_API_URL = Deno.env.get("CHAT_BOT_API_URL");
  const CHAT_BOT_API_KEY = Deno.env.get("CHAT_BOT_API_KEY");

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
  const options: RequestInit = { method, headers };
  if (hasBody) {
    options.body = JSON.stringify(body || {});
  }

  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// Never return 5xx from edge function — Supabase runtime treats it as a crash (502 Bad Gateway).
function safeStatus(status: number): number {
  return status >= 500 ? 400 : status;
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
    payload: res.data?.data ?? res.data,
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

async function getTeamAccessStatus(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{
  profile: {
    first_name: string | null;
    last_name: string | null;
    hierarchy_path: string | null;
  } | null;
  isOnExemptTeam: boolean;
}> {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("first_name, last_name, hierarchy_path")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return { profile: null, isOnExemptTeam: false };
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // Parse body once upfront (avoids stream-consumed issues)
    const body = await req.json().catch(() => ({}));
    const { action, ...params } = body;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authenticate user via JWT (deploy WITHOUT --no-verify-jwt so the full token passes through)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s*/i, "").trim();
    if (!token) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    if (action === "get_team_access") {
      const { isOnExemptTeam } = await getTeamAccessStatus(supabase, user.id);
      return jsonResponse({ hasTeamAccess: isOnExemptTeam });
    }

    // ──────────────────────────────────────────────
    // TEAM PROVISION — must run BEFORE agent lookup (no agent row exists yet)
    // ──────────────────────────────────────────────
    if (action === "team_provision") {
      const { profile, isOnExemptTeam } = await getTeamAccessStatus(
        supabase,
        user.id,
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
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing?.provisioning_status === "active") {
        if (!existing.billing_exempt) {
          const upgradeRes = await callChatBotApi(
            "PATCH",
            `/api/external/agents/${existing.external_agent_id}`,
            { billingExempt: true },
          );

          if (!upgradeRes.ok) {
            console.error(
              `[chat-bot-api] Failed to upgrade agent ${existing.external_agent_id} to billing-exempt for user ${user.id}:`,
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
            upgradedToTeamAccess: true,
          });
        }

        return jsonResponse({
          success: true,
          agentId: existing.external_agent_id,
          alreadyProvisioned: true,
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
        { externalRef: user.id, name: agentName, billingExempt: true },
      );

      if (!provisionRes.ok) {
        console.error(
          `[chat-bot-api] team_provision failed for user ${user.id}:`,
          provisionRes.data,
        );
        await supabase.from("chat_bot_agents").upsert(
          {
            user_id: user.id,
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
          user_id: user.id,
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
        `[chat-bot-api] Team-provisioned agent ${newAgentId} for user ${user.id}`,
      );
      return jsonResponse({ success: true, agentId: newAgentId });
    }

    // Look up active chat bot agent for this user
    const { data: agent } = await supabase
      .from("chat_bot_agents")
      .select("external_agent_id, provisioning_status")
      .eq("user_id", user.id)
      .eq("provisioning_status", "active")
      .maybeSingle();

    if (!agent) {
      return jsonResponse({ error: "No active chat bot found" }, 404);
    }

    const agentId = agent.external_agent_id;

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
              .eq("user_id", user.id);
            console.log(
              `[chat-bot-api] Marked agent ${agentId} as failed (404 from external API) for user ${user.id}`,
            );
          }
          return jsonResponse(
            { error: errorMessage, ...(serviceDown && { serviceDown: true }) },
            status,
          );
        }

        // Transform: flatten agent + reshape connections
        const agentData = payload.agent || {};
        const closeConn = payload.connections?.close;
        const calendlyConn = payload.connections?.calendly;
        const googleConn = payload.connections?.google;

        return jsonResponse({
          id: agentData.id,
          name: agentData.name,
          botEnabled: agentData.botEnabled ?? false,
          timezone: agentData.timezone ?? "America/New_York",
          isActive: agentData.isActive ?? true,
          createdAt: agentData.createdAt,
          autoOutreachLeadSources: agentData.autoOutreachLeadSources || [],
          allowedLeadStatuses: agentData.allowedLeadStatuses || [],
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
          remindersEnabled: agentData.remindersEnabled ?? false,
          billingExempt: agentData.billingExempt ?? false,
          dailyMessageLimit: agentData.dailyMessageLimit ?? null,
          maxMessagesPerConversation:
            agentData.maxMessagesPerConversation ?? null,
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
        const res = await callChatBotApi(
          "PATCH",
          `/api/external/agents/${agentId}`,
          params,
        );
        return sendResult(res);
      }

      // ──────────────────────────────────────────────
      // CLOSE CRM CONNECTION
      // ──────────────────────────────────────────────
      case "connect_close": {
        const res = await callChatBotApi(
          "POST",
          `/api/external/agents/${agentId}/connections/close`,
          params,
        );
        return sendResult(res);
      }

      case "disconnect_close": {
        const res = await callChatBotApi(
          "DELETE",
          `/api/external/agents/${agentId}/connections/close`,
        );
        return sendResult(res);
      }

      case "get_close_status": {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agentId}/connections/close`,
        );
        if (!res.ok) {
          return jsonResponse({ connected: false });
        }
        const { payload } = unwrap(res);
        return jsonResponse({
          connected: true,
          orgName: payload?.orgId || undefined,
        });
      }

      // ──────────────────────────────────────────────
      // CALENDLY CONNECTION
      // ──────────────────────────────────────────────
      case "get_calendly_auth_url": {
        const returnUrl = params.returnUrl || "";
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
        if (!res.ok) {
          return jsonResponse({ connected: false });
        }
        const { payload } = unwrap(res);
        return jsonResponse({
          connected: true,
          eventType: payload?.calendarId ? "Connected" : undefined,
          userName: payload?.userName || undefined,
          userEmail: payload?.userEmail || undefined,
        });
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
        const returnUrl = params.returnUrl || "";
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
        if (!res.ok) {
          return jsonResponse({ connected: false });
        }
        const { payload } = unwrap(res);
        return jsonResponse({
          connected: true,
          calendarId: payload?.calendarId || undefined,
          userEmail: payload?.userEmail || undefined,
        });
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
        const pagination = meta?.pagination || {};
        return jsonResponse({
          data: Array.isArray(payload) ? payload : [],
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
          return jsonResponse(payload);
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
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (from) query = query.gte("created_at", from);
        if (to) query = query.lte("created_at", `${to}T23:59:59.999Z`);

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
        if (policy.user_id !== user.id) {
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
            user_id: user.id,
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
        if (!linkPolicy || linkPolicy.user_id !== user.id) {
          return jsonResponse({ error: "Forbidden" }, 403);
        }

        const { error: insertErr } = await supabase
          .from("bot_policy_attributions")
          .upsert(
            {
              policy_id: policyId,
              user_id: user.id,
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
          .eq("user_id", user.id);

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

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("[chat-bot-api] Unhandled error:", err);
    return jsonResponse(
      { error: "Internal server error", message: String(err) },
      safeStatus(500),
    );
  }
});
