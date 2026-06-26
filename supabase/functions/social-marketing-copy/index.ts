// social-marketing-copy — AI drafts the copy for ONE marketing carousel slide in Social
// Studio (quote / tip / recruiting CTA / custom). The drafted fields only SEED the editor;
// the user keeps editing them. Flow mirrors generate-social-caption one-for-one:
//   1. authenticate (real 401),
//   2. AI-access gate via resolveAiAccessFacts (super-admin / IMO grants-all /
//      ai_assistant add-on) — fail closed (403); same gate as useAiAccess,
//   3. shared AI rate-limit,
//   4. ask the fast model for the variant's copy as strict JSON,
//   5. record token spend, deterministically clean + length-cap, return { copy }.
//
// CONTRACT differs from the caption fn: the request is keyed on `variant`
// (quote|tip|cta|custom), NOT `view`. Output JSON shape is per-variant:
//   quote          → { text, attribution }   (attribution ALWAYS forced empty — see below)
//   tip|cta|custom → { headline, body }
//
// HONESTY: like the caption fn, the model must NEVER invent facts. For quotes it must write
// an ORIGINAL line and must NOT attribute it to any real/famous person (a misattributed
// quote on an agency's feed is a reputational problem) — attribution is left for the user.

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
  MODEL_SMART,
  parseJsonFromText,
} from "../close-ai-builder/ai/anthropic-client.ts";
import { capWords, clean, COPY_CAPS as CAPS } from "../_shared/social-copy.ts";

const FN_NAME = "social-marketing-copy";
const MAX_TOKENS = 512;

type Variant = "quote" | "tip" | "cta" | "custom";

function buildSystemPrompt(allowRealAttribution: boolean): string {
  return `You are a social-media copywriter for an insurance sales agency. You write the copy for ONE slide of an Instagram carousel. The slide is one of four types and you write ONLY for the type requested.

OUTPUT: respond with ONLY a single JSON object, no prose and no markdown fences.

SLIDE TYPES and the EXACT keys to return:
- "quote": ${
    allowRealAttribution
      ? `a motivational one-liner about sales, service, persistence, or protecting families. Return { "text": "the line", "attribution": "" }. ONLY if you are genuinely confident of a real, well-known quote AND its correct author, you MAY instead use that real quote and put the author's real name in "attribution". If you are not certain of BOTH the exact wording and the author, write an ORIGINAL line and leave "attribution" as "" — never guess or fabricate a source.`
      : `an ORIGINAL, punchy, motivational one-liner about sales, service, persistence, or protecting families. Return { "text": "the line", "attribution": "" }. The attribution MUST be an empty string — do NOT attribute the line to any real or famous person; never write a known person's name.`
  }
- "tip": a practical sales/service tip an insurance agent can act on. Return { "headline": "short hook", "body": "1–2 sentence tip" }.
- "cta": a warm recruiting message inviting people to join the agency's team. Return { "headline": "short hook", "body": "1–2 inviting sentences" }. Do NOT include "DM us to apply" in the body — the card already shows that chip.
- "custom": a general headline + supporting body for a slide that sits over the user's own photo. Return { "headline": "short hook", "body": "1–2 sentences" }.

RULES:
- Plain text only: no markdown, no surrounding quotation marks, no emojis, no hashtags.
- Keep it tight: headline a few words; body one or two short sentences; quote one sentence.
- Use the agency name / network only if it reads naturally; do not force it in.
- NEVER invent dollar amounts, counts, rankings, awards, or named people. If unsure, stay general.`;
}

function buildUserMessage(req: Record<string, unknown>): string {
  const variant = req.variant as Variant;
  const kind =
    variant === "quote"
      ? "a motivational quote slide"
      : variant === "tip"
        ? "a sales/service tip slide"
        : variant === "cta"
          ? "a recruiting (we're hiring) slide"
          : "a general marketing slide that sits over the user's own photo";
  const parts = [`Write the copy for ${kind}.`];
  if (typeof req.agencyName === "string" && req.agencyName.trim())
    parts.push(`Agency: ${req.agencyName.trim()}.`);
  if (typeof req.network === "string" && req.network.trim())
    parts.push(`Network: ${req.network.trim()}.`);
  if (typeof req.topic === "string" && req.topic.trim())
    parts.push(`Focus the copy on: ${req.topic.trim()}.`);
  parts.push(
    variant === "quote"
      ? `Return exactly { "text": "...", "attribution": "" } (fill "attribution" only with a real author you are certain of, per the rules).`
      : `Return exactly { "headline": "...", "body": "..." }.`,
  );
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
  let body: Record<string, unknown>;
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }
  const variant = body.variant;
  if (
    variant !== "quote" &&
    variant !== "tip" &&
    variant !== "cta" &&
    variant !== "custom"
  ) {
    return json({ error: "variant must be quote, tip, cta, or custom." }, 400);
  }
  // Opt-in: keep a real-person attribution on quotes (default off → forced empty).
  const allowRealAttribution = body.allowRealAttribution === true;

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
      { error: "AI drafting isn't available for this account." },
      403,
    );
  }

  // ── 4. AI rate limit (shared) ────────────────────────────────────────────────
  const limited = await enforceAiRateLimits(admin, FN_NAME, userId, cors);
  if (limited) return limited;

  // ── 5. Generate ──────────────────────────────────────────────────────────────
  let text: string;
  let totalTokens = 0;
  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      // Attributed quotes need the stronger model — Haiku misattributes or bails to an
      // empty attribution far more often, which would silently defeat the feature.
      model:
        allowRealAttribution && variant === "quote" ? MODEL_SMART : MODEL_FAST,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(allowRealAttribution),
      messages: [{ role: "user", content: buildUserMessage(body) }],
    });
    totalTokens =
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0);
    text = extractText(response);
  } catch (err) {
    console.error(`[${FN_NAME}] Anthropic call failed:`, err);
    return json({ error: "AI generation failed. Please try again." }, 502);
  }

  // ── 6. Record token spend (best-effort) ──────────────────────────────────────
  await recordAiTokens(admin, userId, totalTokens);

  // ── 7. Parse + deterministically clean/cap into the variant's fields ─────────
  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonFromText(text) as Record<string, unknown>;
  } catch {
    console.error(`[${FN_NAME}] could not parse AI JSON`);
    return json({ error: "AI returned an unexpected format. Try again." }, 502);
  }

  let copy: Record<string, string>;
  if (variant === "quote") {
    const t = capWords(clean(parsed.text), CAPS.text);
    if (!t)
      return json({ error: "AI returned an empty draft. Try again." }, 502);
    // attribution kept (capped) only when the caller opted into real attributed quotes;
    // otherwise forced empty so the model can never fabricate a source (review #14 default).
    copy = {
      text: t,
      attribution: allowRealAttribution
        ? capWords(clean(parsed.attribution), CAPS.attribution)
        : "",
    };
  } else {
    const headline = capWords(clean(parsed.headline), CAPS.headline);
    const bodyText = capWords(clean(parsed.body), CAPS.body);
    // BOTH fields are required for these variants. Returning a draft with an empty headline
    // would blank the user's existing headline via onPatch (review #4) — so treat a missing
    // headline OR body as a generation failure, not just both-empty.
    if (!headline || !bodyText)
      return json({ error: "AI returned an empty draft. Try again." }, 502);
    copy = { headline, body: bodyText };
  }

  return json({ copy, tokensUsed: totalTokens }, 200);
});
