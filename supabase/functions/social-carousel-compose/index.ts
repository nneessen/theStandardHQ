// social-carousel-compose — AI assembles a WHOLE Instagram carousel for Social Studio from
// ONE idea, OR writes a deck-aware caption for an already-built deck. The sibling
// social-marketing-copy drafts ONE slide; this one drafts the whole set in a single call.
//
// Two modes on one function (shared auth / AI-gate / rate-limit / Anthropic infra):
//   • mode:"compose" — { idea, slideCount, agencyName, network?, allowRealAttribution?,
//       allowDataSlides?, availableViews? } → { slides:[…], caption, tokensUsed }
//       The AI returns an ORDERED deck spec (the SAME shape socialDeckService persists):
//         { t:"marketing", variant, …copy }  — copy written by the AI
//         { t:"data", view }                 — the AI only PICKS the view; the app fills
//                                              the real numbers (AI never invents metrics).
//   • mode:"caption" — { agencyName, network?, slides:[descriptors] } → { caption, tokensUsed }
//
// HONESTY (mirrors social-marketing-copy + generate-social-caption): the model must NEVER
// invent dollar amounts, counts, rankings, or awards. For quotes, attribution behaviour is
// gated by `allowRealAttribution`:
//   • false/absent → attribution is FORCED empty (the safe default — no fabricated source).
//   • true         → the model must use a GENUINE, well-known quote + the CORRECT real person,
//                    and the server keeps the (capped) attribution. The UI shows a
//                    "verify the name before posting" reminder because LLMs do occasionally
//                    misattribute famous lines.

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
import {
  capWords,
  CAPTION_CAP,
  clean,
  cleanCaption,
  COPY_CAPS as CAPS,
} from "../_shared/social-copy.ts";

const FN_NAME = "social-carousel-compose";
// Headroom for a full 10-slide deck + a ~2,200-char caption in one JSON blob — the model
// doesn't know the per-field caps are enforced server-side, so a verbose max-size response
// must not truncate mid-JSON (parseJsonFromText would throw → 502).
const COMPOSE_MAX_TOKENS = 4096;
const CAPTION_MAX_TOKENS = 1024;

const IG_MIN_SLIDES = 2;
const IG_MAX_SLIDES = 10;

const VARIANTS = ["quote", "tip", "cta", "custom"] as const;
const VIEWS = ["daily", "weekly", "monthly", "aotw"] as const;
type Variant = (typeof VARIANTS)[number];
type View = (typeof VIEWS)[number];

type ComposedSlide =
  | { t: "data"; view: View }
  | {
      t: "marketing";
      variant: Variant;
      text?: string;
      attribution?: string;
      headline?: string;
      body?: string;
    };

function isView(v: unknown): v is View {
  return typeof v === "string" && (VIEWS as readonly string[]).includes(v);
}
function isVariant(v: unknown): v is Variant {
  return typeof v === "string" && (VARIANTS as readonly string[]).includes(v);
}

// ── Compose-mode system prompt ───────────────────────────────────────────────
function composeSystemPrompt(allowRealAttribution: boolean): string {
  return `You are a social-media creative director for an insurance sales agency. You design ONE complete Instagram carousel (an ordered set of slides) plus the post caption.

OUTPUT: respond with ONLY a single JSON object, no prose and no markdown fences:
{ "slides": [ … ], "caption": "…" }

Each slide is EXACTLY one of these shapes — use the EXACT keys shown:
- { "t": "marketing", "variant": "quote", "text": "an inspiring one-liner", "attribution": "" }
- { "t": "marketing", "variant": "tip", "headline": "short hook", "body": "1–2 sentence practical sales/service tip" }
- { "t": "marketing", "variant": "cta", "headline": "short hook", "body": "1–2 warm sentences inviting people to join the team" }
- { "t": "marketing", "variant": "custom", "headline": "short hook", "body": "1–2 sentences over the user's own photo" }
- { "t": "data", "view": "daily" | "weekly" | "monthly" | "aotw" }

QUOTE ATTRIBUTION:
${
  allowRealAttribution
    ? `- For a "quote" slide, use a GENUINE, well-known motivational quote and attribute it to the CORRECT real person in "attribution". Do not fabricate a quote or guess a name — if you are not confident of the exact wording and author, write an ORIGINAL line instead and set "attribution" to "".`
    : `- For a "quote" slide, write an ORIGINAL line and set "attribution" to "". NEVER attribute the line to a real or famous person.`
}

DATA SLIDES:
- A "data" slide is auto-filled by the app from the agency's REAL live metrics (leaderboard / agent-of-the-week). You ONLY choose the view — NEVER write any numbers, names, rankings, or dollar amounts yourself.

RULES:
- Build a coherent narrative arc across the slides (hook → value → close/CTA).
- Plain text only: no markdown, no surrounding quotation marks, no emojis in slide copy, no hashtags in slide copy.
- Keep copy tight: headline a few words; body one or two short sentences; quote one sentence.
- The caption ties the whole carousel together; it MAY use a few tasteful hashtags on their own line at the end. Keep it under ${CAPTION_CAP} characters.
- NEVER invent dollar amounts, counts, rankings, awards, or named people (outside a real attributed quote).`;
}

