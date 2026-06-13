// generate-call-script/synthesis.ts — pure synthesis helpers (no Deno/HTTP/auth).
// Extracted from index.ts so the digest→prompt→validate contract is unit-testable
// in isolation (see scripts/test-call-script-synthesis.ts). Keep the output shape
// in lockstep with src/features/call-reviews/types.ts (GeneratedScript).

// We feed the model the ACTUAL (cleaned) transcript, not a derived summary —
// "it isn't reading the calls" was the whole problem, and the old summary/excerpt
// digest both starved and BIASED the model (the analyze-step summary pre-framed
// service calls as sales "pitches"). ~30k chars ≈ 7.5k tokens/call lets a typical
// full call through; only very long calls get head+tail trimmed. Sonnet 4.6's 1M
// window easily holds 15 of these.
export const MAX_DIGEST_CHARS = 30000;

export interface Segment {
  id?: number;
  start?: number | null;
  end?: number | null;
  text?: string;
  speaker?: number | null;
}
export interface SourceCall {
  id: string;
  ai_summary: string | null;
  ai_key_moments: unknown;
  objection_events: unknown;
  transcript_segments: unknown;
  speaker_role_map: unknown;
  duration_seconds: number | null;
}
export interface WordTrack {
  id: string;
  label: string;
  phrase: string;
  category: string | null;
}

export const asArray = <T>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : [];

export const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  const jsonText =
    first !== -1 && last > first ? candidate.slice(first, last + 1) : candidate;
  return JSON.parse(jsonText);
}

// Normalize a speaker→role map ({"0":"agent"}); tolerate "Speaker 0" keys.
export function pickAgentClient(
  src: unknown,
): Record<string, "agent" | "client"> {
  const out: Record<string, "agent" | "client"> = {};
  if (src && typeof src === "object") {
    for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
      if (v === "agent" || v === "client") {
        const m = String(k).match(/(\d+)\s*$/);
        out[m ? m[1] : String(k).trim()] = v;
      }
    }
  }
  return out;
}

// Decide a label fn for a call's speakers. Prefer the stored role map; else fall
// back to talk-time (the speaker who talks most on a SOLD call ≈ the agent); else
// label by raw speaker number. Handles the null-speaker_role_map case so a call
// never contributes an unlabeled / empty digest.
export function labelerFor(call: SourceCall) {
  const roleMap = pickAgentClient(call.speaker_role_map);
  if (Object.keys(roleMap).length > 0) {
    return (spk: number | null | undefined): string => {
      if (typeof spk !== "number") return "SPEAKER";
      const r = roleMap[String(spk)];
      return r === "agent" ? "AGENT" : r === "client" ? "CLIENT" : `SPK${spk}`;
    };
  }
  // No role map: do NOT guess agent vs client. Talk-time is unreliable (the
  // client dominates airtime on discovery-heavy calls), and a wrong AGENT/CLIENT
  // label poisons every digest line. Label neutrally by speaker number instead —
  // the objection quote→rebuttal pairs are role-tagged independently from
  // objection_events, so the model still gets the key role signal.
  return (spk: number | null | undefined): string =>
    typeof spk === "number" ? `Speaker ${spk}` : "Speaker ?";
}

// Build a CLEANED, readable transcript for one winning call — the actual
// conversation, not a derived summary. We deliberately do NOT feed ai_summary /
// ai_key_moments / objection_events: those were written by the analyze step with
// a sales lens (it labeled service calls "replacement pitches"), so leaning on
// them re-injects the exact bias we're removing. The model reads the real turns
// and infers the recurring pattern itself.
//
// Cleanup that makes the transcript usable (raw ASR is fragmented + noisy):
//   • merge consecutive same-speaker segments into one turn ("is this Trinity" /
//     "Life Insurance?" → one CLIENT line);
//   • drop IVR / hold / system lines (when a role map exists, any speaker not
//     mapped to agent/client is system noise);
//   • label each turn AGENT / CLIENT.
export function buildDigest(call: SourceCall, idx: number): string {
  const segments = asArray<Segment>(call.transcript_segments);
  const label = labelerFor(call);
  const hasRoleMap =
    Object.keys(pickAgentClient(call.speaker_role_map)).length > 0;

  const turns: { who: string; text: string }[] = [];
  for (const s of segments) {
    const text = (typeof s.text === "string" ? s.text : "").trim();
    if (!text) continue;
    const who = label(s.speaker);
    // With a role map, anything not AGENT/CLIENT (e.g. the IVR greeting) is noise.
    if (hasRoleMap && who !== "AGENT" && who !== "CLIENT") continue;
    const last = turns[turns.length - 1];
    if (last && last.who === who) last.text += " " + text;
    else turns.push({ who, text });
  }

  const header = `### CALL ${idx + 1} (outcome: sold)`;
  let body: string;
  if (turns.length > 0) {
    body = turns.map((t) => `${t.who}: ${t.text}`).join("\n");
  } else if (typeof call.ai_summary === "string" && call.ai_summary.trim()) {
    // Fallback ONLY when a call has no usable transcript turns at all.
    body = `[no transcript available — summary only] ${call.ai_summary.trim()}`;
  } else {
    body = "[no transcript available]";
  }

  let digest = `${header}\n${body}`;
  if (digest.length > MAX_DIGEST_CHARS) {
    // Preserve the OPENING (the service-first flow that was being mis-modeled)
    // and the CLOSE (where the consultative reveal/close happens); drop the
    // saggy middle rather than the start.
    const head = digest.slice(0, Math.floor(MAX_DIGEST_CHARS * 0.62));
    const tail = digest.slice(-Math.floor(MAX_DIGEST_CHARS * 0.33));
    digest = `${head}\n…[middle of call omitted for length]…\n${tail}`;
  }
  return digest;
}

