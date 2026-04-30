// Sequence (Workflow) generator. Emits a full Close sequence payload with
// INLINE generated email/SMS content that gets materialized into real templates
// at save time (the save flow creates templates first, then the sequence).
//
// Uses claude-sonnet-4-6 because the structured JSON shape is complex and
// Haiku produces more off-shape output for multi-step payloads.

import {
  extractText,
  getAnthropicClient,
  MODEL_SMART,
  parseJsonFromText,
} from "./anthropic-client.ts";

export interface SequencePromptOptions {
  /** Audience / lead type, e.g. "new IUL quote requests" */
  audience?: string;
  /** Tone hint across all messages in the sequence */
  tone?: string;
  /** Total duration (days) the sequence should span */
  totalDays?: number;
  /** Approximate number of touches across the sequence */
  touchCount?: number;
  /** Channels allowed — verified live: both email and sms work. */
  channels?: Array<"email" | "sms">;
  /** IANA timezone string — always America/New_York; sent for copy context only. */
  timezone?: string;
  /** Threading for email replies — "new_thread" sends as new, "old_thread" chains */
  threading?: "new_thread" | "old_thread";
  /** User-declared intent: run once per lead or allow re-enrollment. Annotation only — not a Close API field. */
  runMode?: "once" | "multiple";
  /** Whether SMS steps should carry a "Reply STOP to opt out" footer. Default true. */
  includeStop?: boolean;
  /** Extra constraints from the user */
  constraints?: string;
}

/** What the AI emits for each step — inline content, not IDs yet. */
export interface GeneratedSequenceStep {
  step_type: "email" | "sms";
  /** Day number from sequence start (1-based, converted to seconds at save) */
  day: number;
  /** For email steps */
  generated_email?: {
    name: string;
    subject: string;
    body: string;
  };
  /** For SMS steps */
  generated_sms?: {
    name: string;
    text: string;
  };
  threading?: "new_thread" | "old_thread";
}

export interface GeneratedSequence {
  name: string;
  timezone: string;
  steps: GeneratedSequenceStep[];
  /** Optional plain-english summary of the strategy for UI display */
  rationale?: string;
}

export interface SequenceGenerationResult {
  sequence: GeneratedSequence;
  model: string;
  input_tokens: number;
  output_tokens: number;
}

const SYSTEM_PROMPT = `You are an expert Close CRM sequence architect for insurance agents.

Your job: take a natural-language prompt describing a multi-touch outreach sequence and produce a complete, ready-to-save Close sequence (Close calls them "Workflows" in the UI).

STRICT OUTPUT FORMAT — return ONLY valid JSON matching this shape, nothing else:
{
  "name": "sequence name (max 80 chars, descriptive so agent can find it later)",
  "timezone": "IANA timezone string, e.g. America/Los_Angeles",
  "rationale": "1-3 sentence plain-english summary of the sequence strategy",
  "steps": [
    {
      "step_type": "email",
      "day": 1,
      "generated_email": {
        "name": "template name (will be saved as a shared Close email template)",
        "subject": "subject line",
        "body": "email body with \\n newlines"
      },
      "threading": "new_thread"
    },
    {
      "step_type": "sms",
      "day": 3,
      "generated_sms": {
        "name": "template name (shared Close SMS template)",
        "text": "SMS body under 320 chars"
      }
    }
  ]
}

CLOSE MUSTACHE VARIABLES you may use in any subject/body/text:
- {{ contact.first_name }}
- {{ contact.last_name }}
- {{ lead.display_name }}
- {{ lead.url }}
- {{ user.first_name }}

STEP RULES:
1. "day" is 1-indexed from the sequence start (user-friendly mental model). Day 1 = immediately on enrollment. Day 3 = 2 days after Day 1. Day 9 = 6 days after Day 3. The backend converts these absolute day numbers into Close's relative per-step delay format at save time, so you do NOT need to compute seconds yourself.
2. step_type must be "email" or "sms" (lowercase).
3. An email step MUST have "generated_email" with non-empty name/subject/body and threading ("new_thread" or "old_thread").
4. An SMS step MUST have "generated_sms" with non-empty name/text. Do NOT include "threading" on SMS steps.
5. Template names must be concise and descriptive of the step purpose (e.g. "Day 1 Intro", "Follow-up 2", "Final nudge"). Do NOT include the sequence name in the template name — the backend automatically prefixes template names with the sequence name in square brackets at save time so agents can search the Close template library for all templates belonging to a sequence. Double-prefixing is ugly.
6. Step order must be sorted by ascending "day".
7. A good sequence has varied content — don't repeat the same opening line across steps.
8. Email bodies should be genuinely human. No salesy language, no ALL CAPS, no "ACT NOW" urgency. Insurance leads are skeptical; write like a real person.
9. SMS text must stay under 320 characters including any opt-out footer when present.
10. SMS opt-out footer behavior is controlled per-request — see the user message's "SMS opt-out" instruction. Always honor that instruction exactly.
11. Follow-up messages should reference earlier touches naturally ("following up on my email" etc.) without being robotic.

OUTPUT: Return ONLY the JSON object. No prose, no markdown fences, no commentary.`;