function composeUserMessage(
  req: Record<string, unknown>,
  slideCount: number,
): string {
  const agencyName =
    typeof req.agencyName === "string" && req.agencyName.trim()
      ? req.agencyName.trim()
      : "the agency";
  const parts = [
    `Design a ${slideCount}-slide Instagram carousel for ${agencyName}.`,
  ];
  if (typeof req.network === "string" && req.network.trim())
    parts.push(`Network: ${req.network.trim()}.`);
  if (typeof req.idea === "string" && req.idea.trim())
    parts.push(`Theme / idea for the carousel: ${req.idea.trim()}.`);

  const allowData = req.allowDataSlides !== false;
  const availableViews = Array.isArray(req.availableViews)
    ? (req.availableViews.filter(isView) as View[])
    : [];
  if (allowData && availableViews.length) {
    parts.push(
      `You MAY include one or two "data" slides, chosen ONLY from these views (they have live data): ${availableViews.join(", ")}. The app fills their numbers — you only pick the view.`,
    );
  } else {
    parts.push(`Use ONLY marketing slides — do NOT include any "data" slides.`);
  }
  parts.push(
    `Return EXACTLY ${slideCount} slides in "slides", in the order they should appear, plus a "caption".`,
  );
  return parts.join(" ");
}

// ── Caption-mode system prompt ───────────────────────────────────────────────
const CAPTION_SYSTEM_PROMPT = `You write ONE Instagram caption for a carousel post by an insurance sales agency. You are given a short description of the slides in order. Write a caption that ties the whole carousel together and invites engagement.

OUTPUT: respond with ONLY the caption text — no JSON, no markdown fences, no surrounding quotes.

RULES:
- Lead with a hook that fits the slides; keep it warm and professional.
- A few tasteful hashtags are allowed on their OWN line at the very end.
- NEVER invent dollar amounts, counts, rankings, awards, or named people — describe the theme, not specific numbers.
- Keep it under ${CAPTION_CAP} characters.`;

function captionUserMessage(req: Record<string, unknown>): string {
  const agencyName =
    typeof req.agencyName === "string" && req.agencyName.trim()
      ? req.agencyName.trim()
      : "the agency";
  const slides = Array.isArray(req.slides) ? req.slides : [];
  const lines = slides.map((raw, i) => {
    const s = (raw ?? {}) as Record<string, unknown>;
    const view = isView(s.view) ? s.view : undefined;
    if (view) return `${i + 1}. data slide (${view} metrics)`;
    const variant = isVariant(s.variant) ? s.variant : "marketing";
    const copy =
      clean(s.headline) || clean(s.text) || clean(s.body) || "(no copy)";
    return `${i + 1}. ${variant}: ${capWords(copy, 80)}`;
  });
  const parts = [`Carousel for ${agencyName}.`];
  if (typeof req.network === "string" && req.network.trim())
    parts.push(`Network: ${req.network.trim()}.`);
  parts.push(`Slides in order:\n${lines.join("\n")}`);
  parts.push(`Write the caption.`);
  return parts.join("\n");
}

