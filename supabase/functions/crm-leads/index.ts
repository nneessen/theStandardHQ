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
// is the auth, not a browser origin). Secrets/PII are never logged (no request field, incl. the ANI,
// is ever written to logs — only the method + an RPC error code).
//
// Lifecycle resilience (POST/PATCH): per the platform's retry-once model, these never 4xx on a
// valid-but-edge request and never permanent-500 on bad-but-present scalars — body scalars are
// coerced (bad → NULL) so the call still degrades to 200. The only POST/PATCH 4xx is a missing
// requestTag (the idempotency key); 500 is reserved for a genuine DB/transport fault. The rate-limit
// is applied to GET ONLY (the enumeration-prone lookup) so a cap-hit can never 429 a lifecycle write.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";
import { verifyCrmToken } from "../_shared/crm-token-decoder.ts";
import { normalizePhoneNumber } from "../_shared/phone.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
// GET (AoR lookup) enumeration guard — generous vs the ~100/hr expected; never applied to POST/PATCH.
const GET_RATE_LIMIT_PER_HOUR = 2000;
// SCALE FIX: shard the GET rate-limit counter across this many rows. With ONE credential per agency,
// a single keyed row made all ~1000 concurrent AoR lookups convoy on one INSERT…ON CONFLICT row-lock
// (the burst's first serialization point). Sharding spreads contention ~N-fold; effective cap becomes
// GET_RATE_LIMIT_PER_HOUR × RATELIMIT_SHARDS. The caller is a trusted token-authed M2M client — hard
// enumeration protection belongs at a gateway IP limit, not this loose per-credential counter.
const RATELIMIT_SHARDS = 64;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function getBearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : null;
}

// Coerce body scalars so a malformed-but-present value degrades to NULL (and the call to 200),
// instead of raising a Postgres cast error that the handler can only map to a permanent 500.
function coerceTimestamp(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function coerceInt(v: unknown): number | null {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && v.trim() !== ""
        ? Number(v)
        : NaN;
  return Number.isInteger(n) && n >= -2147483648 && n <= 2147483647 ? n : null;
}
function coerceSmallint(v: unknown): number | null {
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = coerceInt(v);
  return n !== null && n >= -32768 && n <= 32767 ? n : null;
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

  try {
    const supabase = createSupabaseAdminClient();

    if (method === "GET") {
      // Per-credential rate-limit on the lookup ONLY (enumeration guard; fails open on a limiter
      // fault). Never applied to POST/PATCH so a cap-hit can't 429 a lifecycle write.
      // The :${shard} suffix breaks the single-row lock convoy (see RATELIMIT_SHARDS).
      const shard = Math.floor(Math.random() * RATELIMIT_SHARDS);
      const limited = await enforceRateLimit(
        supabase,
        {
          key: `ratelimit:req:crm-leads:${payload.credential_id}:${shard}`,
          maxRequests: GET_RATE_LIMIT_PER_HOUR,
          windowSeconds: 3600,
        },
        {},
      );
      if (limited) return limited;

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
        p_call_start: coerceTimestamp(body.callStart),
        p_duration: coerceInt(body.duration),
        p_billable: coerceSmallint(body.billable),
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
      p_billable: coerceSmallint(body.billable),
      p_duration: coerceInt(body.duration),
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
    // Includes a transport-level throw from the admin client or the rate-limiter — clean 500, not a bare crash.
    console.error("crm-leads: unhandled error", {
      method,
      message: (e as Error).message,
    });
    return json({ error: "server_error" }, 500);
  }
});
