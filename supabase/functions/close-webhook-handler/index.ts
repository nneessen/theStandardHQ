// supabase/functions/close-webhook-handler/index.ts
// Receives Close CRM webhooks for lead status changes.
// Automatically creates/updates opportunities based on lead status transitions.
// Zero per-agent config — works for all agents as soon as they connect Close.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { decrypt } from "../_shared/encryption.ts";

// ─── Constants ────────────────────────────────────────────────────

const CLOSE_API_BASE = "https://api.close.com/api/v1";

// Lead status labels that trigger opportunity actions (case-insensitive)
// These match across all agents regardless of their specific status IDs
const APPOINTMENT_PATTERNS = [
  "appointment scheduled by me",
  "appointment by bot",
  "appointment scheduled by lead",
];

const STATUS_TO_OPP_ACTION: Record<
  string,
  { action: "create" | "update"; oppStatusLabel: string; confidence: number }
> = {};

// Populate the map — appointment statuses create opportunities
for (const pattern of APPOINTMENT_PATTERNS) {
  STATUS_TO_OPP_ACTION[pattern] = {
    action: "create",
    oppStatusLabel: "Appointment Set",
    confidence: 20,
  };
}

// Status changes that update existing opportunities
const UPDATE_MAPPINGS: {
  leadStatusPattern: string;
  oppStatusLabel: string;
  confidence: number;
}[] = [
  {
    leadStatusPattern: "disqualified/declined",
    oppStatusLabel: "Lost",
    confidence: 0,
  },
  {
    leadStatusPattern: "contacted/missed appointment",
    oppStatusLabel: "No Show",
    confidence: 20,
  },
  {
    leadStatusPattern: "pending underwriting",
    oppStatusLabel: "Underwriting",
    confidence: 90,
  },
  {
    leadStatusPattern: "contacted/quoted",
    oppStatusLabel: "Quoted",
    confidence: 75,
  },
];

for (const mapping of UPDATE_MAPPINGS) {
  STATUS_TO_OPP_ACTION[mapping.leadStatusPattern] = {
    action: "update",
    oppStatusLabel: mapping.oppStatusLabel,
    confidence: mapping.confidence,
  };
}