function buildUserMessage(
  userPrompt: string,
  options: SequencePromptOptions,
): string {
  const parts: string[] = [];
  parts.push("Design a Close CRM sequence (workflow) for this purpose:\n");
  parts.push(userPrompt.trim());

  if (options.audience)
    parts.push(`\nAudience / lead type: ${options.audience}`);
  if (options.tone) parts.push(`Overall tone: ${options.tone}`);
  if (options.totalDays) {
    parts.push(
      `Total sequence duration: approximately ${options.totalDays} days`,
    );
  }
  if (options.touchCount) {
    parts.push(`Aim for approximately ${options.touchCount} touches total`);
  }

  const channels = options.channels ?? ["email", "sms"];
  parts.push(`Allowed channels: ${channels.join(", ")}`);

  // FIXED operating window — all workflows run in the same team time window.
  parts.push(
    "Operating window (FIXED, do not suggest otherwise): Monday–Saturday 8:00 AM – 8:00 PM America/New_York. Sundays are off. When copy references timing, stay within those hours and avoid Sunday mentions.",
  );
  parts.push('timezone field in your JSON output must be "America/New_York"');

  if (options.threading) {
    parts.push(
      `Preferred email threading: ${options.threading} (apply to email steps)`,
    );
  }
  if (options.runMode) {
    const runModeHint =
      options.runMode === "once"
        ? 'Run mode: ONCE per lead. Copy should assume the recipient will only ever go through this sequence one time — no references to "last time you heard from us" or "as we mentioned before" implying a previous run.'
        : "Run mode: MULTIPLE enrollments allowed. The same lead may go through this sequence more than once, so avoid language that would feel weird on a second pass (e.g. don't say 'welcome, new lead!').";
    parts.push(runModeHint);
  }
  // SMS opt-out footer instruction. The client deterministically enforces
  // this on save (enforceStopFooter()), but aligning the AI's first output
  // saves a regeneration round-trip when the user has the toggle off.
  if (options.includeStop === false) {
    parts.push(
      "SMS opt-out: DO NOT include any opt-out footer in SMS steps (no 'Reply STOP', 'Text STOP', 'unsubscribe', etc.). The user has explicitly opted out of compliance footers for this workflow.",
    );
  } else {
    parts.push(
      'SMS opt-out: every SMS step body must end with "Reply STOP to opt out" for TCPA compliance.',
    );
  }
  if (options.constraints) {
    parts.push(
      `\nAdditional constraints from the agent:\n${options.constraints}`,
    );
  }

  parts.push(
    '\nReturn ONLY the JSON object with name, timezone ("America/New_York"), rationale, and steps[].',
  );
  return parts.join("\n");
}

