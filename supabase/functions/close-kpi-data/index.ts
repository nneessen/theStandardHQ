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
  "http://localhost:3004",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3004",
];

function corsHeaders(req?: Request) {
  const isLocal =
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

// deno-lint-ignore no-explicit-any
function jsonResponse(data: any, status = 200, req?: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// ─── Close API v1 Client ───────────────────────────────────────────

const CLOSE_API_BASE = "https://api.close.com/api/v1";

async function closeGet(apiKey: string, path: string): Promise<unknown> {
  const res = await fetch(`${CLOSE_API_BASE}${path}`, {
    headers: {
      Authorization: `Basic ${btoa(`${apiKey}:`)}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (res.status === 401) {
    throw Object.assign(new Error("Close API key is expired or invalid"), {
      code: "CLOSE_AUTH_ERROR",
      status: 401,
    });
  }
  if (res.status === 429) {
    // Retry once after backoff
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "2", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    const retryRes = await fetch(`${CLOSE_API_BASE}${path}`, {
      headers: {
        Authorization: `Basic ${btoa(`${apiKey}:`)}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!retryRes.ok)
      throw Object.assign(new Error("Close API rate limit"), {
        code: "CLOSE_RATE_LIMIT",
        status: 429,
      });
    return retryRes.json();
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw Object.assign(new Error(`Close API ${res.status}: ${errText}`), {
      code: "CLOSE_ERROR",
      status: res.status,
    });
  }
  return res.json();
}

// ─── Action Handlers ───────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type Params = Record<string, any>;
// deno-lint-ignore no-explicit-any
type ApiResult = Record<string, any>;

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
  const { from, to } = params;

  // Get statuses + total lead count in parallel (2 API calls, not 34)
  const dateQuery = [];
  if (from) dateQuery.push(`created >= "${from}"`);
  if (to) dateQuery.push(`created <= "${to}"`);
  const queryParam =
    dateQuery.length > 0
      ? `&query=${encodeURIComponent(dateQuery.join(" "))}`
      : "";

  const [statusRes, totalRes] = await Promise.all([
    closeGet(apiKey, "/status/lead/") as Promise<ApiResult>,
    closeGet(
      apiKey,
      `/lead/?_limit=1&_fields=id${queryParam}`,
    ) as Promise<ApiResult>,
  ]);

  const statuses = (statusRes.data ?? []) as { id: string; label: string }[];
  const total = totalRes.total_results ?? 0;

  // If total is small enough, fetch all lead status_ids in one paginated call
  // and count client-side (MUCH faster than N separate API calls)
  if (total <= 5000) {
    const statusCounts: Record<string, number> = {};
    let hasMore = true;
    let skip = 0;

    while (hasMore && skip < 5000) {
      const res = (await closeGet(
        apiKey,
        `/lead/?_limit=200&_skip=${skip}&_fields=status_id${queryParam}`,
      )) as ApiResult;
      const leads = (res.data ?? []) as { status_id: string }[];
      for (const lead of leads) {
        const sid = lead.status_id ?? "unknown";
        statusCounts[sid] = (statusCounts[sid] ?? 0) + 1;
      }
      hasMore = res.has_more === true;
      skip += 200;
    }

    const byStatus = statuses.map((s) => ({
      id: s.id,
      label: s.label,
      count: statusCounts[s.id] ?? 0,
    }));

    return { byStatus, total };
  }

  // For very large datasets (>5000 leads), fall back to per-status count
  // but only for statuses likely to have leads (skip obviously empty ones)
  const byStatus: { id: string; label: string; count: number }[] = [];
  const batchSize = 5;

  for (let i = 0; i < statuses.length; i += batchSize) {
    const batch = statuses.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (status) => {
        const qs = [`_limit=1`, `status_id=${status.id}`, `_fields=id`];
        if (queryParam) qs.push(queryParam.substring(1)); // remove leading &
        const res = (await closeGet(
          apiKey,
          `/lead/?${qs.join("&")}`,
        )) as ApiResult;
        return {
          id: status.id,
          label: status.label,
          count: res.total_results ?? 0,
        };
      }),
    );
    byStatus.push(...results);
  }

  return { byStatus, total };
}

async function handleSearchLeads(apiKey: string, params: Params) {
  const { from, to, statusId, limit } = params;

  const qs = [
    `_limit=${limit ?? 1}`,
    `_fields=id,display_name,status_id,date_created`,
  ];

  if (statusId) qs.push(`status_id=${statusId}`);

  // Build date query
  const dateQuery = [];
  if (from) dateQuery.push(`created >= "${from}"`);
  if (to) dateQuery.push(`created <= "${to}"`);
  if (dateQuery.length > 0)
    qs.push(`query=${encodeURIComponent(dateQuery.join(" "))}`);

  const res = (await closeGet(apiKey, `/lead/?${qs.join("&")}`)) as ApiResult;
  return { totalResults: res.total_results ?? 0, data: res.data ?? [] };
}

