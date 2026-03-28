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
  const { from, to, smartViewId } = params;

  // Get statuses + total lead count in parallel (2 API calls, not 34)
  const dateQuery = [];
  if (from) dateQuery.push(`created >= "${from}"`);
  if (to) dateQuery.push(`created <= "${to}"`);
  const queryParam =
    dateQuery.length > 0
      ? `&query=${encodeURIComponent(dateQuery.join(" "))}`
      : "";
  const svParam = smartViewId ? `&saved_search_id=${smartViewId}` : "";

  const [statusRes, totalRes] = await Promise.all([
    closeGet(apiKey, "/status/lead/") as Promise<ApiResult>,
    closeGet(
      apiKey,
      `/lead/?_limit=1&_fields=id${queryParam}${svParam}`,
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
        `/lead/?_limit=100&_skip=${skip}&_fields=status_id${queryParam}${svParam}`,
      )) as ApiResult;
      const leads = (res.data ?? []) as { status_id: string }[];
      for (const lead of leads) {
        const sid = lead.status_id ?? "unknown";
        statusCounts[sid] = (statusCounts[sid] ?? 0) + 1;
      }
      hasMore = res.has_more === true;
      skip += 100;
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
        if (queryParam) qs.push(queryParam.substring(1));
        if (svParam) qs.push(svParam.substring(1));
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
  const { from, to, statusId, smartViewId, limit } = params;

  const qs = [
    `_limit=${limit ?? 1}`,
    `_fields=id,display_name,status_id,date_created`,
  ];

  if (statusId) qs.push(`status_id=${statusId}`);
  if (smartViewId) qs.push(`saved_search_id=${smartViewId}`);

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
      const qs = [`_limit=100`];
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

  const baseQs = [`_limit=100`];
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

  const qs = [`_limit=100`];
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
  const callQs = [`_limit=100`];
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
            `_limit=100`,
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
          svSkip += 100;
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

// ─── Best Time to Call Handler ─────────────────────────────────────

async function handleGetBestCallTimes(apiKey: string, params: Params) {
  const { from, to } = params;

  const qs = [`_limit=100`, `direction=outbound`];
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

  // Fetch status labels
  const statusRes = (await closeGet(apiKey, "/status/lead/")) as ApiResult;
  const allStatuses = (statusRes.data ?? []) as { id: string; label: string }[];
  const filterStatuses = statusIds?.length
    ? allStatuses.filter((s: { id: string }) => statusIds.includes(s.id))
    : allStatuses;

  // For each smart view, get lead counts by status
  // deno-lint-ignore no-explicit-any
  const rows: any[] = [];
  const totals: Record<string, number> = {};
  let grandTotal = 0;

  for (let i = 0; i < smartViewIds.length; i += 3) {
    const batch = smartViewIds.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map(async (svId: string) => {
        // Fetch all leads in this smart view with status_id
        const statusCounts: Record<string, number> = {};
        let svHasMore = true;
        let svSkip = 0;
        let svTotal = 0;

        while (svHasMore && svSkip < 2000) {
          const res = (await closeGet(
            apiKey,
            `/lead/?_limit=100&_skip=${svSkip}&_fields=id,status_id&saved_search_id=${svId}`,
          )) as ApiResult;
          for (const lead of res.data ?? []) {
            const sid = lead.status_id ?? "unknown";
            statusCounts[sid] = (statusCounts[sid] ?? 0) + 1;
            svTotal++;
          }
          svHasMore = res.has_more === true;
          svSkip += 100;
        }

        return { smartViewId: svId, statusCounts, total: svTotal };
      }),
    );

    for (const result of batchResults) {
      // Get smart view name
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

  // Resolve smart view names
  const svMeta = (await closeGet(
    apiKey,
    "/saved_search/?_limit=50",
  )) as ApiResult;
  const svMap: Record<string, string> = {};
  for (const sv of svMeta.data ?? []) svMap[sv.id] = sv.name;
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

  // Fetch leads created in range
  const dateQuery = [];
  if (from) dateQuery.push(`created >= "${from}"`);
  if (to) dateQuery.push(`created <= "${to}"`);
  const queryParam =
    dateQuery.length > 0
      ? `&query=${encodeURIComponent(dateQuery.join(" "))}`
      : "";
  const svParam = smartViewId ? `&saved_search_id=${smartViewId}` : "";

  // deno-lint-ignore no-explicit-any
  const leads: any[] = [];
  let hasMore = true;
  let skip = 0;

  while (hasMore && skip < 2000) {
    const res = (await closeGet(
      apiKey,
      `/lead/?_limit=100&_skip=${skip}&_fields=id,date_created${queryParam}${svParam}`,
    )) as ApiResult;
    leads.push(...(res.data ?? []));
    hasMore = res.has_more === true;
    skip += 100;
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
  const actQs = [`_limit=100`];
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

  // Fetch leads
  const dateQuery = [];
  if (from) dateQuery.push(`created >= "${from}"`);
  if (to) dateQuery.push(`created <= "${to}"`);
  const queryParam =
    dateQuery.length > 0
      ? `&query=${encodeURIComponent(dateQuery.join(" "))}`
      : "";
  const svParam = smartViewId ? `&saved_search_id=${smartViewId}` : "";

  // deno-lint-ignore no-explicit-any
  const leads: any[] = [];
  let hasMore = true;
  let skip = 0;
  while (hasMore && skip < 1000) {
    const res = (await closeGet(
      apiKey,
      `/lead/?_limit=100&_skip=${skip}&_fields=id${queryParam}${svParam}`,
    )) as ApiResult;
    leads.push(...(res.data ?? []));
    hasMore = res.has_more === true;
    skip += 100;
  }

  const leadIdSet = new Set(leads.map((l: { id: string }) => l.id));

  // Fetch all outbound activities
  const actQs = [`_limit=100`];
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
  const callQs = [`_limit=100`, `direction=outbound`];
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

  // If smart view filter, get lead IDs
  let filterLeadIds: Set<string> | null = null;
  if (smartViewId) {
    filterLeadIds = new Set<string>();
    let svHasMore = true;
    let svSkip = 0;
    while (svHasMore && svSkip < 2000) {
      const res = (await closeGet(
        apiKey,
        `/lead/?_limit=100&_skip=${svSkip}&_fields=id&saved_search_id=${smartViewId}`,
      )) as ApiResult;
      for (const lead of res.data ?? []) filterLeadIds.add(lead.id);
      svHasMore = res.has_more === true;
      svSkip += 100;
    }
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

      apiKey = await decrypt(encryptedKey);
    }

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
