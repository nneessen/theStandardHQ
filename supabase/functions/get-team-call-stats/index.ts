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
// Hardening (V2 review remediation):
//   - Per-call AbortController timeout (10s) so a single slow Close API
//     response can't hang the whole batch and trip the edge function's
//     hard timeout.
//   - In-memory per-user response cache with 60s TTL to mitigate DoS via
//     Close API quota exhaustion. Hot V8 isolates absorb spam requests
//     without re-fetching from Close.
//   - `truncated` boolean per row when the pagination cap is hit, so the
//     UI can warn the user that the count is incomplete.
//   - 401 instead of 500 for auth-related RPC errors.
//   - Local JWT sub decode instead of round-tripping to /auth/v1/user.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { aggregateCalls, type CloseCall } from "./aggregate.ts";

// ─── Types ────────────────────────────────────────────────────────────

interface RequestBody {
  from: string; // ISO 8601 timestamp (frontend computes from preset + tz)
  to: string; // ISO 8601 timestamp (inclusive end)
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
  /** ISO 8601 timestamp of the most recent OUTBOUND dial. */
  lastDialAt: string | null;
  /** True when pagination cap was hit — agent has more calls than the response includes. */
  truncated: boolean;
  /** Per-agent error so one bad API key doesn't break the batch. */
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
const MAX_PAGES_PER_AGENT = 50; // 5,000 calls per agent in the requested window
const PER_FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 200;

// ─── In-memory response cache ─────────────────────────────────────────
//
// Keyed by `${callerId}|${from}|${to}`. Hot V8 isolates persist this Map
// across requests; cold starts get an empty cache (which is fine — the
// next legitimate request just populates it). 60s TTL matches the
// frontend's TanStack Query staleTime.
//
// LRU-ish eviction: when we exceed CACHE_MAX_ENTRIES, drop the oldest by
// insertion order (Map preserves insertion order in JS).

interface CacheEntry {
  body: ResponseBody;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();

function cacheGet(key: string): ResponseBody | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    responseCache.delete(key);
    return null;
  }
  // LRU touch — re-insert to move to end
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.body;
}

function cacheSet(key: string, body: ResponseBody): void {
  responseCache.set(key, { body, expiresAt: Date.now() + CACHE_TTL_MS });
  // Evict oldest entries beyond the cap
  while (responseCache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey === undefined) break;
    responseCache.delete(oldestKey);
  }
}

// ─── JWT helper ────────────────────────────────────────────────────────
//
// Decodes the `sub` claim from the Authorization header WITHOUT validating
// the signature. The Supabase Functions gateway has already validated the
// JWT before our code runs, so we trust the signature; we just need the
// subject UUID for the is_self flag and the cache key.

