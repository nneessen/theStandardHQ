// instagram-disconnect — a REAL disconnect: revoke the app's authorization at Meta, then
// remove the integration row. The old client-side "disconnect" only flipped is_active=false
// (a soft DB flag) and NEVER told Meta to revoke, so Meta kept the app authorized for that
// Instagram account forever — which re-bound the same account on every reconnect and made it
// impossible to connect a DIFFERENT business account. Revoking clears that binding.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from "../_shared/supabase-client.ts";
import { decrypt } from "../_shared/encryption.ts";

const FN_NAME = "instagram-disconnect";
const GRAPH = "https://graph.instagram.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  const cors = getCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }
  const integrationId =
    typeof body.integrationId === "string" ? body.integrationId : "";
  if (!integrationId) return json({ error: "integrationId is required." }, 400);

  // ── Authenticate the caller ──────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
  const db = createSupabaseClient(authHeader);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;
  const admin = createSupabaseAdminClient();

  // ── Load the integration + authorize the caller (same user OR same agency/IMO) ──
  const { data: integ, error: loadErr } = await admin
    .from("instagram_integrations")
    .select("id, user_id, imo_id, instagram_user_id, access_token_encrypted")
    .eq("id", integrationId)
    .maybeSingle();
  if (loadErr) return json({ error: "Could not load the integration." }, 500);
  if (!integ) return json({ error: "Integration not found." }, 404);

  if (integ.user_id !== userId) {
    // allow anyone in the same IMO to disconnect an agency account
    const { data: prof } = await admin
      .from("user_profiles")
      .select("imo_id")
      .eq("id", userId)
      .maybeSingle();
    if (!prof || prof.imo_id !== integ.imo_id) {
      return json({ error: "Not allowed to disconnect this account." }, 403);
    }
  }

  // ── Best-effort: revoke the app's permissions at Meta (clears the binding) ──
  // Without this, Meta keeps the app authorized for this Instagram account and re-binds it on
  // the next connect. Failure here is non-fatal — we still remove the row.
  let revokeResult = "skipped:no_token";
  if (integ.access_token_encrypted) {
    try {
      const accessToken = await decrypt(integ.access_token_encrypted);
      const url =
        `${GRAPH}/${encodeURIComponent(integ.instagram_user_id)}/permissions` +
        `?access_token=${encodeURIComponent(accessToken)}`;
      const r = await fetch(url, { method: "DELETE" });
      revokeResult = `${r.status}:${(await r.text()).slice(0, 200)}`;
      console.log(`[${FN_NAME}] revoke result: ${revokeResult}`);
    } catch (e) {
      revokeResult = `error:${e instanceof Error ? e.message : "unknown"}`;
      console.error(`[${FN_NAME}] revoke failed:`, e);
    }
  }

  // ── Remove the integration row entirely (true disconnect) ──────────────────
  const { error: delErr } = await admin
    .from("instagram_integrations")
    .delete()
    .eq("id", integrationId);
  if (delErr) {
    console.error(`[${FN_NAME}] delete failed:`, delErr);
    return json(
      { error: "Could not remove the integration.", revokeResult },
      500,
    );
  }

  return json({ ok: true, revokeResult }, 200);
});
