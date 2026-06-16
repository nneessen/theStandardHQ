// generate-workflow-email-template — AI generation of a reusable workflow email
// template from a plain-English prompt.
//
// POST { prompt, options?, name? } with a user JWT. Flow mirrors the other AI edge
// functions (generate-call-script):
//   1. authenticate (real 401),
//   2. AI-access gate via resolveAiAccessFacts — super-admin, an IMO that grants all
//      features (Epic Life), or the ai_assistant add-on. Fail closed (403). This is
//      the same gate the client's useAiAccess hook enforces.
//   3. shared AI rate-limit (30 req/hr + 200k tok/day),
//   4. ask the fast model for ONE email as strict JSON { name, subject, body_html, body_text },
//   5. record token spend, validate, then PERSIST to email_templates so the existing
//      workflow send path (which loads a template by id) can use it unchanged.
//
// The model is told to personalize ONLY with the workflow renderer's {{snake_case}}
// variables; process-workflow's replaceTemplateVariables substitutes/sanitizes them
// at send time (and HTML-escapes injected values), so unfilled tags render blank
// rather than leaking raw text.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from "../_shared/supabase-client.ts";
import { resolveAiAccessFacts } from "../_shared/resolve-ai-access.ts";
import { enforceAiRateLimits, recordAiTokens } from "../_shared/rate-limit.ts";
import {
  extractText,
  getAnthropicClient,
  MODEL_FAST,
  parseJsonFromText,
} from "../close-ai-builder/ai/anthropic-client.ts";

const FN_NAME = "generate-workflow-email-template";
const MAX_TOKENS = 2048;

// The subset of the workflow renderer's TEMPLATE_VARIABLE_KEYS most useful in an
// email. The model is restricted to these so it never invents an unsupported tag.
const ALLOWED_VARIABLES = [
  "recruit_first_name",
  "recruit_name",
  "recruit_email",
  "recruit_phone",
  "recruit_state",
  "user_first_name",
  "user_name",
  "user_email",
  "upline_first_name",
  "upline_name",
  "company_name",
  "agency_name",
  "imo_name",
];

const SYSTEM_PROMPT = `You are an expert email copywriter for an insurance agency's automation platform. \
Given a short description of an automated email a manager wants to send (e.g. a welcome note to a new recruit, \
a license-renewal reminder, a congratulations on going licensed), you write ONE clean, professional, ready-to-send email.

OUTPUT: respond with ONLY a single JSON object, no prose and no markdown fences:
{
  "name": "short internal name for this template (<= 60 chars)",
  "subject": "the email subject line",
  "body_html": "the full email body as simple, email-client-safe HTML",
  "body_text": "the same email as plain text"
}

PERSONALIZATION — IMPORTANT:
- Use ONLY these mustache variables, exactly as written, where personalization helps: ${ALLOWED_VARIABLES.map((v) => "{{" + v + "}}").join(", ")}.
- NEVER invent other variables and NEVER use literal placeholders like "[Name]" or "Dear Customer". If unsure, prefer {{recruit_first_name}} for the addressee.
- It is fine to use no variables if the email does not need them.

HTML RULES:
- body_html must be a self-contained fragment of simple HTML: <p>, <br>, <strong>, <em>, <ul>/<li>, <a href>. Short paragraphs.
- NO <script>, NO <style> blocks, NO external stylesheets, NO <html>/<head>/<body> wrapper, NO tracking pixels.
- body_text must read naturally as plain text (no HTML tags).

TONE: professional, warm, concise. Insurance/financial-services appropriate. Avoid spammy phrasing and ALL CAPS.`;

