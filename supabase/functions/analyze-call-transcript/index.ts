// analyze-call-transcript — AI + deterministic analysis of a transcribed call
// recording (Epic Life /kpi + /call-reviews training feature).
//
// POST { recording_id } with a user JWT. After transcribe-call-recording has
// produced a diarized transcript, this:
//   1. authenticates (real 401), loads the recording under the USER client so
//      RLS enforces visibility (404), gates to Epic Life IMOs (403),
//   2. AI-rate-limits (shared 30/hr + 200k tok/day) and is idempotent,
//   3. DETERMINISTICALLY detects the IMO's word tracks in the AGENT's speech,
//      anchored to the real transcript_segments timings (never an LLM offset),
//   4. asks Claude (sonnet) to extract client OBJECTIONS / smoke-screens,
//      demographics, a summary, and key moments — re-anchoring any LLM time
//      reference to a real segment by its id,
//   5. writes detections + the recording's analysis columns, setting led_to_sale
//      DETERMINISTICALLY from the call outcome (not the model).
//
// PII: the transcript contains client PII and is sent to Anthropic by necessity
// (that is the analysis). NEVER console.log the transcript or any model output —
// status codes only.

import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from "../_shared/supabase-client.ts";
import { enforceAiRateLimits, recordAiTokens } from "../_shared/rate-limit.ts";

const ANALYSIS_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 3072;

interface Segment {
  id?: number;
  start?: number | null;
  end?: number | null;
  text?: string;
  speaker?: number | null;
}

interface WordTrack {
  id: string;
  label: string;
  phrase: string;
  match_type: string; // exact | fuzzy | regex | semantic
  match_pattern: string | null;
  category: string;
  expected_timing: string; // opening|early|mid|late|closing|any
  expected_window_start_pct: number | null;
  expected_window_end_pct: number | null;
}

interface ClaudeObjection {
  segment_id?: number;
  quote?: string;
  type?: string;
  is_smoke_screen?: boolean;
  handled?: boolean;
  resolution?: string;
}
interface ClaudeKeyMoment {
  segment_id?: number;
  label?: string;
  kind?: string;
}
interface ClaudeResult {
  speaker_roles?: Record<string, string>;
  summary?: string;
  objections?: ClaudeObjection[];
  key_moments?: ClaudeKeyMoment[];
  demographics?: {
    age?: number | null;
    age_band?: string | null;
    gender?: string | null;
    state?: string | null;
    existing_coverage?: string | null;
  };
}

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function timingBucket(pct: number | null): string | null {
  if (pct == null) return null;
  if (pct < 10) return "opening";
  if (pct < 35) return "early";
  if (pct < 65) return "mid";
  if (pct < 90) return "late";
  return "closing";
}

function onExpectedTiming(wt: WordTrack, pct: number | null): boolean | null {
  if (pct == null) return null;
  if (
    wt.expected_window_start_pct != null &&
    wt.expected_window_end_pct != null
  ) {
    return (
      pct >= wt.expected_window_start_pct && pct <= wt.expected_window_end_pct
    );
  }
  if (wt.expected_timing && wt.expected_timing !== "any") {
    return timingBucket(pct) === wt.expected_timing;
  }
  return true;
}

