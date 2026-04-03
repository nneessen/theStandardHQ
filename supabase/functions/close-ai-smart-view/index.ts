// supabase/functions/close-ai-smart-view/index.ts
// Syncs the top 100 AI-scored leads into a Close CRM Smart View per user.
// Triggered daily at 7am EST via pg_cron, or on-demand via POST.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { decrypt } from "../_shared/encryption.ts";

// ─── Constants ────────────────────────────────────────────────────

const CLOSE_API_BASE = "https://api.close.com/api/v1";
const SMART_VIEW_NAME = "🤖 AI Top 100 Hot Leads";
const TOP_N = 100;

// ─── CORS ─────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  "https://app.thestandardhq.com",
  "https://www.thestandardhq.com",
  "https://thestandardhq.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3003",
  "http://localhost:3004",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3003",
  "http://127.0.0.1:3004",
];

function isLoopback(value?: string | null) {
  if (!value) return false;
  return value.includes("127.0.0.1") || value.includes("localhost");
}

function corsHeaders(req?: Request) {
  const reqOrigin = req?.headers.get("origin") ?? "";
  const isLocal =
    isLoopback(Deno.env.get("SUPABASE_URL")) ||
    isLoopback(reqOrigin) ||
    isLoopback(req?.url);
  let origin = "*";
  if (reqOrigin && isLoopback(reqOrigin)) {
    origin = reqOrigin;
  } else if (!isLocal && req) {
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

function jsonResponse(body: unknown, status: number, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// ─── Close API Helpers ────────────────────────────────────────────

async function closeApiFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 401) {
    throw Object.assign(new Error("Close API key is expired or invalid"), {
      code: "CLOSE_AUTH_ERROR",
      status: 401,
    });
  }

  if (res.status === 429) {
    const wait = parseInt(res.headers.get("retry-after") ?? "3", 10);
    await new Promise((r) => setTimeout(r, wait * 1000));
    const retry = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(15_000),
    });
    if (!retry.ok) {
      throw Object.assign(new Error("Close API rate limit"), {
        code: "CLOSE_RATE_LIMIT",
        status: 429,
      });
    }
    return retry;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw Object.assign(new Error(`Close API ${res.status}: ${errText}`), {
      code: "CLOSE_ERROR",
      status: res.status,
    });
  }

  return res;
}

