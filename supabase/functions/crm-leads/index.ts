// supabase/functions/crm-leads/index.ts
// Inbound-call data API for the external dialer platform — the three per-call touchpoints on
// /api/v1/leads, behind ONE function that switches on req.method:
//
//   GET   ?ani=…   → Agent-of-Record lookup (crm_lookup_aor)        → 200 {pcId} | 204 | 400
//   POST  {body}   → find/create lead + write call event (crm_upsert_call) → 200  (the INSERT is
//                    what Phase 3's realtime screen-pop subscribes to)
//   PATCH {body}   → set billable / end the call (crm_patch_billable) → 200
//
// Auth: the OAuth bearer minted by crm-oauth-token, verified with verifyCrmToken (HMAC, expiry,
// typ). The tenant (imo_id) is ALWAYS taken from the verified token, never the request body.
// config.toml sets verify_jwt=false (own auth). We do NOT import _shared/cors.ts (M2M; the bearer
// is the auth, not a browser origin). Secrets/PII are never logged; the ANI is masked to last-4.
//
// Lifecycle resilience (POST/PATCH): per the platform's retry-once model, these never 4xx on a
// valid-but-edge request (unknown pcId, malformed ANI) — they degrade gracefully and return 200.
// The only POST/PATCH 4xx is a missing requestTag (the idempotency key). A genuine DB fault is 500.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";
import { verifyCrmToken } from "../_shared/crm-token-decoder.ts";
import { normalizePhoneNumber } from "../_shared/phone.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function getBearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : null;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const method = req.method;
  if (method !== "GET" && method !== "POST" && method !== "PATCH") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // ── Auth: verify the bearer; tenant comes from the token, never the body. ──
  const payload = await verifyCrmToken(getBearer(req) ?? "");
  if (!payload) return json({ error: "invalid_token" }, 401);
  const imoId = payload.imo_id;

  const supabase = createSupabaseAdminClient();

  // ── Per-credential rate-limit (secondary; checkRateLimit fails open on any fault). ──
  const limited = await enforceRateLimit(
    supabase,
    {
      key: `ratelimit:req:crm-leads:${payload.credential_id}`,
      maxRequests: 1000,
      windowSeconds: 3600,
    },
    {},
  );
  if (limited) return limited;

  try {
    if (method === "GET") {
      // Latency-critical path: validate ANI, single indexed lookup, allocation-light.
      const ani = normalizePhoneNumber(
        new URL(req.url).searchParams.get("ani"),
      );
      if (!ani) return json({ error: "invalid_ani" }, 400);
      const { data, error } = await supabase.rpc("crm_lookup_aor", {
        p_imo_id: imoId,
        p_ani: ani,
      });
      if (error) {
        console.error("crm-leads GET: crm_lookup_aor error", {
          code: error.code,
        });
        return json({ error: "server_error" }, 500);
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || !row.pc_id)
        return new Response(null, {
          status: 204,
          headers: { "Cache-Control": "no-store" },
        });
      return json({ pcId: row.pc_id }, 200);
    }

    const body = await req.json().catch(() => null);
    const requestTag = body?.requestTag;
    if (!requestTag || typeof requestTag !== "string") {
      return json({ error: "missing_request_tag" }, 400); // idempotency key is required
    }

    if (method === "POST") {
      const { data, error } = await supabase.rpc("crm_upsert_call", {
        p_imo_id: imoId,
        p_request_tag: requestTag,
        p_pc_id: body.pcId ?? null,
        p_ani: body.ani ?? "",
        p_state: body.state ?? null,
        p_record_type: body.recordType ?? null,
        p_offer_id: body.offerId ?? null,
        p_call_program: body.callProgram ?? null,
        p_sub_id: body.subId ?? null,
        p_call_start: body.callStart ?? null,
        p_duration: body.duration ?? null,
        p_billable: body.billable ?? null,
        p_caller_name: body.callerName ?? null,
      });
      if (error) {
        console.error("crm-leads POST: crm_upsert_call error", {
          code: error.code,
        });
        return json({ error: "server_error" }, 500);
      }
      const row = Array.isArray(data) ? data[0] : data;
      // Always 200 on the lifecycle: unknown/cross-tenant pcId ⇒ agent_id NULL + no pop, still 200.
      return json({ ok: true, id: row?.id ?? null }, 200);
    }

    // PATCH
    const { data, error } = await supabase.rpc("crm_patch_billable", {
      p_imo_id: imoId,
      p_request_tag: requestTag,
      p_billable: body.billable ?? null,
      p_duration: body.duration ?? null,
      p_ani: body.ani ?? null,
    });
    if (error) {
      console.error("crm-leads PATCH: crm_patch_billable error", {
        code: error.code,
      });
      return json({ error: "server_error" }, 500);
    }
    const row = Array.isArray(data) ? data[0] : data;
    // PATCH-before-POST ⇒ a patch_only row is recorded (billing kept, no phantom pop); still 200.
    return json(
      { ok: true, id: row?.id ?? null, queued: row?.patch_only ?? false },
      200,
    );
  } catch (e) {
    console.error("crm-leads: unhandled error", {
      method,
      message: (e as Error).message,
    });
    return json({ error: "server_error" }, 500);
  }
});
