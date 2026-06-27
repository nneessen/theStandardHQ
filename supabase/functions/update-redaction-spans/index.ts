// update-redaction-spans — an IMO admin adjusts the PII mute spans on a recording
// under review, then re-mutes from the raw original (Call Reviews PII, Phase 3).
//
// POST { recording_id, spans:[{start,end,type?}] } with a user JWT. This function:
//   1. authenticates (401), loads under the USER client (RLS → 404), Epic/AI gate (403),
//   2. requires the caller is an IMO admin / super-admin (span-edit authority = the
//      same gate as approve; the trigger also enforces this on the write),
//   3. writes redaction_spans under the USER client. The BEFORE UPDATE trigger then
//      AUTO re-arms: bumps spans_version and forces audio_redaction_status='pending'
//      (so the stale muted file can no longer be approved), and RAISEs if a non-admin
//      or an approved row attempts the edit.
//   4. fires redact-call-audio (force) so the worker re-mutes from the RAW original
//      with the new spans and echoes muted_spans_version = the new spans_version.
//
// Only possible PRE-approval (raw still exists; the trigger blocks span edits on an
// approved row). NEVER logs transcript / audio / signed URLs.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from "../_shared/supabase-client.ts";
import { resolveAiAccessFacts } from "../_shared/resolve-ai-access.ts";

interface SpanInput {
  start?: unknown;
  end?: unknown;
  type?: unknown;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  const cors = getCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── 1. Body ─────────────────────────────────────────────────────────────
  let recordingId: string | null = null;
  let rawSpans: SpanInput[] = [];
  try {
    const body = (await req.json()) as {
      recording_id?: unknown;
      spans?: unknown;
    };
    if (typeof body?.recording_id === "string") recordingId = body.recording_id;
    if (Array.isArray(body?.spans)) rawSpans = body.spans as SpanInput[];
  } catch {
    return json(
      { error: "Expected JSON body with recording_id and spans." },
      400,
    );
  }
  if (!recordingId) return json({ error: "recording_id is required." }, 400);

  // Sanitize spans → [{start,end,type}] with finite start<end. (The worker also
  // clamps/drops, but reject obvious garbage early.)
  const spans = rawSpans
    .filter(
      (s) =>
        s &&
        typeof s.start === "number" &&
        typeof s.end === "number" &&
        Number.isFinite(s.start) &&
        Number.isFinite(s.end) &&
        (s.end as number) > (s.start as number),
    )
    .map((s) => ({
      start: s.start as number,
      end: s.end as number,
      type: typeof s.type === "string" ? s.type : "manual",
    }));
  if (spans.length > 1000) return json({ error: "Too many spans." }, 400);

  // ── 2. Authenticate (real 401) ──────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
  const db = createSupabaseClient(authHeader);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  // ── 3. Load under USER client → RLS decides visibility ───────────────────
  const { data: recording, error: loadErr } = await db
    .from("kpi_call_recordings")
    .select("id, imo_id, redaction_status")
    .eq("id", recordingId)
    .maybeSingle();
  if (loadErr) {
    console.error("update-redaction-spans load error", loadErr.code ?? "");
    return json({ error: "Failed to load recording." }, 500);
  }
  if (!recording) return json({ error: "Recording not found." }, 404);

  // ── 4. Epic Life / AI-entitled gate (fail closed) ────────────────────────
  const adminClient = createSupabaseAdminClient();
  const { data: isEpic } = await adminClient.rpc("is_epic_life_imo", {
    p_imo_id: recording.imo_id,
  });
  if (isEpic !== true) {
    const aiFacts = await resolveAiAccessFacts(adminClient, userId);
    if (
      !aiFacts.isSuperAdmin &&
      !aiFacts.imoGrantsAllFeatures &&
      !aiFacts.hasAiAddon
    ) {
      return json({ error: "Not available for your account." }, 403);
    }
  }

  // ── 5. Admin authorization (ergonomic 403; trigger also enforces it) ─────
  const { data: isAdmin, error: adminErr } = await db.rpc("is_imo_admin");
  if (adminErr) {
    console.error(
      "update-redaction-spans admin check error",
      adminErr.code ?? "",
    );
    return json({ error: "Failed to verify permissions." }, 500);
  }
  if (isAdmin !== true) {
    return json({ error: "Only an IMO admin can edit redaction spans." }, 403);
  }

  // ── 6. Spans are editable only before approval (trigger also blocks this) ─
  if (recording.redaction_status === "approved") {
    return json(
      { ok: false, recording_id: recording.id, status: "approved_locked" },
      409,
    );
  }

  // ── 7. Write spans under the USER client → trigger re-arms automatically ─
  const { data: updated, error: updErr } = await db
    .from("kpi_call_recordings")
    .update({ redaction_spans: spans })
    .eq("id", recording.id)
    .select("id, spans_version")
    .maybeSingle();
  if (updErr) {
    console.error("update-redaction-spans write error", updErr.code ?? "");
    return json(
      { error: "Could not update spans (not permitted or locked)." },
      403,
    );
  }
  if (!updated) {
    return json({ error: "Recording not found or no longer editable." }, 409);
  }

  // ── 8. Fire redact-call-audio (force) → re-mute from RAW with the new spans ─
  // The worker echoes muted_spans_version = the new spans_version; approve unblocks
  // once that completes. Background; never blocks this response.
  try {
    const redactUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/redact-call-audio`;
    const fire = fetch(redactUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recording_id: recording.id, force: true }),
    })
      .then((r) => {
        if (!r.ok) console.error("re-mute dispatch non-ok", r.status);
      })
      .catch((e) =>
        console.error(
          "re-mute dispatch failed",
          e instanceof Error ? e.message : "",
        ),
      );
    const runtime = (
      globalThis as {
        EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
      }
    ).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(fire);
  } catch {
    // best-effort
  }

  return json({
    ok: true,
    recording_id: recording.id,
    spans: spans.length,
    spans_version: updated.spans_version,
    status: "remuting",
  });
});
