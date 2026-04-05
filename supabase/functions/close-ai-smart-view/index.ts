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
  // 1. Fetch top N leads by AI score — only untouched/initial leads
  // Patterns kept in sync with EXCLUDED_STATUS_PATTERNS in lead-heat.ts
  const excludedPatterns = [
    "sold",
    "won",
    "policy pending",
    "policy issued",
    "issued and paid",
    "bound",
    "in force",
    "active policy",
    "appointment",
    "not interested",
    "do not contact",
    "dnc",
    "disqualified",
    "declined",
    "contacted",
    "spoke",
    "texting",
    "call back",
    "callback",
    "voicemail",
    "no answer",
    "straight to vm",
    "hung up",
    "bad number",
    "wrong number",
    "doesn't ring",
    "doesnt ring",
    "blocked",
    "not in service",
    "dead",
    "lost",
    "no show",
    "quoted",
    "application",
    "underwriting",
  ];

  let topLeadsQuery = dataClient
    .from("lead_heat_scores")
    .select("close_lead_id, score, display_name")
    .eq("user_id", userId)
    .not("signals->>hasWonOpportunity", "eq", "true");

  for (const pattern of excludedPatterns) {
    topLeadsQuery = topLeadsQuery.not(
      "signals->>currentStatusLabel",
      "ilike",
      `%${pattern}%`,
    );
  }

  const { data: topLeads, error: queryError } = await topLeadsQuery
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

    if (action === "provision_agent_pipelines") {
      // Service-role only — provisions opportunity statuses, lead statuses, and workflows for all agents
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const authHeader3 = req.headers.get("authorization") || "";
      const token3 = authHeader3.replace(/^Bearer\s*/i, "").trim();
      if (!serviceKey || !token3 || token3 !== serviceKey) {
        return jsonResponse(
          { error: "Forbidden: service_role only" },
          403,
          req,
        );
      }

      const { data: configs } = await dataClient
        .from("close_config")
        .select("user_id, api_key_encrypted")
        .eq("is_active", true);

      if (!configs?.length) {
        return jsonResponse({ error: "No active configs" }, 400, req);
      }

      const results = [];
      for (const cfg of configs) {
        try {
          const key = await decrypt(cfg.api_key_encrypted);
          const result = await provisionAgentPipeline(key, cfg.user_id);
          results.push(result);
        } catch (err) {
          results.push({
            userId: cfg.user_id,
            error: (err as Error).message,
          });
        }
      }

      return jsonResponse({ results }, 200, req);
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

// ─── Agent Pipeline Provisioning ──────────────────────────────────

// Required lead statuses that trigger workflows
const REQUIRED_LEAD_STATUSES = [
  "Appointment Scheduled By Me",
  "Appointment By Bot",
  "Appointment Scheduled By Lead",
  "Contacted/Missed Appointment",
  "Disqualified/Declined",
  "PENDING UNDERWRITING",
  "Contacted/Quoted",
];

// Required opportunity statuses in order
const REQUIRED_OPP_STATUSES: {
  label: string;
  type: "active" | "won" | "lost";
}[] = [
  { label: "Appointment Set", type: "active" },
  { label: "No Show", type: "active" },
  { label: "Quoted", type: "active" },
  { label: "Application", type: "active" },
  { label: "Underwriting", type: "active" },
  { label: "Sold", type: "won" },
  { label: "Lost", type: "lost" },
];

async function provisionAgentPipeline(apiKey: string, userId: string) {
  const log: string[] = [];

  // 1. Ensure lead statuses exist
  // deno-lint-ignore no-explicit-any
  const leadStatusRes = (await closeGet(apiKey, "/status/lead/")) as any;
  const existingLeadStatuses = (leadStatusRes.data ?? []) as {
    id: string;
    label: string;
  }[];
  const leadStatusMap = new Map(
    existingLeadStatuses.map((s) => [s.label.toLowerCase(), s.id]),
  );

  for (const required of REQUIRED_LEAD_STATUSES) {
    if (!leadStatusMap.has(required.toLowerCase())) {
      // deno-lint-ignore no-explicit-any
      const created = (await closePost(apiKey, "/status/lead/", {
        label: required,
      })) as any;
      leadStatusMap.set(required.toLowerCase(), created.id);
      log.push(`Created lead status: ${required} (${created.id})`);
    }
  }

  // 2. Ensure opportunity pipeline + statuses exist
  // deno-lint-ignore no-explicit-any
  const pipeRes = (await closeGet(apiKey, "/pipeline/")) as any;
  const pipelines = (pipeRes.data ?? []) as { id: string; name: string }[];
  let pipelineId = pipelines[0]?.id;

  if (!pipelineId) {
    // deno-lint-ignore no-explicit-any
    const newPipe = (await closePost(apiKey, "/pipeline/", {
      name: "Sales",
    })) as any;
    pipelineId = newPipe.id;
    log.push(`Created pipeline: Sales (${pipelineId})`);
  }

  // Get existing opportunity statuses
  // deno-lint-ignore no-explicit-any
  const oppStatusRes = (await closeGet(apiKey, "/status/opportunity/")) as any;
  const existingOppStatuses = (oppStatusRes.data ?? []) as {
    id: string;
    label: string;
    type: string;
    pipeline_id: string;
  }[];
  const oppStatusMap = new Map(
    existingOppStatuses
      .filter((s) => s.pipeline_id === pipelineId)
      .map((s) => [s.label.toLowerCase(), s.id]),
  );

  for (const required of REQUIRED_OPP_STATUSES) {
    if (!oppStatusMap.has(required.label.toLowerCase())) {
      // deno-lint-ignore no-explicit-any
      const created = (await closePost(apiKey, "/status/opportunity/", {
        label: required.label,
        type: required.type,
        pipeline_id: pipelineId,
      })) as any;
      oppStatusMap.set(required.label.toLowerCase(), created.id);
      log.push(`Created opp status: ${required.label} (${created.id})`);
    }
  }

  // 3. Resolve all status IDs
  const getLeadStatusId = (name: string) =>
    leadStatusMap.get(name.toLowerCase());
  const getOppStatusId = (name: string) => oppStatusMap.get(name.toLowerCase());

  const appointmentSetOpp = getOppStatusId("Appointment Set");
  const noShowOpp = getOppStatusId("No Show");
  const quotedOpp = getOppStatusId("Quoted");
  const underwritingOpp = getOppStatusId("Underwriting");
  const lostOpp = getOppStatusId("Lost");

  const appointByMe = getLeadStatusId("Appointment Scheduled By Me");
  const appointByBot = getLeadStatusId("Appointment By Bot");
  const appointByLead = getLeadStatusId("Appointment Scheduled By Lead");
  const missedAppt = getLeadStatusId("Contacted/Missed Appointment");
  const disqualified = getLeadStatusId("Disqualified/Declined");
  const pendingUw = getLeadStatusId("PENDING UNDERWRITING");
  const contactedQuoted = getLeadStatusId("Contacted/Quoted");

  // 4. Check existing workflows to avoid duplicates
  // deno-lint-ignore no-explicit-any
  const wfRes = (await closeGet(apiKey, "/sequence/?_limit=100")) as any;
  const existingWorkflows = (wfRes.data ?? []) as {
    id: string;
    name: string;
  }[];
  const wfNames = new Set(existingWorkflows.map((w) => w.name.toLowerCase()));

  // 5. Create workflows
  const workflowsToCreate: {
    name: string;
    triggerStatusIds: string[];
    step:
      | { type: "create-opportunity"; statusId: string; confidence?: number }
      | { type: "update-opportunity"; statusId: string; confidence?: number };
  }[] = [
    {
      name: "Auto: Create Opportunity on Appointment",
      triggerStatusIds: [appointByMe, appointByBot, appointByLead].filter(
        Boolean,
      ) as string[],
      step: {
        type: "create-opportunity",
        statusId: appointmentSetOpp!,
      },
    },
    {
      name: "Auto: Update Opp → Lost",
      triggerStatusIds: disqualified ? [disqualified] : [],
      step: { type: "update-opportunity", statusId: lostOpp!, confidence: 1 },
    },
    {
      name: "Auto: Update Opp → No Show",
      triggerStatusIds: missedAppt ? [missedAppt] : [],
      step: {
        type: "update-opportunity",
        statusId: noShowOpp!,
        confidence: 20,
      },
    },
    {
      name: "Auto: Update Opp → Underwriting",
      triggerStatusIds: pendingUw ? [pendingUw] : [],
      step: {
        type: "update-opportunity",
        statusId: underwritingOpp!,
        confidence: 90,
      },
    },
    {
      name: "Auto: Update Opp → Quoted",
      triggerStatusIds: contactedQuoted ? [contactedQuoted] : [],
      step: {
        type: "update-opportunity",
        statusId: quotedOpp!,
        confidence: 75,
      },
    },
  ];

  const createdWorkflows: string[] = [];
  const skippedWorkflows: string[] = [];

  for (const wf of workflowsToCreate) {
    if (wfNames.has(wf.name.toLowerCase())) {
      skippedWorkflows.push(wf.name);
      continue;
    }
    if (wf.triggerStatusIds.length === 0 || !wf.step.statusId) {
      log.push(`Skipped ${wf.name}: missing status IDs`);
      continue;
    }

    // Build the workflow payload matching Close's native sequence API format
    // (discovered from existing workflows via the Close MCP tool)
    // deno-lint-ignore no-explicit-any
    const steps: any[] = [];
    if (wf.step.type === "create-opportunity") {
      steps.push({
        step_type: "create-opportunity",
        delay: "PT0S",
        field_mappings: {
          lead_id: { value: "{{trigger.subject.id}}" },
          contact_id: { value: "{{trigger.subject.primary_contact_id}}" },
          status_id: { value: wf.step.statusId },
          confidence: { value: 20 },
          value_period: { value: "one_time" },
        },
      });
    } else {
      steps.push({
        step_type: "update-opportunity",
        delay: "PT0S",
        field_mappings: {
          status_id: { value: wf.step.statusId },
          confidence: { value: wf.step.confidence ?? 50 },
        },
      });
    }

    const payload = {
      name: wf.name,
      status: "active",
      timezone: "America/New_York",
      trigger: {
        type: "lead-event",
        event_types: "created_and_updated",
        filters: [
          {
            filter_type: "status_id-any_of",
            values: wf.triggerStatusIds,
          },
        ],
      },
      steps,
    };

    try {
      // deno-lint-ignore no-explicit-any
      const created = (await closePost(apiKey, "/sequence/", payload)) as any;
      createdWorkflows.push(`${wf.name} (${created.id})`);
      log.push(`Created workflow: ${wf.name} (${created.id})`);
    } catch (err) {
      log.push(
        `Failed to create workflow ${wf.name}: ${(err as Error).message}`,
      );
    }
  }

  // 6. Register webhook for lead status changes (if not already registered)
  const WEBHOOK_URL =
    "https://pcyaqwodnyrpkaiojnpz.supabase.co/functions/v1/close-webhook-handler";
  let webhookStatus = "skipped";
  try {
    // deno-lint-ignore no-explicit-any
    const whRes = (await closeGet(apiKey, "/webhook/?_limit=100")) as any;
    const existingWebhooks = (whRes.data ?? []) as {
      id: string;
      url: string;
    }[];
    const hasWebhook = existingWebhooks.some((wh) => wh.url === WEBHOOK_URL);

    if (!hasWebhook) {
      await closePost(apiKey, "/webhook/", {
        url: WEBHOOK_URL,
        events: [{ object_type: "lead", action: "updated" }],
      });
      webhookStatus = "created";
      log.push("Registered webhook for lead status changes");
    } else {
      webhookStatus = "already_exists";
      log.push("Webhook already registered");
    }
  } catch (err) {
    webhookStatus = "failed";
    log.push(`Failed to register webhook: ${(err as Error).message}`);
  }

  return {
    userId,
    pipelineId,
    leadStatusesEnsured: REQUIRED_LEAD_STATUSES.length,
    oppStatusesEnsured: REQUIRED_OPP_STATUSES.length,
    workflowsCreated: createdWorkflows,
    workflowsSkipped: skippedWorkflows,
    webhookStatus,
    log,
  };
}
