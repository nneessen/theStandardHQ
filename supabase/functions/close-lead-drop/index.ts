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
  recipientSmartViewName: string;
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
        const svName = opts.recipientSmartViewName;
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
  _cursor: string | null,
  _limit: number,
): Promise<unknown> {
  // Exhaustive, server-side pagination. We use POST /data/search/ with the
  // smart view's s_query — the only endpoint that honors the filter (we
  // tried /lead/?saved_search_id= and Close silently ignores that param,
  // returning the whole org). The critical piece is forwarding s_query.sort
  // so Close's cursor pagination is stable — without a stable sort, the
  // cursor returns overlapping windows and we see duplicate IDs across
  // pages. When the smart view has an empty sort, we inject a default
  // (date_created desc) to stabilize pagination.
  //
  // Auto-paginates up to MAX_LEADS_PER_DROP so the UI gets one consistent
  // result list instead of a "Load more" button. Anything past that cap
  // can't be dropped anyway.
  const sv = await closeGet<{
    id: string;
    name: string;
    s_query?: unknown;
  }>(apiKey, `/saved_search/${smartViewId}/`);

  const searchQuery = resolveSmartViewQuery(sv?.s_query);
  if (!searchQuery) {
    return { leads: [], has_more: false, cursor: null, total: 0 };
  }

  // Pull sort from s_query if present. Empty arrays aren't a stable sort
  // (Close falls back to relevance/score), so we inject date_created desc.
  const rawSort = (sv?.s_query as { sort?: unknown } | undefined)?.sort;
  const hasExplicitSort = Array.isArray(rawSort) && rawSort.length > 0;
  const sort: unknown = hasExplicitSort
    ? rawSort
    : [
        {
          direction: "desc",
          field: {
            field_name: "date_created",
            object_type: "lead",
            type: "regular_field",
          },
        },
      ];

  const PAGE_SIZE = 100;
  const MAX_PAGES = Math.ceil(MAX_LEADS_PER_DROP / PAGE_SIZE) + 2; // small headroom
  const seen = new Map<string, LeadPreview>();
  let cursor: string | undefined;
  let pagesFetched = 0;
  let truncated = false;
  let rawTotalFetched = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const body: Record<string, unknown> = {
      _limit: PAGE_SIZE,
      query: searchQuery,
      sort,
      _fields: { lead: ["id", "display_name", "status_label", "contacts"] },
    };
    if (cursor) body.cursor = cursor;

    const resp = await closePost<{
      data: LeadPreview[];
      cursor?: string;
    }>(apiKey, "/data/search/", body);

    const rows = resp?.data ?? [];
    rawTotalFetched += rows.length;
    pagesFetched++;

    for (const row of rows) {
      if (!row?.id || !row.id.startsWith("lead_")) continue;
      if (!seen.has(row.id)) seen.set(row.id, row);
    }

    if (seen.size >= MAX_LEADS_PER_DROP) {
      truncated = true;
      break;
    }
    if (!resp?.cursor) break;
    if (rows.length < PAGE_SIZE) break;
    cursor = resp.cursor;
  }

  const leads = Array.from(seen.values()).slice(0, MAX_LEADS_PER_DROP);

  return {
    leads: leads.map((l) => ({
      id: l.id,
      display_name: l.display_name,
      status_label: l.status_label ?? null,
      primary_email: l.contacts?.[0]?.emails?.[0]?.email ?? null,
      primary_phone: l.contacts?.[0]?.phones?.[0]?.phone ?? null,
    })),
    // Frontend no longer paginates — `has_more` stays false and `cursor`
    // is always null. `total` is the unique lead count we actually found.
    has_more: false,
    cursor: null,
    total: leads.length,
    // Diagnostic metadata. `raw_fetched` is the sum of API rows (including
    // cursor duplicates). If raw_fetched > total, Close returned duplicates
    // that we deduped. `truncated` is true when the view has more than
    // MAX_LEADS_PER_DROP matches and we stopped early.
    raw_fetched: rawTotalFetched,
    pages_fetched: pagesFetched,
    truncated,
  };
}

/**
 * Unwrap a saved search's `s_query` into a Query object /data/search/ accepts.
 *
 * Shapes we've seen in the wild:
 *   a) `{ query: {...} }`           — wrapper form used by our AI-created views
 *   b) `{ type: "and", queries: [...] }` — raw Query object (UI-created views)
 *   c) `undefined`                   — smart view without a stored query
 */
function resolveSmartViewQuery(
  sq: unknown,
): Record<string, unknown> | undefined {
  if (!sq || typeof sq !== "object") return undefined;
  const obj = sq as Record<string, unknown>;
  if (obj.query && typeof obj.query === "object") {
    return obj.query as Record<string, unknown>;
  }
  if (typeof obj.type === "string") {
    return obj;
  }
  return undefined;
}

async function handleDebugSmartView(
  apiKey: string,
  smartViewId: string,
): Promise<unknown> {
  const sv = await closeGet<Record<string, unknown>>(
    apiKey,
    `/saved_search/${smartViewId}/`,
  );
  return {
    id: sv?.id ?? null,
    name: sv?.name ?? null,
    s_query: sv?.s_query ?? null,
    resolved_query: resolveSmartViewQuery(sv?.s_query),
    note: "Paste this into the chat so we can confirm the query shape.",
  };
}

/**
 * Exhaustive pagination trace for a smart view. Compares /data/search/ (what
 * we currently use) against /lead/?saved_search_id=... (what the Close UI
 * uses to show the smart view's lead count). Caps at MAX_PAGES to avoid
 * runaway loops if the cursor is unstable.
 */
