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

import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from "../_shared/supabase-client.ts";
import { resolveAiAccessFacts } from "../_shared/resolve-ai-access.ts";
import { enforceRateLimit, recordAiTokens } from "../_shared/rate-limit.ts";
import {
  buildRedaction,
  redactPlainText,
  type PiiItem,
  type RedactionSpan,
  type RedactSegment,
  type RedactWord,
} from "../_shared/pii-redaction.ts";

// PII detection model (the Claude pass that finds spoken SSN/banking data).
const PII_MODEL = "claude-sonnet-4-6";
const PII_SYSTEM =
  "You are a PII detection assistant for insurance phone-call transcripts. You find SPOKEN sensitive personal data that must be removed before a recording can be shared for training. Return ONLY raw JSON — no markdown, no prose.";

function piiUserPrompt(diarized: string): string {
  return `Each transcript line is prefixed with a segment id like [#3]. Find EVERY occurrence of highly sensitive personal data: Social Security numbers, bank account numbers, bank routing numbers, credit/debit card numbers, card security codes (CVV), and full dates of birth. Do NOT flag: prices, premiums, coverage amounts, ages, policy numbers, generic dates, or phone numbers.

For each occurrence, return the segment id it appears in and the VERBATIM substring exactly as written in that line (so it can be string-matched). If a number is spelled out in words, return those words verbatim.

TRANSCRIPT:
${diarized}

Return JSON with this EXACT schema: { "items": [ { "segment_id": number, "text": "verbatim substring", "type": "ssn|bank_account|routing|card|cvv|dob" } ] }. Return { "items": [] } if there is none.`;
}

// Tolerant JSON extraction (model may wrap in prose/fences). Returns [] on any
// shape problem — detection is best-effort and must never break transcription.
function parsePiiItems(text: string): PiiItem[] {
  try {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fenced?.[1]?.trim() ?? trimmed;
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    const jsonText =
      first !== -1 && last > first
        ? candidate.slice(first, last + 1)
        : candidate;
    const parsed = JSON.parse(jsonText) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items.filter(
      (it): it is PiiItem =>
        it != null &&
        typeof (it as PiiItem).segment_id === "number" &&
        typeof (it as PiiItem).text === "string" &&
        (it as PiiItem).text.trim().length > 0,
    );
  } catch {
    return [];
  }
}

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

interface DeepgramWord {
  word?: string;
  punctuated_word?: string;
  start?: number;
  end?: number;
  speaker?: number;
}

