// supabase/functions/get-team-call-stats/index.ts
//
// Daily call monitoring for the Close KPIs Team tab.
//
// For each agent the caller is authorized to monitor (super-admin → all
// connected users; otherwise → caller + downlines via hierarchy_path), this
// function fetches the agent's Close call activity in the requested date
// range and aggregates per-agent dial/connect/talk-time stats.
//
// Pattern mirror:
//   - Auth + member resolution: calls get_team_member_ids() RPC (security
//     definer, hierarchy_path-aware), so the access boundary is enforced at
//     the database layer, not in this edge function.
//   - Per-agent fan-out + decrypt: same shape as close-lead-heat-score's
//     handleScoreAllUsers (reads close_config, decrypts api_key_encrypted,
//     concurrency batches of 3 to stay under Close API rate limits).
//   - Date-range queries: same `date_created__gte/lte` Close API pattern as
//     close-kpi-data/fetchActivityGroups.
//
// Why an edge function instead of an SQL aggregation:
//   - lead_heat_scores.signals stores PER-LEAD frozen counts, not time-series
//     call records. There is no SQL way to ask "calls on April 6 by agent X"
//     from existing tables. The authoritative source is the Close API itself.
//   - Each agent has their own Close account with their own API key. To
//     aggregate across a team, we MUST fan out per-agent — no single API key
//     sees the team's data.
//   - Persisting daily rollups in a new table is the long-term option but
//     would need backfill + a new cron. Live fan-out ships today, gives
//     real-time data for any date range, and matches the existing pattern.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// ─── Types ────────────────────────────────────────────────────────────

interface RequestBody {
  from: string; // ISO 8601 timestamp (frontend computes from preset + tz)
  to: string; // ISO 8601 timestamp (inclusive end)
}

interface CloseCall {
  id: string;
  lead_id: string;
  direction?: string; // "outbound" | "outgoing" | "inbound" | "incoming"
  duration?: number; // seconds
  disposition?: string; // "answered" | "no-answer" | "busy" | "vm-answer" | ...
  date_created: string;
}

interface TeamCallStatsRow {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePhotoUrl: string | null;
  isSelf: boolean;
  dials: number;
  connects: number;
  connectRate: number | null;
  talkTimeSeconds: number;
  voicemails: number;
  lastCallAt: string | null;
  error: string | null;
}

interface ResponseBody {
  from: string;
  to: string;
  rows: TeamCallStatsRow[];
}

// ─── Constants ────────────────────────────────────────────────────────

const CONCURRENCY_LIMIT = 3;
const CALLS_PER_PAGE = 100;
const MAX_PAGES_PER_AGENT = 50; // 5,000 calls per agent in the requested window — sane cap

// ─── Close API helper ─────────────────────────────────────────────────