function buildUserMessage(
  prompt: string,
  options: Record<string, unknown> | undefined,
): string {
  const parts = [`Write the email for: ${prompt.trim()}`];
  const tone = options?.tone;
  const length = options?.length;
  const audience = options?.audience;
  if (typeof tone === "string" && tone.trim())
    parts.push(`Tone: ${tone.trim()}.`);
  if (typeof length === "string" && length.trim())
    parts.push(`Length: ${length.trim()}.`);
  if (typeof audience === "string" && audience.trim())
    parts.push(`Audience: ${audience.trim()}.`);
  return parts.join(" ");
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

  // ── 1. Body ────────────────────────────────────────────────────────────────
  let prompt = "";
  let options: Record<string, unknown> | undefined;
  let nameOverride: string | undefined;
  try {
    const body = (await req.json()) as {
      prompt?: unknown;
      options?: unknown;
      name?: unknown;
    };
    if (typeof body?.prompt === "string") prompt = body.prompt;
    if (body?.options && typeof body.options === "object")
      options = body.options as Record<string, unknown>;
    if (typeof body?.name === "string" && body.name.trim())
      nameOverride = body.name.trim();
  } catch {
    return json({ error: "Expected a JSON body with a prompt." }, 400);
  }
  if (!prompt.trim()) return json({ error: "prompt is required." }, 400);
  if (prompt.length > 2000) {
    return json({ error: "prompt is too long (max 2000 chars)." }, 400);
  }

  // ── 2. Authenticate ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
  const db = createSupabaseClient(authHeader);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;
  const admin = createSupabaseAdminClient();

  // ── 3. AI-access gate (same logic as useAiAccess; fail closed) ───────────────
  const aiFacts = await resolveAiAccessFacts(admin, userId);
  if (
    !aiFacts.isSuperAdmin &&
    !aiFacts.imoGrantsAllFeatures &&
    !aiFacts.hasAiAddon
  ) {
    return json(
      { error: "AI template generation isn't available for this account." },
      403,
    );
  }

  // ── 4. AI rate limit (shared 30/hr requests + 200k tok/day) ──────────────────
  const limited = await enforceAiRateLimits(admin, FN_NAME, userId, cors);
  if (limited) return limited;

  // ── 5. Generate ──────────────────────────────────────────────────────────────
  let text: string;
  let totalTokens = 0;
  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: MODEL_FAST,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(prompt, options) }],
    });
    totalTokens =
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0);
    text = extractText(response);
  } catch (err) {
    console.error(`[${FN_NAME}] Anthropic call failed:`, err);
    return json({ error: "AI generation failed. Please try again." }, 502);
  }

  // ── 6. Record token spend (best-effort; never blocks the result) ─────────────
  await recordAiTokens(admin, userId, totalTokens);

  // ── 7. Validate the model output ─────────────────────────────────────────────
  let parsed: {
    name?: unknown;
    subject?: unknown;
    body_html?: unknown;
    body_text?: unknown;
  };
  try {
    parsed = parseJsonFromText(text) as typeof parsed;
  } catch {
    console.error(`[${FN_NAME}] could not parse AI JSON`);
    return json({ error: "AI returned an unexpected format. Try again." }, 502);
  }
  const subject =
    typeof parsed.subject === "string" ? parsed.subject.trim() : "";
  const bodyHtml =
    typeof parsed.body_html === "string" ? parsed.body_html.trim() : "";
  const bodyText =
    typeof parsed.body_text === "string" ? parsed.body_text.trim() : "";
  if (!subject || !bodyHtml) {
    return json(
      { error: "AI returned an incomplete template. Try a clearer prompt." },
      502,
    );
  }
  const name =
    nameOverride ||
    (typeof parsed.name === "string" && parsed.name.trim()
      ? parsed.name.trim().slice(0, 80)
      : `AI: ${prompt.trim().slice(0, 50)}`);

  // ── 8. Persist to email_templates (the workflow send path loads by id) ───────
  const { data: template, error: insertErr } = await admin
    .from("email_templates")
    .insert({
      name,
      subject,
      body_html: bodyHtml,
      body_text: bodyText || null,
      category: "automation",
      is_global: false,
      created_by: userId,
      variables: [],
    })
    .select("id, name, subject, body_html, body_text, category, created_by")
    .single();

  if (insertErr || !template) {
    console.error(
      `[${FN_NAME}] failed to persist template:`,
      insertErr?.message,
    );
    return json({ error: "Could not save the generated template." }, 500);
  }

  return json({ template, tokensUsed: totalTokens }, 200);
});
