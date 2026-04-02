// supabase/functions/team-appointments/index.ts
// Authenticated edge function — returns appointment data for all downline agents.
// Used by "Team Appts" tab to monitor daily bot-booked appointments across the team.
// Requires JWT auth — only returns data for the caller's verified downline.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

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
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const isLocal =
    Deno.env.get("ENVIRONMENT") === "local" ||
    supabaseUrl.includes("127.0.0.1") ||
    supabaseUrl.includes("localhost") ||
    supabaseUrl.includes("kong") ||
    !!Deno.env.get("REMOTE_SUPABASE_URL");
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

// deno-lint-ignore no-explicit-any
function jsonResponse(data: any, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// --- External API helper (same pattern as chat-bot-api) ---

async function callChatBotApi(
  method: string,
  path: string,
): Promise<{ ok: boolean; status: number; data: unknown }> {
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      method,
      headers: { "X-API-Key": CHAT_BOT_API_KEY },
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

// --- Appointment normalization (same logic as chat-bot-api) ---

interface NormalizedAppointment {
  id: string;
  leadName: string;
  scheduledAt: string | null;
  endAt: string | null;
  status: string;
  source: string | null;
  createdAt: string | null;
}

// deno-lint-ignore no-explicit-any
function normalizeAppointment(item: any): NormalizedAppointment {
  const rawStatus = (item.status || item.event_status || "").toLowerCase();
  let status: string;
  switch (rawStatus) {
    case "confirmed":
    case "active":
    case "pending":
      status = "scheduled";
      break;
    case "completed":
    case "done":
      status = "completed";
      break;
    case "cancelled":
    case "canceled":
      status = "cancelled";
      break;
    case "no_show":
    case "no-show":
    case "noshow":
      status = "no_show";
      break;
    default:
      status = rawStatus || "scheduled";
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
    endAt: item.endAt || item.end_at || item.end_time || null,
    status,
    source: item.source || null,
    createdAt:
      item.createdAt ||
      item.created_at ||
      item.booked_at ||
      item.bookedAt ||
      null,
  };
}

// --- Date helpers ---

function getStartOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start of week
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function isSameDay(isoStr: string | null, dateStr: string): boolean {
  if (!isoStr) return false;
  return isoStr.slice(0, 10) === dateStr;
}

function isInRange(isoStr: string | null, from: string, to: string): boolean {
  if (!isoStr) return false;
  const d = isoStr.slice(0, 10);
  return d >= from && d <= to;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, req);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const today = body.date || new Date().toISOString().slice(0, 10);
    const weekStart = getStartOfWeek(today);

    // ── Two-client pattern (same as chat-bot-api) ──
    const LOCAL_SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const LOCAL_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;
    const REMOTE_URL = Deno.env.get("REMOTE_SUPABASE_URL");
    const REMOTE_KEY = Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY");

    // Auth client — validates JWTs against local Supabase
    const authClient = createClient(
      LOCAL_SUPABASE_URL,
      LOCAL_SUPABASE_SERVICE_ROLE_KEY,
    );
    // Data client — queries production DB (remote when available)
    const supabase =
      REMOTE_URL && REMOTE_KEY
        ? createClient(REMOTE_URL, REMOTE_KEY)
        : authClient;

    // ── Authenticate ──
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s*/i, "").trim();
    if (!token) {
      return jsonResponse({ error: "Unauthorized" }, 401, req);
    }

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401, req);
    }

    const callerId = user.id;

    // ── Get caller's hierarchy path ──
    const { data: callerProfile } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, hierarchy_path")
      .eq("id", callerId)
      .maybeSingle();

    if (!callerProfile) {
      return jsonResponse({ error: "User profile not found" }, 404, req);
    }

    const callerPath = callerProfile.hierarchy_path || callerId;

    // ── Find all downline agents with active bots ──
    // hierarchy_path LIKE 'callerPath.%' matches all descendants
    const { data: downlineAgents, error: downlineError } = await supabase
      .from("user_profiles")
      .select(
        "id, first_name, last_name, chat_bot_agents!inner(external_agent_id, provisioning_status)",
      )
      .like("hierarchy_path", `${callerPath}.%`)
      .eq("chat_bot_agents.provisioning_status", "active");

    if (downlineError) {
      console.error("[team-appointments] downline query error:", downlineError);
      return jsonResponse({ error: "Failed to fetch team data" }, 500, req);
    }

    // Also include the caller themselves if they have an active bot
    const { data: callerAgent } = await supabase
      .from("chat_bot_agents")
      .select("external_agent_id, provisioning_status")
      .eq("user_id", callerId)
      .eq("provisioning_status", "active")
      .maybeSingle();

    interface AgentInfo {
      userId: string;
      name: string;
      externalAgentId: string;
    }

    const agents: AgentInfo[] = [];

    if (callerAgent) {
      agents.push({
        userId: callerId,
        name:
          [callerProfile.first_name, callerProfile.last_name]
            .filter(Boolean)
            .join(" ") || "You",
        externalAgentId: callerAgent.external_agent_id,
      });
    }

    for (const profile of downlineAgents || []) {
      // deno-lint-ignore no-explicit-any
      const botAgent = (profile as any).chat_bot_agents;
      // Inner join returns array or single object
      const agentData = Array.isArray(botAgent) ? botAgent[0] : botAgent;
      if (agentData?.external_agent_id) {
        agents.push({
          userId: profile.id,
          name:
            [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
            "Agent",
          externalAgentId: agentData.external_agent_id,
        });
      }
    }

    if (agents.length === 0) {
      return jsonResponse(
        {
          agents: [],
          summary: { totalAgents: 0, todayTotal: 0, thisWeekTotal: 0 },
        },
        200,
        req,
      );
    }

    // ── Fan out: fetch appointments for all agents in parallel ──
    const errors: string[] = [];

    const results = await Promise.allSettled(
      agents.map(async (agent) => {
        const res = await callChatBotApi(
          "GET",
          `/api/external/agents/${agent.externalAgentId}/appointments?page=1&limit=200`,
        );
        if (!res.ok) {
          throw new Error(
            `API returned ${res.status} for agent ${agent.userId}`,
          );
        }
        // deno-lint-ignore no-explicit-any
        const resData = res.data as any;
        const payload = resData?.data ?? resData;
        // deno-lint-ignore no-explicit-any
        const rawItems: any[] = Array.isArray(payload) ? payload : [];
        return {
          agent,
          appointments: rawItems.map(normalizeAppointment),
        };
      }),
    );

    // ── Aggregate results ──
    interface AgentResult {
      userId: string;
      name: string;
      today: number;
      thisWeek: number;
      byStatus: {
        scheduled: number;
        completed: number;
        cancelled: number;
        noShow: number;
      };
      items: NormalizedAppointment[];
    }

    const agentResults: AgentResult[] = [];
    let todayTotal = 0;
    let thisWeekTotal = 0;

    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[team-appointments] fetch failed:", result.reason);
        errors.push(String(result.reason));
        continue;
      }

      const { agent, appointments } = result.value;

      // Filter to this week's appointments (by scheduledAt)
      const weekAppts = appointments.filter((a) =>
        isInRange(a.scheduledAt, weekStart, today),
      );
      const todayAppts = appointments.filter((a) =>
        isSameDay(a.scheduledAt, today),
      );

      const byStatus = { scheduled: 0, completed: 0, cancelled: 0, noShow: 0 };
      for (const a of weekAppts) {
        if (a.status === "scheduled") byStatus.scheduled++;
        else if (a.status === "completed") byStatus.completed++;
        else if (a.status === "cancelled") byStatus.cancelled++;
        else if (a.status === "no_show") byStatus.noShow++;
      }

      todayTotal += todayAppts.length;
      thisWeekTotal += weekAppts.length;

      agentResults.push({
        userId: agent.userId,
        name: agent.name,
        today: todayAppts.length,
        thisWeek: weekAppts.length,
        byStatus,
        items: weekAppts,
      });
    }

    // Sort by today's count desc, then this week desc
    agentResults.sort((a, b) => b.today - a.today || b.thisWeek - a.thisWeek);

    return jsonResponse(
      {
        agents: agentResults,
        summary: {
          totalAgents: agentResults.length,
          todayTotal,
          thisWeekTotal,
        },
        ...(errors.length > 0 ? { errors } : {}),
      },
      200,
      req,
    );
  } catch (err) {
    console.error("[team-appointments] Error:", err);
    return jsonResponse({ error: "Internal server error" }, 500, req);
  }
});
