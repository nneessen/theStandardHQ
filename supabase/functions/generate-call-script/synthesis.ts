// generate-call-script/synthesis.ts — pure synthesis helpers (no Deno/HTTP/auth).
// Extracted from index.ts so the digest→prompt→validate contract is unit-testable
// in isolation (see scripts/test-call-script-synthesis.ts). Keep the output shape
// in lockstep with src/features/call-reviews/types.ts (GeneratedScript).

export const MAX_DIGEST_CHARS = 7000; // ~1.75k tokens/call → ~26k for 15 + instr.

export interface Segment {
  id?: number;
  start?: number | null;
  end?: number | null;
  text?: string;
  speaker?: number | null;
}
export interface KeyMoment {
  time_seconds?: number | null;
  label?: string;
  kind?: string;
}
export interface ObjectionEvent {
  start_seconds?: number | null;
  quote?: string;
  type?: string;
  is_smoke_screen?: boolean;
  handled?: boolean;
  resolution?: string;
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

export function segmentAtTime(segments: Segment[], t: number): Segment | null {
  let nearest: Segment | null = null;
  let bestDelta = Infinity;
  for (const s of segments) {
    const start = typeof s.start === "number" ? s.start : null;
    if (start == null) continue;
    const end = typeof s.end === "number" ? s.end : start;
    if (t >= start && t <= end) return s;
    const delta = Math.abs(start - t);
    if (delta < bestDelta) {
      bestDelta = delta;
      nearest = s;
    }
  }
  return nearest;
}

// Build ONE compact, extractive digest for a sold call, grounded in real speech +
// the call's already-computed analysis. Bounded by construction (then truncated).
export function buildDigest(call: SourceCall, idx: number): string {
  const segments = asArray<Segment>(call.transcript_segments);
  const label = labelerFor(call);
  const line = (s: Segment): string =>
    `${label(s.speaker)}: ${(typeof s.text === "string" ? s.text : "").trim()}`;

  const parts: string[] = [`### CALL ${idx + 1}`];
  if (typeof call.ai_summary === "string" && call.ai_summary.trim()) {
    parts.push(`[SUMMARY] ${call.ai_summary.trim()}`);
  }
  if (segments.length) {
    parts.push("[OPENING]");
    parts.push(...segments.slice(0, 3).map(line));
  }
  const moments = asArray<KeyMoment>(call.ai_key_moments);
  if (moments.length && segments.length) {
    parts.push("[KEY MOMENTS]");
    for (const m of moments.slice(0, 8)) {
      const t = typeof m.time_seconds === "number" ? m.time_seconds : null;
      const seg = t != null ? segmentAtTime(segments, t) : null;
      const tag = typeof m.kind === "string" ? m.kind : "moment";
      if (seg) parts.push(`(${tag}) ${line(seg)}`);
      else if (typeof m.label === "string") parts.push(`(${tag}) ${m.label}`);
    }
  }
  const objections = asArray<ObjectionEvent>(call.objection_events);
  if (objections.length) {
    parts.push("[OBJECTIONS → REBUTTAL THAT WORKED]");
    for (const o of objections.slice(0, 12)) {
      const type = typeof o.type === "string" ? o.type : "other";
      const quote = typeof o.quote === "string" ? o.quote.trim() : "";
      const res = typeof o.resolution === "string" ? o.resolution.trim() : "";
      if (quote) {
        parts.push(
          `(${type}${o.is_smoke_screen ? ", smoke-screen" : ""}) CLIENT: "${quote}"` +
            (res ? ` → AGENT: ${res}` : ""),
        );
      }
    }
  }
  if (segments.length > 3) {
    parts.push("[CLOSE]");
    parts.push(...segments.slice(-3).map(line));
  }

  let digest = parts.filter((p) => p && p.trim()).join("\n");
  if (digest.length > MAX_DIGEST_CHARS) {
    digest = digest.slice(0, MAX_DIGEST_CHARS) + "\n…[truncated]";
  }
  return digest;
}

// ── prompts ──────────────────────────────────────────────────────────────────
export function systemPrompt(): string {
  return `You are an elite insurance sales coach. From real transcripts of WINNING (sold) phone-sales calls of ONE call type, you build ONE reusable MASTER SCRIPT a new agent could follow start-to-finish.

Hard rules:
- Output ONLY a raw JSON object — no markdown, no code fences, no prose.
- GENERIC & PII-FREE: never include a real name, dollar amount, address, phone, or any client-specific detail. Use placeholders in square brackets: [client name], [spouse name], [coverage amount], [monthly premium], [state], [beneficiary].
- GROUND every line in patterns that RECUR across the sample — one call is not a pattern. Tonality, pacing, pauses, and objection rebuttals must reflect what actually worked across these winning calls.
- FULL coaching annotations: each phase has a goal; each step carries suggested language (say/ask), a delivery note, tonality, a pause cue (a short range like "pause 3-4s" when a pause matters), what the agent should be DOING, and why it works. Phases follow the natural call order (Opening → Rapport/Discovery → Qualification → Presentation → Objection Handling → Close → Wrap-up); omit a phase only if the sample never shows it.
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
SAMPLE: ${digests.length} recent SOLD calls. Synthesize ACROSS ALL of them into one generic master script.

WORD-TRACK LIBRARY (link a step only by an EXACT label below, else null):
${library}

WINNING CALL DIGESTS:
${digests.join("\n\n")}

${schemaBlock()}

Phases in call order. Every step needs a "kind"; a "say"/"ask" step needs non-empty "say"; a "do" step needs non-empty "do". placeholders_used must list every bracket token you used. RAW JSON ONLY.`;
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
