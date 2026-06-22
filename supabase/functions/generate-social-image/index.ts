// generate-social-image — renders an Agent-of-the-Week social graphic via
// Creatomate, filled from the card's live data. AOTW ONLY: the data-dense
// leaderboard/recap render faithfully in-house (modern-screenshot) and are
// deliberately NOT sent off-tenant.
//
// DESIGN-IN-CODE: the graphic is authored here as a Creatomate `source` (a full
// scene description) and rendered via POST /v1/renders { source } — NOT a saved
// `template_id`. That means the owner builds nothing in Creatomate (no editor, no
// thin template gallery) and the design is versioned in this repo. The design lab
// that produced this source (with live render previews) is
// scripts/creatomate/aotw-design.mjs.
//
// Flow mirrors generate-social-caption:
//   1. authenticate (real 401),
//   2. access gate via resolveAiAccessFacts (super-admin / IMO grants-all / add-on)
//      — fail closed (403); same gate as the caption fn + useAiAccess,
//   3. shared rate-limit (protects Creatomate render credits),
//   4. POST /v1/renders { source } — NO webhook,
//   5. poll GET /v1/renders/{id} until succeeded/failed, return { url }.
//
// PRIVACY: only the AOTW card leaves the tenant (one agent who is already being
// published on a public post). The agent photo is the PUBLIC Storage URL
// (spotlight-assets), never a data: URL.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from "../_shared/supabase-client.ts";
import { resolveAiAccessFacts } from "../_shared/resolve-ai-access.ts";
import { enforceAiRateLimits } from "../_shared/rate-limit.ts";
// The design lives in ONE place, shared with the verify harness so what renders here
// is byte-identical to what we proof-render offline (no hand-port to drift).
import { buildAotwSource } from "../_shared/aotwSource.mjs";

const FN_NAME = "generate-social-image";
const CREATOMATE_API = "https://api.creatomate.com/v1/renders";
const POLL_INTERVAL_MS = 1500;
const POLL_MAX = 30; // ~45s ceiling; image renders typically finish in 1–3s.

type Render = {
  id?: string;
  status?: string;
  url?: string;
  error_message?: string;
};

const str = (v: unknown, cap: number): string =>
  typeof v === "string" ? v.slice(0, cap) : "";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  const cors = getCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── 1. Body ──────────────────────────────────────────────────────────────────
  let ctx: Record<string, unknown>;
  try {
    ctx = ((await req.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }
  const agentName = str(ctx.agentName, 120);
  if (!agentName) return json({ error: "agentName is required." }, 400);

  // ── 2. Authenticate ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
  const db = createSupabaseClient(authHeader);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;
  const admin = createSupabaseAdminClient();

  // ── 3. Access gate (same as the caption fn; fail closed) ─────────────────────
  const facts = await resolveAiAccessFacts(admin, userId);
  if (!facts.isSuperAdmin && !facts.imoGrantsAllFeatures && !facts.hasAiAddon) {
    return json(
      { error: "Pro graphic generation isn't available for this account." },
      403,
    );
  }

  // ── 4. Rate limit (shared; protects render credits) ──────────────────────────
  const limited = await enforceAiRateLimits(admin, FN_NAME, userId, cors);
  if (limited) return limited;

  // ── 5. Config ────────────────────────────────────────────────────────────────
  const key = Deno.env.get("CREATOMATE_API_KEY");
  if (!key) {
    console.error(`[${FN_NAME}] CREATOMATE_API_KEY missing`);
    return json({ error: "Image generation is not configured." }, 503);
  }

  // Build the scene from the card's live data (design lives in code, not a template).
  const source = buildAotwSource({
    agentName,
    premium: str(ctx.premium, 40),
    policies: str(ctx.policies, 40),
    periodLabel: str(ctx.periodLabel, 80),
    agencyName: str(ctx.agencyName, 80),
    network: str(ctx.network, 80),
    photoUrl: str(ctx.photoUrl, 2000),
  });

  // ── 6. Render: POST (no webhook → async), then poll until terminal ───────────
  let render: Render | undefined;
  try {
    const res = await fetch(CREATOMATE_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(`[${FN_NAME}] Creatomate ${res.status}:`, data);
      return json({ error: "Image generation failed. Please try again." }, 502);
    }
    render = Array.isArray(data) ? (data[0] as Render) : (data as Render);
  } catch (err) {
    console.error(`[${FN_NAME}] Creatomate request failed:`, err);
    return json({ error: "Image generation failed. Please try again." }, 502);
  }

  for (
    let i = 0;
    render &&
    render.status !== "succeeded" &&
    render.status !== "failed" &&
    i < POLL_MAX;
    i++
  ) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const g = await fetch(`${CREATOMATE_API}/${render.id}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      render = (await g.json()) as Render;
    } catch (err) {
      console.error(`[${FN_NAME}] poll failed:`, err);
      break;
    }
  }

  if (render?.status !== "succeeded" || !render?.url) {
    console.error(
      `[${FN_NAME}] render not succeeded: status=${render?.status} error=${render?.error_message ?? ""}`,
    );
    return json(
      { error: "The image didn't finish rendering. Please try again." },
      504,
    );
  }

  return json({ url: render.url, id: render.id }, 200);
});