function parseStructuredJson<T>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  const jsonText =
    first !== -1 && last > first ? candidate.slice(first, last + 1) : candidate;
  return JSON.parse(jsonText) as T;
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

  // ── 1. Parse body ──────────────────────────────────────────────────────────
  // `force` re-runs analysis on an already-completed recording (used when the
  // speaker→role map was corrected, or word tracks were edited). The automatic
  // background fire from transcribe-call-recording omits it (stays idempotent).
  let recordingId: string | null = null;
  let force = false;
  let skipRoleDetection = false;
  try {
    const body = (await req.json()) as {
      recording_id?: unknown;
      force?: unknown;
      skip_role_detection?: unknown;
    };
    if (typeof body?.recording_id === "string") recordingId = body.recording_id;
    force = body?.force === true;
    // When true, keep the stored speaker→role map (a human correction) instead of
    // re-detecting roles. The automatic fire from transcribe omits it → detects.
    skipRoleDetection = body?.skip_role_detection === true;
  } catch {
    return json({ error: "Expected JSON body with recording_id." }, 400);
  }
  if (!recordingId) return json({ error: "recording_id is required." }, 400);

  // ── 2. Authenticate ────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
  const db = createSupabaseClient(authHeader);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  // ── 3. Load recording under USER client (RLS decides visibility) ────────────
  const { data: rec, error: loadErr } = await db
    .from("kpi_call_recordings")
    .select(
      "id, imo_id, agent_id, outcome, duration_seconds, transcription_status, analysis_status, transcript_text, transcript_segments, speaker_role_map, caller_age, caller_age_band, caller_gender, caller_state, caller_existing_coverage",
    )
    .eq("id", recordingId)
    .maybeSingle();
  if (loadErr) {
    console.error("analyze-call-transcript load error", loadErr.code ?? "");
    return json({ error: "Failed to load recording." }, 500);
  }
  if (!rec) return json({ error: "Recording not found." }, 404);

  // ── 4. Epic Life feature gate (fail closed) ─────────────────────────────────
  const adminClient = createSupabaseAdminClient();
  const { data: isEpic, error: gateErr } = await adminClient.rpc(
    "is_epic_life_imo",
    { p_imo_id: rec.imo_id },
  );
  if (gateErr || isEpic !== true) {
    return json(
      { error: "Call analysis isn't available for your account." },
      403,
    );
  }

  // ── 5. AI rate limits (shared budget) ───────────────────────────────────────
  const limited = await enforceAiRateLimits(
    adminClient,
    "analyze-call-transcript",
    userId,
    cors,
  );
  if (limited) return limited;

  // ── 6. Idempotency / preconditions ──────────────────────────────────────────
  // A completed analysis is only re-run on an explicit force (e.g. after the
  // speaker→role map was corrected); processing is never re-entered.
  if (
    rec.analysis_status === "processing" ||
    (rec.analysis_status === "completed" && !force)
  ) {
    return json({
      ok: true,
      recording_id: rec.id,
      status: rec.analysis_status,
    });
  }
  const transcriptText =
    typeof rec.transcript_text === "string" ? rec.transcript_text.trim() : "";
  if (rec.transcription_status !== "completed" || !transcriptText) {
    await adminClient
      .from("kpi_call_recordings")
      .update({
        analysis_status: "skipped",
        analysis_model: null,
      })
      .eq("id", rec.id);
    return json(
      {
        ok: false,
        recording_id: rec.id,
        status: "skipped",
        error: "No transcript to analyze.",
      },
      409,
    );
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("Analysis is not configured.");

    // Write-permission gate: claim the row by setting 'processing' under the USER
    // client, so the recording's UPDATE RLS (owner / upline / IMO admin) applies.
    // An IMO-wide *reader* without write access affects 0 rows → 403 (analysis is
    // a curation write, consistent with what role-correction already requires).
    // The automatic background fire from transcribe runs under the uploader's JWT
    // (the owner), so it passes.
    const { data: claimed, error: claimErr } = await db
      .from("kpi_call_recordings")
      .update({ analysis_status: "processing" })
      .eq("id", rec.id)
      .select("id")
      .maybeSingle();
    if (claimErr)
      throw new Error(`Could not start analysis: ${claimErr.message}`);
    if (!claimed) {
      return json(
        { error: "You don't have permission to analyze this recording." },
        403,
      );
    }

    const runId = crypto.randomUUID();
    const duration =
      typeof rec.duration_seconds === "number" && rec.duration_seconds > 0
        ? rec.duration_seconds
        : null;

    const segments: Segment[] = Array.isArray(rec.transcript_segments)
      ? (rec.transcript_segments as Segment[])
      : [];
    const segById = new Map<number, Segment>();
    for (const s of segments)
      if (typeof s.id === "number") segById.set(s.id, s);

    // ── 6. Claude: SPEAKER ROLES (from content) + objections / summary / demographics.
    // The transcript is labeled by SPEAKER NUMBER, not role — so the model decides
    // who is the agent / client / automated from what is actually said, instead of
    // inheriting transcribe's positional "first speaker = agent" guess (wrong on
    // inbound calls that open with an IVR/hold message). Talk-time + word-track
    // matching below then key off the model's classification.
    const diarized = segments
      .map((s) => {
        const spk =
          typeof s.speaker === "number" ? `Speaker ${s.speaker}` : "Speaker ?";
        const t = typeof s.text === "string" ? s.text : "";
        return `[#${s.id ?? "?"}] ${spk}: ${t}`;
      })
      .join("\n");

    const system = `You are an insurance sales call-coaching analyst. You read a diarized phone-sales call transcript and return ONLY a raw JSON object. No markdown, no code fences, no prose.

The transcript lines are labeled by SPEAKER NUMBER ("Speaker 0", "Speaker 1", …); diarization does NOT tell you who is who — you must decide. These are INBOUND calls. The AGENT is the salesperson who answers and runs the call: greets/answers ("thank you for calling", "how can I help you"), introduces themselves by name, asks qualifying questions, and pitches. The CLIENT is the caller/prospect who has a need and raises objections. A speaker that ONLY delivers an automated system / IVR / hold message ("please hold while we connect you…", menu prompts) is "other" — it is NOT the agent. Classify EACH speaker number from what they actually say.

You understand life-insurance phone sales: objections come from the CLIENT (price, "need to talk to my spouse", "let me think about it", "already covered", health concerns, distrust, timing). A SMOKE SCREEN is a stall or non-genuine objection used to end the call rather than a real concern. NEVER infer protected characteristics for discriminatory purposes; demographics are for training analytics only and must come from what is actually said.`;

    const userPrompt = `Analyze this call. Each line is prefixed with a segment id like [#3] and a speaker number.

TRANSCRIPT:
${diarized}

Return JSON with this EXACT schema (use the segment id the moment occurs in; omit fields you cannot determine):
{
  "speaker_roles": { "<every speaker number that appears>": "agent" | "client" | "other" },
  "summary": "2-3 sentence summary of the call and its outcome",
  "objections": [{ "segment_id": number, "quote": "verbatim CLIENT words", "type": "price|spouse_consult|think_about_it|already_covered|health|trust|timing|other", "is_smoke_screen": boolean, "handled": boolean, "resolution": "how the agent responded, 1 sentence" }],
  "key_moments": [{ "segment_id": number, "label": "short label", "kind": "rapport|discovery|pitch|objection|close|compliance|other" }],
  "demographics": { "age": number|null, "age_band": "under_30|30_39|40_49|50_59|60_69|70_plus|unknown", "gender": "male|female|other|unknown", "state": "USPS 2-letter or null", "existing_coverage": "what coverage the client already has, or null" }
}
Classify a role for every speaker number present. Limit objections to the genuine ones (max 12) and key_moments to max 8.`;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: userPrompt }],
    });
    const tokensUsed =
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0);
    await recordAiTokens(adminClient, userId, tokensUsed);
    if (response.stop_reason === "max_tokens") {
      throw new Error("Analysis response was truncated. Try again.");
    }
    const rawText = response.content
      .filter(
        (b): b is { type: "text"; text: string } =>
          b.type === "text" && "text" in b,
      )
      .map((b) => b.text)
      .join("");
    const parsed = parseStructuredJson<ClaudeResult>(rawText);

    // ── 7. Effective speaker→role map. Use Claude's content-based classification,
    // UNLESS this is a manual re-analysis preserving a human correction
    // (skip_role_detection). "other"/automated speakers are omitted → unknown →
    // excluded from talk-time and word-track matching.
    const pickAgentClient = (
      src: Record<string, unknown>,
    ): Record<string, "agent" | "client"> => {
      const out: Record<string, "agent" | "client"> = {};
      for (const [k, v] of Object.entries(src))
        if (v === "agent" || v === "client") out[String(k)] = v;
      return out;
    };
    const storedRoleMap = pickAgentClient(
      (rec.speaker_role_map ?? {}) as Record<string, unknown>,
    );
    let effectiveRoleMap: Record<string, "agent" | "client">;
    if (skipRoleDetection) {
      effectiveRoleMap = storedRoleMap;
    } else {
      const detected =
        parsed.speaker_roles && typeof parsed.speaker_roles === "object"
          ? pickAgentClient(parsed.speaker_roles as Record<string, unknown>)
          : {};
      // Fall back to whatever was stored only if the model returned nothing usable.
      effectiveRoleMap =
        Object.keys(detected).length > 0 ? detected : storedRoleMap;
    }
    const roleOf = (spk: number | null | undefined): string =>
      spk == null ? "unknown" : (effectiveRoleMap[String(spk)] ?? "unknown");

    // Recompute per-speaker talk time from the CURRENT role map, so a corrected
    // map (after a flip + forced re-analysis) also fixes the talk-time split that
    // transcribe wrote from the original heuristic. agent → talk_time_seconds.
    let agentTalk = 0;
    let clientTalk = 0;
    const speakerSet = new Set<number>();
    for (const s of segments) {
      if (typeof s.speaker === "number") speakerSet.add(s.speaker);
      if (typeof s.start === "number" && typeof s.end === "number") {
        const d = Math.max(0, s.end - s.start);
        const role = roleOf(s.speaker);
        if (role === "agent") agentTalk += d;
        else if (role === "client") clientTalk += d;
      }
    }
    const hasTalk = speakerSet.size > 0;

    // ── 7. DETERMINISTIC word-track detection (agent speech, anchored timings) ──
    const { data: tracks } = await adminClient
      .from("kpi_word_tracks")
      .select(
        "id, label, phrase, match_type, match_pattern, category, expected_timing, expected_window_start_pct, expected_window_end_pct",
      )
      .eq("imo_id", rec.imo_id)
      .eq("is_active", true);

    const ledToSale = rec.outcome == null ? null : rec.outcome === "sold";

    const detections: Record<string, unknown>[] = [];
    for (const wt of (tracks ?? []) as WordTrack[]) {
      // Word tracks are AGENT scripts → only match within agent-role segments
      // (or unknown-role, when diarization produced no map).
      const agentSegs = segments.filter((s) => {
        const r = roleOf(s.speaker);
        return r === "agent" || r === "unknown";
      });
      let matcher: ((segText: string) => boolean) | null = null;
      if (wt.match_type === "regex" && wt.match_pattern) {
        try {
          const re = new RegExp(wt.match_pattern, "i");
          matcher = (t) => re.test(t);
        } catch {
          matcher = null; // invalid pattern → skip this track
        }
      } else if (wt.match_type === "exact" || wt.match_type === "fuzzy") {
        const needle = normalize(wt.phrase);
        if (needle) matcher = (t) => normalize(t).includes(needle);
      }
      // 'semantic' tracks are not matched deterministically here (future LLM pass).
      if (!matcher) continue;

      for (const seg of agentSegs) {
        const segText = typeof seg.text === "string" ? seg.text : "";
        if (!segText || !matcher(segText)) continue;
        const start = typeof seg.start === "number" ? seg.start : null;
        const end = typeof seg.end === "number" ? seg.end : null;
        const pct =
          start != null && duration
            ? Math.round((start / duration) * 100)
            : null;
        detections.push({
          recording_id: rec.id,
          word_track_id: wt.id,
          analysis_run_id: runId,
          detected_phrase: segText.slice(0, 500),
          time_start_seconds: start,
          time_end_seconds: end,
          position_pct: pct,
          timing_bucket: timingBucket(pct),
          on_expected_timing: onExpectedTiming(wt, pct),
          match_confidence:
            wt.match_type === "fuzzy"
              ? 0.8
              : wt.match_type === "regex"
                ? 1.0
                : 1.0,
          led_to_sale: ledToSale,
        });
        break; // one detection per track per call (first occurrence)
      }
    }

    // Re-analysis: replace this recording's detections, then insert fresh.
    await adminClient
      .from("kpi_word_track_detections")
      .delete()
      .eq("recording_id", rec.id);
    if (detections.length > 0) {
      const { error: detErr } = await adminClient
        .from("kpi_word_track_detections")
        .insert(detections); // imo_id/agent_id derived by trigger from the parent
      if (detErr)
        throw new Error(`Could not save detections: ${detErr.message}`);
    }

    // (Claude analysis + speaker-role detection ran above in section 6, so the
    // talk-time split and word-track matching key off the model's classification.)

    // Re-anchor LLM segment references to real segment timings (never trust an
    // LLM-produced timestamp). Drop anything that can't be anchored to a segment.
    const objections = Array.isArray(parsed.objections)
      ? parsed.objections
      : [];
    const objectionEvents = objections
      .map((o) => {
        const seg =
          typeof o.segment_id === "number"
            ? segById.get(o.segment_id)
            : undefined;
        return {
          start_seconds: typeof seg?.start === "number" ? seg.start : null,
          end_seconds: typeof seg?.end === "number" ? seg.end : null,
          quote: typeof o.quote === "string" ? o.quote.slice(0, 500) : "",
          type: typeof o.type === "string" ? o.type : "other",
          is_smoke_screen: o.is_smoke_screen === true,
          handled: o.handled === true,
          resolution:
            typeof o.resolution === "string" ? o.resolution.slice(0, 500) : "",
        };
      })
      .filter((o) => o.quote.length > 0);
    const objectionCount = objectionEvents.length;
    const smokeScreenCount = objectionEvents.filter(
      (o) => o.is_smoke_screen,
    ).length;

    const keyMoments = (
      Array.isArray(parsed.key_moments) ? parsed.key_moments : []
    )
      .map((m) => {
        const seg =
          typeof m.segment_id === "number"
            ? segById.get(m.segment_id)
            : undefined;
        return {
          time_seconds: typeof seg?.start === "number" ? seg.start : null,
          label: typeof m.label === "string" ? m.label.slice(0, 200) : "",
          kind: typeof m.kind === "string" ? m.kind : "other",
        };
      })
      .filter((m) => m.label.length > 0 && m.time_seconds != null);

    // Demographics: only-if-null (never clobber a human-entered value).
    const demo = parsed.demographics ?? {};
    const AGE_BANDS = new Set([
      "under_30",
      "30_39",
      "40_49",
      "50_59",
      "60_69",
      "70_plus",
      "unknown",
    ]);
    const GENDERS = new Set(["male", "female", "other", "unknown"]);
    const update: Record<string, unknown> = {
      ai_summary:
        typeof parsed.summary === "string"
          ? parsed.summary.slice(0, 2000)
          : null,
      ai_key_moments: keyMoments.length ? keyMoments : null,
      objection_count: objectionCount,
      smoke_screen_count: smokeScreenCount,
      objection_events: objectionEvents.length ? objectionEvents : null,
      analysis_status: "completed",
      analysis_model: ANALYSIS_MODEL,
      analyzed_at: new Date().toISOString(),
      last_analysis_run_id: runId,
    };
    if (hasTalk) {
      update.talk_time_seconds = Math.round(agentTalk);
      update.client_talk_seconds = Math.round(clientTalk);
      update.speaker_count = speakerSet.size;
    }
    // Persist the (re-)detected speaker→role map so the transcript UI shows the
    // corrected labels. Skipped on a manual re-analysis (keeps the human map).
    if (!skipRoleDetection) {
      update.speaker_role_map =
        Object.keys(effectiveRoleMap).length > 0 ? effectiveRoleMap : null;
    }
    if (rec.caller_age == null && typeof demo.age === "number")
      update.caller_age = Math.round(demo.age);
    if (
      rec.caller_age_band == null &&
      typeof demo.age_band === "string" &&
      AGE_BANDS.has(demo.age_band)
    )
      update.caller_age_band = demo.age_band;
    if (
      rec.caller_gender == null &&
      typeof demo.gender === "string" &&
      GENDERS.has(demo.gender)
    )
      update.caller_gender = demo.gender;
    if (
      rec.caller_state == null &&
      typeof demo.state === "string" &&
      /^[A-Za-z]{2}$/.test(demo.state)
    )
      update.caller_state = demo.state.toUpperCase();
    if (
      rec.caller_existing_coverage == null &&
      typeof demo.existing_coverage === "string" &&
      demo.existing_coverage.trim()
    )
      update.caller_existing_coverage = demo.existing_coverage.slice(0, 500);

    const { error: saveErr } = await adminClient
      .from("kpi_call_recordings")
      .update(update)
      .eq("id", rec.id);
    if (saveErr) throw new Error(`Could not save analysis: ${saveErr.message}`);

    return json({
      ok: true,
      recording_id: rec.id,
      status: "completed",
      detections: detections.length,
      objections: objectionCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed.";
    await adminClient
      .from("kpi_call_recordings")
      .update({ analysis_status: "failed" })
      .eq("id", rec.id);
    return json({ ok: false, recording_id: rec.id, error: message }, 500);
  }
});
