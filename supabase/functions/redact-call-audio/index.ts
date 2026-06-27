// redact-call-audio — dispatch the Railway audio-worker to MUTE the spoken-PII
// time spans in a call recording's audio (Call Reviews PII redaction, Phase 2).
//
// POST { recording_id, force? } with a user JWT. This function:
//   1. authenticates (real 401), loads the recording under the USER client so RLS
//      enforces visibility (404), gates to Epic Life / AI-entitled IMOs (403),
//   2. requires transcription completed (the spans come from it), is idempotent,
//   3. CLAIMS the muting step (audio_redaction_status → 'processing') under the
//      user client so an IMO-wide *reader* can't trigger a re-mute (403),
//   4. fire-and-forgets the worker, which downloads the raw audio, mutes the
//      spans, uploads the muted mp3, and writes redacted_storage_path /
//      audio_redacted_at / audio_redaction_status back itself (decoupled from
//      this function's timeout). If the worker can't be reached, we mark 'failed'.
//
// No-ops gracefully (returns ok, configured:false) until AUDIO_WORKER_URL is set,
// so it can ship before the worker is deployed. NEVER logs audio/paths/transcript.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from "../_shared/supabase-client.ts";
import { resolveAiAccessFacts } from "../_shared/resolve-ai-access.ts";

const OUTPUT_BUCKET = "call-recordings-redacted";

interface SpanRow {
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
  let force = false;
  try {
    const body = (await req.json()) as {
      recording_id?: unknown;
      force?: unknown;
    };
    if (typeof body?.recording_id === "string") recordingId = body.recording_id;
    force = body?.force === true;
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
      "id, imo_id, agent_id, storage_bucket, storage_path, transcription_status, redaction_spans, audio_redaction_status",
    )
    .eq("id", recordingId)
    .maybeSingle();
  if (loadErr) {
    console.error("redact-call-audio load error", loadErr.code ?? "");
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

  // ── 5. Preconditions ─────────────────────────────────────────────────────
  // Spans come from a completed transcription/detection; don't mute before then.
  if (recording.transcription_status !== "completed") {
    return json(
      { ok: false, recording_id: recording.id, status: "not_transcribed" },
      409,
    );
  }
  // Idempotent: already muted (unless forced) or in flight → nothing to do.
  const current = recording.audio_redaction_status;
  if (current === "processing")
    return json({ ok: true, recording_id: recording.id, status: "processing" });
  if (current === "done" && !force)
    return json({ ok: true, recording_id: recording.id, status: "done" });

  // ── 6. Worker config — no-op gracefully until deployed ───────────────────
  const workerUrl = Deno.env.get("AUDIO_WORKER_URL");
  const workerKey = Deno.env.get("AUDIO_WORKER_KEY");
  if (!workerUrl || !workerKey) {
    return json({ ok: true, recording_id: recording.id, configured: false });
  }

  // ── 7. Claim the muting step under the USER client (gates IMO readers) ───
  // Output path keyed by recording id → idempotent overwrite on re-mute, and
  // foldername[1] = agent_id so the redacted-bucket owner/admin policy applies.
  const outPath = `${recording.agent_id}/redacted/${recording.id}.mp3`;
  const claimable = force
    ? ["pending", "failed", "done"]
    : ["pending", "failed"];
  const { data: claimed, error: claimErr } = await db
    .from("kpi_call_recordings")
    .update({
      audio_redaction_status: "processing",
      audio_redaction_error: null,
    })
    .eq("id", recording.id)
    .in("audio_redaction_status", claimable)
    .select("id")
    .maybeSingle();
  if (claimErr) {
    console.error("redact-call-audio claim error", claimErr.code ?? "");
    return json({ error: "Failed to start audio redaction." }, 500);
  }
  if (!claimed) {
    return json(
      { error: "You don't have permission to redact this recording." },
      403,
    );
  }

  // ── 8. Normalize spans → [{start,end}] for the worker ────────────────────
  const rawSpans = Array.isArray(recording.redaction_spans)
    ? (recording.redaction_spans as SpanRow[])
    : [];
  const spans = rawSpans
    .filter(
      (s) => s && typeof s.start === "number" && typeof s.end === "number",
    )
    .map((s) => ({ start: s.start as number, end: s.end as number }));

  // ── 9. Fire-and-forget the worker; it writes the result row itself. If we
  //      can't even reach it, mark failed so it's visible + retriable. ───────
  const markFailed = (msg: string) =>
    adminClient
      .from("kpi_call_recordings")
      .update({ audio_redaction_status: "failed", audio_redaction_error: msg })
      .eq("id", recording.id);

  const fire = fetch(`${workerUrl.replace(/\/$/, "")}/api/mute-audio`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": workerKey },
    body: JSON.stringify({
      recording_id: recording.id,
      storage_path: recording.storage_path,
      out_path: outPath,
      spans,
    }),
  })
    .then(async (r) => {
      if (!r.ok) await markFailed(`worker returned ${r.status}`);
    })
    .catch(async () => {
      await markFailed("worker unreachable");
    });

  const runtime = (
    globalThis as {
      EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
    }
  ).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(fire);

  return json({
    ok: true,
    recording_id: recording.id,
    status: "dispatched",
    bucket: OUTPUT_BUCKET,
  });
});
