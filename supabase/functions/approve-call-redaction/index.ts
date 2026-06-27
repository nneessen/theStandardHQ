// approve-call-redaction — an IMO admin approves a redacted call recording for
// IMO-wide sharing (Call Reviews PII redaction, Phase 3).
//
// POST { recording_id } with a user JWT. This function:
//   1. authenticates (real 401), loads the recording under the USER client so RLS
//      enforces visibility (404), gates to Epic Life / AI-entitled IMOs (403),
//   2. requires the caller is an IMO admin / super-admin (ergonomic 403; the DB
//      trigger is the real guarantee),
//   3. checks the approval preconditions for a clean 409 (must be needs_review,
//      detection ran, audio muted AND current — muted_spans_version=spans_version),
//   4. CLAIMS the approval atomically under the USER client: flips redaction_status
//      → 'approved' WHERE redaction_status='needs_review'. The BEFORE UPDATE trigger
//      kpi_call_recordings_redaction_guard re-checks admin + every precondition and
//      RAISEs on any violation, so a direct PostgREST PATCH cannot bypass this.
//   5. PURGES the raw original audio (best-effort, admin client) — data minimization.
//      A purge failure does NOT roll back the approval (the recording is correctly
//      shared via the muted copy; the raw lingers owner/admin-only for a sweep).
//
// NEVER logs transcript / audio / signed URLs — status codes + ids only.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from "../_shared/supabase-client.ts";
import { resolveAiAccessFacts } from "../_shared/resolve-ai-access.ts";

const RAW_BUCKET = "call-recordings";

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
  try {
    const body = (await req.json()) as { recording_id?: unknown };
    if (typeof body?.recording_id === "string") recordingId = body.recording_id;
  } catch {
    return json({ error: "Expected JSON body with recording_id." }, 400);
  }
  if (!recordingId) return json({ error: "recording_id is required." }, 400);

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
    .select(
      "id, imo_id, agent_id, redaction_status, audio_redaction_status, redacted_storage_path, redaction_detector, spans_version, muted_spans_version, storage_bucket, storage_path, raw_audio_purged_at",
    )
    .eq("id", recordingId)
    .maybeSingle();
  if (loadErr) {
    console.error("approve-call-redaction load error", loadErr.code ?? "");
    return json({ error: "Failed to load recording." }, 500);
  }
  if (!recording) return json({ error: "Recording not found." }, 404);

  // ── 4. Epic Life / AI-entitled gate (fail closed) — mirrors transcribe ───
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

  // ── 5. Admin authorization (ergonomic 403; trigger is the guarantee) ─────
  // Approving shares a client call to the whole agency — only IMO admins /
  // super-admins, never the uploading agent. is_imo_admin() = imo_owner ∨
  // imo_admin ∨ super_admin for the caller.
  const { data: isAdmin, error: adminErr } = await db.rpc("is_imo_admin");
  if (adminErr) {
    console.error(
      "approve-call-redaction admin check error",
      adminErr.code ?? "",
    );
    return json({ error: "Failed to verify permissions." }, 500);
  }
  if (isAdmin !== true) {
    return json(
      { error: "Only an IMO admin can approve a recording for sharing." },
      403,
    );
  }

  // ── 6. Preconditions (clean 409s; the trigger re-enforces all of them) ───
  if (recording.redaction_status !== "needs_review") {
    return json(
      {
        ok: false,
        recording_id: recording.id,
        status: "not_in_review",
        current: recording.redaction_status,
      },
      409,
    );
  }
  if (recording.redaction_detector === null) {
    return json(
      { ok: false, recording_id: recording.id, status: "detection_missing" },
      409,
    );
  }
  if (
    recording.audio_redaction_status !== "done" ||
    recording.redacted_storage_path === null
  ) {
    return json(
      { ok: false, recording_id: recording.id, status: "audio_not_redacted" },
      409,
    );
  }
  if (recording.muted_spans_version !== recording.spans_version) {
    // Spans were edited after the last mute → the muted file is stale. Re-mute.
    return json(
      { ok: false, recording_id: recording.id, status: "remute_required" },
      409,
    );
  }

  // ── 7. Atomic claim under the USER client (trigger enforces admin + all) ─
  const { data: approved, error: approveErr } = await db
    .from("kpi_call_recordings")
    .update({
      redaction_status: "approved",
      pii_reviewed_at: new Date().toISOString(),
      pii_reviewed_by: userId,
    })
    .eq("id", recording.id)
    .eq("redaction_status", "needs_review")
    .select("id")
    .maybeSingle();
  if (approveErr) {
    // The guard trigger RAISEs (not authorized / precondition) surface here.
    console.error(
      "approve-call-redaction approve error",
      approveErr.code ?? "",
    );
    return json(
      {
        error:
          "Could not approve this recording (not permitted or no longer ready).",
      },
      403,
    );
  }
  if (!approved) {
    // Lost the race (already approved / status changed) — not an error to retry.
    return json(
      { ok: false, recording_id: recording.id, status: "already_changed" },
      409,
    );
  }

  // ── 8. Purge the raw original (best-effort; never rolls back approval) ────
  // The muted copy is now canonical & shared; the raw is the only file that still
  // holds the un-muted PII. Delete it. A failure leaves a locked owner/admin-only
  // straggler for a manual/cron sweep — it does NOT un-share the approved call.
  let rawPurged = false;
  if (recording.storage_path && !recording.raw_audio_purged_at) {
    const bucket = recording.storage_bucket || RAW_BUCKET;
    const { error: rmErr } = await adminClient.storage
      .from(bucket)
      .remove([recording.storage_path]);
    if (rmErr) {
      console.error(
        "approve-call-redaction raw purge failed",
        rmErr.message ? "rm_error" : "",
      );
    } else {
      rawPurged = true;
      await adminClient
        .from("kpi_call_recordings")
        .update({ raw_audio_purged_at: new Date().toISOString() })
        .eq("id", recording.id);
    }
  } else if (recording.raw_audio_purged_at) {
    rawPurged = true;
  }

  return json({
    ok: true,
    recording_id: recording.id,
    status: "approved",
    raw_purged: rawPurged,
  });
});
