// generate-reels — Social Studio "YouTube → Reels".
// Takes a YouTube watch URL, submits it to Vizard (AI highlight clips), and inserts a
// reel_jobs row (status=processing). The reels-poll cron finalizes it once Vizard is done.
//
// Auth: caller JWT (Spotlight is super-admin gated; we reuse the shared AI-access gate so an
// AI-add-on agency could also use it). Writes run as service role and derive imo_id from
// auth.uid() — the client never supplies imo_id.
//
// ⚠️ STEP-0 CONTRACT NOTE: the Vizard project/create response shape (where `projectId` lives,
// and the success `code`) is taken from docs. Confirm against one real call before relying on
// it in prod; this handler parses defensively and surfaces the raw Vizard body on mismatch.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import {
  createSupabaseClient,
  createSupabaseAdminClient,
} from "../_shared/supabase-client.ts";
import { resolveAiAccessFacts } from "../_shared/resolve-ai-access.ts";
import { enforceAiRateLimits } from "../_shared/rate-limit.ts";

const FN_NAME = "generate-reels";
const VIZARD_CREATE_URL =
  "https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/create";

// Accept standard YouTube watch / youtu.be / shorts URLs. (Vizard rejects Live URLs itself.)
const YOUTUBE_RE =
  /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  const cors = getCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return json({ error: "A YouTube video link is required." }, 400);
  if (!YOUTUBE_RE.test(url)) {
    return json(
      {
        error:
          "That doesn't look like a standard YouTube video link. Paste a youtube.com/watch?v=… or youtu.be/… URL (live streams aren't supported).",
      },
      400,
    );
  }

  // Options (clamped). ratioOfClip 1 = 9:16 vertical (Reels default).
  const maxClipNumber = clampInt(body.maxClipNumber, 6, 1, 20);
  const ratioOfClip = clampInt(body.ratioOfClip, 1, 1, 4);
  const lang = typeof body.lang === "string" && body.lang ? body.lang : "en";

  // Authenticate the caller.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
  const userClient = createSupabaseClient(authHeader);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } =
    await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  const admin = createSupabaseAdminClient();

  // AI-access gate (super-admin OR imo grants-all OR ai_assistant add-on).
  const aiFacts = await resolveAiAccessFacts(admin, userId);
  if (
    !aiFacts.isSuperAdmin &&
    !aiFacts.imoGrantsAllFeatures &&
    !aiFacts.hasAiAddon
  ) {
    return json(
      { error: "Reels generation isn't available for this account." },
      403,
    );
  }

  // Throttle (per-fn hourly request cap; shared daily token cap is a no-op here — no AI tokens).
  const limited = await enforceAiRateLimits(admin, FN_NAME, userId, cors);
  if (limited) return limited;

  // Derive the caller's agency. imo_id is NEVER trusted from the client.
  const { data: prof } = await admin
    .from("user_profiles")
    .select("imo_id")
    .eq("id", userId)
    .maybeSingle();
  const imoId = prof?.imo_id as string | undefined;
  if (!imoId) return json({ error: "No agency found for this account." }, 400);

  const VIZARD_API_KEY = Deno.env.get("VIZARD_API_KEY");
  if (!VIZARD_API_KEY) {
    console.error("[generate-reels] VIZARD_API_KEY secret is not set");
    return json({ error: "Reels service isn't configured yet." }, 503);
  }

  // Submit to Vizard.
  let vizardJson: Record<string, unknown> = {};
  let vizardStatus = 0;
  try {
    const resp = await fetch(VIZARD_CREATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        VIZARDAI_API_KEY: VIZARD_API_KEY,
      },
      body: JSON.stringify({
        lang,
        videoUrl: url,
        videoType: 2, // 2 = YouTube
        ratioOfClip, // 1 = 9:16
        subtitleSwitch: 1, // burn captions
        headlineSwitch: 0,
        maxClipNumber,
      }),
    });
    vizardStatus = resp.status;
    vizardJson = (await resp.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
  } catch (e) {
    console.error("[generate-reels] Vizard create call failed:", e);
    return json(
      { error: "Couldn't reach the Reels service. Try again shortly." },
      502,
    );
  }

  if (vizardStatus === 401 || vizardStatus === 403) {
    console.error(
      "[generate-reels] Vizard auth error",
      vizardStatus,
      vizardJson,
    );
    return json({ error: "Reels service rejected the API key." }, 502);
  }
  if (vizardStatus === 402 || vizardStatus === 429) {
    return json(
      {
        error:
          "The Reels service is out of credits or rate-limited. Check the Vizard plan.",
      },
      502,
    );
  }

  // projectId may be top-level or nested under data — parse defensively (STEP-0 note above).
  const projectId =
    pickStr(vizardJson, "projectId") ??
    pickStr((vizardJson.data as Record<string, unknown>) ?? {}, "projectId");
  if (!projectId) {
    console.error(
      "[generate-reels] No projectId in Vizard response",
      vizardStatus,
      vizardJson,
    );
    return json(
      {
        error:
          "The Reels service didn't accept that video. Make sure it's public and not a live stream.",
      },
      502,
    );
  }

  // Record the job (service role; RLS-bypassing). The cron picks it up from here.
  const { data: jobRow, error: insErr } = await admin
    .from("reel_jobs")
    .insert({
      imo_id: imoId,
      created_by: userId,
      source_url: url,
      vizard_project_id: String(projectId),
      status: "processing",
      params: { maxClipNumber, ratioOfClip, lang, subtitleSwitch: 1 },
    })
    .select("id")
    .single();

  if (insErr || !jobRow) {
    console.error("[generate-reels] Failed to insert reel_jobs row", insErr);
    return json({ error: "Couldn't save the reel job." }, 500);
  }

  return json({ jobId: jobRow.id }, 200);
});

function clampInt(v: unknown, dflt: number, min: number, max: number): number {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function pickStr(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = obj?.[key];
  if (typeof v === "string" && v) return v;
  if (typeof v === "number") return String(v);
  return undefined;
}