function closeHeaders(apiKey: string) {
  return {
    Authorization: `Basic ${btoa(`${apiKey}:`)}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function closeGet(apiKey: string, path: string): Promise<unknown> {
  const res = await closeApiFetch(`${CLOSE_API_BASE}${path}`, {
    headers: closeHeaders(apiKey),
  });
  return res.json();
}

async function closePost(
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await closeApiFetch(`${CLOSE_API_BASE}${path}`, {
    method: "POST",
    headers: closeHeaders(apiKey),
    body: JSON.stringify(body),
  });
  return res.json();
}

async function closePut(
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await closeApiFetch(`${CLOSE_API_BASE}${path}`, {
    method: "PUT",
    headers: closeHeaders(apiKey),
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── Smart View Helpers ───────────────────────────────────────────

function buildSmartViewPayload(leadIds: string[]) {
  return {
    name: SMART_VIEW_NAME,
    s_query: {
      query: {
        type: "and",
        queries: [
          { type: "object_type", object_type: "lead" },
          {
            type: "or",
            queries: leadIds.map((id) => ({ type: "id", value: id })),
          },
        ],
      },
    },
    is_shared: true,
  };
}

// Find existing AI smart view by name
// deno-lint-ignore no-explicit-any
async function findExistingSmartView(apiKey: string): Promise<any | null> {
  // deno-lint-ignore no-explicit-any
  const result = (await closeGet(apiKey, "/saved_search/?_limit=100")) as any;
  const views = result.data ?? result ?? [];
  if (!Array.isArray(views)) return null;
  return (
    views.find(
      // deno-lint-ignore no-explicit-any
      (sv: any) => sv.name === SMART_VIEW_NAME,
    ) ?? null
  );
}

// ─── Core Sync Logic ──────────────────────────────────────────────

interface SyncResult {
  userId: string;
  leadsInView: number;
  smartViewId: string | null;
  action: "created" | "updated" | "skipped";
  error?: string;
}

async function syncSmartViewForUser(
  apiKey: string,
  userId: string,
  // deno-lint-ignore no-explicit-any
  dataClient: any,
): Promise<SyncResult> {
  // 1. Fetch top N leads by AI score
  const { data: topLeads, error: queryError } = await dataClient
    .from("lead_heat_scores")
    .select("close_lead_id, score, display_name")
    .eq("user_id", userId)
    .order("score", { ascending: false })
    .limit(TOP_N);

  if (queryError) {
    throw new Error(`DB query failed: ${queryError.message}`);
  }

  if (!topLeads || topLeads.length === 0) {
    return { userId, leadsInView: 0, smartViewId: null, action: "skipped" };
  }

  const leadIds = topLeads.map(
    (l: { close_lead_id: string }) => l.close_lead_id,
  );
  const payload = buildSmartViewPayload(leadIds);

  // 2. Check if smart view already exists in Close (by name)
  const existing = await findExistingSmartView(apiKey);

  if (existing?.id) {
    // Update existing Smart View
    // deno-lint-ignore no-explicit-any
    const updated = (await closePut(
      apiKey,
      `/saved_search/${existing.id}/`,
      payload,
    )) as any;

    return {
      userId,
      leadsInView: leadIds.length,
      smartViewId: updated.id ?? existing.id,
      action: "updated",
    };
  }

  // 3. Create new Smart View
  // deno-lint-ignore no-explicit-any
  const created = (await closePost(apiKey, "/saved_search/", payload)) as any;

  return {
    userId,
    leadsInView: leadIds.length,
    smartViewId: created.id as string,
    action: "created",
  };
}

// deno-lint-ignore no-explicit-any
async function handleSyncAllUsers(dataClient: any) {
  const { data: activeConfigs, error } = await dataClient
    .from("close_config")
    .select("user_id, api_key_encrypted")
    .eq("is_active", true);

  if (error) {
    console.error("[ai-smart-view] DB query error:", error.message);
    return { usersProcessed: 0, message: "DB error", dbError: error.message };
  }
  if (!activeConfigs?.length) {
    return { usersProcessed: 0, message: "No active Close connections" };
  }

  const results: SyncResult[] = [];

  for (const config of activeConfigs) {
    try {
      const apiKey = await decrypt(config.api_key_encrypted);
      const result = await syncSmartViewForUser(
        apiKey,
        config.user_id,
        dataClient,
      );
      results.push(result);
      console.log(
        `[ai-smart-view] ${result.action} for user ${config.user_id}: ${result.leadsInView} leads`,
      );
    } catch (err) {
      console.error(
        `[ai-smart-view] Failed for user ${config.user_id}:`,
        (err as Error).message,
      );
      results.push({
        userId: config.user_id,
        leadsInView: 0,
        smartViewId: null,
        action: "skipped",
        error: (err as Error).message,
      });
    }
  }

  return {
    usersProcessed: results.length,
    syncedAt: new Date().toISOString(),
    results,
  };
}

// ─── Handler ──────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── Supabase client setup ──
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;
    const REMOTE_URL = Deno.env.get("REMOTE_SUPABASE_URL");
    const REMOTE_KEY = Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY");
    const useLocal = isLoopback(SUPABASE_URL) || isLoopback(req.url);
    const allowRemote =
      Deno.env.get("VITE_ALLOW_REMOTE_SUPABASE_DEV") === "true";
    const shouldUseRemote =
      Boolean(REMOTE_URL && REMOTE_KEY) && (allowRemote || !useLocal);

    const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const dataClient =
      shouldUseRemote && REMOTE_URL && REMOTE_KEY
        ? createClient(REMOTE_URL, REMOTE_KEY)
        : authClient;

    // ── Actions ──

    if (action === "sync_hot_leads_view") {
      // Service-role only (cron or admin)
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace(/^Bearer\s*/i, "").trim();
      if (!serviceKey || !token || token !== serviceKey) {
        return jsonResponse(
          { error: "Forbidden: service_role only" },
          403,
          req,
        );
      }

      const result = await handleSyncAllUsers(dataClient);
      return jsonResponse(result, 200, req);
    }

    if (action === "sync_my_view") {
      // User-initiated sync
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

      const { data: config } = await dataClient
        .from("close_config")
        .select("api_key_encrypted")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!config) {
        return jsonResponse({ error: "No active Close connection" }, 400, req);
      }

      const apiKey = await decrypt(config.api_key_encrypted);
      const result = await syncSmartViewForUser(apiKey, user.id, dataClient);

      return jsonResponse(result, 200, req);
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400, req);
  } catch (err) {
    console.error("[ai-smart-view] Unhandled error:", err);
    return jsonResponse(
      { error: (err as Error).message ?? "Internal error" },
      500,
      req,
    );
  }
});
