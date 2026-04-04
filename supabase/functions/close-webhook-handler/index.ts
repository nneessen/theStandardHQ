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

// ─── Main Handler ─────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    const event = payload.event;

    if (!event) {
      return jsonResponse({ ok: true, action: "no_event" }, 200);
    }

    // Only handle lead updates with status_id changes
    if (
      event.object_type !== "lead" ||
      event.action !== "updated" ||
      !event.changed_fields?.includes("status_id")
    ) {
      return jsonResponse({ ok: true, action: "ignored" }, 200);
    }

    const leadId = event.object_id;
    const orgId = event.organization_id;

    if (!leadId || !orgId) {
      return jsonResponse({ ok: true, action: "missing_ids" }, 200);
    }

    // Find the agent whose Close org matches this webhook
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
        return jsonResponse({ ok: true, action: "no_matching_config" }, 200);
      }

      // Try each config to find the one whose API key works for this org
      for (const cfg of allConfigs) {
        try {
          const apiKey = await decrypt(cfg.api_key_encrypted);
          // deno-lint-ignore no-explicit-any
          const meRes = (await closeGet(apiKey, "/me/")) as any;
          if (meRes.organization_id === orgId) {
            // Found the right agent — get the new status label
            const newStatusLabel = event.data?.status_label ?? "";
            if (!newStatusLabel) {
              // Fetch lead to get status label
              // deno-lint-ignore no-explicit-any
              const lead = (await closeGet(
                apiKey,
                `/lead/${leadId}/?_fields=status_label`,
              )) as any;
              const label = lead.status_label ?? "";
              const result = await handleLeadStatusChange(
                apiKey,
                leadId,
                label,
                cfg.user_id,
              );
              console.log(
                `[webhook] ${orgId} lead ${leadId}: ${JSON.stringify(result)}`,
              );

              // Update org_id for faster future lookups
              await dataClient
                .from("close_config")
                .update({ organization_id: orgId })
                .eq("user_id", cfg.user_id);

              return jsonResponse({ ok: true, ...result }, 200);
            }

            const result = await handleLeadStatusChange(
              apiKey,
              leadId,
              newStatusLabel,
              cfg.user_id,
            );
            console.log(
              `[webhook] ${orgId} lead ${leadId}: ${JSON.stringify(result)}`,
            );

            await dataClient
              .from("close_config")
              .update({ organization_id: orgId })
              .eq("user_id", cfg.user_id);

            return jsonResponse({ ok: true, ...result }, 200);
          }
        } catch {
          continue;
        }
      }

      return jsonResponse({ ok: true, action: "no_matching_config" }, 200);
    }

    // Direct match on org_id
    const cfg = configs[0];
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

    const result = await handleLeadStatusChange(
      apiKey,
      leadId,
      newStatusLabel,
      cfg.user_id,
    );

    console.log(
      `[webhook] ${orgId} lead ${leadId} → ${newStatusLabel}: ${JSON.stringify(result)}`,
    );

    return jsonResponse({ ok: true, ...result }, 200);
  } catch (err) {
    console.error("[close-webhook-handler] Error:", err);
    // Always return 200 to prevent Close from retrying
    return jsonResponse({ ok: false, error: (err as Error).message }, 200);
  }
});
