// transcribe-call-recording — Deepgram diarized transcription for an uploaded
// inbound-call recording (Epic Life /kpi + /call-reviews training feature).
//
// POST { recording_id } with a user JWT. The function:
//   1. authenticates the caller (real 401 — RLS-empty is not authentication),
//   2. loads the recording with the USER-scoped client so RLS enforces visibility
//      (404 if the caller can't see it),
//   3. gates the feature to Epic Life IMOs via is_epic_life_imo (403 otherwise),
//   4. rate-limits (~10/hr/user), is idempotent, then transcribes with Deepgram
//      nova-2 (diarize + utterances) and writes the diarized transcript, per-speaker
//      talk-time, and a flippable speaker→role map back to the row,
//   5. fires analyze-call-transcript in the background (never blocks/breaks this).
//
// WHY Deepgram (replaced Whisper): Whisper has no speaker diarization and caps
// uploads at 25 MB. Deepgram returns transcript + speaker labels + per-speaker
// timing in one call, and — because we hand it a short-lived SIGNED URL instead of
// downloading the audio here — there is no file-size/edge-memory cap at all.
//
// PII: the spoken words may contain client PII. NEVER console.log the transcript,
// a signed URL, or any Deepgram response body — status codes only.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from "../_shared/supabase-client.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";

// Container/extension set Deepgram handles (superset of the old Whisper list;
// matches the call-recordings bucket's allowed MIME types). No size cap: Deepgram
// fetches the audio itself from the signed URL, so nothing is buffered here.
const ALLOWED_EXTENSIONS = new Set([
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "wav",
  "webm",
  "aac",
  "ogg",
  "oga",
  "flac",
]);

// How long Deepgram has to fetch the audio from the signed URL.
const SIGNED_URL_TTL_SECONDS = 600;

interface DeepgramUtterance {
  start?: number;
  end?: number;
  transcript?: string;
  speaker?: number;
}

interface DeepgramResponse {
  metadata?: { duration?: number };
  results?: {
    channels?: Array<{
      detected_language?: string;
      alternatives?: Array<{ transcript?: string }>;
    }>;
    utterances?: DeepgramUtterance[];
  };
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
  // user-client call but immune to function-EXECUTE grant gaps. We pass the
  // recording's imo_id, which the caller proved visibility to via the RLS load.
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

  // ── 5. Rate limit: ~10/hr/user (request axis only — Deepgram, not Anthropic) ─
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

