// supabase/functions/close-kpi-data/index.ts
// Dedicated edge function for Close CRM KPI data.
// Decrypts user's Close API key from close_config, calls Close API v1 directly.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { decrypt } from "../_shared/encryption.ts";

// ─── CORS ──────────────────────────────────────────────────────────

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

function isLoopbackValue(value?: string | null) {
  if (!value) return false;
  return value.includes("127.0.0.1") || value.includes("localhost");
}

function corsHeaders(req?: Request) {
  const reqOrigin = req?.headers.get("origin") ?? "";
  const isLocal =
    isLoopbackValue(Deno.env.get("SUPABASE_URL")) ||
    isLoopbackValue(reqOrigin) ||
    isLoopbackValue(req?.url);
  let origin = "*";
  if (reqOrigin && isLoopbackValue(reqOrigin)) {
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

// deno-lint-ignore no-explicit-any
function jsonResponse(data: any, status = 200, req?: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// ─── Close API v1 Client ───────────────────────────────────────────

const CLOSE_API_BASE = "https://api.close.com/api/v1";

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

async function closeGet(apiKey: string, path: string): Promise<unknown> {
  const res = await closeApiFetch(`${CLOSE_API_BASE}${path}`, {
    headers: {
      Authorization: `Basic ${btoa(`${apiKey}:`)}`,
      Accept: "application/json",
    },
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
    headers: {
      Authorization: `Basic ${btoa(`${apiKey}:`)}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Fetch leads in a smart view using its s_query via POST /data/search/.
 *  Pass preloaded s_query.query when available (from bulk /saved_search/ fetch). */
async function fetchLeadsBySmartView(
  apiKey: string,
  smartViewId: string,
  fields: string[],
  maxResults = 2000,
  preloadedQuery?: Record<string, unknown>,
) {
  // Get the structured query from s_query field
  let searchQuery = preloadedQuery;
  if (!searchQuery) {
    const svDef = (await closeGet(
      apiKey,
      `/saved_search/${smartViewId}/`,
    )) as ApiResult;
    searchQuery = svDef.s_query?.query as Record<string, unknown> | undefined;
    if (!searchQuery) return { items: [], isTruncated: false };
  }

  const items: Record<string, unknown>[] = [];
  let cursor: string | undefined;

  while (items.length < maxResults) {
    const body: Record<string, unknown> = {
      query: searchQuery,
      _limit: 100,
      _fields: { lead: fields },
    };
    if (cursor) body.cursor = cursor;

    const res = (await closePost(apiKey, "/data/search/", body)) as ApiResult;
    const page = (res.data ?? []) as Record<string, unknown>[];
    items.push(...page);

    cursor = res.cursor as string | undefined;
    if (!cursor || page.length < 100) break;
  }

  return { items, isTruncated: items.length >= maxResults };
}

// ─── Action Handlers ───────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type Params = Record<string, any>;
// deno-lint-ignore no-explicit-any
type ApiResult = Record<string, any>;

const PREBUILT_DASHBOARD_ROLLUP_VERSION = "v1";
const PREBUILT_DASHBOARD_CACHE_SCOPE = "prebuilt_dashboard";
const PREBUILT_DASHBOARD_CACHE_RESOURCE_KEY = "close_api_rollup";
const PREBUILT_DASHBOARD_CACHE_TTL_MS = 15 * 60_000;

type CloseLeadStatus = {
  id: string;
  label: string;
};

type CloseSavedSearch = {
  id: string;
  name: string;
  s_query?: { query: Record<string, unknown> };
};

type CloseLeadRecord = {
  id: string;
  status_id?: string;
  date_created?: string;
};

type CloseCallRecord = {
  lead_id?: string;
  direction?: string;
  disposition?: string;
  duration?: number;
  date_created: string;
};

type CloseMessageRecord = {
  lead_id?: string;
  direction?: string;
  date_created: string;
};

type SmartViewSnapshot = {
  smartViewId: string;
  smartViewName: string;
  leadIds: Set<string>;
  statusCounts: Record<string, number>;
  total: number;
  isTruncated: boolean;
};

/**
 * Build a Close API query fragment for date filtering on GET /lead/.
 * NOTE: Smart view filtering does NOT work via GET /lead/ query params.
 * Use fetchLeadsBySmartView() (POST /data/search/) for smart view queries.
 */
function buildLeadSearchQueryFragment(from?: string, to?: string) {
  const parts: string[] = [];
  if (from) parts.push(`created >= "${from}"`);
  if (to) parts.push(`created <= "${to}"`);
  return parts.length > 0
    ? `&query=${encodeURIComponent(parts.join(" "))}`
    : "";
}

function calculateChangePercent(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function getComparisonBounds(currentFrom: string, currentTo: string) {
  const fromDate = new Date(currentFrom);
  const toDate = new Date(currentTo);
  const durationMs = toDate.getTime() - fromDate.getTime();

  const compTo = new Date(fromDate.getTime() - 1);
  const compFrom = new Date(compTo.getTime() - durationMs);

  return {
    from: compFrom.toISOString().split("T")[0],
    to: compTo.toISOString().split("T")[0],
  };
}

async function fetchPaginatedResults<T>(
  apiKey: string,
  pathBuilder: (skip: number) => string,
  maxResults: number,
) {
  const items: T[] = [];
  let hasMore = true;
  let skip = 0;

  while (hasMore && skip < maxResults) {
    const res = (await closeGet(apiKey, pathBuilder(skip))) as ApiResult;
    items.push(...((res.data ?? []) as T[]));
    hasMore = res.has_more === true;
    skip += 100;
  }

  return { items, isTruncated: hasMore };
}

async function fetchLeadTotalForRange(
  apiKey: string,
  params: {
    from?: string;
    to?: string;
    statusId?: string;
  },
) {
  const { from, to, statusId } = params;
  const queryParam = buildLeadSearchQueryFragment(from, to);
  const statusParam = statusId ? `&status_id=${statusId}` : "";
  const res = (await closeGet(
    apiKey,
    `/lead/?_limit=1&_fields=id${queryParam}${statusParam}`,
  )) as ApiResult;
  return res.total_results ?? 0;
}

async function fetchLeadCountsForRange(
  apiKey: string,
  params: {
    from?: string;
    to?: string;
    statuses: CloseLeadStatus[];
  },
) {
  const { from, to, statuses } = params;
  const queryParam = buildLeadSearchQueryFragment(from, to);
  const total = await fetchLeadTotalForRange(apiKey, { from, to });

  if (total <= 5000) {
    const leadStatusRows = await fetchPaginatedResults<{ status_id?: string }>(
      apiKey,
      (skip) =>
        `/lead/?_limit=100&_skip=${skip}&_fields=status_id${queryParam}`,
      5000,
    );

    const statusCounts: Record<string, number> = {};
    for (const lead of leadStatusRows.items) {
      const statusId = lead.status_id ?? "unknown";
      statusCounts[statusId] = (statusCounts[statusId] ?? 0) + 1;
    }

    return {
      byStatus: statuses.map((status) => ({
        id: status.id,
        label: status.label,
        count: statusCounts[status.id] ?? 0,
      })),
      total,
      isTruncated: leadStatusRows.isTruncated,
    };
  }

  const byStatus: { id: string; label: string; count: number }[] = [];
  for (let index = 0; index < statuses.length; index += 5) {
    const batch = statuses.slice(index, index + 5);
    const batchCounts = await Promise.all(
      batch.map(async (status) => ({
        id: status.id,
        label: status.label,
        count: await fetchLeadTotalForRange(apiKey, {
          from,
          to,
          statusId: status.id,
        }),
      })),
    );
    byStatus.push(...batchCounts);
  }

  return { byStatus, total, isTruncated: false };
}

async function fetchCreatedLeads(
  apiKey: string,
  params: { from?: string; to?: string },
) {
  const { from, to } = params;
  const queryParam = buildLeadSearchQueryFragment(from, to);

  return fetchPaginatedResults<CloseLeadRecord>(
    apiKey,
    (skip) =>
      `/lead/?_limit=100&_skip=${skip}&_fields=id,date_created${queryParam}`,
    500,
  );
}

async function fetchActivityGroups(
  apiKey: string,
  params: { from?: string; to?: string },
) {
  const { from, to } = params;
  const callParams: string[] = [];
  if (from) callParams.push(`date_created__gte=${from}`);
  if (to) callParams.push(`date_created__lte=${to}T23:59:59`);

  // Concurrency limiter prevents 429s — parallel is safe.
  const [call, email, sms] = await Promise.all([
    fetchPaginatedResults<CloseCallRecord>(
      apiKey,
      (skip) =>
        `/activity/call/?_limit=100&_skip=${skip}&_fields=lead_id,direction,disposition,duration,date_created${
          callParams.length ? `&${callParams.join("&")}` : ""
        }`,
      1000,
    ),
    fetchPaginatedResults<CloseMessageRecord>(
      apiKey,
      (skip) =>
        `/activity/email/?_limit=100&_skip=${skip}&_fields=lead_id,direction,date_created${
          callParams.length ? `&${callParams.join("&")}` : ""
        }`,
      1000,
    ),
    fetchPaginatedResults<CloseMessageRecord>(
      apiKey,
      (skip) =>
        `/activity/sms/?_limit=100&_skip=${skip}&_fields=lead_id,direction,date_created${
          callParams.length ? `&${callParams.join("&")}` : ""
        }`,
      1000,
    ),
  ]);

  return { call, email, sms };
}

async function fetchSmartViewSnapshots(
  apiKey: string,
  smartViews: CloseSavedSearch[],
) {
  const snapshots: SmartViewSnapshot[] = [];

  for (let index = 0; index < smartViews.length; index += 2) {
    const batch = smartViews.slice(index, index + 2);
    const batchSnapshots = await Promise.all(
      batch.map(async (smartView) => {
        const leads = await fetchLeadsBySmartView(
          apiKey,
          smartView.id,
          ["id", "status_id"],
          500,
          smartView.s_query?.query,
        );

        const leadIds = new Set<string>();
        const statusCounts: Record<string, number> = {};
        for (const lead of leads.items) {
          const id = lead.id as string;
          leadIds.add(id);
          const statusId = (lead.status_id as string) ?? "unknown";
          statusCounts[statusId] = (statusCounts[statusId] ?? 0) + 1;
        }

        return {
          smartViewId: smartView.id,
          smartViewName: smartView.name,
          leadIds,
          statusCounts,
          total: leads.items.length,
          isTruncated: leads.isTruncated,
        } satisfies SmartViewSnapshot;
      }),
    );

    snapshots.push(...batchSnapshots);
  }

  return snapshots;
}

// deno-lint-ignore no-explicit-any
async function readCloseKpiCacheEntry(
  dataClient: any,
  params: {
    userId: string;
    resourceScope: string;
    resourceKey: string;
    cacheKey: string;
  },
) {
  const { userId, resourceScope, resourceKey, cacheKey } = params;
  const { data, error } = await dataClient
    .from("close_kpi_cache")
    .select("result, fetched_at, expires_at")
    .eq("user_id", userId)
    .eq("resource_scope", resourceScope)
    .eq("resource_key", resourceKey)
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("[close-kpi-data] cache read failed:", error.message);
    return null;
  }

  return data;
}

// deno-lint-ignore no-explicit-any
async function writeCloseKpiCacheEntry(
  dataClient: any,
  params: {
    userId: string;
    resourceScope: string;
    resourceKey: string;
    cacheKey: string;
    result: unknown;
    fetchedAt: string;
    expiresAt: string;
  },
) {
  const {
    userId,
    resourceScope,
    resourceKey,
    cacheKey,
    result,
    fetchedAt,
    expiresAt,
  } = params;

  const { error } = await dataClient.from("close_kpi_cache").upsert(
    {
      user_id: userId,
      widget_id: null,
      resource_scope: resourceScope,
      resource_key: resourceKey,
      cache_key: cacheKey,
      result,
      fetched_at: fetchedAt,
      expires_at: expiresAt,
    },
    {
      onConflict: "user_id,resource_scope,resource_key,cache_key",
    },
  );

  if (error) {
    console.error("[close-kpi-data] cache write failed:", error.message);
  }
}

function buildPrebuiltDashboardRollupCacheKey(params: Params) {
  return JSON.stringify({
    version: PREBUILT_DASHBOARD_ROLLUP_VERSION,
    dateRange: params.dateRange ?? "unknown",
    from: params.from ?? null,
    to: params.to ?? null,
  });
}

async function handleGetMetadata(apiKey: string) {
  const [statusRes, fieldRes, svRes, pipelineRes] = await Promise.all([
    closeGet(apiKey, "/status/lead/") as Promise<ApiResult>,
    closeGet(apiKey, "/custom_field/lead/?_limit=100") as Promise<ApiResult>,
    closeGet(apiKey, "/saved_search/?_limit=50") as Promise<ApiResult>,
    closeGet(apiKey, "/pipeline/") as Promise<ApiResult>,
  ]);

  return {
    statuses: statusRes.data ?? [],
    customFields: fieldRes.data ?? [],
    smartViews: svRes.data ?? [],
    pipelines: pipelineRes.data ?? [],
  };
}

async function handleGetLeadCounts(apiKey: string, params: Params) {
  const { from, to, smartViewId } = params;
  const statusRes = (await closeGet(apiKey, "/status/lead/")) as ApiResult;
  const statuses = (statusRes.data ?? []) as CloseLeadStatus[];

  // Smart view filtering requires POST /data/search/
  if (smartViewId) {
    const svLeads = await fetchLeadsBySmartView(
      apiKey,
      smartViewId,
      ["id", "status_id", "date_created"],
      5000,
    );
    // Apply date filter client-side
    const filtered = svLeads.items.filter((l) => {
      const created = l.date_created as string | undefined;
      if (!created) return true;
      if (from && created < from) return false;
      if (to && created > `${to}T23:59:59`) return false;
      return true;
    });

    const statusCounts: Record<string, number> = {};
    for (const lead of filtered) {
      const statusId = (lead.status_id as string) ?? "unknown";
      statusCounts[statusId] = (statusCounts[statusId] ?? 0) + 1;
    }

    return {
      byStatus: statuses.map((status) => ({
        id: status.id,
        label: status.label,
        count: statusCounts[status.id] ?? 0,
      })),
      total: filtered.length,
      isTruncated: svLeads.isTruncated,
    };
  }

  return fetchLeadCountsForRange(apiKey, { from, to, statuses });
}

async function handleSearchLeads(apiKey: string, params: Params) {
  const { from, to, statusId, smartViewId, limit } = params;

  // Smart view filtering requires POST /data/search/ — GET /lead/ ignores it.
  if (smartViewId) {
    const svLeads = await fetchLeadsBySmartView(
      apiKey,
      smartViewId,
      ["id", "display_name", "status_id", "date_created"],
      limit ?? 1,
    );
    // Apply additional filters client-side (date range + status)
    let filtered = svLeads.items;
    if (from) {
      filtered = filtered.filter(
        (l) => !l.date_created || (l.date_created as string) >= from,
      );
    }
    if (to) {
      filtered = filtered.filter(
        (l) =>
          !l.date_created || (l.date_created as string) <= `${to}T23:59:59`,
      );
    }
    if (statusId) {
      filtered = filtered.filter((l) => l.status_id === statusId);
    }
    return { totalResults: filtered.length, data: filtered };
  }

  // No smart view — use standard GET /lead/ endpoint
  const qs = [
    `_limit=${limit ?? 1}`,
    `_fields=id,display_name,status_id,date_created`,
  ];

  if (statusId) qs.push(`status_id=${statusId}`);

  const queryParts: string[] = [];
  if (from) queryParts.push(`created >= "${from}"`);
  if (to) queryParts.push(`created <= "${to}"`);
  if (queryParts.length > 0)
    qs.push(`query=${encodeURIComponent(queryParts.join(" "))}`);

  const res = (await closeGet(apiKey, `/lead/?${qs.join("&")}`)) as ApiResult;
  return { totalResults: res.total_results ?? 0, data: res.data ?? [] };
}

async function handleGetActivities(apiKey: string, params: Params) {
  const { from, to, types } = params;
  const activityTypes = types ?? ["call"];
  const activityFieldMap: Record<string, string> = {
    call: "_fields=lead_id,direction,disposition,duration,date_created",
    email: "_fields=lead_id,direction,date_created",
    sms: "_fields=lead_id,direction,date_created",
  };

  // deno-lint-ignore no-explicit-any
  const results: Record<string, any> = {};

  await Promise.all(
    activityTypes.map(async (type: string) => {
      const qs = [`_limit=100`, activityFieldMap[type] ?? "_fields=id"];
      // Use activity_at (actual occurrence time), not date_created (sync time)
      if (from) qs.push(`date_created__gte=${from}`);
      if (to) qs.push(`date_created__lte=${to}T23:59:59`);

      // deno-lint-ignore no-explicit-any
      const allData: any[] = [];
      let hasMore = true;
      let skip = 0;
      const maxResults = 2000;

      while (hasMore && skip < maxResults) {
        const pageQs = [...qs, `_skip=${skip}`];
        const res = (await closeGet(
          apiKey,
          `/activity/${type}/?${pageQs.join("&")}`,
        )) as ApiResult;
        const items = res.data ?? [];
        allData.push(...items);
        hasMore = res.has_more === true;
        skip += 100;
      }

      results[type] = {
        data: allData,
        total: allData.length,
        isTruncated: hasMore,
      };
    }),
  );

  // Compute aggregations for calls
  // deno-lint-ignore no-explicit-any
  let callAgg: Record<string, any> | undefined;
  if (results.call) {
    // deno-lint-ignore no-explicit-any
    const calls = results.call.data as any[];
    const totalCalls = calls.length;
    const answered = calls.filter((c) => c.disposition === "answered").length;
    const voicemail = calls.filter(
      (c) => c.disposition === "vm-left" || c.disposition === "vm-answer",
    ).length;
    const missed = calls.filter((c) =>
      ["no-answer", "busy", "blocked"].includes(c.disposition ?? ""),
    ).length;
    const inbound = calls.filter((c) => c.direction === "inbound").length;
    const outbound = calls.filter((c) => c.direction === "outbound").length;
    const totalDurationSec = calls.reduce(
      (sum: number, c: { duration?: number }) => sum + (c.duration ?? 0),
      0,
    );
    const avgDurationSec = totalCalls > 0 ? totalDurationSec / totalCalls : 0;
    const connectRate = totalCalls > 0 ? answered / totalCalls : 0;

    const byDisposition: Record<string, number> = {};
    for (const c of calls) {
      const d = c.disposition ?? "unknown";
      byDisposition[d] = (byDisposition[d] ?? 0) + 1;
    }

    // Best time of day analysis: group answered vs total by hour
    const byHour: Record<number, { total: number; answered: number }> = {};
    for (const c of calls) {
      const hour = new Date(c.date_created).getHours();
      if (!byHour[hour]) byHour[hour] = { total: 0, answered: 0 };
      byHour[hour].total++;
      if (c.disposition === "answered") byHour[hour].answered++;
    }

    callAgg = {
      total: totalCalls,
      answered,
      voicemail,
      missed,
      inbound,
      outbound,
      connectRate: Math.round(connectRate * 1000) / 10,
      totalDurationMin: Math.round(totalDurationSec / 60),
      avgDurationMin: Math.round((avgDurationSec / 60) * 10) / 10,
      byDisposition,
      byHour,
      isTruncated: results.call.isTruncated,
    };
  }

  // Compute direction-aware aggregations for email
  // deno-lint-ignore no-explicit-any
  let emailAgg: Record<string, any> | undefined;
  if (results.email) {
    // deno-lint-ignore no-explicit-any
    const emails = results.email.data as any[];
    const sent = emails.filter(
      (e) => e.direction === "outgoing" || e.direction === "outbound",
    ).length;
    const received = emails.filter(
      (e) => e.direction === "incoming" || e.direction === "inbound",
    ).length;
    emailAgg = {
      total: emails.length,
      sent,
      received,
      isTruncated: results.email.isTruncated,
    };
  }

  // Compute direction-aware aggregations for SMS
  // deno-lint-ignore no-explicit-any
  let smsAgg: Record<string, any> | undefined;
  if (results.sms) {
    // deno-lint-ignore no-explicit-any
    const smsList = results.sms.data as any[];
    const sent = smsList.filter(
      (s) => s.direction === "outbound" || s.direction === "outgoing",
    ).length;
    const received = smsList.filter(
      (s) => s.direction === "inbound" || s.direction === "incoming",
    ).length;
    smsAgg = {
      total: smsList.length,
      sent,
      received,
      isTruncated: results.sms.isTruncated,
    };
  }

  return {
    call: callAgg,
    email: emailAgg,
    sms: smsAgg,
  };
}

async function handleGetOpportunities(apiKey: string, params: Params) {
  const { from, to, statusType } = params;

  const baseQs = [
    `_limit=100`,
    `_fields=id,value,status_id,status_type,status_label,date_created,date_won,date_lost`,
  ];
  if (from) baseQs.push(`date_created__gte=${from}`);
  if (to) baseQs.push(`date_created__lte=${to}T23:59:59`);
  if (statusType) baseQs.push(`status_type=${statusType}`);

  // Paginate to get ALL opportunities (up to 2000)
  type Opp = {
    id: string;
    value?: number;
    value_period?: string;
    status_id?: string;
    status_type?: string;
    status_label?: string;
    date_created?: string;
    date_won?: string;
    date_lost?: string;
  };
  const opps: Opp[] = [];
  let hasMore = true;
  let skip = 0;

  while (hasMore && skip < 2000) {
    const pageQs = [...baseQs, `_skip=${skip}`];
    const res = (await closeGet(
      apiKey,
      `/opportunity/?${pageQs.join("&")}`,
    )) as ApiResult;
    const items = (res.data ?? []) as Opp[];
    opps.push(...items);
    hasMore = res.has_more === true;
    skip += 100;
  }

  const wonOpps = opps.filter((o) => o.status_type === "won");
  const lostOpps = opps.filter((o) => o.status_type === "lost");
  const activeOpps = opps.filter((o) => o.status_type === "active");

  // Close stores values in cents — convert to dollars
  const totalValue = opps.reduce((sum, o) => sum + (o.value ?? 0), 0) / 100;
  const wonValue = wonOpps.reduce((sum, o) => sum + (o.value ?? 0), 0) / 100;
  const winRate =
    wonOpps.length + lostOpps.length > 0
      ? wonOpps.length / (wonOpps.length + lostOpps.length)
      : 0;
  const avgDealSize = opps.length > 0 ? totalValue / opps.length : 0;

  // Average time to close
  let avgTimeToCloseDays = 0;
  const timesToClose = wonOpps
    .filter((o) => o.date_created && o.date_won)
    .map((o) => {
      const created = new Date(o.date_created!).getTime();
      const won = new Date(o.date_won!).getTime();
      return (won - created) / (1000 * 60 * 60 * 24);
    });
  if (timesToClose.length > 0) {
    avgTimeToCloseDays =
      timesToClose.reduce((a, b) => a + b, 0) / timesToClose.length;
  }

  // By status breakdown
  const byStatus: Record<
    string,
    { count: number; value: number; label: string }
  > = {};
  for (const o of opps) {
    const key = o.status_id ?? "unknown";
    if (!byStatus[key])
      byStatus[key] = { count: 0, value: 0, label: o.status_label ?? key };
    byStatus[key].count++;
    byStatus[key].value += (o.value ?? 0) / 100;
  }

  return {
    total: opps.length,
    isTruncated: hasMore,
    totalValue: Math.round(totalValue * 100) / 100,
    wonCount: wonOpps.length,
    wonValue: Math.round(wonValue * 100) / 100,
    lostCount: lostOpps.length,
    activeCount: activeOpps.length,
    winRate: Math.round(winRate * 1000) / 10,
    avgDealSize: Math.round(avgDealSize * 100) / 100,
    avgTimeToCloseDays: Math.round(avgTimeToCloseDays * 10) / 10,
    byStatus: Object.entries(byStatus).map(([id, v]) => ({ id, ...v })),
  };
}

async function handleGetLeadStatusChanges(apiKey: string, params: Params) {
  const { from, to, fromStatus, toStatus } = params;

  const qs = [
    `_limit=100`,
    `_fields=lead_id,date_created,old_status_label,new_status_label`,
  ];
  if (from) qs.push(`date_created__gte=${from}`);
  if (to) qs.push(`date_created__lte=${to}T23:59:59`);

  // Paginate
  // deno-lint-ignore no-explicit-any
  const allData: any[] = [];
  let hasMore = true;
  let skip = 0;

  while (hasMore && skip < 2000) {
    const pageQs = [...qs, `_skip=${skip}`];
    const res = (await closeGet(
      apiKey,
      `/activity/status_change/lead/?${pageQs.join("&")}`,
    )) as ApiResult;
    const items = res.data ?? [];
    allData.push(...items);
    hasMore = res.has_more === true;
    skip += 100;
  }

  // Also fetch lead creation dates so we can measure time from creation
  // for leads whose initial status is the fromStatus (no "moved to" event exists)
  const leadIds = [...new Set(allData.map((c) => c.lead_id).filter(Boolean))];

  // Group by lead_id to compute transition times
  // deno-lint-ignore no-explicit-any
  const byLead: Record<string, any[]> = {};
  for (const c of allData) {
    if (!byLead[c.lead_id]) byLead[c.lead_id] = [];
    byLead[c.lead_id].push(c);
  }

  // Batch-fetch lead creation dates for leads where we need it
  // (leads that were created IN the fromStatus — no "moved to fromStatus" event)
  const leadCreationDates: Record<string, number> = {};
  if (leadIds.length > 0 && leadIds.length <= 500) {
    // Fetch in batches of 5 concurrent
    for (let i = 0; i < leadIds.length; i += 50) {
      const batch = leadIds.slice(i, i + 50);
      const batchQs = batch.map((id) => `id=${id}`).join("&");
      try {
        const res = (await closeGet(
          apiKey,
          `/lead/?_limit=100&_fields=id,date_created&${batchQs}`,
        )) as ApiResult;
        for (const lead of res.data ?? []) {
          if (lead.id && lead.date_created) {
            leadCreationDates[lead.id] = new Date(lead.date_created).getTime();
          }
        }
      } catch {
        // Non-critical — we'll just have fewer duration measurements
      }
    }
  }

  // Count ALL matching transitions (not just ones with duration)
  let transitionCount = 0;
  const transitionDays: number[] = [];

  for (const [leadId, leadChanges] of Object.entries(byLead)) {
    leadChanges.sort(
      // deno-lint-ignore no-explicit-any
      (a: any, b: any) =>
        new Date(a.date_created).getTime() - new Date(b.date_created).getTime(),
    );

    // Track when the lead entered fromStatus (via a previous change)
    let enteredFromAt: number | null = null;

    // Check if the lead's FIRST status change has old_status_label === fromStatus
    // and there's no prior "moved INTO fromStatus" event. In that case, the lead
    // was created in fromStatus, so use lead creation date as entry time.
    const firstChange = leadChanges[0];
    if (
      firstChange &&
      firstChange.old_status_label === fromStatus &&
      leadCreationDates[leadId]
    ) {
      enteredFromAt = leadCreationDates[leadId];
    }

    for (const c of leadChanges) {
      // Lead moved INTO fromStatus — record entry time
      if (c.new_status_label === fromStatus) {
        enteredFromAt = new Date(c.date_created).getTime();
      }

      // Lead moved OUT OF fromStatus — this is a transition we want to measure
      if (c.old_status_label === fromStatus) {
        if (!toStatus || c.new_status_label === toStatus) {
          transitionCount++;
          const exitTime = new Date(c.date_created).getTime();
          if (enteredFromAt) {
            const days = (exitTime - enteredFromAt) / (1000 * 60 * 60 * 24);
            transitionDays.push(days);
          }
          enteredFromAt = null;
          break;
        }
      }
    }
  }

  transitionDays.sort((a, b) => a - b);
  const avg =
    transitionDays.length > 0
      ? transitionDays.reduce((a, b) => a + b, 0) / transitionDays.length
      : 0;
  const mid = Math.floor(transitionDays.length / 2);
  const median =
    transitionDays.length > 0
      ? transitionDays.length % 2 !== 0
        ? transitionDays[mid]
        : (transitionDays[mid - 1] + transitionDays[mid]) / 2
      : 0;

  return {
    transitions: [
      {
        from: fromStatus ?? "Any",
        to: toStatus ?? "Any next status",
        avgDays: Math.round(avg * 10) / 10,
        medianDays: Math.round(median * 10) / 10,
        minDays:
          transitionDays.length > 0
            ? Math.round(transitionDays[0] * 10) / 10
            : 0,
        maxDays:
          transitionDays.length > 0
            ? Math.round(transitionDays[transitionDays.length - 1] * 10) / 10
            : 0,
        sampleSize: transitionCount,
        durationSampleSize: transitionDays.length,
      },
    ],
    totalChanges: allData.length,
  };
}

// ─── VM Rate by Smart View Handler ────────────────────────────────

async function handleGetVmRateBySmartView(apiKey: string, params: Params) {
  const { from, to, smartViewIds, firstCallOnly } = params;
  const useFirstCallOnly = firstCallOnly !== false; // default true

  if (
    !smartViewIds ||
    !Array.isArray(smartViewIds) ||
    smartViewIds.length === 0
  ) {
    return { rows: [], overall: { totalFirstCalls: 0, vmCount: 0, vmRate: 0 } };
  }

  // Step 1: Fetch all outbound calls in the date range (paginate up to 3000)
  // deno-lint-ignore no-explicit-any
  const allCalls: any[] = [];
  let hasMore = true;
  let skip = 0;
  const callQs = [`_limit=100`, `_fields=lead_id,date_created,disposition`];
  if (from) callQs.push(`date_created__gte=${from}`);
  if (to) callQs.push(`date_created__lte=${to}T23:59:59`);
  callQs.push(`direction=outbound`);

  while (hasMore && skip < 3000) {
    const pageQs = [...callQs, `_skip=${skip}`];
    const res = (await closeGet(
      apiKey,
      `/activity/call/?${pageQs.join("&")}`,
    )) as ApiResult;
    const items = res.data ?? [];
    allCalls.push(...items);
    hasMore = res.has_more === true;
    skip += 100;
  }

  // Step 2: If firstCallOnly, group by lead_id and keep only the earliest call
  // deno-lint-ignore no-explicit-any
  let callsToAnalyze: any[];
  if (useFirstCallOnly) {
    // deno-lint-ignore no-explicit-any
    const byLead: Record<string, any> = {};
    for (const call of allCalls) {
      const lid = call.lead_id;
      if (!lid) continue;
      if (
        !byLead[lid] ||
        new Date(call.date_created) < new Date(byLead[lid].date_created)
      ) {
        byLead[lid] = call;
      }
    }
    callsToAnalyze = Object.values(byLead);
  } else {
    callsToAnalyze = allCalls;
  }

  // Build a map of lead_id → call for quick lookup
  const callsByLeadId: Record<string, typeof callsToAnalyze> = {};
  for (const call of callsToAnalyze) {
    const lid = call.lead_id;
    if (!lid) continue;
    if (!callsByLeadId[lid]) callsByLeadId[lid] = [];
    callsByLeadId[lid].push(call);
  }

  // Step 3: For each smart view, fetch its leads and cross-reference
  // deno-lint-ignore no-explicit-any
  const svMeta = (await closeGet(
    apiKey,
    `/saved_search/?_limit=50`,
  )) as ApiResult;
  const svMap: Record<string, string> = {};
  const svQueryMap: Record<string, Record<string, unknown>> = {};
  for (const sv of svMeta.data ?? []) {
    svMap[sv.id] = sv.name;
    if (sv.s_query?.query) svQueryMap[sv.id] = sv.s_query.query;
  }

  // deno-lint-ignore no-explicit-any
  const rows: any[] = [];
  let overallTotal = 0;
  let overallVm = 0;

  // Process smart views in batches of 3 to limit concurrency
  for (let i = 0; i < smartViewIds.length; i += 3) {
    const batch = smartViewIds.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map(async (svId: string) => {
        const svLeads = await fetchLeadsBySmartView(
          apiKey,
          svId,
          ["id"],
          2000,
          svQueryMap[svId],
        );
        const leadIds = new Set<string>(
          svLeads.items.map((l) => l.id as string),
        );

        // Cross-reference: find calls whose lead_id is in this smart view
        let totalFirstCalls = 0;
        let vmCount = 0;
        let answeredCount = 0;
        let otherCount = 0;

        for (const leadId of leadIds) {
          const calls = callsByLeadId[leadId];
          if (!calls) continue;
          for (const call of calls) {
            totalFirstCalls++;
            const disp = call.disposition ?? "";
            if (["vm-left", "vm-answer", "no-answer"].includes(disp)) {
              vmCount++;
            } else if (disp === "answered") {
              answeredCount++;
            } else {
              otherCount++;
            }
          }
        }

        const vmRate =
          totalFirstCalls > 0
            ? Math.round((vmCount / totalFirstCalls) * 1000) / 10
            : 0;

        return {
          smartViewId: svId,
          smartViewName: svMap[svId] ?? svId,
          totalFirstCalls,
          vmCount,
          answeredCount,
          otherCount,
          vmRate,
        };
      }),
    );

    for (const row of batchResults) {
      rows.push(row);
      overallTotal += row.totalFirstCalls;
      overallVm += row.vmCount;
    }
  }

  // Sort by VM rate descending (worst offenders first)
  rows.sort((a, b) => b.vmRate - a.vmRate);

  return {
    rows,
    overall: {
      totalFirstCalls: overallTotal,
      vmCount: overallVm,
      vmRate:
        overallTotal > 0
          ? Math.round((overallVm / overallTotal) * 1000) / 10
          : 0,
    },
  };
}

// ─── Best Time to Call Handler ─────────────────────────────────────

async function handleGetBestCallTimes(apiKey: string, params: Params) {
  const { from, to } = params;

  const qs = [
    `_limit=100`,
    `_fields=date_created,disposition`,
    `direction=outbound`,
  ];
  if (from) qs.push(`date_created__gte=${from}`);
  if (to) qs.push(`date_created__lte=${to}T23:59:59`);

  // deno-lint-ignore no-explicit-any
  const allCalls: any[] = [];
  let hasMore = true;
  let skip = 0;

  while (hasMore && skip < 3000) {
    const pageQs = [...qs, `_skip=${skip}`];
    const res = (await closeGet(
      apiKey,
      `/activity/call/?${pageQs.join("&")}`,
    )) as ApiResult;
    allCalls.push(...(res.data ?? []));
    hasMore = res.has_more === true;
    skip += 100;
  }

  // Group by hour of day and day of week
  const byHour: Record<
    number,
    { total: number; answered: number; vm: number; noAnswer: number }
  > = {};
  const byDayOfWeek: Record<number, { total: number; answered: number }> = {};

  for (const c of allCalls) {
    const dt = new Date(c.date_created);
    const hour = dt.getHours();
    const dow = dt.getDay(); // 0=Sun, 6=Sat

    if (!byHour[hour])
      byHour[hour] = { total: 0, answered: 0, vm: 0, noAnswer: 0 };
    byHour[hour].total++;
    if (c.disposition === "answered") byHour[hour].answered++;
    else if (c.disposition === "vm-left" || c.disposition === "vm-answer")
      byHour[hour].vm++;
    else byHour[hour].noAnswer++;

    if (!byDayOfWeek[dow]) byDayOfWeek[dow] = { total: 0, answered: 0 };
    byDayOfWeek[dow].total++;
    if (c.disposition === "answered") byDayOfWeek[dow].answered++;
  }

  // Build sorted arrays with connect rates
  const hourlyData = Array.from({ length: 24 }, (_, h) => {
    const d = byHour[h] ?? { total: 0, answered: 0, vm: 0, noAnswer: 0 };
    return {
      hour: h,
      label: `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? "am" : "pm"}`,
      total: d.total,
      answered: d.answered,
      vm: d.vm,
      noAnswer: d.noAnswer,
      connectRate:
        d.total > 0 ? Math.round((d.answered / d.total) * 1000) / 10 : 0,
    };
  });

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dailyData = Array.from({ length: 7 }, (_, d) => {
    const data = byDayOfWeek[d] ?? { total: 0, answered: 0 };
    return {
      day: d,
      label: dayNames[d],
      total: data.total,
      answered: data.answered,
      connectRate:
        data.total > 0
          ? Math.round((data.answered / data.total) * 1000) / 10
          : 0,
    };
  });

  // Find best hour and best day
  const bestHour = hourlyData.reduce(
    (best, h) => (h.total >= 5 && h.connectRate > best.connectRate ? h : best),
    {
      hour: -1,
      label: "",
      total: 0,
      answered: 0,
      vm: 0,
      noAnswer: 0,
      connectRate: 0,
    },
  );
  const bestDay = dailyData.reduce(
    (best, d) => (d.total >= 5 && d.connectRate > best.connectRate ? d : best),
    { day: -1, label: "", total: 0, answered: 0, connectRate: 0 },
  );

  return {
    hourly: hourlyData,
    daily: dailyData,
    bestHour: bestHour.hour >= 0 ? bestHour : null,
    bestDay: bestDay.day >= 0 ? bestDay : null,
    totalCalls: allCalls.length,
    isTruncated: hasMore,
  };
}

// ─── Cross-Reference (Smart View × Status) Handler ───────────────

async function handleGetCrossReference(apiKey: string, params: Params) {
  const { smartViewIds, statusIds } = params;

  if (!smartViewIds?.length) {
    return { rows: [], statusLabels: [], totals: {}, grandTotal: 0 };
  }

  // Fetch status labels + smart view metadata (for names and queries) in parallel
  const [statusRes, svMeta] = await Promise.all([
    closeGet(apiKey, "/status/lead/") as Promise<ApiResult>,
    closeGet(apiKey, "/saved_search/?_limit=50") as Promise<ApiResult>,
  ]);
  const allStatuses = (statusRes.data ?? []) as { id: string; label: string }[];
  const filterStatuses = statusIds?.length
    ? allStatuses.filter((s: { id: string }) => statusIds.includes(s.id))
    : allStatuses;
  const svMap: Record<string, string> = {};
  const svQueryMap: Record<string, Record<string, unknown>> = {};
  for (const sv of svMeta.data ?? []) {
    svMap[sv.id] = sv.name;
    if (sv.s_query?.query) svQueryMap[sv.id] = sv.s_query.query;
  }

  // For each smart view, get lead counts by status
  // deno-lint-ignore no-explicit-any
  const rows: any[] = [];
  const totals: Record<string, number> = {};
  let grandTotal = 0;

  for (let i = 0; i < smartViewIds.length; i += 3) {
    const batch = smartViewIds.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map(async (svId: string) => {
        const svLeads = await fetchLeadsBySmartView(
          apiKey,
          svId,
          ["id", "status_id"],
          2000,
          svQueryMap[svId],
        );
        const statusCounts: Record<string, number> = {};
        for (const lead of svLeads.items) {
          const sid = (lead.status_id as string) ?? "unknown";
          statusCounts[sid] = (statusCounts[sid] ?? 0) + 1;
        }

        return { smartViewId: svId, statusCounts, total: svLeads.items.length };
      }),
    );

    for (const result of batchResults) {
      const cells: Record<string, number> = {};
      for (const status of filterStatuses) {
        const count = result.statusCounts[status.id] ?? 0;
        cells[status.id] = count;
        totals[status.id] = (totals[status.id] ?? 0) + count;
      }
      grandTotal += result.total;
      rows.push({
        smartViewId: result.smartViewId,
        cells,
        total: result.total,
      });
    }
  }

  // Resolve smart view names (already fetched above)
  for (const row of rows)
    row.smartViewName = svMap[row.smartViewId] ?? row.smartViewId;

  return {
    rows,
    statusLabels: filterStatuses.map((s: { id: string; label: string }) => ({
      id: s.id,
      label: s.label,
    })),
    totals,
    grandTotal,
  };
}

// ─── Speed to Lead Handler ────────────────────────────────────────

async function handleGetSpeedToLead(apiKey: string, params: Params) {
  const { from, to, smartViewId } = params;

  // Fetch leads — use search API when smart view is specified
  // deno-lint-ignore no-explicit-any
  let leads: any[];

  if (smartViewId) {
    const svLeads = await fetchLeadsBySmartView(
      apiKey,
      smartViewId,
      ["id", "date_created"],
      2000,
    );
    // Apply date filter client-side (search API filters by smart view only)
    leads = svLeads.items.filter((l) => {
      const created = l.date_created as string | undefined;
      if (!created) return true;
      if (from && created < from) return false;
      if (to && created > `${to}T23:59:59`) return false;
      return true;
    });
  } else {
    const queryParam = buildLeadSearchQueryFragment(from, to);
    leads = [];
    let hasMore = true;
    let skip = 0;

    while (hasMore && skip < 2000) {
      const res = (await closeGet(
        apiKey,
        `/lead/?_limit=100&_skip=${skip}&_fields=id,date_created${queryParam}`,
      )) as ApiResult;
      leads.push(...(res.data ?? []));
      hasMore = res.has_more === true;
      skip += 100;
    }
  }

  if (leads.length === 0) {
    return {
      avgMinutes: 0,
      medianMinutes: 0,
      distribution: [],
      totalLeads: 0,
      leadsWithActivity: 0,
    };
  }

  // For each lead, find their first outbound activity
  // Fetch all outbound calls/emails/sms in range
  const actQs = [`_limit=100`, `_fields=lead_id,direction,date_created`];
  if (from) actQs.push(`date_created__gte=${from}`);
  if (to) actQs.push(`date_created__lte=${to}T23:59:59`);

  // deno-lint-ignore no-explicit-any
  const allActivities: any[] = [];
  for (const type of ["call", "email", "sms"]) {
    let actHasMore = true;
    let actSkip = 0;
    while (actHasMore && actSkip < 2000) {
      const res = (await closeGet(
        apiKey,
        `/activity/${type}/?${[...actQs, `_skip=${actSkip}`].join("&")}`,
      )) as ApiResult;
      for (const act of res.data ?? []) {
        allActivities.push({ ...act, _type: type });
      }
      actHasMore = res.has_more === true;
      actSkip += 100;
    }
  }

  // Group activities by lead_id, find earliest outbound
  const firstActivityByLead: Record<string, number> = {};
  for (const act of allActivities) {
    const lid = act.lead_id;
    if (!lid) continue;
    // Only outbound activities count
    const dir = act.direction ?? "";
    if (dir === "inbound" || dir === "incoming") continue;

    const actTime = new Date(act.date_created).getTime();
    if (!firstActivityByLead[lid] || actTime < firstActivityByLead[lid]) {
      firstActivityByLead[lid] = actTime;
    }
  }

  // Compute speed-to-lead for each lead
  const speedMinutes: number[] = [];
  for (const lead of leads) {
    const createdAt = new Date(lead.date_created).getTime();
    const firstAct = firstActivityByLead[lead.id];
    if (firstAct && firstAct >= createdAt) {
      speedMinutes.push((firstAct - createdAt) / (1000 * 60));
    }
  }

  speedMinutes.sort((a, b) => a - b);

  const avg =
    speedMinutes.length > 0
      ? speedMinutes.reduce((a, b) => a + b, 0) / speedMinutes.length
      : 0;
  const mid = Math.floor(speedMinutes.length / 2);
  const med =
    speedMinutes.length > 0
      ? speedMinutes.length % 2 !== 0
        ? speedMinutes[mid]
        : (speedMinutes[mid - 1] + speedMinutes[mid]) / 2
      : 0;

  // Distribution buckets: <5min, 5-15min, 15-30min, 30-60min, 1-4hr, 4-24hr, >24hr
  const buckets = [
    { label: "< 5 min", max: 5, count: 0 },
    { label: "5–15 min", max: 15, count: 0 },
    { label: "15–30 min", max: 30, count: 0 },
    { label: "30–60 min", max: 60, count: 0 },
    { label: "1–4 hr", max: 240, count: 0 },
    { label: "4–24 hr", max: 1440, count: 0 },
    { label: "> 24 hr", max: Infinity, count: 0 },
  ];
  for (const m of speedMinutes) {
    const bucket = buckets.find((b) => m < b.max);
    if (bucket) bucket.count++;
  }

  return {
    avgMinutes: Math.round(avg * 10) / 10,
    medianMinutes: Math.round(med * 10) / 10,
    distribution: buckets,
    totalLeads: leads.length,
    leadsWithActivity: speedMinutes.length,
    pctContacted:
      leads.length > 0
        ? Math.round((speedMinutes.length / leads.length) * 1000) / 10
        : 0,
  };
}

// ─── Contact Cadence Handler ──────────────────────────────────────

async function handleGetContactCadence(apiKey: string, params: Params) {
  const { from, to, smartViewId } = params;

  // Fetch leads — use search API when smart view is specified
  // deno-lint-ignore no-explicit-any
  let leads: any[];

  if (smartViewId) {
    const svLeads = await fetchLeadsBySmartView(
      apiKey,
      smartViewId,
      ["id", "date_created"],
      1000,
    );
    // Apply date filter client-side
    leads = svLeads.items.filter((l) => {
      const created = l.date_created as string | undefined;
      if (!created) return true;
      if (from && created < from) return false;
      if (to && created > `${to}T23:59:59`) return false;
      return true;
    });
  } else {
    const queryParam = buildLeadSearchQueryFragment(from, to);
    leads = [];
    let hasMore = true;
    let skip = 0;
    while (hasMore && skip < 1000) {
      const res = (await closeGet(
        apiKey,
        `/lead/?_limit=100&_skip=${skip}&_fields=id${queryParam}`,
      )) as ApiResult;
      leads.push(...(res.data ?? []));
      hasMore = res.has_more === true;
      skip += 100;
    }
  }

  const leadIdSet = new Set(leads.map((l: { id: string }) => l.id));

  // Fetch all outbound activities
  const actQs = [`_limit=100`, `_fields=lead_id,direction,date_created`];
  if (from) actQs.push(`date_created__gte=${from}`);
  if (to) actQs.push(`date_created__lte=${to}T23:59:59`);

  // deno-lint-ignore no-explicit-any
  const activitiesByLead: Record<string, any[]> = {};
  for (const type of ["call", "email", "sms"]) {
    let actHasMore = true;
    let actSkip = 0;
    while (actHasMore && actSkip < 2000) {
      const res = (await closeGet(
        apiKey,
        `/activity/${type}/?${[...actQs, `_skip=${actSkip}`].join("&")}`,
      )) as ApiResult;
      for (const act of res.data ?? []) {
        const lid = act.lead_id;
        if (!lid || !leadIdSet.has(lid)) continue;
        const dir = act.direction ?? "";
        if (dir === "inbound" || dir === "incoming") continue;
        if (!activitiesByLead[lid]) activitiesByLead[lid] = [];
        activitiesByLead[lid].push({
          type,
          time: new Date(act.date_created).getTime(),
        });
      }
      actHasMore = res.has_more === true;
      actSkip += 100;
    }
  }

  // Compute gaps between touches per lead
  const allGapsHours: number[] = [];
  let totalTouches = 0;
  let leadsMultiTouch = 0;
  const touchCountDist: Record<number, number> = {};

  for (const [, acts] of Object.entries(activitiesByLead)) {
    acts.sort((a: { time: number }, b: { time: number }) => a.time - b.time);
    const touchCount = acts.length;
    totalTouches += touchCount;
    touchCountDist[touchCount] = (touchCountDist[touchCount] ?? 0) + 1;

    if (touchCount >= 2) {
      leadsMultiTouch++;
      for (let i = 1; i < acts.length; i++) {
        const gapHours = (acts[i].time - acts[i - 1].time) / (1000 * 60 * 60);
        allGapsHours.push(gapHours);
      }
    }
  }

  allGapsHours.sort((a, b) => a - b);

  const avgGapHours =
    allGapsHours.length > 0
      ? allGapsHours.reduce((a, b) => a + b, 0) / allGapsHours.length
      : 0;
  const midG = Math.floor(allGapsHours.length / 2);
  const medianGapHours =
    allGapsHours.length > 0
      ? allGapsHours.length % 2 !== 0
        ? allGapsHours[midG]
        : (allGapsHours[midG - 1] + allGapsHours[midG]) / 2
      : 0;

  // Touch count distribution (top entries)
  const touchDist = Object.entries(touchCountDist)
    .map(([count, leads]) => ({ touches: parseInt(count), leads }))
    .sort((a, b) => a.touches - b.touches)
    .slice(0, 10);

  return {
    avgGapHours: Math.round(avgGapHours * 10) / 10,
    medianGapHours: Math.round(medianGapHours * 10) / 10,
    totalLeads: leads.length,
    leadsContacted: Object.keys(activitiesByLead).length,
    leadsMultiTouch,
    totalTouches,
    avgTouchesPerLead:
      leads.length > 0
        ? Math.round((totalTouches / leads.length) * 10) / 10
        : 0,
    touchDistribution: touchDist,
  };
}

// ─── Dial Attempt Tracker Handler ─────────────────────────────────

async function handleGetDialAttempts(apiKey: string, params: Params) {
  const { from, to, smartViewId } = params;

  // Fetch outbound calls
  const callQs = [
    `_limit=100`,
    `_fields=lead_id,date_created,disposition`,
    `direction=outbound`,
  ];
  if (from) callQs.push(`date_created__gte=${from}`);
  if (to) callQs.push(`date_created__lte=${to}T23:59:59`);

  // deno-lint-ignore no-explicit-any
  const allCalls: any[] = [];
  let hasMore = true;
  let skip = 0;
  while (hasMore && skip < 3000) {
    const res = (await closeGet(
      apiKey,
      `/activity/call/?${[...callQs, `_skip=${skip}`].join("&")}`,
    )) as ApiResult;
    allCalls.push(...(res.data ?? []));
    hasMore = res.has_more === true;
    skip += 100;
  }

  // If smart view filter, get lead IDs via search API
  let filterLeadIds: Set<string> | null = null;
  if (smartViewId) {
    const svLeads = await fetchLeadsBySmartView(
      apiKey,
      smartViewId,
      ["id"],
      2000,
    );
    filterLeadIds = new Set<string>(svLeads.items.map((l) => l.id as string));
  }

  // Group calls by lead, sorted by time
  // deno-lint-ignore no-explicit-any
  const callsByLead: Record<string, any[]> = {};
  for (const call of allCalls) {
    const lid = call.lead_id;
    if (!lid) continue;
    if (filterLeadIds && !filterLeadIds.has(lid)) continue;
    if (!callsByLead[lid]) callsByLead[lid] = [];
    callsByLead[lid].push(call);
  }

  // For each lead, find: how many attempts before first answer
  const attemptsToConnect: number[] = [];
  let neverConnected = 0;
  let totalLeadsDialed = 0;

  // Success rate by attempt number (1st call, 2nd call, etc.)
  const successByAttempt: Record<number, { total: number; answered: number }> =
    {};

  for (const [, calls] of Object.entries(callsByLead)) {
    calls.sort(
      // deno-lint-ignore no-explicit-any
      (a: any, b: any) =>
        new Date(a.date_created).getTime() - new Date(b.date_created).getTime(),
    );
    totalLeadsDialed++;

    let connected = false;
    for (let i = 0; i < calls.length; i++) {
      const attemptNum = i + 1;
      if (!successByAttempt[attemptNum])
        successByAttempt[attemptNum] = { total: 0, answered: 0 };
      successByAttempt[attemptNum].total++;

      if (calls[i].disposition === "answered") {
        if (!connected) {
          attemptsToConnect.push(attemptNum);
          connected = true;
        }
        successByAttempt[attemptNum].answered++;
      }
    }

    if (!connected) neverConnected++;
  }

  attemptsToConnect.sort((a, b) => a - b);
  const avg =
    attemptsToConnect.length > 0
      ? attemptsToConnect.reduce((a, b) => a + b, 0) / attemptsToConnect.length
      : 0;
  const mid = Math.floor(attemptsToConnect.length / 2);
  const med =
    attemptsToConnect.length > 0
      ? attemptsToConnect.length % 2 !== 0
        ? attemptsToConnect[mid]
        : (attemptsToConnect[mid - 1] + attemptsToConnect[mid]) / 2
      : 0;

  // Build attempt-by-attempt success rates (up to 10)
  const attemptRates = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    const d = successByAttempt[n] ?? { total: 0, answered: 0 };
    return {
      attempt: n,
      total: d.total,
      answered: d.answered,
      connectRate:
        d.total > 0 ? Math.round((d.answered / d.total) * 1000) / 10 : 0,
    };
  }).filter((a) => a.total > 0);

  return {
    avgAttempts: Math.round(avg * 10) / 10,
    medianAttempts: Math.round(med * 10) / 10,
    totalLeadsDialed,
    leadsConnected: attemptsToConnect.length,
    neverConnected,
    connectPct:
      totalLeadsDialed > 0
        ? Math.round((attemptsToConnect.length / totalLeadsDialed) * 1000) / 10
        : 0,
    attemptRates,
  };
}

function buildCallAnalyticsResult(
  calls: CloseCallRecord[],
  isTruncated: boolean,
) {
  const total = calls.length;
  const answered = calls.filter(
    (call) => call.disposition === "answered",
  ).length;
  const voicemail = calls.filter((call) =>
    ["vm-left", "vm-answer"].includes(call.disposition ?? ""),
  ).length;
  const missed = calls.filter((call) =>
    ["no-answer", "busy", "blocked"].includes(call.disposition ?? ""),
  ).length;
  const inbound = calls.filter((call) => call.direction === "inbound").length;
  const outbound = calls.filter((call) => call.direction === "outbound").length;
  const totalDurationSec = calls.reduce(
    (sum, call) => sum + (call.duration ?? 0),
    0,
  );
  const avgDurationSec = total > 0 ? totalDurationSec / total : 0;

  const byDisposition: Record<string, number> = {};
  for (const call of calls) {
    const disposition = call.disposition ?? "unknown";
    byDisposition[disposition] = (byDisposition[disposition] ?? 0) + 1;
  }

  return {
    total,
    answered,
    voicemail,
    missed,
    inbound,
    outbound,
    connectRate: total > 0 ? Math.round((answered / total) * 1000) / 10 : 0,
    totalDurationMin: Math.round(totalDurationSec / 60),
    avgDurationMin: Math.round((avgDurationSec / 60) * 10) / 10,
    isTruncated,
    byDisposition: Object.entries(byDisposition).map(
      ([disposition, count]) => ({
        disposition,
        count,
      }),
    ),
    byDirection: [
      { direction: "inbound", count: inbound },
      { direction: "outbound", count: outbound },
    ],
  };
}

function buildBestCallTimesResult(
  calls: CloseCallRecord[],
  isTruncated: boolean,
) {
  const outboundCalls = calls.filter((call) => call.direction === "outbound");
  const byHour: Record<
    number,
    { total: number; answered: number; vm: number; noAnswer: number }
  > = {};
  const byDayOfWeek: Record<number, { total: number; answered: number }> = {};

  for (const call of outboundCalls) {
    const date = new Date(call.date_created);
    const hour = date.getHours();
    const day = date.getDay();

    if (!byHour[hour]) {
      byHour[hour] = { total: 0, answered: 0, vm: 0, noAnswer: 0 };
    }

    byHour[hour].total++;
    if (call.disposition === "answered") byHour[hour].answered++;
    else if (["vm-left", "vm-answer"].includes(call.disposition ?? "")) {
      byHour[hour].vm++;
    } else {
      byHour[hour].noAnswer++;
    }

    if (!byDayOfWeek[day]) byDayOfWeek[day] = { total: 0, answered: 0 };
    byDayOfWeek[day].total++;
    if (call.disposition === "answered") byDayOfWeek[day].answered++;
  }

  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const data = byHour[hour] ?? { total: 0, answered: 0, vm: 0, noAnswer: 0 };
    return {
      hour,
      label: `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? "am" : "pm"}`,
      total: data.total,
      answered: data.answered,
      vm: data.vm,
      noAnswer: data.noAnswer,
      connectRate:
        data.total > 0
          ? Math.round((data.answered / data.total) * 1000) / 10
          : 0,
    };
  });

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daily = Array.from({ length: 7 }, (_, day) => {
    const data = byDayOfWeek[day] ?? { total: 0, answered: 0 };
    return {
      day,
      label: dayNames[day],
      total: data.total,
      answered: data.answered,
      connectRate:
        data.total > 0
          ? Math.round((data.answered / data.total) * 1000) / 10
          : 0,
    };
  });

  const bestHour = hourly.reduce(
    (best, entry) =>
      entry.total >= 5 && entry.connectRate > best.connectRate ? entry : best,
    {
      hour: -1,
      label: "",
      total: 0,
      answered: 0,
      vm: 0,
      noAnswer: 0,
      connectRate: 0,
    },
  );
  const bestDay = daily.reduce(
    (best, entry) =>
      entry.total >= 5 && entry.connectRate > best.connectRate ? entry : best,
    { day: -1, label: "", total: 0, answered: 0, connectRate: 0 },
  );

  return {
    hourly,
    daily,
    bestHour: bestHour.hour >= 0 ? bestHour : null,
    bestDay: bestDay.day >= 0 ? bestDay : null,
    totalCalls: outboundCalls.length,
    isTruncated,
  };
}

function buildVmRateBySmartViewResult(
  outboundCalls: CloseCallRecord[],
  smartViewSnapshots: SmartViewSnapshot[],
) {
  const firstCallByLead: Record<string, CloseCallRecord> = {};
  for (const call of outboundCalls) {
    const leadId = call.lead_id;
    if (!leadId) continue;
    if (
      !firstCallByLead[leadId] ||
      new Date(call.date_created) <
        new Date(firstCallByLead[leadId].date_created)
    ) {
      firstCallByLead[leadId] = call;
    }
  }

  let overallTotal = 0;
  let overallVm = 0;

  const rows = smartViewSnapshots.map((snapshot) => {
    let totalFirstCalls = 0;
    let vmCount = 0;
    let answeredCount = 0;
    let otherCount = 0;

    for (const leadId of snapshot.leadIds) {
      const call = firstCallByLead[leadId];
      if (!call) continue;

      totalFirstCalls++;
      const disposition = call.disposition ?? "";
      if (["vm-left", "vm-answer", "no-answer"].includes(disposition)) {
        vmCount++;
      } else if (disposition === "answered") {
        answeredCount++;
      } else {
        otherCount++;
      }
    }

    overallTotal += totalFirstCalls;
    overallVm += vmCount;

    return {
      smartViewId: snapshot.smartViewId,
      smartViewName: snapshot.smartViewName,
      totalFirstCalls,
      vmCount,
      answeredCount,
      otherCount,
      vmRate:
        totalFirstCalls > 0
          ? Math.round((vmCount / totalFirstCalls) * 1000) / 10
          : 0,
    };
  });

  rows.sort((left, right) => right.vmRate - left.vmRate);

  return {
    rows,
    overall: {
      totalFirstCalls: overallTotal,
      vmCount: overallVm,
      vmRate:
        overallTotal > 0
          ? Math.round((overallVm / overallTotal) * 1000) / 10
          : 0,
    },
  };
}

function buildCrossReferenceResult(
  statuses: CloseLeadStatus[],
  smartViewSnapshots: SmartViewSnapshot[],
) {
  const totals: Record<string, number> = {};
  let grandTotal = 0;

  const rows = smartViewSnapshots.map((snapshot) => {
    const cells: Record<string, number> = {};
    for (const status of statuses) {
      const count = snapshot.statusCounts[status.id] ?? 0;
      cells[status.id] = count;
      totals[status.id] = (totals[status.id] ?? 0) + count;
    }
    grandTotal += snapshot.total;
    return {
      smartViewId: snapshot.smartViewId,
      smartViewName: snapshot.smartViewName,
      cells,
      total: snapshot.total,
    };
  });

  return {
    rows,
    statusLabels: statuses.map((status) => ({
      id: status.id,
      label: status.label,
    })),
    totals,
    grandTotal,
  };
}

function buildSpeedToLeadResult(
  leads: CloseLeadRecord[],
  activityGroups: {
    call: { items: CloseCallRecord[] };
    email: { items: CloseMessageRecord[] };
    sms: { items: CloseMessageRecord[] };
  },
) {
  if (leads.length === 0) {
    return {
      avgMinutes: 0,
      medianMinutes: 0,
      distribution: [],
      totalLeads: 0,
      leadsWithActivity: 0,
      pctContacted: 0,
    };
  }

  const firstActivityByLead: Record<string, number> = {};
  for (const activity of [
    ...activityGroups.call.items,
    ...activityGroups.email.items,
    ...activityGroups.sms.items,
  ]) {
    const leadId = activity.lead_id;
    if (!leadId) continue;
    const direction = activity.direction ?? "";
    if (direction === "inbound" || direction === "incoming") continue;

    const activityTime = new Date(activity.date_created).getTime();
    if (
      !firstActivityByLead[leadId] ||
      activityTime < firstActivityByLead[leadId]
    ) {
      firstActivityByLead[leadId] = activityTime;
    }
  }

  const speedMinutes: number[] = [];
  for (const lead of leads) {
    if (!lead.date_created) continue;
    const createdAt = new Date(lead.date_created).getTime();
    const firstActivity = firstActivityByLead[lead.id];
    if (firstActivity && firstActivity >= createdAt) {
      speedMinutes.push((firstActivity - createdAt) / (1000 * 60));
    }
  }

  speedMinutes.sort((left, right) => left - right);
  const avgMinutes =
    speedMinutes.length > 0
      ? speedMinutes.reduce((sum, value) => sum + value, 0) /
        speedMinutes.length
      : 0;
  const mid = Math.floor(speedMinutes.length / 2);
  const medianMinutes =
    speedMinutes.length > 0
      ? speedMinutes.length % 2 !== 0
        ? speedMinutes[mid]
        : (speedMinutes[mid - 1] + speedMinutes[mid]) / 2
      : 0;

  const distribution = [
    { label: "< 5 min", max: 5, count: 0 },
    { label: "5–15 min", max: 15, count: 0 },
    { label: "15–30 min", max: 30, count: 0 },
    { label: "30–60 min", max: 60, count: 0 },
    { label: "1–4 hr", max: 240, count: 0 },
    { label: "4–24 hr", max: 1440, count: 0 },
    { label: "> 24 hr", max: Infinity, count: 0 },
  ];

  for (const minutes of speedMinutes) {
    const bucket = distribution.find((entry) => minutes < entry.max);
    if (bucket) bucket.count++;
  }

  return {
    avgMinutes: Math.round(avgMinutes * 10) / 10,
    medianMinutes: Math.round(medianMinutes * 10) / 10,
    distribution,
    totalLeads: leads.length,
    leadsWithActivity: speedMinutes.length,
    pctContacted:
      leads.length > 0
        ? Math.round((speedMinutes.length / leads.length) * 1000) / 10
        : 0,
  };
}

function buildContactCadenceResult(
  leads: CloseLeadRecord[],
  activityGroups: {
    call: { items: CloseCallRecord[] };
    email: { items: CloseMessageRecord[] };
    sms: { items: CloseMessageRecord[] };
  },
) {
  const leadIds = new Set(leads.map((lead) => lead.id));
  const activitiesByLead: Record<string, number[]> = {};

  for (const activity of [
    ...activityGroups.call.items,
    ...activityGroups.email.items,
    ...activityGroups.sms.items,
  ]) {
    const leadId = activity.lead_id;
    if (!leadId || !leadIds.has(leadId)) continue;

    const direction = activity.direction ?? "";
    if (direction === "inbound" || direction === "incoming") continue;

    if (!activitiesByLead[leadId]) activitiesByLead[leadId] = [];
    activitiesByLead[leadId].push(new Date(activity.date_created).getTime());
  }

  const allGapsHours: number[] = [];
  let totalTouches = 0;
  let leadsMultiTouch = 0;
  const touchDistributionCounts: Record<number, number> = {};

  for (const times of Object.values(activitiesByLead)) {
    times.sort((left, right) => left - right);
    totalTouches += times.length;
    touchDistributionCounts[times.length] =
      (touchDistributionCounts[times.length] ?? 0) + 1;

    if (times.length >= 2) {
      leadsMultiTouch++;
      for (let index = 1; index < times.length; index++) {
        allGapsHours.push((times[index] - times[index - 1]) / (1000 * 60 * 60));
      }
    }
  }

  allGapsHours.sort((left, right) => left - right);
  const avgGapHours =
    allGapsHours.length > 0
      ? allGapsHours.reduce((sum, value) => sum + value, 0) /
        allGapsHours.length
      : 0;
  const mid = Math.floor(allGapsHours.length / 2);
  const medianGapHours =
    allGapsHours.length > 0
      ? allGapsHours.length % 2 !== 0
        ? allGapsHours[mid]
        : (allGapsHours[mid - 1] + allGapsHours[mid]) / 2
      : 0;

  const touchDistribution = Object.entries(touchDistributionCounts)
    .map(([touches, count]) => ({
      touches: parseInt(touches, 10),
      leads: count,
    }))
    .sort((left, right) => left.touches - right.touches)
    .slice(0, 10);

  return {
    avgGapHours: Math.round(avgGapHours * 10) / 10,
    medianGapHours: Math.round(medianGapHours * 10) / 10,
    totalLeads: leads.length,
    leadsContacted: Object.keys(activitiesByLead).length,
    leadsMultiTouch,
    totalTouches,
    avgTouchesPerLead:
      leads.length > 0
        ? Math.round((totalTouches / leads.length) * 10) / 10
        : 0,
    touchDistribution,
  };
}

function buildDialAttemptsResult(calls: CloseCallRecord[]) {
  const outboundCalls = calls.filter((call) => call.direction === "outbound");
  const callsByLead: Record<string, CloseCallRecord[]> = {};

  for (const call of outboundCalls) {
    const leadId = call.lead_id;
    if (!leadId) continue;
    if (!callsByLead[leadId]) callsByLead[leadId] = [];
    callsByLead[leadId].push(call);
  }

  const attemptsToConnect: number[] = [];
  let neverConnected = 0;
  let totalLeadsDialed = 0;
  const successByAttempt: Record<number, { total: number; answered: number }> =
    {};

  for (const callsForLead of Object.values(callsByLead)) {
    callsForLead.sort(
      (left, right) =>
        new Date(left.date_created).getTime() -
        new Date(right.date_created).getTime(),
    );
    totalLeadsDialed++;

    let connected = false;
    for (let index = 0; index < callsForLead.length; index++) {
      const attempt = index + 1;
      if (!successByAttempt[attempt]) {
        successByAttempt[attempt] = { total: 0, answered: 0 };
      }

      successByAttempt[attempt].total++;
      if (callsForLead[index].disposition === "answered") {
        if (!connected) {
          attemptsToConnect.push(attempt);
          connected = true;
        }
        successByAttempt[attempt].answered++;
      }
    }

    if (!connected) neverConnected++;
  }

  attemptsToConnect.sort((left, right) => left - right);
  const avgAttempts =
    attemptsToConnect.length > 0
      ? attemptsToConnect.reduce((sum, value) => sum + value, 0) /
        attemptsToConnect.length
      : 0;
  const mid = Math.floor(attemptsToConnect.length / 2);
  const medianAttempts =
    attemptsToConnect.length > 0
      ? attemptsToConnect.length % 2 !== 0
        ? attemptsToConnect[mid]
        : (attemptsToConnect[mid - 1] + attemptsToConnect[mid]) / 2
      : 0;

  const attemptRates = Array.from({ length: 10 }, (_, index) => {
    const attempt = index + 1;
    const data = successByAttempt[attempt] ?? { total: 0, answered: 0 };
    return {
      attempt,
      total: data.total,
      answered: data.answered,
      connectRate:
        data.total > 0
          ? Math.round((data.answered / data.total) * 1000) / 10
          : 0,
    };
  }).filter((entry) => entry.total > 0);

  return {
    avgAttempts: Math.round(avgAttempts * 10) / 10,
    medianAttempts: Math.round(medianAttempts * 10) / 10,
    totalLeadsDialed,
    leadsConnected: attemptsToConnect.length,
    neverConnected,
    connectPct:
      totalLeadsDialed > 0
        ? Math.round((attemptsToConnect.length / totalLeadsDialed) * 1000) / 10
        : 0,
    attemptRates,
  };
}

// deno-lint-ignore no-explicit-any
async function handleGetPrebuiltDashboardRollup(
  apiKey: string,
  params: Params,
  context: any,
) {
  const { from, to } = params;
  if (!from || !to) {
    throw Object.assign(
      new Error("get_prebuilt_dashboard_rollup requires from and to"),
      { code: "INVALID_PARAMS", status: 400 },
    );
  }

  // Phase 0: Metadata (2 lightweight calls)
  const [statusRes, smartViewRes] = await Promise.all([
    closeGet(apiKey, "/status/lead/") as Promise<ApiResult>,
    closeGet(apiKey, "/saved_search/?_limit=50") as Promise<ApiResult>,
  ]);

  const statuses = (statusRes.data ?? []) as CloseLeadStatus[];
  const smartViews = (smartViewRes.data ?? []) as CloseSavedSearch[];
  // Cap smart views to 5 for the dashboard rollup to limit API calls
  const cappedSmartViews = smartViews.slice(0, 5);
  const vmSmartViews = smartViews.slice(0, 5);
  const comparison = getComparisonBounds(from, to);

  // Phase 1: Lead counts + activities (moderate API load, run in parallel)
  const [
    currentLeadCounts,
    previousLeadTotal,
    createdLeads,
    activityGroups,
    opportunityRes,
    lifecycleRes,
  ] = await Promise.all([
    fetchLeadCountsForRange(apiKey, { from, to, statuses }),
    fetchLeadTotalForRange(apiKey, {
      from: comparison.from,
      to: comparison.to,
    }),
    fetchCreatedLeads(apiKey, { from, to }),
    fetchActivityGroups(apiKey, { from, to }),
    handleGetOpportunities(apiKey, {
      from,
      to,
      statusType: "active",
    }),
    handleGetLeadStatusChanges(apiKey, {
      from,
      to,
      fromStatus: "New",
    }),
  ]);

  // Phase 2: Smart view snapshots (heavy — 1 search per SV, run AFTER phase 1)
  const smartViewSnapshots = await fetchSmartViewSnapshots(
    apiKey,
    cappedSmartViews,
  );

  const callAnalytics = buildCallAnalyticsResult(
    activityGroups.call.items,
    activityGroups.call.isTruncated,
  );
  const bestCallTimes = buildBestCallTimesResult(
    activityGroups.call.items,
    activityGroups.call.isTruncated,
  );
  const dialAttempts = buildDialAttemptsResult(activityGroups.call.items);
  const vmRate = buildVmRateBySmartViewResult(
    activityGroups.call.items.filter((call) => call.direction === "outbound"),
    smartViewSnapshots.filter((snapshot) =>
      vmSmartViews.some((smartView) => smartView.id === snapshot.smartViewId),
    ),
  );
  const crossReference = buildCrossReferenceResult(
    statuses,
    smartViewSnapshots,
  );
  const speedToLead = buildSpeedToLeadResult(
    createdLeads.items,
    activityGroups,
  );
  const contactCadence = buildContactCadenceResult(
    createdLeads.items,
    activityGroups,
  );
  const statusDistributionItems = [...currentLeadCounts.byStatus].sort(
    (left, right) => right.count - left.count,
  );

  const fetchedAt = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + PREBUILT_DASHBOARD_CACHE_TTL_MS,
  ).toISOString();
  const rollup = {
    version: PREBUILT_DASHBOARD_ROLLUP_VERSION,
    cacheHit: false,
    fetchedAt,
    expiresAt,
    widgets: {
      total_leads: {
        value: currentLeadCounts.total,
        previousValue: previousLeadTotal,
        changePercent:
          calculateChangePercent(currentLeadCounts.total, previousLeadTotal) ??
          undefined,
        label: "Leads",
        unit: "number",
      },
      new_leads: {
        value: currentLeadCounts.total,
        previousValue: previousLeadTotal,
        changePercent:
          calculateChangePercent(currentLeadCounts.total, previousLeadTotal) ??
          undefined,
        label: "Leads",
        unit: "number",
      },
      speed_to_lead: speedToLead,
      status_dist: {
        items: statusDistributionItems,
        total: statusDistributionItems.reduce(
          (sum, item) => sum + item.count,
          0,
        ),
      },
      lifecycle: {
        transitions: lifecycleRes.transitions,
      },
      call_analytics: callAnalytics,
      best_call_times: bestCallTimes,
      vm_rate: vmRate,
      contact_cadence: contactCadence,
      dial_attempts: dialAttempts,
      opp_funnel: {
        totalValue: opportunityRes.totalValue,
        dealCount: opportunityRes.total,
        activeCount: opportunityRes.activeCount,
        wonCount: opportunityRes.wonCount,
        wonValue: opportunityRes.wonValue,
        lostCount: opportunityRes.lostCount,
        winRate: opportunityRes.winRate,
        avgDealSize: opportunityRes.avgDealSize,
        salesVelocity:
          opportunityRes.avgTimeToCloseDays > 0
            ? Math.round(
                ((opportunityRes.wonCount *
                  opportunityRes.avgDealSize *
                  (opportunityRes.winRate / 100)) /
                  opportunityRes.avgTimeToCloseDays) *
                  100,
              ) / 100
            : 0,
        avgTimeToClose: opportunityRes.avgTimeToCloseDays,
        stalledCount: 0,
        byStatus: opportunityRes.byStatus,
      },
      cross_ref: crossReference,
    },
  };

  await writeCloseKpiCacheEntry(context.dataClient, {
    userId: context.userId,
    resourceScope: PREBUILT_DASHBOARD_CACHE_SCOPE,
    resourceKey: PREBUILT_DASHBOARD_CACHE_RESOURCE_KEY,
    cacheKey: buildPrebuiltDashboardRollupCacheKey(params),
    result: rollup,
    fetchedAt,
    expiresAt,
  });

  return rollup;
}

// ─── Main Handler ──────────────────────────────────────────────────

serve(async (req) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, req);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, ...params } = body;

    if (!action) {
      return jsonResponse({ error: "action is required" }, 400, req);
    }

    // ── Auth: resolve user from JWT ──
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;
    const REMOTE_URL = Deno.env.get("REMOTE_SUPABASE_URL");
    const REMOTE_KEY = Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY");
    const useLocalSupabaseDev =
      Deno.env.get("VITE_USE_LOCAL") === "true" ||
      isLoopbackValue(SUPABASE_URL) ||
      isLoopbackValue(req.url);
    const allowRemoteSupabaseDev =
      Deno.env.get("VITE_ALLOW_REMOTE_SUPABASE_DEV") === "true";
    const shouldUseRemoteDataClient =
      Boolean(REMOTE_URL && REMOTE_KEY) &&
      (allowRemoteSupabaseDev || !useLocalSupabaseDev);

    const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const dataClient =
      shouldUseRemoteDataClient && REMOTE_URL && REMOTE_KEY
        ? createClient(REMOTE_URL, REMOTE_KEY)
        : authClient;

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

    if (action === "get_prebuilt_dashboard_rollup") {
      const cachedRollup = await readCloseKpiCacheEntry(dataClient, {
        userId: user.id,
        resourceScope: PREBUILT_DASHBOARD_CACHE_SCOPE,
        resourceKey: PREBUILT_DASHBOARD_CACHE_RESOURCE_KEY,
        cacheKey: buildPrebuiltDashboardRollupCacheKey(params),
      });

      if (cachedRollup?.result) {
        return jsonResponse(
          {
            ...(cachedRollup.result as Record<string, unknown>),
            cacheHit: true,
            fetchedAt: cachedRollup.fetched_at,
            expiresAt: cachedRollup.expires_at,
          },
          200,
          req,
        );
      }
    }

    // ── Get Close API key ──
    // In local dev, set CLOSE_API_KEY in .env to bypass the encrypted
    // key lookup (local auth user IDs won't match production close_config).
    const envApiKey = Deno.env.get("CLOSE_API_KEY");
    let apiKey: string;

    if (envApiKey) {
      apiKey = envApiKey;
    } else {
      const { data: encryptedKey, error: rpcError } = await dataClient.rpc(
        "get_close_api_key",
        { p_user_id: user.id },
      );

      if (rpcError || !encryptedKey) {
        console.error("[close-kpi-data] get_close_api_key failed:", {
          userId: user.id,
          rpcError: rpcError?.message ?? rpcError,
        });
        return jsonResponse(
          {
            error:
              "Close CRM not connected. Please connect your Close account first.",
            code: "CLOSE_NOT_CONNECTED",
          },
          400,
          req,
        );
      }

      try {
        apiKey = await decrypt(encryptedKey);
      } catch (decryptErr) {
        console.error("[close-kpi-data] Failed to decrypt Close API key:", {
          userId: user.id,
          error: (decryptErr as Error).message,
        });
        return jsonResponse(
          {
            error:
              "Close CRM configuration error. Please reconnect your Close account or contact your agency admin.",
            code: "CLOSE_DECRYPT_ERROR",
          },
          400,
          req,
        );
      }
    }

    // ── Dispatch action ──
    let result: unknown;

    switch (action) {
      case "debug_smart_views": {
        const svList = (await closeGet(
          apiKey,
          "/saved_search/?_limit=3",
        )) as ApiResult;
        const svs = (svList.data ?? []).slice(0, 3);
        const debug: Record<string, unknown>[] = [];
        for (const sv of svs) {
          const sq = sv.s_query?.query;
          let postCount = "no_query";
          let postError = null;
          if (sq) {
            try {
              const res = (await closePost(apiKey, "/data/search/", {
                query: sq,
                _limit: 1,
                _fields: { lead: ["id"] },
              })) as ApiResult;
              postCount = res.total_results ?? (res.data ?? []).length;
            } catch (e: unknown) {
              postError = (e as Error).message;
            }
          }
          debug.push({
            id: sv.id,
            name: sv.name,
            has_s_query: !!sv.s_query,
            has_s_query_query: !!sq,
            postDataSearch_with_s_query: postCount,
            postError,
          });
        }
        result = { debug };
        break;
      }
      case "get_metadata":
        result = await handleGetMetadata(apiKey);
        break;
      case "get_lead_counts":
        result = await handleGetLeadCounts(apiKey, params);
        break;
      case "search_leads":
        result = await handleSearchLeads(apiKey, params);
        break;
      case "get_activities":
        result = await handleGetActivities(apiKey, params);
        break;
      case "get_opportunities":
        result = await handleGetOpportunities(apiKey, params);
        break;
      case "get_lead_status_changes":
        result = await handleGetLeadStatusChanges(apiKey, params);
        break;
      case "get_vm_rate_by_smart_view":
        result = await handleGetVmRateBySmartView(apiKey, params);
        break;
      case "get_best_call_times":
        result = await handleGetBestCallTimes(apiKey, params);
        break;
      case "get_cross_reference":
        result = await handleGetCrossReference(apiKey, params);
        break;
      case "get_speed_to_lead":
        result = await handleGetSpeedToLead(apiKey, params);
        break;
      case "get_contact_cadence":
        result = await handleGetContactCadence(apiKey, params);
        break;
      case "get_dial_attempts":
        result = await handleGetDialAttempts(apiKey, params);
        break;
      case "get_prebuilt_dashboard_rollup":
        result = await handleGetPrebuiltDashboardRollup(apiKey, params, {
          dataClient,
          userId: user.id,
        });
        break;
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400, req);
    }

    return jsonResponse(result, 200, req);
  } catch (err) {
    const error = err as Error & { code?: string; status?: number };
    const status = error.status ?? 500;
    console.error(
      `[close-kpi-data] ${error.code ?? "ERROR"}: ${error.message}`,
    );
    return jsonResponse(
      {
        error: error.message,
        code: error.code ?? "CLOSE_ERROR",
      },
      status,
      req,
    );
  }
});