// ── prompts ──────────────────────────────────────────────────────────────────
export function systemPrompt(): string {
  return `You are an expert call coach for an insurance agency's INBOUND policyholder calls. You are given the real transcripts of calls of ONE type that ended in a WIN, and you build ONE reusable MASTER SCRIPT a newer agent could follow start-to-finish on a live call of that same type.

CRITICAL — these are NOT cold sales calls and the agent does NOT open with a pitch. They are inbound calls from people who ALREADY own policies and are calling about a service need (update a bank account / billing, change a beneficiary, a coverage or claim question, etc.). Read the transcripts: the winning agent consistently
  1. answers, gives their name, and asks how they can help — service first;
  2. lets the caller state their reason and takes it seriously — actually helping with the stated request;
  3. gathers the relevant policy details while assisting (when it was issued, face amount, monthly premium, carrier), often putting the caller on a brief hold to look things up;
  4. THEN, consultatively and low-pressure ("pull, not push"), surfaces something about the policyholder's OWN policy they may not be aware of and educates them on it — only then positioning a next step.
Build the script in THAT order, mirroring how these calls actually unfold. Do NOT invent a generic "Presentation → Close" sales arc the transcripts don't support. But do NOT stop short either: carry the script through to wherever these winning calls actually land (e.g. the consultative reveal and the next step the agent guides the client toward).

Hard rules:
- Output ONLY a raw JSON object — no markdown, no code fences, no prose.
- GROUND every line in what the AGENT actually says and does and in what RECURS across these calls — one call is not a pattern. The specific angle for this call type must come from the transcripts, NOT from assumptions about the call-type's name. Do not fabricate language the calls don't show.
- GENERIC & PII-FREE: never include a real name, dollar amount, address, phone, policy number, or carrier-specific detail from a call. Use square-bracket placeholders: [client name], [spouse name], [carrier], [face amount], [monthly premium], [cash value], [state], [beneficiary].
- FULL coaching annotations: each phase has a goal; each step carries suggested language (say/ask), a delivery note, tonality, a pause cue (a short range like "pause 3-4s" when a pause matters), what the agent should be DOING, why it works, and any objection→rebuttal that recurs.
- Word tracks: if a step's language matches a phrase in the provided WORD-TRACK LIBRARY, set word_track_hint to that library item's EXACT label (or null). Do NOT invent ids.`;
}

export function schemaBlock(): string {
  return `Return JSON with EXACTLY this shape:
{
  "call_type": string,
  "summary": "one paragraph: the winning arc and the agent's posture",
  "estimated_call_minutes": number | null,
  "key_principles": [ "cross-cutting coaching takeaway", ... ],
  "placeholders_used": [ "[client name]", ... ],
  "phases": [
    {
      "title": string,
      "goal": string,
      "est_minutes": number | null,
      "call_pct": number | null,
      "tonality": string | null,
      "steps": [
        {
          "kind": "say" | "ask" | "do" | "transition",
          "say": "suggested generic language (empty only for a pure do step)",
          "delivery_note": string | null,
          "tonality": string | null,
          "pause_cue": string | null,
          "do": "what the agent is doing (non-empty when kind is do)",
          "word_track_hint": "exact library label" | null,
          "why_it_works": string | null,
          "objections": [
            { "objection": string, "type": string | null, "rebuttal": string, "tonality": string | null }
          ]
        }
      ]
    }
  ]
}`;
}

