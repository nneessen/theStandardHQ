// supabase/functions/close-lead-drop/index.ts
//
// Lead Drop: bulk-transfer leads from one user's Close CRM to another's.
//
// Flow:
//   1. Sender selects a Smart View from their Close CRM
//   2. Previews / deselects leads
//   3. Picks a recipient, sets a lead_source label, optionally picks a sequence
//   4. create_drop_job starts async processing via EdgeRuntime.waitUntil
//   5. Frontend polls get_job_status until complete
//
// Authorization:
//   Any user with an active Close connection can send a drop.
//   Recipients must also have an active Close connection.
//   Caller's own API key is fetched via authenticated RPC.
//   Target's API key is fetched via service-role RPC (never exposed to caller).
//
// Actions (all require valid JWT):
//   get_smart_views          → list caller's Close Smart Views
//   preview_leads            → paginated leads from a Smart View
//   get_recipients           → platform users with active Close (same agency, not self)
//   get_recipient_sequences  → sequences in recipient's Close CRM
//   create_drop_job          → start async drop, returns { job_id } immediately
//   get_job_status           → poll progress
//   get_history              → list past jobs (sent + received)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { decrypt } from "../_shared/encryption.ts";
import { closeGet, closePost } from "./close/client.ts";

// ─── CORS ──────────────────────────────────────────────────────────────────

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

function isLoopback(v?: string | null) {
  return !!v && (v.includes("127.0.0.1") || v.includes("localhost"));
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
  };
}

function jsonResponse(body: unknown, status: number, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// ─── Supabase clients ───────────────────────────────────────────────────────

function getUserClient(req: Request): SupabaseClient {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization")! } },
  });
}

