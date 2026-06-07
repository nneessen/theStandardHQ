// transcribe-call-recording — Whisper transcription for an uploaded inbound-call
// recording (Epic Life /kpi feature).
//
// POST { recording_id } with a user JWT. The function:
//   1. authenticates the caller (real 401 — RLS-empty is not authentication),
//   2. loads the recording with the USER-scoped client so RLS enforces visibility
//      (404 if the caller can't see it),
//   3. gates the feature to Epic Life IMOs via is_epic_life_imo (403 otherwise),
//   4. rate-limits (~10/hr/user), is idempotent, downloads the audio with the
//      admin client, transcribes with OpenAI Whisper, and writes the transcript
//      (with per-segment timing) back to the row.
//
// PII: the spoken words may contain client PII. NEVER console.log the transcript,
// the audio, or any Whisper response body — status codes only.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from "../_shared/supabase-client.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";

// Whisper hard-caps uploads at 25 MB. A larger file is left usable (recording +
// manual KPIs still work) but skipped for transcription — not marked failed.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

// Whisper's accepted container/extension set (the subset this feature allows).
const ALLOWED_EXTENSIONS = new Set([
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "wav",
  "webm",
]);

interface VerboseSegment {
  id?: number;
  start?: number;
  end?: number;
  text?: string;
}

interface WhisperVerboseJson {
  text?: string;
  language?: string;
  duration?: number;
  segments?: VerboseSegment[];
}