function decodeJwtSub(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // JWT uses base64url encoding — replace url-safe chars before atob
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

// ─── Close API helper ─────────────────────────────────────────────────

interface FetchCallsResult {
  calls: CloseCall[];
  truncated: boolean;
}

async function fetchCallsForAgent(
  apiKey: string,
  from: string,
  to: string,
): Promise<FetchCallsResult> {
  // Close API uses HTTP Basic auth with the API key as username and empty password.
  const authHeader = "Basic " + btoa(`${apiKey}:`);
  const all: CloseCall[] = [];
  let skip = 0;
  let page = 0;
  let truncated = false;

  while (page < MAX_PAGES_PER_AGENT) {
    const qs = new URLSearchParams({
      _limit: String(CALLS_PER_PAGE),
      _skip: String(skip),
      _fields: "id,lead_id,direction,duration,disposition,date_created",
      date_created__gte: from,
      date_created__lte: to,
    });

    // Per-fetch timeout. Without this, a hung Close API call would keep the
    // entire concurrency batch waiting until the edge function's hard 60s
    // limit, then ALL agents in the batch would error. With it, only the
    // slow agent errors and the others continue normally.
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      PER_FETCH_TIMEOUT_MS,
    );

    let res: Response;
    try {
      res = await fetch(
        `https://api.close.com/api/v1/activity/call/?${qs.toString()}`,
        { headers: { Authorization: authHeader }, signal: controller.signal },
      );
    } catch (err) {
      const isAbort = (err as Error)?.name === "AbortError";
      throw new Error(
        isAbort
          ? `Close API timeout after ${PER_FETCH_TIMEOUT_MS}ms`
          : `Close API fetch failed: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }

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

  // If we exited the loop because we hit MAX_PAGES_PER_AGENT (not because
  // has_more was false), the agent has more calls than we fetched.
  if (page >= MAX_PAGES_PER_AGENT) {
    truncated = true;
  }

  return { calls: all, truncated };
}

// ─── Auth-error classification ────────────────────────────────────────
//
// PostgREST returns auth errors with PGRST301 (JWT expired) or PGRST302
// (JWT invalid). The error message often includes "JWT" or "permission".
// Treat any of these as 401 instead of 500 so clients can re-auth cleanly.

function isAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("jwt") ||
    lower.includes("not authenticated") ||
    lower.includes("authentication") ||
    lower.includes("pgrst301") ||
    lower.includes("pgrst302")
  );
}

// ─── Main handler ─────────────────────────────────────────────────────

// ─── Structured logging helpers ───────────────────────────────────────
//
// Every request gets an 8-char request ID. All logs from a single request
// are prefixed `[get-team-call-stats][rid][caller]` so Supabase log triage
// can correlate "Agent X has zero dials" reports back to specific requests.

function makeRequestId(): string {
  // 8 hex chars from a random Uint8 array — short enough to scan, long
  // enough to disambiguate concurrent requests within a busy minute.
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function makeLogger(rid: string, callerId: string | null) {
  const prefix = `[get-team-call-stats][${rid}][${callerId ?? "anon"}]`;
  return {
    info: (msg: string, ...args: unknown[]) =>
      console.log(`${prefix} ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) =>
      console.warn(`${prefix} ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) =>
      console.error(`${prefix} ${msg}`, ...args),
  };
}

serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  const rid = makeRequestId();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Logger is initialized with null callerId until the JWT is decoded.
  // After we decode, we re-create with the real callerId for downstream logs.
  let log = makeLogger(rid, null);

  try {
    // ── 1. Auth: get caller's JWT ─────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing bearer token" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Decode the JWT subject locally — gateway already validated signature.
    // Used for is_self flag and the per-user cache key.
    const callerId = decodeJwtSub(authHeader);
    if (!callerId) {
      return new Response(JSON.stringify({ error: "invalid bearer token" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    log = makeLogger(rid, callerId);

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

    // ── 3. Cache check ────────────────────────────────────────────────
    // Mitigates DoS-via-Close-API-quota: hot V8 isolates serve cached
    // responses for the same (caller, range) tuple within 60s without
    // re-hitting Close API.
    const cacheKey = `${callerId}|${body.from}|${body.to}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: {
          ...cors,
          "Content-Type": "application/json",
          "X-Cache": "HIT",
        },
      });
    }

    // ── 4. Resolve team member set via the user-context RPC ──────────
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
      const status = isAuthError(memberErr.message) ? 401 : 500;
      return new Response(
        JSON.stringify({
          error: `get_team_member_ids failed: ${memberErr.message}`,
        }),
        {
          status,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    // get_team_member_ids returns string[] (never null — the SQL function uses
    // COALESCE to return an empty array). Types regenerated 2026-04-06.
    const teamUuids: string[] = memberIds ?? [];

    if (teamUuids.length === 0) {
      const empty: ResponseBody = { from: body.from, to: body.to, rows: [] };
      cacheSet(cacheKey, empty);
      return new Response(JSON.stringify(empty), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── 5. Read encrypted keys + profile data via service role ───────
    // Single PostgREST query with FK-join. Replaces the previous two
    // parallel selects (close_config + user_profiles) with one round trip.
    // Service-role bypasses RLS (lead-heat cron uses the same pattern). The
    // teamUuids are already filtered to authorized agents via the user-context
    // RPC above, so this is not a privilege escalation — we're only reading
    // data the caller is already entitled to monitor.
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    interface JoinedRow {
      user_id: string;
      api_key_encrypted: string;
      user_profiles: {
        first_name: string | null;
        last_name: string | null;
        email: string;
        profile_photo_url: string | null;
      } | null;
    }

    const { data: joined, error: joinErr } = await adminClient
      .from("close_config")
      .select(
        "user_id, api_key_encrypted, user_profiles!inner(first_name, last_name, email, profile_photo_url)",
      )
      .in("user_id", teamUuids)
      .eq("is_active", true)
      .returns<JoinedRow[]>();

    if (joinErr) {
      log.error("close_config FK-join failed:", joinErr.message);
      return new Response(
        JSON.stringify({ error: `lookup failed: ${joinErr.message}` }),
        {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const joinedRows = joined ?? [];

    // Audit any orphan UUIDs: in teamUuids but not in joinedRows (most likely
    // close_config was deactivated between the RPC call and this query —
    // a small consistency window). These surface in the UI as "Close not
    // connected" rows in step 7. Logging them turns a silent edge case
    // into an observable event we can grep for in production.
    const joinedUserIds = new Set(joinedRows.map((r) => r.user_id));
    for (const uuid of teamUuids) {
      if (!joinedUserIds.has(uuid)) {
        log.warn(
          `team member ${uuid} returned by RPC but no active close_config found (race or recently disconnected)`,
        );
      }
    }

    log.info(
      `team_size=${teamUuids.length} connected=${joinedRows.length} from=${body.from} to=${body.to}`,
    );

    // ── 6. Fan out: fetch + aggregate per agent in batches of 3 ──────
    const rows: TeamCallStatsRow[] = [];

    for (let i = 0; i < joinedRows.length; i += CONCURRENCY_LIMIT) {
      const batch = joinedRows.slice(i, i + CONCURRENCY_LIMIT);
      const batchRows = await Promise.all(
        batch.map(async (row): Promise<TeamCallStatsRow> => {
          const userId = row.user_id;
          // user_profiles!inner means this is never null in practice, but
          // we defend against the type permitting null anyway.
          const profile = row.user_profiles ?? {
            first_name: null,
            last_name: null,
            email: "",
            profile_photo_url: null,
          };
          const baseRow: TeamCallStatsRow = {
            userId,
            firstName: profile.first_name,
            lastName: profile.last_name,
            email: profile.email,
            profilePhotoUrl: profile.profile_photo_url,
            isSelf: userId === callerId,
            dials: 0,
            connects: 0,
            connectRate: null,
            talkTimeSeconds: 0,
            voicemails: 0,
            lastDialAt: null,
            truncated: false,
            error: null,
          };

          try {
            const apiKey = await decrypt(row.api_key_encrypted);
            const { calls, truncated } = await fetchCallsForAgent(
              apiKey,
              body.from,
              body.to,
            );
            const agg = aggregateCalls(calls);
            return {
              ...baseRow,
              dials: agg.dials,
              connects: agg.connects,
              connectRate: agg.dials > 0 ? agg.connects / agg.dials : null,
              talkTimeSeconds: agg.talkTimeSeconds,
              voicemails: agg.voicemails,
              lastDialAt: agg.lastDialAt,
              truncated,
            };
          } catch (err) {
            log.error(
              `fetch failed for user ${userId}:`,
              (err as Error).message,
            );
            return { ...baseRow, error: (err as Error).message };
          }
        }),
      );
      rows.push(...batchRows);
    }

    // Surface the orphan UUIDs (audited above) as "Close not connected" rows
    // so the table doesn't silently drop them. The display name is a UUID
    // prefix since we don't have profile data for orphans (they weren't in
    // the FK-join result). The error column shows the AlertCircle icon.
    const seen = new Set(rows.map((r) => r.userId));
    for (const uuid of teamUuids) {
      if (seen.has(uuid)) continue;
      rows.push({
        userId: uuid,
        firstName: null,
        lastName: null,
        email: `agent-${uuid.slice(0, 8)}`,
        profilePhotoUrl: null,
        isSelf: uuid === callerId,
        dials: 0,
        connects: 0,
        connectRate: null,
        talkTimeSeconds: 0,
        voicemails: 0,
        lastDialAt: null,
        truncated: false,
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

    cacheSet(cacheKey, response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "X-Cache": "MISS",
      },
    });
  } catch (err) {
    log.error("unexpected error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "unknown error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