function getServiceClient(): SupabaseClient {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ─── Close API key helpers ──────────────────────────────────────────────────

/**
 * Fetch + decrypt the CALLER'S own Close API key.
 *
 * NOTE: get_close_api_key is REVOKEd from `authenticated` (see
 * 20260331142602_close_config_agency_fallback.sql), so we must use the service
 * client. This is still safe because the user ID comes from a verified JWT —
 * the caller can only retrieve their own key via this path.
 */
async function getCallerApiKey(userId: string): Promise<string> {
  const envKey = Deno.env.get("CLOSE_API_KEY");
  if (envKey) return envKey;

  const svc = getServiceClient();
  const { data: encrypted, error } = await svc.rpc("get_close_api_key", {
    p_user_id: userId,
  });
  if (error || !encrypted) {
    throw Object.assign(
      new Error(
        "Close CRM not connected. Please connect your Close account first.",
      ),
      { code: "CLOSE_NOT_CONNECTED", status: 400 },
    );
  }
  return decrypt(encrypted);
}

/**
 * Fetch + decrypt a RECIPIENT'S Close API key via service role.
 *
 * SECURITY: Never call this without first passing the caller through
 * `authorizeRecipient(userClient, recipientUserId)`. Direct service-role
 * access would allow any authenticated user to drop leads into any other
 * agency's Close account.
 */
async function getRecipientApiKey(recipientUserId: string): Promise<string> {
  const svc = getServiceClient();
  const { data: encrypted, error } = await svc.rpc("get_close_api_key", {
    p_user_id: recipientUserId,
  });
  if (error || !encrypted) {
    throw Object.assign(
      new Error("Recipient's Close account is not connected or inactive."),
      { code: "RECIPIENT_CLOSE_NOT_CONNECTED", status: 412 },
    );
  }
  return decrypt(encrypted);
}

/**
 * Authorize the caller to target `recipientUserId` as a lead-drop recipient.
 * Delegates to `can_clone_close_item_to` — the rule is identical (super-admin
 * OR downline OR sibling with active, non-archived, approved, Close-connected
 * target). The predicate is evaluated under the caller's JWT (userClient),
 * which means auth.uid() inside the function returns the caller, not the
 * service role.
 *
 * Throws 403 on denial, 500 on RPC error. Returns void on success.
 */
async function authorizeRecipient(
  userClient: SupabaseClient,
  recipientUserId: string,
): Promise<void> {
  const { data: allowed, error } = await userClient.rpc(
    "can_clone_close_item_to",
    { p_target_user_id: recipientUserId },
  );
  if (error) {
    throw Object.assign(
      new Error(`Authorization check failed: ${error.message}`),
      { code: "LEAD_DROP_AUTHZ_ERROR", status: 500 },
    );
  }
  if (!allowed) {
    throw Object.assign(
      new Error(
        "You are not authorized to drop leads to this user. They must be in your downline or share your upline, and must have Close connected.",
      ),
      { code: "LEAD_DROP_FORBIDDEN", status: 403 },
    );
  }
}

// ─── Tuning constants ───────────────────────────────────────────────────────

// Hard cap per drop. Rationale: sequential processing at ~300ms/lead + Close
// API rate limits mean > ~500 leads won't complete inside a single edge
// function invocation. Larger drops should be split client-side.
const MAX_LEADS_PER_DROP = 500;

// ─── Types ──────────────────────────────────────────────────────────────────

interface LeadPreview {
  id: string;
  display_name: string;
  status_label: string | null;
  contacts: Array<{
    name: string | null;
    emails: Array<{ email: string }>;
    phones: Array<{ phone: string }>;
  }>;
}

interface CloseLeadDetail {
  id: string;
  display_name: string;
  status_label: string | null;
  contacts: Array<{
    id: string;
    name: string | null;
    emails: Array<{ email: string; type: string }>;
    phones: Array<{ phone: string; type: string }>;
  }>;
  addresses: Array<Record<string, unknown>>;
}

interface CloseCustomField {
  id: string;
  name: string;
  type: string;
  choices?: string[];
}

// ─── processDropJob (async worker) ─────────────────────────────────────────

/**
 * Runs inside EdgeRuntime.waitUntil — no user context, uses service role.
 * Processes each lead sequentially (batches of 10) to respect Close rate limits.
 */
async function processDropJob(opts: {
  jobId: string;
  senderUserId: string;
  recipientUserId: string;
  leadIds: string[];
  leadSourceLabel: string;
  sequenceId: string | null;
  senderName: string;
}): Promise<void> {
  const svc = getServiceClient();

  // On pre-processing fatal errors (e.g. recipient key fetch fails) no result
  // rows are inserted, so get_job_status would show 0/0. Record the failure
  // as N synthetic failed rows so the UI reads "0 created / N failed".
  const markFailed = async (msg: string) => {
    await svc
      .from("lead_drop_jobs")
      .update({
        status: "failed",
        error_message: msg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", opts.jobId);

    if (opts.leadIds.length > 0) {
      const rows = opts.leadIds.map((id) => ({
        job_id: opts.jobId,
        source_lead_id: id,
        status: "failed" as const,
        error_message: msg,
      }));
      await svc.from("lead_drop_results").insert(rows);
    }
  };

  try {
    // 1. Get API keys
    const senderKey = await getRecipientApiKey(opts.senderUserId);
    const recipientKey = await getRecipientApiKey(opts.recipientUserId);

    // 2. Get recipient's custom fields — find lead_source field
    let leadSourceFieldId: string | null = null;
    try {
      const cfResp = await closeGet<{ data: CloseCustomField[] }>(
        recipientKey,
        "/custom_field/lead/?_limit=100",
      );
      const sourceField = (cfResp?.data ?? []).find(
        (f) => f.name.toLowerCase().replace(/[\s_-]/g, "") === "leadsource",
      );
      if (sourceField) leadSourceFieldId = sourceField.id;
    } catch {
      // Non-fatal: proceed without custom field
    }

    // 3. Get recipient's Close user ID
    let recipientCloseUserId: string | null = null;
    try {
      const me = await closeGet<{ id: string }>(recipientKey, "/me/");
      recipientCloseUserId = me?.id ?? null;
    } catch {
      // Non-fatal: sequence enrollment will skip assigned_to
    }

    // 4. Process leads in batches of 10
    const BATCH_SIZE = 10;
    const BATCH_DELAY_MS = 60; // ~16 batches/sec, well under Close's 100 req/s limit

    for (let i = 0; i < opts.leadIds.length; i += BATCH_SIZE) {
      const batch = opts.leadIds.slice(i, i + BATCH_SIZE);

      for (const sourceLeadId of batch) {
        let sourceLeadName: string | null = null;
        let destLeadId: string | null = null;

        try {
          // a. Fetch lead details from sender's CRM
          const lead = await closeGet<CloseLeadDetail>(
            senderKey,
            `/lead/${sourceLeadId}/?_fields=id,display_name,status_label,contacts,addresses`,
          );
          sourceLeadName = lead.display_name ?? null;

          // b. Build payload for recipient's CRM. Strip any `id` field from
          // addresses — Close rejects inherited IDs from the source org.
          // Contacts are already rebuilt from scratch (no id leak).
          const payload: Record<string, unknown> = {
            display_name: lead.display_name,
            addresses: (lead.addresses ?? []).map((addr) => {
              const { id: _omit, ...rest } = addr as Record<string, unknown> & {
                id?: unknown;
              };
              return rest;
            }),
            contacts: (lead.contacts ?? []).map((c) => ({
              name: c.name,
              emails: c.emails ?? [],
              phones: c.phones ?? [],
            })),
          };

          // Stamp lead_source custom field if it exists in recipient's CRM
          if (leadSourceFieldId) {
            payload[`custom.${leadSourceFieldId}`] = opts.leadSourceLabel;
          }

          // c. Create lead in recipient's CRM
          const created = await closePost<{ id: string }>(
            recipientKey,
            "/lead/",
            payload,
          );
          destLeadId = created.id;

          // d. Enroll in sequence if requested
          if (opts.sequenceId && destLeadId) {
            try {
              const subPayload: Record<string, unknown> = {
                lead_id: destLeadId,
                sequence_id: opts.sequenceId,
              };
              if (recipientCloseUserId) {
                subPayload.assigned_to = recipientCloseUserId;
              }
              await closePost(
                recipientKey,
                "/sequence_subscription/",
                subPayload,
              );
            } catch (seqErr) {
              // Non-fatal: lead was created, enrollment failed
              console.warn(
                `[lead-drop] Sequence enrollment failed for lead ${destLeadId}:`,
                (seqErr as Error).message,
              );
            }
          }

          // e. Record success
          await svc.from("lead_drop_results").insert({
            job_id: opts.jobId,
            source_lead_id: sourceLeadId,
            source_lead_name: sourceLeadName,
            dest_lead_id: destLeadId,
            status: "created",
          });
        } catch (leadErr) {
          // Record failure for this individual lead
          await svc.from("lead_drop_results").insert({
            job_id: opts.jobId,
            source_lead_id: sourceLeadId,
            source_lead_name: sourceLeadName,
            status: "failed",
            error_message: (leadErr as Error).message?.slice(0, 500),
          });
        }
      }

      // Rate-limit courtesy delay between batches
      if (i + BATCH_SIZE < opts.leadIds.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    // 5. Create Smart View in recipient's CRM
    let recipientSmartViewId: string | null = null;
    let recipientSmartViewName: string | null = null;

    if (leadSourceFieldId) {
      try {
        const svName = `Lead Drop from ${opts.senderName} – ${new Date().toISOString().slice(0, 10)}`;
        const sv = await closePost<{ id: string }>(
          recipientKey,
          "/saved_search/",
          {
            name: svName,
            query: {
              type: "and",
              queries: [
                {
                  type: "text",
                  field: {
                    type: "custom_field",
                    custom_field_id: leadSourceFieldId,
                  },
                  query: opts.leadSourceLabel,
                },
              ],
            },
          },
        );
        recipientSmartViewId = sv.id;
        recipientSmartViewName = svName;
      } catch (svErr) {
        console.warn(
          "[lead-drop] Failed to create Smart View in recipient's CRM:",
          (svErr as Error).message,
        );
        // Non-fatal: leads were still created
      }
    }

    // 6. Mark job complete
    await svc
      .from("lead_drop_jobs")
      .update({
        status: "completed",
        recipient_smart_view_id: recipientSmartViewId,
        recipient_smart_view_name: recipientSmartViewName,
        completed_at: new Date().toISOString(),
      })
      .eq("id", opts.jobId);
  } catch (err) {
    console.error(
      "[lead-drop] processDropJob fatal error:",
      (err as Error).message,
    );
    await markFailed((err as Error).message?.slice(0, 500));
  }
}

// ─── Action handlers ────────────────────────────────────────────────────────

async function handleGetSmartViews(apiKey: string): Promise<unknown> {
  const resp = await closeGet<{
    data: Array<{ id: string; name: string; query: unknown }>;
    has_more: boolean;
  }>(apiKey, "/saved_search/?_limit=100");
  return { smart_views: resp?.data ?? [] };
}

async function handlePreviewLeads(
  apiKey: string,
  smartViewId: string,
  cursor: string | null,
  limit: number,
): Promise<unknown> {
  // Fetch smart view — Close stores the search query under s_query.query.
  // Only needed on the first page; subsequent pages use the cursor alone.
  // We still fetch it per call because the cursor embeds the query state.
  const sv = await closeGet<{
    id: string;
    name: string;
    s_query?: { query?: unknown };
  }>(apiKey, `/saved_search/${smartViewId}/`);

  const searchQuery = sv?.s_query?.query;
  if (!searchQuery) {
    return { leads: [], has_more: false, cursor: null, total: null };
  }

  // /data/search/ is cursor-based (NOT _skip-based). See close-kpi-data for
  // the canonical usage. Pass `cursor` on subsequent pages.
  const body: Record<string, unknown> = {
    _limit: limit,
    query: searchQuery,
    _fields: { lead: ["id", "display_name", "status_label", "contacts"] },
  };
  if (cursor) body.cursor = cursor;

  const searchResp = await closePost<{
    data: LeadPreview[];
    total_results: number | null;
    cursor?: string;
  }>(apiKey, "/data/search/", body);

  const leads = searchResp?.data ?? [];
  const nextCursor = searchResp?.cursor ?? null;
  return {
    leads: leads.map((l) => ({
      id: l.id,
      display_name: l.display_name,
      status_label: l.status_label ?? null,
      primary_email: l.contacts?.[0]?.emails?.[0]?.email ?? null,
      primary_phone: l.contacts?.[0]?.phones?.[0]?.phone ?? null,
    })),
    has_more: !!nextCursor,
    cursor: nextCursor,
    total: searchResp?.total_results ?? null,
  };
}

async function handleGetRecipients(
  userClient: SupabaseClient,
  svc: SupabaseClient,
): Promise<unknown> {
  // Delegate tenancy to get_teammates_with_close_connected (same rule as
  // can_clone_close_item_to — super-admin / downline / sibling + active Close).
  // Evaluated under caller's JWT — no agency_id fallthrough bug.
  const { data: teammates, error } = await userClient.rpc(
    "get_teammates_with_close_connected",
  );
  if (error) {
    throw Object.assign(
      new Error(`Failed to load recipients: ${error.message}`),
      { status: 500 },
    );
  }

  type TeammateRow = {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    organization_name: string | null;
  };
  const rows = (teammates as TeammateRow[]) ?? [];
  if (rows.length === 0) return { recipients: [] };

  // Second query for profile photos — not exposed by the picker RPC.
  const ids = rows.map((r) => r.user_id);
  const { data: photos } = await svc
    .from("user_profiles")
    .select("id, profile_photo_url")
    .in("id", ids);
  const photoById = new Map(
    ((photos as { id: string; profile_photo_url: string | null }[]) ?? []).map(
      (p) => [p.id, p.profile_photo_url],
    ),
  );

  return {
    recipients: rows.map((u) => ({
      id: u.user_id,
      full_name:
        [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email,
      email: u.email,
      profile_photo_url: photoById.get(u.user_id) ?? null,
      organization_name: u.organization_name,
    })),
  };
}

async function handleGetRecipientSequences(
  userClient: SupabaseClient,
  recipientUserId: string,
): Promise<unknown> {
  // AUTHZ: must pass BEFORE any service-role key fetch.
  await authorizeRecipient(userClient, recipientUserId);

  const recipientKey = await getRecipientApiKey(recipientUserId);

  const resp = await closeGet<{
    data: Array<{
      id: string;
      name: string;
      status: string;
      allow_manual_enrollment: boolean;
      steps: unknown[];
    }>;
    has_more: boolean;
  }>(recipientKey, "/sequence/?_limit=100");

  const sequences = (resp?.data ?? [])
    .filter((s) => s.status !== "archived")
    .map((s) => ({
      id: s.id,
      name: s.name,
      steps_count: Array.isArray(s.steps) ? s.steps.length : 0,
      allow_manual_enrollment: s.allow_manual_enrollment,
    }));

  return { sequences };
}

async function handleGetJobStatus(
  svc: SupabaseClient,
  jobId: string,
  callerId: string,
): Promise<unknown> {
  const { data: job, error } = await svc
    .from("lead_drop_jobs")
    .select("*")
    .eq("id", jobId)
    .or(`sender_user_id.eq.${callerId},recipient_user_id.eq.${callerId}`)
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!job) throw Object.assign(new Error("Job not found"), { status: 404 });

  // H-5: counters are not updated inline by processDropJob. Compute live
  // progress by counting lead_drop_results rows so the UI progress bar can
  // update as the drop runs. Terminal runs will usually also have the
  // completed_at + status set on the job row.
  const { data: counts } = await svc
    .from("lead_drop_results")
    .select("status")
    .eq("job_id", jobId);
  const rows = (counts as { status: string }[] | null) ?? [];
  const created = rows.filter((r) => r.status === "created").length;
  const failed = rows.filter((r) => r.status === "failed").length;

  return {
    job: {
      ...job,
      created_leads: created,
      failed_leads: failed,
    },
  };
}

async function handleGetHistory(
  svc: SupabaseClient,
  callerId: string,
): Promise<unknown> {
  const { data, error } = await svc
    .from("lead_drop_jobs")
    .select(
      `
      id, smart_view_name, lead_source_label, sequence_name,
      status, total_leads, created_leads, failed_leads,
      recipient_smart_view_id, recipient_smart_view_name,
      created_at, completed_at,
      sender:sender_user_id(first_name, last_name, email, profile_photo_url),
      recipient:recipient_user_id(first_name, last_name, email, profile_photo_url)
    `,
    )
    .or(`sender_user_id.eq.${callerId},recipient_user_id.eq.${callerId}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return { jobs: data ?? [] };
}

async function handleGetJobResults(
  svc: SupabaseClient,
  jobId: string,
  callerId: string,
): Promise<unknown> {
  // Verify access
  const { data: job } = await svc
    .from("lead_drop_jobs")
    .select("id")
    .eq("id", jobId)
    .or(`sender_user_id.eq.${callerId},recipient_user_id.eq.${callerId}`)
    .maybeSingle();
  if (!job) throw Object.assign(new Error("Job not found"), { status: 404 });

  const { data, error } = await svc
    .from("lead_drop_results")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at");
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return { results: data ?? [] };
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, req);
  }

  const action = body.action as string;
  if (!action) {
    return jsonResponse({ error: "Missing action" }, 400, req);
  }

  // ── Auth ──
  const userClient = getUserClient(req);
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();
  if (authErr || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401, req);
  }

  const svc = getServiceClient();

  // Caller display name — used to label the auto-created Smart View in the
  // recipient's CRM. agency_id is no longer used: tenant boundary is enforced
  // by the can_clone_close_item_to / get_teammates_with_close_connected RPCs.
  const { data: callerProfile } = await svc
    .from("user_profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  const callerName =
    [callerProfile?.first_name, callerProfile?.last_name]
      .filter(Boolean)
      .join(" ") ||
    user.email ||
    "A teammate";

  try {
    switch (action) {
      // ── get_smart_views ───────────────────────────────────────────
      case "get_smart_views": {
        const apiKey = await getCallerApiKey(user.id);
        const result = await handleGetSmartViews(apiKey);
        return jsonResponse(result, 200, req);
      }

      // ── preview_leads ─────────────────────────────────────────────
      case "preview_leads": {
        const smartViewId = body.smart_view_id as string;
        if (!smartViewId) {
          return jsonResponse({ error: "smart_view_id is required" }, 400, req);
        }
        const cursor = (body.cursor as string | null) ?? null;
        const limit = Math.min(Number(body._limit ?? 100), 100);
        const apiKey = await getCallerApiKey(user.id);
        const result = await handlePreviewLeads(
          apiKey,
          smartViewId,
          cursor,
          limit,
        );
        return jsonResponse(result, 200, req);
      }

      // ── get_recipients ────────────────────────────────────────────
      case "get_recipients": {
        const result = await handleGetRecipients(userClient, svc);
        return jsonResponse(result, 200, req);
      }

      // ── get_recipient_sequences ───────────────────────────────────
      case "get_recipient_sequences": {
        const recipientUserId = body.recipient_user_id as string;
        if (!recipientUserId) {
          return jsonResponse(
            { error: "recipient_user_id is required" },
            400,
            req,
          );
        }
        // authorizeRecipient also blocks self-targeting, but short-circuit
        // with a 400 for a clearer error.
        if (recipientUserId === user.id) {
          return jsonResponse(
            { error: "Cannot drop leads to yourself" },
            400,
            req,
          );
        }
        const result = await handleGetRecipientSequences(
          userClient,
          recipientUserId,
        );
        return jsonResponse(result, 200, req);
      }

      // ── create_drop_job ───────────────────────────────────────────
      case "create_drop_job": {
        const smartViewId = body.smart_view_id as string;
        const smartViewName = body.smart_view_name as string;
        const rawLeadIds = body.lead_ids as string[];
        const recipientUserId = body.recipient_user_id as string;
        const leadSourceLabel = (body.lead_source_label as string)?.trim();
        const sequenceId = (body.sequence_id as string | null) ?? null;
        const sequenceName = (body.sequence_name as string | null) ?? null;

        if (
          !smartViewId ||
          !smartViewName ||
          !rawLeadIds?.length ||
          !recipientUserId ||
          !leadSourceLabel
        ) {
          return jsonResponse(
            {
              error:
                "Missing required fields: smart_view_id, smart_view_name, lead_ids, recipient_user_id, lead_source_label",
            },
            400,
            req,
          );
        }
        if (recipientUserId === user.id) {
          return jsonResponse(
            { error: "Cannot drop leads to yourself" },
            400,
            req,
          );
        }
        if (leadSourceLabel.length > 200) {
          return jsonResponse(
            { error: "lead_source_label must be 200 characters or fewer" },
            400,
            req,
          );
        }

        // H-6: dedupe + cap. Cap is generous (500) given that the process is
        // sequential and the edge function has a wall-clock timeout.
        const leadIds = Array.from(new Set(rawLeadIds));
        if (leadIds.length > MAX_LEADS_PER_DROP) {
          return jsonResponse(
            {
              error: `Too many leads in a single drop. Maximum is ${MAX_LEADS_PER_DROP}; received ${leadIds.length}.`,
            },
            400,
            req,
          );
        }

        // H-2: authorize BEFORE touching service-role resources. This also
        // covers the "recipient has active Close connection" check (the
        // predicate requires cc.is_active = TRUE).
        await authorizeRecipient(userClient, recipientUserId);

        // Create the job record
        const { data: job, error: insertErr } = await svc
          .from("lead_drop_jobs")
          .insert({
            sender_user_id: user.id,
            recipient_user_id: recipientUserId,
            smart_view_id: smartViewId,
            smart_view_name: smartViewName,
            lead_source_label: leadSourceLabel,
            sequence_id: sequenceId,
            sequence_name: sequenceName,
            status: "running",
            total_leads: leadIds.length,
          })
          .select("id")
          .single();

        if (insertErr || !job) {
          return jsonResponse({ error: "Failed to create drop job" }, 500, req);
        }

        // Fire-and-forget: process the drop in the background
        // deno-lint-ignore no-explicit-any
        (globalThis as any).EdgeRuntime?.waitUntil(
          processDropJob({
            jobId: job.id,
            senderUserId: user.id,
            recipientUserId,
            leadIds,
            leadSourceLabel,
            sequenceId,
            senderName: callerName,
          }),
        );

        return jsonResponse({ job_id: job.id }, 200, req);
      }

      // ── get_job_status ────────────────────────────────────────────
      case "get_job_status": {
        const jobId = body.job_id as string;
        if (!jobId)
          return jsonResponse({ error: "job_id is required" }, 400, req);
        const result = await handleGetJobStatus(svc, jobId, user.id);
        return jsonResponse(result, 200, req);
      }

      // ── get_history ───────────────────────────────────────────────
      case "get_history": {
        const result = await handleGetHistory(svc, user.id);
        return jsonResponse(result, 200, req);
      }

      // ── get_job_results ───────────────────────────────────────────
      case "get_job_results": {
        const jobId = body.job_id as string;
        if (!jobId)
          return jsonResponse({ error: "job_id is required" }, 400, req);
        const result = await handleGetJobResults(svc, jobId, user.id);
        return jsonResponse(result, 200, req);
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400, req);
    }
  } catch (err) {
    const e = err as Error & { code?: string; status?: number };
    const status = e.status ?? 500;
    console.error(`[close-lead-drop] action=${action} error:`, e.message);
    return jsonResponse(
      { error: e.message, code: e.code ?? "INTERNAL_ERROR" },
      status,
      req,
    );
  }
});