async function handleGetActivities(apiKey: string, params: Params) {
  const { from, to, types } = params;
  const activityTypes = types ?? ["call"];

  // deno-lint-ignore no-explicit-any
  const results: Record<string, any> = {};

  await Promise.all(
    activityTypes.map(async (type: string) => {
      const qs = [`_limit=200`];
      if (from) qs.push(`date_created__gte=${from}`);
      if (to) qs.push(`date_created__lte=${to}T23:59:59`);

      // Paginate to get all results (up to 2000)
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
        skip += 200;
      }

      results[type] = {
        data: allData,
        total: allData.length,
        isTruncated: hasMore,
      };
    }),
  );

  // Compute aggregations for calls
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
      (sum, c) => sum + (c.duration ?? 0),
      0,
    );
    const avgDurationSec = totalCalls > 0 ? totalDurationSec / totalCalls : 0;
    const connectRate = totalCalls > 0 ? answered / totalCalls : 0;

    // deno-lint-ignore no-explicit-any
    const byDisposition: Record<string, number> = {};
    for (const c of calls) {
      const d = c.disposition ?? "unknown";
      byDisposition[d] = (byDisposition[d] ?? 0) + 1;
    }

    return {
      call: {
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
        isTruncated: results.call.isTruncated,
      },
      email: results.email ? { total: results.email.total } : undefined,
      sms: results.sms ? { total: results.sms.total } : undefined,
    };
  }

  return {
    call: undefined,
    email: results.email ? { total: results.email.total } : undefined,
    sms: results.sms ? { total: results.sms.total } : undefined,
  };
}

async function handleGetOpportunities(apiKey: string, params: Params) {
  const { from, to, statusType } = params;

  const qs = [`_limit=200`];
  if (from) qs.push(`date_created__gte=${from}`);
  if (to) qs.push(`date_created__lte=${to}T23:59:59`);
  if (statusType) qs.push(`status_type=${statusType}`);

  const res = (await closeGet(
    apiKey,
    `/opportunity/?${qs.join("&")}`,
  )) as ApiResult;

  // Close returns rich aggregations directly!
  const opps = (res.data ?? []) as {
    id: string;
    value?: number;
    value_period?: string;
    status_id?: string;
    status_type?: string;
    status_label?: string;
    date_created?: string;
    date_won?: string;
    date_lost?: string;
  }[];

  const totalResults = res.total_results ?? opps.length;
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
  const avgDealSize = wonOpps.length > 0 ? wonValue / wonOpps.length : 0;

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

  // Use Close's built-in aggregations when available
  const closeAnnualizedValue = res.total_value_annualized ?? null;

  return {
    total: totalResults,
    totalValue: Math.round(totalValue * 100) / 100,
    closeAnnualizedValue: closeAnnualizedValue
      ? Math.round(closeAnnualizedValue / 100) / 100
      : null,
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

  const qs = [`_limit=200`];
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
    skip += 200;
  }

  // Group by lead_id to compute transition times
  // deno-lint-ignore no-explicit-any
  const byLead: Record<string, any[]> = {};
  for (const c of allData) {
    if (!byLead[c.lead_id]) byLead[c.lead_id] = [];
    byLead[c.lead_id].push(c);
  }

  const transitionDays: number[] = [];
  for (const leadChanges of Object.values(byLead)) {
    leadChanges.sort(
      (a, b) =>
        new Date(a.date_created).getTime() - new Date(b.date_created).getTime(),
    );

    let fromTime: number | null = null;
    for (const c of leadChanges) {
      if (fromStatus && c.new_status_label === fromStatus) {
        fromTime = new Date(c.date_created).getTime();
      }
      if (
        fromTime &&
        (!toStatus || c.new_status_label === toStatus) &&
        c.new_status_label !== fromStatus
      ) {
        const days =
          (new Date(c.date_created).getTime() - fromTime) /
          (1000 * 60 * 60 * 24);
        transitionDays.push(days);
        break;
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
        sampleSize: transitionDays.length,
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
  const callQs = [`_limit=200`];
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
    skip += 200;
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
  for (const sv of svMeta.data ?? []) {
    svMap[sv.id] = sv.name;
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
        // Fetch lead IDs in this smart view (paginate up to 2000)
        const leadIds = new Set<string>();
        let svHasMore = true;
        let svSkip = 0;

        while (svHasMore && svSkip < 2000) {
          const svQs = [
            `_limit=200`,
            `_skip=${svSkip}`,
            `_fields=id`,
            `saved_search_id=${svId}`,
          ];
          const res = (await closeGet(
            apiKey,
            `/lead/?${svQs.join("&")}`,
          )) as ApiResult;
          for (const lead of res.data ?? []) {
            leadIds.add(lead.id);
          }
          svHasMore = res.has_more === true;
          svSkip += 200;
        }

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

    const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const dataClient =
      REMOTE_URL && REMOTE_KEY
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

    // ── Get Close API key via RPC ──
    const { data: encryptedKey, error: rpcError } = await dataClient.rpc(
      "get_close_api_key",
      { p_user_id: user.id },
    );

    if (rpcError || !encryptedKey) {
      console.error("[close-kpi-data] get_close_api_key RPC failed:", {
        userId: user.id,
        rpcError: rpcError?.message ?? rpcError,
        hasKey: !!encryptedKey,
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

    const apiKey = await decrypt(encryptedKey);

    // ── Dispatch action ──
    let result: unknown;

    switch (action) {
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
