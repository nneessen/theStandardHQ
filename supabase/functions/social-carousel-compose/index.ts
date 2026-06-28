// social-carousel-compose — AI assembles a WHOLE Instagram carousel for Social Studio from
// ONE idea, refines a rough idea, OR writes a deck-aware caption for an already-built deck.
// The sibling social-marketing-copy drafts ONE slide; this one drafts the whole set.
//
// Three modes on one function (shared auth / AI-gate / rate-limit / Anthropic infra):
//   • mode:"compose" — { idea, slideCount, agencyName, network?, framework?, facts?,
//       allowRealAttribution?, allowDataSlides?, availableViews? } → { slides:[…], caption }
//       The AI returns an ORDERED deck spec (the SAME shape socialDeckService persists) using
//       a LIBRARY of layout archetypes (hook / list / checklist / stat / compare / quote /
//       tip / cta / custom) + data slides ({ t:"data", view } — the app fills real numbers).
//   • mode:"enhance" — { idea, agencyName?, network?, facts? } → { enhancedIdea }
//       Refines a rough one-liner into a sharper creative brief the composer builds from.
//   • mode:"caption" — { agencyName, network?, slides:[descriptors] } → { caption }
//
// HONESTY: the model must NEVER invent dollar amounts, counts, rankings, awards, or named
// people. It MAY cite numbers/names ONLY from the REAL FACTS block we pass (assembled
// client-side from the agency's live metrics, sent only when NOT showing sample data). Quote
// attribution is gated by `allowRealAttribution` (false → forced empty).

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
  MODEL_BEST,
  MODEL_FAST,
  MODEL_SMART,
  parseJsonFromText,
} from "../close-ai-builder/ai/anthropic-client.ts";
import {
  capLine,
  capWords,
  CAPTION_CAP,
  clean,
  cleanCaption,
  cleanList,
  COPY_CAPS as CAPS,
  LIST_CAPS,
} from "../_shared/social-copy.ts";

const FN_NAME = "social-carousel-compose";
// Headroom for a full 10-slide RICH deck (structured archetypes + arrays) + a ~2,200-char
// caption in one JSON blob — the model doesn't know the per-field caps are enforced
// server-side, so a verbose max-size response must not truncate mid-JSON (parseJsonFromText
// would throw → 502). Raised from 4096 for the richer schema.
const COMPOSE_MAX_TOKENS = 8000;
const ENHANCE_MAX_TOKENS = 700;
const CAPTION_MAX_TOKENS = 1024;

const IG_MIN_SLIDES = 2;
const IG_MAX_SLIDES = 10;

const VARIANTS = [
  "hook",
  "list",
  "checklist",
  "stat",
  "compare",
  "quote",
  "tip",
  "cta",
  "custom",
] as const;
const VIEWS = ["daily", "weekly", "monthly", "aotw"] as const;
type Variant = (typeof VARIANTS)[number];
type View = (typeof VIEWS)[number];

interface ListItem {
  label: string;
  detail?: string;
}
interface CompareCol {
  title: string;
  items: string[];
}
type ComposedSlide =
  | { t: "data"; view: View }
  | {
      t: "marketing";
      variant: Variant;
      eyebrow?: string;
      text?: string;
      attribution?: string;
      headline?: string;
      subheadline?: string;
      body?: string;
      items?: ListItem[];
      bullets?: string[];
      stat?: string;
      statLabel?: string;
      compare?: { left: CompareCol; right: CompareCol };
      ctaAction?: string;
    };

function isView(v: unknown): v is View {
  return typeof v === "string" && (VIEWS as readonly string[]).includes(v);
}
function isVariant(v: unknown): v is Variant {
  return typeof v === "string" && (VARIANTS as readonly string[]).includes(v);
}

// ── Real-facts payload (client assembles from live metrics; AI may cite ONLY these) ──────
interface KpiFacts {
  periodLabel?: string;
  totalAp?: number;
  policyCount?: number;
  agentCount?: number;
  avgApPerAgent?: number;
  topAgent?: { name?: string; ap?: number; policies?: number };
  topFive?: Array<{
    rank?: number;
    name?: string;
    ap?: number;
    policies?: number;
  }>;
}