export function userPrompt(
  callTypeName: string,
  digests: string[],
  tracks: WordTrack[],
): string {
  const library = tracks.length
    ? tracks.map((t) => `- ${t.label} :: ${t.phrase}`).join("\n")
    : "(none)";
  return `CALL TYPE: ${callTypeName}
Below are the FULL transcripts of ${digests.length} recent inbound "${callTypeName}" calls that ended in a WIN. Read them and synthesize the recurring winning approach into ONE generic master script for this call type. The specific angle (what the agent uncovers and how) must come from what the agent actually does in these transcripts.

WORD-TRACK LIBRARY (link a step only by an EXACT label below, else null):
${library}

WINNING CALL TRANSCRIPTS:
${digests.join("\n\n")}

${schemaBlock()}

Phases must follow the natural order these calls actually unfold (service first — greeting and "how can I help", then the caller's stated need, then gathering policy details, then the consultative reveal and next step). Every step needs a "kind"; a "say"/"ask" step needs non-empty "say"; a "do" step needs non-empty "do". placeholders_used must list every bracket token you used. RAW JSON ONLY.`;
}

// ── output validation + normalization (defense in depth) ─────────────────────
const STEP_KINDS = new Set(["say", "ask", "do", "transition"]);
const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && isFinite(v) ? v : null;
const strOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

// Redact stray client-identifying data the model may have slipped past the prompt.
export function redactPii(text: string): string {
  return text
    .replace(/\$\s?\d[\d,]*(?:\.\d+)?/g, "[amount]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[redacted]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[redacted]");
}

function normalizeStep(raw: unknown, tracks: WordTrack[]): unknown | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const kind = STEP_KINDS.has(s.kind as string) ? (s.kind as string) : "say";
  const say = typeof s.say === "string" ? redactPii(s.say.trim()) : "";
  const doAction = typeof s.do === "string" ? redactPii(s.do.trim()) : "";
  if (kind === "do") {
    if (!doAction) return null;
  } else if (!say) {
    return null;
  }
  const word_track_ids: string[] = [];
  const hint =
    typeof s.word_track_hint === "string" ? normalize(s.word_track_hint) : "";
  if (hint) {
    for (const t of tracks) {
      // The model is instructed to emit the EXACT library label, so match on
      // normalized EXACT equality (label or phrase). Substring matching let a
      // short label like "close" wrongly link to "disclosure" / "foreclose".
      if (hint === normalize(t.label) || hint === normalize(t.phrase)) {
        word_track_ids.push(t.id);
        break;
      }
    }
  }
  const objections = asArray<Record<string, unknown>>(s.objections)
    .map((o) => {
      const objection =
        typeof o.objection === "string" ? redactPii(o.objection.trim()) : "";
      const rebuttal =
        typeof o.rebuttal === "string" ? redactPii(o.rebuttal.trim()) : "";
      if (!objection || !rebuttal) return null;
      return {
        objection,
        type: strOrNull(o.type),
        rebuttal,
        tonality: strOrNull(o.tonality),
      };
    })
    .filter((o): o is NonNullable<typeof o> => o !== null);

  return {
    kind,
    say,
    delivery_note: strOrNull(s.delivery_note),
    tonality: strOrNull(s.tonality),
    pause_cue: strOrNull(s.pause_cue),
    do: doAction,
    word_track_ids,
    why_it_works: strOrNull(s.why_it_works),
    objections,
  };
}

export function normalizeScript(
  parsed: unknown,
  callTypeName: string,
  tracks: WordTrack[],
): Record<string, unknown> {
  const p = (parsed ?? {}) as Record<string, unknown>;
  const phases = asArray<Record<string, unknown>>(p.phases)
    .map((ph) => {
      const title = typeof ph.title === "string" ? ph.title.trim() : "";
      const goal = typeof ph.goal === "string" ? ph.goal.trim() : "";
      if (!title) return null;
      const steps = asArray<unknown>(ph.steps)
        .map((st) => normalizeStep(st, tracks))
        .filter((st): st is NonNullable<typeof st> => st !== null);
      if (steps.length === 0) return null; // drop empty phases
      return {
        title,
        goal,
        est_minutes: numOrNull(ph.est_minutes),
        call_pct: numOrNull(ph.call_pct),
        tonality: strOrNull(ph.tonality),
        steps,
      };
    })
    .filter((ph): ph is NonNullable<typeof ph> => ph !== null);

  if (phases.length === 0) {
    throw new Error("Model produced no usable phases.");
  }
  return {
    call_type: typeof p.call_type === "string" ? p.call_type : callTypeName,
    summary: typeof p.summary === "string" ? redactPii(p.summary.trim()) : "",
    estimated_call_minutes: numOrNull(p.estimated_call_minutes),
    key_principles: asArray<unknown>(p.key_principles)
      .filter((x) => typeof x === "string" && x.trim())
      .map((x) => (x as string).trim())
      .slice(0, 12),
    placeholders_used: asArray<unknown>(p.placeholders_used)
      .filter((x) => typeof x === "string" && x.trim())
      .map((x) => (x as string).trim())
      .slice(0, 30),
    phases,
  };
}