async function handleTracePreview(
  apiKey: string,
  smartViewId: string,
): Promise<unknown> {
  const MAX_PAGES = 20;
  const PAGE_SIZE = 100;

  const sv = await closeGet<{ name: string; s_query?: unknown }>(
    apiKey,
    `/saved_search/${smartViewId}/`,
  );
  const searchQuery = resolveSmartViewQuery(sv?.s_query);

  // A) authoritative count via /lead/?saved_search_id=...
  let leadEndpointTotal: number | null = null;
  let leadEndpointError: string | null = null;
  try {
    const r = await closeGet<{ total_results?: number }>(
      apiKey,
      `/lead/?saved_search_id=${smartViewId}&_limit=1&_fields=id`,
    );
    leadEndpointTotal = r?.total_results ?? null;
  } catch (e) {
    leadEndpointError = (e as Error).message;
  }

  // B) exhaustive /data/search/ walk, tracking dup vs new per page
  const seen = new Set<string>();
  const pages: Array<{
    page: number;
    fetched: number;
    new: number;
    duplicates: number;
    has_cursor: boolean;
  }> = [];
  let cursor: string | null = null;
  let pageNum = 0;
  let stoppedReason = "completed";

  if (!searchQuery) {
    stoppedReason = "no_search_query";
  } else {
    while (pageNum < MAX_PAGES) {
      const body: Record<string, unknown> = {
        _limit: PAGE_SIZE,
        query: searchQuery,
        _fields: { lead: ["id"] },
      };
      if (cursor) body.cursor = cursor;

      const resp = await closePost<{
        data: Array<{ id: string }>;
        cursor?: string;
        total_results?: number | null;
      }>(apiKey, "/data/search/", body);

      const rows = resp?.data ?? [];
      let dup = 0;
      let fresh = 0;
      for (const row of rows) {
        if (!row?.id) continue;
        if (seen.has(row.id)) dup++;
        else {
          seen.add(row.id);
          fresh++;
        }
      }
      pageNum++;
      pages.push({
        page: pageNum,
        fetched: rows.length,
        new: fresh,
        duplicates: dup,
        has_cursor: !!resp?.cursor,
      });

      if (!resp?.cursor) {
        stoppedReason = "no_cursor";
        break;
      }
      if (rows.length < PAGE_SIZE) {
        stoppedReason = "short_page";
        break;
      }
      cursor = resp.cursor;
    }
    if (pageNum >= MAX_PAGES && stoppedReason === "completed") {
      stoppedReason = "hit_max_pages_cap";
    }
  }

  return {
    smart_view: { id: smartViewId, name: sv?.name ?? null },
    lead_endpoint: {
      total_results: leadEndpointTotal,
      error: leadEndpointError,
      note: "Authoritative count matching Close UI sidebar",
    },
    data_search: {
      unique_ids_returned: seen.size,
      pages_fetched: pageNum,
      stopped_reason: stoppedReason,
      pages,
    },
    verdict:
      leadEndpointTotal != null && seen.size > leadEndpointTotal
        ? "data_search_returns_more_than_ui"
        : leadEndpointTotal != null && seen.size < leadEndpointTotal
          ? "data_search_returns_fewer"
          : "match_or_unknown",
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

      // ── debug_smart_view ──────────────────────────────────────────
      // One-off diagnostic: returns the raw s_query for a smart view so we
      // can confirm whether its object_type scope is being stripped. Safe to
      // keep in place — it only exposes data the caller's own Close API key
      // can already read.
      case "debug_smart_view": {
        const smartViewId = body.smart_view_id as string;
        if (!smartViewId) {
          return jsonResponse({ error: "smart_view_id is required" }, 400, req);
        }
        const apiKey = await getCallerApiKey(user.id);
        const result = await handleDebugSmartView(apiKey, smartViewId);
        return jsonResponse(result, 200, req);
      }

      // ── trace_preview ─────────────────────────────────────────────
      // Exhaustive pagination trace: exhausts /data/search/ cursor-pagination
      // and compares to /lead/?saved_search_id= (the UI's source of truth).
      case "trace_preview": {
        const smartViewId = body.smart_view_id as string;
        if (!smartViewId) {
          return jsonResponse({ error: "smart_view_id is required" }, 400, req);
        }
        const apiKey = await getCallerApiKey(user.id);
        const result = await handleTracePreview(apiKey, smartViewId);
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
        const recipientSmartViewName = (
          body.recipient_smart_view_name as string
        )?.trim();
        const sequenceId = (body.sequence_id as string | null) ?? null;
        const sequenceName = (body.sequence_name as string | null) ?? null;

        if (
          !smartViewId ||
          !smartViewName ||
          !rawLeadIds?.length ||
          !recipientUserId ||
          !leadSourceLabel ||
          !recipientSmartViewName
        ) {
          return jsonResponse(
            {
              error:
                "Missing required fields: smart_view_id, smart_view_name, lead_ids, recipient_user_id, lead_source_label, recipient_smart_view_name",
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
        if (recipientSmartViewName.length > 100) {
          return jsonResponse(
            {
              error:
                "recipient_smart_view_name must be 100 characters or fewer",
            },
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

        // Create the job record. Pre-populating recipient_smart_view_name
        // with the sender-requested name makes the audit trail immediate —
        // if the Smart View creation fails later, history still shows what
        // the sender asked for.
        const { data: job, error: insertErr } = await svc
          .from("lead_drop_jobs")
          .insert({
            sender_user_id: user.id,
            recipient_user_id: recipientUserId,
            smart_view_id: smartViewId,
            smart_view_name: smartViewName,
            lead_source_label: leadSourceLabel,
            recipient_smart_view_name: recipientSmartViewName,
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
            recipientSmartViewName,
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