export function readFacts(raw: unknown): KpiFacts | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as KpiFacts;
  // Treat as present only if there's at least one real aggregate to cite.
  const hasAggregate =
    typeof f.totalAp === "number" ||
    typeof f.policyCount === "number" ||
    typeof f.agentCount === "number" ||
    !!f.topAgent;
  return hasAggregate ? f : null;
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

function factsBlock(f: KpiFacts): string {
  const lines: string[] = [];
  if (f.periodLabel) lines.push(`Period: ${f.periodLabel}`);
  if (typeof f.totalAp === "number")
    lines.push(`Total annual premium (AP): ${usd(f.totalAp)}`);
  if (typeof f.policyCount === "number")
    lines.push(`Policies written: ${f.policyCount}`);
  if (typeof f.agentCount === "number")
    lines.push(`Active agents: ${f.agentCount}`);
  if (typeof f.avgApPerAgent === "number")
    lines.push(`Average AP per agent: ${usd(f.avgApPerAgent)}`);
  if (f.topAgent?.name) {
    const p =
      typeof f.topAgent.policies === "number"
        ? `, ${f.topAgent.policies} policies`
        : "";
    const ap =
      typeof f.topAgent.ap === "number" ? ` — ${usd(f.topAgent.ap)} AP` : "";
    lines.push(`Top agent: ${f.topAgent.name}${ap}${p}`);
  }
  if (Array.isArray(f.topFive) && f.topFive.length) {
    const rows = f.topFive
      .filter((r) => r && r.name)
      .map(
        (r) =>
          `  ${r.rank ?? "?"}. ${r.name}${
            typeof r.ap === "number" ? ` — ${usd(r.ap)} AP` : ""
          }`,
      );
    if (rows.length) lines.push(`Top performers:\n${rows.join("\n")}`);
  }
  return lines.join("\n");
}

const FRAMEWORKS: Record<string, string> = {
  list: "a numbered how-to / tips / mistakes listicle (hook → numbered value slides → CTA)",
  "problem-solution":
    "Problem→Agitate→Solution (hook names the pain → why it costs them → the fix/proof → CTA)",
  story: "a short narrative arc (setup → tension → turn/lesson → CTA)",
  recruiting:
    "a recruiting pitch (hook → why agents choose us → proof/benefits → who it's for → CTA to apply)",
};