function validateSequence(parsed: unknown): GeneratedSequence {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI response was not a JSON object");
  }
  const obj = parsed as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  const timezone = typeof obj.timezone === "string" ? obj.timezone.trim() : "";
  const rationale =
    typeof obj.rationale === "string" ? obj.rationale : undefined;
  const stepsRaw = Array.isArray(obj.steps) ? obj.steps : null;

  if (!name) throw new Error("AI response missing 'name' field");
  if (!timezone) throw new Error("AI response missing 'timezone' field");
  if (!stepsRaw || stepsRaw.length === 0) {
    throw new Error("AI response missing 'steps' array or it is empty");
  }
  if (stepsRaw.length > 30) {
    throw new Error(`Sequence has ${stepsRaw.length} steps (max 30)`);
  }

  const steps: GeneratedSequenceStep[] = [];
  for (let i = 0; i < stepsRaw.length; i++) {
    const raw = stepsRaw[i];
    if (!raw || typeof raw !== "object") {
      throw new Error(`Step ${i} is not an object`);
    }
    const s = raw as Record<string, unknown>;
    const stepType = s.step_type;
    const day = typeof s.day === "number" ? s.day : NaN;

    if (stepType !== "email" && stepType !== "sms") {
      throw new Error(
        `Step ${i} has invalid step_type: ${JSON.stringify(stepType)}`,
      );
    }
    if (!Number.isFinite(day) || day < 1 || day > 365) {
      throw new Error(`Step ${i} has invalid day: ${day}`);
    }

    if (stepType === "email") {
      const ge = s.generated_email as Record<string, unknown> | undefined;
      if (!ge) {
        throw new Error(`Step ${i} is email but missing generated_email`);
      }
      const tname = typeof ge.name === "string" ? ge.name.trim() : "";
      const tsubject = typeof ge.subject === "string" ? ge.subject.trim() : "";
      const tbody = typeof ge.body === "string" ? ge.body : "";
      if (!tname || !tsubject || !tbody) {
        throw new Error(`Step ${i} email is missing name, subject, or body`);
      }
      const threading =
        s.threading === "old_thread" ? "old_thread" : "new_thread";
      steps.push({
        step_type: "email",
        day,
        generated_email: { name: tname, subject: tsubject, body: tbody },
        threading,
      });
    } else {
      const gs = s.generated_sms as Record<string, unknown> | undefined;
      if (!gs) {
        throw new Error(`Step ${i} is sms but missing generated_sms`);
      }
      const tname = typeof gs.name === "string" ? gs.name.trim() : "";
      const ttext = typeof gs.text === "string" ? gs.text.trim() : "";
      if (!tname || !ttext) {
        throw new Error(`Step ${i} sms is missing name or text`);
      }
      if (ttext.length > 480) {
        throw new Error(`Step ${i} sms exceeds 480 chars (${ttext.length})`);
      }
      steps.push({
        step_type: "sms",
        day,
        generated_sms: { name: tname, text: ttext },
      });
    }
  }

  // Ensure steps are sorted by ascending day
  steps.sort((a, b) => a.day - b.day);

  return { name, timezone, rationale, steps };
}

export async function generateSequence(
  userPrompt: string,
  options: SequencePromptOptions = {},
): Promise<SequenceGenerationResult> {
  const client = getAnthropicClient();
  const userMessage = buildUserMessage(userPrompt, options);

  const response = await client.messages.create({
    model: MODEL_SMART,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = extractText(response);
  const parsed = parseJsonFromText(text);
  const sequence = validateSequence(parsed);

  return {
    sequence,
    model: MODEL_SMART,
    input_tokens: response.usage?.input_tokens ?? 0,
    output_tokens: response.usage?.output_tokens ?? 0,
  };
}

// Note: the backend save flow (handleSaveSequence in index.ts) converts these
// 1-indexed Day numbers into Close's native `delay` format, which is seconds
// SINCE THE PREVIOUS STEP (not absolute from sequence start). The AI keeps
// emitting absolute Day numbers because that's the natural mental model for
// designing a multi-touch cadence — we convert at save time, not here.