  // ── 7. Format guard (knowable from the path; reject before any work) ────────
  const ext =
    fileExtension(recording.storage_path) ??
    fileExtension(recording.original_filename);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    await adminClient
      .from("kpi_call_recordings")
      .update({
        transcription_status: "skipped",
        transcription_error:
          "Unsupported audio format; allowed: mp3, mp4, m4a, wav, webm, aac, ogg, flac",
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
    const apiKey = Deno.env.get("DEEPGRAM_API_KEY");
    if (!apiKey) throw new Error("Transcription is not configured.");

    // Mark in-flight (admin — the worker owns the lifecycle column).
    const { error: procErr } = await adminClient
      .from("kpi_call_recordings")
      .update({ transcription_status: "processing", transcription_error: null })
      .eq("id", recording.id);
    if (procErr)
      throw new Error(`Could not mark processing: ${procErr.message}`);

    // Short-lived signed URL — Deepgram fetches the (private) audio itself, so we
    // never download/buffer it here (no size cap, no edge-memory ceiling).
    const bucket = recording.storage_bucket || "call-recordings";
    const { data: signed, error: signErr } = await adminClient.storage
      .from(bucket)
      .createSignedUrl(recording.storage_path, SIGNED_URL_TTL_SECONDS);
    if (signErr || !signed?.signedUrl) {
      throw new Error(
        `Could not sign recording URL: ${signErr?.message ?? "no url"}`,
      );
    }

    // ── Deepgram prerecorded: nova-2 + diarization + utterances ───────────────
    const params = new URLSearchParams({
      model: "nova-2",
      diarize: "true",
      utterances: "true",
      smart_format: "true",
      punctuate: "true",
      language: "en",
    });
    const resp = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: signed.signedUrl }),
    });
    if (!resp.ok) {
      // Status only — never the response body (may echo transcript content).
      console.error("transcribe-call-recording deepgram error", resp.status);
      throw new Error(`Transcription service returned ${resp.status}.`);
    }

    const result = (await resp.json()) as DeepgramResponse;
    const alt = result.results?.channels?.[0]?.alternatives?.[0];
    const transcriptText =
      typeof alt?.transcript === "string" ? alt.transcript.trim() : "";

    // Diarized segments: one per utterance, carrying the speaker index. This is
    // the new shape the transcript UI reads (Whisper segments had no speaker).
    const utterances = Array.isArray(result.results?.utterances)
      ? result.results!.utterances!
      : [];
    const segments = utterances.length
      ? utterances.map((u, i) => ({
          id: i,
          start: typeof u.start === "number" ? u.start : null,
          end: typeof u.end === "number" ? u.end : null,
          text: typeof u.transcript === "string" ? u.transcript.trim() : "",
          speaker: typeof u.speaker === "number" ? u.speaker : null,
        }))
      : null;

    // Per-speaker talk time + role map. Heuristic: on an inbound call the AGENT
    // answers first, so the first utterance's speaker → 'agent', others → 'client'.
    // The map is stored so the UI can flip it with one click if the call opened
    // differently. talk_time_seconds (existing column) holds AGENT talk time.
    const talkBySpeaker = new Map<number, number>();
    for (const u of utterances) {
      if (typeof u.speaker !== "number") continue;
      const dur =
        typeof u.start === "number" && typeof u.end === "number"
          ? Math.max(0, u.end - u.start)
          : 0;
      talkBySpeaker.set(u.speaker, (talkBySpeaker.get(u.speaker) ?? 0) + dur);
    }
    const firstSpeaker =
      utterances.find((u) => typeof u.speaker === "number")?.speaker ?? null;
    const speakerRoleMap: Record<string, "agent" | "client"> = {};
    let agentTalk = 0;
    let clientTalk = 0;
    for (const [spk, secs] of talkBySpeaker) {
      const role = spk === firstSpeaker ? "agent" : "client";
      speakerRoleMap[String(spk)] = role;
      if (role === "agent") agentTalk += secs;
      else clientTalk += secs;
    }
    const hasSpeakers = talkBySpeaker.size > 0;

    const durationSeconds =
      typeof result.metadata?.duration === "number"
        ? Math.round(result.metadata.duration)
        : null;

    const { error: saveErr } = await adminClient
      .from("kpi_call_recordings")
      .update({
        transcript_text: transcriptText,
        transcript_segments: segments,
        duration_seconds: durationSeconds,
        talk_time_seconds: hasSpeakers ? Math.round(agentTalk) : null,
        client_talk_seconds: hasSpeakers ? Math.round(clientTalk) : null,
        speaker_count: hasSpeakers ? talkBySpeaker.size : null,
        speaker_role_map: hasSpeakers ? speakerRoleMap : null,
        transcript_language:
          result.results?.channels?.[0]?.detected_language ?? "en",
        transcript_provider: "deepgram",
        transcription_model: "nova-2",
        transcribed_at: new Date().toISOString(),
        transcription_status: "completed",
        transcription_error: null,
      })
      .eq("id", recording.id);
    if (saveErr)
      throw new Error(`Could not save transcript: ${saveErr.message}`);

    // ── Fire analyze-call-transcript in the background ────────────────────────
    // Word-track detection + objection extraction + AI demographics. Never blocks
    // or fails this response; harmlessly no-ops until that function is deployed.
    try {
      const analyzeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-call-transcript`;
      const fire = fetch(analyzeUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recording_id: recording.id }),
      })
        .then(() => {})
        .catch(() => {});
      const runtime = (
        globalThis as {
          EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
        }
      ).EdgeRuntime;
      if (runtime?.waitUntil) runtime.waitUntil(fire);
    } catch {
      /* never fail transcription on analysis dispatch */
    }

    return json({ ok: true, recording_id: recording.id, status: "completed" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Transcription failed.";
    // Best-effort terminal status so a thrown error never strands 'processing'.
    // Store only our own message — never a Deepgram/transcript body.
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
