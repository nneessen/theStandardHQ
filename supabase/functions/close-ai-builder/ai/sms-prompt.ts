// SMS template generator. Returns { name, text }.
// Close SMS templates support the same mustache variables as emails.

import {
  extractText,
  getAnthropicClient,
  MODEL_FAST,
  parseJsonFromText,
} from "./anthropic-client.ts";

export interface SmsPromptOptions {
  tone?: string;
  audience?: string;
  /** Character budget. Default 320 (2 SMS segments). */
  maxChars?: number;
  /** Require "Reply STOP" footer for TCPA compliance. Default true. */
  includeStop?: boolean;
  constraints?: string;
}

export interface GeneratedSmsTemplate {
  name: string;
  text: string;
}

export interface SmsGenerationResult {
  template: GeneratedSmsTemplate;
  model: string;
  input_tokens: number;
  output_tokens: number;
}

const SYSTEM_PROMPT = `You are an expert copywriter who writes Close CRM SMS templates for insurance agents.

Your job: take the user's prompt and produce a single Close SMS template ready to save via the API.

STRICT OUTPUT FORMAT — return ONLY valid JSON matching this shape, nothing else:
{
  "name": "short, descriptive template name (max 60 chars) — scannable in a long list",
  "text": "SMS message body — concise, personal, TCPA-compliant"
}

CLOSE MUSTACHE VARIABLES you may use:
- {{ contact.first_name }}
- {{ contact.last_name }}
- {{ lead.display_name }}
- {{ user.first_name }}

RULES:
1. Output ONLY the JSON object. No prose, no markdown fences.
2. SMS must feel like a real text — conversational, lowercase where natural, no email formality.
3. Keep it SHORT. 160 chars is one segment, 320 chars is two. Never exceed the char budget stated in the user prompt.
4. NEVER use ALL CAPS or excessive exclamation marks.
5. Always include a way to opt out ("Reply STOP to opt out" or similar) if the user asks for compliance.
6. Use {{ contact.first_name }} naturally — do not force it if the message doesn't need a name.
7. No emojis unless the user explicitly asks for them.
8. Never invent facts about the lead.`;

function buildUserMessage(
  userPrompt: string,
  options: SmsPromptOptions,
): string {
  const parts: string[] = [];
  parts.push("Write me a Close CRM SMS template for this purpose:\n");
  parts.push(userPrompt.trim());

  if (options.audience) parts.push(`\nAudience: ${options.audience}`);
  if (options.tone) parts.push(`Tone: ${options.tone}`);

  const maxChars = options.maxChars ?? 320;
  parts.push(`Maximum character budget: ${maxChars} characters.`);

  if (options.includeStop !== false) {
    parts.push('Include a "Reply STOP to opt out" footer for TCPA compliance.');
  }

  if (options.constraints) {
    parts.push(`\nAdditional constraints:\n${options.constraints}`);
  }

  parts.push('\nReturn ONLY the JSON object { "name", "text" }.');
  return parts.join("\n");
}

function validateSmsTemplate(
  parsed: unknown,
  maxChars: number,
): GeneratedSmsTemplate {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI response was not a JSON object");
  }
  const obj = parsed as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  const text = typeof obj.text === "string" ? obj.text.trim() : "";

  if (!name) throw new Error("AI response missing 'name' field");
  if (!text) throw new Error("AI response missing 'text' field");
  if (name.length > 120) {
    throw new Error(`AI produced a name over 120 chars: ${name.length}`);
  }
  if (text.length > Math.max(maxChars, 480)) {
    // Allow some slack over requested max to avoid false rejects, but cap hard.
    throw new Error(
      `AI produced an SMS over ${maxChars} chars (got ${text.length})`,
    );
  }
  return { name, text };
}

export async function generateSmsTemplate(
  userPrompt: string,
  options: SmsPromptOptions = {},
): Promise<SmsGenerationResult> {
  const client = getAnthropicClient();
  const userMessage = buildUserMessage(userPrompt, options);
  const maxChars = options.maxChars ?? 320;

  const response = await client.messages.create({
    model: MODEL_FAST,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = extractText(response);
  const parsed = parseJsonFromText(text);
  const template = validateSmsTemplate(parsed, maxChars);

  return {
    template,
    model: MODEL_FAST,
    input_tokens: response.usage?.input_tokens ?? 0,
    output_tokens: response.usage?.output_tokens ?? 0,
  };
}
