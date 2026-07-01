// cancel-reel — delete/dismiss a reel job (and its clips via FK cascade).
// The escape hatch for a job that's stuck processing or one the user just wants gone.
//
// Auth: caller JWT. The job must belong to the caller's agency (imo_id). Runs the delete as
// service role (the reel_jobs table is grant-hardened SELECT-only for authenticated, so writes
// flow through this function — same pattern as generate-reels).

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

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  if (!jobId) return json({ error: "jobId is required" }, 400);

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

  // The job must belong to the caller's agency.
  const { data: job } = await admin
    .from("reel_jobs")
    .select("id, imo_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return json({ error: "Job not found" }, 404);

  const { data: prof } = await admin
    .from("user_profiles")
    .select("imo_id")
    .eq("id", userId)
    .maybeSingle();
  if (!prof?.imo_id || prof.imo_id !== (job as { imo_id?: string }).imo_id) {
    return json({ error: "Not allowed" }, 403);
  }

  // Delete the job; reel_clips rows cascade (FK ON DELETE CASCADE).
  const { error: delErr } = await admin
    .from("reel_jobs")
    .delete()
    .eq("id", jobId);
  if (delErr) {
    console.error("[cancel-reel] delete failed", delErr);
    return json({ error: "Couldn't cancel the job." }, 500);
  }

  return json({ ok: true }, 200);
});