interface DeepgramResponse {
  metadata?: { duration?: number };
  results?: {
    channels?: Array<{
      detected_language?: string;
      alternatives?: Array<{ transcript?: string; words?: DeepgramWord[] }>;
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
  // Privileged backfill path: the internal orchestrator (backfill-call-redaction)
  // calls us with the service-role key as the bearer to re-process pre-Phase-1
  // recordings in bulk. The service-role bearer makes `db` run as service_role
  // (RLS off, any recording loads); we also skip the AI gate + the per-user
  // limiter below. Triggers ONLY for the exact current service-role key (already
  // god-mode — no privilege escalation), never for a user JWT.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const isBackfill = serviceRoleKey.length > 20 && token === serviceRoleKey;
  let userId: string;
  if (isBackfill) {
    userId = "00000000-0000-0000-0000-000000000000"; // system (no human reviewer)
  } else {
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    userId = userData.user.id;
  }

  // ── 3. Load the recording under the USER client → RLS decides visibility ────
  const { data: recording, error: loadErr } = await db
    .from("kpi_call_recordings")
    .select(
      "id, imo_id, agent_id, storage_bucket, storage_path, original_filename, mime_type, file_size_bytes, transcription_status, audio_deleted_at, raw_audio_purged_at",
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
  const { data: isEpic } = await adminClient.rpc("is_epic_life_imo", {
    p_imo_id: recording.imo_id,
  });
  // Team recordings (Epic Life) pass free with no further lookups (the dominant
  // path); otherwise the caller needs super-admin, a free_all_features IMO, or the
  // ai_assistant ("AI Suite") add-on. Mirrors useAiAccess. Fail closed.
  if (!isBackfill && isEpic !== true) {
    const aiFacts = await resolveAiAccessFacts(adminClient, userId);
    if (
      !aiFacts.isSuperAdmin &&
      !aiFacts.imoGrantsAllFeatures &&
      !aiFacts.hasAiAddon
    ) {
      return json(
        { error: "Call transcription isn't available for your account." },
        403,
      );
    }
  }

  // ── 5. Rate limit: ~10/hr/user (request axis only — Deepgram, not Anthropic) ─
  // The privileged backfill batch bypasses the per-user limiter (it re-processes
  // the small fixed set of pre-Phase-1 recordings; the orchestrator paces them).
  if (!isBackfill) {
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
  }

  // ── 6. Idempotency: never re-transcribe a completed/in-flight recording ─────
  const status = recording.transcription_status;
  if (status === "completed" || status === "processing") {
    return json({ ok: true, recording_id: recording.id, status });
  }

  // ── 6b. Write-permission gate ───────────────────────────────────────────────
  // The IMO-wide SELECT policy lets any IMO member READ this recording, but
  // (re)transcribing it is a WRITE that triggers a service_role mutation + an
  // external API call on the recording's audio. Claim the row by setting
  // 'processing' under the USER client so the recording's UPDATE RLS
  // (owner / upline / IMO admin) applies; an IMO-wide *reader* affects 0 rows →
  // 403, before any admin write happens. (Mirrors analyze-call-transcript.) The
  // uploader owns the row, so the normal upload→transcribe path passes.
  //
  // The status predicate also makes the claim ATOMIC: two concurrent invokes (e.g.
  // the upload auto-fire racing a user-clicked retry on a still-'pending' row) both
  // read the row before either flips it, but only the first UPDATE matches a
  // claimable status — the loser affects 0 rows and bails here, so Deepgram is
  // never invoked twice for one recording. (completed/processing already returned
  // at step 6; only pending/failed/skipped are claimable.)
  // Also drop redaction_status → 'detecting': if this is a RE-transcribe of an
  // already-approved (shared) recording, it must leave the shared library
  // immediately (its transcript/audio are about to change) and only return after
  // a fresh redaction + human re-approval. New uploads were 'pending' already.
  const { data: claimed, error: claimErr } = await db
    .from("kpi_call_recordings")
    .update({
      transcription_status: "processing",
      transcription_error: null,
      redaction_status: "detecting",
    })
    .eq("id", recording.id)
    .in("transcription_status", ["pending", "failed", "skipped"])
    .select("id")
    .maybeSingle();
  if (claimErr) {
    console.error("transcribe-call-recording claim error", claimErr.code ?? "");
    return json({ error: "Failed to start transcription." }, 500);
  }
  if (!claimed) {
    return json(
      { error: "You don't have permission to transcribe this recording." },
      403,
    );
  }

  // ── 6c. Missing-raw guard (S7) ──────────────────────────────────────────────
  // The raw audio is the only Deepgram source. If it's gone — retention purge
  // (audio_deleted_at) or Phase-3 post-approval purge (raw_audio_purged_at) — a
  // re-transcribe is impossible. The claim above already dropped this row out of
  // any shared state (redaction_status → 'detecting'); mark it cleanly 'failed'
  // (so it can't be shared while broken) instead of wasting a Deepgram call and
  // surfacing a confusing 404. Transcript-only re-redaction of such rows is a
  // separate backfill path, not this function.
  if (recording.audio_deleted_at || recording.raw_audio_purged_at) {
    await adminClient
      .from("kpi_call_recordings")
      .update({
        transcription_status: "failed",
        transcription_error:
          "Original audio has been deleted; it cannot be re-transcribed.",
        redaction_status: "failed",
      })
      .eq("id", recording.id);
    return json(
      { ok: false, recording_id: recording.id, status: "audio_deleted" },
      409,
    );
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

  // ── 7b. Zero-byte guard (file_size_bytes is captured at upload) ─────────────
  // An empty file would make Deepgram reject with a 400 and strand the row in
  // 'failed'; skip it up front with a clear message (no wasted API call).
  if (recording.file_size_bytes === 0) {
    await adminClient
      .from("kpi_call_recordings")
      .update({
        transcription_status: "skipped",
        transcription_error: "Recording file is empty (0 bytes).",
      })
      .eq("id", recording.id);
    return json(
      {
        ok: false,
        recording_id: recording.id,
        status: "skipped",
        error: "Recording file is empty.",
      },
      400,
    );
  }

  // Everything below can leave a terminal status; the catch-all guarantees we
  // never strand a row in 'processing'.
  try {
    const apiKey = Deno.env.get("DEEPGRAM_API_KEY");
    if (!apiKey) throw new Error("Transcription is not configured.");

    // (Row already claimed as 'processing' under the user client in step 6b.)

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

    // Reconcile the authoritative file size from storage — file_size_bytes at
    // upload is the browser-reported file.size, which the per-IMO storage quota
    // relies on. Best-effort HEAD; never blocks transcription.
    let authoritativeSize: number | null = null;
    try {
      const head = await fetch(signed.signedUrl, { method: "HEAD" });
      const len = Number(head.headers.get("content-length"));
      if (Number.isFinite(len) && len > 0) authoritativeSize = len;
    } catch {
      // keep the client-reported size
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
    // Bound the synchronous Deepgram call so a very long recording fails cleanly
    // (clear message) instead of stalling until the platform kills the function.
    let resp: Response;
    try {
      resp = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: signed.signedUrl }),
        signal: AbortSignal.timeout(280_000),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "TimeoutError") {
        throw new Error(
          "Transcription timed out — the recording may be too long. Split it into shorter segments and re-upload.",
        );
      }
      throw e;
    }
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
    // Filter out any null/non-object array elements before reading fields — a
    // malformed response with a null utterance would otherwise crash the .map/loop.
    const utterances = (
      Array.isArray(result.results?.utterances)
        ? result.results!.utterances!
        : []
    ).filter((u): u is DeepgramUtterance => u != null && typeof u === "object");
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

    // ── PII detection + redaction (runs BETWEEN transcription and analysis) ────
    // Detect spoken SSN / banking PII, REDACT the transcript text IN PLACE, and
    // record audio mute-spans for the Phase 2 ffmpeg worker. Because analyze-call-
    // transcript reads ONLY transcript_segments (never the audio), redacting here
    // makes every downstream AI field (summary, objection quotes, …) clean by
    // construction. Claude is BEST-EFFORT: if it's unavailable (no key / Anthropic
    // down or out of credits) we fall back to regex only and flag the detector so
    // the human reviewer knows to look harder. Either way the recording lands in
    // 'needs_review' (quarantined) — never auto-shared. Raw PII is never persisted.
    const dgWords: RedactWord[] = (Array.isArray(alt?.words) ? alt!.words! : [])
      .filter((w): w is DeepgramWord => w != null && typeof w === "object")
      .map((w) => ({
        word: typeof w.word === "string" ? w.word : "",
        punctuated_word:
          typeof w.punctuated_word === "string" ? w.punctuated_word : undefined,
        start: typeof w.start === "number" ? w.start : null,
        end: typeof w.end === "number" ? w.end : null,
        speaker: typeof w.speaker === "number" ? w.speaker : null,
      }));

    let redactedSegments: RedactSegment[] | null = segments;
    let redactedTranscript = transcriptText;
    let redactionSpans: RedactionSpan[] = [];
    let redactionDetector = "none";

    if (segments && segments.length) {
      let claudeItems: PiiItem[] = [];
      let usedClaude = false;
      const piiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (piiKey) {
        try {
          const diarized = segments
            .map(
              (s) => `[#${s.id}] Speaker ${s.speaker ?? "?"}: ${s.text ?? ""}`,
            )
            .join("\n");
          const anthropic = new Anthropic({ apiKey: piiKey });
          const piiResp = await anthropic.messages.create({
            model: PII_MODEL,
            max_tokens: 1024,
            system: PII_SYSTEM,
            messages: [{ role: "user", content: piiUserPrompt(diarized) }],
          });
          const tok =
            (piiResp.usage?.input_tokens ?? 0) +
            (piiResp.usage?.output_tokens ?? 0);
          await recordAiTokens(adminClient, userId, tok);
          const piiText = piiResp.content
            .filter(
              (b): b is { type: "text"; text: string } =>
                b.type === "text" && "text" in b,
            )
            .map((b) => b.text)
            .join("");
          claudeItems = parsePiiItems(piiText);
          usedClaude = true;
        } catch (e) {
          // Status/name only — NEVER log transcript or model content.
          console.error(
            "transcribe-call-recording pii pass failed",
            e instanceof Error ? e.name : "",
          );
        }
      }
      const redaction = buildRedaction({
        segments,
        words: dgWords,
        claudeItems,
        durationSeconds,
      });
      redactedSegments = redaction.segments;
      redactedTranscript = redaction.transcriptText;
      redactionSpans = redaction.spans;
      redactionDetector = usedClaude ? "claude+regex" : "regex_only";
    } else if (transcriptText) {
      // Rare: no utterance segments to redact per line — best-effort regex on the
      // flat transcript so raw PII is still never persisted.
      redactedTranscript = redactPlainText(transcriptText).text;
      redactionDetector = "regex_only";
    }

    const { error: saveErr } = await adminClient
      .from("kpi_call_recordings")
      .update({
        ...(authoritativeSize != null
          ? { file_size_bytes: authoritativeSize }
          : {}),
        transcript_text: redactedTranscript,
        transcript_segments: redactedSegments,
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
        // Quarantine for human review (Phase 3) before it can be shared IMO-wide.
        redaction_status: "needs_review",
        redaction_spans: redactionSpans,
        redaction_detector: redactionDetector,
        // Re-arm the audio muting step (clears a stale 'done' on a re-transcribe,
        // whose spans just changed) so the redact-call-audio fire below re-runs.
        audio_redaction_status: "pending",
        audio_redaction_error: null,
      })
      .eq("id", recording.id);
    if (saveErr)
      throw new Error(`Could not save transcript: ${saveErr.message}`);

    // ── Fire analyze-call-transcript in the background ────────────────────────
    // Word-track detection + objection extraction + AI demographics. Never blocks
    // or fails this response; harmlessly no-ops until that function is deployed.
    try {
      const analyzeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-call-transcript`;
      // The functions gateway requires BOTH apikey and Authorization (the browser
      // client sends both; a raw edge→edge fetch must too, or it 401s before the
      // function runs). Log a non-ok/failed dispatch (status only — never content)
      // instead of swallowing it, so a stuck analysis is diagnosable.
      const fire = fetch(analyzeUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recording_id: recording.id }),
      })
        .then((r) => {
          if (!r.ok) console.error("analyze dispatch non-ok", r.status);
        })
        .catch((e) =>
          console.error(
            "analyze dispatch failed",
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
      /* never fail transcription on analysis dispatch */
    }

    // ── Fire redact-call-audio in the background ──────────────────────────────
    // Mutes the detected PII spans in the audio (Phase 2 ffmpeg worker). Never
    // blocks/fails this response; no-ops until AUDIO_WORKER_URL is configured.
    try {
      const redactUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/redact-call-audio`;
      const fireRedact = fetch(redactUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recording_id: recording.id }),
      })
        .then((r) => {
          if (!r.ok) console.error("redact-audio dispatch non-ok", r.status);
        })
        .catch((e) =>
          console.error(
            "redact-audio dispatch failed",
            e instanceof Error ? e.message : "",
          ),
        );
      const runtime2 = (
        globalThis as {
          EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
        }
      ).EdgeRuntime;
      if (runtime2?.waitUntil) runtime2.waitUntil(fireRedact);
    } catch {
      /* never fail transcription on audio-redaction dispatch */
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
        // A failed (re)transcribe must not stay shared: the claim above set
        // 'detecting'; keep it out of the IMO-wide library until it succeeds.
        redaction_status: "failed",
      })
      .eq("id", recording.id);
    return json({ ok: false, recording_id: recording.id, error: message }, 500);
  }
});