function fileExtension(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = path.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot < 0 || dot === base.length - 1) return null;
  return base.slice(dot + 1).toLowerCase();
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

  // ── 1. Parse body ─────────────────────────────────────────────────────────
  let recordingId: string | null = null;
  try {
    const body = (await req.json()) as { recording_id?: unknown };
    if (typeof body?.recording_id === "string") recordingId = body.recording_id;
  } catch {
    return json({ error: "Expected JSON body with recording_id." }, 400);
  }
  if (!recordingId) return json({ error: "recording_id is required." }, 400);

  // ── 2. Authenticate (real 401; RLS-returns-empty is NOT authentication) ─────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }
  const db = createSupabaseClient(authHeader); // user-scoped (RLS enforced)
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json({ error: "Unauthorized" }, 401);
  }
  const userId = userData.user.id;

  // ── 3. Load the recording under the USER client → RLS decides visibility ────
  const { data: recording, error: loadErr } = await db
    .from("kpi_call_recordings")
    .select(
      "id, imo_id, agent_id, storage_bucket, storage_path, original_filename, mime_type, transcription_status",
    )
    .eq("id", recordingId)
    .maybeSingle();

  if (loadErr) {
    // Status only — a recording row may reference PII-adjacent fields.
    console.error("transcribe-call-recording load error", loadErr.code ?? "");
    return json({ error: "Failed to load recording." }, 500);
  }
  if (!recording) {
    // Not visible to this caller (or nonexistent) — do not distinguish.
    return json({ error: "Recording not found." }, 404);
  }

  // ── 4. Epic Life feature gate (fail closed: error OR false → 403) ───────────
  // Run on the admin (service_role) client: is_epic_life_imo is a PURE function
  // of its argument (caller-independent), so this is semantically identical to a
  // user-client call but immune to function-EXECUTE grant gaps that would
  // otherwise fail closed and 403 every legitimate user. We pass the recording's
  // imo_id, which the caller already proved visibility to via the RLS load above.
  const adminClient = createSupabaseAdminClient();
  const { data: isEpic, error: gateErr } = await adminClient.rpc(
    "is_epic_life_imo",
    { p_imo_id: recording.imo_id },
  );
  if (gateErr || isEpic !== true) {
    return json(
      { error: "Call transcription isn't available for your account." },
      403,
    );
  }

  // ── 5. Rate limit: ~10/hr/user (request axis only — Whisper, not Anthropic) ─
  const limited = await enforceRateLimit(
    adminClient,
    {
      key: `ratelimit:req:transcribe-call-recording:${userId}`,
      maxRequests: 10,
      windowSeconds: 3600,
    },
    cors,
  );
  if (limited) return limited;

  // ── 6. Idempotency: never re-transcribe a completed/in-flight recording ─────
  const status = recording.transcription_status;
  if (status === "completed" || status === "processing") {
    return json({ ok: true, recording_id: recording.id, status });
  }

  // ── 7. Format guard (knowable from the path; reject before downloading) ─────
  // Deviation from the literal contract order (download-then-validate): the
  // extension is derivable from storage_path, so we validate first to avoid
  // downloading a file we will reject. Same terminal outcome ('skipped').
  const ext =
    fileExtension(recording.storage_path) ??
    fileExtension(recording.original_filename);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    await adminClient
      .from("kpi_call_recordings")
      .update({
        transcription_status: "skipped",
        transcription_error:
          "Unsupported audio format; allowed: mp3, mp4, mpeg, mpga, m4a, wav, webm",
      })
      .eq("id", recording.id);
    return json(
      {
        ok: false,
        recording_id: recording.id,
        status: "skipped",
        error: "Unsupported audio format for transcription.",
      },
      400,
    );
  }

  // Everything below can leave a terminal status; the catch-all guarantees we
  // never strand a row in 'processing'.
  try {
    // Mark in-flight (admin — the worker owns the lifecycle column).
    const { error: procErr } = await adminClient
      .from("kpi_call_recordings")
      .update({ transcription_status: "processing", transcription_error: null })
      .eq("id", recording.id);
    if (procErr)
      throw new Error(`Could not mark processing: ${procErr.message}`);

    // Download the audio (admin — bypasses storage RLS; access already gated).
    const bucket = recording.storage_bucket || "call-recordings";
    const { data: blob, error: dlErr } = await adminClient.storage
      .from(bucket)
      .download(recording.storage_path);
    if (dlErr || !blob) {
      throw new Error(
        `Could not download recording: ${dlErr?.message ?? "no data"}`,
      );
    }

    // ── Size guard → skipped (NOT failed): recording stays usable ─────────────
    if (blob.size > MAX_AUDIO_BYTES) {
      await adminClient
        .from("kpi_call_recordings")
        .update({
          transcription_status: "skipped",
          transcription_error:
            "Recording exceeds the 25 MB transcription limit; re-upload as mono ~64 kbps",
        })
        .eq("id", recording.id);
      return json(
        {
          ok: false,
          recording_id: recording.id,
          status: "skipped",
          error:
            "Recording exceeds the 25 MB transcription limit. Re-upload as mono ~64 kbps to enable transcription.",
        },
        413,
      );
    }
    if (blob.size === 0) {
      throw new Error("Recording file is empty.");
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("Transcription is not configured.");

    // ── Whisper call (verbose_json → per-segment timing) ──────────────────────
    const upstream = new FormData();
    const uploadName =
      recording.original_filename && recording.original_filename.includes(".")
        ? recording.original_filename
        : `recording.${ext}`;
    upstream.append("file", blob, uploadName);
    upstream.append("model", "whisper-1");
    upstream.append("response_format", "verbose_json");
    upstream.append("timestamp_granularities[]", "segment");
    upstream.append("language", "en");

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });
    if (!resp.ok) {
      // Status only — never the response body (may echo transcript content).
      console.error("transcribe-call-recording whisper error", resp.status);
      throw new Error(`Transcription service returned ${resp.status}.`);
    }

    const result = (await resp.json()) as WhisperVerboseJson;
    const transcriptText =
      typeof result.text === "string" ? result.text.trim() : "";

    // Persist only the fields we need from each segment (id, start, end, text).
    const segments = Array.isArray(result.segments)
      ? result.segments.map((s) => ({
          id: s.id,
          start: s.start,
          end: s.end,
          text: typeof s.text === "string" ? s.text.trim() : s.text,
        }))
      : null;

    const durationSeconds =
      typeof result.duration === "number" ? Math.round(result.duration) : null;

    const { error: saveErr } = await adminClient
      .from("kpi_call_recordings")
      .update({
        transcript_text: transcriptText,
        transcript_segments: segments,
        duration_seconds: durationSeconds,
        transcript_language: result.language ?? "en",
        transcription_model: "whisper-1",
        transcribed_at: new Date().toISOString(),
        transcription_status: "completed",
        transcription_error: null,
      })
      .eq("id", recording.id);
    if (saveErr)
      throw new Error(`Could not save transcript: ${saveErr.message}`);

    // TODO Phase 3: fire-and-forget call to analyze-call-transcript (word-track
    // detection + AI phrase discovery). Do not block this response on it.

    return json({ ok: true, recording_id: recording.id, status: "completed" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Transcription failed.";
    // Best-effort terminal status so a thrown error never strands 'processing'.
    // Store only our own message — never a Whisper/transcript body.
    await adminClient
      .from("kpi_call_recordings")
      .update({
        transcription_status: "failed",
        transcription_error: message,
      })
      .eq("id", recording.id);
    return json({ ok: false, recording_id: recording.id, error: message }, 500);
  }
});