// ─── CORS ─────────────────────────────────────────────────────────

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, close-sig-hash, close-sig-timestamp",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
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

  if (res.status === 429) {
    const wait = parseInt(res.headers.get("retry-after") ?? "3", 10);
    await new Promise((r) => setTimeout(r, wait * 1000));
    const retry = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(15_000),
    });
    if (!retry.ok) {
      throw new Error(`Close API rate limit after retry`);
    }
    return retry;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Close API ${res.status}: ${errText.substring(0, 200)}`);
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

async function closeGet(apiKey: string, path: string) {
  const res = await closeApiFetch(`${CLOSE_API_BASE}${path}`, {
    headers: closeHeaders(apiKey),
  });
  return res.json();
}

async function closePost(
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
) {
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
) {
  const res = await closeApiFetch(`${CLOSE_API_BASE}${path}`, {
    method: "PUT",
    headers: closeHeaders(apiKey),
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── Opportunity Logic ────────────────────────────────────────────

async function findOppStatusId(
  apiKey: string,
  label: string,
): Promise<string | null> {
  // deno-lint-ignore no-explicit-any
  const res = (await closeGet(apiKey, "/status/opportunity/")) as any;
  const statuses = (res.data ?? []) as { id: string; label: string }[];
  return (
    statuses.find((s) => s.label.toLowerCase() === label.toLowerCase())?.id ??
    null
  );
}

async function findNewestOpportunity(
  apiKey: string,
  leadId: string,
): Promise<{ id: string; status_id: string } | null> {
  // deno-lint-ignore no-explicit-any
  const res = (await closeGet(
    apiKey,
    `/opportunity/?lead_id=${leadId}&_order_by=-date_created&_limit=1&_fields=id,status_id`,
  )) as any;
  const opps = res.data ?? [];
  return opps[0] ?? null;
}

async function handleLeadStatusChange(
  apiKey: string,
  leadId: string,
  newStatusLabel: string,
  _userId: string,
) {
  const normalizedStatus = newStatusLabel.toLowerCase().trim();

  // Check if this status maps to an opportunity action
  const mapping = STATUS_TO_OPP_ACTION[normalizedStatus];
  if (!mapping) {
    return {
      action: "ignored",
      reason: `Status "${newStatusLabel}" has no opp mapping`,
    };
  }

  // Resolve the opportunity status ID
  const oppStatusId = await findOppStatusId(apiKey, mapping.oppStatusLabel);
  if (!oppStatusId) {
    return {
      action: "error",
      reason: `Opp status "${mapping.oppStatusLabel}" not found — run provision_agent_pipelines first`,
    };
  }

  if (mapping.action === "create") {
    // Check if lead already has an active opportunity to avoid duplicates
    const existing = await findNewestOpportunity(apiKey, leadId);
    if (existing) {
      // Update the existing one instead of creating a duplicate
      // deno-lint-ignore no-explicit-any
      const updated = (await closePut(apiKey, `/opportunity/${existing.id}/`, {
        status_id: oppStatusId,
        confidence: mapping.confidence,
      })) as any;
      return {
        action: "updated_existing",
        opportunityId: updated.id,
        status: mapping.oppStatusLabel,
      };
    }

    // Create new opportunity
    // deno-lint-ignore no-explicit-any
    const created = (await closePost(apiKey, "/opportunity/", {
      lead_id: leadId,
      status_id: oppStatusId,
      confidence: mapping.confidence,
      value: 0,
      value_period: "one_time",
    })) as any;

    return {
      action: "created",
      opportunityId: created.id,
      status: mapping.oppStatusLabel,
    };
  }

  // Update: find newest opportunity and update its status
  const newest = await findNewestOpportunity(apiKey, leadId);
  if (!newest) {
    return {
      action: "skipped",
      reason: `No existing opportunity on lead to update`,
    };
  }

  // deno-lint-ignore no-explicit-any
  const updated = (await closePut(apiKey, `/opportunity/${newest.id}/`, {
    status_id: oppStatusId,
    confidence: mapping.confidence,
  })) as any;

  return {
    action: "updated",
    opportunityId: updated.id,
    status: mapping.oppStatusLabel,
  };
}

// ─── Webhook Audit Logging ────────────────────────────────────────

interface WebhookLogRow {
  organization_id: string | null;
  lead_id: string | null;
  user_id: string | null;
  event_action: string | null;
  status_label: string | null;
  changed_fields: string[] | null;
  outcome: string;
  outcome_reason: string | null;
  opportunity_id: string | null;
  error_message: string | null;
  raw_payload: unknown;
}

// deno-lint-ignore no-explicit-any
async function persistWebhookLog(client: any, row: WebhookLogRow) {
  try {
    const { error } = await client.from("close_webhook_logs").insert(row);
    if (error) {
      console.error("[close-webhook-handler] Failed to log:", error.message);
    }
  } catch (err) {
    console.error("[close-webhook-handler] Logging threw:", err);
  }
}

function buildResponseAndLog(
  // deno-lint-ignore no-explicit-any
  client: any,
  base: Omit<WebhookLogRow, "outcome">,
  // deno-lint-ignore no-explicit-any
  result: Record<string, any> & { action?: string; reason?: string },
): Response {
  const action = result.action ?? "unknown";
  const row: WebhookLogRow = {
    ...base,
    outcome: action,
    outcome_reason: result.reason ?? null,
    opportunity_id: result.opportunityId ?? null,
    error_message: action === "error" ? (result.reason ?? null) : null,
  };
  // Fire-and-forget: don't await; we'll still get logs but never delay the
  // 200 OK that prevents Close from retrying.
  persistWebhookLog(client, row);

  console.log(
    `[webhook] ${base.organization_id ?? "?"} lead ${base.lead_id ?? "?"} → ${
      base.status_label ?? "?"
    }: ${JSON.stringify(result)}`,
  );

  return jsonResponse({ ok: true, ...result }, 200);
}

// ─── Webhook Signature Verification ──────────────────────────────

/**
 * Verify a Close.com webhook signature.
 *
 * Close signs webhooks with HMAC-SHA256.  The signing scheme used here is:
 *   HMAC-SHA256(secret, timestamp + raw_body)
 * where timestamp is the value of the "Close-Sig-Timestamp" header and
 * raw_body is the raw (pre-parse) request body string.
 *
 * ASSUMPTION: The exact concatenation order (timestamp then body, no
 * separator) is inferred from the Close.com webhook documentation and
 * community examples as of 2026.  Verify against
 * https://developer.close.com/topics/webhooks before deploying.
 *
 * Env var required: CLOSE_WEBHOOK_SECRET
 * Headers read:     Close-Sig-Hash, Close-Sig-Timestamp
 */
async function verifyCloseSignature(
  rawBody: string,
  sigHeader: string | null,
  timestampHeader: string | null,
  secret: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!sigHeader || !timestampHeader) {
    return {
      ok: false,
      reason: "missing Close-Sig-Hash or Close-Sig-Timestamp header",
    };
  }

  // Replay-attack guard: reject webhooks older than 300 seconds.
  const ts = parseInt(timestampHeader, 10);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: "non-numeric Close-Sig-Timestamp" };
  }
  const ageSec = Math.floor(Date.now() / 1000) - ts;
  if (ageSec > 300 || ageSec < -60) {
    return {
      ok: false,
      reason: `timestamp outside freshness window (age=${ageSec}s)`,
    };
  }

  const encoder = new TextEncoder();
  // Close's `signature_key` is a HEX string; the HMAC key is its DECODED BYTES, not the
  // UTF-8 string. Per Close docs ("the key is converted from hex"). Encoding the raw string
  // here would make every legitimate webhook fail verification.
  const keyBytes = new Uint8Array(
    (secret.match(/.{1,2}/g) ?? []).map((h) => parseInt(h, 16)),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const message = timestampHeader + rawBody;
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const computed = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison (XOR-accumulate; length mismatch leaks length
  // only, which is acceptable for a fixed-length hex digest).
  if (computed.length !== sigHeader.length) {
    return { ok: false, reason: "signature length mismatch" };
  }
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ sigHeader.charCodeAt(i);
  }
  if (diff !== 0) {
    return { ok: false, reason: "signature mismatch" };
  }
  return { ok: true };
}

// ─── Main Handler ─────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  // ── Signature verification (BEFORE any DB access or Close API calls) ──
  //
  // Env var: CLOSE_WEBHOOK_SECRET  (set in Supabase dashboard → Edge Functions
  //   → close-webhook-handler → Secrets).  Value is the webhook signing secret
  //   from Close.com Settings → Webhooks.
  const CLOSE_WEBHOOK_SECRET = Deno.env.get("CLOSE_WEBHOOK_SECRET");
  if (!CLOSE_WEBHOOK_SECRET) {
    console.error(
      "[close-webhook-handler] CLOSE_WEBHOOK_SECRET not configured",
    );
    return jsonResponse({ error: "Webhook secret not configured" }, 500);
  }

  // Read the raw body now so we can both verify the signature and parse JSON.
  const rawBody = await req.text();

  const sigCheck = await verifyCloseSignature(
    rawBody,
    req.headers.get("Close-Sig-Hash"),
    req.headers.get("Close-Sig-Timestamp"),
    CLOSE_WEBHOOK_SECRET,
  );

  if (!sigCheck.ok) {
    console.error(
      "[close-webhook-handler] Signature rejected:",
      sigCheck.reason,
    );
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  // Build clients up front so even early-return paths can be logged.
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const REMOTE_URL = Deno.env.get("REMOTE_SUPABASE_URL");
  const REMOTE_KEY = Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY");

  const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const dataClient =
    REMOTE_URL && REMOTE_KEY
      ? createClient(REMOTE_URL, REMOTE_KEY)
      : authClient;

  // Logs always go to authClient (the local supabase that hosts this
  // function), never to the remote data client.
  const logClient = authClient;

  let baseLog: Omit<WebhookLogRow, "outcome"> = {
    organization_id: null,
    lead_id: null,
    user_id: null,
    event_action: null,
    status_label: null,
    changed_fields: null,
    outcome_reason: null,
    opportunity_id: null,
    error_message: null,
    raw_payload: null,
  };

  try {
    // rawBody was already read above for signature verification; parse it now.
    const payload = JSON.parse(rawBody);
    const event = payload.event;

    // Truncate raw payload to keep log rows reasonable
    baseLog.raw_payload = event ?? payload;

    if (!event) {
      return buildResponseAndLog(logClient, baseLog, { action: "no_event" });
    }

    baseLog = {
      ...baseLog,
      organization_id: event.organization_id ?? null,
      lead_id: event.object_id ?? null,
      event_action: event.action ?? null,
      changed_fields: event.changed_fields ?? null,
      status_label: event.data?.status_label ?? null,
    };

    // Only handle lead updates with status_id changes
    if (
      event.object_type !== "lead" ||
      event.action !== "updated" ||
      !event.changed_fields?.includes("status_id")
    ) {
      return buildResponseAndLog(logClient, baseLog, {
        action: "ignored",
        reason: `object_type=${event.object_type} action=${event.action} changed_fields=${JSON.stringify(event.changed_fields ?? [])}`,
      });
    }

    const leadId = event.object_id;
    const orgId = event.organization_id;

    if (!leadId || !orgId) {
      return buildResponseAndLog(logClient, baseLog, { action: "missing_ids" });
    }

    // Look up the agent by organization_id
    const { data: configs } = await dataClient
      .from("close_config")
      .select("user_id, api_key_encrypted, organization_id")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .limit(1);

    if (!configs?.length) {
      // Try matching by checking all configs (org_id might not be set)
      const { data: allConfigs } = await dataClient
        .from("close_config")
        .select("user_id, api_key_encrypted")
        .eq("is_active", true);

      if (!allConfigs?.length) {
        return buildResponseAndLog(logClient, baseLog, {
          action: "no_matching_config",
          reason: "no active close_config rows",
        });
      }

      // Try each config to find the one whose API key works for this org
      for (const cfg of allConfigs) {
        try {
          const apiKey = await decrypt(cfg.api_key_encrypted);
          // deno-lint-ignore no-explicit-any
          const meRes = (await closeGet(apiKey, "/me/")) as any;
          if (meRes.organization_id === orgId) {
            baseLog.user_id = cfg.user_id;
            // Found the right agent — get the new status label
            let newStatusLabel = event.data?.status_label ?? "";
            if (!newStatusLabel) {
              // deno-lint-ignore no-explicit-any
              const lead = (await closeGet(
                apiKey,
                `/lead/${leadId}/?_fields=status_label`,
              )) as any;
              newStatusLabel = lead.status_label ?? "";
            }
            baseLog.status_label = newStatusLabel;

            const result = await handleLeadStatusChange(
              apiKey,
              leadId,
              newStatusLabel,
              cfg.user_id,
            );

            // Update org_id for faster future lookups
            await dataClient
              .from("close_config")
              .update({ organization_id: orgId })
              .eq("user_id", cfg.user_id);

            return buildResponseAndLog(logClient, baseLog, result);
          }
        } catch {
          continue;
        }
      }

      return buildResponseAndLog(logClient, baseLog, {
        action: "no_matching_config",
        reason: "no api key matched org via /me/",
      });
    }

    // Direct match on org_id
    const cfg = configs[0];
    baseLog.user_id = cfg.user_id;
    const apiKey = await decrypt(cfg.api_key_encrypted);

    // Get the new status label from the event data or fetch it
    let newStatusLabel = event.data?.status_label ?? "";
    if (!newStatusLabel) {
      // deno-lint-ignore no-explicit-any
      const lead = (await closeGet(
        apiKey,
        `/lead/${leadId}/?_fields=status_label`,
      )) as any;
      newStatusLabel = lead.status_label ?? "";
    }
    baseLog.status_label = newStatusLabel;

    const result = await handleLeadStatusChange(
      apiKey,
      leadId,
      newStatusLabel,
      cfg.user_id,
    );

    return buildResponseAndLog(logClient, baseLog, result);
  } catch (err) {
    console.error("[close-webhook-handler] Error:", err);
    const message = (err as Error).message;
    // Best-effort error log; never block the 200 OK to Close.
    persistWebhookLog(logClient, {
      ...baseLog,
      outcome: "error",
      error_message: message,
    });
    // Always return 200 to prevent Close from retrying
    return jsonResponse({ ok: false, error: message }, 200);
  }
});