// ── Compose-mode system prompt ───────────────────────────────────────────────
export function composeSystemPrompt(
  allowRealAttribution: boolean,
  hasFacts: boolean,
): string {
  const statShape = hasFacts
    ? `- { "t": "marketing", "variant": "stat", "stat": "ONE number copied verbatim from the FACTS block (e.g. $1.2M, 65%, 340)", "statLabel": "WHAT IT MEASURES", "body": "" }\n`
    : "";
  return `You are a senior social-media creative director and direct-response copywriter for an insurance sales & recruiting agency. You design ONE complete, scroll-stopping Instagram carousel (an ordered set of designed slides) plus the post caption. Think like a top creator: a magnetic hook, one idea per slide, tight punchy copy, and a strong close.

OUTPUT: respond with ONLY a single JSON object, no prose and no markdown fences:
{ "slides": [ … ], "caption": "…" }

Each slide is EXACTLY one of these shapes — use the EXACT keys shown. PICK THE LAYOUT THAT FITS THE CONTENT; vary layouts across the deck (do NOT make every slide the same shape):
- { "t": "marketing", "variant": "hook", "eyebrow": "tiny kicker (optional)", "headline": "5–9 word scroll-stopper", "subheadline": "one clarifying line (optional)" }
- { "t": "marketing", "variant": "list", "headline": "the promise", "items": [ { "label": "verb-led step (3–6 words)", "detail": "one short clarifying line (optional)" } ] }
- { "t": "marketing", "variant": "checklist", "headline": "the promise", "bullets": [ "punchy benefit line", "another" ] }
${statShape}- { "t": "marketing", "variant": "compare", "headline": "the contrast", "compare": { "left": { "title": "Most agencies", "items": [ "short line", "short line" ] }, "right": { "title": "Us", "items": [ "short line", "short line" ] } } }
- { "t": "marketing", "variant": "quote", "text": "one strong line", "attribution": "" }
- { "t": "marketing", "variant": "tip", "headline": "short hook", "body": "1–2 COMPLETE sentences of practical value" }
- { "t": "marketing", "variant": "cta", "headline": "short hook", "body": "one warm sentence", "ctaAction": "Comment APPLY" }
- { "t": "marketing", "variant": "custom", "headline": "short hook", "body": "1–2 sentences over the user's own photo" }
- { "t": "data", "view": "daily" | "weekly" | "monthly" | "aotw" }

ARC (always):
- Slide 1 is ALWAYS a "hook" — the most important slide; earn the swipe.
- The LAST slide is ALWAYS a "cta" with a single, low-friction action (comment a keyword, DM, or follow). Use a high-agency verb.
- Middle slides deliver value — alternate among list / checklist / compare / quote / tip${hasFacts ? " / stat" : ""}. One idea per slide. Each slide should make the reader want the next.

COPY RULES:
- Write COMPLETE thoughts that FIT a slide. Keep it tight, but NEVER cut a sentence off — no trailing fragments, no "…". A hook is 5–9 words; list labels are 3–6 word verb-led fragments; checklist lines are short and punchy; tip bodies are 1–2 finished sentences.
- 3–5 items for a list; 3–6 bullets for a checklist; 2–4 short lines per compare column.
- Plain text only: no markdown, no surrounding quotation marks, no emojis, no hashtags in slide copy.

QUOTE ATTRIBUTION:
${
  allowRealAttribution
    ? `- For a "quote" slide, use a GENUINE, well-known quote and attribute it to the CORRECT real person in "attribution". If you are not confident of the exact wording and author, write an ORIGINAL line instead and set "attribution" to "".`
    : `- For a "quote" slide, write an ORIGINAL line and set "attribution" to "". NEVER attribute the line to a real or famous person.`
}

DATA SLIDES:
- A "data" slide is auto-filled by the app from the agency's REAL live metrics (leaderboard / agent-of-the-week). You ONLY choose the view — NEVER write any numbers, names, rankings, or dollar amounts in it.

HONESTY (critical):
${
  hasFacts
    ? `- A REAL FACTS block is provided in the user message. You MAY cite numbers and agent names, but ONLY ones that appear verbatim in that FACTS block. For a "stat" slide, "stat" must be a number copied from FACTS. NEVER invent, round differently, extrapolate, or guess any figure, ranking, award, or name that is not in FACTS.`
    : `- NO facts were provided. Do NOT state any specific dollar amount, count, ranking, percentage, award, or named person. Keep claims qualitative. Do NOT use a "stat" slide.`
}

CAPTION:
- The caption ties the whole carousel together and invites engagement; it MAY use a few tasteful hashtags on their OWN line at the end. Keep it under ${CAPTION_CAP} characters. Same honesty rule applies.`;
}

export function composeUserMessage(
  req: Record<string, unknown>,
  slideCount: number,
  facts: KpiFacts | null,
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

  const fw = typeof req.framework === "string" ? req.framework : "auto";
  if (fw !== "auto" && FRAMEWORKS[fw])
    parts.push(`Use this narrative framework: ${FRAMEWORKS[fw]}.`);

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

  if (facts) {
    parts.push(
      `REAL FACTS (you may cite ONLY these numbers/names — never invent others):\n${factsBlock(
        facts,
      )}`,
    );
  }

  parts.push(
    `Return EXACTLY ${slideCount} slides in "slides", in the order they should appear (slide 1 = hook, last = cta), plus a "caption".`,
  );
  return parts.join("\n\n");
}

// ── Enhance-mode prompts ─────────────────────────────────────────────────────
const ENHANCE_SYSTEM_PROMPT = `You are a marketing strategist for an insurance sales & recruiting agency. A user gives you a rough, vague idea for an Instagram carousel. Rewrite it into a SHARPER creative brief the design team can build a high-converting carousel from.

OUTPUT: respond with ONLY the refined brief as plain text (no JSON, no markdown headings, no preamble like "Here is"). Keep it under ~120 words. Include, in a natural compact form:
- a specific angle / hook direction,
- the target audience (clients vs prospective agents),
- 3–5 concrete points or steps the carousel should cover,
- a suggested call to action.

Make it concrete and specific — turn a vague topic into something with a clear promise. Do NOT invent specific dollar amounts, rankings, or named people.`;