async function fetchCallsForAgent(
  apiKey: string,
  from: string,
  to: string,
): Promise<CloseCall[]> {
  // Close API uses HTTP Basic auth with the API key as username and empty password.
  const authHeader = "Basic " + btoa(`${apiKey}:`);
  const all: CloseCall[] = [];
  let skip = 0;
  let page = 0;

  while (page < MAX_PAGES_PER_AGENT) {
    const qs = new URLSearchParams({
      _limit: String(CALLS_PER_PAGE),
      _skip: String(skip),
      _fields: "id,lead_id,direction,duration,disposition,date_created",
      date_created__gte: from,
      date_created__lte: to,
    });

    const res = await fetch(
      `https://api.close.com/api/v1/activity/call/?${qs.toString()}`,
      {
        headers: { Authorization: authHeader },
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Close API ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      data: CloseCall[];
      has_more?: boolean;
    };
    all.push(...(json.data ?? []));

    if (!json.has_more || (json.data?.length ?? 0) < CALLS_PER_PAGE) break;
    skip += CALLS_PER_PAGE;
    page += 1;
  }

  return all;
}

// ─── Aggregation ──────────────────────────────────────────────────────

function isOutbound(direction?: string): boolean {
  return direction === "outbound" || direction === "outgoing";
}

function aggregateCalls(calls: CloseCall[]): {
  dials: number;
  connects: number;
  talkTimeSeconds: number;
  voicemails: number;
  lastCallAt: string | null;
} {
  let dials = 0;
  let connects = 0;
  let talkTimeSeconds = 0;
  let voicemails = 0;
  let lastCallAt: string | null = null;

  for (const c of calls) {
    if (!isOutbound(c.direction)) continue;
    dials += 1;
    if (c.disposition === "answered") {
      connects += 1;
      talkTimeSeconds += c.duration ?? 0;
    } else if (c.disposition === "vm-answer") {
      voicemails += 1;
    }
    if (lastCallAt === null || c.date_created > lastCallAt) {
      lastCallAt = c.date_created;
    }
  }

  return { dials, connects, talkTimeSeconds, voicemails, lastCallAt };
}

// ─── Main handler ─────────────────────────────────────────────────────

serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    // ── 1. Auth: get caller's JWT ─────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing bearer token" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── 2. Parse body ─────────────────────────────────────────────────
    const body = (await req.json()) as RequestBody;
    if (!body.from || !body.to) {
      return new Response(
        JSON.stringify({ error: "from and to (ISO timestamps) are required" }),
        {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    // ── 3. Resolve team member set via the user-context RPC ──────────
    // Using the caller's JWT means get_team_member_ids() sees auth.uid() as
    // the actual caller and applies hierarchy_path access checks. This is
    // the security boundary — non-uplines get an empty array.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: memberIds, error: memberErr } = await userClient.rpc(
      "get_team_member_ids",
    );

    if (memberErr) {
      return new Response(
        JSON.stringify({
          error: `get_team_member_ids failed: ${memberErr.message}`,
        }),
        {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const teamUuids: string[] = (memberIds as string[] | null) ?? [];

    if (teamUuids.length === 0) {
      const empty: ResponseBody = { from: body.from, to: body.to, rows: [] };
      return new Response(JSON.stringify(empty), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── 4. Identify caller (for is_self flag) ────────────────────────
    const { data: callerData } = await userClient.auth.getUser();
    const callerId = callerData?.user?.id ?? null;

    // ── 5. Read encrypted keys + profile data via service role ───────
    // Service-role bypasses RLS (lead-heat cron uses the same pattern). The
    // teamUuids are already filtered to authorized agents via the user-context
    // RPC above, so this is not a privilege escalation — we're only reading
    // data the caller is already entitled to monitor.
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [
      { data: configs, error: cfgErr },
      { data: profiles, error: profErr },
    ] = await Promise.all([
      adminClient
        .from("close_config")
        .select("user_id, api_key_encrypted")
        .in("user_id", teamUuids)
        .eq("is_active", true),
      adminClient
        .from("user_profiles")
        .select("id, first_name, last_name, email, profile_photo_url")
        .in("id", teamUuids),
    ]);

    if (cfgErr || profErr) {
      return new Response(
        JSON.stringify({
          error: `lookup failed: ${cfgErr?.message ?? profErr?.message}`,
        }),
        {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const profileById = new Map(
      (profiles ?? []).map((p) => [
        p.id as string,
        {
          firstName: (p.first_name as string | null) ?? null,
          lastName: (p.last_name as string | null) ?? null,
          email: p.email as string,
          profilePhotoUrl: (p.profile_photo_url as string | null) ?? null,
        },
      ]),
    );

    // ── 6. Fan out: fetch + aggregate per agent in batches of 3 ──────
    const rows: TeamCallStatsRow[] = [];
    const configList = configs ?? [];

    for (let i = 0; i < configList.length; i += CONCURRENCY_LIMIT) {
      const batch = configList.slice(i, i + CONCURRENCY_LIMIT);
      const batchRows = await Promise.all(
        batch.map(async (cfg): Promise<TeamCallStatsRow> => {
          const userId = cfg.user_id as string;
          const profile = profileById.get(userId) ?? {
            firstName: null,
            lastName: null,
            email: "",
            profilePhotoUrl: null,
          };
          const baseRow: TeamCallStatsRow = {
            userId,
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
            profilePhotoUrl: profile.profilePhotoUrl,
            isSelf: userId === callerId,
            dials: 0,
            connects: 0,
            connectRate: null,
            talkTimeSeconds: 0,
            voicemails: 0,
            lastCallAt: null,
            error: null,
          };

          try {
            const apiKey = await decrypt(cfg.api_key_encrypted as string);
            const calls = await fetchCallsForAgent(apiKey, body.from, body.to);
            const agg = aggregateCalls(calls);
            return {
              ...baseRow,
              dials: agg.dials,
              connects: agg.connects,
              connectRate: agg.dials > 0 ? agg.connects / agg.dials : null,
              talkTimeSeconds: agg.talkTimeSeconds,
              voicemails: agg.voicemails,
              lastCallAt: agg.lastCallAt,
            };
          } catch (err) {
            console.error(
              `[get-team-call-stats] failed for user ${userId}:`,
              (err as Error).message,
            );
            return { ...baseRow, error: (err as Error).message };
          }
        }),
      );
      rows.push(...batchRows);
    }

    // Add empty rows for any team member who doesn't have an active close_config
    // (so the table still shows them as "not connected"). Only matters when the
    // RPC returned a UUID but close_config got deactivated between the RPC call
    // and the close_config select.
    const seen = new Set(rows.map((r) => r.userId));
    for (const uuid of teamUuids) {
      if (seen.has(uuid)) continue;
      const profile = profileById.get(uuid);
      if (!profile) continue;
      rows.push({
        userId: uuid,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        profilePhotoUrl: profile.profilePhotoUrl,
        isSelf: uuid === callerId,
        dials: 0,
        connects: 0,
        connectRate: null,
        talkTimeSeconds: 0,
        voicemails: 0,
        lastCallAt: null,
        error: "Close not connected",
      });
    }

    // Pin self to top, then sort by dials desc
    rows.sort((a, b) => {
      if (a.isSelf && !b.isSelf) return -1;
      if (!a.isSelf && b.isSelf) return 1;
      return b.dials - a.dials;
    });

    const response: ResponseBody = {
      from: body.from,
      to: body.to,
      rows,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[get-team-call-stats] unexpected error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "unknown error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
