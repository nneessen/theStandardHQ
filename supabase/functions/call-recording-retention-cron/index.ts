// supabase/functions/call-recording-retention-cron/index.ts
// ============================================================================
// Daily audio-retention sweep for the call-recordings feature (service-role only).
// Invoked by pg_cron via pg_net (migration 20260610203740).
//
// Deletes the AUDIO BLOB of recordings older than their IMO's retention window
// (default 180 days, overridable via imos.settings.call_recording_retention_days)
// — but ONLY when transcription is 'completed', so we never lose a recording
// that was never transcribed. The DB row + transcript + analysis are kept
// forever; audio_deleted_at marks the purge so the UI shows a transcript-only
// state and the storage quota excludes the freed bytes.
//
// Delete-first then mark: self-healing. A re-run skips rows already marked
// (audio_deleted_at IS NULL filter), and removeAll tolerates already-gone objects.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { removeAll } from "../_shared/storage-recursive.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_RETENTION_DAYS = 180;
const BATCH_LIMIT = 1000; // recordings purged per daily run (catches up over days)
const DAY_MS = 24 * 60 * 60 * 1000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Service-role only (cron caller).
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.slice(7) !== SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const errors: string[] = [];

  // 1. Build the per-IMO retention map (override or default), and the smallest
  //    window across all IMOs so we can fetch with one broad date filter.
  const retentionByImo = new Map<string, number>();
  let minDays = DEFAULT_RETENTION_DAYS;
  {
    const { data: imos, error } = await admin
      .from("imos")
      .select("id, settings");
    if (error) {
      errors.push(`imos: ${error.message}`);
    }
    for (const imo of imos ?? []) {
      const raw = (imo.settings as Record<string, unknown> | null)
        ?.call_recording_retention_days;
      const days = Number(raw);
      const eff =
        Number.isFinite(days) && days > 0 ? days : DEFAULT_RETENTION_DAYS;
      retentionByImo.set(imo.id as string, eff);
      if (eff < minDays) minDays = eff;
    }
  }

  // 2. Fetch candidate rows older than the broadest window (oldest first).
  const broadCutoff = new Date(Date.now() - minDays * DAY_MS).toISOString();
  const { data: candidates, error: selErr } = await admin
    .from("kpi_call_recordings")
    .select(
      "id, imo_id, storage_bucket, storage_path, file_size_bytes, created_at",
    )
    .eq("transcription_status", "completed")
    .is("audio_deleted_at", null)
    .lt("created_at", broadCutoff)
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);
  if (selErr) {
    errors.push(`select: ${selErr.message}`);
    return json({ status: "degraded", scanned: 0, deleted: 0, errors }, 500);
  }

  // 3. Keep only rows past THEIR IMO's effective window.
  const now = Date.now();
  const due = (candidates ?? []).filter((r) => {
    const days =
      retentionByImo.get(r.imo_id as string) ?? DEFAULT_RETENTION_DAYS;
    return new Date(r.created_at as string).getTime() < now - days * DAY_MS;
  });

  if (due.length === 0) {
    return json({
      status: errors.length ? "degraded" : "ok",
      scanned: candidates?.length ?? 0,
      deleted: 0,
      bytes_freed: 0,
      errors,
    });
  }

  // 4. Delete the audio blobs (chunked, tolerant), grouped by bucket.
  const pathsByBucket = new Map<string, string[]>();
  let bytesFreed = 0;
  for (const r of due) {
    const bucket = (r.storage_bucket as string) || "call-recordings";
    const arr = pathsByBucket.get(bucket) ?? [];
    arr.push(r.storage_path as string);
    pathsByBucket.set(bucket, arr);
    bytesFreed += (r.file_size_bytes as number | null) ?? 0;
  }
  for (const [bucket, paths] of pathsByBucket) {
    try {
      await removeAll(admin, bucket, paths);
    } catch (e) {
      errors.push(`remove(${bucket}): ${e instanceof Error ? e.message : e}`);
    }
  }

  // 5. Mark rows purged (transcript/analysis stay). Self-healing on re-run.
  const ids = due.map((r) => r.id as string);
  const { error: updErr } = await admin
    .from("kpi_call_recordings")
    .update({ audio_deleted_at: new Date().toISOString() })
    .in("id", ids);
  if (updErr) errors.push(`mark: ${updErr.message}`);

  return json(
    {
      status: errors.length ? "degraded" : "ok",
      scanned: candidates?.length ?? 0,
      deleted: due.length,
      bytes_freed: bytesFreed,
      errors,
    },
    errors.length ? 500 : 200,
  );
});