function enhanceUserMessage(req: Record<string, unknown>): string {
  const agencyName =
    typeof req.agencyName === "string" && req.agencyName.trim()
      ? req.agencyName.trim()
      : "an insurance agency";
  const parts = [`Agency: ${agencyName}.`];
  if (typeof req.network === "string" && req.network.trim())
    parts.push(`Network: ${req.network.trim()}.`);
  parts.push(`Rough idea: ${String(req.idea ?? "").trim()}`);
  parts.push(`Rewrite this into a sharper carousel brief.`);
  return parts.join("\n");
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
function cleanItems(raw: unknown): ListItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ListItem[] = [];
  for (const v of raw) {
    const o = (v ?? {}) as Record<string, unknown>;
    const label = capLine(o.label, CAPS.itemLabel);
    if (!label) continue;
    const detail = capLine(o.detail, CAPS.itemDetail);
    out.push(detail ? { label, detail } : { label });
    if (out.length >= LIST_CAPS.items) break;
  }
  return out;
}

function cleanCompareCol(raw: unknown): CompareCol | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const title = capLine(o.title, CAPS.compareTitle);
  const items = cleanList(o.items, LIST_CAPS.compareItems, CAPS.compareItem);
  if (!title && items.length === 0) return null;
  return { title, items };
}

