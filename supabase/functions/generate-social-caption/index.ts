// generate-social-caption — AI generation of an Instagram caption for a Social
// Studio leaderboard/report graphic, from the card's live context.
//
// POST { view, periodLabel, agencyName, network?, topAgent?, totalAP?, agents?,
//        policies?, tone? } with a user JWT. Flow mirrors generate-workflow-email-
// template / generate-call-script:
//   1. authenticate (real 401),
//   2. AI-access gate via resolveAiAccessFacts (super-admin / IMO grants-all /
//      ai_assistant add-on) — fail closed (403); same gate as useAiAccess,
//   3. shared AI rate-limit,
//   4. ask the fast model for ONE caption as strict JSON { caption },
//   5. record token spend, validate, return { caption }.
//
// PRIVACY: the caller passes agent names already reduced to last-initial
// ("Marcus W."). The model is told to use names EXACTLY as given and never
// invent fuller names or numbers not supplied.

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

const FN_NAME = "generate-social-caption";
const MAX_TOKENS = 1024;

const SYSTEM_PROMPT = `You are a social-media copywriter for an insurance sales agency. You write ONE Instagram caption for the agency's social graphic — which may be a producer leaderboard, a monthly report, an "Agent of the Week" spotlight, a "welcome to the team" new-agent post, or a recruiting / "now hiring" post. Match the caption to the graphic described in the user message.

OUTPUT: respond with ONLY a single JSON object, no prose and no markdown fences:
{ "caption": "the full caption text" }

CAPTION RULES:
- 2–5 short lines: an energetic hook, a line that fits the graphic (celebrate results for a leaderboard, warmly welcome a new teammate, or invite agents to apply for a recruiting post), and a soft call-to-action.
- Tasteful emojis (a few, not every line). Insurance/financial-services appropriate; never spammy, never ALL CAPS shouting.
- End with 4–7 relevant hashtags on their own line (e.g. #lifeinsurance #insuranceagent #salesteam #leaderboard #topproducer — tailor to the data).
- Use the agency name and network if provided. Refer to agents EXACTLY by the names given (already first-name + last-initial); NEVER expand a name or invent a full last name.
- NEVER invent dollar amounts, counts, or rankings beyond what is supplied. If a number is missing, speak generally instead of guessing.
- Keep the whole caption under 2000 characters. Plain text only (no markdown, no HTML).`;

function buildUserMessage(ctx: Record<string, unknown>): string {
  const kind =
    ctx.view === "monthly"
      ? "monthly agency report"
      : ctx.view === "aotw"
        ? "Agent of the Week spotlight"
        : ctx.view === "newagent"
          ? "welcome-to-the-team post for a brand-new agent"
          : ctx.view === "recruiting"
            ? "agency recruiting / 'now hiring' post"
            : `${ctx.view} leaderboard`;
  const parts = [`Write the Instagram caption for a ${kind} graphic.`];
  if (ctx.view === "newagent")
    parts.push(
      "Write a warm, celebratory welcome for this new teammate — keep it about the welcome and the culture, NOT numbers or rankings.",
    );
  if (ctx.view === "recruiting")
    parts.push(
      "Write an inviting recruiting caption asking insurance agents to apply — focus on culture and quality of life; do NOT reference specific producers, dollar amounts, or rankings.",
    );
  if (ctx.agencyName) parts.push(`Agency: ${ctx.agencyName}.`);
  if (ctx.network) parts.push(`Network: ${ctx.network}.`);
  if (ctx.periodLabel) parts.push(`Period: ${ctx.periodLabel}.`);
  // On the AOTW spotlight there is exactly one agent — frame them as the subject,
  // not as a leaderboard's "top producer".
  if (ctx.topAgent)
    parts.push(
      ctx.view === "aotw"
        ? `Agent of the Week: ${ctx.topAgent}.`
        : ctx.view === "newagent"
          ? `New agent who just joined: ${ctx.topAgent}.`
          : `Top producer: ${ctx.topAgent}.`,
    );
  // For AOTW, totalAP carries the spotlighted agent's OWN premium — never label it
  // as an agency-wide total (it isn't one).
  if (typeof ctx.totalAP === "number" && ctx.totalAP > 0)
    parts.push(
      `${ctx.view === "aotw" ? "Agent's annual premium" : "Total annual premium"}: $${Math.round(ctx.totalAP as number).toLocaleString("en-US")}.`,
    );
  if (typeof ctx.agents === "number" && ctx.agents > 0)
    parts.push(`Agents counted: ${ctx.agents}.`);
  if (typeof ctx.policies === "number" && ctx.policies > 0)
    parts.push(`Policies: ${ctx.policies}.`);
  if (typeof ctx.tone === "string" && (ctx.tone as string).trim())
    parts.push(`Tone: ${(ctx.tone as string).trim()}.`);
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
  let ctx: Record<string, unknown>;
  try {
    ctx = ((await req.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }
  const view = ctx.view;
  if (
    view !== "daily" &&
    view !== "weekly" &&
    view !== "monthly" &&
    view !== "aotw" &&
    view !== "newagent" &&
    view !== "recruiting"
  ) {
    return json(
      {
        error:
          "view must be daily, weekly, monthly, aotw, newagent, or recruiting.",
      },
      400,
    );
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
      { error: "AI caption generation isn't available for this account." },
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
      model: MODEL_FAST,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(ctx) }],
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

  // ── 7. Validate ──────────────────────────────────────────────────────────────
  let parsed: { caption?: unknown };
  try {
    parsed = parseJsonFromText(text) as typeof parsed;
  } catch {
    console.error(`[${FN_NAME}] could not parse AI JSON`);
    return json({ error: "AI returned an unexpected format. Try again." }, 502);
  }
  const caption =
    typeof parsed.caption === "string" ? parsed.caption.trim() : "";
  if (!caption) {
    return json({ error: "AI returned an empty caption. Try again." }, 502);
  }

  return json(
    { caption: caption.slice(0, 2200), tokensUsed: totalTokens },
    200,
  );
});
