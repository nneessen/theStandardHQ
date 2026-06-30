// reels-download — streaming proxy so a generated reel actually downloads as a file.
// A cross-origin Vizard mp4 URL with an HTML `download` attribute would just open in a tab;
// this fetches the clip server-side and streams it back with Content-Disposition: attachment.
//
// Auth: caller JWT. The caller must belong to the same agency (imo_id) as the clip's parent
// reel_jobs row, enforced here with the service-role client (so no cross-tenant download).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import {
  createSupabaseClient,
  createSupabaseAdminClient,
} from "../_shared/supabase-client.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  const cors = getCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  // Accept clipId from query (?clipId=) or a JSON body.
  let clipId = new URL(req.url).searchParams.get("clipId") ?? "";
  if (!clipId && req.method === "POST") {
    try {
      const b = (await req.json()) as Record<string, unknown>;
      if (typeof b.clipId === "string") clipId = b.clipId;
    } catch {
      // ignore
    }
  }
  if (!clipId) return json({ error: "clipId is required" }, 400);

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

  // Load the clip + its parent job's agency, then verify the caller is in that agency.
  const { data: clip } = await admin
    .from("reel_clips")
    .select("id, title, source_url, stored_url, reel_jobs!inner(imo_id)")
    .eq("id", clipId)
    .maybeSingle();

  if (!clip) return json({ error: "Clip not found" }, 404);

  const jobImoId = (clip as { reel_jobs?: { imo_id?: string } }).reel_jobs
    ?.imo_id;
  const { data: prof } = await admin
    .from("user_profiles")
    .select("imo_id")
    .eq("id", userId)
    .maybeSingle();
  if (!jobImoId || !prof?.imo_id || prof.imo_id !== jobImoId) {
    return json({ error: "Not allowed" }, 403);
  }

  const mp4Url =
    (clip as { stored_url?: string | null; source_url?: string | null })
      .stored_url || (clip as { source_url?: string | null }).source_url;
  if (!mp4Url)
    return json({ error: "This clip has no downloadable file." }, 404);

  // Stream the mp4 back as an attachment.
  let upstream: Response;
  try {
    upstream = await fetch(mp4Url);
  } catch (e) {
    console.error("[reels-download] upstream fetch failed", e);
    return json(
      { error: "Couldn't fetch the clip (the link may have expired)." },
      502,
    );
  }
  if (!upstream.ok || !upstream.body) {
    return json(
      {
        error:
          "The clip link is no longer available (Vizard links expire after ~7 days).",
      },
      502,
    );
  }

  const rawTitle = (clip as { title?: string | null }).title || "reel";
  const filename = `${rawTitle.replace(/[^\w.-]+/g, "_").slice(0, 60) || "reel"}.mp4`;

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
