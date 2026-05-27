// supabase/functions/activate-imo-revocation/index.ts
// ============================================================================
// RED BUTTON — Switch A (reversible): revoke / restore an IMO's platform access.
// ============================================================================
// Super-admin only. Setting `imos.access_revoked_at` locks every non-super-admin
// user in that IMO at the RLS layer (see get_effective_imo_id / is_access_revoked)
// and routes them to the sunset flow. This function ALSO async-enqueues one
// `data_export_log` row (status='pending') per affected user so the lifecycle
// cron can pre-build their export bundles — it does NOT generate bundles inline
// (that would blow the ~150s function limit for a large IMO).
//
// SAFETY: fail-closed allowlist — refuses any IMO except the FFG sentinel, so a
// live tenant (Epic Life) can never be revoked by a mistyped id. Second factor:
// the caller must type the exact confirm text `REVOKE <imo.name>`.
//
// NO STRIPE. Operational ordering is owner-driven: press this FIRST, then cancel
// subscriptions manually in the Stripe dashboard (cancelling first deprovisions
// chat bots / downgrades plans — a visible "tell" to a still-active user).
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { FFG_SENTINEL_IMO_ID } from "../_shared/sunset-constants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ActivateBody {
  imoId: string;
  // "revoke" sets access_revoked_at=now(); "restore" clears it (reversible).
  action: "revoke" | "restore";
  // Required for "revoke": must equal `REVOKE <imo.name>` exactly.
  confirmText?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 1. Verify caller is authenticated ──────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.slice(7));
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // ── 2. Verify caller is super admin ────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.is_super_admin) {
      return json({ error: "Forbidden: super admin required" }, 403);
    }

    // ── 3. Parse + validate input ──────────────────────────────────────────
    const body: ActivateBody = await req.json();
    const { imoId, action, confirmText } = body;

    if (action !== "revoke" && action !== "restore") {
      return json({ error: "action must be 'revoke' or 'restore'" }, 400);
    }

    // Fail-closed allowlist: only the FFG sentinel is ever revocable.
    if (imoId !== FFG_SENTINEL_IMO_ID) {
      return json(
        {
          error:
            "Refusing: this control only operates on the designated IMO. Other IMOs are protected.",
        },
        403,
      );
    }

    const { data: imo, error: imoError } = await supabase
      .from("imos")
      .select("id, name, access_revoked_at")
      .eq("id", imoId)
      .single();
    if (imoError || !imo) {
      return json({ error: "IMO not found" }, 404);
    }

    // ── 4a. RESTORE (single-confirm reversible) ────────────────────────────
    if (action === "restore") {
      if (imo.access_revoked_at === null) {
        return json({ status: "noop", reason: "already_active", imoId });
      }
      const { error: updErr } = await supabase
        .from("imos")
        .update({ access_revoked_at: null })
        .eq("id", imoId);
      if (updErr) {
        return json({ error: `Restore failed: ${updErr.message}` }, 500);
      }
      return json({ status: "restored", imoId, imoName: imo.name });
    }

    // ── 4b. REVOKE (double-confirm, irreversible-feeling) ──────────────────
    const expectedConfirm = `REVOKE ${imo.name}`;
    if (confirmText !== expectedConfirm) {
      return json(
        {
          error: "Confirmation text does not match.",
          expected: expectedConfirm,
        },
        400,
      );
    }
    // Idempotent: don't re-revoke / re-enqueue if already revoked.
    if (imo.access_revoked_at !== null) {
      return json({
        status: "noop",
        reason: "already_revoked",
        imoId,
        revokedAt: imo.access_revoked_at,
      });
    }

    const revokedAt = new Date().toISOString();
    const { error: revokeErr } = await supabase
      .from("imos")
      .update({ access_revoked_at: revokedAt })
      .eq("id", imoId);
    if (revokeErr) {
      return json({ error: `Revoke failed: ${revokeErr.message}` }, 500);
    }

    // ── 5. Async-enqueue one pending export per affected user ──────────────
    // Affected = non-super-admin users in this IMO. The lifecycle cron drains
    // these and calls generate-user-export-bundle (no synchronous generation).
    const { data: affected, error: usersErr } = await supabase
      .from("user_profiles")
      .select("id, email, full_name")
      .eq("imo_id", imoId)
      .or("is_super_admin.is.null,is_super_admin.eq.false");

    let enqueued = 0;
    if (usersErr) {
      // The revoke already succeeded (the important part). Report the enqueue
      // gap so the cron / a retry can backfill — do NOT roll back the lock-out.
      console.error(
        "[activate-imo-revocation] enqueue query failed:",
        usersErr,
      );
    } else if (affected && affected.length > 0) {
      const rows = affected.map((u) => ({
        user_id: u.id,
        email: u.email,
        full_name: u.full_name,
        imo_id: imoId,
        status: "pending",
        trigger: "activation_prescan",
      }));
      const { error: insErr, count } = await supabase
        .from("data_export_log")
        .insert(rows, { count: "exact" });
      if (insErr) {
        console.error(
          "[activate-imo-revocation] enqueue insert failed:",
          insErr,
        );
      } else {
        enqueued = count ?? rows.length;
      }
    }

    console.log(
      `[activate-imo-revocation] REVOKED imo=${imoId} name="${imo.name}" by=${user.id} enqueued=${enqueued}`,
    );

    return json({
      status: "revoked",
      imoId,
      imoName: imo.name,
      revokedAt,
      usersAffected: affected?.length ?? 0,
      exportsEnqueued: enqueued,
    });
  } catch (err) {
    console.error("[activate-imo-revocation] Error:", err);
    return json({ error: "Something went wrong" }, 500);
  }
});