export function normalizeSlide(
  raw: unknown,
  allowDataSlides: boolean,
  allowRealAttribution: boolean,
  hasFacts: boolean,
): ComposedSlide | null {
  const s = (raw ?? {}) as Record<string, unknown>;
  const hasVariant = isVariant(s.variant);

  // Data slide — AI only picked a view; the app fills the numbers.
  const isData =
    s.t === "data" || (s.t !== "marketing" && !hasVariant && isView(s.view));
  if (isData) {
    if (!allowDataSlides) return null;
    return isView(s.view) ? { t: "data", view: s.view } : null;
  }

  if (!isVariant(s.variant)) return null;
  const variant = s.variant;
  const eyebrow = capLine(s.eyebrow, CAPS.eyebrow);

  if (variant === "quote") {
    const text = capLine(s.text, CAPS.text);
    if (!text) return null; // a quote with no line is useless
    const attribution = allowRealAttribution
      ? capLine(s.attribution, CAPS.attribution)
      : "";
    return { t: "marketing", variant: "quote", text, attribution };
  }

  if (variant === "hook") {
    const headline = capLine(s.headline, CAPS.headline);
    if (!headline) return null;
    return {
      t: "marketing",
      variant: "hook",
      headline,
      ...(eyebrow ? { eyebrow } : {}),
      ...(capLine(s.subheadline, CAPS.subheadline)
        ? { subheadline: capLine(s.subheadline, CAPS.subheadline) }
        : {}),
    };
  }

  if (variant === "list") {
    const items = cleanItems(s.items);
    if (items.length === 0) return null;
    return {
      t: "marketing",
      variant: "list",
      headline: capLine(s.headline, CAPS.headline),
      items,
      ...(eyebrow ? { eyebrow } : {}),
    };
  }

  if (variant === "checklist") {
    const bullets = cleanList(s.bullets, LIST_CAPS.bullets, CAPS.bullet);
    if (bullets.length === 0) return null;
    return {
      t: "marketing",
      variant: "checklist",
      headline: capLine(s.headline, CAPS.headline),
      bullets,
      ...(eyebrow ? { eyebrow } : {}),
    };
  }

  if (variant === "stat") {
    // A stat is only legitimate when REAL facts were provided; otherwise drop it so the AI
    // can never surface a fabricated number (defense-in-depth with the prompt).
    if (!hasFacts) return null;
    const stat = capLine(s.stat, CAPS.stat);
    if (!stat) return null;
    return {
      t: "marketing",
      variant: "stat",
      stat,
      statLabel: capLine(s.statLabel, CAPS.statLabel),
      ...(capLine(s.body, CAPS.body)
        ? { body: capLine(s.body, CAPS.body) }
        : {}),
      ...(eyebrow ? { eyebrow } : {}),
    };
  }

  if (variant === "compare") {
    const left = cleanCompareCol((s.compare as Record<string, unknown>)?.left);
    const right = cleanCompareCol(
      (s.compare as Record<string, unknown>)?.right,
    );
    if (!left || !right) return null;
    if (left.items.length + right.items.length < 2) return null;
    return {
      t: "marketing",
      variant: "compare",
      headline: capLine(s.headline, CAPS.headline),
      compare: { left, right },
      ...(eyebrow ? { eyebrow } : {}),
    };
  }

  // tip | cta | custom — need at least a headline or a body.
  const headline = capLine(s.headline, CAPS.headline);
  const body = capLine(s.body, CAPS.body);
  if (!headline && !body) return null;
  const base = {
    t: "marketing" as const,
    variant,
    headline,
    body,
    ...(eyebrow ? { eyebrow } : {}),
  };
  if (variant === "cta") {
    const ctaAction = capLine(s.ctaAction, CAPS.ctaAction);
    return ctaAction ? { ...base, ctaAction } : base;
  }
  return base;
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
  const mode =
    body.mode === "caption"
      ? "caption"
      : body.mode === "enhance"
        ? "enhance"
        : "compose";

  if (mode === "compose" || mode === "enhance") {
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
  const facts = mode === "compose" ? readFacts(body.facts) : null;
  const hasFacts = !!facts;
  // Clamp to [2,10]. An explicit 0/1 clamps UP to 2 (not the default); only a missing/NaN
  // count falls back to 5 — `|| 5` would wrongly turn an explicit 0 into 5 (review #12).
  const roundedCount = Math.round(Number(body.slideCount));
  const slideCount = Number.isFinite(roundedCount)
    ? Math.max(IG_MIN_SLIDES, Math.min(IG_MAX_SLIDES, roundedCount))
    : 5;

  const model =
    mode === "compose"
      ? MODEL_BEST
      : mode === "enhance"
        ? MODEL_SMART
        : MODEL_FAST;
  const maxTokens =
    mode === "compose"
      ? COMPOSE_MAX_TOKENS
      : mode === "enhance"
        ? ENHANCE_MAX_TOKENS
        : CAPTION_MAX_TOKENS;
  const system =
    mode === "compose"
      ? composeSystemPrompt(allowRealAttribution, hasFacts)
      : mode === "enhance"
        ? ENHANCE_SYSTEM_PROMPT
        : CAPTION_SYSTEM_PROMPT;
  const userContent =
    mode === "compose"
      ? composeUserMessage(body, slideCount, facts)
      : mode === "enhance"
        ? enhanceUserMessage(body)
        : captionUserMessage(body);

  let text: string;
  let totalTokens = 0;
  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
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
    const caption = capWords(cleanCaption(text), CAPTION_CAP);
    if (!caption)
      return json({ error: "AI returned an empty caption. Try again." }, 502);
    return json({ caption, tokensUsed: totalTokens }, 200);
  }

  // ── 7b. Enhance mode — refined brief out ─────────────────────────────────────
  if (mode === "enhance") {
    // cleanCaption keeps line breaks (the brief may be a short bulleted list) and strips
    // markdown; cap to a comfortable brief length.
    const enhancedIdea = capWords(cleanCaption(text), 1200);
    if (!enhancedIdea)
      return json({ error: "AI returned nothing. Try again." }, 502);
    return json({ enhancedIdea, tokensUsed: totalTokens }, 200);
  }

  // ── 7c. Compose mode — parse + validate the deck ─────────────────────────────
  let parsed: { slides?: unknown; caption?: unknown };
  try {
    parsed = parseJsonFromText(text) as { slides?: unknown; caption?: unknown };
  } catch {
    console.error(`[${FN_NAME}] could not parse AI JSON`);
    return json({ error: "AI returned an unexpected format. Try again." }, 502);
  }

  const rawSlides = Array.isArray(parsed.slides) ? parsed.slides : [];
  const slides = rawSlides
    .map((s) =>
      normalizeSlide(s, allowDataSlides, allowRealAttribution, hasFacts),
    )
    .filter((s): s is ComposedSlide => s !== null)
    .slice(0, slideCount);

  if (slides.length < IG_MIN_SLIDES) {
    return json(
      { error: "AI couldn't build a full carousel. Try a clearer idea." },
      502,
    );
  }

  const caption = capWords(cleanCaption(parsed.caption), CAPTION_CAP);

  return json({ slides, caption, tokensUsed: totalTokens }, 200);
});
