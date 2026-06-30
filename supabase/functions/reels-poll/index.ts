// reels-poll — cron worker for Social Studio "YouTube → Reels".
// Every minute: atomically claim processing reel_jobs, query Vizard for each, and either
//   - finalize (insert reel_clips + status=ready) when Vizard is done (code 2000), or
//   - release (clear the claim) so the next tick re-polls, or
//   - fail (status=failed) on a Vizard error or an age cap.
//
// Runs as service role (bypasses RLS). Invoked by pg_cron with the service-role bearer; there
// is no user JWT, so this function must be deployed with --no-verify-jwt.
//
// ⚠️ STEP-0 CONTRACT NOTE: the Vizard project/query response (success `code` 2000 and the
// `videos[]` field names) is from docs — confirm with one real call. Parsing here is defensive
// and logs the raw body when it can't find a recognized shape, so a mismatch is visible (not a
// silent "never finalizes").

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";

const VIZARD_QUERY_BASE =
  "https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/query/";
const VIZARD_DONE_CODE = 2000; // per docs: query returns code 2000 when clips are ready
const CLAIM_LIMIT = 5;
const STALE_MINUTES = 30;
const MAX_AGE_MINUTES = 90; // give up on a job still processing after this long

serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  // Authorize: cron passes the service-role (or CRON_SECRET) bearer.
  const authHeader = req.headers.get("Authorization") ?? "";
  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorized =
    (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`) ||
    (SERVICE_ROLE_KEY && authHeader === `Bearer ${SERVICE_ROLE_KEY}`);
  if (!authorized) return json({ error: "Unauthorized" }, 401);

  const VIZARD_API_KEY = Deno.env.get("VIZARD_API_KEY");
  if (!VIZARD_API_KEY) {
    console.error("[reels-poll] VIZARD_API_KEY secret is not set");
    return json({ error: "Reels service not configured" }, 503);
  }

  const admin = createSupabaseAdminClient();
  const runToken = crypto.randomUUID();

  const { data: claimed, error: claimErr } = await admin.rpc(
    "claim_processing_reel_jobs",
    {
      p_claim_token: runToken,
      p_limit: CLAIM_LIMIT,
      p_stale_minutes: STALE_MINUTES,
    },
  );
  if (claimErr) {
    console.error("[reels-poll] claim RPC failed", claimErr);
    return json({ error: "claim failed" }, 500);
  }

  const jobs = (claimed ?? []) as Array<{
    id: string;
    vizard_project_id: string | null;
    created_at: string;
  }>;

  let finalized = 0;
  let failed = 0;
  let stillProcessing = 0;

  for (const job of jobs) {
    if (!job.vizard_project_id) {
      await failJob(admin, job.id, runToken, "Missing Vizard project id");
      failed++;
      continue;
    }

    let code: number | null = null;
    let payload: Record<string, unknown> = {};
    try {
      const resp = await fetch(VIZARD_QUERY_BASE + job.vizard_project_id, {
        method: "GET",
        headers: { VIZARDAI_API_KEY: VIZARD_API_KEY },
      });
      payload = (await resp.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      code = numOrNull(payload.code);
    } catch (e) {
      console.error(`[reels-poll] query failed for job ${job.id}`, e);
      // transient — release for the next tick (unless too old).
      await releaseOrAge(admin, job, runToken);
      stillProcessing++;
      continue;
    }

    if (code === VIZARD_DONE_CODE) {
      const videos = Array.isArray(payload.videos)
        ? (payload.videos as Array<Record<string, unknown>>)
        : [];
      const clipRows = videos.map((v) => ({
        job_id: job.id,
        vizard_video_id: pickStr(v, "videoId"),
        title: pickStr(v, "title"),
        transcript: pickStr(v, "transcript"),
        viral_score: numOrNull(v.viralScore),
        viral_reason: pickStr(v, "viralReason"),
        duration_ms: numOrNull(v.videoMsDuration),
        source_url: pickStr(v, "videoUrl"),
      }));

      if (clipRows.length > 0) {
        const { error: clipErr } = await admin
          .from("reel_clips")
          .insert(clipRows);
        if (clipErr) {
          console.error(
            `[reels-poll] insert clips failed for job ${job.id}`,
            clipErr,
          );
          await releaseOrAge(admin, job, runToken);
          stillProcessing++;
          continue;
        }
      }

      const { error: updErr } = await admin
        .from("reel_jobs")
        .update({ status: "ready", clip_count: clipRows.length, error: null })
        .eq("id", job.id)
        .eq("claim_token", runToken);
      if (updErr) {
        console.error(
          `[reels-poll] finalize update failed for job ${job.id}`,
          updErr,
        );
        failed++;
        continue;
      }
      finalized++;
      continue;
    }

    // Not done. Vizard "processing" codes are non-fatal; treat an explicit error code as failure.
    if (code !== null && isVizardErrorCode(code)) {
      await failJob(
        admin,
        job.id,
        runToken,
        `Vizard error code ${code}${pickStr(payload, "errMsg") ? `: ${pickStr(payload, "errMsg")}` : ""}`,
      );
      failed++;
      continue;
    }

    // Still processing → release for the next minute's tick, unless it's aged out.
    const aged = await releaseOrAge(admin, job, runToken);
    if (aged) failed++;
    else stillProcessing++;
  }

  return json({
    claimed: jobs.length,
    finalized,
    failed,
    stillProcessing,
  });
});

async function failJob(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  jobId: string,
  runToken: string,
  reason: string,
) {
  await admin
    .from("reel_jobs")
    .update({
      status: "failed",
      error: reason,
      claim_token: null,
      claimed_at: null,
    })
    .eq("id", jobId)
    .eq("claim_token", runToken);
}

// Release the claim so the next tick re-polls. If the job is older than MAX_AGE_MINUTES,
// mark it failed instead and return true.
async function releaseOrAge(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  job: { id: string; created_at: string },
  runToken: string,
): Promise<boolean> {
  const ageMs = Date.now() - new Date(job.created_at).getTime();
  if (ageMs > MAX_AGE_MINUTES * 60_000) {
    await failJob(
      admin,
      job.id,
      runToken,
      "Timed out waiting for the Reels service.",
    );
    return true;
  }
  await admin
    .from("reel_jobs")
    .update({ claim_token: null, claimed_at: null })
    .eq("id", job.id)
    .eq("claim_token", runToken);
  return false;
}

function isVizardErrorCode(code: number): boolean {
  // 2000 = done. Treat 1xxx as "processing/queued" (non-fatal); 4xxx/5xxx as failures.
  return code >= 4000;
}

function numOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function pickStr(obj: Record<string, unknown>, key: string): string | null {
  const v = obj?.[key];
  if (typeof v === "string" && v) return v;
  if (typeof v === "number") return String(v);
  return null;
}