// ── Normalize one AI slide into a safe ComposedSlide, or null to drop it ──────
function normalizeSlide(
  raw: unknown,
  allowDataSlides: boolean,
  allowRealAttribution: boolean,
): ComposedSlide | null {
  const s = (raw ?? {}) as Record<string, unknown>;
  const hasVariant = isVariant(s.variant);

  // Data slide — AI only picked a view; the app fills the numbers. Treat as data when it's
  // explicitly t:"data", OR it's not a marketing slide yet carries a real view (covers the AI
  // emitting variant:null/omitted). A malformed t:"marketing" with a stray view is NOT data —
  // it falls through to the variant check below and is dropped, not silently reclassified.
  const isData =
    s.t === "data" || (s.t !== "marketing" && !hasVariant && isView(s.view));
  if (isData) {
    if (!allowDataSlides) return null;
    return isView(s.view) ? { t: "data", view: s.view } : null;
  }

  if (!isVariant(s.variant)) return null;
  const variant = s.variant;

  if (variant === "quote") {
    const text = capWords(clean(s.text), CAPS.text);
    if (!text) return null; // a quote with no line is useless
    const attribution = allowRealAttribution
      ? capWords(clean(s.attribution), CAPS.attribution)
      : "";
    return { t: "marketing", variant: "quote", text, attribution };
  }

  // tip | cta | custom — need at least a headline or a body.
  const headline = capWords(clean(s.headline), CAPS.headline);
  const body = capWords(clean(s.body), CAPS.body);
  if (!headline && !body) return null;
  return { t: "marketing", variant, headline, body };
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
  const mode = body.mode === "caption" ? "caption" : "compose";

  if (mode === "compose") {
    if (typeof body.idea !== "string" || !body.idea.trim()) {
      return json({ error: "Tell the AI what the carousel is about." }, 400);
    }
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
      { error: "AI drafting isn't available for this account." },
      403,
    );
  }

  // ── 4. AI rate limit (shared) — ONE check for the whole batch ────────────────
  const limited = await enforceAiRateLimits(admin, FN_NAME, userId, cors);
  if (limited) return limited;

  // ── 5. Generate ──────────────────────────────────────────────────────────────
  const allowRealAttribution = body.allowRealAttribution === true;
  const allowDataSlides = body.allowDataSlides !== false;
  // Clamp to [2,10]. An explicit 0/1 clamps UP to 2 (not the default); only a missing/NaN
  // count falls back to 5 — `|| 5` would wrongly turn an explicit 0 into 5 (review #12).
  const roundedCount = Math.round(Number(body.slideCount));
  const slideCount = Number.isFinite(roundedCount)
    ? Math.max(IG_MIN_SLIDES, Math.min(IG_MAX_SLIDES, roundedCount))
    : 5;

  let text: string;
  let totalTokens = 0;
  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: mode === "compose" ? MODEL_SMART : MODEL_FAST,
      max_tokens: mode === "compose" ? COMPOSE_MAX_TOKENS : CAPTION_MAX_TOKENS,
      system:
        mode === "compose"
          ? composeSystemPrompt(allowRealAttribution)
          : CAPTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            mode === "compose"
              ? composeUserMessage(body, slideCount)
              : captionUserMessage(body),
        },
      ],
    });
    totalTokens =
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0);
    text = extractText(response);
  } catch (err) {
    console.error(`[${FN_NAME}] Anthropic call failed:`, err);
    return json({ error: "AI generation failed. Please try again." }, 502);
  }

  // ── 6. Record token spend (best-effort) — ONCE for the batch ─────────────────
  await recordAiTokens(admin, userId, totalTokens);

  // ── 7a. Caption mode — plain text out ────────────────────────────────────────
  if (mode === "caption") {
    // cleanCaption strips markdown but KEEPS hashtags + line breaks (review #1).
    const caption = capWords(cleanCaption(text), CAPTION_CAP);
    if (!caption)
      return json({ error: "AI returned an empty caption. Try again." }, 502);
    return json({ caption, tokensUsed: totalTokens }, 200);
  }

  // ── 7b. Compose mode — parse + validate the deck ─────────────────────────────
  let parsed: { slides?: unknown; caption?: unknown };
  try {
    parsed = parseJsonFromText(text) as { slides?: unknown; caption?: unknown };
  } catch {
    console.error(`[${FN_NAME}] could not parse AI JSON`);
    return json({ error: "AI returned an unexpected format. Try again." }, 502);
  }

  const rawSlides = Array.isArray(parsed.slides) ? parsed.slides : [];
  const slides = rawSlides
    .map((s) => normalizeSlide(s, allowDataSlides, allowRealAttribution))
    .filter((s): s is ComposedSlide => s !== null)
    .slice(0, slideCount);

  if (slides.length < IG_MIN_SLIDES) {
    return json(
      { error: "AI couldn't build a full carousel. Try a clearer idea." },
      502,
    );
  }

  // cleanCaption (not clean) so the compose caption keeps its hashtags (review #1).
  const caption = capWords(cleanCaption(parsed.caption), CAPTION_CAP);

  return json({ slides, caption, tokensUsed: totalTokens }, 200);
});
