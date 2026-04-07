// Email template generator — prompt construction + response validation.
//
// Returns strict JSON { name, subject, body } ready to POST to Close.
// Uses Close mustache variables: {{ contact.first_name }}, {{ lead.display_name }}, etc.

import {
  extractText,
  getAnthropicClient,
  MODEL_FAST,
  parseJsonFromText,
} from "./anthropic-client.ts";

export interface EmailPromptOptions {
  /** Tone hint, e.g. "professional" | "casual" | "urgent" | "empathetic" */
  tone?: string;
  /** Target length, e.g. "short" (<100 words), "medium" (100-200), "long" (200+) */
  length?: "short" | "medium" | "long";
  /** Audience / lead type context, e.g. "new IUL quote request" */
  audience?: string;
  /** Optional extra constraints from the user ("must include a PS line") */
  constraints?: string;
}

export interface GeneratedEmailTemplate {
  name: string;
  subject: string;
  body: string;
}

export interface EmailGenerationResult {
  template: GeneratedEmailTemplate;
  model: string;
  input_tokens: number;
  output_tokens: number;
}

const SYSTEM_PROMPT = `You are an expert copywriter who writes Close CRM email templates for insurance agents.

Your job: take the user's prompt and produce a single Close email template ready to save via the API.

STRICT OUTPUT FORMAT — return ONLY valid JSON matching this shape, nothing else:
{
  "name": "short, descriptive template name (max 60 chars) — scannable in a long list",
  "subject": "email subject line — personalized using Close variables when natural",
  "body": "full email body — can be multi-line, use \\n for newlines, must feel human"
}

CLOSE MUSTACHE VARIABLES you may use (use them naturally, don't over-stuff):
- {{ contact.first_name }}      — lead's first name
- {{ contact.last_name }}       — lead's last name
- {{ contact.email }}            — lead's email
- {{ contact.phones.0.phone }}   — lead's primary phone
- {{ lead.display_name }}        — household/lead name
- {{ lead.url }}                 — link to the lead in Close
- {{ user.first_name }}          — sending agent's first name
- {{ user.email }}               — sending agent's email

RULES:
1. Output ONLY the JSON object. No prose before or after. No markdown fences.
2. The "name" field is for an agent scanning a template library — make it descriptive, not clever. Example good: "Day 1 Intro - New IUL Quote Request". Example bad: "Getting to know you".
3. The subject must be short (under 60 chars) and feel like a real person wrote it. Avoid salesy phrases like "Don't miss out!" or "Limited time!".
4. The body must be human and direct. Insurance agents get ignored when emails sound templated. Write like a sharp salesperson sending a personal note.
5. Always include at least one Close variable in either subject or body so it feels personalized.
6. Keep subject + body compliant with email best practices — no ALL CAPS, no excessive punctuation.
7. Never invent facts about the lead's situation beyond what the user's prompt states.`;

function buildUserMessage(
  userPrompt: string,
  options: EmailPromptOptions,
): string {
  const parts: string[] = [];
  parts.push("Write me a Close CRM email template for this purpose:\n");
  parts.push(userPrompt.trim());

  if (options.audience) {
    parts.push(`\nAudience: ${options.audience}`);
  }
  if (options.tone) {
    parts.push(`Tone: ${options.tone}`);
  }
  if (options.length) {
    const lengthHint = {
      short: "Keep it under 100 words — short and scannable.",
      medium: "Aim for 100-200 words.",
      long: "A longer email is fine (200-400 words) if the purpose warrants it.",
    }[options.length];
    parts.push(lengthHint);
  }
  if (options.constraints) {
    parts.push(
      `\nAdditional constraints from the agent:\n${options.constraints}`,
    );
  }

  parts.push(
    '\nReturn ONLY the JSON object { "name", "subject", "body" }. No other text.',
  );
  return parts.join("\n");
}

function validateEmailTemplate(parsed: unknown): GeneratedEmailTemplate {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI response was not a JSON object");
  }
  const obj = parsed as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  const subject = typeof obj.subject === "string" ? obj.subject.trim() : "";
  const body = typeof obj.body === "string" ? obj.body : "";

  if (!name) throw new Error("AI response missing 'name' field");
  if (!subject) throw new Error("AI response missing 'subject' field");
  if (!body) throw new Error("AI response missing 'body' field");
  if (name.length > 120) {
    throw new Error(`AI produced a name over 120 chars: ${name.length}`);
  }
  if (subject.length > 200) {
    throw new Error(`AI produced a subject over 200 chars: ${subject.length}`);
  }
  return { name, subject, body };
}

export async function generateEmailTemplate(
  userPrompt: string,
  options: EmailPromptOptions = {},
): Promise<EmailGenerationResult> {
  const client = getAnthropicClient();
  const userMessage = buildUserMessage(userPrompt, options);

  const response = await client.messages.create({
    model: MODEL_FAST,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = extractText(response);
  const parsed = parseJsonFromText(text);
  const template = validateEmailTemplate(parsed);

  return {
    template,
    model: MODEL_FAST,
    input_tokens: response.usage?.input_tokens ?? 0,
    output_tokens: response.usage?.output_tokens ?? 0,
  };
}
