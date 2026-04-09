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

// --- Security helpers ---

function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, "\\$&");
}

function isValidDateStr(d: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    !isNaN(new Date(d + "T00:00:00Z").getTime())
  );
}

// --- External API helper ---

// Appointments endpoint only supports page/limit (no date filter). Max limit = 100
// per docs/external-api-reference.md:938. We paginate fully so aggregate counts
// (today/week) are correct regardless of the API's default sort order.
const APPT_PAGE_LIMIT = 100;
const APPT_MAX_PAGES = 10; // Hard ceiling: 1000 appts per agent
const APPT_FETCH_TIMEOUT_MS = 15_000;

function getChatBotApiConfig(): { url: string; key: string } | null {
  const url =
    Deno.env.get("STANDARD_CHAT_BOT_API_URL") ||
    Deno.env.get("CHAT_BOT_API_URL");
  const key =
    Deno.env.get("STANDARD_CHAT_BOT_EXTERNAL_API_KEY") ||
    Deno.env.get("CHAT_BOT_API_KEY");
  if (!url || !key) return null;
  return { url, key };
}

interface AppointmentPageResult {
  ok: boolean;
  items: NormalizedAppointment[];
  totalPages: number; // 0 if unknown
  error?: string;
}

async function fetchAppointmentsPage(
  apiConfig: { url: string; key: string },
  externalAgentId: string,
  page: number,
  signal: AbortSignal,
): Promise<AppointmentPageResult> {
  const res = await fetch(
    `${apiConfig.url}/api/external/agents/${encodeURIComponent(
      externalAgentId,
    )}/appointments?page=${page}&limit=${APPT_PAGE_LIMIT}`,
    {
      method: "GET",
      headers: { "X-API-Key": apiConfig.key },
      signal,
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // deno-lint-ignore no-explicit-any
    const errMsg =
      (data as any)?.error?.message ||
      (data as any)?.error ||
      (data as any)?.message ||
      JSON.stringify(data).slice(0, 200);
    return {
      ok: false,
      items: [],
      totalPages: 0,
      error: `HTTP ${res.status}: ${errMsg}`,
    };
  }
  // deno-lint-ignore no-explicit-any
  const body: any = data;
  // Standard envelope: { success, data: [...], meta: { pagination: {...} } }
  // deno-lint-ignore no-explicit-any
  const rawItems: any[] = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(body)
      ? body
      : [];
  const pagination = body?.meta?.pagination ?? {};
  let totalPages: number = 0;
  if (typeof pagination.totalPages === "number") {
    totalPages = pagination.totalPages;
  } else if (typeof pagination.totalItems === "number") {
    totalPages = Math.max(
      1,
      Math.ceil(pagination.totalItems / APPT_PAGE_LIMIT),
    );
  } else if (pagination.hasNext === true) {
    totalPages = page + 1; // Minimum; we'll keep probing if needed
  } else {
    totalPages = page; // Treat this as the last page
  }
  return {
    ok: true,
    items: rawItems.map(normalizeAppointment),
    totalPages,
  };
}

async function fetchAgentAppointments(
  apiConfig: { url: string; key: string },
  externalAgentId: string,
): Promise<{
  ok: boolean;
  items: NormalizedAppointment[];
  error?: string;
  capped?: boolean;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), APPT_FETCH_TIMEOUT_MS);

  try {
    // Fetch page 1 first to discover totalPages.
    const firstPage = await fetchAppointmentsPage(
      apiConfig,
      externalAgentId,
      1,
      controller.signal,
    );
    if (!firstPage.ok) {
      return { ok: false, items: [], error: firstPage.error };
    }

    const discoveredTotal = firstPage.totalPages || 1;
    const lastPageToFetch = Math.min(discoveredTotal, APPT_MAX_PAGES);
    const capped = discoveredTotal > APPT_MAX_PAGES;

    if (lastPageToFetch <= 1) {
      return {
        ok: true,
        items: firstPage.items,
        ...(capped ? { capped } : {}),
      };
    }

    // Fetch pages 2..lastPageToFetch in parallel.
    const pagePromises: Promise<AppointmentPageResult>[] = [];
    for (let p = 2; p <= lastPageToFetch; p++) {
      pagePromises.push(
        fetchAppointmentsPage(apiConfig, externalAgentId, p, controller.signal),
      );
    }
    const remaining = await Promise.all(pagePromises);
    const failed = remaining.find((r) => !r.ok);
    if (failed) {
      // Any page failure → treat the agent as errored so we don't display
      // partial data silently. The caller already handles fetchError gracefully.
      return {
        ok: false,
        items: [],
        error: failed.error ?? "Unknown page fetch error",
      };
    }

    const allItems = firstPage.items.concat(...remaining.map((r) => r.items));
    return {
      ok: true,
      items: allItems,
      ...(capped ? { capped } : {}),
    };
  } catch (err) {
    return { ok: false, items: [], error: String(err) };
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
//
// All date math here operates on YYYY-MM-DD strings ("calendar dates") and
// interprets appointment timestamps in the caller's IANA timezone so that
// a 9pm-EST appointment (whose UTC ISO rolls into the next day) is still
// counted as "today" for the EST user viewing the dashboard.

function validateTimezone(tz: unknown): string | null {
  if (typeof tz !== "string" || tz.length === 0) return null;
  try {
    // Throws RangeError for invalid IANA identifiers.
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

// Returns YYYY-MM-DD for `date` interpreted in `timeZone`.
// en-CA locale natively yields ISO-style YYYY-MM-DD output.
function formatLocalDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Converts an ISO (UTC) appointment timestamp to YYYY-MM-DD in the caller's TZ.
function isoToLocalDate(
  isoStr: string | null,
  timeZone: string,
): string | null {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return null;
  return formatLocalDate(d, timeZone);
}

// Calendar-date arithmetic on YYYY-MM-DD strings (timezone-agnostic).
function getStartOfWeek(dateStr: string): string {
  // Parse using UTC to keep the math pure — we treat dateStr as a calendar date.
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start of week
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function getEndOfWeek(dateStr: string): string {
  // End of week = start of week + 6 days (Sunday).
  const start = new Date(getStartOfWeek(dateStr) + "T00:00:00Z");
  start.setUTCDate(start.getUTCDate() + 6);
  return start.toISOString().slice(0, 10);
}

function isSameLocalDay(
  isoStr: string | null,
  dateStr: string,
  timeZone: string,
): boolean {
  const local = isoToLocalDate(isoStr, timeZone);
  return local !== null && local === dateStr;
}

function isInLocalRange(
  isoStr: string | null,
  from: string,
  to: string,
  timeZone: string,
): boolean {
  const local = isoToLocalDate(isoStr, timeZone);
  if (local === null) return false;
  return local >= from && local <= to;
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
    const rawDate = typeof body.date === "string" ? body.date : "";
    const tz = validateTimezone(body.timezone) ?? "UTC";
    if (body.timezone && tz === "UTC" && body.timezone !== "UTC") {
      console.warn(
        "[team-appointments] invalid timezone from client, falling back to UTC:",
        body.timezone,
      );
    }
    const today = isValidDateStr(rawDate)
      ? rawDate
      : formatLocalDate(new Date(), tz);
    const weekStart = getStartOfWeek(today);
    const weekEnd = getEndOfWeek(today);

    // ── Two-client pattern (same as chat-bot-api) ──
    const LOCAL_SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const LOCAL_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;
    const REMOTE_URL = Deno.env.get("REMOTE_SUPABASE_URL");
    const REMOTE_KEY = Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY");

    const authClient = createClient(
      LOCAL_SUPABASE_URL,
      LOCAL_SUPABASE_SERVICE_ROLE_KEY,
    );
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
      console.error("[team-appointments] auth failed:", authError?.message);
      return jsonResponse({ error: "Unauthorized" }, 401, req);
    }

    const callerId = user.id;

    // ── Get caller's hierarchy path ──
    const { data: callerProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, hierarchy_path")
      .eq("id", callerId)
      .maybeSingle();

    if (profileError || !callerProfile) {
      console.error(
        "[team-appointments] profile lookup failed:",
        profileError?.message,
        "callerId:",
        callerId,
      );
      return jsonResponse({ error: "User profile not found" }, 404, req);
    }

    const callerPath = callerProfile.hierarchy_path || callerId;
    const escapedPath = escapeLikePattern(callerPath);

    // ── Step 1: Find all downline user profiles (capped at 100) ──
    const { data: downlineProfiles, error: downlineError } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name")
      .like("hierarchy_path", `${escapedPath}.%`)
      .limit(100);

    if (downlineError) {
      console.error("[team-appointments] downline query error:", downlineError);
      return jsonResponse({ error: "Failed to fetch team data" }, 500, req);
    }

    const allUserIds = [
      callerId,
      ...(downlineProfiles || []).map((p: { id: string }) => p.id),
    ];

    // ── Step 2: Find active bot agents for all these users ──
    const { data: botAgents, error: botError } = await supabase
      .from("chat_bot_agents")
      .select("user_id, external_agent_id")
      .in("user_id", allUserIds)
      .eq("provisioning_status", "active");

    if (botError) {
      console.error("[team-appointments] bot agents query error:", botError);
      return jsonResponse({ error: "Failed to fetch bot data" }, 500, req);
    }

    // ── Step 3: Build agent list ──
    const botAgentMap = new Map<string, string>(
      (botAgents || []).map(
        (a: { user_id: string; external_agent_id: string }) => [
          a.user_id,
          a.external_agent_id,
        ],
      ),
    );

    const profileMap = new Map<
      string,
      { firstName: string; lastName: string }
    >();
    profileMap.set(callerId, {
      firstName: callerProfile.first_name || "",
      lastName: callerProfile.last_name || "",
    });
    for (const p of downlineProfiles || []) {
      profileMap.set(p.id, {
        firstName: p.first_name || "",
        lastName: p.last_name || "",
      });
    }

    interface AgentInfo {
      userId: string;
      name: string;
      externalAgentId: string;
    }

    const agents: AgentInfo[] = [];
    for (const [userId, externalAgentId] of botAgentMap) {
      const profile = profileMap.get(userId);
      if (!profile) continue;
      agents.push({
        userId,
        name:
          [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
          "Agent",
        externalAgentId,
      });
    }

    if (agents.length === 0) {
      console.error(
        "[team-appointments] no agents found — downlines:",
        (downlineProfiles || []).length,
        "botAgents:",
        (botAgents || []).length,
      );
      return jsonResponse(
        {
          agents: [],
          summary: { totalAgents: 0, todayTotal: 0, thisWeekTotal: 0 },
        },
        200,
        req,
      );
    }

    // ── Step 4: Fetch appointments — agents ALWAYS appear even if fetch fails ──
    const apiConfig = getChatBotApiConfig();
    if (!apiConfig) {
      // External API not configured — return agents with zero appointments
      console.error(
        "[team-appointments] CHAT_BOT_API_URL or API_KEY not configured",
      );
      return jsonResponse(
        {
          agents: agents.map((a) => ({
            userId: a.userId,
            name: a.name,
            today: 0,
            thisWeek: 0,
            byStatus: { scheduled: 0, completed: 0, cancelled: 0, noShow: 0 },
            items: [],
            fetchError: "Bot API not configured",
          })),
          summary: {
            totalAgents: agents.length,
            todayTotal: 0,
            thisWeekTotal: 0,
          },
          errors: ["External bot API not configured"],
        },
        200,
        req,
      );
    }

    // Fan out — every agent gets a row regardless of fetch success
    const results = await Promise.allSettled(
      agents.map((agent) =>
        fetchAgentAppointments(apiConfig, agent.externalAgentId),
      ),
    );

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
      fetchError?: string;
    }

    const agentResults: AgentResult[] = [];
    const errors: string[] = [];
    let todayTotal = 0;
    let thisWeekTotal = 0;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const result = results[i];

      // Default: agent appears with zero counts
      let appointments: NormalizedAppointment[] = [];
      let fetchError: string | undefined;

      if (result.status === "rejected") {
        fetchError = String(result.reason);
        errors.push(`${agent.name}: ${fetchError}`);
        console.error(
          `[team-appointments] fetch failed for ${agent.name}:`,
          result.reason,
        );
      } else if (!result.value.ok) {
        fetchError = result.value.error || "Unknown error";
        errors.push(`${agent.name}: ${fetchError}`);
        console.error(
          `[team-appointments] API error for ${agent.name}:`,
          fetchError,
        );
      } else {
        appointments = result.value.items;
        if (result.value.capped) {
          fetchError = `Over ${APPT_MAX_PAGES * APPT_PAGE_LIMIT} appointments — counts may be incomplete`;
          errors.push(`${agent.name}: ${fetchError}`);
          console.warn(`[team-appointments] page cap hit for ${agent.name}`);
        }
      }

      const weekAppts = appointments.filter((a) =>
        isInLocalRange(a.scheduledAt, weekStart, weekEnd, tz),
      );
      const todayAppts = appointments.filter((a) =>
        isSameLocalDay(a.scheduledAt, today, tz),
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
        ...(fetchError ? { fetchError } : {}),
      });
    }

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
    console.error("[team-appointments] Unhandled error:", err);
    return jsonResponse({ error: "Internal server error" }, 500, req);
  }
});
